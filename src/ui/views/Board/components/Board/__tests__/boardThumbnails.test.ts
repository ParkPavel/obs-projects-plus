/**
 * cards-g4: kanban card thumbnails — a cover on top, a small square at the
 * left, or none (the default, and the card exactly as it was).
 *
 * The cover is resolved the gallery's way (`getCoverRealPath`: an image file
 * the link resolves to, or an http(s) URL). A record whose cover does not
 * resolve gets NO media element in any mode. The image is decorative and lazy;
 * a click on it is a click on the card body; the grip lane, its arming, the
 * checkbox, the title link and keyboard reorder are unchanged with it present.
 *
 * jsdom does no layout: the rendered half pins structure and behaviour, and
 * the CSS half reads the rules that make that structure the geometry.
 */

import "@testing-library/jest-dom";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { tick } from "svelte";

import { SRC_ROOT, stripCssComments, svelteStyles } from "src/__tests__/support/cssScan";

// CardList reads two view contexts keyed by private symbols (gripLayout pattern).
jest.mock("src/ui/views/helpers", () => ({
  ...jest.requireActual("src/ui/views/helpers"),
  getRecordColorContext: { get: () => () => null, set: () => undefined },
  sortRecordsContext: { get: () => (records: unknown[]) => records, set: () => undefined },
  showMobileNavMenu: jest.fn(),
  handleHoverLink: jest.fn(),
}));
jest.mock("src/lib/record/openRecord", () => ({
  ...jest.requireActual("src/lib/record/openRecord"),
  openRecord: jest.fn(() => Promise.resolve()),
}));
// The card's checkbox is the real component, so a click on it is a user's click.
jest.mock("obsidian-svelte", () => ({
  ...jest.requireActual("src/__mocks__/obsidian-svelte.js"),
  Checkbox: jest.requireActual("obsidian-svelte/Checkbox/Checkbox.svelte").default,
}));
// ColumnHeader's Markdown owner needs `Component`, which the shared mock lacks.
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
// Svelte components re-exported through a barrel are module objects under
// Jest (see gripLayout.test.ts); bind the barrels straight to the components.
jest.mock("src/ui/components/Flair", () => ({
  Flair: (jest.requireActual("src/ui/components/Flair/Flair.svelte") as { default: unknown }).default,
}));
jest.mock("src/ui/components/Layout", () => ({
  ViewLayout: (jest.requireActual("src/ui/components/Layout/ViewLayout.svelte") as { default: unknown }).default,
  ViewContent: (jest.requireActual("src/ui/components/Layout/ViewContent.svelte") as { default: unknown }).default,
}));

type Mounted = { $destroy(): void; $set(props: Record<string, unknown>): void };
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const CardList = require("../CardList.svelte").default as ComponentClass;
const Board = require("../Board.svelte").default as ComponentClass;
const BoardOptionsProvider = require("../../../BoardOptionsProvider.svelte").default as ComponentClass;
const { normalizeThumbnailLayout } = require("../../../types") as {
  normalizeThumbnailLayout: (value: unknown) => string;
};
const { app } = require("src/lib/stores/obsidian") as { app: { set(value: unknown): void } };

// ── A vault the cover links resolve against ──────────────────────────────────

const FILES: Record<string, { path: string; extension: string }> = {
  "img/a.png": { path: "img/a.png", extension: "png" },
  "notes/b": { path: "notes/b.md", extension: "md" },
};
app.set({
  metadataCache: { getFirstLinkpathDest: (link: string) => FILES[link] ?? null },
  vault: { getResourcePath: (file: { path: string }) => `app://vault/${file.path}` },
});

const cover = { name: "cover", type: "string", repeated: false, identifier: false, derived: false };

/** a: an image file; b: a note, not an image; c: no cover; d: a URL; e: not text. */
const RECORDS = () => [
  { id: "a.md", values: { cover: "[[img/a.png]]", done: false } },
  { id: "b.md", values: { cover: "[[notes/b]]", done: false } },
  { id: "c.md", values: { done: false } },
  { id: "d.md", values: { cover: "https://example.com/d.jpg", done: false } },
  { id: "e.md", values: { cover: 42, done: false } },
];

