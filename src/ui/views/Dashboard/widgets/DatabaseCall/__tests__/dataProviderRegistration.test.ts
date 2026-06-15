import { get } from "svelte/store";

import { DataFieldType } from "src/lib/dataframe/dataframe";
import {
  createDataProviderRegistry,
  DATA_PROVIDER_REGISTRY_CONTEXT_KEY,
} from "src/lib/stores/dataProviderRegistry";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return {
    i18n: writable({
      t: (key: string, options?: { defaultValue?: string }) =>
        options?.defaultValue ?? key,
    }),
  };
});

jest.mock("src/archive/dashboard-v1/DataTable/DataTableWidget.svelte", () => {
  const Svelte = require("svelte/internal");
  // Stub the heavy child to keep the test focused on registration.
  return {
    default: class {
      $$prop_def: Record<string, unknown> = {};
      $set(): void {}
      $on(): () => void {
        return () => {};
      }
      $destroy(): void {}
      constructor(_opts: Record<string, unknown>) {
        void Svelte;
      }
    },
  };
});

jest.mock("../../ViewTabBar.svelte", () => ({
  default: class {
    $$prop_def: Record<string, unknown> = {};
    $set(): void {}
    $on(): () => void {
      return () => {};
    }
    $destroy(): void {}
  },
}));

const stubSvelteComponent = {
  default: class {
    $$prop_def: Record<string, unknown> = {};
    $set(): void {}
    $on(): () => void { return () => {}; }
    $destroy(): void {}
  },
};

jest.mock("src/ui/views/Board/BoardView.svelte", () => stubSvelteComponent);
jest.mock("src/ui/views/Calendar/CalendarView.svelte", () => stubSvelteComponent);
jest.mock("src/ui/views/Gallery/GalleryView.svelte", () => stubSvelteComponent);

const DatabaseCallBlock = require("../DatabaseCallBlock.svelte").default;

function makeFrame(label: string = "A") {
  return {
    fields: [
      {
        name: "name",
        type: DataFieldType.String,
        repeated: false,
        identifier: true,
        derived: false,
      },
    ],
    records: [{ id: `${label}-1`, values: { name: label } }],
  };
}

function mountBlock(
  registry: unknown,
  overrides: Record<string, unknown> = {}
) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const context = new Map<symbol, unknown>([
    [DATA_PROVIDER_REGISTRY_CONTEXT_KEY, registry],
  ]);
  const component = new DatabaseCallBlock({
    target,
    context,
    props: {
      frame: makeFrame("init"),
      api: {},
      readonly: false,
      getRecordColor: () => null,
      fields: [],
      fieldPresets: [],
      activeFieldPresetId: undefined,
      project: { id: "p1", name: "Demo" },
      config: { viewTabs: [], activeTabId: "" },
      widgetId: "widget-db-1",
      widgetTitle: "Database Window 1",
      ...overrides,
    },
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

describe("DatabaseCallBlock — DataProvider registration (#031.3)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("registers a provider on mount with id and title from props", () => {
    const registry = createDataProviderRegistry();
    const view = mountBlock(registry);

    try {
      const provider = registry.getProvider("widget-db-1");
      expect(provider).toBeDefined();
      expect(provider?.name).toBe("Database Window 1");
      expect(get(registry).size).toBe(1);
    } finally {
      view.destroy();
    }
  });

  test("unregisters on destroy", () => {
    const registry = createDataProviderRegistry();
    const view = mountBlock(registry);
    expect(get(registry).size).toBe(1);
    view.destroy();
    expect(get(registry).size).toBe(0);
  });

  test("provider.frame$ reflects the frame prop and updates reactively", async () => {
    const registry = createDataProviderRegistry();
    const view = mountBlock(registry);

    try {
      const provider = registry.getProvider("widget-db-1");
      expect(provider).toBeDefined();
      const initial = get(provider!.frame$);
      expect(initial.records[0]?.values?.["name"]).toBe("init");

      view.component.$set({ frame: makeFrame("next") });
      await Promise.resolve();
      const next = get(provider!.frame$);
      expect(next.records[0]?.values?.["name"]).toBe("next");
    } finally {
      view.destroy();
    }
  });

  test("falls back to widgetId for name when widgetTitle is empty", () => {
    const registry = createDataProviderRegistry();
    const view = mountBlock(registry, { widgetTitle: "" });
    try {
      expect(registry.getProvider("widget-db-1")?.name).toBe("widget-db-1");
    } finally {
      view.destroy();
    }
  });

  test("does not register when widgetId is missing", () => {
    const registry = createDataProviderRegistry();
    const view = mountBlock(registry, { widgetId: "" });
    try {
      expect(get(registry).size).toBe(0);
    } finally {
      view.destroy();
    }
  });

  test("skips registration gracefully when no registry is in context", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    // No context — simulates a legacy canvas that hasn't been wired yet.
    const component = new DatabaseCallBlock({
      target,
      props: {
        frame: makeFrame(),
        api: {},
        readonly: false,
        getRecordColor: () => null,
        fields: [],
        fieldPresets: [],
        activeFieldPresetId: undefined,
        project: { id: "p1", name: "Demo" },
        config: { viewTabs: [], activeTabId: "" },
        widgetId: "widget-db-1",
        widgetTitle: "Demo",
      },
    });
    expect(() => component.$destroy()).not.toThrow();
    target.remove();
  });
});
