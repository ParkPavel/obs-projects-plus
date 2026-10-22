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
  };
  const t = (k: string, o: Record<string, string> = {}) => (ru[k] ?? k).replace(/{{(\w+)}}/g, (_: string, n: string) => o[n] ?? "");
  return { i18n: writable({ t }) };
});
import { evaluateFormulaValue, evaluateFormulaWithError, validateFormulaExpression } from "src/lib/formula/extendedEvaluator";
import { humanFormulaError } from "src/lib/formula/formulaErrors";

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
