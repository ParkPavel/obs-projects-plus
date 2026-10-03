/**
 * cards-g1: board drag grips get a layout zone of their own.
 *
 * The user report (desktop, a window about 1020 wide): the card grip sat
 * absolutely over the first field label, the column grip was squeezed onto the
 * column's border above the title, and both hid until a hover that did not
 * always come. Now the card is a grid whose first lane is the grip, the column
 * grip is the first cell of its header row (a strip of its own above a
 * collapsed column), and both are visible at low contrast by default.
 *
 * jsdom does no layout, so this pins structure (rendered) and the CSS rules
 * that make the structure a layout (read from source). The rendered half also
 * drives the real grip: pointer arm and disarm, the disabled-zone gate and a
 * keyboard reorder, so drag parity is checked on the element that ships.
 */

import "@testing-library/jest-dom";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { tick } from "svelte";

import { SRC_ROOT, stripCssComments, svelteStyles } from "src/__tests__/support/cssScan";

// CardList reads two view contexts keyed by private symbols; a test cannot
// provide them through `context`, so the context helpers are stubbed.
jest.mock("src/ui/views/helpers", () => {
  const actual = jest.requireActual("src/ui/views/helpers") as Record<string, unknown>;
  return {
    ...actual,
    getRecordColorContext: { get: () => () => null, set: () => undefined },
    sortRecordsContext: { get: () => (records: unknown[]) => records, set: () => undefined },
  };
});

// ColumnHeader owns its rendered Markdown through an Obsidian `Component`
// (`markdownOwner`), which the shared obsidian mock lacks; R0_31 adds the same.
jest.mock(
  "obsidian",
  () => {
    const actual = jest.requireActual("src/__mocks__/obsidian") as Record<string, unknown>;
    class Component {
      loaded = false;
      load(): void {
        this.loaded = true;
      }
      unload(): void {
        this.loaded = false;
      }
    }
    return { ...actual, Component };
  },
  { virtual: true }
);

// ColumnHeader imports `Flair` through its barrel (`export { default as Flair }
// from "./Flair.svelte"`). Under Jest the barrel is compiled by esbuild, whose
// CommonJS interop treats a module without `__esModule` as its own default, and
// the svelte transformer's `format: "cjs"` output only sets `exports.default`:
// the re-export becomes `{ default: Flair }`, not a constructor. Svelte-to-
// Svelte imports compile to `const { default: X } = require(…)` and are
// unaffected. The barrel is bound straight to the compiled component; the
// product is unchanged (the production bundle is one ESM build).
jest.mock("src/ui/components/Flair", () => ({
  Flair: (jest.requireActual("src/ui/components/Flair/Flair.svelte") as { default: unknown }).default,
}));

type Mounted = { $destroy(): void };
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const BOARD_DIR = resolve(__dirname, "..");
const read = (file: string): string => readFileSync(join(BOARD_DIR, file), "utf8");
const STYLES_CSS = readFileSync(join(SRC_ROOT, "..", "styles.css"), "utf8");

// ── CSS reading ──────────────────────────────────────────────────────────────

type Rule = { selector: string; body: string; at: string[] };

const normalize = (text: string): string => text.trim().replace(/\s+/g, " ");

/** Every rule in `css`, with the at-rule preludes around it (a brace walk). */
function readRules(css: string): Rule[] {
  const rules: Rule[] = [];
  const stack: { head: string; body: string }[] = [];
  let buffer = "";
  for (const ch of stripCssComments(css)) {
    if (ch === "{") {
      stack.push({ head: normalize(buffer), body: "" });
      buffer = "";
    } else if (ch === "}") {
      const closed = stack.pop();
      if (closed && !closed.head.startsWith("@")) {
        rules.push({
          selector: closed.head,
          body: closed.body + buffer,
          at: stack.map((s) => s.head).filter((h) => h.startsWith("@")),
        });
      }
      buffer = "";
    } else if (ch === ";") {
      const top = stack[stack.length - 1];
      if (top && !top.head.startsWith("@")) top.body += buffer + ";";
      buffer = "";
    } else {
      buffer += ch;
    }
  }
  return rules;
}

