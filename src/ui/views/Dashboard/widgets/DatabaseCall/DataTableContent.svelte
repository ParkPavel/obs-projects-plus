<script lang="ts">
  /**
   * DataTableContent — #074 (TABLE_V2_CANON): Table V2 orchestrator.
   *
   * Windowed rows share a grid with their controls, header and footer.
   * Draft controllers own acknowledged writes; row/header menus use contextMenu.
   */
  import type { DataFrame, DataRecord, DataField } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { DataTableConfig, FieldPreset } from "../../types";
  import type { ProjectDefinition, FilterCondition } from "src/settings/settings";
  import { createEventDispatcher, getContext, onDestroy } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { templateFoldersOf } from "src/lib/suggestions/valueSuggestions";
  import { openRecord, modeFromEvent } from "src/lib/record/openRecord";
  import { settings as settingsStore } from "src/lib/stores/settings";
  import {
    SELECTION_CONTEXT_KEY,
    EMPTY_SELECTION,
    type SelectionStore,
    type SelectionState,
  } from "../../canvasSelectionStore";
  import { computeAggregations } from "src/lib/dashboard-engine/aggregation";
  import { emitCommand } from "src/lib/stores/commandBus";
  import { rootFontPx, toRem } from "src/ui/utils/cssLength";
  import { rowWindow, type TableViewport } from "./tableWindow";
  import { editWindow } from "./tableEditWindow";
  import { createTableEditing } from "./tableEditing";
  import { createTableSearch } from "./tableSearch";
  import { parseSearchQuery } from "./tableSearchQuery";
  import TableScrollFrame from "./TableScrollFrame.svelte";
  import { isRowDriving } from "./tableRowOps";
  import { bindTableCreation, tableCreationContext } from "./tableCreation";
  import { openTableRowMenu, setupTableRelation } from "./tableInteractions";
  import { applySortPatch, applyHidePatch, applyCalculatePatch, applyWidthPatch, applyGroupPatch, toggleGroupCollapsed, optionPools, applyFreezePatch } from "./tableHeaderOps";
  import {
    buildColumns,
    gridTemplate,
    applySort,
    activeSortCriteria,
    buildRenderRows,
  } from "./tableCanon";
  import TableGroupSection from "./TableGroupSection.svelte";
  import TableControlBar from "./TableControlBar.svelte";
  import TableHeader from "./TableHeader.svelte";
  import TableRow from "./TableRow.svelte";
  import TableNewRow from "./TableNewRow.svelte";
  import TableFooter from "./TableFooter.svelte";

  export let frame: DataFrame;
  export let api: ViewApi;
  export let readonly: boolean;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let fields: DataField[];
  export let config: DataTableConfig | undefined;
  export let fieldPresets: FieldPreset[] = [];
  export let activeFieldPresetId: string | undefined = undefined;
  export let project: ProjectDefinition | undefined = undefined;
  /** This table's actual project, when it differs from `project` — see tableRowOps. */
  export let sourceProjectId: string | undefined = undefined;
  export let creationConditions: FilterCondition[] = [];
  /** R3 — Selection Bus driver identity (canvas widget id). */
  export let widgetId: string | undefined = undefined;
  /**
   * #169: raised by the widget header's primary action. It opens the inline
   * «+ New» row — the creation path this table already shows — rather than the
   * header inventing a second one.
   */
  export let newRowSignal = 0;

  // F2.4+ consumers; accepted so the DatabaseCallBlock bridge stays stable.
  $: void getRecordColor; $: void fieldPresets; $: void activeFieldPresetId;
  // ── Selection Bus (driver) ───────────────────────────────────
  const selectionStore: SelectionStore | undefined = getContext(SELECTION_CONTEXT_KEY);
  let selection: SelectionState = EMPTY_SELECTION;
  const unsubSelection = selectionStore ? selectionStore.subscribe((v) => (selection = v)) : () => {};
  onDestroy(unsubSelection);

  const dispatch = createEventDispatcher<{
    configChange: DataTableConfig;
    fieldPresetsChange: { fieldPresets: FieldPreset[]; activeFieldPresetId: string | undefined };
  }>();

  let searchQuery = "";
  let visibleRecords: DataRecord[] = [];
  let searching = false;
  const search = createTableSearch(
    (records) => { visibleRecords = records; },
    (pending) => { searching = pending; },
  );
  onDestroy(search.destroy);
  const editing = createTableEditing(() => api, () => fields, () => sourceProjectId ?? project?.id, () => readonly);
  onDestroy(editing.destroy);
  $: editing.refresh(api, fields, sourceProjectId ?? project?.id, readonly);
  $: createRow = bindTableCreation(project, fields, api, creationConditions);
  $: createContext = tableCreationContext(project, sourceProjectId, fields, creationConditions, readonly, api);
  $: columns = buildColumns(fields, config);
  // F2.4: live resize preview overrides one column width until commit.
  let liveWidth: { field: string; rem: number } | null = null;
  $: template = gridTemplate(
    columns.map((c) => (liveWidth && c.field.name === liveWidth.field ? { ...c, widthRem: liveWidth.rem } : c))
  );
  $: sortCriteria = activeSortCriteria(config);
  $: sorted = applySort(frame.records, config);
  $: fieldNames = fields.map((f) => f.name);
  $: search.update(sorted, searchQuery, bodyEl?.ownerDocument.defaultView ?? window, fieldNames);
  $: highlight = searching ? null : parseSearchQuery(searchQuery, fieldNames);
  // F2.5: grouping flattens into the render list (group headers + records).
  // A dirty editor owns its row until commit/cancel. Background sort/search
  // and optimistic refresh must not replace the input carrying that draft.
  $: renderRows = $editing.rows ?? buildRenderRows(visibleRecords, config);
  $: rowHeightRem = config?.rowHeight === "compact" ? 1.75 : config?.rowHeight === "expanded" ? 3 : 2.25;
  $: optionsByField = optionPools(fields, frame.records, { templateFolders: templateFoldersOf($app) });
  $: frozen = !!config?.freezeUpTo && columns.some((c) => c.field.name === config?.freezeUpTo); // i3-table: pinned only on request

  // ── Windowing (canon: simple overscan, no framework) ─────────
  let bodyEl: HTMLDivElement | null = null;
  let viewport: TableViewport = { scrollTop: 0, viewportPx: 600 };
  // B3: a scroll that keeps the same rows in the window is not handed to Svelte.
  const onViewport = (v: TableViewport) => { const w = rowWindow(renderRows.length, rowPx, v); if (w.start !== start || w.end !== end) viewport = v; };
  // Visible part: measured against the scrolling ancestors (in a tile, the page), see tableWindow.
  $: rowPx = rowHeightRem * rootFontPx(bodyEl?.ownerDocument);
  $: ({ start, end } = rowWindow(renderRows.length, rowPx, viewport));
  $: windowed = editWindow(renderRows, start, end, $editing.cell?.recordId);

  // ── Row operations (F2.3) ────────────────────────────────────
  function handleOpenRecord(e: CustomEvent<{ record: DataRecord; event: MouseEvent }>) {
    // #189: plain opens the note, `alt` peeks. `projectId`/`readonly` ride
    // along so an external-source row peeks into itself, read-only.
    const { record } = e.detail;
    if ($app) void openRecord({ id: record.id, projectId: sourceProjectId, readonly }, modeFromEvent(e.detail.event), { app: $app });
  }

  function handleRowMenu(e: CustomEvent<{ record: DataRecord; event: MouseEvent }>) {
    openTableRowMenu(e.detail, {
      project, fields, api, readonly, sourceProjectId, app: $app ?? undefined,
      primaryField: columns.find((c) => c.isPrimary)?.field.name ?? "name",
      selectionStore, selection, widgetId,
      t: (k, d) => $i18n.t(k, { defaultValue: d }),
    });
  }

  // ── Aggregation footer ───────────────────────────────────────
  $: aggregations = config?.showAggregationRow && config.aggregations
    ? computeAggregations({ fields, records: visibleRecords } as DataFrame, config.aggregations)
    : {};
  $: showFooter = Object.keys(aggregations).length > 0;

  function handleRemoveSort(e: CustomEvent<{ field: string }>) {
    const next = sortCriteria.filter((c) => c.field !== e.detail.field);
    const { sortField: _f, sortAsc: _a, ...rest } = config ?? {};
    void _f; void _a;
    dispatch("configChange", { ...rest, sortCriteria: next } as DataTableConfig);
  }

  // ── F2.4: column header menu actions (patches from tableHeaderOps) ──
  function handleResizeCommit(e: CustomEvent<{ field: string; widthRem: number }>) {
    liveWidth = null;
    dispatch("configChange", applyWidthPatch(config, e.detail.field, e.detail.widthRem));
  }

  function handleSetupRelation(field: DataField): void {
    setupTableRelation(field, { app: $app, api, project, frame, t: (k, o) => o ? $i18n.t(k, o) : $i18n.t(k) });
  }
