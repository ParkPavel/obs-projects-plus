import { createSuggestionController } from "../dashboardSuggest";
import type { SmartSuggestion } from "../smartSuggest";
import type { DatabaseViewConfig } from "../types";

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
  const addWidget = jest.fn();
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

  it("dismiss persists kind to dismissedSuggestions", () => {
    ctrl().dismiss(new CustomEvent("dismissForever", { detail: "relation-block" as const }));
    expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      dismissedSuggestions: expect.arrayContaining(["relation-block"]),
    }));
  });
});
