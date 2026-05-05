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
      ...writable({ projects: [] }),
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
        id: "apply-overview",
        kind: "apply-template",
        label: "Apply overview",
        templateId: "overview-finance",
      },
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

function getConfirmAction(target: HTMLElement, label: string) {
  return Array.from(target.querySelectorAll(".ppp-template-confirm-actions button")).find(
    (button) => button.textContent?.includes(label)
  ) ?? null;
}

function onLatestWidgets(onConfigChange: jest.Mock) {
  const latestConfig = onConfigChange.mock.calls.at(-1)?.[0] as { widgets?: unknown[] } | undefined;
  return latestConfig?.widgets ?? [];
}

describe("DatabaseViewCanvas", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    isMobile.set(false);
  });

  test("asks confirmation before replacing existing widgets and keeps layout on cancel", async () => {
    const view = mountCanvas();

    try {
      expect(view.target.textContent).toContain("Existing widget");

      click(getQuickAction(view.target, "Apply overview"));
      await flush();

      expect(view.target.querySelector('[role="dialog"]')).not.toBeNull();
      expect(view.target.textContent).toContain("Replace current layout?");

      click(getConfirmAction(view.target, "Cancel"));
      await flush();

      expect(view.target.querySelector('[role="dialog"]')).toBeNull();
      expect(view.target.textContent).toContain("Existing widget");
      expect(view.target.textContent).not.toContain("Finance KPI");
    } finally {
      view.destroy();
    }
  });

  test("replaces widgets after confirmation", async () => {
    const view = mountCanvas();

    try {
      click(getQuickAction(view.target, "Apply overview"));
      await flush();

      click(getConfirmAction(view.target, "Apply template"));
      await flush();

      expect(view.target.textContent).not.toContain("Existing widget");
      expect(view.target.textContent).toContain("Finance KPI");
      expect(onLatestWidgets(view.onConfigChange)).toHaveLength(4);
      expect((onLatestWidgets(view.onConfigChange) as Array<{ title?: string }>).map((widget) => widget.title)).toEqual([
        "Finance KPI",
        "Summary",
        "By Category",
        "Journal",
      ]);
    } finally {
      view.destroy();
    }
  });

  test("shows replace confirmation for toolbar template apply path", async () => {
    const view = mountCanvas({ showWidgetToolbar: true });

    try {
      click(view.target.querySelector(".widget-toolbar-mock-apply"));
      await flush();

      expect(view.target.querySelector('[role="dialog"]')).not.toBeNull();
      expect(view.target.textContent).toContain("Replace current layout?");
    } finally {
      view.destroy();
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

  test("disables layout toggle on mobile", async () => {
    isMobile.set(true);
    await flush();

    const view = mountCanvas();

    try {
      const layoutButton = Array.from(view.target.querySelectorAll(".ppp-toolbar-btn")).find(
        (button) => button.getAttribute("aria-label")?.includes("toggle-layout")
      ) as HTMLButtonElement | undefined;

      expect(layoutButton?.disabled).toBe(true);
    } finally {
      view.destroy();
    }
  });
});