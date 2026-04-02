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

  onData({ data, filterConditions }: DataQueryResult) {
    // v4.0.5: Removed dataGeneration guard — it was the root cause of
    // "notes disappear until restart" on both desktop and mobile.
    // The guard intended to skip config-only re-deliveries, but its state
    // (prevDataGeneration) could desynchronize from View.svelte's counter
    // across view switches, component destruction/recreation, and mobile
    // lifecycle events — permanently blocking data delivery.
    // Table/Board/Gallery never had such a guard and work reliably.
    // CalendarView.svelte's updateProcessedData() has its own internal
    // cache that prevents redundant O(N) processing.
    this.dataVersion++;
    const dv = this.dataVersion;
    const fc = filterConditions ?? [];
    try {
      this.view?.$set({ frame: data, dataVersion: dv, filterConditions: fc });
    } catch (e) {
      console.error('[CalendarView] onData CRASHED:', e);
    }
  }

  onOpen(props: ProjectViewProps<CalendarConfig>) {
    this.props = props;
    this.dataVersion = 0;
    try {
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
          filterConditions: [],
        },
      });
    } catch (e) {
      console.error('[CalendarView] onOpen CRASHED:', e);
    }
  }

  onClose() {
    this.dataVersion = 0;
    try {
      this.view?.$destroy();
    } catch (e) {
      console.error('[CalendarView] onClose $destroy CRASHED:', e);
    }
    this.view = null;
  }
}
