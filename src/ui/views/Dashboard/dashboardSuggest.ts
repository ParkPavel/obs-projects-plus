// dashboardSuggest.ts — SmartSuggest wiring controller (#059).
//
// Extracted from DashboardCanvas.svelte during the vision-compliance audit
// to restore the canvas ≤200 LOC invariant (master-prompt invariant 1).
// Accepting a suggestion also persists its dismissal: the relation
// suggestion's gate (a linked database-call) is not satisfied by merely
// adding the block, so without this the strip would reappear.

import type { DatabaseViewConfig, WidgetType } from "./types";
import type { SmartSuggestion, SuggestionKind } from "./smartSuggest";

export interface SuggestionController {
  accept(e: CustomEvent<SmartSuggestion>): void;
  dismiss(e: CustomEvent<SuggestionKind>): void;
}

export function createSuggestionController(opts: {
  getConfig: () => DatabaseViewConfig | undefined;
  saveConfig: (cfg: DatabaseViewConfig) => void;
  addWidget: (type: WidgetType) => void;
}): SuggestionController {
  const { getConfig, saveConfig, addWidget } = opts;

  function persistDismiss(kind: SuggestionKind): void {
    const config = getConfig();
    if (!config) return;
    const prev = config.dismissedSuggestions ?? [];
    if (prev.includes(kind)) return;
    saveConfig({ ...config, dismissedSuggestions: [...prev, kind] });
  }

  return {
    accept(e) {
      addWidget(e.detail.widgetType);
      persistDismiss(e.detail.kind);
    },
    dismiss(e) {
      persistDismiss(e.detail);
    },
  };
}
