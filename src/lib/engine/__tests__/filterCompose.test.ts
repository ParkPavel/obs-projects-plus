// Filter-definition algebra shared by the #118 migration and the #125
// filter-tab promotion. The interesting half is refusing to flatten an `or`:
// appending a condition to a disjunction widens the result, which is the
// opposite of what composing two filters means.

import { andComposeFilters, hasFilterEffect } from "../filterCompose";
import type { FilterCondition, FilterDefinition } from "src/settings/base/settings";

const cond = (field: string, value: string): FilterCondition =>
  ({ field, operator: "is", value, enabled: true } as unknown as FilterCondition);

const and = (...conditions: FilterCondition[]): FilterDefinition => ({
  conjunction: "and",
  conditions,
});

describe("hasFilterEffect", () => {
  it("is false for undefined and for a definition that removes nothing", () => {
    expect(hasFilterEffect(undefined)).toBe(false);
    expect(hasFilterEffect({ conjunction: "and", conditions: [] })).toBe(false);
  });

  it("is true for a groups-only definition", () => {
    expect(
      hasFilterEffect({ conjunction: "and", conditions: [], groups: [and(cond("a", "1"))] })
    ).toBe(true);
  });

  it("tolerates persisted JSON with no conditions array at all", () => {
    expect(hasFilterEffect({ groups: [and(cond("a", "1"))] } as unknown as FilterDefinition)).toBe(
      true
    );
    expect(hasFilterEffect({} as unknown as FilterDefinition)).toBe(false);
  });
});

describe("andComposeFilters", () => {
  it("returns undefined when nothing meaningful is supplied", () => {
    expect(andComposeFilters([undefined, { conjunction: "and", conditions: [] }])).toBeUndefined();
  });

  it("returns the single meaningful definition unchanged", () => {
    const only = and(cond("a", "1"));

    expect(andComposeFilters([undefined, only])).toBe(only);
  });

  it("flattens plain AND definitions into one condition list", () => {
    const merged = andComposeFilters([and(cond("a", "1")), and(cond("b", "2"))]);

    expect(merged?.conditions).toEqual([cond("a", "1"), cond("b", "2")]);
    expect(merged?.groups).toBeUndefined();
  });

  it("never flattens an 'or' — that would widen instead of narrow", () => {
    const or: FilterDefinition = {
      conjunction: "or",
      conditions: [cond("tier", "a"), cond("tier", "b")],
    };
    const merged = andComposeFilters([or, and(cond("status", "done"))]);

    expect(merged?.conjunction).toBe("and");
    expect(merged?.groups).toEqual([or, and(cond("status", "done"))]);
  });

  it("nests rather than flattens when a definition already carries groups", () => {
    const withGroups: FilterDefinition = {
      conjunction: "and",
      conditions: [cond("a", "1")],
      groups: [and(cond("b", "2"))],
    };
    const merged = andComposeFilters([withGroups, and(cond("c", "3"))]);

    expect(merged?.groups).toHaveLength(2);
    expect(merged?.conditions).toEqual([]);
  });

  it("keeps a flattened merge visible to conditions-only emptiness guards", () => {
    // A groups-only shape reads as "no filter" to every guard that checks
    // conditions.length alone — the common case must not produce one.
    const merged = andComposeFilters([and(cond("a", "1")), and(cond("b", "2"))]);

    expect(merged?.conditions.length).toBeGreaterThan(0);
  });

  it("drops empty definitions from the middle instead of nesting them", () => {
    const merged = andComposeFilters([
      and(cond("a", "1")),
      { conjunction: "and", conditions: [] },
      and(cond("b", "2")),
    ]);

    expect(merged?.conditions).toHaveLength(2);
  });
});
