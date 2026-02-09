import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import type { ProjectDefinition, ViewId } from "./settings/settings";

export interface DataQueryResult {
  data: DataFrame;
  hasSort: boolean;
  hasFilter: boolean;
}

/**
 * ProjectViewProps provides various metadata for the views.
 */
// /skip @typescript-eslint/no-explicit-any - View config is dynamic and plugin-specific, generic T defaults to any
export interface ProjectViewProps<T = Record<string, any>> {
  viewId: ViewId;
  project: ProjectDefinition;
  config: T;
  saveConfig: (config: T) => void;
  contentEl: HTMLElement;
  viewApi: ViewApi;
  readonly: boolean;
  getRecordColor: (record: DataRecord) => string | null;
  sortRecords: (records: ReadonlyArray<DataRecord>) => DataRecord[];
  getRecord: (id: string) => DataRecord | undefined;
}

/**
 * ProjectView is the base class for all Project views.
 *
 * If you want to create a new built-in view, you need to create a new class
 * that extends this one. Then you need to register it in
 * ProjectsView.getProjectViews().
 */
// /skip @typescript-eslint/no-explicit-any - View config is dynamic and plugin-specific, generic T defaults to any
export abstract class ProjectView<T = Record<string, any>> {
  onData(result: DataQueryResult): void {}
  onOpen(props: ProjectViewProps<T>): void {}
  onClose(): void {}

  abstract getViewType(): string;
  abstract getDisplayName(): string;
  abstract getIcon(): string;
}
