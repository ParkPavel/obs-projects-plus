<script lang="ts">
  import {
    DataFieldType,
    type DataFrame,
    type DataRecord,
    type DataValue,
    type Optional,
  } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { DataTableConfig, AggregationResult, AggregationConfig, ColumnAggregation, DataTableSortCriteria } from "../../types";
  import { computeAggregations } from "../../engine/aggregation";
  import {
    computeVirtualScroll,
    shouldVirtualize,
    getRowHeight,
    type VirtualScrollState,
  } from "../../engine/virtualScroll";
  import {
    computeRowStyles,
    cellStyleToCSS,
  } from "../../engine/conditionalFormat";
  import { groupRecords, type RowGroup } from "./groupRows";
  import { sortRecords } from "src/ui/app/viewSort";

  import DataGrid from "src/ui/views/Table/components/DataGrid/DataGrid.svelte";
  import type { GridColDef, GridRowProps } from "src/ui/views/Table/components/DataGrid/dataGrid";
  import { sortFields } from "src/ui/views/Table/helpers";
  import GroupHeader from "./GroupHeader.svelte";

  import { createEventDispatcher, getContext, onMount, onDestroy } from "svelte";
  import type { Writable } from "svelte/store";
  import { app } from "src/lib/stores/obsidian";
  import { dataSource } from "src/lib/stores/dataframe";
  import { EditNoteModal } from "src/ui/modals/editNoteModal";
  import { CreateNoteModal } from "src/ui/modals/createNoteModal";
  import { ConfigureFieldModal } from "src/ui/modals/configureField";
  import { CreateFieldModal } from "src/ui/modals/createFieldModal";
  import { createDataRecord } from "src/lib/dataApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import { i18n } from "src/lib/stores/i18n";

  // ── Props ──────────────────────────────────────────────────
  export let frame: DataFrame;
  export let api: ViewApi;
  export let readonly: boolean;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let config: DataTableConfig | undefined;
  export let fields: import("src/lib/dataframe/dataframe").DataField[] = [];

  const dispatch = createEventDispatcher<{
    configChange: DataTableConfig;
  }>();

  const projectStore = getContext<Writable<ProjectDefinition>>("project");

  // ── Inline add row ─────────────────────────────────────────
  $: isReadonly = readonly || ($dataSource?.readonly() ?? false);

  function handleAddRow(groupKey?: string) {
    const project = $projectStore;
    if (!project) return;
    new CreateNoteModal($app, project, (name, templatePath, proj) => {
      const autoFill: Record<string, string> = { ...(config?.defaultValues ?? {}) };
      // Auto-fill group field value when creating inside a specific group
      if (groupKey != null && config?.groupBy?.field) {
        autoFill[config.groupBy.field] = groupKey;
      }
      api.addRecord(
        createDataRecord(name, proj, Object.keys(autoFill).length > 0 ? autoFill : undefined),
        fields,
        templatePath
      );
    }).open();
  }

  // ── Row open / edit ────────────────────────────────────────
  function handleRowOpen(id: string, openMode: false | "tab" | "window") {
    $app.workspace.openLinkText(id, id, openMode);
  }

  function handleRowEdit(id: string, values: Record<string, Optional<DataValue>>) {
    const record = { id, values } as DataRecord;
    new EditNoteModal(
      $app,
      fields,
      (rec) => api.updateRecord(rec, fields),
      record,
      frame.records,
      (openMode) => $app.workspace.openLinkText(id, id, openMode),
      async (newName) => {
        const file = $app.vault.getAbstractFileByPath(id);
        if (file && "parent" in file) {
          const newPath = file.parent?.path
            ? `${file.parent.path}/${newName}.md`
            : `${newName}.md`;
          await $app.fileManager.renameFile(file, newPath);
        }
      },
      $projectStore?.autosave ?? true
    ).open();
  }

  // ── Column operations ──────────────────────────────────────
  function handleColumnHide(column: GridColDef) {
    saveConfig({
      fieldConfig: {
        ...fieldConfig,
        [column.field]: { ...fieldConfig[column.field], hide: true },
      },
    });
  }

  function handleColumnPin(column: GridColDef) {
    saveConfig({
      fieldConfig: {
        ...fieldConfig,
        [column.field]: {
          ...fieldConfig[column.field],
          pinned: !(fieldConfig[column.field]?.pinned ?? false),
        },
      },
    });
  }

  function handleColumnResize(field: string, width: number) {
    saveConfig({
      fieldConfig: {
        ...fieldConfig,
        [field]: { ...fieldConfig[field], width },
      },
    });
  }

  function handleColumnSort(sortedFields: string[]) {
    saveConfig({ orderFields: sortedFields });
  }

  /** Per-widget multi-key data sort: click sets single key, shift adds key */
  function handleDataSort(field: string, order: "asc" | "desc") {
    const current = config?.sortCriteria ?? [];
    const existing = current.findIndex((c) => c.field === field);
    let next: DataTableSortCriteria[];
    if (existing >= 0 && current[existing]!.order === order) {
      // Same field+direction → remove (toggle off)
      next = current.filter((_, i) => i !== existing);
    } else if (existing >= 0) {
      // Same field, different direction → update
      next = current.map((c, i) => (i === existing ? { ...c, order } : c));
    } else {
      // New field → replace all (single-key mode from context menu)
      next = [{ field, order }];
    }
    saveConfig({ sortCriteria: next });
  }

  function handleColumnConfigure(column: GridColDef, editable: boolean) {
    const field = fields.find((f) => f.name === column.field);
    if (!field) return;
    new ConfigureFieldModal(
      $app,
      $i18n.t("modals.field.configure.title"),
      field,
      fields.filter((f) => f.name !== field.name),
      editable,
      (updated) => {
        if (editable) {
          if (updated.name !== column.field) {
            api.updateField(updated, column.field);
            // Rename in fieldConfig
            const fc = { ...fieldConfig };
            if (fc[column.field] != null) {
              fc[updated.name] = fc[column.field]!;
              delete fc[column.field];
            }
            saveConfig({ fieldConfig: fc });
          } else {
            api.updateField(updated);
          }
        }
      }
    ).open();
  }

  function handleColumnInsert(anchor: string, direction: number) {
    new CreateFieldModal($app, fields, async (field, value) => {
      const position = fields.findIndex((f) => anchor === f.name) + direction;
      await api.addField(field, value, position);

      const orderFields = fields
        .map((f) => f.name)
        .filter((f) => f !== field.name);
      if (position >= 0) orderFields.splice(position, 0, field.name);
      saveConfig({ orderFields });
    }).open();
  }

  // ── Derived state ──────────────────────────────────────────
  $: ({ fields, records: rawRecords } = frame);
  $: sortCriteria = config?.sortCriteria ?? [];
  $: records = sortCriteria.length > 0
    ? sortRecords([...rawRecords], { criteria: sortCriteria.map(c => ({ ...c, enabled: true })) })
    : rawRecords;
  $: sortedFields = sortFields(fields, config?.orderFields ?? []);
  $: fieldConfig = config?.fieldConfig ?? {};

  const defaultColumnWidth: Record<string, number> = {
    [DataFieldType.Boolean]: 80,
    [DataFieldType.Number]: 110,
    [DataFieldType.Date]: 130,
    [DataFieldType.Status]: 120,
    [DataFieldType.Select]: 140,
    [DataFieldType.String]: 180,
    [DataFieldType.List]: 200,
    [DataFieldType.Formula]: 140,
    [DataFieldType.Relation]: 180,
    [DataFieldType.Rollup]: 120,
    [DataFieldType.Unknown]: 150,
  };

  $: columns = sortedFields
    .filter((field) => {
      if (field.repeated) {
        return field.type === DataFieldType.String;
      }
      return true;
    })
    .map<GridColDef>((field) => {
      const sc = sortCriteria.find(c => c.field === field.name);
      return {
        ...field,
        field: field.name,
        width: fieldConfig[field.name]?.width ?? (defaultColumnWidth[field.type] ?? 180),
        hide: fieldConfig[field.name]?.hide ?? false,
        pinned: fieldConfig[field.name]?.pinned ?? false,
        editable: !field.derived,
        ...(sc ? { sort: { direction: sc.order } } : {}),
      };
    });

  $: conditionalFormats = config?.conditionalFormats ?? [];

  $: rows = records.map<GridRowProps>(({ id, values }) => {
    const row: GridRowProps = { rowId: id, row: values };
    if (conditionalFormats.length === 0) return row;
    const record = { id, values };
    const styleMap = computeRowStyles(conditionalFormats, record);
    const cssMap: Record<string, string> = {};
    for (const [field, style] of Object.entries(styleMap)) {
      const css = cellStyleToCSS(style);
      if (css) cssMap[field] = css;
    }
    return Object.keys(cssMap).length > 0
      ? { ...row, cellStyles: cssMap }
      : row;
  });

  // ── Grouping ───────────────────────────────────────────────
  $: hasGroupBy = !!config?.groupBy;
  $: groups = hasGroupBy && config?.groupBy
    ? groupRecords(records, config.groupBy)
    : ([] as RowGroup[]);

  $: collapsedSet = new Set<string>(config?.groupBy?.collapsedGroups ?? []);

  function toggleGroup(key: string) {
    if (collapsedSet.has(key)) {
      collapsedSet.delete(key);
    } else {
      collapsedSet.add(key);
    }
    collapsedSet = new Set(collapsedSet); // trigger reactivity with new reference
  }

  function groupToRows(group: RowGroup): GridRowProps[] {
    return group.records.map(({ id, values }) => ({
      rowId: id,
      row: values,
    }));
  }

  // ── Aggregation ────────────────────────────────────────────
  $: showAggregation = config?.showAggregationRow ?? false;
  $: aggregations = showAggregation && config?.aggregations
    ? computeAggregations(frame, config.aggregations)
    : ({} as AggregationResult);

  let aggPickerField: string | null = null;

  const numericAggFns: ColumnAggregation[] = ["count","count_values","count_unique","sum","avg","median","min","max","range","percent_empty","percent_not_empty"];
  const booleanAggFns: ColumnAggregation[] = ["count","count_values","count_checked","count_unchecked","percent_checked","percent_unchecked","percent_empty","percent_not_empty"];
  const dateAggFns: ColumnAggregation[]    = ["count","count_values","count_unique","earliest","latest","date_range","percent_empty","percent_not_empty"];
  const defaultAggFns: ColumnAggregation[] = ["count","count_values","count_unique","percent_empty","percent_not_empty"];

  function getAggFnsForField(fieldName: string): ColumnAggregation[] {
    const field = fields.find((f) => f.name === fieldName);
    if (!field) return defaultAggFns;
    switch (field.type) {
      case DataFieldType.Number:
      case DataFieldType.Formula:
      case DataFieldType.Rollup:
        return numericAggFns;
      case DataFieldType.Boolean:
        return booleanAggFns;
      case DataFieldType.Date:
        return dateAggFns;
      default:
        return defaultAggFns;
    }
  }

  function setAggregation(fieldName: string, fn: ColumnAggregation) {
    const current: Record<string, ColumnAggregation> = { ...(config?.aggregations ?? {}) };
    if (fn === "none") {
      delete current[fieldName];
    } else {
      current[fieldName] = fn;
    }
    saveConfig({ aggregations: current as AggregationConfig });
    aggPickerField = null;
  }

  function toggleAggPicker(fieldName: string) {
    aggPickerField = aggPickerField === fieldName ? null : fieldName;
  }

  // Close agg picker on click outside the aggregation row
  function handleDocClick(e: MouseEvent) {
    if (aggPickerField && !(e.target as Element)?.closest?.(".ppp-aggregation-row")) {
      aggPickerField = null;
    }
  }
  onMount(() => document.addEventListener("click", handleDocClick));
  onDestroy(() => document.removeEventListener("click", handleDocClick));

  // ── Virtual scroll ──────────────────────────────────────────
  $: density = config?.rowHeight ?? "default";
  $: rowHeight = getRowHeight(density);
  $: virtualize = shouldVirtualize(rows.length) && !hasGroupBy;

  let containerHeight = 400;
  let scrollTop = 0;

  $: vState = virtualize
    ? computeVirtualScroll(scrollTop, {
        itemCount: rows.length,
        rowHeight,
        containerHeight,
      })
    : ({
        startIndex: 0,
        endIndex: rows.length,
        totalHeight: 0,
        offsetTop: 0,
        visibleCount: rows.length,
      } as VirtualScrollState);

  $: visibleRows = virtualize
    ? rows.slice(vState.startIndex, vState.endIndex)
    : rows;

  function onScroll(e: Event) {
    const el = e.target as HTMLDivElement;
    scrollTop = el.scrollTop;
  }

  function measureContainer(node: HTMLDivElement) {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerHeight = entry.contentRect.height;
      }
    });
    ro.observe(node);
    return {
      destroy() {
        ro.disconnect();
      },
    };
  }

  // ── Config forwarding ──────────────────────────────────────
  function saveConfig(updates: Partial<DataTableConfig>) {
    const updated = { ...config, ...updates } as DataTableConfig;
    dispatch("configChange", updated);
  }

  // ── Record lookup map for O(1) colorModel ──────────────────
  $: recordMap = new Map(frame.records.map((r) => [r.id, r]));
