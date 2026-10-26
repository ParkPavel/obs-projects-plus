/**
 * B9 — the gallery as Notion has it: a tap opens the record in the peek, a
 * visible "⋯" carries the card menu, the «Card» panel edits the view config
 * from the gallery itself, and a broken cover says how to fix it. The mocked
 * edges are the ones galleryCard.test.ts replaces.
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
const helpers = require("src/ui/views/helpers") as { showMobileNavMenu: jest.Mock; handleHoverLink: jest.Mock };
const { app } = require("src/lib/stores/obsidian") as { app: { set(value: unknown): void } };
const GalleryView = require("../GalleryView.svelte").default as ComponentClass;


const COVER = "https://example.com/cover.png";

const status: DataField = {
  name: "status",
  type: DataFieldType.Select,
  repeated: false,
  identifier: false,
  derived: false,
};
// A Select, not a String: a Text cell needs the real obsidian Component.
const owner: DataField = { ...status, name: "owner" };
const cover: DataField = { ...status, name: "cover", type: DataFieldType.String };

const records: DataRecord[] = [
  { id: "notes/Alpha.md", values: { status: "Doing", owner: "Ann", cover: COVER } },
  { id: "notes/Beta.md", values: { status: "Done", owner: "Bob", cover: "images/missing.png" } },
  { id: "notes/Gamma.md", values: { status: "Done" } },
];

type Mountable = Mounted & { $set(props: Record<string, unknown>): void };

function mount(props: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onConfigChange = jest.fn();
  const component = new GalleryView({
    target,
    props: {
      project: { autosave: true },
      frame: { fields: [status, owner, cover], records },
      config: { coverField: "cover", includeFields: ["status"] },
      api: { updateRecord: jest.fn(), addRecord: jest.fn() },
      getRecordColor: () => null,
      onConfigChange,
      ...props,
    },
  }) as Mountable;
  const card = (i: number) => target.querySelectorAll<HTMLElement>(".projects--gallery--card")[i] as HTMLElement;
  return { target, component, card, onConfigChange };
}

const click = (init: MouseEventInit = {}) => new MouseEvent("click", { bubbles: true, cancelable: true, ...init });

beforeAll(() => {
  // Only a vault path needs the metadata cache: none of them resolves, which
  // is what a moved or mistyped cover looks like.
  app.set({ metadataCache: { getFirstLinkpathDest: () => null }, vault: { getResourcePath: () => "" } });
});

beforeEach(() => {
  openRecord.mockClear();
  helpers.showMobileNavMenu.mockClear();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("B9 — a tap on a gallery card opens the record in the peek", () => {
  it("a plain click on the card body opens the peek for that record, not the editor", () => {
    const m = mount();
    m.card(0).querySelector<HTMLElement>(".projects--gallery--card__body")?.dispatchEvent(click());
    expect(openRecord).toHaveBeenCalledTimes(1);
    expect(openRecord).toHaveBeenCalledWith(expect.objectContaining({ id: "notes/Alpha.md" }), "peek", expect.anything());
    m.component.$destroy();
  });

  it("a plain click on the cover opens the peek too, once", () => {
    const m = mount();
    m.card(1).querySelector<HTMLElement>(".projects--gallery--card__media")?.dispatchEvent(click());
    expect(openRecord).toHaveBeenCalledTimes(1);
    expect(openRecord).toHaveBeenCalledWith(expect.objectContaining({ id: "notes/Beta.md" }), "peek", expect.anything());
    m.component.$destroy();
  });

  it("Shift and Ctrl keep their window and tab routes", () => {
    const m = mount();
    const body = m.card(0).querySelector<HTMLElement>(".projects--gallery--card__body") as HTMLElement;
    body.dispatchEvent(click({ shiftKey: true }));
    expect(openRecord).toHaveBeenLastCalledWith(expect.objectContaining({ id: "notes/Alpha.md" }), "window", expect.anything());
    body.dispatchEvent(click({ ctrlKey: true }));
    expect(openRecord).toHaveBeenLastCalledWith(expect.objectContaining({ id: "notes/Alpha.md" }), "tab", expect.anything());
    m.component.$destroy();
  });

  it("a click on a chip does not open the card", () => {
    const m = mount();
    m.card(0).querySelector<HTMLElement>(".ppp-card-meta-chip")?.dispatchEvent(click());
    expect(openRecord).not.toHaveBeenCalled();
    m.component.$destroy();
  });

  it("a read-only data source peeks read-only", () => {
    const m = mount({ dataReadOnly: true });
    m.card(0).querySelector<HTMLElement>(".projects--gallery--card__body")?.dispatchEvent(click());
    expect(openRecord).toHaveBeenCalledWith(expect.objectContaining({ id: "notes/Alpha.md", readonly: true }), "peek", expect.anything());
    m.component.$destroy();
  });

  it("every card has a visible ⋯ that opens the card menu, without opening the card", () => {
    const m = mount();
    const more = m.card(2).querySelector<HTMLElement>("[data-gallery-card-more]");
    expect(more).not.toBeNull();
    expect(more?.tagName).toBe("BUTTON");
    more?.dispatchEvent(click());
    expect(helpers.showMobileNavMenu).toHaveBeenCalledTimes(1);
    expect(helpers.showMobileNavMenu.mock.calls[0]?.[1]).toEqual({ id: "notes/Gamma.md" });
    expect(openRecord).not.toHaveBeenCalled();
    // Its first entry is the editor, as with the long press.
    (helpers.showMobileNavMenu.mock.calls[0]?.[3] as () => void)();
    // i3-close: the editor entry is the properties block in the peek.
    expect(openRecord).toHaveBeenLastCalledWith(expect.objectContaining({ id: "notes/Gamma.md" }), "peek", expect.anything());
    m.component.$destroy();
  });
});

describe("B9 — the «Card» panel writes the view's config and the gallery follows", () => {
  const openPanel = (m: ReturnType<typeof mount>) => {
    m.target.querySelector<HTMLElement>("[data-gallery-card-options]")?.dispatchEvent(click());
    return tick();
  };

  it("no panel button without a config writer", () => {
    const m = mount({ onConfigChange: undefined });
    expect(m.target.querySelector("[data-gallery-card-options]")).toBeNull();
    m.component.$destroy();
  });

  // w4-p10a (N12, Codex design D): an inspector over the gallery, not a block
  // in its flow at a phone's width that pushed the cards down.
  it("the panel opens as an inspector over the gallery, outside its flow", async () => {
    const m = mount();
    await openPanel(m);
    const panel = document.querySelector<HTMLElement>("[data-gallery-card-panel]")!;
    const popup = panel.closest(".ppp-popup--floating");
    expect(popup).not.toBeNull();
    expect(popup!.getAttribute("role")).toBe("dialog");
    expect(popup!.parentElement).toBe(document.body);
    expect(m.target.contains(panel)).toBe(false);
    m.component.$destroy();
  });

  it("layout: list is saved and the grid re-renders as a list", async () => {
    const m = mount();
    await openPanel(m);
    expect(document.querySelector("[data-gallery-card-panel]")).not.toBeNull();
    document.querySelector<HTMLElement>('[data-gcp-layout="list"]')?.dispatchEvent(click());
    await tick();
    expect(m.onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ layout: "list", coverField: "cover" }));
    expect(m.target.querySelector(".projects--gallery--grid")).toHaveClass("ppp-gallery--list");
    m.component.$destroy();
  });

  it("size: Large writes cardWidth 400", async () => {
    const m = mount();
    await openPanel(m);
    document.querySelector<HTMLElement>('[data-gcp-size="l"]')?.dispatchEvent(click());
    await tick();
    expect(m.onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ cardWidth: 400 }));
    expect(document.querySelector('[data-gcp-size="l"]')).toHaveAttribute("aria-pressed", "true");
    m.component.$destroy();
  });

  it("properties: showing one adds its chip, moving it reorders the card", async () => {
    const m = mount();
    await openPanel(m);
    const chips = () => Array.from(m.card(0).querySelectorAll(".field-label")).map((el) => el.textContent?.replace(/\s+/g, " ").trim());
    expect(chips()).toEqual(["status Doing"]);
    document.querySelector<HTMLElement>('[data-gcp-hidden] [data-gcp-field="owner"] [data-gcp-action="show"]')?.dispatchEvent(click());
    await tick();
    expect(m.onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ includeFields: ["status", "owner"] }));
    expect(chips()).toEqual(["status Doing", "owner Ann"]);
    document.querySelector<HTMLElement>('[data-gcp-shown] [data-gcp-field="owner"] [data-gcp-action="up"]')?.dispatchEvent(click());
    await tick();
    expect(m.onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ includeFields: ["owner", "status"] }));
    expect(chips()).toEqual(["owner Ann", "status Doing"]);
    m.component.$destroy();
  });

  it("cover: choosing none removes the cover field; fit writes fitStyle", async () => {
    const m = mount();
    await openPanel(m);
    document.querySelector<HTMLElement>('[data-gcp-fit="contain"]')?.dispatchEvent(click());
    await tick();
    expect(m.onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ fitStyle: "contain" }));
    const select = document.querySelector<HTMLSelectElement>("[data-gcp-cover]") as HTMLSelectElement;
    select.value = "";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    expect(m.onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ coverField: undefined }));
    m.component.$destroy();
  });
});

describe("B9 — a broken cover says so and where to fix it", () => {
  it("an unresolved path shows the fallback naming the field and the path", () => {
    const m = mount();
    const media = m.card(1).querySelector<HTMLElement>(".projects--gallery--card__media") as HTMLElement;
    const broken = media.querySelector("[data-cover-broken]");
    expect(broken).not.toBeNull();
    expect(media.querySelector("img")).toBeNull();
    // The test i18n renders keys: the hint is there, and the path is on the node.
    expect(broken?.textContent).toContain("cover-broken-hint");
    expect(broken).toHaveAttribute("title", "images/missing.png");
    // A record with no cover value keeps the plain placeholder.
    expect(m.card(2).querySelector("[data-cover-broken]")).toBeNull();
    m.component.$destroy();
  });

  it("an image that fails to load turns into the same fallback", async () => {
    const m = mount();
    const img = m.card(0).querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    img.dispatchEvent(new Event("error"));
    await tick();
    expect(m.card(0).querySelector("img")).toBeNull();
    expect(m.card(0).querySelector("[data-cover-broken]")).not.toBeNull();
    m.component.$destroy();
  });
});