/** `name: value` pairs of a declaration body. */
function decls(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const decl of body.split(";")) {
    const at = decl.indexOf(":");
    if (at === -1) continue;
    out.set(decl.slice(0, at).trim().toLowerCase(), normalize(decl.slice(at + 1)));
  }
  return out;
}

const selectorsOf = (rule: Rule): string[] => rule.selector.split(",").map(normalize);
const isFineHoverGate = (at: string): boolean =>
  /^@media\b/.test(at) && /\(\s*hover\s*:\s*hover\s*\)/.test(at) && /\(\s*pointer\s*:\s*fine\s*\)/.test(at);
const isCoarse = (at: string): boolean => /^@media\s*\(\s*pointer\s*:\s*coarse\s*\)$/.test(at);

const cardRules = readRules(svelteStyles(read("CardList.svelte")));
const boardRules = readRules(svelteStyles(read("Board.svelte")));
const headerRules = readRules(svelteStyles(read("ColumnHeader.svelte")));
const globalRules = readRules(STYLES_CSS);

/** The declarations of the ungated (no at-rule) rule naming exactly `selector`. */
function plain(rules: Rule[], selector: string): Map<string, string> {
  const rule = rules.find((r) => r.at.length === 0 && selectorsOf(r).includes(selector));
  return decls(rule?.body ?? "");
}

describe("cards-g1 — the card grip has its own lane (CSS)", () => {
  it("the card is a grid: a grip lane, then a shrinkable content lane", () => {
    const card = plain(cardRules, ".projects--board--card");
    expect(card.get("display")).toBe("grid");
    expect(card.get("grid-template-columns")).toMatch(
      /^var\(--board-card-grip-lane, var\(--size-4-\d\)\) minmax\(0, 1fr\)$/
    );
    // The lane starts at the card border: the card's own left padding is the lane.
    expect(card.get("padding-left")).toBe("0");
  });

  it("the grip is in flow in the first lane, never absolutely placed", () => {
    const grip = plain(cardRules, ".board-card-grip");
    expect(grip.get("grid-column")).toBe("1");
    const absolute = [...cardRules, ...boardRules]
      .filter((r) => /board-(card|column)-grip/.test(r.selector))
      .filter((r) => decls(r.body).get("position") === "absolute")
      .map((r) => r.selector);
    expect(absolute).toEqual([]);
    // The old invisible finger box reached over the content; the lane replaced it.
    expect(cardRules.some((r) => r.selector.includes(".board-card-grip::before"))).toBe(false);
  });

  it("the glyph box is narrower than the lane it sits in", () => {
    // Lane `--size-4-5` (or `--size-4-4` in a narrow pane), glyph box `--size-4-4`.
    expect(plain(cardRules, ".board-card-grip-glyph").get("width")).toBe("var(--size-4-4)");
  });

  it("a narrow pane tightens the lane through a container query, not a viewport query", () => {
    const narrow = globalRules.find(
      (r) => r.selector === ".projects--board--card" && r.at.some((a) => a.startsWith("@container"))
    );
    expect(decls(narrow?.body ?? "").get("--board-card-grip-lane")).toBe("var(--size-4-4)");
  });

  it("coarse pointers get a full touch target lane, with no padding hack", () => {
    const coarse = cardRules.filter((r) => r.at.length === 1 && isCoarse(r.at[0] ?? ""));
    const card = coarse.find((r) => selectorsOf(r).includes(".projects--board--card"));
    expect(decls(card?.body ?? "").get("grid-template-columns")).toBe(
      "var(--ppp-touch-target-min) minmax(0, 1fr)"
    );
    const grip = coarse.find((r) => selectorsOf(r).includes(".board-card-grip"));
    expect(decls(grip?.body ?? "").get("min-height")).toBe("var(--ppp-touch-target-min)");
    expect(decls(card?.body ?? "").has("padding-left")).toBe(false);
  });
});

