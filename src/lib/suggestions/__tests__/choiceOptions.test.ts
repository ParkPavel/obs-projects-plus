import { DataFieldType } from "src/lib/dataframe/dataframe";
import { choiceValueAllowed, configuredChoiceOptions } from "../choiceOptions";

it("keeps the exact canonical spelling, whitespace and case of declared choices", () => {
  const field = { type: DataFieldType.Select, typeConfig: { options: [" Ready ", "Ready", "READY", "Ёлка", "Елка", "Ready"] } };
  expect(configuredChoiceOptions(field)).toEqual([" Ready ", "Ready", "READY", "Ёлка", "Елка"]);
  expect(choiceValueAllowed(field, "ready")).toBe(false); expect(choiceValueAllowed(field, " Ready ")).toBe(true);
});
it("distinguishes an absent choice schema from an explicit empty one", () => {
  expect(configuredChoiceOptions({ type: DataFieldType.Select, typeConfig: {} })).toBeNull();
  const empty = { type: DataFieldType.Select, typeConfig: { options: [] } };
  expect(configuredChoiceOptions(empty)).toEqual([]); expect(choiceValueAllowed(empty, "Legacy")).toBe(false);
  for (const value of [null, undefined, ""]) expect(choiceValueAllowed(empty, value)).toBe(true);
  for (const value of [0, false, [], {}]) expect(choiceValueAllowed(empty, value)).toBe(false);
});
it("does not restrict a free text field with suggestions", () => {
  const field = { type: DataFieldType.String, typeConfig: { options: ["Ready"] } };
  expect(configuredChoiceOptions(field)).toBeNull(); expect(choiceValueAllowed(field, "Other")).toBe(true);
});
it("reads legacy colored option names without using their labels for unrelated fields", () => {
  const config = { options: [{ name: "Exact", color: "#abcdef" }, null, 4] } as never;
  expect(configuredChoiceOptions({ type: DataFieldType.Select, typeConfig: config })).toEqual(["Exact"]);
  expect(configuredChoiceOptions({ type: DataFieldType.Status, typeConfig: { groups: [{ name: "Old", color: "#abcdef" }] } as never })).toEqual(["Old"]);
});
it("reads declared semantic statuses but treats explicit options as authoritative", () => {
  const statusGroups = { todo: ["Open"], inProgress: ["Blocked"], complete: ["Done", "Open"] };
  expect(configuredChoiceOptions({ type: DataFieldType.Status, typeConfig: { statusGroups } })).toEqual(["Open", "Blocked", "Done"]);
  expect(configuredChoiceOptions({ type: DataFieldType.Status, typeConfig: { options: [], statusGroups } })).toEqual([]);
});
it("never expands an invalid declared schema to arbitrary observed values", () => {
  expect(configuredChoiceOptions({ type: DataFieldType.Select, typeConfig: { options: null } as never })).toEqual([]);
});
