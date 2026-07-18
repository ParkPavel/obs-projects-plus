import { describe, it, expect } from "@jest/globals";
import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import { excludeHeaderField, getDisplayName } from "./boardHelpers";

function field(name: string): DataField {
  return { name, type: DataFieldType.String, repeated: false, identifier: false, derived: false };
}

describe("getDisplayName", () => {
  it("should return the basename without the extension", () => {
    expect(getDisplayName(`Untitled.md`)).toStrictEqual("Untitled");
    expect(getDisplayName(`Work/Untitled.md`)).toStrictEqual("Untitled");
    expect(getDisplayName(`Work/Client A/Untitled.md`)).toStrictEqual(
      "Untitled"
    );
  });
});

describe("excludeHeaderField (#109)", () => {
  const fields = [field("title"), field("status"), field("client")];

  it("removes the custom-header field from the body list when present", () => {
    const result = excludeHeaderField(fields, field("client"));
    expect(result.map((f) => f.name)).toEqual(["title", "status"]);
  });

  it("is a no-op when customHeader is undefined", () => {
    expect(excludeHeaderField(fields, undefined)).toBe(fields);
  });

  it("is a no-op when customHeader is not in the list", () => {
    const result = excludeHeaderField(fields, field("priority"));
    expect(result.map((f) => f.name)).toEqual(["title", "status", "client"]);
  });
});
