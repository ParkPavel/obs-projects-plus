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
  import { applyFilter, matchesCondition } from "./filterFunctions";
  import { enrichFrameWithAllRelations } from "src/lib/engine/crossProjectResolver";
  import { applyRollupColumns } from "./rollupColumns";
  import { externalFrameInvalidation } from "src/lib/stores/externalFrameInvalidation";
  import { extractRelationTargetIds, getRecordColor as computeRecordColor } from "./viewHelpers";

  import { useView } from "./useView";
  import { applySort, sortRecords } from "./viewSort";
  import RecordCardView from "src/ui/components/RecordCardView/RecordCardView.svelte";
  import { recordPeek, closePeek } from "src/lib/stores/recordPeek";

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
  // #162 — the last invalidation tick this view refetched for.
  let lastInvalidationForLoad = -1;
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
    // #162 — a change in the TARGET project must refresh this view.
    //
    // The load used to fire only when the target-id set changed or this view's
    // own frame did. Adding a session therefore left the client's rollup — and
    // every relation-derived column — showing the number from before, until the
    // client project happened to change or the view was reopened. That is the
    // essay's own scenario ("Number of sessions is computed automatically")
    // silently going stale, and it undercuts #141 rather than complementing it.
    //
    // `externalFrameInvalidation` is the tick `App.svelte` already bumps on
    // every vault create/modify/delete/rename, and it is what `DashboardCanvas`
    // has always listened to. The view simply was not subscribed.
    const invalidation = $externalFrameInvalidation;
    const needsLoad =
      key !== "" &&
      api.resolveExternalFrame !== undefined &&
      (key !== lastTargetSet ||
        dataGeneration !== lastDataGenerationForLoad ||
        invalidation !== lastInvalidationForLoad);
    if (needsLoad) {
      lastTargetSet = key;
      lastDataGenerationForLoad = dataGeneration;
      lastInvalidationForLoad = invalidation;
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
    const fc = project.fieldConfig as
      | import("./viewHelpers").FieldConfigRelationMap
      | undefined;
    // Relation enrichment needs the external frames; rollups do not — a rollup
    // over a self-relation resolves against this very frame (#141), so the old
    // `externalFramesMap.size === 0` early return dropped a whole class of them.
    const enriched =
      externalFramesMap.size > 0
        ? enrichFrameWithAllRelations(frame, externalFramesMap)
        : frame;
    // Rollup values are folded in under the field's own name, so filter, sort
    // and cell renderers all see the aggregate without a separate column.
    return applyRollupColumns(enriched, fc, project.id, externalFramesMap);
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

  /**
   * #168 step (b) — the record held open in the peek, looked up in the frame
   * this view already has rather than fetched. `sortedFrame` is used and not
   * `frame`, so a record filtered out of the view cannot be shown by it: the
   * peek is a closer look at what is on screen, not a back door around the
   * filter.
   */
  $: peeked =
    $recordPeek === null
      ? null
      : (sortedFrame.records.find((r) => r.id === $recordPeek?.id) ?? null);
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
      // #125: the complete definition, so a view that saves a filter back can
      // preserve groups, the conjunction and disabled conditions.
      filter: view.filter,
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

<!--
  One peek for the whole view, not one per surface: a dashboard hosts several
  table widgets, and a store has one value, so "two peeks at once" cannot be
  reached rather than being forbidden by a convention. It closes itself when
  the record it names is no longer in the sorted frame — deleted, renamed or
  filtered away — because a panel describing a row that is gone is worse than
  no panel.
-->
<RecordCardView
  open={peeked !== null}
  fields={sortedFrame.fields}
  record={peeked}
  allRecords={sortedFrame.records}
  autosave={project.autosave ?? true}
  onSave={async (updated) => {
    await api.updateRecord(updated, sortedFrame.fields);
  }}
  on:close={closePeek}
/>

<style>
  div {
    width: 100%;
    height: 100%;
  }
</style>
