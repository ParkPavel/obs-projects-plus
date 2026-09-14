import { createSuggestionController } from "../dashboardSuggest";
import type { SmartSuggestion } from "../smartSuggest";
import type { DatabaseViewConfig, WidgetDefinition, WidgetType } from "../types";

function makeConfig(overrides?: Partial<DatabaseViewConfig>): DatabaseViewConfig {
  return {
    widgets: [],
    layoutMode: "free",
    layoutVersion: 2,
    table: {} as never,
    showWidgetToolbar: false,
    compactMode: false,
    ...overrides,
  };
}

describe("createSuggestionController (#113)", () => {
  let config: DatabaseViewConfig;
  const saveConfig = jest.fn((cfg: DatabaseViewConfig) => { config = cfg; });
  // Mirrors the real widgetController.addWidget (dashboardWidgets.ts): saves
  // the widget itself and returns the config it saved. `getConfig` here is
  // never stale (saveConfig updates `config` synchronously), so these tests
  // exercise accept()'s call shape, not the staleness the #158 fix targets —
  // see the "stale getConfig" describe block below for that.
  const addWidget = jest.fn(
    (type: WidgetType, initialConfig?: Partial<Omit<WidgetDefinition, "id" | "type">>) => {
      const newWidget = {
        id: "w-new",
        type,
        title: type,
        layout: { x: 0, y: 0, w: 1, h: 1 },
        config: {},
        ...initialConfig,
      } as WidgetDefinition;
      const next = { ...config, widgets: [...config.widgets, newWidget] };
      saveConfig(next);
      return next;
    }
  );
  const getPrimaryWidgetId = jest.fn(() => "w-master" as string | undefined);

  function ctrl() {
    return createSuggestionController({
      getConfig: () => config,
      saveConfig,
      addWidget,
      getPrimaryWidgetId,
    });
  }

  beforeEach(() => {
    config = makeConfig();
    jest.clearAllMocks();
    getPrimaryWidgetId.mockReturnValue("w-master");
  });

  it("accept 'relation-block' with targetProjectId creates pre-configured database-call widget", () => {
    const suggestion: SmartSuggestion = {
      kind: "relation-block",
      fieldName: "client",
      widgetType: "database-call",
      relationTargetProjectId: "proj-sessions",
    };
    ctrl().accept(new CustomEvent("accept", { detail: suggestion }));
    expect(addWidget).toHaveBeenCalledWith("database-call", {
      sourceConfig: { projectId: "proj-sessions" },
      config: { linkedSelection: { sourceWidgetId: "w-master", relationField: "client" } },
    });
  });

  it("accept 'relation-block' without targetProjectId creates bare database-call widget", () => {
    const suggestion: SmartSuggestion = {
      kind: "relation-block",
      fieldName: "client",
      widgetType: "database-call",
    };
    ctrl().accept(new CustomEvent("accept", { detail: suggestion }));
    expect(addWidget).toHaveBeenCalledWith("database-call");
    expect(addWidget).not.toHaveBeenCalledWith("database-call", expect.anything());
  });

  it("accept 'numeric-stats' calls addWidget with type only", () => {
    const suggestion: SmartSuggestion = {
      kind: "numeric-stats",
      fieldName: "price",
      widgetType: "stats",
    };
    ctrl().accept(new CustomEvent("accept", { detail: suggestion }));
    expect(addWidget).toHaveBeenCalledWith("stats");
  });

  it("accept 'relation-block' uses empty sourceWidgetId when getPrimaryWidgetId returns undefined", () => {
    getPrimaryWidgetId.mockReturnValue(undefined);
    const suggestion: SmartSuggestion = {
      kind: "relation-block",
      fieldName: "client",
      widgetType: "database-call",
      relationTargetProjectId: "proj-sessions",
    };
    ctrl().accept(new CustomEvent("accept", { detail: suggestion }));
    expect(addWidget).toHaveBeenCalledWith("database-call", expect.objectContaining({
      config: expect.objectContaining({ linkedSelection: expect.objectContaining({ sourceWidgetId: "" }) }),
    }));
  });

  it("accept 'date-chart' with a numeric field adds a chart averaging it over the date on X, grouped by day", () => {
    const suggestion: SmartSuggestion = {
      kind: "date-chart",
      fieldName: "dueDate",
      widgetType: "chart",
      numericFieldName: "pain",
    };
    ctrl().accept(new CustomEvent("accept", { detail: suggestion }));
    expect(addWidget).toHaveBeenCalledWith("chart", {
      config: expect.objectContaining({
        xAxis: expect.objectContaining({ property: "dueDate", dateGranularity: "day" }),
        yAxis: { property: "pain", aggregation: "avg" },
      }),
    });
  });

  it("accept 'date-chart' without a numeric field adds a chart counting records over the date on X", () => {
    const suggestion: SmartSuggestion = {
      kind: "date-chart",
      fieldName: "dueDate",
      widgetType: "chart",
    };
    ctrl().accept(new CustomEvent("accept", { detail: suggestion }));
    expect(addWidget).toHaveBeenCalledWith("chart", {
      config: expect.objectContaining({
        xAxis: expect.objectContaining({ property: "dueDate", dateGranularity: "day" }),
        yAxis: { property: "count", aggregation: "count_total" },
      }),
    });
  });

  it("accept 'date-chart' persists the dismissal so the strip does not return", () => {
    const suggestion: SmartSuggestion = {
      kind: "date-chart",
      fieldName: "dueDate",
      widgetType: "chart",
    };
    ctrl().accept(new CustomEvent("accept", { detail: suggestion }));
    expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      dismissedSuggestions: expect.arrayContaining(["date-chart"]),
    }));
  });

  // #158: accept() performs TWO saveConfig calls — addWidget's own (the
  // widget alone) and one more folding the dismissal into the config
  // addWidget just returned. Both land in `config` since this suite's
  // saveConfig double is never stale; the "stale getConfig" block below
  // proves the second save doesn't need a fresh read to keep the widget.
  it("accept leaves both the widget and the dismissal in the config that survives", () => {
    const suggestion: SmartSuggestion = {
      kind: "date-chart",
      fieldName: "dueDate",
      widgetType: "chart",
    };
    ctrl().accept(new CustomEvent("accept", { detail: suggestion }));
    expect(saveConfig).toHaveBeenCalledTimes(2);
    expect(config.widgets).toHaveLength(1);
    expect(config.dismissedSuggestions).toEqual(["date-chart"]);
  });

  it("accept 'relation-block' keeps sourceConfig.projectId and linkedSelection on the widget that survives", () => {
    const suggestion: SmartSuggestion = {
      kind: "relation-block",
      fieldName: "client",
      widgetType: "database-call",
      relationTargetProjectId: "proj-sessions",
    };
    ctrl().accept(new CustomEvent("accept", { detail: suggestion }));
    expect(config.widgets).toHaveLength(1);
    expect(config.widgets[0]).toMatchObject({
      sourceConfig: { projectId: "proj-sessions" },
      config: { linkedSelection: { sourceWidgetId: "w-master", relationField: "client" } },
    });
    expect(config.dismissedSuggestions).toEqual(["relation-block"]);
  });

  it("accepting the same suggestion twice does not duplicate the widget or the dismissal entry", () => {
    const suggestion: SmartSuggestion = {
      kind: "numeric-stats",
      fieldName: "price",
      widgetType: "stats",
    };
    const controller = ctrl();
    controller.accept(new CustomEvent("accept", { detail: suggestion }));
    controller.accept(new CustomEvent("accept", { detail: suggestion }));
    expect(addWidget).toHaveBeenCalledTimes(1);
    expect(config.widgets).toHaveLength(1);
    expect(config.dismissedSuggestions).toEqual(["numeric-stats"]);
  });

  it("dismiss persists kind to dismissedSuggestions", () => {
    ctrl().dismiss(new CustomEvent("dismissForever", { detail: "relation-block" as const }));
    expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      dismissedSuggestions: expect.arrayContaining(["relation-block"]),
    }));
  });

  it("dismiss (without accepting) writes only the dismissal — no widget, one save", () => {
    ctrl().dismiss(new CustomEvent("dismissForever", { detail: "relation-block" as const }));
    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(addWidget).not.toHaveBeenCalled();
    expect(config.widgets).toHaveLength(0);
    expect(config.dismissedSuggestions).toEqual(["relation-block"]);
  });
});

