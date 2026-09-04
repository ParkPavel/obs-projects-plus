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

/** Only the modifier flags matter, and `modeFromEvent` reads nothing else. */
function ev(mods: Partial<Record<"shiftKey" | "ctrlKey" | "metaKey" | "altKey", boolean>>) {
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

describe("A189 (2) — the peek is one modifier away, and the taken ones are untouched", () => {
  it("every combination resolves to exactly one mode", () => {
    expect(modeFromEvent(ev({}))).toBe("same");
    expect(modeFromEvent(ev({ altKey: true }))).toBe("peek");
    expect(modeFromEvent(ev({ shiftKey: true }))).toBe("window");
    expect(modeFromEvent(ev({ ctrlKey: true }))).toBe("tab");
    expect(modeFromEvent(ev({ metaKey: true }))).toBe("tab");
  });

  it("alt actually reaches the panel and never the workspace", () => {
    const { app, calls } = spyApp();
    void openRecord({ id: "Row.md" }, modeFromEvent(ev({ altKey: true })), { app });
    expect(get(recordPeek)).toEqual({ id: "Row.md" });
    expect(calls).toEqual([]);
  });

  it("shift and ctrl outrank alt — AltGr reports ctrl+alt and must still mean tab", () => {
    // The reason the alt branch is tested LAST in `modeFromEvent`. On Windows
    // and on European layouts AltGr sets ctrlKey and altKey together; if alt
    // were checked first, that keyboard would silently lose "open in a tab".
    expect(modeFromEvent(ev({ ctrlKey: true, altKey: true }))).toBe("tab");
    expect(modeFromEvent(ev({ shiftKey: true, altKey: true }))).toBe("window");
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

  function menu(app: App | undefined) {
    return buildRowMenuEntries({
      record,
      project: { id: "p1" } as ProjectDefinition,
      fields,
      api: { addRecord: () => {}, deleteRecord: () => {} } as unknown as ViewApi,
      app,
      t: (_k, d) => d,
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
