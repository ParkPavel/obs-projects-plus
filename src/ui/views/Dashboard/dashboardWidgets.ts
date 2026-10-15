// dashboardWidgets.ts — Widget CRUD controller for DashboardCanvas.
//
// Why a factory, not a class?
//   DashboardCanvas.svelte owns `config` as a reactive let-binding. A class
//   would need a reference to the canvas's reactive scope, which couples it
//   tightly to Svelte's reactivity model. A factory with getter callbacks is
//   framework-agnostic and trivially testable.
//
// What stays in DashboardCanvas:
//   DnD handlers (handleDndConsider/Finalize) — they mutate `dndWidgets`, a
//   purely local DOM-animation state. Extracting them would require exposing
//   that local variable via a store or callback, which buys nothing.
//   Toggle helpers (toggleToolbar, toggleLayout) — 4–6 lines each; the
//   indirection cost exceeds the LOC savings.

import { get } from "svelte/store";
import type { i18n as I18nStore } from "src/lib/stores/i18n";
import { getWidgetMeta } from "./widgets/widgetRegistry";
import { notifyWidgetRemoved } from "./dashboardWidgetUndo";
import type { DatabaseViewConfig, WidgetDefinition, WidgetType } from "./types";

interface WidgetControllerOptions {
  getConfig: () => DatabaseViewConfig | undefined;
  saveConfig: (cfg: DatabaseViewConfig) => void;
  onAdded?: (id: string) => void;
  /** Lazily read — avoids capturing a stale store reference at construction time. */
  i18nStore: typeof I18nStore;
}

export interface WidgetController {
  /**
   * Saves the widget and returns the config it saved — dashboardSuggest.ts
   * chains a second save (the suggestion's dismissal) off this return value
   * instead of re-reading getConfig(), which can still lag the save it just
   * made (Svelte's `$:` block that refreshes it runs on the next tick, not
   * synchronously). Every other caller ignores the return value.
   */
  addWidget(type: WidgetType, initialConfig?: Partial<Omit<WidgetDefinition, "id" | "type">>, index?: number): DatabaseViewConfig | undefined;
  /** B7: a copy with a fresh id, right after the original. */
  duplicateWidget(id: string): void;
  removeWidget(id: string): void;
  /** CustomEvent handler: widget's own config changed (title, layout, type-specific options). */
  handleWidgetConfigChange(e: CustomEvent<{ id: string; changes: Partial<WidgetDefinition> }>): void;
  /** CustomEvent handler: primary DataTable config changed. */
  handleTableConfigChange(e: CustomEvent<unknown>): void;
  /** FormulaBar apply: upsert a view-level formula field by name. */
  applyFormulaField(name: string, expression: string): void;
}

export function createWidgetController({
  getConfig,
  saveConfig,
  i18nStore,
  onAdded,
}: WidgetControllerOptions): WidgetController {
  function cfg() {
    return getConfig();
  }

  function addWidget(
    type: WidgetType,
    initialConfig?: Partial<Omit<WidgetDefinition, "id" | "type">>,
    index?: number
  ): DatabaseViewConfig | undefined {
    const config = cfg();
    if (!config) return undefined;
    const meta = getWidgetMeta(type);
    if (!meta) return undefined;

    const id = `w-${crypto.randomUUID().slice(0, 8)}`;
    const title = get(i18nStore).t(meta.labelKey);
    const newWidget: WidgetDefinition = {
      id,
      type,
      title,
      layout: { ...meta.defaultLayout },
      config: {},
      ...initialConfig,
    };
    const next: DatabaseViewConfig = { ...config, widgets: insertAt(config.widgets, newWidget, index) };
    saveConfig(next);
    onAdded?.(id);
    return next;
  }

  function duplicateWidget(id: string): void {
    const config = cfg();
    if (!config) return;
    const index = config.widgets.findIndex((w) => w.id === id);
    const source = config.widgets[index];
    if (!source) return;
    // A structured copy: nested config/transform must not be shared with the original.
    const copy: WidgetDefinition = { ...(JSON.parse(JSON.stringify(source)) as WidgetDefinition), id: `w-${crypto.randomUUID().slice(0, 8)}` };
    saveConfig({ ...config, widgets: insertAt(config.widgets, copy, index + 1) });
    onAdded?.(copy.id);
  }

  function removeWidget(id: string): void {
    const config = cfg();
    if (!config) return;
    const index = config.widgets.findIndex((w) => w.id === id);
    if (index === -1) return;
    const removed = config.widgets[index]!;
    saveConfig({
      ...config,
      widgets: config.widgets.filter((w) => w.id !== id),
    });
    notifyWidgetRemoved((key, options) => get(i18nStore).t(key, options), removed, index, cfg, saveConfig);
  }

  function handleWidgetConfigChange(
    e: CustomEvent<{ id: string; changes: Partial<WidgetDefinition> }>
  ): void {
    const config = cfg();
    if (!config) return;
    const updated = config.widgets.map((w) =>
      w.id === e.detail.id ? { ...w, ...e.detail.changes } : w
    );
    saveConfig({ ...config, widgets: updated });
  }

  function handleTableConfigChange(e: CustomEvent<unknown>): void {
    const config = cfg();
    if (!config) return;
    saveConfig({ ...config, table: e.detail as DatabaseViewConfig["table"] });
  }

  function applyFormulaField(name: string, expression: string): void {
    const config = cfg();
    if (!config) return;
    const existing = config.formulaFields ?? [];
    const updated = existing.some((f) => f.name === name)
      ? existing.map((f) => (f.name === name ? { ...f, expression } : f))
      : [...existing, { name, expression }];
    saveConfig({ ...config, formulaFields: updated });
  }

  return { addWidget, duplicateWidget, removeWidget, handleWidgetConfigChange, handleTableConfigChange, applyFormulaField };
}

/** B7: insert at `index` (clamped); no index means "at the end", as before. */
function insertAt(list: readonly WidgetDefinition[], item: WidgetDefinition, index?: number): WidgetDefinition[] {
  const at = index === undefined ? list.length : Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, at), item, ...list.slice(at)];
}
