/**
 * A168 — acceptance for #168: the peek panel works.
 *
 * **Rescoped by #189 on 2026-09-04, and the rescope is the point.** This file
 * was written for step (b) — "a plain click stops leaving the view" — and the
 * user rejected that default in the visual run. What step (b) got wrong was
 * WHICH gesture opens the peek, not the peek. So every mechanic below still
 * holds and is still asserted; the only thing removed is the claim that the
 * peek is what an unmodified activation does. That claim, inverted, now lives
 * in `A189_recordOpenChoice.acceptance.test.ts` along with the two entrances
 * the peek was given instead.
 *
 * The tests therefore ask for `"peek"` by name where they used to ask for it by
 * default. That is a weaker premise and the same coverage: the store still has
 * one value, a surface with its own panel is still preferred over it, and a row
 * from an external source still peeks into the record it was handed.
 *
 * The claim is behavioural, not visual, so most of it is answered without a
 * browser. The one thing a browser is needed for is whether the peek panel
 * keeps the keyboard, and that is A169's subject.
 */

import type { App } from "obsidian";

import {
  PLAIN_MODE,
  modeFromEvent,
  modeFromNewLeaf,
  openRecord,
} from "src/lib/record/openRecord";
import { recordPeek, closePeek } from "src/lib/stores/recordPeek";
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

beforeEach(() => closePeek());

describe("A168 — a peek opens the panel and does not navigate", () => {
  it("the peek mode peeks and the workspace is never asked to open anything", () => {
    const { app, calls } = spyApp();
    void openRecord({ id: "Projects/Acme.md" }, "peek", { app });
    expect(get(recordPeek)).toEqual({ id: "Projects/Acme.md" });
    expect(calls).toEqual([]);
  });

  it("ctrl still opens a tab and shift still opens a window — nothing became unreachable", () => {
    const { app, calls } = spyApp();
    const ctrl = { ctrlKey: true, metaKey: false, shiftKey: false } as MouseEvent;
    const shift = { ctrlKey: false, metaKey: false, shiftKey: true } as MouseEvent;
    expect(modeFromEvent(ctrl)).toBe("tab");
    expect(modeFromEvent(shift)).toBe("window");
    void openRecord({ id: "a.md" }, modeFromEvent(ctrl), { app });
    void openRecord({ id: "b.md" }, modeFromEvent(shift), { app });
    expect(calls).toEqual([
      ["a.md", "a.md", "tab"],
      ["b.md", "b.md", "window"],
    ]);
    expect(get(recordPeek)).toBeNull();
  });

  it("a surface with its own panel is asked instead of the store", () => {
    const { app, calls } = spyApp();
    const seen: string[] = [];
    void openRecord({ id: "own.md" }, "peek", { app, peek: (t) => seen.push(t.id) });
    expect(seen).toEqual(["own.md"]);
    expect(get(recordPeek)).toBeNull();
    expect(calls).toEqual([]);
  });

  it("opening a second record replaces the first — one peek, by construction", () => {
    const { app } = spyApp();
    void openRecord({ id: "first.md" }, "peek", { app });
    void openRecord({ id: "second.md" }, "peek", { app });
    expect(get(recordPeek)).toEqual({ id: "second.md" });
  });

  it("a caller that has the record hands it over, so a row from an external source can be peeked", () => {
    // The adversarial review's sharpest finding: a dashboard table widget can
    // read a source whose records are not in the host view's frame at all, so
    // resolving by id alone left those rows opening NOTHING — a click with no
    // result, which is worse than the navigation it replaced.
    const { app } = spyApp();
    const record = { id: "External/Row.md", values: { name: "Row" } };
    const fields = [
      { name: "name", type: "string", identifier: true, derived: false, repeated: false, typeConfig: {} },
    ];
    void openRecord(
      { id: record.id, record, fields } as never,
      "peek",
      { app }
    );
    const target = get(recordPeek);
    expect(target?.record).toEqual(record);
    expect(target?.fields).toEqual(fields);
  });

  it("the legacy newLeaf bridge follows PLAIN_MODE, so no call site is left behind", () => {
    // `false` is Obsidian's "open here". Every site that still receives the
    // boolean form -- EditNote's onOpenNote -- must agree with the default, or
    // a row would behave differently depending on which callback carried it.
    // #189 moved that default back to "same"; this assertion tracks it rather
    // than restating it, because a bridge that DISAGREES is the actual defect.
    expect(modeFromNewLeaf(false)).toBe(PLAIN_MODE);
    expect(modeFromNewLeaf(true)).toBe("tab");
    expect(modeFromNewLeaf("window")).toBe("window");
  });
});