describe("cards-g1 — the column grip has its own cell (CSS)", () => {
  it("is a non-shrinking cell in flow, and a strip on a collapsed column", () => {
    const grip = plain(boardRules, ".board-column-grip");
    expect(grip.get("flex")).toBe("none");
    expect(grip.has("position")).toBe(false);
    expect(plain(boardRules, ".board-column-grip--strip").get("width")).toBe("100%");
  });

  it("coarse pointers get a full target cell, and the header padding hack is gone", () => {
    const coarse = boardRules.find(
      (r) => r.at.length === 1 && isCoarse(r.at[0] ?? "") && selectorsOf(r).includes(".board-column-grip")
    );
    const d = decls(coarse?.body ?? "");
    expect(d.get("width")).toBe("var(--ppp-touch-target-min)");
    expect(d.get("height")).toBe("var(--ppp-touch-target-min)");
    expect(boardRules.some((r) => r.selector.includes(".projects--board--column--header"))).toBe(false);
  });

  it("the header's actions still end the row beside a leading cell", () => {
    expect(plain(headerRules, ".right").get("margin-left")).toBe("auto");
  });
});

describe("cards-g1 — grips are revealed without hover", () => {
  const revealCases: [string, Rule[], string, string][] = [
    ["card", cardRules, ".board-card-grip", ".projects--board--card:focus-within .board-card-grip"],
    ["column", boardRules, ".board-column-grip", ".projects--board--column--dndwrapper:focus-within .board-column-grip"],
  ];
  it.each(revealCases)("the %s grip is visible at rest and full on focus", (_name, rules, grip, focusWithin) => {
    const rest = Number(plain(rules, grip).get("opacity"));
    expect(rest).toBeGreaterThan(0);
    expect(rest).toBeLessThan(1);
    const focus = rules.find(
      (r) => r.at.length === 0 && selectorsOf(r).includes(focusWithin) && selectorsOf(r).includes(`${grip}:focus-visible`)
    );
    expect(decls(focus?.body ?? "").get("opacity")).toBe("1");
    // Nothing hides it outright any more, on any pointer.
    const hidden = rules
      .filter((r) => r.selector.includes(grip) && decls(r.body).get("opacity") === "0")
      .map((r) => r.selector);
    expect(hidden).toEqual([]);
  });

  it("every grip hover rule sits behind the (hover: hover) and (pointer: fine) gate", () => {
    const hovers = [...cardRules, ...boardRules].filter(
      (r) => /board-(card|column)-grip/.test(r.selector) && r.selector.includes(":hover")
    );
    expect(hovers.length).toBeGreaterThanOrEqual(4);
    expect(hovers.filter((r) => !r.at.some(isFineHoverGate)).map((r) => r.selector)).toEqual([]);
  });

  it("coarse pointers keep the grips plainly visible", () => {
    const cases: [Rule[], string][] = [
      [cardRules, ".board-card-grip"],
      [boardRules, ".board-column-grip"],
    ];
    for (const [rules, grip] of cases) {
      const coarse = rules.find((r) => r.at.length === 1 && isCoarse(r.at[0] ?? "") && selectorsOf(r).includes(grip));
      expect(decls(coarse?.body ?? "").get("opacity")).toBe("0.7");
    }
  });

  it("no viewport width query sizes a grip or a card lane", () => {
    const viewport = [...cardRules, ...boardRules, ...headerRules, ...globalRules]
      .filter((r) => r.at.some((a) => /^@media\b.*\b(max|min)-width\b/.test(a)))
      .filter((r) => /grip|projects--board--card(?![\w-])/.test(r.selector) || r.body.includes("--board-card"))
      .map((r) => `${r.at.join(" ")} ${r.selector}`);
    expect(viewport).toEqual([]);
  });
});

