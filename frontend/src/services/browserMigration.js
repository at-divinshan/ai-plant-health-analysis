export const SAVED_ANALYSES_KEY = "plant-health-ai.saved-analyses.v1";

const resultFields = ["possible_issue", "explanation", "expert_advice"];
const recommendationFields = ["ideal_temperature", "sunlight_requirements", "watering_frequency", "humidity_level"];

function validEntry(entry) {
  return entry && typeof entry.id === "string" && entry.id.length > 0 &&
    typeof entry.analyzedAt === "string" && Number.isFinite(Date.parse(entry.analyzedAt)) &&
    entry.plant && ["plant_name", "plant_type", "symptom"].every(key => typeof entry.plant[key] === "string") &&
    (entry.plant.location == null || typeof entry.plant.location === "string") &&
    entry.result && resultFields.every(key => typeof entry.result[key] === "string") &&
    Array.isArray(entry.result.care_suggestions) && entry.result.care_suggestions.every(tip => typeof tip === "string") &&
    recommendationFields.every(key => entry.result[key] == null || typeof entry.result[key] === "string");
}

export function readSavedAnalyses(storage = window.localStorage) {
  const raw = storage.getItem(SAVED_ANALYSES_KEY);
  if (raw === null) return [];
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries) || !entries.every(validEntry)) {
    throw new Error("Saved analysis data could not be read.");
  }
  return entries;
}

export const IMPORT_RECEIPTS_KEY = "plant-health-ai.mysql-imports.v1";

// The original browser backup is never removed or used as live page data.
export function createBrowserImporter(getStorage, save) {
  let running;
  async function importPending() {
    let entries, receipts, storage;
    try {
      storage = getStorage();
      entries = readSavedAnalyses(storage);
      receipts = JSON.parse(storage.getItem(IMPORT_RECEIPTS_KEY) || "{}");
      if (!receipts || typeof receipts !== "object" || Array.isArray(receipts)) throw new Error();
    } catch {
      return "Browser-saved records could not be read. The original backup has not been changed.";
    }
    const failed = [];
    for (const entry of entries) {
      if (Object.hasOwn(receipts, entry.id)) continue;
      try {
        const saved = await save(entry);
        Object.defineProperty(receipts, entry.id, { value: saved.id, enumerable: true, configurable: true, writable: true });
        storage.setItem(IMPORT_RECEIPTS_KEY, JSON.stringify(receipts));
      } catch (error) {
        failed.push(`${entry.plant.plant_name}: ${error.message}`);
      }
    }
    return failed.length ? `Some browser records need another import attempt. Their original backups are still intact. ${failed.join("; ")}` : "";
  }
  return function importBrowserAnalyses() {
    if (!running) running = importPending().finally(() => { running = null; });
    return running;
  };
}
