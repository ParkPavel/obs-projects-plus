import vm from "node:vm";
import type { DataRecord, DataFrame } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import {
  createFormulaPass, evaluateExpression, evaluateFormulaWithError, evaluateFormulaNode,
  getFormulaCatalog, getFormulaFunctions, parseFormula, tokenize, validateExpression,
  type FormulaEvaluationContext, type FormulaPass, type FormulaSemantics, type FormulaNode,
} from "src/lib/formula";
import { getAllFormulaMetadata } from "src/lib/dashboard-engine/formulaMetadata";

const reference = "2026-10-28T04:00:00.000Z";
const record: DataRecord = { id: "one.md", values: { amount: "12", due: "2026-10-01", tags: ["urgent"], zero: 0, flag: false } };
const other: DataRecord = { id: "two.md", values: { amount: "3", due: "2026-10-29", tags: [] } };
const fields = Object.keys(record.values);
const frame: DataFrame = {
  fields: fields.map(name => ({ name, type: DataFieldType.String, identifier: false, derived: false, repeated: false })),
  records: [record, other],
};
const context = (overrides: Partial<FormulaEvaluationContext> = {}): FormulaEvaluationContext => ({
  record, frame, semantics: "unified-v1", referenceDate: new Date(reference), ...overrides,
});

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(reference)); });
afterEach(() => { jest.useRealTimers(); });

const cases: Array<[string, unknown]> = [
  ["amount = 12", true], ["amount + 2 = 14", true], ["AND(1, true)", true],
  ['"2026-10-28" < "2026-10-29"', true], ["IS_OVERDUE(due)", true],
  ['HAS_ANY_OF(tags, ["urgent"])', true], ['HAS_ALL_OF(tags, ["urgent", "work"])', false],
  ['HAS_NONE_OF(tags, ["other"])', true], ['flag = "unexpected"', false],
  ['flag = " FALSE "', true], ["IS_EMPTY(zero)", false], ["IS_EMPTY(flag)", false],
  ["missing < 0", false], ["1 / 0", null],
  ["true < 2", true], ["false > 1", false], ["true >= 1", true],
  ['"2026-10-28T12:00:00Z" = "2026-10-28T13:00:00+01:00"', true],
  ['"2026-10-28T12:00:00Z" = "2026-10-28T13:00:00Z"', false],
];
test.each(cases)("explicit common rules: %s", (expression, value) => {
  expect(evaluateExpression(expression, context())).toEqual({ value });
});

test("catalog, lexer and metadata agree; old computed consumers keep their 112 functions", () => {
  const common = getFormulaCatalog("unified-v1");
  expect(common).toHaveLength(129);
  expect(getFormulaCatalog("legacy-filter")).toHaveLength(27);
  expect(getFormulaFunctions()).toHaveLength(112);
  expect(new Set(getAllFormulaMetadata().map(meta => meta.name))).toEqual(new Set(getFormulaFunctions()));
  for (const definition of common) {
    expect(definition.metadata.name).toBe(definition.name);
    expect(definition.metadata.signature.startsWith(definition.name + "(")).toBe(true);
    expect(tokenize(definition.name + "(")[0]).toMatchObject({ type: "FUNCTION", value: definition.name });
  }
  expect(getFormulaCatalog("legacy-computed").some(definition => definition.name === "IS_OVERDUE")).toBe(false);
  expect(getFormulaCatalog("legacy-filter").find(definition => definition.name === "AND")!.metadata.doc).toContain("boolean true");
  expect(getFormulaCatalog("unified-v1").find(definition => definition.name === "NOW")!.metadata.doc).toContain("reference instant");
});

test("calendar functions become available only through an explicit profile", () => {
  expect(evaluateFormulaWithError("IS_OVERDUE(due)", record)).toEqual({ value: null });
  expect(validateExpression("IS_OVERDUE(due)", fields, "unified-v1")).toEqual([]);
  expect(validateExpression("IS_OVERDUE(due)", fields, "legacy-computed").length).toBeGreaterThan(0);
  expect(validateExpression("SUM(@amount)", fields, "legacy-filter").length).toBeGreaterThan(0);
  expect(evaluateExpression("IS_OVERDUE(due)", context())).toEqual({ value: true });
  const sharedPass = createFormulaPass(frame, "unified-v1", new Date(reference));
  expect(evaluateFormulaWithError("amount = 12", record, frame, sharedPass)).toEqual({ value: false });
});

