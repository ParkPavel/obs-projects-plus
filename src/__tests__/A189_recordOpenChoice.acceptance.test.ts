/**
 * A189 — acceptance for #189: opening a record opens the NOTE, and looking at
 * its fields is a second, deliberate action.
 *
 * The user rejected step (b) of #168 in the visual run — "просмотр фронтматтера
 * (шапки) не есть просмотр заметки" — and chose, verbatim, «в модификатор, но
 * отдельным пунктом». So the acceptance has three halves, and a test that
 * covers two of them would pass over the actual decision:
 *
 *   1. a plain activation opens the note again;
 *   2. the peek is one modifier away;
 *   3. the peek is also a labelled row-menu entry, because a modifier that
 *      nothing on screen mentions is not discoverable.
 *
 * A168 keeps the peek's own mechanics. This file owns which gesture reaches it.
 */

import type { App } from "obsidian";

import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
import {
  PLAIN_MODE,
  modeFromEvent,
  modeFromNewLeaf,
  openRecord,
  type RecordOpenMode,
} from "src/lib/record/openRecord";
import { recordPeek, closePeek } from "src/lib/stores/recordPeek";
import type { ContextMenuItem } from "src/lib/contextMenu";
import type { ViewApi } from "src/lib/viewApi";
import type { ProjectDefinition } from "src/settings/settings";
import { buildRowMenuEntries } from "src/ui/views/Dashboard/widgets/DatabaseCall/tableRowOps";
import { get } from "svelte/store";

/** An App that records what the workspace was asked to do. */
function spyApp() {
  const calls: Array<[string, string, unknown]> = [];
  const app = {
    workspace: {
      openLinkText: (a: string, b: string, c: unknown) => {
        calls.push([a, b, c]);
        return Promise.resolve();
      },
    },
  } as unknown as App;
  return { app, calls };
}

type Mods = Partial<Record<"shiftKey" | "ctrlKey" | "metaKey" | "altKey", boolean>>;

/** Only the modifier flags matter, and `modeFromEvent` reads nothing else. */
function ev(mods: Mods) {
  return {
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...mods,
  } as MouseEvent;
}

beforeEach(() => closePeek());

describe("A189 (1) — a plain activation opens the note", () => {
  it("PLAIN_MODE is 'same' — the revert, pinned as a value", () => {
    // The whole of #189's first part is this constant. Pinning it means a
    // future flip is a failing test rather than a behaviour nobody noticed,
    // which is the guarantee step (a) of #168 was built to provide.
    expect(PLAIN_MODE).toBe("same");
  });

  it("a plain click asks the workspace to open the note, and peeks nothing", () => {
    const { app, calls } = spyApp();
    void openRecord({ id: "Projects/Acme.md" }, modeFromEvent(ev({})), { app });
    expect(calls).toEqual([["Projects/Acme.md", "Projects/Acme.md", false]]);
    expect(get(recordPeek)).toBeNull();
  });

  it("the legacy newLeaf bridge opens the note too, so no surface is left behind", () => {
    // Board, Calendar and Gallery reach the contract through `onOpenNote`,
    // which hands over Obsidian's boolean form. If this branch had kept the
    // peek, those three views would still show the panel a plain click no
    // longer shows in the table — a partial revert, which is the worst state.
    expect(modeFromNewLeaf(false)).toBe("same");
  });
});

/**
 * All sixteen states of the four modifier flags, with the mode each must give.
 *
 * Enumerated rather than computed: deriving the expectation from the same rule
 * the implementation uses would assert that the code equals itself. Written out
 * rather than sampled, because the first version of this file called five cases
 * "every combination" and left meta+alt and ctrl+shift unmeasured — and the
 * ordering that makes alt lose to ctrl exists precisely FOR a mixed case.
 */
const MODIFIER_TABLE: ReadonlyArray<readonly [string, Mods, RecordOpenMode]> = [
  ["(none)", {}, "same"],
  ["alt", { altKey: true }, "peek"],
  ["ctrl", { ctrlKey: true }, "tab"],
  ["ctrl+alt (AltGr)", { ctrlKey: true, altKey: true }, "tab"],
  ["meta", { metaKey: true }, "tab"],
  ["meta+alt", { metaKey: true, altKey: true }, "tab"],
  ["ctrl+meta", { ctrlKey: true, metaKey: true }, "tab"],
  ["ctrl+meta+alt", { ctrlKey: true, metaKey: true, altKey: true }, "tab"],
  ["shift", { shiftKey: true }, "window"],
  ["shift+alt", { shiftKey: true, altKey: true }, "window"],
  ["shift+ctrl", { shiftKey: true, ctrlKey: true }, "window"],
  ["shift+ctrl+alt", { shiftKey: true, ctrlKey: true, altKey: true }, "window"],
  ["shift+meta", { shiftKey: true, metaKey: true }, "window"],
  ["shift+meta+alt", { shiftKey: true, metaKey: true, altKey: true }, "window"],
  ["shift+ctrl+meta", { shiftKey: true, ctrlKey: true, metaKey: true }, "window"],
  [
    "shift+ctrl+meta+alt",
    { shiftKey: true, ctrlKey: true, metaKey: true, altKey: true },
    "window",
  ],
];

