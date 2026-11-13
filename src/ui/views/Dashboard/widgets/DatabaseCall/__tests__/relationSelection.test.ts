import { selectedCandidateIds, serializeRelationSelection, toggleRelationSelection } from "../relationSelection";

it.each([null, undefined, [], "", "[[A|Alias]]", ["[[A|Alias]]", "[[A|Other alias]]", "[[B]]"]])("returns an unchanged stored value by identity: %s", original => {
  const targets = typeof original === "string" && original ? ["A"] : Array.isArray(original) && original.length ? ["A", "B"] : [];
  expect(serializeRelationSelection(targets, original, true)).toBe(original);
});
it("removes one link without changing aliases or duplicate tokens belonging to another", () => {
  expect(serializeRelationSelection(["A"], ["[[A|Alias]]", "[[A|Second]]", "[[B]]"], true)).toEqual(["[[A|Alias]]", "[[A|Second]]"]);
});
it("adds a full path while preserving existing plain and aliased tokens", () => {
  expect(serializeRelationSelection(["A", "B", "Folder/C"], ["A", "[[B|Alias]]"], true)).toEqual(["A", "[[B|Alias]]", "[[Folder/C]]"]);
});
it("requires an unambiguous target for a legacy basename and preserves exact canonical case", () => {
  expect(selectedCandidateIds(["Note"], ["A/Note", "B/Note"])).toEqual([]);
  expect(selectedCandidateIds(["Note"], ["A/Note"])).toEqual(["A/Note"]);
  expect(selectedCandidateIds(["A/Note"], ["a/Note"])).toEqual([]);
});
it("toggling a resolved legacy selection removes its stored token without creating a second link", () => {
  expect([...toggleRelationSelection(new Set(["Note"]), "A/Note", ["A/Note"])]).toEqual([]);
});
it("clear uses the established single relation contract", () => {
  expect(serializeRelationSelection([], "[[A|Alias]]", false)).toBe("");
});
