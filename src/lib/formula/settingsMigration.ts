import { parseFormula } from "./syntax";
import { assertFormulaLimits } from "./limits";

interface Entry {
  path: string;
  expression: string;
  previousVersion: unknown;
  status: "migrated" | "unsupported";
  syntaxError?: string;
}

/** Walk only formula-bearing settings containers, including nested widget snapshots. */
export function migrateFormulaSettings<T>(settings: T): { settings: T; entries: Entry[]; changed: boolean } {
  const copy: T = JSON.parse(JSON.stringify(settings)) as T;
  const entries: Entry[] = [];
  function definition(value: Record<string, unknown>, key: string, path: string): void {
    const expression = value[key];
    if (typeof expression !== "string" || !expression.trim() || value["formulaVersion"] === "unified-v1") return;
    const previousVersion = value["formulaVersion"] === undefined ? "unversioned" : value["formulaVersion"];
    const supported = value["formulaVersion"] === undefined || value["formulaVersion"] === "legacy-computed" || value["formulaVersion"] === "legacy-filter";
    const entry: Entry = { path, expression, previousVersion, status: supported ? "migrated" : "unsupported" };
    try { assertFormulaLimits(parseFormula(expression)); } catch {
      entry.syntaxError = "Expression is not valid bounded current syntax; correct it in the formula editor.";
    }
    entries.push(entry);
    if (supported) value["formulaVersion"] = "unified-v1";
  }
  function walk(value: unknown, path: string): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach((item, index) => walk(item, `${path}/${index}`)); return; }
    const object = value as Record<string, unknown>;
    if (object["fieldConfig"] && typeof object["fieldConfig"] === "object" && !Array.isArray(object["fieldConfig"])) {
      for (const [name, field] of Object.entries(object["fieldConfig"])) {
        if (field && typeof field === "object" && !Array.isArray(field)) definition(field as Record<string, unknown>, "formula", `${path}/fieldConfig/${escapePath(name)}`);
      }
    }
    if (Array.isArray(object["formulaFields"])) object["formulaFields"].forEach((field, index) => {
      if (field && typeof field === "object") definition(field as Record<string, unknown>, "expression", `${path}/formulaFields/${index}`);
    });
    if (object["type"] === "compute" && Array.isArray(object["columns"])) object["columns"].forEach((column, index) => {
      if (column && typeof column === "object") definition(column as Record<string, unknown>, "expression", `${path}/columns/${index}`);
    });
    definition(object, "filterFormula", path);
    for (const [key, child] of Object.entries(object)) walk(child, `${path}/${escapePath(key)}`);
  }
  walk(copy, "");
  return { settings: copy, entries, changed: entries.some(entry => entry.status === "migrated") };
}

function escapePath(key: string): string { return key.replace(/~/g, "~0").replace(/\//g, "~1"); }

interface BackupAdapter {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
}

/** A failed or altered restore point blocks publication of new settings. */
export async function prepareFormulaMigration<T>(adapter: BackupAdapter, dir: string, rawText: string, settings: T): Promise<{ settings: T; changed: boolean; reportPath?: string }> {
  const migration = migrateFormulaSettings(settings);
  if (!migration.changed) return { settings, changed: false };
  const base = `${dir}/formula-unified-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  let prefix = base;
  let available = false;
  for (let suffix = 0; suffix < 100; suffix++) {
    prefix = suffix ? `${base}-${suffix}` : base;
    if (!(await adapter.exists(`${prefix}.data.json`)) && !(await adapter.exists(`${prefix}.report.json`))) { available = true; break; }
  }
  if (!available) throw new Error("Cannot allocate a formula migration restore point");
  const backupPath = `${prefix}.data.json`, reportPath = `${prefix}.report.json`;
  const report = JSON.stringify({
    targetVersion: "unified-v1", backupPath, entries: migration.entries,
    comparison: "Definitions and syntax were inventoried. Record results were not compared; current rules can change results.",
    ruleExamples: [
      { expression: '"2" < "10"', previousComputed: true, current: false },
      { expression: "COUNT(column with null, 0, false, empty text)", previousComputed: 4, current: 3 },
      { expression: "1-2", previous: "parse error", current: -1 },
    ],
    rollback: "Disable Projects Plus and close Obsidian. Preserve any later data.json separately. Restore this exact backup as data.json AND the previous main.js, styles.css, manifest.json from the installation backup; then reopen Obsidian. Restoring JSON alone under the new evaluator does not restore previous rules. This operation does not overwrite note files.",
  }, null, 2);
  await adapter.write(backupPath, rawText);
  if (await adapter.read(backupPath) !== rawText) throw new Error("Formula migration backup verification failed");
  await adapter.write(reportPath, report);
  if (await adapter.read(reportPath) !== report) throw new Error("Formula migration report verification failed");
  return { settings: migration.settings, changed: true, reportPath };
}