</script>

<div class="ppp-dt-content" aria-busy={searching} style:--ppp-dt-columns={template} style:--ppp-t2-row-height={`${rowHeightRem}rem`}>
  <TableControlBar
    {sortCriteria}
    recordCount={visibleRecords.length}
    {searching}
    {readonly}
    {fieldNames}
    records={sorted}
    on:search={(e) => (searchQuery = e.detail)}
    on:removeSort={handleRemoveSort}
  />
  <!-- UT-R2 #083 + B3: ONE scroll owner for header+rows+footer, both axes. -->
  <TableScrollFrame bind:scroller={bodyEl} {onViewport} {frozen} firstColRem={frozen ? columns[0]?.widthRem ?? 0 : 0}>
    <div class="ppp-t2-table">
      <TableHeader
        {columns}
        {sortCriteria}
        aggregations={config?.aggregations ?? {}}
        groupByField={config?.groupBy?.field}
        {readonly} {frozen} on:freeze={(e) => dispatch("configChange", applyFreezePatch(config, e.detail.freeze ? e.detail.field : null))}
        on:sort={(e) => dispatch("configChange", applySortPatch(config, e.detail.field, e.detail.order))}
        on:hide={(e) => dispatch("configChange", applyHidePatch(config, e.detail))}
        on:calculate={(e) => dispatch("configChange", applyCalculatePatch(config, e.detail.field, e.detail.fn))}
        on:group={(e) => dispatch("configChange", applyGroupPatch(config, e.detail.group ? e.detail.field : null))}
        on:resizeLive={(e) => (liveWidth = { field: e.detail.field, rem: e.detail.widthRem })}
        on:resizeCommit={handleResizeCommit}
        on:addProperty={() => emitCommand("add-field")}
      />
      {#if !searching && searchQuery.trim() !== "" && visibleRecords.length === 0}
        <div class="ppp-t2-search-empty" role="status">
          {$i18n.t("views.dashboard.database-call.no-matches", { defaultValue: "No matches" })}
        </div>
      {/if}
      {#each windowed as row (row.kind === "record" ? row.record.id : row.kind === "spacer" ? row.key : `g:${row.key}`)}
        {#if row.kind === "spacer"}
          <div style:height={toRem(row.count * rowPx)} aria-hidden="true" />
        {:else if row.kind === "group"}
          <TableGroupSection
            groupKey={row.key}
            count={row.count}
            collapsed={row.collapsed}
            on:toggle={(e) => dispatch("configChange", toggleGroupCollapsed(config, e.detail))}
          />
        {:else}
          <TableRow
            {columns}
            record={row.record}
            {readonly}
            {api}
            {frame}
            dateFormat={(sourceProjectId ? $settingsStore.projects.find(p => p.id === sourceProjectId) : project)?.dateFormat}
            driving={widgetId ? isRowDriving(selection, widgetId, row.record) : false}
            editingField={$editing.cell?.recordId === row.record.id ? $editing.cell.field : null}
            saving={$editing.saving}
            retryVersion={$editing.retry}
            {optionsByField}
            {highlight}
            on:openRecord={handleOpenRecord}
            on:rowMenu={handleRowMenu}
            on:startEdit={(e) => editing.start(e.detail, renderRows)}
            on:commitEdit={(e) => editing.commit(e.detail)}
            on:cancelEdit={editing.cancel}
            on:setupRelation={(e) => handleSetupRelation(e.detail)}
          />
        {/if}
      {/each}
      {#if !readonly && project}
        <TableNewRow openSignal={newRowSignal} contextKey={createContext} save={createRow} />
      {/if}
      {#if showFooter}
        <span class="ppp-t2-footer-spacer" />
        <TableFooter {columns} {aggregations} />
      {/if}
    </div>
  </TableScrollFrame>
</div>

<style>
  .ppp-dt-content {
    /* Self-contained scroll context — no overflow leak out of the block */
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    /* #166: no `container-type` here. `db-table` was declared and never
       queried, and the containment still cost a `position: fixed` containing
       block and a nearest-ancestor shift. The queried rungs are R0.13's
       CONTAINER_ROOTS, which excludes `.ppp-dt-content` by design. */
  }

  /* Width = widest grid row (fixed tracks), so sticky header/footer and
     rows share one horizontal coordinate system. */
  .ppp-t2-table {
    display: flex;
    flex-direction: column;
    min-width: max-content;
    min-height: 100%;
  }

  .ppp-t2-footer-spacer { flex: 1; }

  .ppp-t2-search-empty {
    padding: var(--ppp-space-lg);
    color: var(--text-muted);
  }
</style>
