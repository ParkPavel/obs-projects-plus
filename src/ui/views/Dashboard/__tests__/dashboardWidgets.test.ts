// dashboardWidgets.test.ts — removeWidget's undo affordance.
//
// One click on the trash icon or the widget menu used to delete a block with
// no way back (live acceptance, scene 5). This pins: the widget is gone from
// the saved config immediately, a Notice with an "Undo" control appears, and
// clicking Undo restores the exact widget at `min(originalIndex, length)` of
// whatever the widget list looks like at click time — not a stale snapshot.
//
// `obsidian` is mocked locally with `require()` after `jest.mock()`, the same
// order PopoverList.test.ts uses — esbuild-jest does not hoist `import`
// above `jest.mock()` the way babel-jest does, so the module under test must
// be pulled in with `require()` AFTER the mock is registered.

import { get, writable } from "svelte/store";

jest.mock("obsidian", () => ({
  Notice: jest.fn().mockImplementation(function (
    this: { message: string | DocumentFragment; duration: number | undefined; hide: () => void },
    message: string | DocumentFragment,
    duration?: number
  ) {
    this.message = message;
    this.duration = duration;
    this.hide = jest.fn();
  }),
}));

const { Notice } = require("obsidian");
const { createWidgetController } = require("../dashboardWidgets");
// Type-only aliases rather than `import type`: a file with jest.mock() goes
// through babel for hoisting, which cannot strip an imported binding used
// only in annotations.
type DatabaseViewConfig = import("../types").DatabaseViewConfig;
type WidgetDefinition = import("../types").WidgetDefinition;
type WidgetType = import("../types").WidgetType;

const NoticeMock = Notice as jest.Mock;

function makeConfig(widgets: WidgetDefinition[] = []): DatabaseViewConfig {
  return {
    widgets,
    layoutMode: "free",
    layoutVersion: 2,
    table: {} as never,
    showWidgetToolbar: false,
    compactMode: false,
  };
}

function widget(id: string, title = id): WidgetDefinition {
  return { id, type: "stats" as WidgetType, title, layout: { x: 0, y: 0, w: 1, h: 1 }, config: {} };
}

// Minimal i18n store double: returns the key's defaultValue with `{{name}}`
// filled from options, the way i18next interpolates in production.
function makeI18nStore() {
  return writable({
    t: (key: string, options?: Record<string, unknown>) =>
      ((options?.["defaultValue"] as string | undefined) ?? key).replace(
        /\{\{(\w+)\}\}/g,
        (_, name: string) => String(options?.[name] ?? "")
      ),
  });
}

function undoButton(fragment: DocumentFragment): HTMLElement {
  const el = fragment.querySelector("button");
  if (!el) throw new Error("undo control not found in notice fragment");
  return el as HTMLElement;
}

describe("createWidgetController.removeWidget — undo (scene 5 live acceptance)", () => {
  let config: DatabaseViewConfig;
  const saveConfig = jest.fn((cfg: DatabaseViewConfig) => {
    config = cfg;
  });

  function ctrl() {
    return createWidgetController({
      getConfig: () => config,
      saveConfig,
      // The double only implements `.t()` (all `createWidgetController` reads
      // via `get(i18nStore).t`); the real store type is i18next's full `i18n`
      // instance, which this double intentionally does not reimplement.
      i18nStore: makeI18nStore() as never,
    });
  }

  beforeEach(() => {
    saveConfig.mockClear();
    NoticeMock.mockClear();
  });

  it("removes the widget from the saved config immediately", () => {
    config = makeConfig([widget("a"), widget("b")]);
    ctrl().removeWidget("a");
    expect(config.widgets.map((w) => w.id)).toEqual(["b"]);
  });

  it("does nothing when the id is not found", () => {
    config = makeConfig([widget("a")]);
    ctrl().removeWidget("missing");
    expect(saveConfig).not.toHaveBeenCalled();
    expect(NoticeMock).not.toHaveBeenCalled();
  });

  it("shows a Notice whose message names the removed widget and offers Undo, for ~8s", () => {
    config = makeConfig([widget("a", "My Chart")]);
    ctrl().removeWidget("a");
    expect(NoticeMock).toHaveBeenCalledTimes(1);
    const [message, duration] = NoticeMock.mock.calls[0]!;
    expect(duration).toBe(8000);
    const text = (message as DocumentFragment).textContent ?? "";
    expect(text).toContain("My Chart");
    expect(text).toContain("Undo");
  });

  it("Undo restores the exact widget definition at its original index", () => {
    config = makeConfig([widget("a"), widget("b"), widget("c")]);
    ctrl().removeWidget("b"); // index 1
    expect(config.widgets.map((w) => w.id)).toEqual(["a", "c"]);

    const [message] = NoticeMock.mock.calls[0]!;
    undoButton(message as DocumentFragment).dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(config.widgets.map((w) => w.id)).toEqual(["a", "b", "c"]);
  });

  it("Undo hides the notice after restoring", () => {
    config = makeConfig([widget("a")]);
    ctrl().removeWidget("a");
    const [message] = NoticeMock.mock.calls[0]!;
    const instance = NoticeMock.mock.instances[0] as { hide: () => void };
    undoButton(message as DocumentFragment).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(instance.hide).toHaveBeenCalledTimes(1);
  });

  it("inserts at the current end when the widget list shrank before Undo runs", () => {
    config = makeConfig([widget("a"), widget("b"), widget("c")]);
    ctrl().removeWidget("b"); // captured index 1, list becomes [a, c]
    const [message] = NoticeMock.mock.calls[0]!;

    // Something else shrinks the list further before Undo is clicked.
    config = makeConfig([widget("a")]);

    undoButton(message as DocumentFragment).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // min(1, 1) === 1: "b" lands at the end of the now-shorter list, not
    // spliced past it and not dropped.
    expect(config.widgets.map((w) => w.id)).toEqual(["a", "b"]);
  });

  it("a second Undo does not duplicate a block that is already back", () => {
    config = makeConfig([widget("a"), widget("b")]);
    ctrl().removeWidget("b");
    const [message] = NoticeMock.mock.calls[0]!;
    const button = undoButton(message as DocumentFragment);
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(config.widgets.map((w) => w.id)).toEqual(["a", "b"]);
  });
});

// Sanity check for the `t(key, options)` double used above: production code
// reads `get(i18nStore).t`, so the double must support the same call shape.
describe("makeI18nStore double", () => {
  it("resolves defaultValue like the real i18next-backed store would for a missing key", () => {
    const store = makeI18nStore();
    expect(get(store).t("nowhere.at.all", { defaultValue: "fallback" })).toBe("fallback");
  });
});
