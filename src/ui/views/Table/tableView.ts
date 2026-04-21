import {
  ProjectView,
  type DataQueryResult,
  type ProjectViewProps,
} from "src/customViewApi";

import TableViewSvelte from "./TableView.svelte";
import type { TableConfig } from "./types";
import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";

export class TableView extends ProjectView<TableConfig> {
  view?: TableViewSvelte | null;
  props?: ProjectViewProps;

  getViewType(): string {
    return "table";
  }
  getDisplayName(): string {
    return "Table";
  }
  getIcon(): string {
    return "table";
  }

  onData({ data, filterConditions }: DataQueryResult) {
    this.view?.$set({ frame: data, filterConditions: filterConditions ?? [] });
  }

  onOpen(props: ProjectViewProps<TableConfig>) {
    // Deprecation banner — safe DOM construction (no innerHTML)
    const t = get(i18n).t;
    const banner = props.contentEl.createDiv({ cls: "ppp-deprecation-banner" });
    banner.createSpan({ cls: "ppp-deprecation-icon", text: "\u26a0" });
    banner.createSpan({
      text: t("views.table.deprecation-notice", {
        defaultValue: "Table view is deprecated. Switch to Database view for enhanced features.",
      }),
    });

    this.view = new TableViewSvelte({
      target: props.contentEl,
      props: {
        frame: { fields: [], records: [] },
        api: props.viewApi,
        project: props.project,
        readonly: props.readonly,
        config: props.config,
        onConfigChange: props.saveConfig,
        getRecordColor: props.getRecordColor,
        filterConditions: [],
      },
    });
  }

  onClose() {
    this.view?.$destroy();
    this.view = null;
  }
}
