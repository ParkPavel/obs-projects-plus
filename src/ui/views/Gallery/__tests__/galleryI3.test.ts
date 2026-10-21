/**
 * i3-gallery — the gallery on par with Bases cards and Notion's gallery:
 * covers from list values, resolved from the note, falling back to the first
 * embedded image or the first paragraph; sections by a field; a compact card;
 * a progressive window over a large set; reserved property lines; chips for
 * lists that are not text; the card width slider and dragging properties.
 *
 * The pure parts are tested directly; the rest mounts the real GalleryView
 * with the edges galleryCard.test.ts replaces.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

import { DataFieldType } from "src/lib/dataframe/dataframe";
import { coverOf, coverText, firstEmbeddedImage, firstParagraph, getCoverRealPath } from "../gallery";
import { GALLERY_WINDOW_STEP, NO_VALUE_GROUP, groupGalleryRecords, initialWindow, windowGroups } from "../galleryGroups";
import { clampCardWidth, dropIncludedField, normalizeGalleryConfig, toggleCollapsedGroup } from "../galleryOptions";

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
jest.mock("src/ui/components/Layout", () => ({
  ViewLayout: jest.requireActual("src/ui/components/Layout/ViewLayout.svelte").default,
  ViewContent: jest.requireActual("src/ui/components/Layout/ViewContent.svelte").default,
}));

type Mounted = { $destroy(): void; $set(props: Record<string, unknown>): void };
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const { app } = require("src/lib/stores/obsidian") as { app: { set(value: unknown): void } };
const GalleryView = require("../GalleryView.svelte").default as ComponentClass;

// ── a small vault ────────────────────────────────────────────────

interface FakeFile {
  path: string;
  extension: string;
}

/** Files by path; a link resolves by name, preferring the source note's folder. */
const FILES: FakeFile[] = [
  { path: "img/a.png", extension: "png" },
  { path: "projects/a.png", extension: "png" },
  { path: "img/b.jpg", extension: "jpg" },
  { path: "docs/readme.pdf", extension: "pdf" },
];

function makeApp(embeds: Record<string, { link: string }[]> = {}, contents: Record<string, string> = {}) {
  const getFirstLinkpathDest = jest.fn((link: string, sourcePath: string) => {
    const name = link.split("/").pop() ?? link;
    const folder = sourcePath.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/")) : "";
    const candidates = FILES.filter((f) => f.path === link || f.path.endsWith(`/${name}`));
    return candidates.find((f) => f.path.startsWith(`${folder}/`)) ?? candidates[0] ?? null;
  });
  return {
    metadataCache: {
      getFirstLinkpathDest,
      getCache: (path: string) => (embeds[path] ? { embeds: embeds[path] } : null),
    },
    vault: {
      getResourcePath: (file: FakeFile) => `app://${file.path}`,
      getAbstractFileByPath: (path: string) => (path in contents ? { path, extension: "md" } : null),
      cachedRead: (file: FakeFile) => Promise.resolve(contents[file.path] ?? ""),
    },
  };
}

// The enum is passed as a string: an imported binding may not appear in a
// type annotation under the jest.mock hoisting transform.
const field = (name: string, type: string, repeated = false): DataField => ({
  name,
  type: type as DataField["type"],
  repeated,
  identifier: false,
  derived: false,
});

const record = (id: string, values: DataRecord["values"]): DataRecord => ({ id, values });

// ── cover resolution ─────────────────────────────────────────────

