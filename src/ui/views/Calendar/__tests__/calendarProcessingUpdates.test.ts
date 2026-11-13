import fs from "fs";
import path from "path";
import ts from "typescript";
import vm from "vm";
import { DataFieldType, type DataFrame, type DataRecord } from "src/lib/dataframe/dataframe";
import { mergeCalendarPreview, processCalendarData } from "../processor";
import { isDraftId } from "../draft/calendarDraft";
import type { CalendarConfig, ProcessedCalendarData } from "../types";

// Run the production cache function and its declarations, not a second implementation.
const source = fs.readFileSync(path.resolve(__dirname, "../CalendarView.svelte"), "utf8");
const script = source.slice(source.indexOf(">") + 1, source.indexOf("</script>"));
const ast = ts.createSourceFile("calendar.ts", script, ts.ScriptTarget.Latest, true);
function cache() {
  const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node)
    ? node.name?.text === "updateProcessedData"
    : ts.isVariableStatement(node) && node.declarationList.declarations.some(decl => ts.isIdentifier(decl.name) && /^(cachedProcessedData|cachedBaseProcessedData|lastProcessed)/.test(decl.name.text)));
  const compiled = ts.transpileModule(nodes.map(node => node.getText(ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const processedSizes: number[] = [];
  const process = (frame: DataFrame, cfg: CalendarConfig, color: (record: DataRecord) => string | null, writeFormat?: string, startField?: string) => {
    processedSizes.push(frame.records.length);
    return processCalendarData(frame, cfg, color, writeFormat, startField);
  };
  const run = vm.runInNewContext(`${compiled}; ({ update: updateProcessedData, read: () => cachedProcessedData });`, {
    processCalendarData: process, mergeCalendarPreview, isDraftId, fields, calendarLogger: { debug: () => undefined },
  }, { timeout: 1000 }) as {
    update: (field: string | undefined, cfg: CalendarConfig, records: DataRecord[], fields: DataFrame["fields"], version: number, draft: string, frame: DataFrame, color: (record: DataRecord) => string | null) => void;
    read: () => ProcessedCalendarData | null;
  };
  return { ...run, processedSizes };
}
const fields = [{ name: "date", type: DataFieldType.Date, repeated: false, derived: false, identifier: false }];
const record = (id: string) => ({ id, values: { date: "2026-11-04" } });
const noColor = () => null;

test("an immutable records update is processed even when the caller has no version counter", () => {
  const run = cache(), first = [record("first.md")], second = [record("second.md")], cfg = { startDateField: "date" };
  run.update("date", cfg, first, fields, 0, "", { fields, records: first }, noColor);
  run.update("date", cfg, second, fields, 0, "", { fields, records: second }, noColor);
  expect(run.read()?.processed.map(item => item.record.id)).toEqual(["second.md"]);
  run.update("date", cfg, [], fields, 0, "", { fields, records: [] }, noColor);
  expect(run.read()).toBeNull();
  run.update("date", cfg, first, fields, 0, "", { fields, records: first }, noColor);
  expect(run.read()?.processed.map(item => item.record.id)).toEqual(["first.md"]);
});
test("a changed color rule reprojects an unchanged frame", () => {
  const run = cache(), records = [record("same.md")], frame = { fields, records }, cfg = { startDateField: "date" };
  run.update("date", cfg, records, fields, 0, "", frame, () => "#ff0000");
  expect(run.read()?.processed[0]?.color).toBe("#ff0000");
  run.update("date", cfg, records, fields, 0, "", frame, () => "#0000ff");
  expect(run.read()?.processed[0]?.color).toBe("#0000ff");
});
test("the inferred custom date field participates in processing and cache invalidation", () => {
  const run = cache(), records = [{ id: "custom.md", values: { visit: "2026-11-04", alternate: "2026-11-05" } }], frame = { fields, records };
  run.update("visit", {}, records, fields, 0, "", frame, noColor);
  expect(run.read()?.processed[0]?.startDate?.format("YYYY-MM-DD")).toBe("2026-11-04");
  run.update("alternate", {}, records, fields, 0, "", frame, noColor);
  expect(run.read()?.processed[0]?.startDate?.format("YYYY-MM-DD")).toBe("2026-11-05");
});

test("draft revisions process only the transient record and preserve the cached source frame", () => {
  const run = cache();
  const records = [record("source.md")];
  const cfg = { startDateField: "date" };
  const makeDraft = (date: string) => ({
    id: "ppp-calendar-draft://session/new.md",
    values: { date },
  });
  const draft = makeDraft("2026-11-04");

  run.update("date", cfg, records, fields, 0, "session.1", { fields, records: [...records, draft] }, noColor);
  expect(run.processedSizes).toEqual([1, 1]);
  expect(run.read()?.processed.map(item => item.record.id)).toEqual([records[0]!.id, draft.id]);
  expect(run.read()?.processed[1]?.lane).toBeGreaterThan(run.read()?.processed[0]?.lane ?? -1);
  expect(run.read()?.grouped["2026-11-04"]?.map(item => item.record.id)).toEqual([records[0]!.id, draft.id]);

  const movedDraft = makeDraft("2026-11-06");
  run.update("date", cfg, records, fields, 0, "session.2", { fields, records: [...records, movedDraft] }, noColor);
  expect(run.processedSizes).toEqual([1, 1, 1]);
  expect(run.read()?.grouped["2026-11-04"]?.map(item => item.record.id)).toEqual([records[0]!.id]);
  expect(run.read()?.grouped["2026-11-06"]?.map(item => item.record.id)).toEqual([movedDraft.id]);

  run.update("date", cfg, records, fields, 0, "", { fields, records }, noColor);
  expect(run.processedSizes).toEqual([1, 1, 1]);
  expect(run.read()?.processed.map(item => item.record.id)).toEqual([records[0]!.id]);
});

test("preview lanes do not mutate the cached source data", () => {
  const baseRecord = record("source.md");
  const previewRecord = { id: "ppp-calendar-draft://session/new.md", values: { date: "2026-11-04" } };
  const cfg = { startDateField: "date" };
  const base = processCalendarData({ fields, records: [baseRecord] }, cfg, noColor);
  const preview = processCalendarData({ fields, records: [previewRecord] }, cfg, noColor);
  const merged = mergeCalendarPreview(base, preview);

  expect(merged.processed).toHaveLength(2);
  expect(merged.processed[1]?.lane).toBeGreaterThan(merged.processed[0]?.lane ?? -1);
  expect(base.processed).toHaveLength(1);
  expect(base.processed[0]?.lane).toBe(0);
  expect(base.grouped["2026-11-04"]).toEqual(base.processed);
});