test.each([
  ['LET("x", amount, x + 1)', 13],
  ['LETS("x", 2, "y", x + 1, y + amount)', 15],
  ['MAP([1,2], "item", item + 1)', [2, 3]],
  ['FILTER([1,2], "item", item > 1)', [2]],
  ['REDUCE([1,2], "item", "acc", 0, acc + item)', 3],
] as Array<[string, unknown]>)("validation understands the same local scope as execution: %s", (expression, value) => {
  expect(validateExpression(expression, fields, "unified-v1")).toEqual([]);
  expect(evaluateExpression(expression, context())).toEqual({ value });
});

test("a frame-wide cached formula cannot cross its reference date or profile", () => {
  const pass = createFormulaPass(frame, "unified-v1", new Date(reference));
  const expression = 'IF(TODAY() = "2026-10-28", SUM(@amount), 0)';
  expect(evaluateExpression(expression, context({ pass }))).toEqual({ value: 15 });
  expect(pass.frameValues.size).toBeGreaterThan(0);
  expect(evaluateExpression(expression, context({ pass, referenceDate: new Date("2026-10-29T04:00:00.000Z") }))).toEqual({ value: 0 });
  expect(evaluateExpression(expression, context({ pass }))).toEqual({ value: 15 });
  const comparisons = 'IF("2026-10-28" < "2026-10-29", SUM(@amount), 0)';
  expect(evaluateExpression(comparisons, context({ pass }))).toEqual({ value: 15 });
  expect(evaluateExpression(comparisons, context({ pass, semantics: "legacy-computed" }))).toEqual({ value: 0 });
});

test("a pass for another frame cannot answer aggregate queries", () => {
  const pass = createFormulaPass(frame, "unified-v1", new Date(reference));
  expect(evaluateExpression("SUM(@amount)", context({ pass }))).toEqual({ value: 15 });
  const nextFrame = { ...frame, records: [{ ...record, values: { amount: 500 } }] };
  expect(evaluateExpression("SUM(@amount)", context({ pass, frame: nextFrame }))).toEqual({ value: 500 });
  expect(evaluateExpression("SUM(@amount)", context({ pass }))).toEqual({ value: 15 });
});

test("a timestamp-less unified pass cannot reuse a cached reference-day result", () => {
  const pass: FormulaPass = { frame, semantics: "unified-v1", rawColumns: new Map(), numericColumns: new Map(), frameValues: new Map() };
  const expression = 'IF(TODAY() = "2026-10-28", SUM(@amount), 0)';
  expect(evaluateExpression(expression, context({ pass }))).toEqual({ value: 15 });
  expect(evaluateExpression(expression, context({ pass, referenceDate: new Date("2026-10-29T04:00:00.000Z") }))).toEqual({ value: 0 });
  expect(pass.frameValues.size).toBe(0);
});

test("cached common ASTs are immutable before their structural check is reused", () => {
  const pass = createFormulaPass(frame, "unified-v1", new Date(reference));
  const expression = 'IF(TODAY() = "2026-10-28", SUM(@amount), 0)';
  expect(evaluateExpression(expression, context({ pass }))).toEqual({ value: 15 });
  const root = Array.from(pass.frameValues.keys()).find(node => node.type === "function" && node.name === "IF");
  if (!root || root.type !== "function") throw new Error("Expected cached IF root");
  expect(Object.isFrozen(root)).toBe(true);
  expect(Object.isFrozen(root.args)).toBe(true);
  expect(Object.isFrozen(root.args[0])).toBe(true);
  expect(() => root.args.push({ type: "literal", value: 123 })).toThrow();
});

test("external mutable ASTs are rechecked after mutation", () => {
  const root: FormulaNode = { type: "operator", operator: "+", left: { type: "literal", value: 1 }, right: { type: "literal", value: 2 } };
  expect(evaluateFormulaNode(root, context())).toBe(3);
  root.left = root;
  expect(() => evaluateFormulaNode(root, context())).toThrow("limit");
});

test("external AST edits cannot reuse their old shape or frame result", () => {
  const pass = createFormulaPass(frame, "unified-v1", new Date(reference));
  const root: FormulaNode = { type: "function", name: "SUM", args: [{ type: "column_ref", name: "amount" }] };
  expect(evaluateFormulaNode(root, context({ pass }))).toBe(15);
  root.name = "IF";
  root.args = [{ type: "field", name: "flag" }, { type: "literal", value: 11 }, { type: "literal", value: 22 }];
  expect(evaluateFormulaNode(root, context({ pass }))).toBe(22);
  expect(pass.frameValues.size).toBe(0);
});