describe("i3-gallery — cover resolution", () => {
  const cover = field("cover", DataFieldType.String);
  const asApp = (a: unknown) => a as import("obsidian").App;

  it("a list value gives its first non-empty item", () => {
    expect(coverText(["", null, "[[a.png]]", "[[b.jpg]]"])).toBe("[[a.png]]");
    expect(coverText([])).toBeNull();
    expect(coverText("  ")).toBeNull();
    const a = makeApp();
    const state = coverOf(asApp(a), record("projects/Note.md", { cover: ["[[b.jpg]]"] }), cover);
    expect(state).toEqual({ kind: "ok", src: "app://img/b.jpg", raw: "[[b.jpg]]" });
  });

  it("a link resolves from the note that holds it, not from the vault root", () => {
    const a = makeApp();
    const state = coverOf(asApp(a), record("projects/Note.md", { cover: "[[a.png]]" }), cover);
    expect(a.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith("a.png", "projects/Note.md");
    // Two images named a.png: the one beside the note wins.
    expect(state).toMatchObject({ kind: "ok", src: "app://projects/a.png" });
    // The board's thumbnail resolves the same way.
    expect(getCoverRealPath(asApp(a), record("projects/Note.md", { cover: ["![[a.png|200]]"] }), cover)).toBe("app://projects/a.png");
  });

  it("markdown links, angle brackets and encoded spaces resolve; a non-image is broken", () => {
    const a = makeApp();
    expect(coverOf(asApp(a), record("n.md", { cover: "![x](img/b.jpg)" }), cover)).toMatchObject({ kind: "ok", src: "app://img/b.jpg" });
    expect(coverOf(asApp(a), record("n.md", { cover: "<img/b.jpg>" }), cover)).toMatchObject({ kind: "ok" });
    expect(coverOf(asApp(a), record("n.md", { cover: "[[readme.pdf]]" }), cover)).toEqual({ kind: "broken", raw: "[[readme.pdf]]" });
    expect(coverOf(asApp(a), record("n.md", { cover: 42 }), cover)).toEqual({ kind: "broken", raw: "42" });
  });

  it("with the fallback, an empty cover shows the note's first embedded image", () => {
    const a = makeApp({ "projects/Note.md": [{ link: "readme.pdf" }, { link: "a.png" }, { link: "b.jpg" }] });
    const empty = record("projects/Note.md", { cover: [] });
    expect(firstEmbeddedImage(asApp(a), "projects/Note.md")).toBe("app://projects/a.png");
    expect(coverOf(asApp(a), empty, cover, true)).toEqual({ kind: "ok", src: "app://projects/a.png", raw: "app://projects/a.png", embedded: true });
    // No cover field at all: still the first image (Notion's page content).
    expect(coverOf(asApp(a), empty, undefined, true)).toMatchObject({ kind: "ok", embedded: true });
    // Without the fallback (the `property` preview) the card stays empty.
    expect(coverOf(asApp(a), empty, cover, false)).toEqual({ kind: "none" });
  });

  it("an external image embed counts; a set but broken cover is never replaced by the fallback", () => {
    const a = makeApp({ "n.md": [{ link: "https://example.com/page" }, { link: "https://example.com/p.webp?x=1" }] });
    expect(firstEmbeddedImage(asApp(a), "n.md")).toBe("https://example.com/p.webp?x=1");
    expect(coverOf(asApp(a), record("n.md", { cover: "gone.png" }), cover, true)).toEqual({ kind: "broken", raw: "gone.png" });
  });

  it("without a metadata cache there is no fallback and nothing throws", () => {
    expect(firstEmbeddedImage(asApp({}), "n.md")).toBeNull();
    expect(coverOf(asApp({}), record("n.md", {}), cover, true)).toEqual({ kind: "none" });
  });

  it("the content preview reads the first paragraph of prose", () => {
    const note = [
      "---",
      "status: Done",
      "---",
      "# Title",
      "",
      "![[a.png]]",
      "",
      "```js",
      "code()",
      "```",
      "",
      "- [ ] Call **[[Ann Lee|Ann]]** about [the plan](https://x.y) #work",
      "  and ==the budget==.",
      "",
      "Second paragraph.",
    ].join("\n");
    expect(firstParagraph(note)).toBe("Call Ann about the plan and the budget.");
    expect(firstParagraph("# Only a heading\n")).toBe("");
    expect(firstParagraph("x".repeat(400), 50)).toHaveLength(50);
  });
});

// ── sections and the window ──────────────────────────────────────

describe("i3-gallery — grouping", () => {
  const recs = [
    record("a.md", { status: "Doing", tags: ["x", "y"] }),
    record("b.md", { status: "Done", tags: ["y"] }),
    record("c.md", { status: null }),
    record("d.md", { status: "Doing", tags: [] }),
    record("e.md", { status: 10 }),
    record("f.md", { status: 9 }),
  ];

  it("no field: one section with every record", () => {
    expect(groupGalleryRecords(recs, undefined)).toEqual([{ key: NO_VALUE_GROUP, records: recs }]);
  });

  it("sections by value, in order (numbers by value), the empty one last, records in view order", () => {
    const groups = groupGalleryRecords(recs, "status");
    expect(groups.map((g) => g.key)).toEqual(["9", "10", "Doing", "Done", NO_VALUE_GROUP]);
    expect(groups.find((g) => g.key === "Doing")?.records.map((r) => r.id)).toEqual(["a.md", "d.md"]);
  });

  it("a list value puts the record in a section per item", () => {
    const groups = groupGalleryRecords(recs, "tags");
    expect(groups.map((g) => [g.key, g.records.map((r) => r.id)])).toEqual([
      ["x", ["a.md"]],
      ["y", ["a.md", "b.md"]],
      [NO_VALUE_GROUP, ["c.md", "d.md", "e.md", "f.md"]],
    ]);
  });

  it("a link groups by its note's name", () => {
    const groups = groupGalleryRecords(
      [record("a.md", { owner: "[[Ann]]" }), record("b.md", { owner: "Ann" }), record("c.md", { owner: "[[people/Bob|Bob]]" })],
      "owner"
    );
    expect(groups.map((g) => [g.key, g.records.length])).toEqual([["Ann", 2], ["Bob", 1]]);
  });

  it("the window spends its budget in order, and a folded section spends none", () => {
    const groups = groupGalleryRecords(recs, "status");
    const cut = windowGroups(groups, ["9"], 3);
    expect(cut.map((g) => [g.key, g.records.length, g.hidden, g.collapsed])).toEqual([
      ["9", 1, 0, true],
      ["10", 1, 0, false],
      ["Doing", 2, 0, false],
      ["Done", 0, 1, false],
      [NO_VALUE_GROUP, 0, 1, false],
    ]);
    expect(initialWindow(200)).toBe(Infinity);
    expect(initialWindow(201)).toBe(GALLERY_WINDOW_STEP);
  });
});

describe("i3-gallery — options", () => {
  it("reads the new keys, and nonsense as the defaults", () => {
    expect(normalizeGalleryConfig({ groupByField: "status", collapsedGroups: ["a", 3], cardPreview: "content", compact: true })).toMatchObject({
      groupByField: "status",
      collapsedGroups: ["a"],
      cardPreview: "content",
      compact: true,
    });
    expect(normalizeGalleryConfig({ groupByField: "", cardPreview: "video", compact: "yes" })).toMatchObject({
      groupByField: undefined,
      cardPreview: "cover",
      compact: false,
    });
  });

  it("the slider clamps and snaps; a drop takes the target's place; a fold toggles", () => {
    expect(clampCardWidth("247")).toBe(250);
    expect(clampCardWidth(10)).toBe(120);
    expect(clampCardWidth(9999)).toBe(640);
    expect(clampCardWidth("wide")).toBe(300);
    expect(dropIncludedField(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(dropIncludedField(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(dropIncludedField(["a", "b"], "a", "zz")).toEqual(["a", "b"]);
    expect(toggleCollapsedGroup(["x"], "y")).toEqual(["x", "y"]);
    expect(toggleCollapsedGroup(["x", "y"], "x")).toEqual(["y"]);
  });
});

// ── the mounted gallery ──────────────────────────────────────────

const status = field("status", DataFieldType.Select);
const owner = field("owner", DataFieldType.Select);
const coverField = field("cover", DataFieldType.String);
const scores = field("scores", DataFieldType.Number, true);

const BASE: DataRecord[] = [
  record("notes/Alpha.md", { status: "Doing", owner: "Ann", scores: [3, 5] }),
  record("notes/Beta.md", { status: "Done" }),
  record("notes/Gamma.md", { status: "Doing" }),
];

function mount(config: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onConfigChange = jest.fn();
  const component = new GalleryView({
    target,
    props: {
      project: { autosave: true },
      frame: { fields: [status, owner, coverField, scores], records: BASE },
      config: { coverField: "cover", includeFields: ["status", "owner"], ...config },
      api: { updateRecord: jest.fn(), addRecord: jest.fn() },
      getRecordColor: () => null,
      onConfigChange,
      ...props,
    },
  });
  const cards = () => Array.from(target.querySelectorAll<HTMLElement>("article.projects--gallery--card"));
  return { target, component, cards, onConfigChange };
}

const click = () => new MouseEvent("click", { bubbles: true, cancelable: true });

beforeEach(() => {
  app.set(makeApp());
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("i3-gallery — sections in the view", () => {
  it("one header and one grid per value; the header counts and folds its section", async () => {
    const m = mount({ groupByField: "status" });
    const heads = () => Array.from(m.target.querySelectorAll<HTMLElement>("[data-gallery-group]"));
    expect(heads().map((h) => h.dataset["galleryGroup"])).toEqual(["Doing", "Done"]);
    expect(heads()[0]?.querySelector(".ppp-gallery-group-count")?.textContent).toBe("2");
    expect(m.target.querySelectorAll("section.projects--gallery--grid")).toHaveLength(2);
    expect(m.cards()).toHaveLength(3);

    heads()[0]?.dispatchEvent(click());
    await tick();
    expect(m.onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ collapsedGroups: ["Doing"] }));
    expect(heads()[0]).toHaveAttribute("aria-expanded", "false");
    expect(m.cards().map((c) => c.dataset["pppCardId"])).toEqual(["notes/Beta.md"]);
    m.component.$destroy();
  });

  it("without a config writer a section folds for the session", async () => {
    const m = mount({ groupByField: "status" }, { onConfigChange: undefined });
    m.target.querySelector<HTMLElement>('[data-gallery-group="Done"]')?.dispatchEvent(click());
    await tick();
    expect(m.cards()).toHaveLength(2);
    m.component.$destroy();
  });

  it("a group field the frame lacks renders the plain gallery", () => {
    const m = mount({ groupByField: "gone" });
    expect(m.target.querySelector("[data-gallery-group]")).toBeNull();
    expect(m.cards()).toHaveLength(3);
    m.component.$destroy();
  });
});

describe("i3-gallery — compact, reserved lines, list chips", () => {
  it("compact: title only — no media, no properties, the title link stays", () => {
    const m = mount({ compact: true });
    expect(m.target.querySelector(".projects--gallery--card__media")).toBeNull();
    expect(m.target.querySelector(".field-label")).toBeNull();
    expect(m.cards()[0]?.querySelector("a.internal-link")).not.toBeNull();
    m.component.$destroy();
  });

  it("an empty property keeps its line in the grid, not in masonry", () => {
    const grid = mount();
    const beta = grid.cards()[1] as HTMLElement;
    expect(beta.querySelector('[data-card-meta-reserved="owner"]')).not.toBeNull();
    expect(beta.querySelectorAll(".field-label")).toHaveLength(2);
    grid.component.$destroy();
    const masonry = mount({ layout: "masonry" });
    expect(masonry.target.querySelector("[data-card-meta-reserved]")).toBeNull();
    masonry.component.$destroy();
  });

  it("a list of numbers renders as chips", () => {
    const m = mount({ includeFields: ["scores"] });
    const chips = Array.from(m.cards()[0]?.querySelectorAll("[data-card-meta-list] .ppp-card-meta-chip") ?? []).map((c) => c.textContent?.trim());
    expect(chips).toEqual(["3", "5"]);
    m.component.$destroy();
  });

  it("the image is lazy and decoded off the main thread", () => {
    app.set(makeApp());
    const m = mount({}, { frame: { fields: [status, coverField], records: [record("n.md", { cover: "https://example.com/c.png" })] } });
    const img = m.target.querySelector("img");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
    m.component.$destroy();
  });

  it("the cover preview falls back to the first embedded image; property does not", () => {
    app.set(makeApp({ "notes/Beta.md": [{ link: "b.jpg" }] }));
    const cover = mount();
    expect(cover.cards()[1]?.querySelector("img")).toHaveAttribute("src", "app://img/b.jpg");
    cover.component.$destroy();
    const property = mount({ cardPreview: "property" });
    expect(property.cards()[1]?.querySelector("img")).toBeNull();
    property.component.$destroy();
  });

  it("the content preview shows the first paragraph where there is no image", async () => {
    app.set(makeApp({}, { "notes/Gamma.md": "# G\n\nFirst words here.\n" }));
    const m = mount({ cardPreview: "content" });
    await Promise.resolve();
    await tick();
    expect(m.cards()[2]?.querySelector("[data-gallery-content-preview]")?.textContent).toBe("First words here.");
    m.component.$destroy();
  });
});

describe("i3-gallery — a large set renders progressively", () => {
  const many = Array.from({ length: 300 }, (_, i) => record(`n/${i}.md`, { status: i % 2 ? "Done" : "Doing" }));

  it("the first window, then the next on demand; a small set renders whole", async () => {
    const m = mount({}, { frame: { fields: [status], records: many } });
    expect(m.cards()).toHaveLength(GALLERY_WINDOW_STEP);
    const more = m.target.querySelector<HTMLElement>("[data-gallery-show-more]");
    expect(more).not.toBeNull();
    more?.dispatchEvent(click());
    await tick();
    expect(m.cards()).toHaveLength(GALLERY_WINDOW_STEP * 2);
    m.component.$destroy();

    const small = mount();
    expect(small.target.querySelector("[data-gallery-show-more]")).toBeNull();
    small.component.$destroy();
  });
});

describe("i3-gallery — the «Card» panel", () => {
  const open = async (m: ReturnType<typeof mount>) => {
    m.target.querySelector<HTMLElement>("[data-gallery-card-options]")?.dispatchEvent(click());
    await tick();
  };

  it("the width slider writes cardWidth on release, clamped and snapped; presets still work", async () => {
    const m = mount();
    await open(m);
    const slider = m.target.querySelector<HTMLInputElement>("[data-gcp-width]") as HTMLInputElement;
    expect(slider.type).toBe("range");
    slider.value = "347";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    expect(m.onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ cardWidth: 350 }));
    m.target.querySelector<HTMLElement>('[data-gcp-size="s"]')?.dispatchEvent(click());
    expect(m.onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ cardWidth: 200 }));
    m.component.$destroy();
  });

  it("group by, preview and compact write their keys; list fields are cover candidates", async () => {
    const tags = field("tags", DataFieldType.List, true);
    const m = mount({}, { frame: { fields: [status, coverField, tags, scores], records: BASE } });
    await open(m);
    const options = Array.from(m.target.querySelectorAll<HTMLOptionElement>("[data-gcp-cover] option")).map((o) => o.value);
    expect(options).toEqual(["", "cover", "tags"]);

    const group = m.target.querySelector<HTMLSelectElement>("[data-gcp-group]") as HTMLSelectElement;
    group.value = "status";
    group.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    expect(m.onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ groupByField: "status" }));
    expect(m.target.querySelector("[data-gallery-group]")).not.toBeNull();

    const preview = m.target.querySelector<HTMLSelectElement>("[data-gcp-preview]") as HTMLSelectElement;
    preview.value = "content";
    preview.dispatchEvent(new Event("change", { bubbles: true }));
    expect(m.onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ cardPreview: "content" }));

    m.target.querySelector<HTMLElement>("[data-gcp-compact]")?.dispatchEvent(click());
    await tick();
    expect(m.onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ compact: true }));
    expect(m.target.querySelector("[data-gcp-compact]")).toHaveAttribute("aria-checked", "true");
    m.component.$destroy();
  });

  it("dragging a shown property onto another reorders the card", async () => {
    const m = mount();
    await open(m);
    const item = (name: string) => m.target.querySelector<HTMLElement>(`[data-gcp-shown] [data-gcp-field="${name}"]`) as HTMLElement;
    expect(item("status")).toHaveAttribute("draggable", "true");
    const drag = (type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: { setData: jest.fn(), getData: () => "", effectAllowed: "", dropEffect: "" } });
      return event;
    };
    item("owner").dispatchEvent(drag("dragstart"));
    item("status").dispatchEvent(drag("dragover"));
    item("status").dispatchEvent(drag("drop"));
    await tick();
    expect(m.onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ includeFields: ["owner", "status"] }));
    m.component.$destroy();
  });
});
