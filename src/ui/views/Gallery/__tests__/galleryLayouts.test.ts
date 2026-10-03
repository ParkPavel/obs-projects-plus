/**
 * cards-g3 — the gallery renders the layout, size, cover ratio, fit and labels
 * its config asks for, and a config without those keys renders as before.
 *
 * The real GalleryView is mounted with a real frame, as in galleryCard.test.ts;
 * only the edges a card hands its work to are replaced. What the browser does
 * with the classes and custom properties (columns, rows, container widths) is
 * CSS in styles.css: its rules are read as text at the end of this file, and
 * the rendered look is a device check.
 */

import "@testing-library/jest-dom";
import { readFileSync } from "fs";
import { join } from "path";
import { get } from "svelte/store";

import { DataFieldType } from "src/lib/dataframe/dataframe";

// Local aliases: under the jest.mock hoisting transform an imported binding
// may not appear in a type annotation.
type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;

jest.mock("src/lib/record/openRecord", () => ({
  ...jest.requireActual("src/lib/record/openRecord"),
  openRecord: jest.fn(() => Promise.resolve()),
}));
jest.mock("src/ui/modals/editNoteModal", () => ({
  EditNoteModal: jest.fn().mockImplementation(() => ({ open: jest.fn() })),
}));
jest.mock("src/ui/modals/createNoteModal", () => ({
  CreateNoteModal: jest.fn().mockImplementation(() => ({ open: jest.fn() })),
}));
jest.mock("src/ui/views/helpers", () => ({
  ...jest.requireActual("src/ui/views/helpers"),
  showMobileNavMenu: jest.fn(),
  handleHoverLink: jest.fn(),
}));
// The layout barrel re-exports `.svelte` defaults, which Jest sees as module
// objects; bind it to the compiled components (see galleryCard.test.ts).
jest.mock("src/ui/components/Layout", () => ({
  ViewLayout: jest.requireActual("src/ui/components/Layout/ViewLayout.svelte").default,
  ViewContent: jest.requireActual("src/ui/components/Layout/ViewContent.svelte").default,
}));

type Mounted = { $destroy(): void };
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const { app } = require("src/lib/stores/obsidian") as { app: { set(value: unknown): void } };
const ui = require("src/lib/stores/ui") as {
  watchViewport: () => () => void;
  isMobileDevice: import("svelte/store").Readable<boolean>;
};
const GalleryView = require("../GalleryView.svelte").default as ComponentClass;

const COVER = "https://example.com/cover.png";

const status: DataField = {
  name: "status",
  type: DataFieldType.Select,
  repeated: false,
  identifier: false,
  derived: false,
};
const cover: DataField = { ...status, name: "cover", type: DataFieldType.String };

const records: DataRecord[] = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"].map((name, i) => ({
  id: `notes/${name}.md`,
  values: { status: i % 2 ? "Done" : "Doing", ...(i === 0 ? { cover: COVER } : {}) },
}));

