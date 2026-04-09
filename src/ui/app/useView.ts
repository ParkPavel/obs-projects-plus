import { get } from "svelte/store";

import type {
  DataQueryResult,
  ProjectView,
  ProjectViewProps,
} from "src/customViewApi";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import { customViews } from "src/lib/stores/customViews";
import type { ViewApi } from "src/lib/viewApi";
import type { ProjectDefinition, ViewDefinition } from "src/settings/settings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- View config is dynamic and plugin-specific
export interface ViewProps {
  view: ViewDefinition;
  dataProps: DataQueryResult;
  config: Record<string, any>;
  onConfigChange: (config: Record<string, any>) => void;
  viewApi: ViewApi;
  readonly: boolean;
  project: ProjectDefinition;
  getRecordColor: (record: DataRecord) => string | null;
  sortRecords: ProjectViewProps["sortRecords"];
  getRecord: ProjectViewProps["getRecord"];
}

export function useView(node: HTMLElement, props: ViewProps) {
  // Keep track of previous view id to determine if view should be invalidated.
  let viewId: string;
  const projectId = props.project.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- View configs are dynamic and plugin-specific
  let projectView: ProjectView<Record<string, any>> | undefined;
  let prevConfigJson: string = "";
  let prevProjectJson: string = "";

  const update = (newprops: ViewProps) => {
    // User switched to a different view.
    const dirty =
      newprops.view.id !== viewId || newprops.project.id !== projectId;

    if (dirty) {
      // Clean up previous view.
      void projectView?.onClose();

      node.empty();

      // Look up the next view.
      projectView = get(customViews)[newprops.view.type];

      if (projectView) {
        projectView.onOpen({
          contentEl: node,
          viewId: newprops.view.id,
          project: newprops.project,
          viewApi: newprops.viewApi,
          readonly: newprops.readonly,
          config: newprops.config,
          saveConfig: newprops.onConfigChange,
          getRecordColor: newprops.getRecordColor,
          sortRecords: newprops.sortRecords,
          getRecord: newprops.getRecord,
        });
        projectView.onData(newprops.dataProps);
        prevConfigJson = JSON.stringify(newprops.config);
        prevProjectJson = JSON.stringify(newprops.project);
      }

      viewId = newprops.view.id;
    } else {
      // Batch prop changes into a single $set call to avoid multiple reactive waves
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Svelte component $set() API not in base type
      const updates: Record<string, any> = {};

      // Check if config changed (for freeze, centerOn, etc.)
      const currentConfigJson = JSON.stringify(newprops.config);
      if (currentConfigJson !== prevConfigJson) {
        updates['config'] = newprops.config;
        prevConfigJson = currentConfigJson;
      }

      // Check if project changed (for agenda list saves, etc.)
      const currentProjectJson = JSON.stringify(newprops.project);
      if (currentProjectJson !== prevProjectJson) {
        updates['project'] = newprops.project;
        prevProjectJson = currentProjectJson;
      }
      if (projectView && 'view' in projectView && projectView.view) {
        if (Object.keys(updates).length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Svelte component $set() API not in base type
          // SVELTE4-COMPAT: $set() is removed in Svelte 4.
          // Replace with direct prop assignment or a writable context when migrating.
          (projectView.view as any).$set(updates);
        }
      }

      projectView?.onData(newprops.dataProps);
    }
  };

  update(props);

  return {
    update,
    destroy() {
      void projectView?.onClose();
    },
  };
}
