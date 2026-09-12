import { DataFieldType } from "src/lib/dataframe/dataframe";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return {
    i18n: writable({
      t: (key: string, options?: { defaultValue?: string }) =>
        options?.defaultValue ?? key,
    }),
  };
});

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return {
    isMobile: writable(false),
  };
});

jest.mock("../widgets/WidgetHost.svelte", () =>
  require("./mocks/WidgetHost.mock.svelte")
);
jest.mock("../widgets/WidgetToolbar.svelte", () =>
  require("./mocks/WidgetToolbar.mock.svelte")
);
jest.mock("../widgets/FormulaBar.svelte", () =>
  require("./mocks/FormulaBar.mock.svelte")
);

// Stage A.9 — DatabaseViewCanvas now wires Schema-panel modals (Schema /
// CreateField / ConfigureField / Confirm). They are static imports, so Jest
// would otherwise drag the full Svelte modal trees through its transformer.
// We stub them with plain classes to keep this canvas test focused on layout
// behaviour; modal interactions are covered by their own unit tests.
jest.mock("src/ui/modals/createFieldModal", () => ({
  CreateFieldModal: class {
    open() {}
    close() {}
  },
}));
jest.mock("src/ui/modals/configureField", () => ({
  ConfigureFieldModal: class {
    open() {}
    close() {}
  },
}));
jest.mock("src/ui/modals/schemaModal", () => ({
  SchemaModal: class {
    open() {}
    close() {}
  },
}));
jest.mock("src/ui/modals/confirmDialog", () => ({
  ConfirmDialogModal: class {
    open() {}
    close() {}
  },
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
// `require`, like everything else here: this file carries `jest.mock` calls, so
// babel-plugin-jest-hoist processes it and a type annotation on an imported
// binding fails to transform. That is why nothing in this file is imported by
// name with a type attached.
const { dropTemplateQuickActions } = require("../migration");

function createConfig() {
  return {
    widgets: [
      {
        id: "existing-widget",
        type: "stats",
        title: "Existing widget",
        layout: { x: 0, y: 0, w: 12, h: 2 },
        config: {
          cards: [
            {
              id: "records",
              label: "Records",
              field: "name",
              aggregation: "count",
            },
          ],
          columns: 1,
        },
      },
    ],
    layoutMode: "free",
    layoutVersion: 1,
    table: {},
    showWidgetToolbar: false,
    compactMode: false,
    // #191 — deliberately the STORED shape a real vault carries, not the shape
    // the type union now allows: `migrateTableConfig` generated an
    // `apply-template` action for every dashboard it migrated, and the point of
    // the assertions below is what such a config renders today.
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
      {
        name: "name",
        type: DataFieldType.String,
        repeated: false,
        identifier: true,
        derived: false,
      },
      {
        name: "amount",
        type: DataFieldType.Number,
        repeated: false,
        identifier: false,
        derived: false,
      },
      {
        name: "category",
        type: DataFieldType.String,
        repeated: false,
        identifier: false,
        derived: false,
      },
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
  return (
    Array.from(target.querySelectorAll(".ppp-quick-action")).find((button) =>
      button.textContent?.includes(label)
    ) ?? null
  );
}

describe("DatabaseViewCanvas", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    isMobile.set(false);
  });

  // ── #191: the button is gone from the SCREEN, not just from an object ──
  //
  // Everything else about this removal can be proved against a plain value.
  // This is the one assertion that mounts the component a user actually looks
  // at, with the config a real vault actually holds, and counts the buttons in
  // the DOM. Without it "the template quick action is removed" rests on
  // reasoning about a data structure — the exact gap this repo has been caught
  // by before.
  //
  // The config is passed through the real `dropTemplateQuickActions` first
  // because that is the production composition: `dashboardView.onOpen` runs the
  // migration chain and hands the RESULT to the canvas. The canvas renders what
  // it is given; the guarantee that it is never given an `apply-template`
  // action belongs to the migration, and is pinned in `migration.test.ts`.
  test("a vault carrying the retired button renders exactly one quick action", async () => {
    const stored = createConfig();
    expect(stored.quickActions).toHaveLength(2);

    const { config, migrated } = dropTemplateQuickActions(stored);
    expect(migrated).toBe(true);

    const view = mountCanvas(config);

    try {
      const buttons = view.target.querySelectorAll(".ppp-quick-action");
      expect(buttons).toHaveLength(1);
      expect(buttons[0]?.textContent?.trim()).toBe("Toggle formula");
      expect(view.target.textContent).not.toContain("Apply overview");

      // And nothing is left behind that used to explain the button: the
      // replace-confirmation dialog went with the mechanism.
      expect(view.target.querySelector('[role="dialog"]')).toBeNull();
      expect(view.target.textContent).not.toContain("Replace current layout?");

      // The surviving button still does its job — a removal that quietly broke
      // the neighbour would pass every assertion above.
      click(buttons[0] ?? null);
      await flush();
      expect(view.target.querySelector(".ppp-formula-bar")).not.toBeNull();
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

      expect(latestConfig.formulaFields).toEqual([
        { name: "Profit", expression: "amount" },
      ]);
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
      const layoutButton = Array.from(
        view.target.querySelectorAll(".ppp-toolbar-btn")
      ).find((button) =>
        button.getAttribute("aria-label")?.includes("toggle-layout")
      );

      expect(layoutButton).toBeUndefined();
    } finally {
      view.destroy();
    }
  });
});
