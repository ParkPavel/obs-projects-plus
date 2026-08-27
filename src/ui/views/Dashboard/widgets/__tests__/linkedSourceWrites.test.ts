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
    // #136 folded the five dbCall reactive statements into one derived view, so
    // isExternal and frame cannot be updated out of step with each other.
    expect(host).toMatch(/\$:\s*dbCall = resolveDbCallView\(/);
    expect(host).toMatch(/dbCallUsesLinkedSource:\s*dbCall\.isExternal/);
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

// #137 — the editor is configured against the block's own source.
//
// It used to receive fields={frame.fields} and source={frame} unconditionally:
// the PARENT project's schema and sample data, even for a block reading a
// different project. A user could build a step on a field the block's own
// source does not have.
describe("#137 the pipeline editor reads the block's own source", () => {
  const editor = read("PipelineEditor.svelte");

  it("the host derives the pipeline's real input rather than passing the raw frame", () => {
    expect(host).toMatch(
      /\$:\s*pipelineSource = dbCall\.isExternal \? dbCall\.frame : scope\.frame/
    );
  });

  it("the editor is handed that input, not the parent frame", () => {
    expect(host).toMatch(/fields=\{pipelineSource\.fields\}/);
    expect(host).toMatch(/source=\{pipelineSource\}/);
    expect(host).not.toMatch(/source=\{frame\}/);
  });

  it("live counters execute with the same right-frames the runtime uses", () => {
    // Without them a `join` preview resolves no right frame and reports
    // different numbers than the widget behind the popup.
    expect(host).toMatch(/<PipelineEditor[\s\S]*?\{rightFrames\}/);
    expect(editor).toMatch(/executeTransform\(frame, \{ steps: steps\.slice\(0, i \+ 1\) \}, \{ rightFrames \}\)/);
  });

  it("the editor says so when there is no schema to configure against", () => {
    expect(editor).toMatch(/sourceState\.kind !== "parent" && sourceState\.kind !== "ready"/);
    expect(editor).toContain("views.dashboard.pipeline.source-not-ready");
  });
});
