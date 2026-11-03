/**
 * w4-p03 — a note created from a view belongs to that view.
 *
 * N14 (acceptance 26.10): a note created in a view did not always get what
 * the view's filter needs, so it did not show where it was created. A
 * checkbox or number condition gave nothing, an «or» wrote every branch, and
 * a group was ignored.
 */
import { getFilterValuesFromConditions, prefillConditions } from "src/lib/helpers";
import type { FilterCondition, FilterDefinition } from "src/settings/settings";

const cond = (field: string, operator: FilterCondition["operator"], value?: string, enabled = true): FilterCondition =>
  ({ field, operator, ...(value !== undefined ? { value } : {}), enabled }) as FilterCondition;

describe("getFilterValuesFromConditions", () => {
  it("does not choose one of conflicting required values or disabled conditions", () => {
    expect(getFilterValuesFromConditions([cond("type", "is", "client"), cond("type", "is", "visit"), cond("type", "is", "visit"), cond("off", "is", "x", false), cond("paid", "is-not-checked")])).toEqual({ paid: false });
  });
  it("preserves exact case and unusual canonical property names", () => {
    const values = getFilterValuesFromConditions([cond("Status", "is", "A"), cond("status", "is", "B"), cond("__proto__", "is", "literal")]);
    expect(Object.entries(values)).toEqual([["Status", "A"], ["status", "B"], ["__proto__", "literal"]]);
    expect(Object.getPrototypeOf(values)).toBe(Object.prototype);
  });
  it("writes text, a number and a checkbox (old code: text only)", () => {
    expect(
      getFilterValuesFromConditions([
        cond("type", "is", "visit"),
        cond("rooms", "eq", "2"),
        cond("paid", "is-checked"),
        cond("archived", "is-not-checked"),
      ])
    ).toEqual({ type: "visit", rooms: 2, paid: true, archived: false });
  });

  it("writes nothing for a condition that names no single value", () => {
    expect(
      getFilterValuesFromConditions([
        cond("price", "gt", "100"),
        cond("name", "contains", "a"),
        cond("rooms", "eq", "two"),
        cond("rooms", "eq", ""),
      ])
    ).toEqual({});
  });

  it("leaves out the field the board groups by", () => {
    expect(getFilterValuesFromConditions([cond("status", "is", "done"), cond("type", "is", "visit")], "status")).toEqual({
      type: "visit",
    });
  });
});

describe("prefillConditions", () => {
  it("accepts a persisted group-only filter whose conditions array is absent", () => {
    const nested = cond("paid", "is-not-checked");
    const filter = { conjunction: "and", groups: [{ conjunction: "and", conditions: [nested] }] } as FilterDefinition;
    expect(prefillConditions(filter)).toEqual([nested]);
  });
  it("treats a legacy condition without enabled as active, as the display filter does", () => {
    const legacy = { field: "type", operator: "is", value: "visit" } as FilterCondition;
    expect(prefillConditions({ conjunction: "and", conditions: [legacy] })).toEqual([legacy]);
  });
  it("takes the enabled conditions of an «and», groups included", () => {
    const filter: FilterDefinition = {
      conjunction: "and",
      conditions: [cond("type", "is", "visit"), cond("off", "is", "x", false)],
      groups: [{ conjunction: "and", conditions: [cond("paid", "is-checked")] }],
    };
    expect(prefillConditions(filter).map((c) => c.field)).toEqual(["type", "paid"]);
  });

  it("takes nothing from an «or» of two parts (old code: wrote both)", () => {
    const filter: FilterDefinition = { conjunction: "or", conditions: [cond("type", "is", "visit"), cond("type", "is", "call")] };
    expect(prefillConditions(filter)).toEqual([]);
  });

  it("takes an «or» with one part, and skips an «or» group inside an «and»", () => {
    expect(prefillConditions({ conjunction: "or", conditions: [cond("type", "is", "visit")] }).map((c) => c.field)).toEqual(["type"]);
    const filter: FilterDefinition = {
      conjunction: "and",
      conditions: [cond("type", "is", "visit")],
      groups: [{ conjunction: "or", conditions: [cond("a", "is", "1"), cond("b", "is", "2")] }],
    };
    expect(prefillConditions(filter).map((c) => c.field)).toEqual(["type"]);
  });
});
