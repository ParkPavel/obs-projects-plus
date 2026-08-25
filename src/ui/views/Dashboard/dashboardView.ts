// src/ui/views/Dashboard/dashboardView.ts

import {
  ProjectView,
  type DataQueryResult,
  type ProjectViewProps,
} from "src/customViewApi";

import DashboardCanvasSvelte from "./DashboardCanvas.svelte";
import type { DatabaseViewConfig } from "./types";
import { isLegacyTableConfig, migrateTableConfig, migrateDashboardTransforms } from "./migration";

/**
 * Stable runtime view-type id.
 *
 * v4.0 renames "Database View" → "Dashboard View" (REFACTOR-004).
 * The string literal stored in `view.type` migrates from `"database"`
 * to `"dashboard"`; both keys resolve to the same `DashboardView`
 * instance for back-compat with v3 saves (see `view.ts`).
 *
 * @since 4.0
 */
export const VIEW_TYPE_DASHBOARD = "dashboard";

/** @deprecated Use {@link VIEW_TYPE_DASHBOARD}. Kept for v3-save compatibility. */
export const VIEW_TYPE_DATABASE = "database";

export class DashboardView extends ProjectView {
  view?: DashboardCanvasSvelte | null;

  getViewType(): string {
    return VIEW_TYPE_DASHBOARD;
  }

  getDisplayName(): string {
    return "Dashboard";
  }

  getIcon(): string {
    return "database";
  }

  updateProps(updates: Record<string, any>) {
    this.view?.$set(updates);
  }

  onData({ data, filter }: DataQueryResult) {
    // #125: the canvas needs the COMPLETE filter, not the enabled subset —
    // promoting a filter-tab writes the definition back whole.
    this.view?.$set({ frame: data, globalFilter: filter });
  }

  onOpen(props: ProjectViewProps) {
    // Auto-migrate legacy TableConfig if needed
    let config = props.config as DatabaseViewConfig;
    if (
      isLegacyTableConfig(props.config as Record<string, unknown>)
    ) {
      config = migrateTableConfig(
        props.config as Record<string, unknown>
      );
      props.saveConfig(config);
    }

    // #118: split ordinary scope/grouping out of stored transform pipelines.
    if (config?.widgets) {
      const split = migrateDashboardTransforms(config);
      if (split.migrated) {
        config = split.config;
        props.saveConfig(config);
      }
    }

    this.view = new DashboardCanvasSvelte({
      target: props.contentEl,
      props: {
        frame: { fields: [], records: [] },
        api: props.viewApi,
        project: props.project,
        readonly: props.readonly,
        config,
        onConfigChange: props.saveConfig,
        onViewFilterChange: props.saveViewFilter,
        getRecordColor: props.getRecordColor,
      },
    });
  }

  onClose() {
    this.view?.$destroy();
    this.view = null;
  }
}