describe("A189 (2) — the peek is one modifier away, and the taken ones are untouched", () => {
  it("the table really is every combination — 2^4, all distinct", () => {
    // Without this, a future edit can delete a row and the suite still reads
    // as exhaustive. That is the defect this section was sent back for.
    expect(MODIFIER_TABLE).toHaveLength(16);
    const shapes = MODIFIER_TABLE.map(([, mods]) =>
      ["shiftKey", "ctrlKey", "metaKey", "altKey"]
        .map((k) => (mods[k as keyof Mods] === true ? "1" : "0"))
        .join("")
    );
    expect(new Set(shapes).size).toBe(16);
  });

  it.each(MODIFIER_TABLE)("%s → %s", (_name, mods, expected) => {
    expect(modeFromEvent(ev(mods))).toBe(expected);
  });

  it("alt actually reaches the panel and never the workspace", () => {
    const { app, calls } = spyApp();
    void openRecord({ id: "Row.md" }, modeFromEvent(ev({ altKey: true })), { app });
    expect(get(recordPeek)).toEqual({ id: "Row.md" });
    expect(calls).toEqual([]);
  });

  it("alt is the ONLY combination that peeks — it did not leak into the others", () => {
    // The table above says what each combination gives; this says the peek is
    // scarce. A branch placed one line too early would satisfy the first and
    // fail here, because ctrl+alt and shift+alt would start peeking too.
    const peeking = MODIFIER_TABLE.filter(([, mods]) => modeFromEvent(ev(mods)) === "peek");
    expect(peeking.map(([name]) => name)).toEqual(["alt"]);
  });

  it("the alt modifier is read where the row is activated, not only where it is defined", () => {
    // A modifier the contract understands but no surface forwards is dead. The
    // table row hands its MouseEvent to the orchestrator, which is the only
    // place allowed to turn it into a mode.
    const row = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ui/views/Dashboard/widgets/DatabaseCall/TableRow.svelte"),
      "utf8"
    ) as string;
    const content = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte"),
      "utf8"
    ) as string;
    expect(row).toMatch(/dispatch\("openRecord", \{ record, event: e \}\)/);
    expect(content).toMatch(/modeFromEvent\(e\.detail\.event\)/);
  });
});

describe("A189 (3) — the peek is a row-menu entry, so it is discoverable", () => {
  const record: DataRecord = { id: "Clients/Acme.md", values: { name: "Acme" } } as DataRecord;
  const fields: DataField[] = [
    { name: "name", type: "string", identifier: true, derived: false, repeated: false } as unknown as DataField,
  ];

  function menu(app: App | undefined, readonly = false, deleted: string[] = []) {
    return buildRowMenuEntries({
      record,
      project: { id: "p1" } as ProjectDefinition,
      fields,
      api: {
        addRecord: () => {},
        deleteRecord: (id: string) => deleted.push(id),
      } as unknown as ViewApi,
      app,
      readonly,
      t: (_k, d) => d,
      selectionEntry: { driving: false, onToggle: () => {} },
    });
  }

  const items = (entries: ReturnType<typeof menu>) =>
    entries.filter((e): e is ContextMenuItem => !("separator" in e));

  it("the entry exists and is labelled — a modifier nobody is told about is not a feature", () => {
    expect(items(menu(undefined)).map((e) => e.title)).toContain("Show fields");
  });

  it("clicking it peeks and does NOT open the note", () => {
    const { app, calls } = spyApp();
    const entry = items(menu(app)).find((e) => e.title === "Show fields");
    entry?.onClick();
    expect(calls).toEqual([]);
    expect(get(recordPeek)?.id).toBe("Clients/Acme.md");
  });

  it("it hands over the record and its fields, so an external-source row peeks into itself", () => {
    // A dashboard table can read a source whose records the host view's frame
    // never held. Resolving by id alone made those rows open an empty panel —
    // the defect the adversarial review of #168 found, and the menu entry is a
    // new call site that could have reintroduced it.
    const { app } = spyApp();
    items(menu(app)).find((e) => e.title === "Show fields")?.onClick();
    const target = get(recordPeek);
    expect(target?.record).toEqual(record);
    expect(target?.fields).toEqual(fields);
  });

  it("the neighbouring 'Open note' entry still opens the note", () => {
    // Both entrances in one menu is the shape the user asked for; this proves
    // they do different things rather than both landing on the same mode.
    const { app, calls } = spyApp();
    items(menu(app)).find((e) => e.title === "Open note")?.onClick();
    expect(calls).toEqual([["Clients/Acme.md", "Clients/Acme.md", false]]);
    expect(get(recordPeek)).toBeNull();
  });
});

