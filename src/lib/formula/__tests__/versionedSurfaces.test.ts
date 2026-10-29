import dayjs from "dayjs";
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { applyFormulaFields, referencedNames } from "src/lib/dashboard-engine/applyFormulaFields";
import { executeTransform } from "src/lib/dashboard-engine/transformExecutor";
import { formulaPropertiesOf } from "src/lib/relations/declaredFieldTypes";
import { splitFormulasAroundRollups } from "src/lib/relations/computedColumns";
import { previewFormulaField, formulaWouldCycle } from "src/ui/views/Dashboard/widgets/formulaPreview";
import { filterRecordsForList } from "src/ui/views/Calendar/agenda/filterEngine";
import type { AgendaCustomList } from "src/settings/v3/settings";
import { formulaSemantics, evaluateVersionedFormula } from "../version";

function frame(): DataFrame {
  return {
    fields: [{ name: "qty", type: DataFieldType.Number, repeated: false, identifier: false, derived: false }],
    records: [{ id: "a", values: { qty: 2 } }, { id: "b", values: { qty: 3 } }],
  };
}
const modern = { formulaVersion: "unified-v1" };

describe("persisted formula versions", () => {
  it("retains each surface's absent-version default", () => {
    expect(formulaSemantics(undefined, "legacy-filter")).toBe("legacy-filter");
    expect(formulaSemantics(undefined, "legacy-computed")).toBe("legacy-computed");
    expect(formulaSemantics("unified-v1", "legacy-filter")).toBe("unified-v1");
  });
  it.each(["future-v2", "", null, 0, false, {}, ["unified-v1"]])("fails closed for unsupported persisted version %p", version => {
    const result = evaluateVersionedFormula("1 + 1", version, { record: frame().records[0]! });
    expect(result.value).toBeNull();
    expect(result.error).toBeTruthy();
  });
  it("retains new and unknown flags on extraction, leaves old JSON shape intact", () => {
    const configs = { old: { formula: "qty" }, next: { formula: "qty", ...modern }, future: { formula: "qty", formulaVersion: "v9" } };
    expect(formulaPropertiesOf(configs)).toEqual([
      { name: "old", expression: "qty" }, { name: "next", expression: "qty", ...modern }, { name: "future", expression: "qty", formulaVersion: "v9" },
    ]);
    expect(configs.future.formulaVersion).toBe("v9");
  });
  it("evaluates mixed definitions under distinct saved rules and does not mutate input", () => {
    const source = frame();
    const before = JSON.stringify(source);
    const result = applyFormulaFields(source, [
      { name: "old", expression: '"2" < "10"' },
      { name: "next", expression: '"2" < "10"', ...modern },
      { name: "unknown", expression: "1 + 1", formulaVersion: "future" },
    ]);
    expect(result.records[0]!.values).toMatchObject({ old: true, next: false, unknown: null });
    expect(JSON.stringify(source)).toBe(before);
  });
  it("resolves strict bare reserved field names and long operator dependencies", () => {
    const expression = ["SUM", ...Array.from({ length: 1000 }, () => "qty")].join("+");
    expect(referencedNames(expression, "unified-v1")).toHaveLength(1001);
    expect(referencedNames("SUM", "unified-v1")).toEqual(["SUM"]);
    expect(formulaWouldCycle([{ name: "SUM", expression: "answer", ...modern }], "answer", "SUM", modern)).toBe(true);
    expect(referencedNames("qty+".repeat(15000) + "qty", "unified-v1")).toEqual([]);
  });
  it("keeps strict reserved-name dependencies after rollups", () => {
    const definitions = [{ name: "answer", expression: "SUM + 1", ...modern }];
    expect(splitFormulasAroundRollups(definitions, new Set(["SUM"]))).toEqual({ before: [], after: definitions });
  });
  it("gives new column aggregates the completed case-insensitive derived schema", () => {
    const result = applyFormulaFields(frame(), [
      { name: "total", expression: "SUM(@DOUBLED)", ...modern },
      { name: "Doubled", expression: "qty * 2", ...modern },
    ]);
    expect(result.records.map(record => record.values["total"])).toEqual([10, 10]);
  });
  it("orders new static PROP dependencies for names with spaces while preserving old ordering", () => {
    const definitions = [{ name: "answer", expression: 'PROP("Total cost") + 1' }, { name: "Total cost", expression: "qty * 2" }];
    expect(applyFormulaFields(frame(), definitions).records.map(record => record.values["answer"])).toEqual([1, 1]);
    expect(applyFormulaFields(frame(), definitions.map(definition => ({ ...definition, ...modern }))).records.map(record => record.values["answer"])).toEqual([5, 7]);
  });
  it("previews the saved mode, explicit draft mode and explicit return to compatibility", () => {
    const definitions = [{ name: "answer", expression: '"2" < "10"', ...modern }];
    expect(previewFormulaField(frame(), definitions, "answer", '"2" < "10"').value).toBe(false);
    expect(previewFormulaField(frame(), definitions, "answer", '"2" < "10"', {}).value).toBe(true);
    expect(previewFormulaField(frame(), [], "new", '"2" < "10"', modern).value).toBe(false);
    expect(previewFormulaField(frame(), [], "new", "1", { formulaVersion: "future" }).error).toBeTruthy();
    expect(definitions[0]!.formulaVersion).toBe("unified-v1");
  });
  it("keeps legacy transform ranges on input while new ranges see completed columns", () => {
    const source = frame();
    const result = executeTransform(source, { steps: [{ type: "compute", columns: [
      { name: "Doubled", expression: "qty * 2" },
      { name: "oldRange", expression: "SUM(@Doubled)" },
      { name: "newRange", expression: "SUM(@DOUBLED)", ...modern },
      { name: "future", expression: "7", formulaVersion: "future" },
    ] }] });
    expect(result.data.records.map(record => record.values["oldRange"])).toEqual([0, 0]);
    expect(result.data.records.map(record => record.values["newRange"])).toEqual([10, 10]);
    expect(result.data.records[0]!.values["future"]).toBeNull();
    expect(result.meta.warnings).toHaveLength(2);
    expect(source.records[0]!.values).toEqual({ qty: 2 });
  });
  it("uses the supplied Agenda subset and selected date for new rules", () => {
    const source = frame();
    const list: AgendaCustomList = { id: "list", name: "list", icon: { type: "lucide", value: "list" }, order: 0, collapsed: false, filterMode: "advanced", filterFormula: 'AND(SUM(@qty) = 5, TODAY() = "2026-02-07")', ...modern };
    expect(filterRecordsForList(source.records, list, dayjs("2026-02-07"), source.fields)).toEqual(source.records);
    expect(filterRecordsForList(source.records.slice(0, 1), list, dayjs("2026-02-07"), source.fields)).toEqual([]);
    expect(filterRecordsForList(source.records, list, dayjs("2026-02-08"), source.fields)).toEqual([]);
    expect(filterRecordsForList(source.records, { ...list, formulaVersion: "future" }, dayjs("2026-02-07"), source.fields)).toEqual([]);
  });
});
