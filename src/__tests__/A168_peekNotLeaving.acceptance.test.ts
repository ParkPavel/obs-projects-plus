/**
 * A168 — acceptance for #168 step (b): a plain click stops leaving the view.
 *
 * The claim is behavioural, not visual, so most of it is answered without a
 * browser: what does a plain activation DO. The one thing a browser is needed
 * for is whether the peek panel keeps the keyboard, and that is A169's subject
 * — the two tickets meet there deliberately, which is why (b) was blocked on
 * (a11y) rather than shipped beside it.
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

describe("A168 — a plain activation opens the peek and does not navigate", () => {
  it("PLAIN_MODE is the peek, which is the whole of step (b)", () => {
    // Pinned as a value, so a revert is a visible one-line diff here too and
    // not a silent behaviour change nobody's test noticed.
    expect(PLAIN_MODE).toBe("peek");
  });

  it("a plain click peeks and the workspace is never asked to open anything", () => {
    const { app, calls } = spyApp();
    void openRecord({ id: "Projects/Acme.md" }, PLAIN_MODE, { app });
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
    void openRecord({ id: "own.md" }, PLAIN_MODE, { app, peek: (t) => seen.push(t.id) });
    expect(seen).toEqual(["own.md"]);
    expect(get(recordPeek)).toBeNull();
    expect(calls).toEqual([]);
  });

  it("opening a second record replaces the first — one peek, by construction", () => {
    const { app } = spyApp();
    void openRecord({ id: "first.md" }, PLAIN_MODE, { app });
    void openRecord({ id: "second.md" }, PLAIN_MODE, { app });
    expect(get(recordPeek)).toEqual({ id: "second.md" });
  });

  it("the legacy newLeaf bridge follows PLAIN_MODE too, so no call site is left behind", () => {
    // `false` is Obsidian's "open here". Every site that still receives the
    // boolean form -- EditNote's onOpenNote -- must peek as well, or the flip
    // would be partial and a row would behave differently depending on which
    // callback happened to carry it.
    expect(modeFromNewLeaf(false)).toBe("peek");
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

  it("the peek lists each field name as the key it is", () => {
    // The scene's readiness criterion is that inspecting a record shows the
    // frontmatter key. `dataApi` writes `frontmatter[field.name]`, so the name
    // IS the key; the panel says so where the record already is.
    const s = source();
    expect(s).toMatch(/ppp-rcv-frontmatter/);
    expect(s).toMatch(/\{#each fields as field \(field\.name\)\}/);
    expect(s).toMatch(/<dt>\{field\.name\}<\/dt>/);
  });

  it("an absent key reads as absent rather than as an empty value", () => {
    const s = source();
    expect(s).toMatch(/if \(v === undefined \|\| v === null\) return "—";/);
  });
});
