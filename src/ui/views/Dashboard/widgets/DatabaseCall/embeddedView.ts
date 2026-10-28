import type { ViewTab } from "../../types";
import { DEFAULT_VIEW, type ViewDefinition } from "src/settings/settings";

/** New embedded calendars start in a bounded time grid; stored views keep their choices. */
export function initialEmbeddedConfig(type: ViewTab["viewType"]): Record<string, unknown> {
  return type === "calendar" ? { interval: "week", displayMode: "bars", agendaOpen: false } : {};
}

/** Adapt a block tab to the shared, presentation-only settings panel. */
export function embeddedViewDefinition(tab: ViewTab, config: Record<string, unknown>): ViewDefinition {
  return { ...DEFAULT_VIEW, id: tab.id, name: tab.label, type: tab.viewType, config };
}
