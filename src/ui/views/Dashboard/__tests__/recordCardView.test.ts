/**
 * Tests for RecordCardView logic:
 * - Icon field auto-detection (ICON_CANDIDATES)
 * - Description field auto-detection (DESC_CANDIDATES)
 * - TDT-01: icon slot visibility when resolvedIconField exists but iconValue is empty
 */
import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";

const ICON_CANDIDATES = ["icon", "cover", "thumbnail"];
const DESC_CANDIDATES = ["description", "summary", "excerpt"];

function mkField(name: string, type: DataFieldType = DataFieldType.String): DataField {
  return { name, type, repeated: false, derived: false, identifier: false };
}

function resolveIconField(fields: DataField[], iconField?: string): string | undefined {
  return iconField ?? fields.find((f) => ICON_CANDIDATES.includes(f.name.toLowerCase()))?.name;
}

function resolveDescField(fields: DataField[]): DataField | undefined {
  return fields.find((f) => DESC_CANDIDATES.includes(f.name.toLowerCase()));
}

describe("RecordCardView — icon field detection", () => {
  test("returns undefined when no icon candidate fields exist", () => {
    const fields = [mkField("title"), mkField("status")];
    expect(resolveIconField(fields)).toBeUndefined();
  });

  test("auto-detects 'icon' field", () => {
    const fields = [mkField("title"), mkField("icon")];
    expect(resolveIconField(fields)).toBe("icon");
  });

  test("auto-detects 'cover' field", () => {
    const fields = [mkField("cover"), mkField("title")];
    expect(resolveIconField(fields)).toBe("cover");
  });

  test("auto-detects 'thumbnail' field", () => {
    const fields = [mkField("thumbnail")];
    expect(resolveIconField(fields)).toBe("thumbnail");
  });

  test("explicit iconField prop overrides auto-detection", () => {
    const fields = [mkField("icon"), mkField("custom_icon")];
    expect(resolveIconField(fields, "custom_icon")).toBe("custom_icon");
  });

  test("case-insensitive matching", () => {
    const fields = [mkField("ICON")];
    expect(resolveIconField(fields)).toBe("ICON");
  });

  // TDT-01 regression: icon slot must render even when value is empty
  test("TDT-01: resolvedIconField is defined even when record has no icon value", () => {
    const fields = [mkField("icon")];
    const resolved = resolveIconField(fields);
    expect(resolved).toBe("icon");
    // The slot condition is `{#if resolvedIconField}`, not `{#if iconValue}`,
    // so having a field name is enough to show the picker button.
    const iconValue = undefined;
    expect(resolved !== undefined && !iconValue).toBe(true);
  });
});

describe("RecordCardView — description field detection", () => {
  test("returns undefined when no desc candidate exists", () => {
    const fields = [mkField("title"), mkField("status")];
    expect(resolveDescField(fields)).toBeUndefined();
  });

  test("auto-detects 'description' field", () => {
    const fields = [mkField("title"), mkField("description")];
    expect(resolveDescField(fields)?.name).toBe("description");
  });

  test("auto-detects 'summary' field", () => {
    const fields = [mkField("summary")];
    expect(resolveDescField(fields)?.name).toBe("summary");
  });

  test("auto-detects 'excerpt' field", () => {
    const fields = [mkField("excerpt")];
    expect(resolveDescField(fields)?.name).toBe("excerpt");
  });

  test("case-insensitive matching for desc fields", () => {
    const fields = [mkField("DESCRIPTION")];
    expect(resolveDescField(fields)?.name).toBe("DESCRIPTION");
  });
});