describe("cards-g1 — responsiveness hygiene", () => {
  it("no board list transitions `all`", () => {
    const all = globalRules
      .filter((r) => r.selector.includes("projects--board"))
      .filter((r) => /(^|[\s,])all\b/.test(decls(r.body).get("transition") ?? ""))
      .map((r) => r.selector);
    expect(all).toEqual([]);
    expect(read("CardList.svelte")).not.toMatch(/transition:\s*["'`]all\b/);
  });

  it("card and column flips take their duration from the reduced-motion helper", () => {
    for (const file of ["CardList.svelte", "Board.svelte"]) {
      const text = read(file);
      expect(`${file}: ${/import \{ getAnimationDuration \} from "src\/lib\/helpers\/animation"/.test(text)}`).toBe(`${file}: true`);
      expect(`${file}: ${/const flipDurationMs = getAnimationDuration\(150\);/.test(text)}`).toBe(`${file}: true`);
      expect(`${file}: ${/animate:flip=\{\{ duration: flipDurationMs \}\}/.test(text)}`).toBe(`${file}: true`);
    }
  });

  it("the helper the flips use is 0 under reduced motion", () => {
    const { getAnimationDuration } = jest.requireActual("src/lib/helpers/animation") as {
      getAnimationDuration: (d?: number) => number;
    };
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
    })) as unknown as typeof window.matchMedia;
    try {
      expect(getAnimationDuration(150)).toBe(0);
    } finally {
      window.matchMedia = original;
    }
  });

  it("records the measurement method for the later live run", () => {
    const text = read("CardList.svelte");
    expect(text).toMatch(/pointer-down on a grip to the first drag frame/);
    expect(text).toMatch(/20\/100\/300-card boards/);
    expect(text).toMatch(/p50\/p95/);
  });
});

// ── Rendered structure and drag parity ───────────────────────────────────────

const CardList = require("../CardList.svelte").default as ComponentClass;
const Board = require("../Board.svelte").default as ComponentClass;

const record = (id: string) => ({ id, values: {} });

function mountCards(props: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onRecordClick = jest.fn();
  const onDrop = jest.fn();
  const component = new CardList({
    target,
    props: {
      items: [record("a.md"), record("b.md")],
      onRecordClick,
      onRecordCheck: jest.fn(),
      onDrop,
      includeFields: [],
      checkField: undefined,
      customHeader: undefined,
      boardEditing: false,
      ...props,
    },
  });
  const cards = () => Array.from(target.querySelectorAll<HTMLElement>("article.projects--board--card"));
  const gripOf = (card: HTMLElement) => card.firstElementChild as HTMLElement;
  return {
    target,
    cards,
    gripOf,
    onRecordClick,
    onDrop,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("cards-g1 — the card grip in the rendered list", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is the card's first lane, before the content wrapper, and carries the handle", () => {
    const m = mountCards();
    const [card] = m.cards();
    expect(card).toBeDefined();
    const lanes = Array.from((card as HTMLElement).children);
    expect(lanes).toHaveLength(2);
    expect(lanes[0]).toHaveClass("board-card-grip");
    expect(lanes[1]).toHaveClass("color-item");
    // `dragHandle` marks the element it is applied to.
    expect(lanes[0]).toHaveAttribute("role", "button");
    expect((lanes[0] as HTMLElement).tabIndex).toBe(0);
    expect((lanes[0] as HTMLElement).style.cursor).toBe("grab");
    m.destroy();
  });

  it("a click on the grip lane does not open the card; a click on its content does", () => {
    const m = mountCards();
    const card = m.cards()[0] as HTMLElement;
    m.gripOf(card).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(m.onRecordClick).not.toHaveBeenCalled();
    card.querySelector(".color-item")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(m.onRecordClick).toHaveBeenCalledTimes(1);
    m.destroy();
  });

  it("a press on the grip arms the drag and a release without one disarms it", () => {
    const m = mountCards();
    const grip = m.gripOf(m.cards()[0] as HTMLElement);
    grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(grip.style.cursor).toBe("grabbing");
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(grip.style.cursor).toBe("grab");
    m.destroy();
  });

  it("the grip of a disabled list does not arm", () => {
    const m = mountCards({ disableDnd: true });
    const grip = m.gripOf(m.cards()[0] as HTMLElement);
    grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(grip.style.cursor).toBe("grab");
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    m.destroy();
  });

  it("keyboard reorder from the grip still works", () => {
    const m = mountCards();
    const first = m.cards()[0] as HTMLElement;
    const grip = m.gripOf(first);
    grip.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    expect(m.onDrop).toHaveBeenCalledTimes(1);
    const [moved, order, trigger] = m.onDrop.mock.calls[0] as [{ id: string }, { id: string }[], string];
    expect(moved.id).toBe("a.md");
    expect(order.map((r) => r.id)).toEqual(["b.md", "a.md"]);
    expect(trigger).toBe("droppedIntoZone");
    // Escape ends the keyboard drag and disarms the shared flag.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(m.gripOf(m.cards()[0] as HTMLElement).style.cursor).toBe("grab");
    m.destroy();
  });
});

