import test from "node:test";
import assert from "node:assert/strict";
import { SAVED_ANALYSES_KEY, IMPORT_RECEIPTS_KEY, readSavedAnalyses, createBrowserImporter } from "../src/services/browserMigration.js";

function storage(raw) {
  const values = new Map(raw ? [[SAVED_ANALYSES_KEY, raw]] : []);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
// Isolated migration fixtures; never seeded into application or MySQL data.
const entry = {
  id: "migration-test", analyzedAt: "2026-10-09T04:30:00.000Z",
  plant: { plant_name: "Migration test plant", plant_type: "Other", location: null, symptom: "Test symptoms" },
  result: { possible_issue: "Test issue", explanation: "Test explanation", care_suggestions: ["Test care"], expert_advice: "Test advice", ideal_temperature: "Test temperature", sunlight_requirements: "Test sunlight", watering_frequency: "Test watering", humidity_level: "Test humidity" },
};

test("imports complete browser records and retains the untouched original backup", async () => {
  const raw = JSON.stringify([entry]); const store = storage(raw); const saved = [];
  const run = createBrowserImporter(() => store, async value => { saved.push(value); return { id: "17" }; });
  assert.equal(await run(), ""); assert.deepEqual(saved, [entry]);
  assert.equal(store.getItem(SAVED_ANALYSES_KEY), raw);
  assert.deepEqual(JSON.parse(store.getItem(IMPORT_RECEIPTS_KEY)), { [entry.id]: "17" });
});
test("import receipts prevent reimporting intentionally deleted database records after refresh", async () => {
  const store = storage(JSON.stringify([entry])); let calls = 0;
  const save = async () => { calls++; return { id: "17" }; };
  await createBrowserImporter(() => store, save)();
  await createBrowserImporter(() => store, save)();
  assert.equal(calls, 1);
});
test("concurrent StrictMode calls share a single import", async () => {
  const store = storage(JSON.stringify([entry])); let calls = 0;
  const run = createBrowserImporter(() => store, async () => { calls++; return { id: "17" }; });
  await Promise.all([run(), run()]); assert.equal(calls, 1);
});
test("partial failures retain records and retry only unfinished imports", async () => {
  const second = { ...entry, id: "second" }; const raw = JSON.stringify([entry, second]);
  const store = storage(raw); let failed = true; const calls = [];
  const run = createBrowserImporter(() => store, async value => { calls.push(value.id); if (value.id === "second" && failed) throw new Error("Unavailable"); return { id: value.id }; });
  assert.match(await run(), /Unavailable/); failed = false;
  assert.equal(await run(), ""); assert.deepEqual(calls, [entry.id, "second", "second"]);
  assert.equal(store.getItem(SAVED_ANALYSES_KEY), raw);
});
test("invalid or inaccessible storage is reported and never overwritten", async () => {
  for (const raw of ["broken json", "{}", '[{"id":"invalid"}]']) {
    const store = storage(raw);
    const run = createBrowserImporter(() => store, async () => { assert.fail("Must not save corrupt records"); });
    assert.match(await run(), /could not be read/); assert.equal(store.getItem(SAVED_ANALYSES_KEY), raw);
  }
  assert.match(await createBrowserImporter(() => { throw new Error("Blocked"); }, async () => {})(), /could not be read/);
});
test("receipt-write failure retains backup and reports that an import retry is needed", async () => {
  const raw = JSON.stringify([entry]); const store = storage(raw);
  store.setItem = () => { throw new Error("Storage full"); };
  const run = createBrowserImporter(() => store, async () => ({ id: "17" }));
  assert.match(await run(), /Storage full/); assert.equal(store.getItem(SAVED_ANALYSES_KEY), raw);
});
test("legacy records without growing recommendations are preserved", () => {
  const legacy = { ...entry, result: { possible_issue: "Issue", explanation: "Explanation", care_suggestions: ["Care"], expert_advice: "Advice" } };
  assert.deepEqual(readSavedAnalyses(storage(JSON.stringify([legacy]))), [legacy]);
});
test("an empty browser has no records to import", async () => {
  assert.equal(await createBrowserImporter(() => storage(), async () => { assert.fail("No import expected"); })(), "");
});
