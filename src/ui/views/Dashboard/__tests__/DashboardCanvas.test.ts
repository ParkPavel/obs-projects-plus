import { DataFieldType } from "src/lib/dataframe/dataframe";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return {
    i18n: writable({
      t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    }),
  };
});

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return {
    isMobile: writable(false),
  };
});

jest.mock("../widgets/WidgetHost.svelte", () => require("./mocks/WidgetHost.mock.svelte"));
jest.mock("../widgets/WidgetToolbar.svelte", () => require("./mocks/WidgetToolbar.mock.svelte"));
jest.mock("../widgets/FormulaBar.svelte", () => require("./mocks/FormulaBar.mock.svelte"));

// Stage A.9 — DatabaseViewCanvas now wires Schema-panel modals (Schema /
// CreateField / ConfigureField / Confirm). They are static imports, so Jest
// would otherwise drag the full Svelte modal trees through its transformer.
// We stub them with plain classes to keep this canvas test focused on layout
// behaviour; modal interactions are covered by their own unit tests.
jest.mock("src/ui/modals/createFieldModal", () => ({
  CreateFieldModal: class { open() {} close() {} },
}));
jest.mock("src/ui/modals/configureField", () => ({
  ConfigureFieldModal: class { open() {} close() {} },
}));
jest.mock("src/ui/modals/schemaModal", () => ({
  SchemaModal: class { open() {} close() {} },
}));
jest.mock("src/ui/modals/confirmDialog", () => ({
  ConfirmDialogModal: class { open() {} close() {} },
}));
jest.mock("src/lib/stores/obsidian", () => {
  const { writable } = require("svelte/store");
  return { app: writable({}) };
});
jest.mock("src/lib/stores/settings", () => {
  const { writable } = require("svelte/store");
  return {
    settings: {
      ...writable({ projects: [], preferences: { animationBehavior: "instant" } }),
      updateFieldConfig: () => {},
      deleteFieldConfig: () => {},
    },
  };
});
jest.mock("src/lib/stores/externalFrameInvalidation", () => {
  const { writable } = require("svelte/store");
  return { externalFrameInvalidation: writable(0) };
});

const DatabaseViewCanvas = require("../DashboardCanvas.svelte").default;
const { isMobile } = require("src/lib/stores/ui");

function createConfig() {
  return {
    widgets: [
      {
        id: "existing-widget",
        type: "stats",
        title: "Existing widget",
        layout: { x: 0, y: 0, w: 12, h: 2 },
        config: {
          cards: [{ id: "records", label: "Records", field: "name", aggregation: "count" }],
          columns: 1,
        },
      },
    ],
    layoutMode: "free",
    layoutVersion: 1,
    table: {},
    showWidgetToolbar: false,
    compactMode: false,
    quickActions: [
      {
        id: "toggle-formula",
        kind: "toggle-formula-bar",
        label: "Toggle formula",
      },
    ],
  };
}

