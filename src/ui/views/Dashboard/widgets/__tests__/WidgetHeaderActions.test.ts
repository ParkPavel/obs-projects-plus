/**
 * WidgetHeaderActions.test.ts — B7: the block header has ONE control, «⋯»,
 * and every block action is an entry in it that dispatches the host's
 * existing command.
 */

import "@testing-library/jest-dom";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return {
    i18n: writable({
      t: (key: string, options?: { defaultValue?: string }) =>
        options?.defaultValue ?? key,
    }),
  };
});

jest.mock("src/lib/contextMenu", () => ({ openContextMenu: jest.fn() }));

const { openContextMenu } = require("src/lib/contextMenu");
const WidgetHeaderActions = require("../WidgetHeaderActions.svelte").default;

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new WidgetHeaderActions({
    target,
    props: { readonly: false, hasCog: true, hasPipeline: true, ...props },
  });
  return {
    component,
    target,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

function click(target: HTMLElement, selector: string) {
  const el = target.querySelector(selector);
  if (!el) throw new Error(`Expected ${selector} to exist`);
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

type Entry = { title?: string; separator?: boolean; danger?: boolean; onClick?: () => void };

function openMenu(target: HTMLElement): Entry[] {
  (openContextMenu as jest.Mock).mockClear();
  click(target, ".ppp-widget-menu-btn");
  return (openContextMenu as jest.Mock).mock.calls[0][0] as Entry[];
}

const titles = (entries: Entry[]) => entries.filter((e) => !e.separator).map((e) => e.title);

describe("WidgetHeaderActions — B7 one block menu", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the «⋯» button and no other header action buttons", () => {
    const { target, destroy } = mount({});
    expect(target.querySelectorAll("button")).toHaveLength(1);
    expect(target.querySelector(".ppp-widget-menu-btn")).not.toBeNull();
    for (const gone of [".ppp-widget-settings-btn", ".ppp-widget-pipeline-btn", ".ppp-widget-lock-btn", ".ppp-widget-remove-btn"]) {
      expect(target.querySelector(gone)).toBeNull();
    }
    destroy();
  });

  it("renders nothing actionable in readonly mode", () => {
    const { target, destroy } = mount({ readonly: true });
    expect(target.querySelectorAll("button")).toHaveLength(0);
    destroy();
  });

  it("i2-model (N27): a database block menu is seven plain entries, data steps behind «More…»", () => {
    const { target, destroy } = mount({ isDatabase: true });
    expect(titles(openMenu(target))).toEqual([
      "Rename",
      "Source and settings…",
      "Filter for all views of this block…",
      "More…",
      "Collapse",
      "Duplicate",
      "Delete block",
    ]);
    destroy();
  });

  it("each entry dispatches the host's existing command", () => {
    const { component, target, destroy } = mount({ isDatabase: true });
    const events: string[] = [];
    for (const name of ["rename", "toggleConfig", "filter", "togglePipeline", "toggleCollapse", "duplicate", "remove"]) {
      component.$on(name, (e: CustomEvent) => events.push(e.detail ? `${name}:${String(e.detail)}` : name));
    }
    for (const entry of openMenu(target)) entry.onClick?.();
    expect(events).toEqual([
      "rename", "toggleConfig", "filter", "togglePipeline",
      "toggleCollapse", "duplicate", "remove",
    ]);
    destroy();
  });

  it("a stored pipeline stays reachable on any block, under its step count", () => {
    const { component, target, destroy } = mount({ isDatabase: false, hasCog: false, pipelineStepCount: 2 });
    const events: unknown[] = [];
    component.$on("togglePipeline", (e: CustomEvent) => events.push(e.detail));
    const entry = openMenu(target).find((e) => e.title === "Data steps (2)…");
    expect(entry).toBeDefined();
    entry!.onClick!();
    expect(events).toEqual([null]);
    destroy();
  });

  it("collapsed and pinned states read as their opposite action, and a pin is marked", () => {
    const { target, destroy } = mount({ locked: true, collapsed: true });
    const t = titles(openMenu(target));
    expect(t).toContain("Expand");
    expect(t).toContain("Unpin position");
    expect(target.querySelector(".ppp-widget-locked-mark")).not.toBeNull();
    destroy();
  });

  it("delete is the last entry and is marked dangerous", () => {
    const { target, destroy } = mount({});
    const last = openMenu(target).at(-1)!;
    expect(last.title).toBe("Delete block");
    expect(last.danger).toBe(true);
    destroy();
  });
});
