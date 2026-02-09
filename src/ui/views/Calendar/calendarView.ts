import {
  ProjectView,
  type DataQueryResult,
  type ProjectViewProps,
} from "src/customViewApi";

import CalendarViewSvelte from "./CalendarView.svelte";
import type { CalendarConfig } from "./types";

export class CalendarView extends ProjectView<CalendarConfig> {
  view?: CalendarViewSvelte | null;
  props?: ProjectViewProps;
  private dataVersion = 0;

  getViewType(): string {
    return "calendar";
  }
  getDisplayName(): string {
    return "Calendar";
  }
  getIcon(): string {
    return "calendar";
  }

  onData({ data }: DataQueryResult) {
    this.dataVersion++;
    // Pass dataVersion to force Svelte reactivity on every data update
    this.view?.$set({ frame: data, dataVersion: this.dataVersion });
  }

  onOpen(props: ProjectViewProps<CalendarConfig>) {
    this.props = props;
    this.view = new CalendarViewSvelte({
      target: props.contentEl,
      props: {
        frame: { fields: [], records: [] },
        dataVersion: 0,
        api: props.viewApi,
        project: props.project,
        readonly: props.readonly,
        config: props.config,
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
