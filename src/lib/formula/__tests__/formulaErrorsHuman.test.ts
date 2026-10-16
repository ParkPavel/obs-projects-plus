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
  };
  const t = (k: string, o: Record<string, string> = {}) => (ru[k] ?? k).replace(/{{(\w+)}}/g, (_: string, n: string) => o[n] ?? "");
  return { i18n: writable({ t }) };
});
import { evaluateFormulaValue, validateFormulaExpression } from "src/lib/formula/extendedEvaluator";

it("a field is found whatever its case — in the check and in the value", () => {
  expect(validateFormulaExpression("Paid * 2", ["paid"])).toEqual([]);
  expect(evaluateFormulaValue("Paid * 2", { id: "a.md", values: { paid: 5 } })).toBe(10);
});

it("messages are sentences, not parser tokens", () => {
  expect(validateFormulaExpression("paid +", ["paid"])).toEqual(["Формула не закончена — допишите значение"]);
  expect(validateFormulaExpression("+", ["paid"])[0]).toMatch(/не хватает значения/);
  expect(validateFormulaExpression("price * 2", ["paid"])).toEqual(["Нет свойства «price»"]);
});