describe("A189 (4) — a READ-ONLY row keeps the reading entries and loses the writing ones", () => {
  // The audit's P1. A read-only `database-call` table is the case the peek was
  // written for — its rows come from a source the host frame never held — and
  // it was the one case where the discoverable entrance did not exist, because
  // the button that opens the menu was hidden wholesale.
  const record: DataRecord = { id: "External/Row.md", values: { name: "Row" } } as DataRecord;
  const fields: DataField[] = [
    { name: "name", type: "string", identifier: true, derived: false, repeated: false } as unknown as DataField,
  ];

  function menu(readonly: boolean, deleted: string[] = []) {
    return buildRowMenuEntries({
      record,
      project: { id: "p1" } as ProjectDefinition,
      fields,
      api: {
        addRecord: () => {},
        deleteRecord: (id: string) => deleted.push(id),
      } as unknown as ViewApi,
      app: spyApp().app,
      readonly,
      t: (_k, d) => d,
      selectionEntry: { driving: false, onToggle: () => {} },
    });
  }

  const titles = (readonly: boolean) =>
    menu(readonly)
      .filter((e): e is ContextMenuItem => !("separator" in e))
      .map((e) => e.title);

  it("the three reading entries survive", () => {
    expect(titles(true)).toEqual(
      expect.arrayContaining(["Open note", "Open in new tab", "Show fields"])
    );
  });

  it("Delete and Duplicate are ABSENT, not merely disabled", () => {
    // Greying them out would still tell the reader this row is deletable,
    // which is the thing that is not true on a source they cannot write to.
    expect(titles(true)).not.toContain("Delete note");
    expect(titles(true)).not.toContain("Duplicate");
    expect(titles(false)).toContain("Delete note");
    expect(titles(false)).toContain("Duplicate");
  });

  it("no read-only entry can reach the delete API even if one were clicked", () => {
    // The titles could be right while a handler survived behind one of them.
    const deleted: string[] = [];
    for (const entry of menu(true)) {
      if (!("separator" in entry)) entry.onClick();
    }
    expect(deleted).toEqual([]);
  });

  it("the canvas filter stays — it writes to a store, never to the vault", () => {
    // Kept deliberately: the Selection Bus is per-canvas in-memory view state,
    // so filtering linked blocks by a row is a way of READING the canvas, and
    // it is most useful on exactly the borrowed source a reader cannot edit.
    expect(titles(true)).toContain("Filter linked blocks by this row");
  });

  it("the menu does not end on a separator with nothing under it", () => {
    const entries = menu(true);
    expect(entries[entries.length - 1]).not.toHaveProperty("separator");
  });

  it("the row shows the menu button when readonly — the entry is worthless unopenable", () => {
    // The defect was here and not in the builder: `{#if !readonly}` around the
    // ⋯ button meant a read-only row had no menu at all, so `alt` was the only
    // way in — the hidden-feature outcome the user's decision rules out.
    const row = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ui/views/Dashboard/widgets/DatabaseCall/TableRow.svelte"),
      "utf8"
    ) as string;
    expect(row).toMatch(/dispatch\("rowMenu", \{ record, event: e \}\)/);
    expect(row).not.toMatch(/\{#if !readonly\}/);
  });

  it("the component hands the flag over instead of filtering the list itself", () => {
    // One judgement about what is safe, in one place. If the component started
    // filtering too, the two copies would drift and only one would be tested.
    //
    // Anchored to the argument LIST, not to the call plus anything after it: a
    // lazy `[\s\S]*?` between the call and `readonly` passes on the very code
    // this test exists to reject, because the component mentions `readonly`
    // several more times further down the file. It did, and it passed, and the
    // red-first run is the only reason that was caught.
    const content = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte"),
      "utf8"
    ) as string;
    const args = /buildRowMenuEntries\(\{([^}]*)/.exec(content)?.[1] ?? "";
    expect(args).toMatch(/\breadonly\b/);
  });
});
