<script lang="ts">
  /**
   * DataTableContent — F2.1 (#074, TABLE_V2_CANON): Table V2 orchestrator.
   *
   * Built from scratch on the canon — zero markup or code inherited from
   * src/archive/dashboard-v1/DataTable. Zones: ControlBar → sticky Header →
   * windowed Body (rows) → sticky aggregation Footer. One CSS grid context
   * via --ppp-dt-columns. Read-only phase: in-place editors land in F2.2,
   * row actions / + New row in F2.3, header menu / resize in F2.4,
   * grouping + sub-base tab in F2.5.
   */
  import type { DataFrame, DataRecord, DataField } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { DataTableConfig, FieldPreset } from "../../types";
  import type { ProjectDefinition } from "src/settings/settings";
  import { createEventDispatcher } from "svelte";
  import { app } from "src/lib/stores/obsidian";
  import { computeAggregations } from "src/lib/dashboard-engine/aggregation";
  import {
    buildColumns,
    gridTemplate,
    applySort,
    applySearch,
    activeSortCriteria,
  } from "./tableCanon";
  import TableControlBar from "./TableControlBar.svelte";
  import TableHeader from "./TableHeader.svelte";
  import TableRow from "./TableRow.svelte";
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

  // F2.2+ consumers (in-place editors, row creation); accepted now so the
  // DatabaseCallBlock bridge stays stable across F2 sub-phases.
  $: void api; $: void getRecordColor; $: void fieldPresets; $: void activeFieldPresetId; $: void project;

  const dispatch = createEventDispatcher<{
    configChange: DataTableConfig;
    fieldPresetsChange: { fieldPresets: FieldPreset[]; activeFieldPresetId: string | undefined };
  }>();

  let searchQuery = "";

  $: columns = buildColumns(fields, config);
  $: template = gridTemplate(columns);
  $: sortCriteria = activeSortCriteria(config);
  $: sorted = applySort(frame.records, config);
  $: visibleRecords = applySearch(sorted, searchQuery);

  $: rowHeightRem = config?.rowHeight === "compact" ? 1.75 : config?.rowHeight === "expanded" ? 3 : 2.25;

  // ── Windowing (canon: reuse the simple mechanism, no framework) ──
  const OVERSCAN = 12;
  let bodyEl: HTMLDivElement | null = null;
  let scrollTop = 0;
  let viewportPx = 600;
  $: rowPx = rowHeightRem * 16;
  $: start = Math.max(0, Math.floor(scrollTop / rowPx) - OVERSCAN);
  $: end = Math.min(visibleRecords.length, Math.ceil((scrollTop + viewportPx) / rowPx) + OVERSCAN);
  $: windowed = visibleRecords.slice(start, end);

  function onScroll() {
    if (!bodyEl) return;
    scrollTop = bodyEl.scrollTop;
    viewportPx = bodyEl.clientHeight;
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

  function handleOpenRecord(e: CustomEvent<DataRecord>) {
    $app?.workspace.openLinkText(e.detail.id, e.detail.id, false);
  }
</script>

<div class="ppp-dt-content" style:--ppp-dt-columns={template} style:--ppp-t2-row-height={`${rowHeightRem}rem`}>
  <TableControlBar
    {sortCriteria}
    recordCount={visibleRecords.length}
    {readonly}
    on:search={(e) => (searchQuery = e.detail)}
    on:removeSort={handleRemoveSort}
  />
  <TableHeader {columns} {sortCriteria} />
  <div class="ppp-t2-body" bind:this={bodyEl} on:scroll={onScroll} role="rowgroup">
    {#if start > 0}<div style:height={`${start * rowPx}px`} aria-hidden="true" />{/if}
    {#each windowed as record (record.id)}
      <TableRow {columns} {record} on:openRecord={handleOpenRecord} />
    {/each}
    {#if end < visibleRecords.length}<div style:height={`${(visibleRecords.length - end) * rowPx}px`} aria-hidden="true" />{/if}
  </div>
  {#if showFooter}
    <TableFooter {columns} {aggregations} />
  {/if}
</div>

<style>
  .ppp-dt-content {
    /* Self-contained scroll context — no overflow leak out of the block */
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    container-type: inline-size;
    container-name: db-table;
  }

  .ppp-t2-body {
    flex: 1;
    overflow: auto;
  }
</style>