describe("A168 — scene 3: the record says which frontmatter keys it writes", () => {
  const source = () =>
    require("fs").readFileSync(
      require("path").join(__dirname, "..", "ui/components/RecordCardView/RecordCardView.svelte"),
      "utf8"
    ) as string;

  it("only the fields that really become keys are listed", () => {
    // `dataApi` skips derived fields when it writes, so a formula column, a
    // rollup and a relation's `__resolved__…` companion have names that are
    // NOT frontmatter keys. Listing them would make the panel lie about the
    // file — the adversarial review of step (b) found exactly that.
    const s = source();
    expect(s).toMatch(/writtenFields = fields\.filter\(\(f\) => !f\.derived\)/);
    expect(s).toMatch(/\{#each writtenFields as field \(field\.name\)\}/);
  });

  it("the peek lists each field name as the key it is", () => {
    // The scene's readiness criterion is that inspecting a record shows the
    // frontmatter key. `dataApi` writes `frontmatter[field.name]`, so the name
    // IS the key; the panel says so where the record already is.
    const s = source();
    expect(s).toMatch(/ppp-rcv-frontmatter/);
    expect(s).toMatch(/<dt>\{field\.name\}<\/dt>/);
  });

  it("an absent key reads as absent rather than as an empty value", () => {
    const s = source();
    expect(s).toMatch(/if \(v === undefined \|\| v === null\) return "—";/);
  });
});

describe("A168 — closing the peek does not throw away what was typed", () => {
  it("the editor flushes a pending save instead of cancelling it", () => {
    // EditNote debounces text edits by 300ms and used to CANCEL the timer on
    // destroy. In a modal that was invisible, because a modal is dismissed
    // deliberately; in a peek — a surface that looks like a preview and is
    // closed casually — typing and closing inside that window lost the edit.
    // Asserted on the source because the alternative is mounting Svelte with a
    // fake vault to watch a timer, which would test the harness.
    const s = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ui/modals/components/EditNote.svelte"),
      "utf8"
    ) as string;
    const onDestroy = /onDestroy\(\(\) => \{([\s\S]*?)\n {2}\}\);/.exec(s)?.[1] ?? "";
    expect(onDestroy).toContain("performSave()");
    expect(onDestroy).toMatch(/clearTimeout\(saveTimer\)/);
  });
});

describe("A168 — a target this view cannot show never becomes a click that did nothing", () => {
  it("the view falls back to opening the note when the record cannot be resolved", () => {
    // Filtered out, renamed, deleted, or from a frame this view never had: the
    // honest answer is the behaviour the peek replaced, not a panel that stays
    // shut.
    const s = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ui/app/View.svelte"),
      "utf8"
    ) as string;
    expect(s).toMatch(/\$: if \(\$recordPeek !== null && peeked === null\)/);
    expect(s).toMatch(/openRecord\(\{ id: unresolved\.id \}, "same"/);
  });
});

describe("A168 step (c) — a link that did not resolve says so", () => {
  const source = () =>
    require("fs").readFileSync(
      require("path").join(__dirname, "..", "ui/components/RecordCardView/RecordCardView.svelte"),
      "utf8"
    ) as string;

  it("the peek compares the raw links with the resolved companion", () => {
    // #151 stayed open because marking an unresolved link in a TABLE CELL
    // needs the target frame in the cell, and it is not there. The peek shows
    // the ENRICHED record, so `__resolved__<field>` is already beside the raw
    // wikilinks — the difference between them is the answer, with no new data
    // path and no second resolution.
    const s = source();
    expect(s).toMatch(/normalizeRelationValue\(record\.values\[f\.name\]\)/);
    expect(s).toMatch(/record\.values\[`__resolved__\$\{f\.name\}`\]/);
  });

  it("only the broken links are named, not every working one", () => {
    // A tick beside every resolved link is noise; the one line about the one
    // that is broken is what scene 4 asks for.
    const s = source();
    expect(s).toMatch(/linkStates\(rf\)\.filter\(\(st\) => !st\.resolved\)/);
    expect(s).toMatch(/\{#if broken\.length > 0\}/);
  });

  it("matching is by path and by basename, the two keys the contract indexes on", () => {
    const s = source();
    expect(s).toMatch(/keys\.has\(bare\.toLowerCase\(\)\) \|\| keys\.has\(base\.toLowerCase\(\)\)/);
  });
});
