/**
 * cards-g2: the gallery renders its cards through SharedCard, and nothing a
 * user does with a card changed.
 *
 * The real GalleryView is mounted with a real frame; only the edges a card
 * hands its work to are replaced: the record opener, the edit modal, the
 * mobile navigation menu and the hover preview. Structure is read off the
 * rendered DOM; behaviour is driven with real DOM events on the rendered
 * elements, including touch sequences on fake timers for the long press.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

import { DataFieldType } from "src/lib/dataframe/dataframe";

// Local aliases: under the jest.mock hoisting transform an imported binding
// may not appear in a type annotation.
type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;

// The opener, the editor and the two helpers are the card's outputs.
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

// GalleryOptionsProvider imports the layout through its barrel. Under Jest a
// re-exported `.svelte` default arrives as the module object (the svelte
// transformer's CJS output has no `__esModule`), so the barrel is bound to the
// compiled components; the production bundle is one ESM build and unaffected.
jest.mock("src/ui/components/Layout", () => ({
  ViewLayout: jest.requireActual("src/ui/components/Layout/ViewLayout.svelte").default,
  ViewContent: jest.requireActual("src/ui/components/Layout/ViewContent.svelte").default,
}));

// The shared obsidian-svelte mock renders nothing; the media's fallback is an
// Icon, so it is swapped for one that leaves a marked node where it mounts.
jest.mock("obsidian-svelte", () => ({
  ...jest.requireActual("src/__mocks__/obsidian-svelte.js"),
  Icon: MockIcon,
}));

/** Stands in for obsidian-svelte's Icon: a span carrying the icon's name. */
class MockIcon {
  $$: {
    fragment: { c(): void; m(target: Node, anchor?: Node | null): void; p(): void; d(detaching: boolean): void } | null;
    after_update: unknown[];
    on_mount: unknown[];
    on_destroy: unknown[];
    ctx: unknown[];
  };

  constructor(options: { props?: { name?: string } }) {
    const node = document.createElement("span");
    node.className = "mock-icon";
    node.dataset["icon"] = options.props?.name ?? "";
    this.$$ = {
      fragment: {
        c: () => undefined,
        m: (target, anchor) => {
          target.insertBefore(node, anchor ?? null);
        },
        p: () => undefined,
        d: (detaching) => {
          if (detaching) node.remove();
        },
      },
      after_update: [],
      on_mount: [],
      on_destroy: [],
      ctx: [],
    };
  }

  $set(): void {
    // No props change in these tests.
  }

  $on(): () => void {
    return () => undefined;
  }

  $destroy(): void {
    // Svelte's destroy_component removes the node through the fragment.
  }
}

type Mounted = { $destroy(): void };
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const { openRecord } = require("src/lib/record/openRecord") as { openRecord: jest.Mock };
const { EditNoteModal } = require("src/ui/modals/editNoteModal") as { EditNoteModal: jest.Mock };
const helpers = require("src/ui/views/helpers") as { showMobileNavMenu: jest.Mock; handleHoverLink: jest.Mock };
const { app } = require("src/lib/stores/obsidian") as { app: { set(value: unknown): void } };
const { watchViewport } = require("src/lib/stores/ui") as { watchViewport: () => () => void };
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

const records: DataRecord[] = [
  { id: "notes/Alpha.md", values: { status: "Doing", cover: COVER } },
  { id: "notes/Beta.md", values: { status: "Done" } },
];

/** Drive the shared pointer-type store the way the plugin does: through matchMedia. */
function setPointer(kind: "coarse" | "fine"): void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === `(pointer: ${kind})`,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  const stop = watchViewport();
  stop();
  window.matchMedia = original;
}

function mountGallery(props: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new GalleryView({
    target,
    props: {
      project: { autosave: true },
      frame: { fields: [status, cover], records },
      config: { coverField: "cover", includeFields: ["status"] },
      api: { updateRecord: jest.fn(), addRecord: jest.fn() },
      getRecordColor: (record: DataRecord) => (record.id === "notes/Alpha.md" ? "red" : null),
      readonly: true,
      ...props,
    },
  });
  const cards = () => Array.from(target.querySelectorAll<HTMLElement>(".projects--gallery--card"));
  const card = (i: number) => cards()[i] as HTMLElement;
  const media = (i: number) => card(i).querySelector<HTMLElement>(".projects--gallery--card__media") as HTMLElement;
  const link = (i: number) => card(i).querySelector<HTMLElement>("a.internal-link") as HTMLElement;
  return {
    cards,
    card,
    media,
    link,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

/** A touch event carrying `touches`; jsdom has no Touch constructor. */
function touch(type: string, x: number, y: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [{ clientX: x, clientY: y }] });
  return event;
}

