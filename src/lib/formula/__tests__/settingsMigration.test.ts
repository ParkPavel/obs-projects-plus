import { migrateFormulaSettings, prepareFormulaMigration } from "../settingsMigration";

const settings = () => ({ projects: [{ fieldConfig: { cost: { formula: '"2" < "10"' } }, views: [{
  formulaFields: [{ name: "x", expression: "1-2" }, { name: "future", expression: "1", formulaVersion: "v9" }],
  nested: { steps: [{ type: "compute", columns: [{ name: "n", expression: "SUM(@cost)" }] }] },
  lists: [{ filterFormula: "AND(flag, true)" }],
}] }], note: { formula: "ordinary text", expression: "ordinary expression" } });

function storage() {
  const files = new Map<string, string>();
  return { files, exists: jest.fn(async (path: string) => files.has(path)),
    read: jest.fn(async (path: string) => files.get(path) ?? ""),
    write: jest.fn(async (path: string, text: string) => { files.set(path, text); }) };
}

test("migrates all nested settings formula owners, preserving expressions and unknown future versions", () => {
  const input = settings(), before = JSON.stringify(input);
  const migrated = migrateFormulaSettings(input);
  expect(migrated.entries.filter(entry => entry.status === "migrated")).toHaveLength(4);
  expect(migrated.entries.filter(entry => entry.status === "unsupported")).toHaveLength(1);
  expect(JSON.stringify(input)).toBe(before);
  expect(migrated.settings.projects[0]!.fieldConfig.cost).toEqual({ formula: '"2" < "10"', formulaVersion: "unified-v1" });
  expect(migrated.settings.projects[0]!.views[0]!.formulaFields[1]!.formulaVersion).toBe("v9");
  expect(migrated.settings.note).toEqual(input.note);
  expect(migrateFormulaSettings(migrated.settings).changed).toBe(false);
});

test("verifies exact raw backup and honest report before returning changed settings", async () => {
  const adapter = storage(), input = settings(), raw = "  " + JSON.stringify(input) + "\n";
  const result = await prepareFormulaMigration(adapter, "plugin", raw, input);
  expect(result.changed).toBe(true);
  expect(adapter.read).toHaveBeenCalledTimes(2);
  expect([...adapter.files.values()]).toContain(raw);
  const report = JSON.parse(adapter.files.get(result.reportPath!)!);
  expect(report.entries).toHaveLength(5);
  expect(report.comparison).toContain("not compared");
  expect(report.rollback).toContain("previous main.js");
  expect(JSON.parse(adapter.files.get(report.backupPath)!)).toEqual(input);
});

test.each(["write", "read", "altered"])("blocks migration when backup %s fails", async failure => {
  const adapter = storage(), input = settings(), before = JSON.stringify(input);
  if (failure === "write") adapter.write.mockRejectedValue(new Error("disk full"));
  if (failure === "read") adapter.read.mockRejectedValue(new Error("unreadable"));
  if (failure === "altered") adapter.read.mockResolvedValue("truncated");
  await expect(prepareFormulaMigration(adapter, "plugin", before, input)).rejects.toThrow();
  expect(JSON.stringify(input)).toBe(before);
});

test("does not overwrite a previous restore point on timestamp collision", async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date("2026-11-11T00:00:00Z"));
  try {
    const adapter = storage(), input = settings(), raw = JSON.stringify(input);
    const first = await prepareFormulaMigration(adapter, "plugin", raw, input);
    const prior = new Map(adapter.files);
    const second = await prepareFormulaMigration(adapter, "plugin", raw, input);
    expect(second.reportPath).not.toBe(first.reportPath);
    for (const [path, text] of prior) expect(adapter.files.get(path)).toBe(text);
  } finally { jest.useRealTimers(); }
});

test("reports invalid new syntax without modifying its expression", () => {
  const result = migrateFormulaSettings({ formulaFields: [{ expression: '"unterminated' }] });
  expect(result.entries[0]!.syntaxError).toBeTruthy();
  expect(result.settings.formulaFields[0]!.expression).toBe('"unterminated');
});

test("a failed report blocks publication even when the settings copy succeeded", async () => {
  const adapter = storage();
  const write = adapter.write.getMockImplementation()!;
  adapter.write.mockImplementation(async (path, text) => {
    if (path.endsWith(".report.json")) throw new Error("report disk full");
    await write(path, text);
  });
  const input = settings(), raw = JSON.stringify(input);
  await expect(prepareFormulaMigration(adapter, "plugin", raw, input)).rejects.toThrow("report disk full");
  expect([...adapter.files.values()]).toContain(raw);
  expect(JSON.stringify(input)).toBe(raw);
});

test("does not reinterpret unknown-only definitions or create a redundant backup", async () => {
  const adapter = storage(), input = { formulaFields: [{ expression: "1", formulaVersion: "future" }] };
  const result = await prepareFormulaMigration(adapter, "plugin", JSON.stringify(input), input);
  expect(result).toEqual({ settings: input, changed: false });
  expect(adapter.write).not.toHaveBeenCalled();
});
