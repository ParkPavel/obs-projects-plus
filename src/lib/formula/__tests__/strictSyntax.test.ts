import { evaluateExpression, validateExpression, tokenize } from "src/lib/formula";
const record = { id: "synthetic.md", values: { amount: 4, left: 2, right: 3, SUM: 7, "𝒂": 2 } };
const context = { record, semantics: "unified-v1" as const };

test.each([
  ["1-2", -1], ["1--2", 3], ["-2+3", 1], ["-(amount + 1)", -5],
  ["+amount", 4], [".5 + 1.", 1.5], ["1e3 + 2E-2", 1000.02],
  ["left + right", 5], ["SUM", 7], ['LET("SUM",2,SUM)', 2],
  ["SUM # call\n (1,2)", 3], ['"a\\r\\n\\t\\\\b"', "a\r\n\t\\b"],
  ["𝒂 + 1", 3],
] as const)("strict expression %s is evaluated and validated consistently", (source, expected) => {
  expect(evaluateExpression(source, context)).toEqual({ value: expected });
  expect(validateExpression(source, Object.keys(record.values), "unified-v1")).toEqual([]);
});

test.each(["1.2.3", "1e+", "1e--2", "1e309", '"unfinished', "'unfinished", '"bad\\q"', "@", "1+@"])("strict expression %s fails instead of truncating or ignoring input", source => {
  expect(evaluateExpression(source, context).error).toBeDefined();
  expect(validateExpression(source, Object.keys(record.values), "unified-v1").length).toBeGreaterThan(0);
});

test("strict negative zero retains its sign", () => {
  expect(Object.is(evaluateExpression("-0", context).value, -0)).toBe(true);
});

test("strict unknown calls report an unknown function", () => {
  expect(validateExpression("MYSTERY(1)", [], "unified-v1").join(" ")).toMatch(/MYSTERY/);
  expect(evaluateExpression("MYSTERY(1)", context).error).toMatch(/MYSTERY/);
});

test("strict token spans refer to the original escaped/exponent source", () => {
  const source = '1e-3 + "a\\n"';
  const tokens = tokenize(source, "strict");
  expect(tokens.filter(t => t.type !== "EOF").map(t => [t.type, source.slice(t.start, t.end)])).toEqual([
    ["NUMBER", "1e-3"], ["OPERATOR", "+"], ["STRING", '"a\\n"'],
  ]);
});
