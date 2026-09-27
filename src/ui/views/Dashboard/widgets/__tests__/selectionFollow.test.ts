import type { DataRecord, DataValue } from "src/lib/dataframe/dataframe";
import { EMPTY_SELECTION, dataTableSourceId, type SelectionState } from "../../canvasSelectionStore";
import { followLinkedSelection, isFollowing, linkNameKey } from "../_shared/selectionFollow";

const rec = (id: string, client: DataValue): DataRecord => ({ id, values: { client } }) as DataRecord;
const visits = [
  rec("v1.md", "[[Анна]]"),
  rec("v2.md", "[[Кабинет/Клиенты/Анна|Аня]]"),
  rec("v3.md", "[[Борис]]"),
  rec("v4.md", ["[[Борис]]", "[[анна.md]]"] as unknown as DataValue),
  rec("v5.md", null as unknown as DataValue),
];
const picked = (source: string, ...values: string[]): SelectionState =>
  ({ source, field: "name", values, op: values.length > 1 ? "is-any-of" : "is" }) as SelectionState;
const linked = { sourceWidgetId: "clients", relationField: "client" };

describe("linkNameKey", () => {
  test.each([
    ["[[Анна]]", "анна"],
    ["[[Кабинет/Клиенты/Анна|Аня]]", "анна"],
    ["Анна.md", "анна"],
    ["[[Анна#Заметки]]", "анна"],
  ])("%s → %s", (link, key) => expect(linkNameKey(link)).toBe(key));
});

describe("followLinkedSelection", () => {
  test("picking a client in the master table keeps that client's visits, however they link", () => {
    const out = followLinkedSelection(visits, picked(dataTableSourceId("clients"), "Анна"), linked);
    expect(out.map((r) => r.id)).toEqual(["v1.md", "v2.md", "v4.md"]);
  });

  test("several picked clients keep the visits of any of them", () => {
    const out = followLinkedSelection(visits, picked(dataTableSourceId("clients"), "Анна", "Борис"), linked);
    expect(out.map((r) => r.id)).toEqual(["v1.md", "v2.md", "v3.md", "v4.md"]);
  });

  test("a selection from another block leaves the records as they are", () => {
    expect(followLinkedSelection(visits, picked(dataTableSourceId("other"), "Анна"), linked)).toBe(visits);
  });

  test("no selection, or no link configured: unchanged", () => {
    expect(followLinkedSelection(visits, EMPTY_SELECTION, linked)).toBe(visits);
    expect(followLinkedSelection(visits, picked(dataTableSourceId("clients"), "Анна"), undefined)).toBe(visits);
    expect(isFollowing(picked(dataTableSourceId("clients"), "Анна"), { sourceWidgetId: "clients", relationField: "" })).toBe(false);
  });
});
