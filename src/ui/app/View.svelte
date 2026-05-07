<script lang="ts">
  import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
  import { settings } from "src/lib/stores/settings";
  import type { ViewApi } from "src/lib/viewApi";
  import type {
    ProjectDefinition,
    ProjectId,
    SortDefinition,
    ViewDefinition,
    ViewId,
  } from "src/settings/settings";
  import type {
    RelationFieldConfig,
    RollupFieldConfig,
  } from "src/settings/base/settings";
  import { applyFilter, matchesCondition } from "./filterFunctions";
  import { enrichFrameWithAllRelations } from "src/lib/engine/crossProjectResolver";
  import { computeCrossProjectRollupColumn } from "src/lib/engine/crossProjectRollup";
  import { extractRelationTargetIds, getRecordColor as computeRecordColor } from "./viewHelpers";

  import { useView } from "./useView";
  import { applySort, sortRecords } from "./viewSort";

  /**
   * Specify the project.
   */
  export let project: ProjectDefinition;

  /**
   * Specify the view.
   */
  export let view: ViewDefinition;

  /**
   * Specify the data to display in the view.
   */
  export let frame: DataFrame;

  /**
   * Specify whether the view is read-only.
   */
  export let readonly: boolean;

  /**
   * Specify the API for updating the data.
   */
  export let api: ViewApi;

  /**
   * Specify a callback for updating the view configuration.
   */
  export let onConfigChange: (
    projectId: ProjectId,
    viewId: ViewId,
    cfg: Record<string, any>
  ) => void;

  function handleConfigChange(config: Record<string, any>) {
    onConfigChange(project.id, view.id, config);
  }

  // Clean up any filter conditions for non-existing fields.
  // Guard: skip when frame is empty (initial load) to prevent deleting valid conditions
  // before the first data query completes.
  $: if (frame.fields.length > 0) {
    const fieldNames = frame.fields.map((field) => field.name);
    const nConds = viewFilter.conditions.length;
    const filtered = viewFilter.conditions.filter((cond) => fieldNames.includes(cond.field));
    if (nConds !== filtered.length) {
      settings.updateView(project.id, {
        ...view,
        filter: {
          conjunction: viewFilter?.conjunction ?? "and",
          conditions: filtered,
        },
      });
    }
  }

  $: viewFilter = view.filter ?? { conjunction: "and", conditions: [] };

  // ── Cross-project enrichment (Stage A / M0.4) ─────────────
  // Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.4.
  // When `project.fieldConfig` declares relation/rollup fields, we walk those
  // declarations, resolve each unique `targetProjectId` via the ViewApi
  // closure, and produce an enriched DataFrame with `__resolved__<field>`
  // derived columns plus rollup-result derived columns. While external
  // frames are still loading the raw frame is used so views render
  // immediately; the next reactive tick re-renders with the enriched frame.

  let externalFramesMap: ReadonlyMap<string, DataFrame> = new Map();
  let lastTargetSet = "";
  let lastDataGenerationForLoad = -1;
  // Stage A.9 fix: monotonically-incrementing fetch token guards against
  // out-of-order async resolution when relationTargetIds or `frame` change
  // faster than `resolveExternalFrame` can settle. Only the most-recent
  // dispatch is allowed to commit `externalFramesMap`.
  let externalFetchToken = 0;

  $: relationTargetIds = extractRelationTargetIds(
    project.id,
    project.fieldConfig as import("./viewHelpers").FieldConfigRelationMap | undefined
  );

  $: {
    const key = relationTargetIds.join("|");
    const needsLoad =
      key !== "" &&
      api.resolveExternalFrame !== undefined &&
      (key !== lastTargetSet || dataGeneration !== lastDataGenerationForLoad);
    if (needsLoad) {
      lastTargetSet = key;
      lastDataGenerationForLoad = dataGeneration;
      const myToken = ++externalFetchToken;
      void (async () => {
        const next = new Map<string, DataFrame>();
        const resolveFn = api.resolveExternalFrame!;
        for (const id of relationTargetIds) {
          try {
            const f = await resolveFn(id);
            if (f) next.set(id, f);
          } catch (err) {
            console.warn(
              `[obs-projects-plus] enrichment: failed to resolve project '${id}'`,
              err
            );
          }
        }
        // Drop stale results: if another dispatch superseded us, abandon.
        if (myToken !== externalFetchToken) return;
        externalFramesMap = next;
      })();
    } else if (key === "" && externalFramesMap.size > 0) {
      externalFramesMap = new Map();
      lastTargetSet = "";
      // Invalidate any in-flight fetch so it does not commit later.
      externalFetchToken++;
    }
  }

  $: enrichedFrame = (() => {
    if (relationTargetIds.length === 0 || externalFramesMap.size === 0) {
      return frame;
    }
    let out = enrichFrameWithAllRelations(frame, externalFramesMap);
    // Append a derived field for each rollup configuration.
    const fc = project.fieldConfig as
      | Record<string, { relation?: RelationFieldConfig; rollup?: RollupFieldConfig }>
      | undefined;
    if (fc) {
      for (const [fieldName, cfg] of Object.entries(fc)) {
        const rollupCfg = cfg?.rollup;
        if (!rollupCfg) continue;
        const targetId = rollupCfg.targetProjectId;
        const ext = targetId ? externalFramesMap.get(targetId) : undefined;
        if (!ext) continue;
        const column = computeCrossProjectRollupColumn(out, rollupCfg, ext);
        const derivedName = "__rollup__" + fieldName;
        out = {
          ...out,
          fields: out.fields.some((f) => f.name === derivedName)
            ? out.fields
            : [
                ...out.fields,
                {
                  name: derivedName,
                  type: "rollup" as DataFrame["fields"][number]["type"],
                  identifier: false,
                  derived: true,
                  repeated: false,
                  typeConfig: {},
                },
              ],
          records: out.records.map((r) => {
            const result = column.get(r.id);
            if (!result) return r;
            return {
              ...r,
              values: {
                ...r.values,
                [derivedName]: result.value as unknown as DataRecord["values"][string],
              },
            };
          }),
        };
      }
    }
    return out;
  })();

  $: filteredFrame = applyFilter(enrichedFrame, viewFilter);

  $: viewSort =
    view.sort.criteria.length > 0
      ? view.sort
      : ({
          criteria: [{ field: "path", order: "asc", enabled: true }],
        } satisfies SortDefinition);

  $: sortedFrame = applySort(filteredFrame, viewSort);

  // Track when actual source data changed (frame from DataFrameProvider).
  // Config-only settings writes re-trigger filter/sort (Svelte 3 object equality)
  // producing new arrays with same content. dataGeneration only increments when
  // the raw frame reference actually changes — indicating a real data update.
  let dataGeneration = 0;
  let prevFrameRef: DataFrame | undefined;
  $: {
    if (frame !== prevFrameRef) {
      prevFrameRef = frame;
      dataGeneration++;
    }
  }

  let recordCache: Record<string, DataRecord | undefined>;
  $: {
    frame;
    recordCache = {};
  }

  function getRecordColor(record: DataRecord): string | null {
    return computeRecordColor(
      record,
      view.colors ?? { conditions: [] },
      matchesCondition
    );
  }

  const applyViewSortToRecords = (
    records: ReadonlyArray<DataRecord>
  ): Array<DataRecord> => {
    return sortRecords([...records], viewSort);
  };

  const getRecord = (id: string) => {
    return (
      recordCache[id] ??
      (recordCache[id] = frame.records.find((record) => record.id === id))
    );
  };

  // Promote local widget filter to the global view filter.
  // Called via ProjectViewProps.saveViewFilter by views that expose such UX
  // (currently Database view — see filter-bridge chip).
  const handleViewFilterChange = (filter: typeof view.filter) => {
    settings.updateView(project.id, { ...view, filter });
  };
</script>

<!--
	@component

	View dynamically selects the component to use based on a ViewDefinition.
-->
<div
  use:useView={{
    view,
    dataProps: {
      data: sortedFrame,
      dataGeneration,
      hasSort: view.sort.criteria.filter((c) => c.enabled).length > 0,
      hasFilter: view.filter.conditions.filter((c) => c.enabled).length > 0,
      filterConditions: view.filter.conditions.filter((c) => c.enabled),
    },
    viewApi: api,
    project,
    readonly,
    config: view.config,
    onConfigChange: handleConfigChange,
    onViewFilterChange: handleViewFilterChange,
    getRecordColor: getRecordColor,
    sortRecords: applyViewSortToRecords,
    getRecord,
  }}
/>

<style>
  div {
    width: 100%;
    height: 100%;
  }
</style>
