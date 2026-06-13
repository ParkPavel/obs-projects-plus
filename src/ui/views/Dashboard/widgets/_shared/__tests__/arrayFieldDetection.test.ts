import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataField } from "src/lib/dataframe/dataframe";
import type { TransformStep } from "src/lib/dashboard-engine/transformTypes";
import { detectArrayFields } from "../arrayFieldDetection";

function field(name: string): DataField {
  return { name, type: DataFieldType.Unknown, repeated: false, identifier: false, derived: false };
}

describe("detectArrayFields", () => {
  const fields = [field("title"), field("exercises"), field("tags")];

  test("returns empty when source is null or has no records", () => {
    expect(detectArrayFields(null, fields, [])).toEqual([]);
    expect(detectArrayFields({ records: [] }, fields, [])).toEqual([]);
  });

  test("detects fields holding a non-empty array", () => {
    const src = {
      records: [
        { values: { title: "Mon", exercises: [{ name: "Bench" }], tags: ["a"] } },
      ],
    };
    const result = detectArrayFields(src, fields, []);
    expect(result).toContain("exercises");
    expect(result).toContain("tags");
    expect(result).not.toContain("title");
  });

  test("ignores empty arrays and scalar values", () => {
    const src = {
      records: [{ values: { title: "Mon", exercises: [], tags: 3 } }],
    };
    expect(detectArrayFields(src, fields, [])).toEqual([]);
  });

  test("excludes fields already targeted by an unnest step", () => {
    const src = {
      records: [{ values: { exercises: [{ name: "Bench" }], tags: ["a"] } }],
    };
    const steps: TransformStep[] = [{ type: "unnest", field: "exercises" }];
    const result = detectArrayFields(src, fields, steps);
    expect(result).not.toContain("exercises");
    expect(result).toContain("tags");
  });
});
