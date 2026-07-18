import { DataFieldType, type DataField, type DataFrame } from "src/lib/dataframe/dataframe";
import { adaptRelationFieldConfig, buildRelationTargetIndex, resolveRelationValue, resolvedRecords, validateLegacyLinkedSelection } from "src/lib/relations/relationContract";

const frame = (records: DataFrame["records"]): DataFrame => ({
  fields: [{ name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false }],
  records,
});

describe("relationContract", () => {
  it("adapts persisted configuration without adding inverse write authority", () => {
    expect(adaptRelationFieldConfig("sessions", "client", { targetProjectId: "clients", displayField: "name", inverseFieldName: "sessions" })).toEqual({
      source: { projectId: "sessions", fieldName: "client" }, target: { projectId: "clients", displayField: "name" }, storage: "wikilink", inverse: { fieldName: "sessions", createIfMissing: false },
    });
  });

  it("resolves paths before legacy basenames and preserves aliases and repeats", () => {
    const index = buildRelationTargetIndex(frame([{ id: "Clients/Acme.md", values: { name: "Acme Studio" } }, { id: "Archive/Acme.md", values: { name: "Old Acme" } }]), ["name"]);
    const results = resolveRelationValue(["[[Clients/Acme|ACME]]", "[[Missing]]", "[[Clients/Acme]]"], index);
    expect(results).toEqual([
      { rawLink: "[[Clients/Acme|ACME]]", canonicalPath: "Clients/Acme", status: "resolved", targetRecordId: "Clients/Acme.md" },
      { rawLink: "[[Missing]]", canonicalPath: "Missing", status: "unmatched" },
      { rawLink: "[[Clients/Acme]]", canonicalPath: "Clients/Acme", status: "resolved", targetRecordId: "Clients/Acme.md" },
    ]);
    expect(resolvedRecords(results, index).map((record) => record.id)).toEqual(["Clients/Acme.md", "Clients/Acme.md"]);
  });

  it("reports duplicate basename and display fallbacks as ambiguous", () => {
    const index = buildRelationTargetIndex(frame([{ id: "One/Acme.md", values: { name: "Shared" } }, { id: "Two/Acme.md", values: { name: "Shared" } }]), ["name"]);
    expect(resolveRelationValue("[[Acme]]", index)[0]?.status).toBe("ambiguous");
    expect(resolveRelationValue("[[Shared]]", index)[0]?.status).toBe("ambiguous");
  });

  it("normalizes headings, aliases and null values without losing the raw link", () => {
    const index = buildRelationTargetIndex(frame([{ id: "Clients/Acme.md", values: { name: "Acme" } }]));
    expect(resolveRelationValue("[[Clients/Acme#Contacts|Acme contact]]", index)).toEqual([
      { rawLink: "[[Clients/Acme#Contacts|Acme contact]]", canonicalPath: "Clients/Acme", status: "resolved", targetRecordId: "Clients/Acme.md" },
    ]);
    expect(resolveRelationValue(null, index)).toEqual([]);
  });

  it("keeps scope out of relation identity: consumers apply it after resolving", () => {
    const definition = adaptRelationFieldConfig("sessions", "client", {
      targetProjectId: "clients",
      targetSubBaseFilter: { conjunction: "and", conditions: [] },
    });
    expect(definition.target).toEqual({ projectId: "clients" });
  });

  describe("validateLegacyLinkedSelection", () => {
    const relationField: DataField = {
      name: "client",
      type: DataFieldType.Relation,
      repeated: false,
      identifier: false,
      derived: false,
      typeConfig: { relation: { targetProjectId: "clients" } },
    };

    it("returns all four legacy diagnostics without importing Dashboard types", () => {
      expect(validateLegacyLinkedSelection(undefined, "sessions", "clients", [relationField]).status).toBe("missing-relation");
      expect(validateLegacyLinkedSelection({ relationField: "status" }, "sessions", "clients", [{ ...relationField, name: "status", type: DataFieldType.Status }]).status).toBe("invalid-field");
      expect(validateLegacyLinkedSelection({ relationField: "client" }, "sessions", "projects", [relationField]).status).toBe("wrong-target-project");
      expect(validateLegacyLinkedSelection({ relationField: "client" }, "sessions", "clients", [relationField])).toEqual({
        status: "valid",
        relation: { source: { projectId: "sessions", fieldName: "client" }, target: { projectId: "clients" }, storage: "wikilink" },
      });
    });

    it("distinguishes a declared Relation without configuration from a non-Relation field", () => {
      expect(validateLegacyLinkedSelection({ relationField: "client" }, "sessions", "clients", [{ ...relationField, typeConfig: {} }]).status).toBe("missing-relation");
      expect(validateLegacyLinkedSelection({ relationField: "missing" }, "sessions", "clients", [relationField]).status).toBe("invalid-field");
    });
  });
});
