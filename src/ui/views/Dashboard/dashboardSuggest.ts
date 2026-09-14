// dashboardSuggest.ts — SmartSuggest wiring controller (#059).
//
// Accepting persists the dismissal too — no rule's gate is satisfied by the
// widget alone — and folds it onto the config `addWidget` returned rather
// than a fresh read, which is what used to throw the widget away.
// What each kind adds lives in `suggestionWidgets.ts`.

import type { DatabaseViewConfig, WidgetDefinition, WidgetType } from "./types";
import { widgetForSuggestion } from "./suggestionWidgets";
import type { SmartSuggestion, SuggestionKind } from "./smartSuggest";

export interface SuggestionController {
  accept(e: CustomEvent<SmartSuggestion>): void;
  dismiss(e: CustomEvent<SuggestionKind>): void;
}

export function createSuggestionController(opts: {
  getConfig: () => DatabaseViewConfig | undefined;
  saveConfig: (cfg: DatabaseViewConfig) => void;
  addWidget: (
    type: WidgetType,
    initialConfig?: Partial<Omit<WidgetDefinition, "id" | "type">>
  ) => DatabaseViewConfig | undefined;
  getPrimaryWidgetId: () => string | undefined;
}): SuggestionController {
  const { getConfig, saveConfig, addWidget, getPrimaryWidgetId } = opts;

  function withDismissed(config: DatabaseViewConfig, kind: SuggestionKind): string[] | undefined {
    const prev = config.dismissedSuggestions ?? [];
    return prev.includes(kind) ? undefined : [...prev, kind];
  }
  function persistDismiss(kind: SuggestionKind): void {
    const config = getConfig();
    if (!config) return;
    const dismissedSuggestions = withDismissed(config, kind);
    if (!dismissedSuggestions) return;
    saveConfig({ ...config, dismissedSuggestions });
  }

  return {
    accept(e) {
      const s = e.detail;
      // A double accept (kind already dismissed) must add nothing.
      const config = getConfig();
      if (!config || !withDismissed(config, s.kind)) return;

      const { type, initial } = widgetForSuggestion(s, getPrimaryWidgetId() ?? "");
      const saved = initial ? addWidget(type, initial) : addWidget(type);
      if (!saved) return;

      // Built on what addWidget saved, never on a fresh read: that is what
      // used to throw the widget away.
      const dismissedSuggestions = withDismissed(saved, s.kind);
      if (dismissedSuggestions) saveConfig({ ...saved, dismissedSuggestions });
    },
    dismiss: (e) => persistDismiss(e.detail),
  };
}
