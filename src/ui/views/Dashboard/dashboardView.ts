// src/ui/views/Dashboard/dashboardView.ts

import {
  ProjectView,
  type DataQueryResult,
  type ProjectViewProps,
} from "src/customViewApi";

import DashboardCanvasSvelte from "./DashboardCanvas.svelte";
import type { DatabaseViewConfig } from "./types";
import { isLegacyTableConfig, migrateTableConfig, migrateDashboardTransforms } from "./migration";
import { get } from "svelte/store";
import { app } from "src/lib/stores/obsidian";
import { writeMigrationBackup } from "src/lib/settingsBackup";
import { Notice } from "obsidian";
import { i18n } from "src/lib/stores/i18n";

/**
 * Deep copy of a persisted config. `structuredClone` is available in Electron;
 * the JSON path is the fallback, and config is JSON by construction — it is
 * what `data.json` round-trips.
 */
function snapshot<T>(value: T): T {
  try {
    return typeof structuredClone === "function"
      ? structuredClone(value)
      : (JSON.parse(JSON.stringify(value)) as T);
  } catch {
    return value;
  }
}

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
    // #145 — the shape to preserve, captured before anything rewrites it.
    //
    // A structured copy, not the reference: the backup is written after the
    // migrated save, and holding a live reference means any mutation of that
    // object in between would end up in the file instead of the pre-state.
    // Today's migrators build new objects, so the reference happened to be
    // safe — "happened to be" is not a property worth relying on (cross-model
    // audit, 2026-08-28).
    const preMigrationConfig = snapshot(props.config);

    let config = props.config as DatabaseViewConfig;
    let migrated = false;
    if (
      isLegacyTableConfig(props.config as Record<string, unknown>)
    ) {
      config = migrateTableConfig(
        props.config as Record<string, unknown>
      );
      migrated = true;
      props.saveConfig(config);
    }

    // #118: split ordinary scope/grouping out of stored transform pipelines.
    if (config?.widgets) {
      const split = migrateDashboardTransforms(config);
      if (split.migrated) {
        config = split.config;
        migrated = true;
        props.saveConfig(config);
      }
    }

    // #145 — the restore point. Written from the in-memory pre-migration config
    // rather than by reading `data.json` back, which lets the migrated save stay
    // synchronous. An earlier version deferred that save until the read finished
    // and so could overwrite a newer dashboard saved in the meantime — a lost
    // update that idempotence does not prevent (found by cross-model review).
    if (migrated) {
      const obsApp = get(app);
      if (!obsApp) {
        // Nothing to write through. The migration is already saved, so say it
        // rather than leaving the absence of a restore point invisible.
        console.error(
          "[obs-projects-plus] dashboard config migrated without a restore point: no app instance"
        );
      } else {
        void writeMigrationBackup({
          app: obsApp,
          projectId: props.project.id,
          viewId: props.viewId,
          config: preMigrationConfig,
        }).then((path) => {
          if (path !== null) return;
          new Notice(
            get(i18n).t("errors.migrationBackupFailed", {
              defaultValue:
                "The dashboard configuration was migrated, but its restore point could not be written. See the console.",
            })
          );
        });
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
