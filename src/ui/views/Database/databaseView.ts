// src/ui/views/Database/databaseView.ts

import {
  ProjectView,
  type DataQueryResult,
  type ProjectViewProps,
} from "src/customViewApi";

import DatabaseViewSvelte from "./DatabaseViewCanvas.svelte";
import type { DatabaseViewConfig } from "./types";
import { isLegacyTableConfig, migrateTableConfig } from "./migration";

export class DatabaseView extends ProjectView {
  view?: DatabaseViewSvelte | null;

  getViewType(): string {
    return "database";
  }

  getDisplayName(): string {
    return "Database";
  }

  getIcon(): string {
    return "database";
  }

  onData({ data }: DataQueryResult) {
    this.view?.$set({ frame: data });
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

    this.view = new DatabaseViewSvelte({
      target: props.contentEl,
      props: {
        frame: { fields: [], records: [] },
        api: props.viewApi,
        project: props.project,
        readonly: props.readonly,
        config,
        onConfigChange: props.saveConfig,
        getRecordColor: props.getRecordColor,
      },
    });
  }

  onClose() {
    this.view?.$destroy();
    this.view = null;
  }
}
