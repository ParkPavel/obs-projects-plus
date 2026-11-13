import { createSuggestionIndex, searchSuggestions } from "../suggestionSearch";
import { nearWord } from "../searchText";
import { valueSuggestions } from "../valueSuggestions";

it("ranks exact, case, prefixes, word prefixes, token prefixes and substrings in that order", () => {
  const values = ["my status here", "new status", "statuses", "STATUS", "status", "mystatus"].map(label => ({ label }));
  expect(searchSuggestions(values, "status").map(item => item.label)).toEqual(["status", "STATUS", "statuses", "my status here", "new status", "mystatus"]);
  expect(searchSuggestions([{ label: "Классический массаж" }, { label: "Массаж классический" }], "кл мас")).toHaveLength(2);
});

it.each(["МАССАЖ", "massazh", "vfccf;", "масаж", "масасж"])("finds Russian text for %s without changing the selected object", query => {
  const canonical = { id: "Services/Массаж.md", label: "Массаж", value: "[[Services/Массаж|Услуга]]" };
  expect(searchSuggestions([canonical], query)).toEqual([canonical]);
  expect(searchSuggestions([canonical], query)[0]).toBe(canonical);
});

it("normalizes Unicode and ё only for matching, retaining case-distinct canonical IDs", () => {
  const values = [{ id: "Ёж", label: "Ёж" }, { id: "ёж", label: "ёж" }, { id: "Café", label: "Cafe\u0301" }];
  expect(searchSuggestions(values, "еж").map(value => value.id)).toEqual(["Ёж", "ёж"]);
  expect(searchSuggestions(values, "CAFÉ")[0]).toBe(values[2]);
});

it("does not use fuzzy matches for short queries or accept unlimited edits", () => {
  expect(searchSuggestions([{ label: "кот" }], "кит")).toEqual([]);
  expect(nearWord("масаж", "массаж")).toBe(true);
  expect(nearWord("abcde", "axyze")).toBe(false);
  expect(nearWord("x".repeat(1000), "x".repeat(1000))).toBe(false);
});

it("the bounded fuzzy path agrees with a full distance matrix, including transpositions", () => {
  const reference = (left: string, right: string) => {
    const a = Array.from(left), b = Array.from(right);
    const matrix = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      matrix[i]![j] = Math.min(matrix[i - 1]![j]! + 1, matrix[i]![j - 1]! + 1, matrix[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) matrix[i]![j] = Math.min(matrix[i]![j]!, matrix[i - 2]![j - 2]! + 1);
    }
    return matrix[a.length]![b.length]! <= (a.length < 8 ? 1 : 2);
  };
  const words = ["массаж", "abcd", "abcdefgh", "ааббввгг", "𐐀abcd", "aaaaabbb"];
  for (const a of words) for (const b of [...words, a.slice(1), a + "x", "x" + a.slice(1), a[1]! + a[0]! + a.slice(2)]) expect(nearWord(a, b)).toBe(reference(a, b));
});

it("uses aliases as search text while returning the canonical value", () => {
  const canonical = { id: "A/B.md", label: "B", aliases: ["Массаж"], value: "[[A/B]]" };
  expect(searchSuggestions([canonical], "massazh")[0]).toBe(canonical);
});

it("incrementally replaces changed projections and removes renamed/deleted candidates", () => {
  const index = createSuggestionIndex<{ id: string; label: string }>();
  index.replace([{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }], value => value.id);
  expect(index.projectionsBuilt).toBe(2);
  index.search("al"); index.search("be");
  expect(index.projectionsBuilt).toBe(2);
  index.replace([{ id: "a", label: "Alpha" }, { id: "b", label: "Bravo" }], value => value.id);
  expect(index.projectionsBuilt).toBe(3);
  index.remove("a"); index.upsert("c", { id: "c", label: "Charlie" });
  expect(index.search("").items.map(value => value.id)).toEqual(["b", "c"]);
  expect(index.search("Alpha").items).toEqual([]);
  expect(index.search("").version).toBe(4);
});

it("keeps scopes separate and bounds the rendered first page", () => {
  const own = Array.from({ length: 200 }, (_, id) => ({ id, label: `Own ${id}` }));
  expect(searchSuggestions(own, "")).toHaveLength(50);
  expect(searchSuggestions([{ label: "Other project" }], "Own")).toEqual([]);
  expect(searchSuggestions(own, "Own 199")[0]).toBe(own[199]);
  expect(searchSuggestions([{ label: "x".repeat(128) }], "x".repeat(129))).toEqual([]);
});

it("can search beyond the old 200-value pool cutoff in only the requested field", () => {
  const records = Array.from({ length: 500 }, (_, id) => ({ id: `Own/${id}.md`, values: { service: `Услуга ${id.toString().padStart(3, "0")}`, other: "Чужое значение" } }));
  const values = valueSuggestions(records, { name: "service", type: "string" });
  expect(values).toHaveLength(500);
  expect(searchSuggestions(values.map(label => ({ label })), "Услуга 499")[0]?.label).toBe("Услуга 499");
  expect(values).not.toContain("Чужое значение");
});

it("schema cache identities cannot collide when options contain delimiter characters", () => {
  const records: [] = [];
  const first = valueSuggestions(records, { name: "service", type: "select", typeConfig: { options: ["a\u0001b"] } });
  const next = valueSuggestions(records, { name: "service", type: "select", typeConfig: { options: ["a", "b"] } });
  expect(first).toEqual(["a\u0001b"]);
  expect(next).toEqual(["a", "b"]);
});
