/**
 * chrome-filters — the settings Filters tab is the one place a view is
 * filtered.
 *
 * The header filter row and its popup are gone, so this tab carries what they
 * did: a summary of the conditions narrowing the view, editing, Clear all, and
 * "Save as source" (#184) with every guard the row had — no enabled
 * condition, a read-only source, a blank name, a taken name. The real
 * SettingsMenuPopover is mounted; its two outputs are the `updateViewConfig`
 * and `saveFilterAsSource` events, the paths App.svelte persists through
 * `mergeViewConfig` and `handleSaveFilterAsSource`. "Reads back" is the
 * popover remounted (or re-propped) with what it emitted.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

type Mounted = {
  $destroy(): void;
  $set(props: Record<string, unknown>): void;
  $on(event: string, handler: (e: CustomEvent<unknown>) => void): () => void;
};
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

// The panel reaches the window it is in through Obsidian's global.
(globalThis as unknown as { activeDocument: Document }).activeDocument = document;

const SettingsMenuPopover = require("../SettingsMenuPopover.svelte").default as ComponentClass;

const FIELDS = [
  { name: "status", type: "string" },
  { name: "title", type: "string" },
];

const cond = (field: string, value: string, enabled = true) => ({ field, operator: "is", value, enabled });

function viewWith(filter: unknown) {
  return {
    id: "v1",
    name: "Board",
    type: "board",
    config: {},
    filter,
    colors: { conditions: [] },
    sort: { criteria: [] },
  };
}

const FOLDER = { kind: "folder", config: { path: "Work", recursive: false } };
const ACTIVE = {
  kind: "derived",
  id: "s-active",
  name: "Active",
  config: { from: "project", where: { conjunction: "and", conditions: [] } },
};

async function mount(filter: unknown, props: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new SettingsMenuPopover({
    target,
    props: {
      projects: [],
      projectId: "p1",
      views: [viewWith(filter)],
      viewId: "v1",
      position: { x: 0, y: 0 },
      fields: FIELDS,
      sources: [FOLDER, ACTIVE],
      ...props,
    },
  });
  const updates: Array<Record<string, unknown>> = [];
  const saved: string[] = [];
  let closed = 0;
  component.$on("updateViewConfig", (e) => updates.push(e.detail as Record<string, unknown>));
  component.$on("saveFilterAsSource", (e) => saved.push(e.detail as string));
  component.$on("close", () => (closed += 1));

  const tab = Array.from(target.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
    (b) => b.textContent?.trim() === "settings-menu.tabs.filters"
  );
  tab?.click();
  await tick();

  const q = <T extends Element>(sel: string) => target.querySelector<T>(sel);
  return {
    target,
    component,
    updates,
    saved,
    closed: () => closed,
    summary: () => q<HTMLElement>("[data-filters-summary] .ppp-filters-summary-text"),
    clear: () => q<HTMLButtonElement>('[data-filters-action="clear"]'),
    save: () => q<HTMLButtonElement>('[data-filters-action="save"]'),
    confirm: () => q<HTMLButtonElement>('[data-filters-action="save-confirm"]'),
    cancel: () => q<HTMLButtonElement>('[data-filters-action="save-cancel"]'),
    name: () => q<HTMLInputElement>(".ppp-filters-save-name"),
    error: () => q<HTMLElement>(".ppp-filters-save-error"),
    rows: () => target.querySelectorAll(".filter-row"),
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

type M = Awaited<ReturnType<typeof mount>>;

async function startNaming(m: M, value: string) {
  m.save()?.click();
  await tick();
  await tick();
  const el = m.name() as HTMLInputElement;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  return el;
}

const key = (k: string) => new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("chrome-filters — the summary of active conditions", () => {
  it("counts the enabled conditions, nested groups included", async () => {
    const m = await mount({
      conjunction: "and",
      conditions: [cond("status", "open"), cond("title", "x", false)],
      groups: [{ conjunction: "or", conditions: [cond("title", "y")] }],
    });
    expect(m.summary()).toHaveAttribute("data-filters-active", "2");
    expect(m.summary()?.textContent?.trim()).toBe("Active conditions: {{count}}");
    m.destroy();
  });

  it("says so when nothing is narrowing the view", async () => {
    const m = await mount({ conjunction: "and", conditions: [cond("status", "open", false)] });
    expect(m.summary()).toHaveAttribute("data-filters-active", "0");
    expect(m.summary()?.textContent?.trim()).toBe("No active conditions");
    m.destroy();
  });

  it("follows the view's filter as it is saved", async () => {
    const m = await mount({ conjunction: "and", conditions: [cond("status", "open")] });
    m.component.$set({ views: [viewWith({ conjunction: "and", conditions: [cond("status", "open"), cond("title", "x")] })] });
    await tick();
    expect(m.summary()).toHaveAttribute("data-filters-active", "2");
    m.destroy();
  });
});

describe("chrome-filters — editing in the tab", () => {
  it("the full filter editor is here and its edits reach the view config", async () => {
    const m = await mount({ conjunction: "and", conditions: [cond("status", "open")] });
    expect(m.rows()).toHaveLength(1);
    m.target.querySelector<HTMLButtonElement>(".filter-row .row-toggle")?.click();
    await tick();
    expect(m.updates).toHaveLength(1);
    const filter = m.updates[0]?.["filter"] as { conditions: Array<{ enabled: boolean }> };
    expect(filter.conditions[0]?.enabled).toBe(false);
    m.destroy();
  });

  it("an edit written back reads back into the panel", async () => {
    const m = await mount({ conjunction: "and", conditions: [cond("status", "open")] });
    m.target.querySelector<HTMLButtonElement>(".add-actions .add-btn")?.click();
    await tick();
    const written = m.updates[m.updates.length - 1]?.["filter"];
    m.destroy();
    const reopened = await mount(written);
    expect(reopened.rows()).toHaveLength(2);
    expect(reopened.summary()).toHaveAttribute("data-filters-active", "2");
    reopened.destroy();
  });
});

describe("chrome-filters — Clear all", () => {
  it("writes an empty filter and empties the panel", async () => {
    const m = await mount({
      conjunction: "or",
      conditions: [cond("status", "open"), cond("title", "x")],
      groups: [{ conjunction: "and", conditions: [cond("title", "y")] }],
    });
    m.clear()?.click();
    await tick();
    expect(m.updates).toEqual([{ filter: { conjunction: "and", conditions: [] } }]);
    // The panel remounts on the clear rather than keeping its old copy.
    expect(m.rows()).toHaveLength(0);
    m.component.$set({ views: [viewWith({ conjunction: "and", conditions: [] })] });
    await tick();
    expect(m.summary()).toHaveAttribute("data-filters-active", "0");
    expect(m.clear()).toBeNull();
    m.destroy();
  });

  it("is absent when there is nothing to clear", async () => {
    const m = await mount({ conjunction: "and", conditions: [] });
    expect(m.clear()).toBeNull();
    m.destroy();
  });

  it("is offered for disabled conditions too: they are still stored", async () => {
    const m = await mount({ conjunction: "and", conditions: [cond("status", "open", false)] });
    expect(m.clear()).not.toBeNull();
    m.destroy();
  });
});

describe("chrome-filters — Save as source: when it is offered", () => {
  it("is absent with no filter at all", async () => {
    const m = await mount(undefined);
    expect(m.save()).toBeNull();
    m.destroy();
  });

  it("is absent when no condition is enabled", async () => {
    const m = await mount({ conjunction: "and", conditions: [cond("status", "open", false)] });
    expect(m.save()).toBeNull();
    m.destroy();
  });

  it("is absent on a read-only source", async () => {
    const m = await mount({ conjunction: "and", conditions: [cond("status", "open")] }, { readonly: true });
    expect(m.save()).toBeNull();
    m.destroy();
  });

  it("appears once a condition is narrowing a writable view", async () => {
    const m = await mount({ conjunction: "and", conditions: [cond("status", "open")] });
    expect(m.save()).not.toBeNull();
    expect(m.save()?.textContent?.trim()).toBe("Save as source");
    m.destroy();
  });
});

describe("chrome-filters — Save as source: naming it", () => {
  const narrowing = { conjunction: "and", conditions: [cond("status", "open")] };

  it("asks for a name before saving anything", async () => {
    const m = await mount(narrowing);
    m.save()?.click();
    await tick();
    expect(m.name()).not.toBeNull();
    expect(m.saved).toEqual([]);
    m.destroy();
  });

  it("Enter forwards the trimmed name, once, and does not touch the filter", async () => {
    const m = await mount(narrowing);
    const el = await startNaming(m, "  Open items  ");
    el.dispatchEvent(key("Enter"));
    await tick();
    expect(m.saved).toEqual(["Open items"]);
    expect(m.updates).toEqual([]);
    expect(m.name()).toBeNull();
    m.destroy();
  });

  it("the Save button forwards it the same way", async () => {
    const m = await mount(narrowing);
    await startNaming(m, "Open items");
    m.confirm()?.click();
    await tick();
    expect(m.saved).toEqual(["Open items"]);
    m.destroy();
  });

  it("Escape abandons the name and keeps the settings panel open", async () => {
    const m = await mount(narrowing);
    const el = await startNaming(m, "typed then abandoned");
    el.dispatchEvent(key("Escape"));
    await tick();
    expect(m.name()).toBeNull();
    expect(m.saved).toEqual([]);
    expect(m.closed()).toBe(0);
    // With no name being typed, Escape closes the panel as it always did.
    document.dispatchEvent(key("Escape"));
    expect(m.closed()).toBe(1);
    m.destroy();
  });

  it("Cancel abandons it too", async () => {
    const m = await mount(narrowing);
    await startNaming(m, "abandoned");
    m.cancel()?.click();
    await tick();
    expect(m.name()).toBeNull();
    expect(m.saved).toEqual([]);
    m.destroy();
  });

  it("a blank name is a cancel, not an unnamed source", async () => {
    const m = await mount(narrowing);
    const el = await startNaming(m, "   ");
    el.dispatchEvent(key("Enter"));
    await tick();
    expect(m.saved).toEqual([]);
    expect(m.name()).toBeNull();
    m.destroy();
  });

  it("a taken name is refused in place, whatever its case or spacing", async () => {
    const m = await mount(narrowing);
    const el = await startNaming(m, " active ");
    el.dispatchEvent(key("Enter"));
    await tick();
    expect(m.saved).toEqual([]);
    // Still naming, with the reason beside the field.
    expect(m.name()).not.toBeNull();
    expect(m.name()).toHaveAttribute("aria-invalid", "true");
    expect(m.error()?.textContent?.trim()).toBe("views.filter.bar.save-name-taken");
    m.destroy();
  });

  it("a name taken by a folder source's label is refused too", async () => {
    const m = await mount(narrowing);
    const el = await startNaming(m, "Work");
    el.dispatchEvent(key("Enter"));
    await tick();
    expect(m.saved).toEqual([]);
    m.destroy();
  });

  it("after a refusal, a new name goes through and the error clears", async () => {
    const m = await mount(narrowing);
    const el = await startNaming(m, "Active");
    el.dispatchEvent(key("Enter"));
    await tick();
    el.value = "Open items";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
    expect(m.error()).toBeNull();
    el.dispatchEvent(key("Enter"));
    await tick();
    expect(m.saved).toEqual(["Open items"]);
    m.destroy();
  });

  it("a name saved here is taken next time: the new source reads back as a guard", async () => {
    const m = await mount(narrowing);
    const el = await startNaming(m, "Open items");
    el.dispatchEvent(key("Enter"));
    await tick();
    const name = m.saved[0];
    m.destroy();
    // App appends `buildDerivedSource(name, …)` to the project's sources.
    const withNew = [FOLDER, ACTIVE, { kind: "derived", id: "s-new", name, config: { from: "project", where: narrowing } }];
    const again = await mount(narrowing, { sources: withNew });
    const input = await startNaming(again, "open ITEMS");
    input.dispatchEvent(key("Enter"));
    await tick();
    expect(again.saved).toEqual([]);
    again.destroy();
  });
});