describe("cards-g1 — the column grip in the rendered board", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function mountBoard() {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const column = (id: string, extra: Record<string, boolean> = {}) => ({
      id,
      records: [],
      collapse: false,
      pinned: false,
      persisted: false,
      ...extra,
    });
    const component = new Board({
      target,
      props: {
        columns: [column("Pinned", { pinned: true }), column("Open"), column("Folded", { collapse: true })],
        readonly: true,
        dataReadOnly: false,
        richText: false,
        onRecordClick: jest.fn(),
        onRecordCheck: jest.fn(),
        onRecordUpdate: jest.fn(),
        onRecordAdd: jest.fn(),
        columnWidth: 270,
        onSortColumns: jest.fn(),
        onColumnAdd: jest.fn(),
        onColumnDelete: jest.fn(),
        onColumnRename: jest.fn(),
        onColumnCollapse: jest.fn(),
        onColumnPin: jest.fn(),
        onColumnPersist: jest.fn(),
        validateStatusField: () => ({}),
        checkField: undefined,
        includeFields: [],
        customHeader: undefined,
      },
    });
    const columnEl = (id: string) => target.querySelector<HTMLElement>(`section.projects--board--column[data-id="${id}"]`);
    return {
      target,
      columnEl,
      destroy() {
        component.$destroy();
        target.remove();
      },
    };
  }

  it("leads an expanded column's header row, in flow, with the handle on it", () => {
    const m = mountBoard();
    const header = m.columnEl("Open")?.querySelector(".projects--board--column--header");
    const grip = header?.firstElementChild;
    expect(grip).toHaveClass("board-column-grip");
    expect(grip).toHaveAttribute("role", "button");
    // The grip is not a sibling overlay of the column any more.
    const wrapper = m.columnEl("Open")?.parentElement;
    expect(wrapper).toBeInstanceOf(HTMLElement);
    expect(Array.from<Element>(wrapper?.children ?? []).filter((c) => c.classList.contains("board-column-grip"))).toEqual([]);
    m.destroy();
  });

  it("sits in a strip of its own before a collapsed column, not in its header", () => {
    const m = mountBoard();
    const section = m.columnEl("Folded");
    const strip = section?.previousElementSibling;
    expect(strip).toHaveClass("board-column-grip");
    expect(strip).toHaveClass("board-column-grip--strip");
    expect(strip).toHaveAttribute("role", "button");
    expect(section?.querySelector(".board-column-grip")).toBeNull();
    m.destroy();
  });

  it("renders no grip and no lane for a pinned column", () => {
    const m = mountBoard();
    const pinned = m.target.querySelector(".projects--board--pinned");
    expect(pinned).not.toBeNull();
    expect(pinned?.querySelector(".board-column-grip")).toBeNull();
    const header = m.columnEl("Pinned")?.querySelector(".projects--board--column--header");
    expect(header?.firstElementChild?.tagName).toBe("SPAN");
    expect(header?.firstElementChild).not.toHaveClass("board-column-grip");
    m.destroy();
  });

  it("a double click on the column grip is not a rename", async () => {
    const m = mountBoard();
    const header = m.columnEl("Open")?.querySelector(".projects--board--column--header") as HTMLElement;
    const title = () => Array.from(header.children).find((c) => c.tagName === "SPAN" && !c.classList.contains("board-column-grip"));
    expect(title()?.textContent?.trim()).toBe("Open");
    // The header's own dblclick handler starts the rename; the event must not
    // reach the header at all.
    const reachedHeader = jest.fn();
    header.addEventListener("dblclick", reachedHeader);
    header.querySelector(".board-column-grip")?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await tick();
    expect(reachedHeader).not.toHaveBeenCalled();
    expect(title()?.textContent?.trim()).toBe("Open");
    m.destroy();
  });
});
