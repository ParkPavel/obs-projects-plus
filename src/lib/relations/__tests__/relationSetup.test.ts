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

  // #158 — the guided setup could not finish from «Выбрать поле → Связать с
  // базой» for a property that already exists as, say, text: the validator
  // accepted only a brand-new name (createSourceField: true) or an existing
  // property ALREADY typed Relation, and refused everything else with
  // "Choose an existing Relation property or create one." — including the
  // exact property the user had just opened the wizard from.
  describe("the third shape — an existing property that is not yet a Relation", () => {
    const textField = { name: "client", type: DataFieldType.String, repeated: false, identifier: false, derived: false };
    const relationField = { name: "client", type: DataFieldType.Relation, repeated: true, identifier: false, derived: false };

    test("saves: an existing non-Relation property with a target is a valid draft", () => {
      expect(validateRelationSetupDraft({ fieldName: "client", targetProjectId: "clients", createSourceField: false }, [textField]).valid).toBe(true);
    });

    test("the two shapes that worked before still work", () => {
      expect(validateRelationSetupDraft({ fieldName: "newField", targetProjectId: "clients", createSourceField: true }, [textField]).valid).toBe(true);
      expect(validateRelationSetupDraft({ fieldName: "client", targetProjectId: "clients", createSourceField: false }, [relationField]).valid).toBe(true);
    });

    test("a create-draft whose name collides with an existing property is still refused", () => {
      const result = validateRelationSetupDraft({ fieldName: "client", targetProjectId: "clients", createSourceField: true }, [textField]);
      expect(result.valid).toBe(false);
      expect(result.valid === false && result.messageKey).toBe("relation-setup.error-name-taken");
    });

    test("naming a property that does not exist at all, without asking to create it, is still refused", () => {
      const result = validateRelationSetupDraft({ fieldName: "ghost", targetProjectId: "clients", createSourceField: false }, [textField]);
      expect(result.valid).toBe(false);
      expect(result.valid === false && result.messageKey).toBe("relation-setup.error-existing-property-required");
    });
  });

  describe("what a relation may not take over", () => {
    const draft = (name: string) => ({ fieldName: name, targetProjectId: "clients", createSourceField: false });
    const plain = { name: "client", type: DataFieldType.String, repeated: false, identifier: false, derived: false };

    test.each([
      ["a formula", { ...plain, name: "computed", type: DataFieldType.Formula }],
      ["a rollup", { ...plain, name: "computed", type: DataFieldType.Rollup }],
      ["an identifier", { ...plain, name: "computed", identifier: true }],
      ["a derived property", { ...plain, name: "computed", derived: true }],
    ])("refuses %s", (_label, field) => {
      const result = validateRelationSetupDraft(draft("computed"), [field]);
      // Converting these would drop the definition that produces their values,
      // or claim a property the project does not write. The wizard says so
      // instead of writing and finding out.
      expect(result).toEqual({
        valid: false,
        messageKey: "relation-setup.error-not-convertible",
        message: expect.stringContaining("cannot become a relation"),
      });
    });

    test("refuses an identifier even when it is already a relation", () => {
      // The write lands on the field whatever its current type, so the guard
      // cannot be something only non-relations pass through.
      const field = { ...plain, name: "computed", type: DataFieldType.Relation, identifier: true };
      expect(validateRelationSetupDraft(draft("computed"), [field]).valid).toBe(false);
    });

    test("refuses when a second field of the same name is not convertible", () => {
      // The writer replaces every entry with that name; validating only the
      // first is how a refusal gets bypassed by ordering.
      const ok = { ...plain, name: "twice" };
      const notOk = { ...plain, name: "twice", type: DataFieldType.Formula };
      expect(validateRelationSetupDraft(draft("twice"), [ok, notOk]).valid).toBe(false);
    });
    test("still converts a plain stored property", () => {
      expect(validateRelationSetupDraft(draft("client"), [plain])).toEqual({ valid: true });
    });
  });
});
