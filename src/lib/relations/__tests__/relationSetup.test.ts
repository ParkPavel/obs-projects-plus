import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { previewRelationSetup, summarizeRelationPreview, toRelationFieldConfig, validateRelationSetupDraft } from "../relationSetup";

const source: DataFrame = {
  fields: [], records: [
    { id: "sessions/one.md", values: { client: "[[clients/Ada]]" } },
    { id: "sessions/two.md", values: { client: ["[[Missing]]", "[[Sam]]"] } },
  ],
};
const target: DataFrame = {
  fields: [], records: [
    { id: "clients/Ada.md", values: { title: "Ada" } },
    { id: "archive/Sam.md", values: { title: "Sam" } },
    { id: "clients/Sam.md", values: { title: "Sam" } },
  ],
};

describe("relation setup preview", () => {
  test("uses the canonical resolver and never changes source values", () => {
    const preview = previewRelationSetup(source, "client", target, "title");
    expect(preview[0]?.resolutions[0]?.status).toBe("resolved");
    expect(preview[1]?.resolutions.map((value) => value.status)).toEqual(["unmatched", "ambiguous"]);
    expect(source.records[0]?.values["client"]).toBe("[[clients/Ada]]");
    expect(summarizeRelationPreview(preview)).toEqual({ resolved: 1, unmatched: 1, ambiguous: 1 });
  });

  test("requires explicit schema choices and only persists opted-in inverse", () => {
    const existing = [{ name: "client", type: DataFieldType.Relation, repeated: true, identifier: false, derived: false }];
    expect(validateRelationSetupDraft({ fieldName: "client", targetProjectId: "clients", createSourceField: false }, existing).valid).toBe(true);
    expect(validateRelationSetupDraft({ fieldName: "client", targetProjectId: "clients", createSourceField: true }, existing).valid).toBe(false);
    expect(toRelationFieldConfig({ fieldName: "client", targetProjectId: "clients", displayField: "name", createSourceField: false, inverse: { enabled: true, fieldName: "sessions" } })).toEqual({ targetProjectId: "clients", displayField: "name", inverseFieldName: "sessions" });
    expect(toRelationFieldConfig({ fieldName: "client", targetProjectId: "clients", createSourceField: false, inverse: { enabled: false, fieldName: "sessions" } })).toEqual({ targetProjectId: "clients" });
  });
});