test("common NOW inherits a pass's fixed clock; the old default API keeps its old clock", () => {
  const pass = createFormulaPass(frame, "unified-v1", new Date(reference));
  const implicit: FormulaEvaluationContext = { record, frame, semantics: "unified-v1", pass };
  expect(evaluateExpression("NOW()", implicit)).toEqual({ value: reference });
  const next = "2026-10-29T04:00:00.000Z";
  jest.setSystemTime(new Date(next));
  expect(evaluateExpression("NOW()", implicit)).toEqual({ value: reference });
  const oldPass = createFormulaPass(frame);
  expect(evaluateFormulaWithError("NOW()", record, frame, oldPass)).toEqual({ value: next });
  jest.setSystemTime(new Date(reference));
  expect(evaluateFormulaWithError("NOW()", record, frame, oldPass)).toEqual({ value: reference });
});

test("an old structurally constructed pass retains its cache", () => {
  const pass: FormulaPass = { frame, rawColumns: new Map(), numericColumns: new Map(), frameValues: new Map() };
  expect(evaluateFormulaWithError("SUM(@amount)", record, frame, pass)).toEqual({ value: 15 });
  expect(pass.frameValues.size).toBeGreaterThan(0);
});

test("invalid profile and date fail instead of silently using current defaults", () => {
  expect(evaluateExpression("1", context({ semantics: "future" as FormulaSemantics })).error).toBeDefined();
  expect(validateExpression("1", [], "future" as FormulaSemantics).length).toBeGreaterThan(0);
  expect(evaluateExpression("TODAY()", context({ referenceDate: new Date("invalid") })).error).toBeDefined();
});

test("the new profile bounds ordinary operators, parser nesting and data lists", () => {
  for (const expression of [Array(100).fill("1").join("+"), "NOT(".repeat(100) + "false" + ")".repeat(100), " ".repeat(50_001)]) {
    const result = evaluateExpression(expression, context());
    expect(result.value).toBeNull(); expect(result.error).toContain("limit");
    expect(validateExpression(expression, fields, "unified-v1").some(error => error.includes("limit"))).toBe(true);
  }
  expect(evaluateFormulaWithError(Array(100).fill("1").join("+"), record)).toEqual({ value: 100 });
  const large: DataRecord = { id: "large.md", values: { items: Array(10_001).fill(1) } };
  expect(evaluateExpression('MAP(items, "item", item)', context({ record: large })).error).toContain("limit");
  expect((evaluateFormulaWithError('MAP(items, "item", item)', large).value as unknown[]).length).toBe(10_000);
});

test("nested list loops share one evaluation budget instead of multiplying unbounded work", () => {
  const data: DataRecord = { id: "loops.md", values: { items: Array(1_000).fill(1) } };
  const pass = createFormulaPass(frame, "unified-v1", new Date(reference));
  const source = 'MAP(items, "x", MAP(items, "y", x + y))';
  const result = evaluateExpression(source, context({ record: data, pass }));
  expect(result.value).toBeNull();
  expect(result.error).toContain("limit");
  const small: DataRecord = { id: "small.md", values: { items: [1, 2] } };
  expect(evaluateExpression(source, context({ record: small, pass }))).toEqual({ value: [[2, 3], [3, 4]] });
});

test("common field and PROP lookup agree without reading object prototypes", () => {
  const values = Object.assign(Object.create({ hidden: "inherited" }) as DataRecord["values"], { Amount: "12", link: "[[path|Label]]" });
  const own = context({ record: { id: "own.md", values } });
  expect(evaluateExpression('PROP("amount") = amount', own)).toEqual({ value: true });
  expect(evaluateExpression('PROP("link") = link', own)).toEqual({ value: true });
  for (const expression of ["hidden", "constructor", "__proto__", 'PROP("constructor")']) {
    expect(evaluateExpression(expression, own)).toEqual({ value: null });
  }
});

test("native and foreign-realm Date values compare as instants", () => {
  const date: Date = vm.runInNewContext('new Date("2026-10-28T12:00:00.000Z")');
  const dated = context({ record: { id: "dated.md", values: { date } } });
  expect(evaluateExpression('date = "2026-10-28T12:00:00.000Z"', dated)).toEqual({ value: true });
  expect(evaluateExpression('date < "2026-10-28T13:00:00.000Z"', dated)).toEqual({ value: true });
  expect(evaluateExpression('date = "2026-10-28T13:00:00.000Z"', dated)).toEqual({ value: false });
});

test("the compatibility AST API retains its unknown-node exception", () => {
  expect(() => evaluateFormulaNode({ type: "invalid" } as unknown as FormulaNode, context({ semantics: "legacy-filter" }))).toThrow('Unknown node type: "invalid"');
  expect(evaluateFormulaNode(parseFormula("AND(1, true)"), context({ semantics: "legacy-filter" }))).toBe(false);
});
