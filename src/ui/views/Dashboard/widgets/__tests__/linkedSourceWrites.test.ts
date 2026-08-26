// #139 — an external-source block must not write to the parent project.
//
// A `database-call` block with its own sourceConfig.projectId reads project B
// but is handed project A's `api` and `project` by the registry. "Add first
// record" therefore created the note in A, and row edits went through A's api,
// while the user was looking at B's records. Found by cross-model review at
// Gate 0 on the linked-source design.
//
// These are structural assertions rather than a render test: importing
// widgetComponentRegistry pulls in the whole Svelte component graph, which does
// not initialise under Jest. What can regress here is the wiring — the guard
// being dropped, or being conflated with the dashboard-level `readonly` flag —
// and the wiring is what is pinned.

import { readFileSync } from "fs";
import { resolve } from "path";

const WIDGETS = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(WIDGETS, rel), "utf8");

const registry = read("widgetComponentRegistry.ts");
const block = read("DatabaseCall/DatabaseCallBlock.svelte");
const host = read("WidgetHost.svelte");

describe("#139 the guard is wired from host to block", () => {
  it("the host publishes whether the block reads a foreign source", () => {
    expect(host).toMatch(/dbCallUsesLinkedSource\s*=\s*!!dbCallSourceConfig\?\.projectId/);
    expect(host).toContain("dbCallUsesLinkedSource,");
  });

  it("the registry hands that signal to the block as sourceReadOnly", () => {
    expect(registry).toMatch(/sourceReadOnly:\s*c\.dbCallUsesLinkedSource/);
  });

  it("the block declares the prop", () => {
    expect(block).toMatch(/export let sourceReadOnly: boolean/);
  });
});

describe("#139 data writes are guarded, config writes are not", () => {
  it("record creation is gated on the guard", () => {
    // handleAddFirstRecord builds the note from `project`, which is the parent's.
    expect(block).toMatch(/\{#if !readonly && !sourceReadOnly && project\}/);
  });

  it("every view component receives the combined write permission", () => {
    const combined = block.match(/readonly=\{readonly \|\| sourceReadOnly\}/g) ?? [];

    // DataTableContent, BoardView, CalendarView — each routes edits through `api`.
    expect(combined).toHaveLength(3);
  });

  it("does not force the dashboard-level readonly flag on", () => {
    // `readonly` also gates CONFIG edits — adding a view tab, editing the block
    // filter — and those legitimately belong to the parent dashboard, which is
    // where they are stored. Reusing it would break editing a linked block's
    // configuration to fix a data problem that has nothing to do with config.
    expect(registry).not.toMatch(/readonly:\s*c\.dbCallUsesLinkedSource/);
    expect(registry).not.toMatch(/readonly:\s*c\.readonly \|\| c\.dbCallUsesLinkedSource/);
  });

  it("keeps adding a view tab available on a linked-source block", () => {
    // The config affordance is gated on `readonly` alone, deliberately.
    expect(block).toMatch(/\{#if !readonly\}\s*\n\s*<button on:click=\{\(\) => addTab\("table"\)\}/);
  });
});

describe("#139 the data-table successor path stays writable", () => {
  it("data-table is not marked source-read-only — it reads the parent frame", () => {
    // data-table renders through DatabaseCallBlock too, but always on the host's
    // own transformed frame, so its writes go where its reads come from.
    const dataTableEntry = registry.slice(
      registry.indexOf('"data-table": {'),
      registry.indexOf('"database-call": {')
    );

    expect(dataTableEntry).not.toContain("sourceReadOnly");
  });
});