function mountCards(props: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const items = RECORDS();
  const onRecordClick = jest.fn();
  const onRecordCheck = jest.fn();
  const onDrop = jest.fn();
  const component = new CardList({
    target,
    props: {
      items,
      onRecordClick,
      onRecordCheck,
      onDrop,
      includeFields: [],
      checkField: "done",
      customHeader: undefined,
      boardEditing: false,
      coverField: cover,
      ...props,
    },
  });
  const card = (id: string) => target.querySelector<HTMLElement>(`article[data-ppp-card-id="${id}"]`) as HTMLElement;
  const lanes = (id: string) => Array.from(card(id).children).map((c) => c.className.split(/\s+/)[0]);
  return {
    target,
    items,
    card,
    lanes,
    onRecordClick,
    onRecordCheck,
    onDrop,
    component,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

const click = (init: MouseEventInit = {}) => new MouseEvent("click", { bubbles: true, cancelable: true, ...init });

afterEach(() => {
  document.body.innerHTML = "";
});

// ── Config ───────────────────────────────────────────────────────────────────

describe("cards-g4 — the layout value", () => {
  it.each([
    [undefined, "none"],
    ["none", "none"],
    ["top", "top"],
    ["left", "left"],
    ["bottom", "none"],
    ["TOP", "none"],
    [1, "none"],
    [null, "none"],
  ])("%p reads as %p", (value, expected) => {
    expect(normalizeThumbnailLayout(value)).toBe(expected);
  });
});

describe("cards-g4 — BoardOptionsProvider hands the view its thumbnail options", () => {
  /**
   * Mounts the provider with a default slot that records the props it gets.
   * A compiled parent hands a slot as `[create, getContext, getChanges]`: the
   * second receives the slot props on mount and on every update, the third
   * says what changed (any non-zero mask lets the update through).
   */
  function provide(config: Record<string, unknown>) {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const seen: Record<string, unknown>[] = [];
    const block = () => ({ c: () => undefined, m: () => undefined, p: () => undefined, d: () => undefined });
    const component = new BoardOptionsProvider({
      target,
      props: {
        config,
        onConfigChange: jest.fn(),
        frame: { fields: [cover], records: [] },
        $$slots: {
          default: [
            block,
            (slotProps: Record<string, unknown>) => {
              seen.push(slotProps);
              return {};
            },
            () => 1,
          ],
        },
        $$scope: { ctx: [] },
      },
    });
    const last = () => seen[seen.length - 1];
    return { seen, last, component, destroy: () => component.$destroy() };
  }

  it("absent options are none and no cover field", () => {
    const p = provide({});
    expect(p.seen.length).toBeGreaterThan(0);
    expect(p.last()).toMatchObject({ thumbnailLayout: "none", coverField: undefined });
    p.destroy();
  });

  it("saved options pass through; an unknown layout is none", () => {
    const top = provide({ thumbnailLayout: "top", coverField: "cover" });
    expect(top.last()).toMatchObject({ thumbnailLayout: "top", coverField: "cover" });
    top.destroy();
    const left = provide({ thumbnailLayout: "left", coverField: "cover" });
    expect(left.last()).toMatchObject({ thumbnailLayout: "left", coverField: "cover" });
    left.destroy();
    const odd = provide({ thumbnailLayout: "diagonal", coverField: "cover" });
    expect(odd.last()).toMatchObject({ thumbnailLayout: "none", coverField: "cover" });
    odd.destroy();
  });

  it("an edited config reaches the slot", async () => {
    const p = provide({});
    p.component.$set({ config: { thumbnailLayout: "top", coverField: "cover" } });
    await tick();
    expect(p.last()).toMatchObject({ thumbnailLayout: "top", coverField: "cover" });
    p.destroy();
  });

  it("BoardView resolves the cover field and passes both to Board, as it does the icon field", () => {
    const view = readFileSync(resolve(__dirname, "../../../BoardView.svelte"), "utf8");
    expect(view).toMatch(/let:thumbnailLayout/);
    expect(view).toMatch(/let:coverField/);
    expect(view).toMatch(/\{thumbnailLayout\}/);
    expect(view).toMatch(/coverField=\{fields\.find\(\(field\) => field\.name === coverField\)\}/);
  });
});

// ── Rendering ────────────────────────────────────────────────────────────────

describe("cards-g4 — none or absent renders the card exactly as before", () => {
  it.each([
    ["absent", {}],
    ["none", { thumbnailLayout: "none" }],
  ])("%s: grip lane then the colour item, no image anywhere", (_name, props) => {
    const m = mountCards(props);
    for (const { id } of m.items) {
      expect(m.lanes(id)).toEqual(["board-card-grip", "color-item"]);
      expect(m.card(id)).not.toHaveClass("ppp-shared-card--media-top");
      expect(m.card(id)).not.toHaveClass("ppp-shared-card--media-left");
    }
    expect(m.target.querySelector("img")).toBeNull();
    expect(m.target.querySelector(".ppp-board-card-media")).toBeNull();
    m.destroy();
  });

  it("a layout with no cover field shows nothing", () => {
    const m = mountCards({ thumbnailLayout: "top", coverField: undefined });
    for (const { id } of m.items) expect(m.lanes(id)).toEqual(["board-card-grip", "color-item"]);
    expect(m.target.querySelector("img")).toBeNull();
    m.destroy();
  });
});

describe.each(["top", "left"])("cards-g4 — %s thumbnails", (layout) => {
  it("an image cover is the media lane between the grip and the colour item", () => {
    const m = mountCards({ thumbnailLayout: layout });
    for (const id of ["a.md", "d.md"]) {
      expect(m.lanes(id)).toEqual(["board-card-grip", "ppp-board-card-media", "color-item"]);
      expect(m.card(id)).toHaveClass(`ppp-shared-card--media-${layout}`);
      const media = m.card(id).querySelector(".ppp-board-card-media");
      expect(media).toHaveClass(`ppp-board-card-media--${layout}`);
      expect(media).not.toHaveClass(`ppp-board-card-media--${layout === "top" ? "left" : "top"}`);
    }
    expect(m.card("a.md").querySelector("img")).toHaveAttribute("src", "app://vault/img/a.png");
    expect(m.card("d.md").querySelector("img")).toHaveAttribute("src", "https://example.com/d.jpg");
    m.destroy();
  });

  it("a missing or invalid cover renders no media element and no layout class", () => {
    const m = mountCards({ thumbnailLayout: layout });
    for (const id of ["b.md", "c.md", "e.md"]) {
      expect(m.lanes(id)).toEqual(["board-card-grip", "color-item"]);
      expect(m.card(id).querySelector("img")).toBeNull();
      expect(m.card(id)).not.toHaveClass(`ppp-shared-card--media-${layout}`);
    }
    m.destroy();
  });

  it("an image that fails to load drops its media, so no empty box remains", async () => {
    const m = mountCards({ thumbnailLayout: layout });
    m.card("d.md").querySelector("img")?.dispatchEvent(new Event("error"));
    await tick();
    expect(m.lanes("d.md")).toEqual(["board-card-grip", "color-item"]);
    expect(m.card("d.md")).not.toHaveClass(`ppp-shared-card--media-${layout}`);
    // Other cards keep their covers.
    expect(m.lanes("a.md")).toEqual(["board-card-grip", "ppp-board-card-media", "color-item"]);

    // A reorder of the same record objects (what a drag does) does not retry.
    m.component.$set({ items: [...m.items].reverse() });
    await tick();
    expect(m.lanes("d.md")).toEqual(["board-card-grip", "color-item"]);

    // A data refresh brings new record objects: the image is tried again, so a
    // repaired image at the same address comes back.
    m.component.$set({ items: m.items.map((r) => ({ ...r, values: { ...r.values } })) });
    await tick();
    expect(m.lanes("d.md")).toEqual(["board-card-grip", "ppp-board-card-media", "color-item"]);
    m.destroy();
  });

  it("the image is decorative and lazy", () => {
    const m = mountCards({ thumbnailLayout: layout });
    const media = m.card("a.md").querySelector(".ppp-board-card-media");
    expect(media).toHaveAttribute("aria-hidden", "true");
    const img = media?.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
    expect(img).toHaveAttribute("draggable", "false");
    // The record stays named by its title link, not by the image.
    expect(m.card("a.md").querySelector("a.internal-link")).not.toBeNull();
    m.destroy();
  });

  it("a click on the thumbnail opens the record once, like the body", () => {
    const m = mountCards({ thumbnailLayout: layout });
    m.card("a.md").querySelector("img")?.dispatchEvent(click());
    expect(m.onRecordClick).toHaveBeenCalledTimes(1);
    expect(m.onRecordClick).toHaveBeenCalledWith(m.items[0]);
    m.card("d.md").querySelector(".ppp-board-card-media")?.dispatchEvent(click());
    expect(m.onRecordClick).toHaveBeenCalledTimes(2);
    expect(m.onRecordClick).toHaveBeenLastCalledWith(m.items[3]);
    m.destroy();
  });

  it("the grip still does not open, and still arms and disarms the drag", () => {
    const m = mountCards({ thumbnailLayout: layout });
    const grip = m.card("a.md").firstElementChild as HTMLElement;
    expect(grip).toHaveClass("board-card-grip");
    grip.dispatchEvent(click());
    expect(m.onRecordClick).not.toHaveBeenCalled();
    grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(grip.style.cursor).toBe("grabbing");
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(grip.style.cursor).toBe("grab");
    m.destroy();
  });

  it("the grip of a disabled list still does not arm", () => {
    const m = mountCards({ thumbnailLayout: layout, disableDnd: true });
    const grip = m.card("a.md").firstElementChild as HTMLElement;
    grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(grip.style.cursor).toBe("grab");
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    m.destroy();
  });

  it("keyboard reorder from the grip still works", () => {
    const m = mountCards({ thumbnailLayout: layout });
    const first = m.card("a.md");
    const grip = first.firstElementChild as HTMLElement;
    grip.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    expect(m.onDrop).toHaveBeenCalledTimes(1);
    const [moved, order] = m.onDrop.mock.calls[0] as [{ id: string }, { id: string }[]];
    expect(moved.id).toBe("a.md");
    expect(order.map((r) => r.id).slice(0, 2)).toEqual(["b.md", "a.md"]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    m.destroy();
  });

  it("the checkbox toggles without opening, and the title link opens once", async () => {
    const m = mountCards({ thumbnailLayout: layout });
    const box = m.card("a.md").querySelector<HTMLInputElement>(".checkbox-wrapper input[type='checkbox']");
    box?.click();
    await tick();
    expect(m.onRecordCheck).toHaveBeenCalledWith(m.items[0], true);
    expect(m.onRecordClick).not.toHaveBeenCalled();
    m.card("a.md").querySelector("a.internal-link")?.dispatchEvent(click());
    expect(m.onRecordClick).toHaveBeenCalledTimes(1);
    m.destroy();
  });
});

describe("cards-g4 — switching the layout live", () => {
  it("none → top → left → none adds, moves and removes the media", async () => {
    const m = mountCards();
    expect(m.lanes("a.md")).toEqual(["board-card-grip", "color-item"]);
    m.component.$set({ thumbnailLayout: "top" });
    await tick();
    expect(m.card("a.md")).toHaveClass("ppp-shared-card--media-top");
    expect(m.lanes("a.md")).toEqual(["board-card-grip", "ppp-board-card-media", "color-item"]);
    m.component.$set({ thumbnailLayout: "left" });
    await tick();
    expect(m.card("a.md")).toHaveClass("ppp-shared-card--media-left");
    expect(m.card("a.md")).not.toHaveClass("ppp-shared-card--media-top");
    expect(m.card("a.md").querySelector(".ppp-board-card-media")).toHaveClass("ppp-board-card-media--left");
    m.component.$set({ thumbnailLayout: "none" });
    await tick();
    expect(m.lanes("a.md")).toEqual(["board-card-grip", "color-item"]);
    expect(m.card("a.md")).not.toHaveClass("ppp-shared-card--media-left");
    m.destroy();
  });
});

describe("cards-g4 — Board passes the options to every column's cards", () => {
  function mountBoard(props: Record<string, unknown>) {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const column = (id: string, extra: Record<string, boolean> = {}) => ({
      id,
      records: RECORDS().slice(0, 2),
      collapse: false,
      pinned: false,
      persisted: false,
      ...extra,
    });
    const component = new Board({
      target,
      props: {
        columns: [column("Pinned", { pinned: true }), column("Open")],
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
        ...props,
      },
    });
    const card = (columnId: string, id: string) =>
      target.querySelector<HTMLElement>(
        `section.projects--board--column[data-id="${columnId}"] article[data-ppp-card-id="${id}"]`
      ) as HTMLElement;
    return { card, destroy: () => component.$destroy() };
  }

  it("pinned and unpinned columns both show the cover", () => {
    const m = mountBoard({ thumbnailLayout: "left", coverField: cover });
    for (const columnId of ["Pinned", "Open"]) {
      expect(m.card(columnId, "a.md")).toHaveClass("ppp-shared-card--media-left");
      expect(m.card(columnId, "a.md").querySelector("img")).toHaveAttribute("loading", "lazy");
      expect(m.card(columnId, "b.md").querySelector("img")).toBeNull();
    }
    m.destroy();
  });

  it("without the options a board renders no media", () => {
    const m = mountBoard({});
    for (const columnId of ["Pinned", "Open"]) {
      const lanes = Array.from(m.card(columnId, "a.md").children).map((c) => c.className.split(/\s+/)[0]);
      expect(lanes).toEqual(["board-card-grip", "color-item"]);
    }
    m.destroy();
  });
});

// ── Geometry (CSS read from source) ──────────────────────────────────────────

const flat = (css: string) => stripCssComments(css).replace(/\s+/g, " ");
const SHELL = flat(svelteStyles(readFileSync(join(SRC_ROOT, "ui", "components", "SharedCard", "SharedCard.svelte"), "utf8")));
const LIST = flat(svelteStyles(readFileSync(join(resolve(__dirname, ".."), "CardList.svelte"), "utf8")));

/** The body of the first rule whose selector is exactly `selector`. */
function body(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at === -1) return "";
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
}

describe("cards-g4 — geometry", () => {
  it("the grip spans every row of the card", () => {
    expect(body(LIST, ".board-card-grip")).toMatch(/grid-column: 1;/);
    expect(body(LIST, ".board-card-grip")).toMatch(/grid-row: 1 \/ -1;/);
  });

  it("the media is the second lane, first row, with the gallery's ratio and fit hooks", () => {
    expect(body(LIST, ".ppp-board-card-media")).toMatch(/grid-column: 2; grid-row: 1;/);
    expect(body(LIST, ".ppp-board-card-media img")).toMatch(/object-fit: var\(--ppp-card-media-fit, cover\)/);
    expect(body(LIST, ".ppp-board-card-media--top")).toMatch(/aspect-ratio: var\(--ppp-card-media-ratio, 16 \/ 10\)/);
  });

  it("left: a rem-sized square", () => {
    const left = body(LIST, ".ppp-board-card-media--left");
    expect(left).toMatch(/--ppp-board-card-thumb: 2\.75rem;/);
    expect(left).toMatch(/width: var\(--ppp-board-card-thumb\);/);
    expect(left).toMatch(/height: var\(--ppp-board-card-thumb\);/);
  });

  it("top: two rows in the content lane, the colour item in the second", () => {
    expect(body(SHELL, ".projects--board--card.ppp-shared-card--media-top")).toMatch(/grid-template-rows: auto auto;/);
    expect(body(SHELL, ".projects--board--card.ppp-shared-card--media-top > :global(.color-item)")).toMatch(
      /grid-column: 2; grid-row: 2;/
    );
  });

  it("left: a third lane sized by the thumbnail, the colour item after it, on fine and coarse pointers", () => {
    expect(SHELL).toMatch(
      /\.projects--board--card\.ppp-shared-card--media-left \{ grid-template-columns: var\(--board-card-grip-lane, var\(--size-4-5\)\) auto minmax\(0, 1fr\); \}/
    );
    expect(body(SHELL, ".projects--board--card.ppp-shared-card--media-left > :global(.color-item)")).toMatch(
      /grid-column: 3; grid-row: 1;/
    );
    expect(SHELL).toMatch(
      /@media \(pointer: coarse\) \{[^@]*\.projects--board--card\.ppp-shared-card--media-left \{ grid-template-columns: var\(--ppp-touch-target-min\) auto minmax\(0, 1fr\); \}/
    );
  });

  it("adds no hover rule and no stacking order", () => {
    const media = LIST.split("}").filter((r) => r.includes("ppp-board-card-media"));
    expect(media.length).toBeGreaterThanOrEqual(4);
    expect(media.filter((r) => r.includes(":hover") || r.includes("z-index"))).toEqual([]);
    const shell = SHELL.split("}").filter((r) => r.includes("ppp-shared-card--media"));
    expect(shell.length).toBeGreaterThanOrEqual(5);
    expect(shell.filter((r) => r.includes(":hover") || r.includes("z-index"))).toEqual([]);
  });
});
