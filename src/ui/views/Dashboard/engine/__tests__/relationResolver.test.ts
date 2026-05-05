/**
 * relationResolver — wikilink resolution against a DataFrame
 * (REFACTOR-107 coverage gap fill).
 *
 * Pins:
 *  - extractWikiLinks delegates to canonical kernel (REFACTOR-105)
 *  - buildRecordIndex indexes by basename + name/title fields
 *  - resolveRelations / getRelationTargetsWithIndex correctness
 *  - computeBacklinks invariants (target → sources)
 */

import {
  extractWikiLinks,
  buildRecordIndex,
  resolveRelationsForValue,
  resolveRelations,
  getRelationTargetsWithIndex,
  computeBacklinks,
} from "src/ui/views/Dashboard/engine/relationResolver";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";

const fields = [
  { name: "title", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
  { name: "rel", type: DataFieldType.Relation, repeated: true, identifier: false, derived: false },
];

function rec(id: string, values: Record<string, unknown>): DataRecord {
  return { id, values: values as DataRecord["values"] };
}

describe("relationResolver", () => {
  describe("extractWikiLinks", () => {
    test("single link", () => {
      expect(extractWikiLinks("[[Note A]]")).toEqual(["Note A"]);
    });
    test("multiple links preserve order", () => {
      expect(extractWikiLinks("[[A]] and [[B]]")).toEqual(["A", "B"]);
    });
    test("alias is stripped", () => {
      expect(extractWikiLinks("[[Note|Display]]")).toEqual(["Note"]);
    });
    test("plain text → []", () => {
      expect(extractWikiLinks("hello world")).toEqual([]);
    });
  });

  describe("buildRecordIndex", () => {
    test("indexes by basename (lowercased)", () => {
      const df: DataFrame = {
        fields,
        records: [rec("Folder/Note A.md", { title: "Note A" })],
      };
      const idx = buildRecordIndex(df);
      expect(idx.get("note a")).toBeDefined();
    });
    test("indexes by 'name' field as well", () => {
      const df: DataFrame = {
        fields,
        records: [rec("X.md", { name: "Hello World" })],
      };
      const idx = buildRecordIndex(df);
      expect(idx.get("hello world")?.id).toBe("X.md");
    });
    test("indexes by 'title' field", () => {
      const df: DataFrame = {
        fields,
        records: [rec("X.md", { title: "Custom Title" })],
      };
      const idx = buildRecordIndex(df);
      expect(idx.get("custom title")?.id).toBe("X.md");
    });
    test("strips file extension from basename", () => {
      const df: DataFrame = {
        fields,
        records: [rec("Some.Note.md", {})],
      };
      const idx = buildRecordIndex(df);
      expect(idx.get("some.note")).toBeDefined();
    });
  });

  describe("resolveRelationsForValue", () => {
    const df: DataFrame = {
      fields,
      records: [rec("A.md", { title: "A" }), rec("B.md", { title: "B" })],
    };
    const idx = buildRecordIndex(df);

    test("resolves resolvable link", () => {
      const out = resolveRelationsForValue("[[A]]", idx);
      expect(out).toHaveLength(1);
      expect(out[0]?.target?.id).toBe("A.md");
    });
    test("unresolved link → target undefined", () => {
      const out = resolveRelationsForValue("[[Missing]]", idx);
      expect(out).toHaveLength(1);
      expect(out[0]?.target).toBeUndefined();
    });
    test("non-string value → []", () => {
      expect(resolveRelationsForValue(42, idx)).toEqual([]);
      expect(resolveRelationsForValue(null, idx)).toEqual([]);
      expect(resolveRelationsForValue(undefined, idx)).toEqual([]);
    });
    test("array value with multiple links resolves each", () => {
      const out = resolveRelationsForValue(["[[A]]", "[[B]]"], idx);
      expect(out.map((r) => r.target?.id)).toEqual(["A.md", "B.md"]);
    });
  });

  describe("resolveRelations / getRelationTargetsWithIndex", () => {
    const df: DataFrame = {
      fields,
      records: [
        rec("A.md", { title: "A", rel: "[[B]]" }),
        rec("B.md", { title: "B", rel: "" }),
      ],
    };

    test("returns one result per record with non-empty relations", () => {
      const results = resolveRelations(df, "rel");
      expect(results).toHaveLength(1);
      expect(results[0]?.sourceId).toBe("A.md");
    });
    test("getRelationTargetsWithIndex returns DataRecord[] only", () => {
      const idx = buildRecordIndex(df);
      const targets = getRelationTargetsWithIndex(df.records[0]!, "rel", idx);
      expect(targets.map((r) => r.id)).toEqual(["B.md"]);
    });
  });

  describe("computeBacklinks", () => {
    test("inverts edges A→B into B-backlinks-from-A", () => {
      const df: DataFrame = {
        fields,
        records: [
          rec("A.md", { title: "A", rel: "[[B]]" }),
          rec("B.md", { title: "B", rel: "" }),
        ],
      };
      const { backlinks, fieldName } = computeBacklinks(df, "rel");
      expect(fieldName).toBe("rel_backlinks");
      expect(backlinks.get("B.md")).toEqual(["A.md"]);
      expect(backlinks.get("A.md")).toBeUndefined();
    });
    test("multiple sources accumulate", () => {
      const df: DataFrame = {
        fields,
        records: [
          rec("A.md", { title: "A", rel: "[[C]]" }),
          rec("B.md", { title: "B", rel: "[[C]]" }),
          rec("C.md", { title: "C", rel: "" }),
        ],
      };
      const { backlinks } = computeBacklinks(df, "rel");
      expect(backlinks.get("C.md")?.sort()).toEqual(["A.md", "B.md"]);
    });
    test("unresolved links are skipped silently", () => {
      const df: DataFrame = {
        fields,
        records: [rec("A.md", { title: "A", rel: "[[Ghost]]" })],
      };
      const { backlinks } = computeBacklinks(df, "rel");
      expect(backlinks.size).toBe(0);
    });
  });
});
