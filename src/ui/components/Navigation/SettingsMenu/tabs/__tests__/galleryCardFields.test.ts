import "@testing-library/jest-dom";
import { readFileSync } from "fs";
import { join } from "path";
import { tick } from "svelte";

/**
 * chrome-filters — "Fields on the card": one section of the gallery's View
 * settings that says which fields a card shows, in the order it shows them,
 * whether their names are shown, and which fields could be added. Each control
 * emits one `includeFields` array (or `showFieldLabels`) through the tab's
 * `update` event, the path SettingsMenuPopover persists; the saved value is
 * read back by remounting with it.
 */

type Mounted = {
  $destroy(): void;
  $set(props: Record<string, unknown>): void;
  $on(event: string, handler: (e: CustomEvent<Record<string, unknown>>) => void): () => void;
};
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const ViewConfigTab = require("../ViewConfigTab.svelte").default as ComponentClass;

const FIELDS = [
  { name: "status", type: "string" },
  { name: "cover", type: "string" },
  { name: "due", type: "date" },
  { name: "total", type: "number", derived: true },
];

function galleryView(config: Record<string, unknown> = {}) {
  return {
    name: "Gallery",
    id: "view-gallery",
    type: "gallery",
    config,
    filter: { conjunction: "and", conditions: [] },
    colors: { conditions: [] },
    sort: { criteria: [] },
  };
}

