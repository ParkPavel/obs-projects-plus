import fs from "fs";
import path from "path";
import ts from "typescript";
import vm from "vm";
import { DataFieldType, type DataFrame, type DataRecord } from "src/lib/dataframe/dataframe";
import { processCalendarData } from "../processor";
import type { CalendarConfig, ProcessedCalendarData } from "../types";

// Run the production cache function and its declarations, not a second implementation.
const source = fs.readFileSync(path.resolve(__dirname, "../CalendarView.svelte"), "utf8");
const script = source.slice(source.indexOf(">") + 1, source.indexOf("</script>"));
const ast = ts.createSourceFile("calendar.ts", script, ts.ScriptTarget.Latest, true);
function cache() {
  const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node)
    ? node.name?.text === "updateProcessedData"
    : ts.isVariableStatement(node) && node.declarationList.declarations.some(decl => ts.isIdentifier(decl.name) && /^(cachedProcessedData|lastProcessed)/.test(decl.name.text)));
  const compiled = ts.transpileModule(nodes.map(node => node.getText(ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const run = vm.runInNewContext(`${compiled}; ({ update: updateProcessedData, read: () => cachedProcessedData });`, {
    processCalendarData, calendarLogger: { debug: () => undefined },
  }, { timeout: 1000 }) as {
    update: (field: string | undefined, cfg: CalendarConfig, records: DataRecord[], version: number, draft: string, frame: DataFrame, color: (record: DataRecord) => string | null) => void;
    read: () => ProcessedCalendarData | null;
  };
  return run;
}
const fields = [{ name: "date", type: DataFieldType.Date, repeated: false, derived: false, identifier: false }];
const record = (id: string) => ({ id, values: { date: "2026-11-04" } });
const noColor = () => null;

test("an immutable records update is processed even when the caller has no version counter", () => {
  const run = cache(), first = [record("first.md")], second = [record("second.md")], cfg = { startDateField: "date" };
  run.update("date", cfg, first, 0, "", { fields, records: first }, noColor);
  run.update("date", cfg, second, 0, "", { fields, records: second }, noColor);
  expect(run.read()?.processed.map(item => item.record.id)).toEqual(["second.md"]);
  run.update("date", cfg, [], 0, "", { fields, records: [] }, noColor);
  expect(run.read()).toBeNull();
  run.update("date", cfg, first, 0, "", { fields, records: first }, noColor);
  expect(run.read()?.processed.map(item => item.record.id)).toEqual(["first.md"]);
});
test("a changed color rule reprojects an unchanged frame", () => {
  const run = cache(), records = [record("same.md")], frame = { fields, records }, cfg = { startDateField: "date" };
  run.update("date", cfg, records, 0, "", frame, () => "#ff0000");
  expect(run.read()?.processed[0]?.color).toBe("#ff0000");
  run.update("date", cfg, records, 0, "", frame, () => "#0000ff");
  expect(run.read()?.processed[0]?.color).toBe("#0000ff");
});
test("the inferred custom date field participates in processing and cache invalidation", () => {
  const run = cache(), records = [{ id: "custom.md", values: { visit: "2026-11-04", alternate: "2026-11-05" } }], frame = { fields, records };
  run.update("visit", {}, records, 0, "", frame, noColor);
  expect(run.read()?.processed[0]?.startDate?.format("YYYY-MM-DD")).toBe("2026-11-04");
  run.update("alternate", {}, records, 0, "", frame, noColor);
  expect(run.read()?.processed[0]?.startDate?.format("YYYY-MM-DD")).toBe("2026-11-05");
});
