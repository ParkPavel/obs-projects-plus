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
// #169: the context literal moved out of the host into `renderContext.ts`.
// The guard is unchanged — the host still resolves the source, the context
// still publishes the flag — so the test follows the wiring to where it lives.
const context = read("renderContext.ts");
// #184: the frame math itself moved on to `hostFrames.ts` — the host was one
// line from its ceiling. Same rule as above: the guard did not move, its
// address did, so the assertions read the file that now holds the arithmetic
// while the ones about MARKUP keep reading the host.
const frames = read("hostFrames.ts");

describe("#139 the guard is wired from host to block", () => {
  it("the host publishes whether the block reads a foreign source", () => {
    // #136 folded the five dbCall reactive statements into one derived view, so
    // isExternal and frame cannot be updated out of step with each other.
    expect(frames).toMatch(/const dbCall = resolveDbCallView\(/);
    // …and the host still asks for it, so the move cannot orphan the guard.
    expect(host).toMatch(/computeHostFrames\(\{/);
    expect(context).toMatch(/dbCallUsesLinkedSource:\s*dbCall\.isExternal/);
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

    // DataTableContent, BoardView, CalendarView, GalleryView — each routes
    // edits through `api`. Gallery was missed by #139 and added by #142; the
    // count is asserted so a fifth view type cannot be added silently.
    expect(combined).toHaveLength(4);
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

// #142 — #139 guarded three of the four view branches. The gallery branch had
// no `readonly` prop at all, so an external-source gallery kept its `+`, and
// that button builds the note from the PARENT `project`. Same defect as #139,
// one component further down the same `{#if}` chain.
describe("#142/#C4 the gallery branch is guarded too", () => {
  const gallery = readFileSync(
    resolve(WIDGETS, "../../Gallery/GalleryView.svelte"),
    "utf8"
  );

  it("the gallery declares both props, each defaulting to writable", () => {
    // Default false: the standalone gallery view passes neither and must keep
    // behaving exactly as before.
    expect(gallery).toMatch(/export let readonly = false;/);
    expect(gallery).toMatch(/export let dataReadOnly = false;/);
  });

  it("record creation is gated on the generic flag, unchanged since #142", () => {
    expect(gallery).toMatch(/\{#if !readonly\}\s*\n\s*<IconButton\s*\n\s*icon="plus"/);
  });

  it("the edit modal keys on dataReadOnly, not the generic flag — #C4", () => {
    // #142 keyed this on `readonly` alone, which also silenced editing on a
    // STANDALONE gallery over a Dataview project (DataSource.readonly() is
    // always true there). Moving the guard to a prop only DatabaseCallBlock
    // sets restores that standalone editing while keeping the external-block
    // guarantee: viewing stays available, only the editor whose writes would
    // land in the wrong project is withheld.
    expect(gallery).toMatch(
      /if \(dataReadOnly\) \{[\s\S]*?openRecord\(\{ id: record\.id \}, PLAIN_MODE[\s\S]*?return;/
    );
    expect(gallery).not.toMatch(
      /if \(readonly\) \{[\s\S]*?openRecord\(\{ id: record\.id \}, PLAIN_MODE/
    );
  });

  it("the block hands the gallery the same combined readonly as the others, plus dataReadOnly", () => {
    expect(block).toMatch(/<GalleryView[\s\S]*?readonly=\{readonly \|\| sourceReadOnly\}[\s\S]*?dataReadOnly=\{sourceReadOnly\}/);
  });
});

// #C4 — Board and Calendar never checked `readonly` for editing, checking off
// or reordering a card/event; #139 handed them `readonly || sourceReadOnly`
// on the assumption they treated it the way Table does, and 5a60412's own
// commit message says so without a render test to check it. They did not:
// EditNoteModal, the checkbox and every drag path opened regardless. A
// SEPARATE prop, set only here, is what actually closes those paths without
// changing what `readonly` means for every other Board/Calendar in the vault.
describe("#C4 Board and Calendar consume the guard, not just receive it", () => {
  const boardView = readFileSync(
    resolve(WIDGETS, "../../Board/BoardView.svelte"),
    "utf8"
  );
  const calendarView = readFileSync(
    resolve(WIDGETS, "../../Calendar/CalendarView.svelte"),
    "utf8"
  );

  it("the block hands both a combined readonly and the separate dataReadOnly", () => {
    expect(block).toMatch(/<BoardView[\s\S]*?readonly=\{readonly \|\| sourceReadOnly\}[\s\S]*?dataReadOnly=\{sourceReadOnly\}/);
    expect(block).toMatch(/<CalendarView[\s\S]*?readonly=\{readonly \|\| sourceReadOnly\}[\s\S]*?dataReadOnly=\{sourceReadOnly\}/);
  });

  it("Board declares the prop and guards click, check and drag-update", () => {
    expect(boardView).toMatch(/export let dataReadOnly: boolean = false;/);
    expect(boardView).toMatch(/if \(dataReadOnly\) \{[\s\S]*?openRecord\(\{ id: record\.id \}, PLAIN_MODE/);
  });

  it("Calendar declares the prop and guards click, check and drag-change", () => {
    expect(calendarView).toMatch(/export let dataReadOnly: boolean = false;/);
    expect(calendarView).toMatch(/if \(dataReadOnly\) \{[\s\S]*?openRecord\(\{ id: entry\.id \}, PLAIN_MODE/);
  });

  it("Calendar's infinite views lose onRecordChange/onRecordAdd, not just gain a Notice", () => {
    // :1609's Notice guard predates this fix and stays — it is the CREATE
    // path, gated by the generic `readonly` as it always was. The drag-move
    // and quick-add callbacks are a different door, and #C4's fix is that the
    // children stop being handed a function to call at all.
    expect(calendarView).toMatch(/onRecordChange=\{dataReadOnly \? undefined : handleRecordChange\}/);
    expect(calendarView).toMatch(/onRecordAdd=\{dataReadOnly \? undefined : handleRecordAdd\}/);
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
    expect(frames).toMatch(
      /pipelineSource: dbCall\.isExternal \? dbCall\.frame : scope\.frame/
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