function createFrame() {
  return {
    fields: [
      { name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
      { name: "amount", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "category", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
    ],
    records: [
      {
        id: "record-1",
        values: {
          name: "Record 1",
          amount: 120,
          category: "Ops",
        },
      },
    ],
  };
}

function click(element: Element | null) {
  if (!element) {
    throw new Error("Expected element to exist");
  }
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

async function flush(ms = 0) {
  await Promise.resolve();
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
  await Promise.resolve();
}

function mountCanvas(configOverrides?: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onConfigChange = jest.fn();

  const component = new DatabaseViewCanvas({
    target,
    props: {
      project: { id: "project-1", name: "Demo" },
      frame: createFrame(),
      readonly: false,
      api: {},
      getRecordColor: () => null,
      config: { ...createConfig(), ...configOverrides },
      onConfigChange,
    },
  });

  return {
    component,
    target,
    onConfigChange,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

function getQuickAction(target: HTMLElement, label: string) {
  return Array.from(target.querySelectorAll(".ppp-quick-action")).find(
    (button) => button.textContent?.includes(label)
  ) ?? null;
}



describe("DatabaseViewCanvas", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    isMobile.set(false);
  });

  test("locked stack widgets have no drag entrance and retain their index on reorder", async () => {
    const first = createConfig().widgets[0]!;
    const locked = { ...first, id: "locked", layout: { ...first.layout, locked: true } };
    const last = { ...first, id: "last" };
    const view = mountCanvas({ widgets: [first, locked, last] });
    try {
      expect(view.target.querySelector('[data-widget-id="locked"]')?.getAttribute("data-reorderable")).toBe("false");
      const zone = view.target.querySelector(".ppp-database-canvas--stack");
      const { SOURCES, TRIGGERS } = require("svelte-dnd-action");
      zone?.dispatchEvent(new CustomEvent("finalize", { detail: { items: [last, first, locked], info: { source: SOURCES.POINTER, trigger: TRIGGERS.DROPPED_INTO_ZONE, id: last.id } } }));
      await flush();
      expect(view.onConfigChange.mock.calls.at(-1)?.[0].widgets.map((w: { id: string }) => w.id)).toEqual(["last", "locked", "existing-widget"]);
    } finally { view.destroy(); }
  });

  test("the top creation entrance is direct and a newly added widget is revealed and focused", async () => {
    const scroll = jest.fn();
    const previous = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    const view = mountCanvas();
    try {
      const add = view.target.querySelector(".widget-toolbar-mock-add");
      expect(add).not.toBeNull();
      click(add);
      await flush(); await flush();
      const next = view.onConfigChange.mock.calls.at(-1)?.[0].widgets.at(-1);
      const node = view.target.querySelector(`[data-widget-id="${next?.id}"]`);
      expect(node).not.toBeNull();
      expect(document.activeElement).toBe(node);
      expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: "nearest" }));
      expect(view.onConfigChange.mock.calls.at(-1)?.[0].widgets[0].id).toBe("existing-widget");
    } finally { view.destroy(); HTMLElement.prototype.scrollIntoView = previous; }
  });

  test("#191 a stored apply-template action does not reach the screen", () => {
    // The only test that proves the button is gone from the RENDER rather than
    // from an object. A vault carries this exact shape today: migrateTableConfig
    // wrote it into every dashboard it migrated before #191.
    const view = mountCanvas({
      quickActions: [
        { id: "qa-overview", kind: "apply-template", label: "Overview Preset", templateId: "overview-finance" },
        { id: "toggle-formula", kind: "toggle-formula-bar", label: "Toggle formula" },
      ],
    });

    try {
      const actions = view.target.querySelectorAll(".ppp-quick-action");
      expect(actions).toHaveLength(1);
      expect(actions[0]?.textContent?.trim()).toBe("Toggle formula");
      expect(view.target.textContent).not.toContain("Overview Preset");
    } finally {
      view.destroy();
    }
  });

  test("#191 a malformed quickActions value does not take the dashboard down", () => {
    // The migrator leaves a value it does not recognise alone rather than
    // throwing, so anything can still reach the render. Calling .filter() on a
    // string crashes the whole canvas to remove one button — found by audit,
    // not by the gates.
    for (const broken of ["nope", 42, { a: 1 }, [null], [{ kind: null }]]) {
      const view = mountCanvas({ quickActions: broken as never });
      try {
        expect(view.target.querySelectorAll(".ppp-quick-action")).toHaveLength(0);
      } finally {
        view.destroy();
      }
    }
  });

  test("toggles formula bar from quick actions", async () => {
    const view = mountCanvas();

    try {
      expect(view.target.querySelector(".ppp-formula-bar")).toBeNull();

      click(getQuickAction(view.target, "Toggle formula"));
      await flush();
      expect(view.target.querySelector(".ppp-formula-bar")).not.toBeNull();

      click(getQuickAction(view.target, "Toggle formula"));
      await flush();
      expect(view.target.querySelector(".ppp-formula-bar")).toBeNull();
    } finally {
      view.destroy();
    }
  });

  test("applies formula field from formula bar and closes it", async () => {
    const view = mountCanvas();

    try {
      click(getQuickAction(view.target, "Toggle formula"));
      await flush();

      click(view.target.querySelector(".formula-bar-apply"));
      await flush();

      const latestConfig = view.onConfigChange.mock.calls.at(-1)?.[0] as {
        formulaFields?: Array<{ name: string; expression: string }>;
      };

      expect(latestConfig.formulaFields).toEqual([{ name: "Profit", expression: "amount" }]);
      expect(view.target.querySelector(".ppp-formula-bar")).toBeNull();
    } finally {
      view.destroy();
    }
  });

  test("closes formula bar on cancel event", async () => {
    const view = mountCanvas();

    try {
      click(getQuickAction(view.target, "Toggle formula"));
      await flush();

      click(view.target.querySelector(".formula-bar-cancel"));
      await flush();

      expect(view.target.querySelector(".ppp-formula-bar")).toBeNull();
    } finally {
      view.destroy();
    }
  });

  test("layout toggle button is absent in V2 grid-only mode", async () => {
    const view = mountCanvas();

    try {
      const layoutButton = Array.from(view.target.querySelectorAll(".ppp-toolbar-btn")).find(
        (button) => button.getAttribute("aria-label")?.includes("toggle-layout")
      );

      expect(layoutButton).toBeUndefined();
    } finally {
      view.destroy();
    }
  });
});