function mount(config: Record<string, unknown> = {}, fields = FIELDS) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new ViewConfigTab({ target, props: { view: galleryView(config), fields } });
  const updates: Record<string, unknown>[] = [];
  component.$on("update", (e) => updates.push(e.detail));
  const section = () => target.querySelector<HTMLElement>('[data-gallery-section="card-fields"]') as HTMLElement;
  const shown = () =>
    Array.from(section().querySelectorAll<HTMLElement>("[data-gallery-card-field]")).map((el) => el.dataset["galleryCardField"]);
  const available = () =>
    Array.from(section().querySelectorAll<HTMLElement>("[data-gallery-available-field]")).map((el) => el.dataset["galleryAvailableField"]);
  const action = (name: string, act: string) =>
    section().querySelector<HTMLButtonElement>(
      `[data-gallery-card-field="${name}"] [data-gallery-field-action="${act}"], [data-gallery-available-field="${name}"] [data-gallery-field-action="${act}"]`
    ) as HTMLButtonElement;
  return {
    target,
    component,
    updates,
    section,
    shown,
    available,
    action,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("chrome-filters — the section lists what a card shows, in its order", () => {
  it("selected fields in the saved order, the rest below in frame order", () => {
    const m = mount({ includeFields: ["due", "status"] });
    expect(m.shown()).toEqual(["due", "status"]);
    expect(m.available()).toEqual(["cover", "total"]);
    expect(m.updates).toEqual([]);
    m.destroy();
  });

  it("a saved name the frame no longer has is not listed", () => {
    const m = mount({ includeFields: ["gone", "status"] });
    expect(m.shown()).toEqual(["status"]);
    m.destroy();
  });

  it("marks each field's kind: ƒ for a computed field, the type otherwise", () => {
    const m = mount({ includeFields: ["total", "due"] });
    const kind = (name: string) =>
      m.section().querySelector<HTMLElement>(`[data-gallery-card-field="${name}"] .card-field-kind`) as HTMLElement;
    expect(kind("total")).toHaveAttribute("data-gallery-field-kind", "derived");
    expect(kind("total").textContent?.trim()).toBe("ƒ");
    expect(kind("due")).toHaveAttribute("data-gallery-field-kind", "date");
    m.destroy();
  });

  it("an explicit empty state when nothing is selected", () => {
    const m = mount({ includeFields: [] });
    const empty = m.section().querySelector("[data-gallery-card-fields-empty]");
    expect(empty).not.toBeNull();
    expect(empty?.textContent?.trim()).toBe("settings-menu.view-config.gallery.card-fields-empty");
    expect(m.section().querySelector("[data-gallery-card-fields]")).toBeNull();
    expect(m.available()).toEqual(["status", "cover", "due", "total"]);
    m.destroy();
  });

  it("the empty state goes as soon as a field is selected", async () => {
    const m = mount({ includeFields: [] });
    m.component.$set({ view: galleryView({ includeFields: ["cover"] }) });
    await tick();
    expect(m.section().querySelector("[data-gallery-card-fields-empty]")).toBeNull();
    expect(m.shown()).toEqual(["cover"]);
    m.destroy();
  });
});

describe("chrome-filters — reordering emits includeFields", () => {
  it("move down and move up swap neighbours", () => {
    const m = mount({ includeFields: ["status", "due", "cover"] });
    m.action("status", "down").click();
    m.action("cover", "up").click();
    expect(m.updates).toEqual([
      { includeFields: ["due", "status", "cover"] },
      { includeFields: ["status", "cover", "due"] },
    ]);
    m.destroy();
  });

  it("the first row cannot move up and the last cannot move down", () => {
    const m = mount({ includeFields: ["status", "due"] });
    expect(m.action("status", "up")).toBeDisabled();
    expect(m.action("due", "down")).toBeDisabled();
    expect(m.action("status", "down")).not.toBeDisabled();
    m.action("status", "up").click();
    expect(m.updates).toEqual([]);
    m.destroy();
  });

  it("a stale saved name does not swallow a move, and keeps its place", () => {
    const m = mount({ includeFields: ["status", "gone", "due"] });
    m.action("due", "up").click();
    expect(m.updates).toEqual([{ includeFields: ["due", "gone", "status"] }]);
    m.destroy();
  });

  it("every move button is labelled with its field", () => {
    const m = mount({ includeFields: ["status"] });
    expect(m.action("status", "up")).toHaveAttribute("aria-label", "settings-menu.view-config.gallery.move-up");
    expect(m.action("status", "down")).toHaveAttribute("aria-label", "settings-menu.view-config.gallery.move-down");
    m.destroy();
  });

  it("the saved order reads back into the list", async () => {
    const m = mount({ includeFields: ["status", "due"] });
    m.action("status", "down").click();
    const saved = Object.assign({ includeFields: ["status", "due"] }, ...m.updates) as Record<string, unknown>;
    m.destroy();
    const reopened = mount(saved);
    await tick();
    expect(reopened.shown()).toEqual(["due", "status"]);
    reopened.destroy();
  });
});

describe("chrome-filters — visibility: remove and add", () => {
  it("remove takes the field off the card", () => {
    const m = mount({ includeFields: ["status", "due"] });
    m.action("status", "remove").click();
    expect(m.updates).toEqual([{ includeFields: ["due"] }]);
    m.destroy();
  });

  it("add appends the field at the end of the card", () => {
    const m = mount({ includeFields: ["due"] });
    m.action("total", "add").click();
    expect(m.updates).toEqual([{ includeFields: ["due", "total"] }]);
    m.destroy();
  });
});

describe("chrome-filters — the labels toggle lives in the same section", () => {
  it("is inside Fields on the card and emits showFieldLabels", () => {
    const m = mount({ includeFields: ["status"] });
    const labels = m.section().querySelector<HTMLInputElement>('input[data-gallery-option="labels"]');
    expect(labels).not.toBeNull();
    expect(labels?.checked).toBe(true);
    labels?.click();
    expect(m.updates).toEqual([{ showFieldLabels: false }]);
    // One labels toggle in the whole tab, so there is one place to look.
    expect(m.target.querySelectorAll('input[data-gallery-option="labels"]')).toHaveLength(1);
    m.destroy();
  });

  it("the old checkbox list of every field is gone", () => {
    const m = mount({ includeFields: ["status"] });
    expect(m.section().querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
    m.destroy();
  });

  it("the tab emits includeFields and never binds to a reactive declaration", () => {
    // R0.34 shape, checked at the source: the section's state is read from
    // `$:` declarations and written only through emitUpdate.
    const source = readFileSync(join(__dirname, "..", "ViewConfigTab.svelte"), "utf8");
    expect(source).not.toMatch(/bind:\w+=\{(cardFields|availableCardFields|galleryIncludeFields)\}/);
    expect(source).toMatch(/emitUpdate\(\{ includeFields: moveIncludedField\(/);
  });
});
