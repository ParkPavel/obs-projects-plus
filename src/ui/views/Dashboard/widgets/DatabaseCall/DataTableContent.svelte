<script lang="ts">
  /**
   * DataTableContent — F2.1–F2.3 (#074, TABLE_V2_CANON): Table V2 orchestrator.
   *
   * Built from scratch on the canon — zero markup or code inherited from
   * src/archive/dashboard-v1/DataTable. Zones: ControlBar → sticky Header →
   * windowed Body (rows) → inline «+ New» → sticky aggregation Footer, one
   * CSS grid context via --ppp-dt-columns. Editing: single in-place editor
   * at a time, persistence через viewApi.updateRecord (§6.3
   * bidirectionality). Row menu — through the canonical contextMenu.
   * Header menu / resize land in F2.4, grouping + sub-base tab in F2.5.
   */
  import type { DataFrame, DataRecord, DataField, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { DataTableConfig, FieldPreset } from "../../types";
  import type { ProjectDefinition } from "src/settings/settings";
  import { createEventDispatcher, tick } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { computeAggregations } from "src/lib/dashboard-engine/aggregation";
  import { updateRecordValues } from "src/lib/datasources/helpers";
  import { openContextMenu } from "src/lib/contextMenu";
  import { buildRowMenuEntries, createNamedRecord } from "./tableRowOps";
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

  // F2.4+ consumers; accepted so the DatabaseCallBlock bridge stays stable.
  $: void getRecordColor; $: void fieldPresets; $: void activeFieldPresetId;

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

  // Select/Status dropdown option pools = unique existing values per field.
  $: optionsByField = (() => {
    const map = new Map<string, string[]>();
    for (const f of fields) {
      if (f.type !== DataFieldType.Select && f.type !== DataFieldType.Status) continue;
      const seen = new Set<string>();
      for (const r of frame.records) {
        const v = r.values[f.name];
        if (typeof v === "string" && v !== "") seen.add(v);
      }
      map.set(f.name, [...seen].sort((a, b) => a.localeCompare(b)));
    }
    return map;
  })();

  // ── Windowing (canon: simple overscan, no framework) ─────────
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

  // ── Editing (F2.2): one in-place editor per table ────────────
  let editingCell: { recordId: string; field: string } | null = null;

  function handleCommitEdit(e: CustomEvent<{ record: DataRecord; field: string; value: Optional<DataValue> }>) {
    const { record, field, value } = e.detail;
    editingCell = null;
    if (record.values[field] === value) return;
    api.updateRecord(updateRecordValues(record, { [field]: value }), fields);
  }

  // ── Row operations (F2.3) ────────────────────────────────────
  function handleOpenRecord(e: CustomEvent<DataRecord>) {
    $app?.workspace.openLinkText(e.detail.id, e.detail.id, false);
  }

  function handleRowMenu(e: CustomEvent<{ record: DataRecord; event: MouseEvent }>) {
    const entries = buildRowMenuEntries({
      record: e.detail.record, project, fields, api, app: $app ?? undefined,
      t: (k, d) => $i18n.t(k, { defaultValue: d }),
    });
    openContextMenu(entries, e.detail.event);
  }

  // «+ New row» — inline name input at the body end (canon §1/§3).
  let newRowActive = false;
  let newRowName = "";
  let newRowEl: HTMLInputElement | null = null;

  async function openNewRow() {
    newRowActive = true;
    await tick();
    newRowEl?.focus();
  }

  function commitNewRow(keepOpen: boolean) {
    const name = newRowName.trim();
    if (name && project) createNamedRecord(name, project, fields, api);
    newRowName = "";
    newRowActive = keepOpen && !!name;
    if (newRowActive) void tick().then(() => newRowEl?.focus());
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
      <TableRow
        {columns}
        {record}
        {readonly}
        editingField={editingCell?.recordId === record.id ? editingCell.field : null}
        {optionsByField}
        on:openRecord={handleOpenRecord}
        on:rowMenu={handleRowMenu}
        on:startEdit={(e) => (editingCell = e.detail)}
        on:commitEdit={handleCommitEdit}
        on:cancelEdit={() => (editingCell = null)}
      />
    {/each}
    {#if end < visibleRecords.length}<div style:height={`${(visibleRecords.length - end) * rowPx}px`} aria-hidden="true" />{/if}
    {#if !readonly && project}
      <div class="ppp-t2-newrow">
        {#if newRowActive}
          <input
            bind:this={newRowEl}
            class="ppp-t2-newrow-input"
            type="text"
            bind:value={newRowName}
            placeholder={$i18n.t("views.dashboard.table-v2.new-name", { defaultValue: "Note name…" })}
            on:keydown={(e) => {
              if (e.key === "Enter") commitNewRow(true);
              else if (e.key === "Escape") { newRowName = ""; newRowActive = false; }
            }}
            on:blur={() => commitNewRow(false)}
          />
        {:else}
          <button class="ppp-t2-newrow-btn" on:click={openNewRow}>
            + {$i18n.t("views.dashboard.table-v2.new", { defaultValue: "New" })}
          </button>
        {/if}
      </div>
    {/if}
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

  .ppp-t2-newrow {
    display: flex;
    align-items: center;
    min-height: 2.25rem;
    padding: 0 0.5rem;
  }

  .ppp-t2-newrow-btn {
    border: none;
    background: transparent;
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    cursor: pointer;
    padding: 0.25rem 0;
  }

  .ppp-t2-newrow-btn:hover {
    color: var(--text-muted);
  }

  .ppp-t2-newrow-input {
    width: 100%;
    max-width: 20rem;
    height: 1.75rem;
    font-size: var(--font-ui-small);
  }
</style>
