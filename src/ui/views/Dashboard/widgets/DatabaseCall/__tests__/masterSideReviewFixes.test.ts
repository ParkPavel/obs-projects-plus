/**
 * Codex review of 0ebea59 (F3b, master-side linked block), three P2:
 * - the relation's configured displayField was ignored, so a link by a
 *   display name other than name/title reached nothing;
 * - links were resolved among the block's already-filtered records, so an
 *   explicit link to a filtered-out note fell back by basename onto an
 *   unrelated one;
 * - the settings offered the receiving project's fields for a master-side
 *   link, which lives in the master's frame.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { DataFieldType, type DataFrame, type DataValue } from "src/lib/dataframe/dataframe";
import { filterByMasterSide } from "../masterSideFilter";

const f = (name: string, type = DataFieldType.String, typeConfig?: unknown) =>
  ({ name, type, repeated: false, identifier: false, derived: false, ...(typeConfig ? { typeConfig } : {}) });

function frame(fields: ReturnType<typeof f>[], rows: Array<[string, Record<string, DataValue>]>): DataFrame {
  return { fields, records: rows.map(([id, values]) => ({ id, values })) } as unknown as DataFrame;
}

test("a link by the relation's own display field reaches its target", () => {
  const clients = frame([f("fullName")], [["Clients/c1.md", { fullName: "Alice Smith" }]]);
  const sessions = frame(
    [f("client", DataFieldType.Relation, { relation: { targetProjectId: "clients", displayField: "fullName" } })],
    [["Sessions/s1.md", { client: "[[Alice Smith]]" }]]
  );
  expect(filterByMasterSide(clients, clients.records, sessions, ["s1"], "client").map((r) => r.id)).toEqual(["Clients/c1.md"]);
});

test("a link to a filtered-out note reaches nothing, not a namesake", () => {
  const clients = frame([f("name")], [["Clients/A/Alice.md", { name: "Alice" }], ["Clients/B/Alice.md", { name: "Alice" }]]);
  const visible = clients.records.filter((r) => r.id.startsWith("Clients/B/"));
  const sessions = frame([f("client", DataFieldType.Relation)], [["Sessions/s1.md", { client: "[[Clients/A/Alice]]" }]]);
  expect(filterByMasterSide(clients, visible, sessions, ["s1"], "client")).toEqual([]);
});

test("the settings offer the master's relation fields for a master-side link", () => {
  const dir = resolve(__dirname, "..");
  const settings = readFileSync(resolve(dir, "DatabaseCallSettings.svelte"), "utf8");
  expect(settings).toMatch(/export let masterFields: DataField\[\] = \[\];/);
  expect(settings).toMatch(/linkedSelection\?\.relationSide === "master" \? masterFields : fields/);
  const host = readFileSync(resolve(dir, "../WidgetHost.svelte"), "utf8");
  expect(host).toMatch(/masterFields=\{ctx\.frame\.fields\}/);
});

// Codex recheck of 4a971d7: a block reading its own project gets a frame the
// host already scoped by the block's filter, so "the whole source" was still
// filtered there. The registry hands such a block the host's frame from
// before its filter; an external block resolves over its own unscoped frame.
test("a same-project block resolves over the host frame before its filter", () => {
  const registry = readFileSync(resolve(__dirname, "../../widgetComponentRegistry.ts"), "utf8");
  expect(registry).toMatch(/masterUniverse: c\.dbCallSource\.kind === "parent" \? c\.frame : undefined/);
  const block = readFileSync(resolve(__dirname, "../DatabaseCallBlock.svelte"), "utf8");
  expect(block).toMatch(/export let masterUniverse: DataFrame \| undefined = undefined;/);
  expect(block).toMatch(/filterByMasterSide\(masterUniverse \?\? frame, subFiltered\.records,/);
});
