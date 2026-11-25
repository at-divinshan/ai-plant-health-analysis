import { databaseRequest } from "./databaseApi.js";
import { createBrowserImporter } from "./browserMigration.js";

export async function listSavedAnalyses() {
  return databaseRequest("get", "/analyses");
}

export async function saveAnalysis(entry) {
  return databaseRequest("post", "/analyses", entry);
}

export async function deleteAnalysis(id) {
  return databaseRequest("delete", `/analyses/${id}`);
}

// Import once at a time; all current records are read from MySQL APIs.
export const importBrowserAnalyses = createBrowserImporter(() => window.localStorage, saveAnalysis);

export function formatAnalysisDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date not recorded";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
