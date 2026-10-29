/**
 * i2-data (D20): «Unknown field: Paid» while the base has `paid`, and «+» →
 * «Unexpected token: OPERATOR». Names match without case; messages say what
 * is wrong in the person's language.
 */
jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  const ru: Record<string, string> = {
    "formula-errors.unknown-field": "Нет свойства «{{name}}»",
    "formula-errors.unfinished": "Формула не закончена — допишите значение",
    "formula-errors.operator": "Рядом со знаком не хватает значения — поставьте число, свойство или функцию",
    "formula-errors.arguments": "У функции {{name}} другое число значений: нужно {{count}}",
    "formula-errors.token": "Здесь что-то лишнее — проверьте скобки и запятые",
    "formula-errors.missing-argument": "В функции не хватает значения",
    "formula-errors.unknown-operator": "Непонятный знак «{{op}}»",
    "formula-errors.invalid": "Формулу не удаётся прочитать: {{detail}}",
    "formula-errors.limit": "Формула превысила предел вычислений. Упростите выражение или сократите число значений.",
    "formula-errors.number": "Проверьте запись числа",
    "formula-errors.string": "Закройте текст кавычкой того же типа",
    "formula-errors.escape": "Неподдерживаемый символ после обратной косой черты",
    "formula-errors.column": "После @ укажите имя столбца",
    "formula-errors.frame": "Нет данных для вычисления столбца",
  };
  const t = (k: string, o: Record<string, string> = {}) => (ru[k] ?? k).replace(/{{(\w+)}}/g, (_: string, n: string) => o[n] ?? "");
  return { i18n: writable({ t }) };
});
import { evaluateFormulaValue, evaluateFormulaWithError, validateFormulaExpression } from "src/lib/formula/extendedEvaluator";
import { humanFormulaError } from "src/lib/formula/formulaErrors";

it.each([
  ["Invalid numeric literal at position 3", "Проверьте запись числа"],
  ["Unterminated string literal", "Закройте текст кавычкой того же типа"],
  ["Unknown string escape: q", "Неподдерживаемый символ после обратной косой черты"],
  ["Missing column name at position 0", "После @ укажите имя столбца"],
  ["Column reference requires a data frame", "Нет данных для вычисления столбца"],
])("strict syntax error %s has an actionable localized message", (raw, expected) => {
  expect(humanFormulaError(raw)).toBe(expected);
});

it.each(["work", "evaluation", "parsing", "input", "list", "financial range", "financial work"])("%s limit is an actionable localized message", category => {
  expect(humanFormulaError(`Formula ${category} limit exceeded`)).toBe("Формула превысила предел вычислений. Упростите выражение или сократите число значений.");
});

// i3-final: every parser message reaches the person in their language.
it("each parser message has a sentence; an unknown one is framed, not bare English", () => {
  expect(humanFormulaError("DATE_ADD expects 3 arguments (date, amount, unit)")).toBe("У функции DATE_ADD другое число значений: нужно 3");
  expect(humanFormulaError("Unexpected token: COMMA")).toBe("Здесь что-то лишнее — проверьте скобки и запятые");
  expect(humanFormulaError("Missing argument at index 1")).toBe("В функции не хватает значения");
  expect(humanFormulaError("Unknown operator: %")).toBe("Непонятный знак «%»");
  expect(humanFormulaError("Something new")).toBe("Формулу не удаётся прочитать: Something new");
});

it("the preview's runtime error is a sentence too", () => {
  const result = evaluateFormulaWithError("1 +", { id: "a.md", values: {} });
  expect(result.value).toBeNull();
  expect(result.error).toBe("Формула не закончена — допишите значение");
});

it("a field is found whatever its case — in the check and in the value", () => {
  expect(validateFormulaExpression("Paid * 2", ["paid"])).toEqual([]);
  expect(evaluateFormulaValue("Paid * 2", { id: "a.md", values: { paid: 5 } })).toBe(10);
});

it("messages are sentences, not parser tokens", () => {
  expect(validateFormulaExpression("paid +", ["paid"])).toEqual(["Формула не закончена — допишите значение"]);
  expect(validateFormulaExpression("+", ["paid"])[0]).toMatch(/не хватает значения/);
  expect(validateFormulaExpression("price * 2", ["paid"])).toEqual(["Нет свойства «price»"]);
});
