/**
 * The test that would have caught F3 (architect F1–F3): a relation-block
 * suggestion, turned into the block it adds, must validate against the frame
 * that block reads — and picking a client in the master must leave only that
 * client's sessions. The old wiring named the HOST's field on the TARGET's
 * frame: invalid-field, and the plain canvas condition matched nothing.
 */

import { DataFieldType, type DataFrame, type DataValue } from "src/lib/dataframe/dataframe";
import { validateLegacyLinkedSelection } from "src/lib/relations/relationContract";
import { computeSuggestions } from "../smartSuggest";
import { widgetForSuggestion } from "../suggestionWidgets";
import { composeEffectiveFilter, dataTableSourceId, type SelectionState } from "../canvasSelectionStore";
import { filterByLinkedSelection } from "../widgets/DatabaseCall/relationFilterAdapter";
import type { LinkedSelectionConfig } from "../types";

// The Sessions frame as an external block reads it: `client` declared a
// relation to Clients (M2-C6 applies the declared type).
const sessions: DataFrame = {
  fields: [
    { name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
    { name: "client", type: DataFieldType.Relation, repeated: false, identifier: false, derived: false, typeConfig: { relation: { targetProjectId: "p-clients" } } },
  ],
  records: [
    { id: "Сеансы/Сеанс 1.md", values: { name: "Сеанс 1", client: "[[Alice]]" as DataValue } },
    { id: "Сеансы/Сеанс 2.md", values: { name: "Сеанс 2", client: "[[Bob]]" as DataValue } },
  ],
} as unknown as DataFrame;

const context = {
  hostProjectId: "p-clients",
  projects: [
    { id: "p-clients", name: "Клиенты" },
    { id: "p-sessions", name: "Сеансы", fieldConfig: { client: { relation: { targetProjectId: "p-clients" } } } },
  ],
};

test("the suggested block validates against the frame it reads, and narrows to the picked client", () => {
  const suggestion = computeSuggestions([], [], [], context).find((s) => s.kind === "relation-block")!;
  const { initial } = widgetForSuggestion(suggestion, "w-master");
  expect(initial?.sourceConfig?.projectId).toBe("p-sessions");
  const linked = (initial!.config as { linkedSelection: LinkedSelectionConfig }).linkedSelection;

  expect(validateLegacyLinkedSelection(linked, "p-sessions", "p-clients", sessions.fields).status).toBe("valid");

  const picked: SelectionState = { source: dataTableSourceId("w-master"), field: "name", values: ["Alice"], op: "is" } as SelectionState;
  const [cond] = composeEffectiveFilter({ userFilters: [], selection: picked, myWidgetId: "w-new", linkedSelection: linked, validationResult: "valid" });
  expect(filterByLinkedSelection(sessions.records, cond!, sessions.fields).map((r) => r.id)).toEqual(["Сеансы/Сеанс 1.md"]);
});