const click = (init: MouseEventInit = {}) => new MouseEvent("click", { bubbles: true, cancelable: true, ...init });

beforeAll(() => {
  app.set({});
});

beforeEach(() => {
  openRecord.mockClear();
  EditNoteModal.mockClear();
  helpers.showMobileNavMenu.mockClear();
  helpers.handleHoverLink.mockClear();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("cards-g2 — a gallery card's structure", () => {
  it("one article per record, with the public card classes and no role or tabindex", () => {
    const m = mountGallery();
    expect(m.cards()).toHaveLength(2);
    for (const card of m.cards()) {
      expect(card.tagName).toBe("ARTICLE");
      expect(card).toHaveClass("projects--gallery--card", "ppp-shared-card");
      expect(card).not.toHaveAttribute("role");
      expect(card).not.toHaveAttribute("tabindex");
    }
    m.destroy();
  });

  it("media first, then the body, and nothing else", () => {
    const m = mountGallery();
    const lanes = Array.from(m.card(0).children);
    expect(lanes).toHaveLength(2);
    expect(lanes[0]).toHaveClass("projects--gallery--card__media");
    expect(lanes[1]).toHaveClass("projects--gallery--card__body");
    expect(lanes[1]?.firstElementChild).toHaveClass("color-item");
    m.destroy();
  });

  it("shows the cover image when there is one, the image icon when there is not", () => {
    const m = mountGallery();
    const img = m.media(0).querySelector("img");
    expect(img).toHaveAttribute("src", COVER);
    expect(m.media(0).querySelector(".mock-icon")).toBeNull();

    expect(m.media(1).querySelector("img")).toBeNull();
    const icon = m.media(1).querySelector(".mock-icon");
    expect(icon).toHaveAttribute("data-icon", "image");
    m.destroy();
  });

  it("the title link sits in the colour item's header and names the note", () => {
    const m = mountGallery();
    const link = m.link(0);
    expect(link.closest(".projects--gallery--card__body .color-item .card-header")).not.toBeNull();
    expect(link).toHaveAttribute("data-href", "notes/Alpha.md");
    expect(link.textContent?.trim()).toBe("Alpha");
    m.destroy();
  });

  it("shows the included fields under the title, and the record colour", () => {
    const m = mountGallery();
    const chip = m.card(0).querySelector(".card-layout .ppp-card-meta-chip");
    expect(chip?.textContent?.trim()).toBe("Doing");
    expect(m.card(0).querySelector<HTMLElement>(".color-item > span")?.style.backgroundColor).toBe("red");
    expect(m.card(1).querySelector(".color-item > span")).toBeNull();
    m.destroy();
  });
});

describe("chrome-filters — the card follows the saved field order", () => {
  const owner: DataField = { ...status, name: "owner" };
  const ordered: DataRecord[] = [{ id: "notes/Alpha.md", values: { status: "Doing", owner: "Ann", cover: COVER } }];
  const chips = (m: ReturnType<typeof mountGallery>) =>
    Array.from(m.card(0).querySelectorAll(".ppp-card-meta-chip")).map((el) => el.textContent?.trim());

  it("renders includeFields in their saved order, not the frame's", () => {
    // The frame lists status before owner; the saved order puts owner first.
    const m = mountGallery({
      frame: { fields: [status, owner, cover], records: ordered },
      config: { coverField: "cover", includeFields: ["owner", "status"] },
    });
    expect(chips(m)).toEqual(["Ann", "Doing"]);
    m.destroy();
  });

  it("a reordered config re-renders in the new order", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const component = new GalleryView({
      target,
      props: {
        project: { autosave: true },
        frame: { fields: [status, owner, cover], records: ordered },
        config: { coverField: "cover", includeFields: ["status", "owner"] },
        api: { updateRecord: jest.fn(), addRecord: jest.fn() },
        getRecordColor: () => null,
        readonly: true,
      },
    }) as Mounted & { $set(props: Record<string, unknown>): void };
    const read = () => Array.from(target.querySelectorAll(".ppp-card-meta-chip")).map((el) => el.textContent?.trim());
    expect(read()).toEqual(["Doing", "Ann"]);
    component.$set({ config: { coverField: "cover", includeFields: ["owner", "status"] } });
    await tick();
    expect(read()).toEqual(["Ann", "Doing"]);
    component.$destroy();
  });

  it("a saved name the frame lacks is skipped; nothing selected shows no fields", () => {
    const m = mountGallery({
      frame: { fields: [status, owner, cover], records: ordered },
      config: { coverField: "cover", includeFields: ["gone", "owner"] },
    });
    expect(chips(m)).toEqual(["Ann"]);
    m.destroy();
    const none = mountGallery({
      frame: { fields: [status, owner, cover], records: ordered },
      config: { coverField: "cover", includeFields: [] },
    });
    expect(chips(none)).toEqual([]);
    none.destroy();
  });
});

describe("cards-g2 — opening a card from its media", () => {
  it("a plain click opens the edit modal for that record", () => {
    const m = mountGallery();
    m.media(1).dispatchEvent(click());
    expect(EditNoteModal).toHaveBeenCalledTimes(1);
    expect(EditNoteModal.mock.calls[0]?.[3]).toBe(records[1]);
    const modal = EditNoteModal.mock.results[0]?.value as { open: jest.Mock };
    expect(modal.open).toHaveBeenCalledTimes(1);
    expect(openRecord).not.toHaveBeenCalled();
    m.destroy();
  });

  it("Shift opens the note in a window", () => {
    const m = mountGallery();
    m.media(0).dispatchEvent(click({ shiftKey: true }));
    expect(openRecord).toHaveBeenCalledWith({ id: "notes/Alpha.md", sourcePath: "" }, "window", expect.anything());
    expect(EditNoteModal).not.toHaveBeenCalled();
    m.destroy();
  });

  it("Ctrl or Meta opens the note in a tab", () => {
    const modifiers: MouseEventInit[] = [{ ctrlKey: true }, { metaKey: true }];
    for (const modifier of modifiers) {
      openRecord.mockClear();
      const m = mountGallery();
      m.media(0).dispatchEvent(click(modifier));
      expect(openRecord).toHaveBeenCalledTimes(1);
      expect(openRecord).toHaveBeenCalledWith({ id: "notes/Alpha.md", sourcePath: "" }, "tab", expect.anything());
      m.destroy();
    }
    expect(EditNoteModal).not.toHaveBeenCalled();
  });

  it("on a read-only data source a plain click opens the note instead of the editor", () => {
    const m = mountGallery({ dataReadOnly: true });
    m.media(0).dispatchEvent(click());
    expect(openRecord).toHaveBeenCalledWith({ id: "notes/Alpha.md" }, "same", expect.anything());
    expect(EditNoteModal).not.toHaveBeenCalled();
    m.destroy();
  });
});

describe("cards-g2 — long press on the media (touch)", () => {
  beforeAll(() => {
    setPointer("coarse");
  });
  afterAll(() => {
    setPointer("fine");
  });
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("opens the navigation menu after 500 ms, and its first entry opens the editor", () => {
    const m = mountGallery();
    m.media(0).dispatchEvent(touch("touchstart", 100, 100));
    jest.advanceTimersByTime(499);
    expect(helpers.showMobileNavMenu).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(helpers.showMobileNavMenu).toHaveBeenCalledTimes(1);
    const [, target, , onModal] = helpers.showMobileNavMenu.mock.calls[0] as [unknown, { id: string }, Event, () => void];
    expect(target).toEqual({ id: "notes/Alpha.md" });
    onModal();
    expect(EditNoteModal).toHaveBeenCalledTimes(1);
    m.destroy();
  });

  it("the release after a long press is cancelled, so no click follows it", () => {
    const m = mountGallery();
    m.media(0).dispatchEvent(touch("touchstart", 100, 100));
    jest.advanceTimersByTime(500);
    const release = touch("touchend", 100, 100);
    m.media(0).dispatchEvent(release);
    expect(release.defaultPrevented).toBe(true);
    m.destroy();
  });

  it("a click that still arrives after a long press opens nothing", () => {
    const m = mountGallery();
    m.media(0).dispatchEvent(touch("touchstart", 100, 100));
    jest.advanceTimersByTime(500);
    m.media(0).dispatchEvent(click());
    expect(EditNoteModal).not.toHaveBeenCalled();
    expect(openRecord).not.toHaveBeenCalled();
    // Only that one click: the next one opens the editor again.
    m.media(0).dispatchEvent(click());
    expect(EditNoteModal).toHaveBeenCalledTimes(1);
    m.destroy();
  });

  it("a short tap is not a long press: its release is not cancelled and the click opens", () => {
    const m = mountGallery();
    m.media(0).dispatchEvent(touch("touchstart", 100, 100));
    jest.advanceTimersByTime(200);
    const release = touch("touchend", 100, 100);
    m.media(0).dispatchEvent(release);
    jest.advanceTimersByTime(500);
    expect(release.defaultPrevented).toBe(false);
    expect(helpers.showMobileNavMenu).not.toHaveBeenCalled();
    m.media(0).dispatchEvent(click());
    expect(EditNoteModal).toHaveBeenCalledTimes(1);
    m.destroy();
  });

  it("moving more than 10 cancels the long press; 10 or less does not", () => {
    const m = mountGallery();
    m.media(0).dispatchEvent(touch("touchstart", 100, 100));
    m.media(0).dispatchEvent(touch("touchmove", 111, 100));
    jest.advanceTimersByTime(600);
    expect(helpers.showMobileNavMenu).not.toHaveBeenCalled();
    m.media(0).dispatchEvent(touch("touchend", 111, 100));

    m.media(0).dispatchEvent(touch("touchstart", 100, 100));
    m.media(0).dispatchEvent(touch("touchmove", 110, 90));
    jest.advanceTimersByTime(500);
    expect(helpers.showMobileNavMenu).toHaveBeenCalledTimes(1);
    m.destroy();
  });

  it("does nothing on a pointer that is not touch", () => {
    setPointer("fine");
    const m = mountGallery();
    m.media(0).dispatchEvent(touch("touchstart", 100, 100));
    jest.advanceTimersByTime(600);
    expect(helpers.showMobileNavMenu).not.toHaveBeenCalled();
    m.destroy();
    setPointer("coarse");
  });
});

describe("cards-g2 — the title link", () => {
  it("a plain click opens the editor, without also counting as a media click", () => {
    const m = mountGallery();
    m.link(0).dispatchEvent(click());
    expect(EditNoteModal).toHaveBeenCalledTimes(1);
    expect(openRecord).not.toHaveBeenCalled();
    m.destroy();
  });

  it("Shift opens a window and Ctrl a tab, with the link's own source path", () => {
    const m = mountGallery();
    m.link(0).dispatchEvent(click({ shiftKey: true }));
    expect(openRecord).toHaveBeenLastCalledWith(
      { id: "notes/Alpha.md", sourcePath: "notes/Alpha.md" },
      "window",
      expect.anything()
    );
    m.link(0).dispatchEvent(click({ ctrlKey: true }));
    expect(openRecord).toHaveBeenLastCalledWith(
      { id: "notes/Alpha.md", sourcePath: "notes/Alpha.md" },
      "tab",
      expect.anything()
    );
    expect(EditNoteModal).not.toHaveBeenCalled();
    m.destroy();
  });

  it("hovering it asks for the preview", () => {
    const m = mountGallery();
    m.link(0).dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(helpers.handleHoverLink).toHaveBeenCalledTimes(1);
    expect(helpers.handleHoverLink.mock.calls[0]?.[1]).toBe("notes/Alpha.md");
    m.destroy();
  });

  it("a long press on it opens the navigation menu for its note", () => {
    jest.useFakeTimers();
    try {
      const m = mountGallery();
      m.link(0).dispatchEvent(touch("touchstart", 100, 100));
      jest.advanceTimersByTime(500);
      expect(helpers.showMobileNavMenu).toHaveBeenCalledTimes(1);
      expect(helpers.showMobileNavMenu.mock.calls[0]?.[1]).toEqual({
        id: "notes/Alpha.md",
        sourcePath: "notes/Alpha.md",
      });
      m.destroy();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("cards-g2 — the gallery keeps rendering when records change", () => {
  it("re-renders the cards for a new frame", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const component = new GalleryView({
      target,
      props: {
        project: { autosave: true },
        frame: { fields: [status, cover], records },
        config: { coverField: "cover", includeFields: ["status"] },
        api: { updateRecord: jest.fn(), addRecord: jest.fn() },
        getRecordColor: () => null,
        readonly: true,
      },
    }) as Mounted & { $set(props: Record<string, unknown>): void };
    component.$set({ frame: { fields: [status, cover], records: records.slice(0, 1) } });
    await tick();
    expect(target.querySelectorAll("article.projects--gallery--card")).toHaveLength(1);
    component.$destroy();
  });
});
