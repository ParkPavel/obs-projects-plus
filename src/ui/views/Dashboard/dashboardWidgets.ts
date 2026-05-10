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
import type { DatabaseViewConfig, WidgetDefinition, WidgetType } from "./types";

interface WidgetControllerOptions {
  getConfig: () => DatabaseViewConfig | undefined;
  saveConfig: (cfg: DatabaseViewConfig) => void;
  /** Lazily read — avoids capturing a stale store reference at construction time. */
  i18nStore: typeof I18nStore;
}

export interface WidgetController {
  addWidget(type: WidgetType): void;
  removeWidget(id: string): void;
  /** CustomEvent handler: widget's own config changed (title, layout, type-specific options). */
  handleWidgetConfigChange(e: CustomEvent<{ id: string; changes: Partial<WidgetDefinition> }>): void;
  /** CustomEvent handler: primary DataTable config changed. */
  handleTableConfigChange(e: CustomEvent<unknown>): void;
}

export function createWidgetController({
  getConfig,
  saveConfig,
  i18nStore,
}: WidgetControllerOptions): WidgetController {
  function cfg() {
    return getConfig();
  }

  function addWidget(type: WidgetType): void {
    const config = cfg();
    if (!config) return;
    const meta = getWidgetMeta(type);
    if (!meta) return;

    const id = `w-${crypto.randomUUID().slice(0, 8)}`;
    const title = get(i18nStore).t(meta.labelKey);
    const newWidget: WidgetDefinition = {
      id,
      type,
      title,
      layout: { ...meta.defaultLayout },
      config: {},
    };
    saveConfig({ ...config, widgets: [...config.widgets, newWidget] });
  }

  function removeWidget(id: string): void {
    const config = cfg();
    if (!config) return;
    saveConfig({
      ...config,
      widgets: config.widgets.filter((w) => w.id !== id),
    });
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

  return { addWidget, removeWidget, handleWidgetConfigChange, handleTableConfigChange };
}
