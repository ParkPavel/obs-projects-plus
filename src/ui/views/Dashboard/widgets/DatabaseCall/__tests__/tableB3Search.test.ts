/**
 * 3.7.2 B3 — search conditions that used to fail, suggestions and highlight.
 *
 * RED on 4e117313: `ё` vs `е`, a Date value (String(date) = «Wed Oct 14…»),
 * a comma decimal, a dotted date against a stored ISO day, `.md` matching
 * every record, and `field:value` / `field:` were all plain substrings; the
 * parse/suggest/highlight exports did not exist.
 */
import {
  applySearch,
  parseSearchQuery,
  searchSuggestions,
  highlightParts,
  searchDay,
} from "../tableSearchMatch";

type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;

const records: DataRecord[] = [
  { id: "notes/Ёлка.md", values: { name: "Ёлка", status: "Done", due: "2026-10-14", price: 1.5, tags: ["зелёный", "Зима"], owner: "" } },
  { id: "notes/Елена.md", values: { name: "Елена", status: "In progress", due: new Date(2026, 9, 1), price: 10, tags: [], owner: "Ann" } },
  { id: "notes/Report.md", values: { name: "Report", status: "todo", due: null, price: 100, tags: ["work"], owner: null } },
];
const fields = ["name", "status", "due", "price", "tags", "owner", "Due date"];
const ids = (q: string) => applySearch(records, q, fields).map((r) => r.id.replace(/^notes\/|\.md$/g, ""));

describe("search conditions (B3)", () => {
  it("ignores case and treats ё as е both ways", () => {
    expect(ids("елка")).toEqual(["Ёлка"]);
    expect(ids("ЁЛКА")).toEqual(["Ёлка"]);
    expect(ids("зеленый")).toEqual(["Ёлка"]);
    expect(ids("ЕЛЕНА")).toEqual(["Елена"]);
  });

  it("does not match the .md of every id", () => {
    expect(ids("md")).toEqual([]);
  });

  it("finds numbers typed with a comma or a dot", () => {
    expect(ids("1,5")).toEqual(["Ёлка"]);
    expect(ids("1.5")).toEqual(["Ёлка"]);
  });

  it("finds dates in different formats against ISO strings and Date values", () => {
    expect(ids("14.10.2026")).toEqual(["Ёлка"]);
    expect(ids("2026-10-14")).toEqual(["Ёлка"]);
    expect(ids("14/10/2026")).toEqual(["Ёлка"]);
    expect(ids("01.10.2026")).toEqual(["Елена"]);
    expect(ids("1.10.26")).toEqual(["Елена"]);
    expect(searchDay("31.13.2026")).toBeUndefined();
  });

  it("requires every word (AND) and keeps quoted phrases together", () => {
    expect(ids("in progress")).toEqual(["Елена"]);
    expect(ids('"in progress" елена')).toEqual(["Елена"]);
    expect(ids("done елена")).toEqual([]);
  });

  it("field:value searches one field, field: is empty, field:* is filled", () => {
    expect(ids("status:done")).toEqual(["Ёлка"]);
    expect(ids("STATUS:todo")).toEqual(["Report"]);
    expect(ids("name:done")).toEqual([]);
    expect(ids("owner:")).toEqual(["Ёлка", "Report"]);
    expect(ids("owner:*")).toEqual(["Елена"]);
    expect(ids("tags:")).toEqual(["Елена"]);
    expect(ids("due:14.10.2026")).toEqual(["Ёлка"]);
  });

  it("an unknown prefix stays plain text (10:30 is not a field)", () => {
    const parsed = parseSearchQuery("10:30", fields);
    expect(parsed.terms).toEqual([{ kind: "contains", text: "10:30" }]);
  });

  it("empty and blank queries keep every record", () => {
    expect(ids("")).toHaveLength(3);
    expect(ids("   ")).toHaveLength(3);
  });
});

describe("suggestions (B3)", () => {
  it("completes a field name to field:", () => {
    expect(searchSuggestions("sta", fields, records).map((s) => s.query)).toEqual(["status:"]);
    expect(searchSuggestions("елка du", fields, records).map((s) => s.query)).toEqual(["елка due:", 'елка "Due date":']);
  });

  it("completes field: to the field's known values, filtered by what is typed", () => {
    expect(searchSuggestions("status:", fields, records).map((s) => s.label)).toEqual(["status: Done", "status: In progress", "status: todo"]);
    expect(searchSuggestions("status:prog", fields, records).map((s) => s.query)).toEqual(['status:"In progress" ']);
    expect(searchSuggestions("tags:зел", fields, records).map((s) => s.query)).toEqual(["tags:зелёный "]);
  });

  it("offers nothing for an unknown field or an empty token", () => {
    expect(searchSuggestions("zzz:", fields, records)).toEqual([]);
    expect(searchSuggestions("", fields, records)).toEqual([]);
  });
});

describe("highlight (B3)", () => {
  it("marks every match, ё-insensitive, keeping the original letters", () => {
    const parts = highlightParts("Ёлка и елка", parseSearchQuery("елка", fields));
    expect(parts).toEqual([
      { text: "Ёлка", hit: true }, { text: " и ", hit: false }, { text: "елка", hit: true },
    ]);
  });

  it("a field term marks only its own field", () => {
    const parsed = parseSearchQuery("status:done", fields);
    expect(highlightParts("Done", parsed, "status")).toEqual([{ text: "Done", hit: true }]);
    expect(highlightParts("Done", parsed, "name")).toEqual([{ text: "Done", hit: false }]);
  });
});