function mountGallery(config: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new GalleryView({
    target,
    props: {
      project: { autosave: true },
      frame: { fields: [status, cover], records },
      config: { coverField: "cover", includeFields: ["status"], ...config },
      api: { updateRecord: jest.fn(), addRecord: jest.fn() },
      getRecordColor: () => null,
      readonly: true,
    },
  });
  const container = () => target.querySelector<HTMLElement>(".ppp-gallery-container") as HTMLElement;
  const section = () => target.querySelector<HTMLElement>("section.projects--gallery--grid") as HTMLElement;
  const cards = () => Array.from(target.querySelectorAll<HTMLElement>("article.projects--gallery--card"));
  const card = (i: number) => cards()[i] as HTMLElement;
  const media = (i: number) => card(i).querySelector<HTMLElement>(".projects--gallery--card__media");
  return {
    target,
    container,
    section,
    cards,
    card,
    media,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

const prop = (el: HTMLElement | null, name: string) => el?.style.getPropertyValue(name) ?? "";

beforeAll(() => {
  app.set({});
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("cards-g3 — a config without the new keys renders as before", () => {
  it("grid of articles, media first then body, 16/10 cover, labels shown, width 300", () => {
    const m = mountGallery();
    // The section the cards sit in is the same grid; its wrapper is the
    // gallery's own query container.
    expect(m.section()).toHaveClass("projects--gallery--grid", "ppp-gallery--grid");
    expect(m.section()).toHaveAttribute("data-layout", "grid");
    expect(m.section().parentElement).toBe(m.container());
    expect(m.cards()).toHaveLength(records.length);
    for (const card of m.cards()) {
      expect(card.parentElement).toBe(m.section());
      const lanes = Array.from(card.children);
      expect(lanes).toHaveLength(2);
      expect(lanes[0]).toHaveClass("projects--gallery--card__media");
      expect(lanes[1]).toHaveClass("projects--gallery--card__body");
    }
    // 300 CSS pixels at the default root, written as rem.
    expect(prop(m.section(), "--ppp-gallery-card-width")).toBe("18.75rem");
    expect(prop(m.card(0), "--ppp-shared-card-size")).toBe("18.75rem");
    expect(prop(m.media(0), "--ppp-card-media-ratio")).toBe("16 / 10");
    expect(prop(m.media(0), "--ppp-card-media-fit")).toBe("cover");
    expect(m.media(0)?.querySelector("img")).toHaveAttribute("src", COVER);
    const label = m.card(0).querySelector(".field-label .setting-item-description");
    expect(label?.textContent?.trim()).toBe("status");
    expect(m.card(0).querySelector(".field-label")).not.toHaveAttribute("title");
    m.destroy();
  });

  it("only the included fields are shown, as before", () => {
    const m = mountGallery({ includeFields: [] });
    expect(m.card(0).querySelector(".field-label")).toBeNull();
    m.destroy();
  });
});

describe("cards-g3 — layouts", () => {
  it("masonry: a columns section whose DOM order is the record order", () => {
    const m = mountGallery({ layout: "masonry" });
    expect(m.section()).toHaveClass("projects--gallery--grid", "ppp-gallery--masonry");
    expect(m.section()).not.toHaveClass("ppp-gallery--grid");
    expect(m.section()).toHaveAttribute("data-layout", "masonry");
    expect(m.cards().map((c) => c.dataset["pppCardId"])).toEqual(records.map((r) => r.id));
    // Keyboard order follows the DOM: the title links come in record order too.
    const links = Array.from(m.section().querySelectorAll<HTMLElement>("a.internal-link"));
    expect(links.map((a) => a.getAttribute("data-href"))).toEqual(records.map((r) => r.id));
    m.destroy();
  });

  it("list: a row card with the media leading and the body after it", () => {
    const m = mountGallery({ layout: "list" });
    expect(m.section()).toHaveClass("ppp-gallery--list");
    expect(m.section()).toHaveAttribute("data-layout", "list");
    for (const card of m.cards()) {
      const lanes = Array.from(card.children);
      expect(lanes).toHaveLength(2);
      expect(lanes[0]).toHaveClass("projects--gallery--card__media");
      expect(lanes[1]).toHaveClass("projects--gallery--card__body");
    }
    m.destroy();
  });

  it("an unknown layout renders the grid", () => {
    const m = mountGallery({ layout: "carousel" });
    expect(m.section()).toHaveClass("ppp-gallery--grid");
    m.destroy();
  });

  it("the card size reaches every layout as the same custom properties", () => {
    for (const layout of ["grid", "masonry", "list"]) {
      const m = mountGallery({ layout, cardWidth: 400 });
      expect(prop(m.section(), "--ppp-gallery-card-width")).toBe("25rem");
      expect(prop(m.card(1), "--ppp-shared-card-size")).toBe("25rem");
      m.destroy();
    }
  });
});

describe("cards-g3 — cover ratio and fit", () => {
  it("a ratio token and a fit reach the media as custom properties", () => {
    const m = mountGallery({ coverAspectRatio: "3/4", fitStyle: "contain" });
    expect(prop(m.media(0), "--ppp-card-media-ratio")).toBe("3 / 4");
    expect(prop(m.media(0), "--ppp-card-media-fit")).toBe("contain");
    m.destroy();
  });

  it("an unknown fit renders as cover, legacy fill stays fill", () => {
    const zoom = mountGallery({ fitStyle: "zoom" });
    expect(prop(zoom.media(0), "--ppp-card-media-fit")).toBe("cover");
    zoom.destroy();
    const fill = mountGallery({ fitStyle: "fill" });
    expect(prop(fill.media(0), "--ppp-card-media-fit")).toBe("fill");
    fill.destroy();
  });

  it("ratio none renders no media element at all, in every layout", () => {
    for (const layout of ["grid", "masonry", "list"]) {
      const m = mountGallery({ layout, coverAspectRatio: "none" });
      expect(m.target.querySelector(".projects--gallery--card__media")).toBeNull();
      for (const card of m.cards()) {
        expect(card.children).toHaveLength(1);
        expect(card.children[0]).toHaveClass("projects--gallery--card__body");
      }
      // The title link still opens the record.
      expect(m.card(0).querySelector("a.internal-link")).not.toBeNull();
      m.destroy();
    }
  });
});

describe("cards-g3 — field labels", () => {
  it("showFieldLabels false hides the names and keeps the values, named in a tooltip", () => {
    const m = mountGallery({ showFieldLabels: false });
    expect(m.target.querySelector(".setting-item-description")).toBeNull();
    const row = m.card(0).querySelector(".field-label");
    expect(row).toHaveAttribute("title", "status");
    expect(row?.querySelector(".ppp-card-meta-chip")?.textContent?.trim()).toBe("Doing");
    m.destroy();
  });
});

describe("cards-g3 — no device cap", () => {
  const originalWidth = window.innerWidth;

  function setViewportWidth(width: number): void {
    jest.useFakeTimers();
    try {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      const stop = ui.watchViewport();
      window.dispatchEvent(new Event("resize"));
      jest.advanceTimersByTime(200);
      stop();
    } finally {
      jest.useRealTimers();
    }
  }

  afterAll(() => {
    setViewportWidth(originalWidth);
  });

  it("on a phone-wide window the saved width is used as it is", () => {
    setViewportWidth(375);
    expect(get(ui.isMobileDevice)).toBe(true);
    const m = mountGallery({ cardWidth: 300 });
    // Was capped to 200 (12.5rem) on any phone before cards-g3.
    expect(prop(m.section(), "--ppp-gallery-card-width")).toBe("18.75rem");
    m.destroy();
  });

  it("the grid component no longer reads the device stores", () => {
    const grid = readFileSync(join(__dirname, "..", "components", "Grid", "Grid.svelte"), "utf8");
    expect(grid).not.toMatch(/isMobileDevice|isMobile\b|src\/lib\/stores\/ui/);
  });
});

/** Rules of `css` with their enclosing at-rule preludes (a brace walk). */
function readRules(css: string): { selector: string; body: string; at: string[] }[] {
  const rules: { selector: string; body: string; at: string[] }[] = [];
  const stack: string[] = [];
  let buffer = "";
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (ch === "{") {
      stack.push(buffer.trim().replace(/\s+/g, " "));
      buffer = "";
    } else if (ch === "}") {
      const head = stack.pop() ?? "";
      if (!head.startsWith("@")) {
        rules.push({ selector: head, body: buffer, at: stack.filter((h) => h.startsWith("@")) });
      }
      buffer = "";
    } else {
      buffer += ch;
    }
  }
  return rules;
}

describe("cards-g3 — the stylesheet sizes the gallery from its own container", () => {
  const css = readFileSync(join(__dirname, "..", "..", "..", "..", "..", "styles.css"), "utf8");
  const hand = css.slice(0, css.indexOf("/* === GENERATED"));
  const rules = readRules(hand);
  const galleryRule = (r: { selector: string }) => /projects--gallery|ppp-gallery/.test(r.selector);

  it("the gallery container is a named inline-size container", () => {
    const rule = rules.find((r) => r.selector === ".ppp-gallery-container" && r.at.length === 0);
    expect(rule?.body).toMatch(/container-type:\s*inline-size/);
    expect(rule?.body).toMatch(/container-name:\s*ppp-gallery/);
  });

  it("no viewport-width query styles the gallery any more", () => {
    const viewport = rules
      .filter((r) => r.at.some((a) => /^@media\b.*\b(max|min)-width\b/.test(a)))
      .filter(galleryRule)
      .map((r) => `${r.at.join(" ")} ${r.selector}`);
    expect(viewport).toEqual([]);
  });

  it("the narrow-gallery rules answer to the gallery container", () => {
    const narrow = rules.filter((r) => galleryRule(r) && r.at.some((a) => a.startsWith("@container ppp-gallery")));
    expect(narrow.length).toBeGreaterThan(0);
  });

  it("columns, masonry and list read the card width; media reads ratio and fit", () => {
    const body = (selector: string) => rules.find((r) => r.selector === selector && r.at.length === 0)?.body ?? "";
    expect(body(".projects--gallery--grid")).toMatch(
      /grid-template-columns:\s*repeat\(auto-fill, minmax\(min\(var\(--ppp-gallery-card-width/
    );
    expect(body(".projects--gallery--grid.ppp-gallery--masonry")).toMatch(/column-width:\s*var\(--ppp-gallery-card-width/);
    expect(body(".projects--gallery--grid.ppp-gallery--masonry > *")).toMatch(/break-inside:\s*avoid/);
    expect(body(".projects--gallery--grid.ppp-gallery--list")).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(body(".ppp-gallery--list > .projects--gallery--card")).toMatch(/flex-direction:\s*row/);
    expect(body(".projects--gallery--card__media")).toMatch(/aspect-ratio:\s*var\(--ppp-card-media-ratio, 16 \/ 10\)/);
    expect(body(".projects--gallery--card__media img")).toMatch(/object-fit:\s*var\(--ppp-card-media-fit, cover\)/);
  });
});