</script>

<div class="ppp-datatable-widget">
  <div class="ppp-table-scroll-container" use:measureContainer on:scroll={onScroll}>
  {#if hasGroupBy && groups.length > 0}
    {#each groups as group (group.key)}
      <GroupHeader
        groupKey={group.key}
        count={group.records.length}
        collapsed={collapsedSet.has(group.key)}
        on:toggle={() => toggleGroup(group.key)}
      />
      {#if !collapsedSet.has(group.key)}
        {#if group.subGroups && group.subGroups.length > 0}
          {#each group.subGroups as subGroup (subGroup.key)}
            <GroupHeader
              groupKey={subGroup.key}
              count={subGroup.records.length}
              collapsed={collapsedSet.has(`${group.key}/${subGroup.key}`)}
              on:toggle={() => toggleGroup(`${group.key}/${subGroup.key}`)}
              level={1}
            />
            {#if !collapsedSet.has(`${group.key}/${subGroup.key}`)}
              <DataGrid
                {columns}
                rows={groupToRows(subGroup)}
                {readonly}
                colorModel={(rowId) => {
                  const record = recordMap.get(rowId);
                  return record ? getRecordColor(record) : null;
                }}
                onColumnResize={handleColumnResize}
                onColumnSort={handleColumnSort}
                onDataSort={handleDataSort}
                onRowAdd={() => handleAddRow(group.key)}
                onRowChange={(rowId, row) => api.updateRecord({ id: rowId, values: row }, fields)}
                onRowDelete={(rowId) => api.deleteRecord(rowId)}
                onRowOpen={handleRowOpen}
                onRowEdit={handleRowEdit}
                onColumnConfigure={handleColumnConfigure}
                onColumnDelete={(field) => api.deleteField(field)}
                onColumnHide={handleColumnHide}
                onColumnPin={handleColumnPin}
                onColumnInsert={handleColumnInsert}
              />
            {/if}
          {/each}
        {:else}
          <DataGrid
            {columns}
            rows={groupToRows(group)}
            {readonly}
            colorModel={(rowId) => {
              const record = recordMap.get(rowId);
              return record ? getRecordColor(record) : null;
            }}
            onColumnResize={handleColumnResize}
            onColumnSort={handleColumnSort}
            onDataSort={handleDataSort}
            onRowAdd={() => handleAddRow(group.key)}
            onRowChange={(rowId, row) => api.updateRecord({ id: rowId, values: row }, fields)}
            onRowDelete={(rowId) => api.deleteRecord(rowId)}
            onRowOpen={handleRowOpen}
            onRowEdit={handleRowEdit}
            onColumnConfigure={handleColumnConfigure}
            onColumnDelete={(field) => api.deleteField(field)}
            onColumnHide={handleColumnHide}
            onColumnPin={handleColumnPin}
            onColumnInsert={handleColumnInsert}
          />
        {/if}
      {/if}
    {/each}
  {:else}
    {#if virtualize}
      <div
        class="ppp-virtual-scroll-container"
      >
        <div
          class="ppp-virtual-scroll-spacer"
          style:height="{vState.totalHeight}px"
        >
          <div
            class="ppp-virtual-scroll-content"
            style:transform="translateY({vState.offsetTop}px)"
          >
            <DataGrid
              {columns}
              rows={visibleRows}
              {readonly}
              colorModel={(rowId) => {
                const record = recordMap.get(rowId);
                return record ? getRecordColor(record) : null;
              }}
              onColumnResize={handleColumnResize}
              onColumnSort={handleColumnSort}
              onDataSort={handleDataSort}
              onRowAdd={() => handleAddRow()}
              onRowChange={(rowId, row) => api.updateRecord({ id: rowId, values: row }, fields)}
              onRowDelete={(rowId) => api.deleteRecord(rowId)}
              onRowOpen={handleRowOpen}
              onRowEdit={handleRowEdit}
              onColumnConfigure={handleColumnConfigure}
              onColumnDelete={(field) => api.deleteField(field)}
              onColumnHide={handleColumnHide}
              onColumnPin={handleColumnPin}
              onColumnInsert={handleColumnInsert}
            />
          </div>
        </div>
      </div>
    {:else}
      <DataGrid
        {columns}
        rows={visibleRows}
        {readonly}
        colorModel={(rowId) => {
          const record = recordMap.get(rowId);
          return record ? getRecordColor(record) : null;
        }}
        onColumnResize={handleColumnResize}
        onColumnSort={handleColumnSort}
        onDataSort={handleDataSort}
        onRowAdd={() => handleAddRow()}
        onRowChange={(rowId, row) => api.updateRecord({ id: rowId, values: row }, fields)}
        onRowDelete={(rowId) => api.deleteRecord(rowId)}
        onRowOpen={handleRowOpen}
        onRowEdit={handleRowEdit}
        onColumnConfigure={handleColumnConfigure}
        onColumnDelete={(field) => api.deleteField(field)}
        onColumnHide={handleColumnHide}
        onColumnPin={handleColumnPin}
        onColumnInsert={handleColumnInsert}
      />
    {/if}
  {/if}

  {#if showAggregation}
    <div class="ppp-aggregation-row">
      <div class="ppp-aggregation-cell ppp-aggregation-cell--row-header"></div>
      {#each columns.filter((c) => !c.hide) as col}
        <div
          class="ppp-aggregation-cell"
          class:ppp-aggregation-cell--active={aggPickerField === col.field}
          style:width="{col.width}px"
          style:min-width="{col.width}px"
          on:click={() => toggleAggPicker(col.field)}
          role="button"
          tabindex="0"
          on:keydown={(e) => e.key === "Enter" && toggleAggPicker(col.field)}
        >
          {#if aggregations[col.field]}
            <span class="ppp-aggregation-value">
              {aggregations[col.field]?.formattedValue ?? ""}
            </span>
          {:else}
            <span class="ppp-aggregation-placeholder">ƒ</span>
          {/if}

          {#if aggPickerField === col.field}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div
              class="ppp-agg-picker"
              on:click|stopPropagation
              on:keydown={(e) => { if (e.key === "Escape") { aggPickerField = null; } }}
              role="listbox"
              tabindex="-1"
              aria-label="Aggregation functions"
            >
              <button
                class="ppp-agg-picker-item"
                class:ppp-agg-picker-item--selected={!config?.aggregations?.[col.field]}
                on:click={() => setAggregation(col.field, "none")}
                role="option"
                aria-selected={!config?.aggregations?.[col.field]}
              >{$i18n.t("views.database.aggregation.none", { defaultValue: "None" })}</button>
              <div class="ppp-agg-picker-divider"></div>
              {#each getAggFnsForField(col.field) as fn}
                <button
                  class="ppp-agg-picker-item"
                  class:ppp-agg-picker-item--selected={config?.aggregations?.[col.field] === fn}
                  on:click={() => setAggregation(col.field, fn)}
                >{fn.replace(/_/g, " ")}</button>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if !isReadonly}
    <button
      class="ppp-add-row-btn"
      on:click={() => handleAddRow()}
      title={$i18n.t("views.database.add-row", { defaultValue: "New note" })}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      {$i18n.t("views.database.add-row", { defaultValue: "New note" })}
    </button>
  {/if}
  </div>
</div>

<style>
  .ppp-datatable-widget {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .ppp-table-scroll-container {
    flex: 1 1 auto;
    overflow: auto;
    scrollbar-gutter: stable;
    min-height: 0;
  }

  .ppp-virtual-scroll-container {
    position: relative;
    min-height: 0;
  }

  .ppp-virtual-scroll-spacer {
    position: relative;
    width: 100%;
  }

  .ppp-virtual-scroll-content {
    will-change: transform;
  }

  .ppp-aggregation-row {
    display: flex;
    border-top: 2px solid var(--background-modifier-border);
    background: var(--background-secondary);
    min-height: 2.25rem;
    align-items: center;
    position: sticky;
    bottom: 0;
    z-index: 10;
  }

  .ppp-aggregation-cell {
    flex-shrink: 0;
    min-width: 0;
    padding: 0 var(--ppp-space-sm, 0.25rem);
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    cursor: pointer;
    position: relative;
  }

  .ppp-aggregation-cell:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-aggregation-cell--active {
    background: var(--background-modifier-hover);
  }

  .ppp-aggregation-placeholder {
    color: var(--text-faint);
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .ppp-aggregation-cell:hover .ppp-aggregation-placeholder {
    opacity: 1;
  }

  .ppp-aggregation-cell--row-header {
    width: var(--ppp-row-header-width, 3.75rem);
    flex-shrink: 0;
  }

  .ppp-aggregation-value {
    font-variant-numeric: tabular-nums;
  }

  .ppp-agg-picker {
    position: absolute;
    bottom: 100%;
    left: 0;
    min-width: 10rem;
    max-height: 15rem;
    overflow-y: auto;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 0.5rem);
    box-shadow: var(--shadow-s, 0 2px 8px rgba(0, 0, 0, 0.15));
    z-index: 100;
    padding: 0.25rem 0;
  }

  .ppp-agg-picker-item {
    display: block;
    width: 100%;
    padding: 0.25rem 0.75rem;
    border: none;
    background: transparent;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    text-align: left;
    cursor: pointer;
    text-transform: capitalize;
  }

  .ppp-agg-picker-item:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-agg-picker-item--selected {
    color: var(--interactive-accent);
    font-weight: var(--font-semibold, 600);
  }

  .ppp-agg-picker-divider {
    height: 1px;
    margin: 0.25rem 0;
    background: var(--background-modifier-border);
  }

  .ppp-add-row-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    padding: 0.375rem var(--ppp-space-md, 0.5rem);
    border: none;
    border-top: 1px solid var(--background-modifier-border);
    background: transparent;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    cursor: pointer;
    transition: background 80ms ease, color 80ms ease;
  }

  .ppp-add-row-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-add-row-btn:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: -2px;
  }

  /* Matryoshka: compact table in narrow container */
  @container widget (max-width: 20rem) {
    .ppp-datatable-widget {
      font-size: var(--font-ui-smaller, 0.75rem);
    }
    .ppp-aggregation-row {
      display: none;
    }
  }
</style>