// #158: models the real staleness — DashboardCanvas's getConfig() reads a
// projection (`effectiveConfig`) that only catches up on the next Svelte
// tick, so a second save issued right after the first one, built by
// re-reading getConfig(), carries the state from BEFORE that first save.
// `stale` here stands for that projection: it freezes at whatever was live
// when a save started and only catches up once something reads it again
// after the save settles (the tick this suite calls `settle()`).
describe("createSuggestionController — accept() vs. a getConfig() that lags a save behind (#158)", () => {
  it("still lands both the widget and the dismissal in the final save", () => {
    let live = makeConfig();
    let stale = live;
    const saves: DatabaseViewConfig[] = [];
    function saveConfig(cfg: DatabaseViewConfig) {
      saves.push(cfg);
      live = cfg;
      // getConfig() does NOT see this save until settle() runs — exactly
      // the gap between DashboardCanvas's saveConfig() and its `$:
      // effectiveConfig` reactive block catching up.
    }
    function settle() { stale = live; }
    function getConfig() { return stale; }

    // Real widgetController.addWidget's contract under test: it saves and
    // returns the config it saved (dashboardWidgets.ts), regardless of
    // whether getConfig() has caught up with the save yet.
    function addWidget(
      type: WidgetType,
      initialConfig?: Partial<Omit<WidgetDefinition, "id" | "type">>
    ): DatabaseViewConfig | undefined {
      const config = getConfig();
      if (!config) return undefined;
      const newWidget = {
        id: "w-new", type, title: type, layout: { x: 0, y: 0, w: 1, h: 1 }, config: {}, ...initialConfig,
      } as WidgetDefinition;
      const next = { ...config, widgets: [...config.widgets, newWidget] };
      saveConfig(next);
      // Deliberately no settle() here: accept() runs start to finish in one
      // synchronous stretch, exactly like DashboardCanvas's click handler —
      // nothing pumps the microtask queue partway through, so `stale` stays
      // exactly what it was when accept() began for its whole duration.
      // Pre-fix accept() re-read getConfig() for the dismissal save and got
      // this frozen, widget-less value back — that read is what this test
      // catches. Post-fix accept() never asks getConfig() again; it builds
      // the dismissal save on addWidget's own return value instead.
      return next;
    }

    const controller = createSuggestionController({
      getConfig,
      saveConfig,
      addWidget,
      getPrimaryWidgetId: () => "w-master",
    });

    controller.accept(new CustomEvent("accept", {
      detail: { kind: "numeric-stats", fieldName: "price", widgetType: "stats" } as SmartSuggestion,
    }));

    // Accept still writes twice — widget, then dismissal — but the second
    // write is built on the first instead of on a config read before it, and
    // that is where the widget used to disappear. So the assertion is not the
    // number of writes: it is that no write after the widget drops it.
    const final = saves[saves.length - 1];
    if (!final) throw new Error("accept() saved nothing");
    const widgetAdded = saves.findIndex((s) => s.widgets.length === 1);
    expect(widgetAdded).toBeGreaterThanOrEqual(0);
    for (const save of saves.slice(widgetAdded)) {
      expect(save.widgets).toHaveLength(1);
    }
    expect(final.widgets).toHaveLength(1);
    expect(final.dismissedSuggestions).toEqual(["numeric-stats"]);

    // Only now — after accept() has returned, standing in for the tick the
    // real projection needs — does asking getConfig() again see the result.
    settle();
    expect(getConfig()).toBe(final);
  });
});
