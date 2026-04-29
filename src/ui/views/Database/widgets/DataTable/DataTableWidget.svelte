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
  import FieldPresetMenu from "./FieldPresetMenu.svelte";
  import { pxToRem, resolveColumnWidthPx } from "./widthUnits";

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
  /** View-scoped column-layout snapshots (Phase 2b). */
  export let fieldPresets: import("../../types").FieldPreset[] = [];
  export let activeFieldPresetId: string | undefined = undefined;

  const dispatch = createEventDispatcher<{
    configChange: DataTableConfig;
    fieldPresetsChange: {
      fieldPresets: import("../../types").FieldPreset[];
      activeFieldPresetId: string | undefined;
    };
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
    // Phase 3 / F5: persist column width in `rem`, not `px`, so layout
    // survives root-font-size changes. Legacy `width` key is stripped
    // here so the preset only contains the new unit going forward.
    const widthRem = pxToRem(width);
    const { width: _legacyWidth, ...rest } = fieldConfig[field] ?? {};
    void _legacyWidth;
    saveConfig({
      fieldConfig: {
        ...fieldConfig,
        [field]: { ...rest, widthRem },
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
        width: resolveColumnWidthPx(fieldConfig[field.name], defaultColumnWidth[field.type] ?? 180),
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

  // ── FieldPreset menu handlers (Phase 2b) ───────────────────
  function handleFieldPresetApply(
    e: CustomEvent<{ nextTable: DataTableConfig; activeId: string | undefined }>,
  ) {
    dispatch("configChange", e.detail.nextTable);
    dispatch("fieldPresetsChange", {
      fieldPresets,
      activeFieldPresetId: e.detail.activeId,
    });
  }

  function handleFieldPresetSave(
    e: CustomEvent<{
      presets: import("../../types").FieldPreset[];
      activeId: string | undefined;
    }>,
  ) {
    dispatch("fieldPresetsChange", {
      fieldPresets: e.detail.presets,
      activeFieldPresetId: e.detail.activeId,
    });
  }
</script>

<div class="ppp-datatable-widget">
  <!-- Field-preset bar (Phase 2b). Hidden in readonly mode so query-result
       views don't expose mutation-heavy controls. -->
  {#if !isReadonly}
    <div class="ppp-datatable-toolbar" role="toolbar" aria-label={$i18n.t("views.database.field-presets.aria-label")}>
      <FieldPresetMenu
        presets={fieldPresets}
        activeId={activeFieldPresetId}
        currentTable={config ?? {}}
        readonly={isReadonly}
        on:apply={handleFieldPresetApply}
        on:save={handleFieldPresetSave}
      />
    </div>
  {/if}
  {#if !isReadonly && !(config?.hintDismissed)}
    <div class="ppp-table-hint" role="note">
      <span class="ppp-table-hint__icon" aria-hidden="true">ⓘ</span>
      <span class="ppp-table-hint__text">
        {$i18n.t("views.database.table.header-hint", {
          defaultValue: "Right-click a column header to rename, change type, hide, pin or reorder. Drag the edge to resize.",
        })}
      </span>
      <button
        type="button"
        class="ppp-table-hint__dismiss clickable-icon"
        on:click={() => saveConfig({ hintDismissed: true })}
        aria-label={$i18n.t("common.dismiss", { defaultValue: "Dismiss" })}
        title={$i18n.t("common.dismiss", { defaultValue: "Dismiss" })}
      >✕</button>
    </div>
  {/if}
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
      <div class="ppp-aggregation-cell ppp-aggregation-cell--row-header" role="rowheader" aria-label={$i18n.t("views.database.aggregation.row-label", { defaultValue: "Aggregation row — click a cell to pick a function" })} title={$i18n.t("views.database.aggregation.row-label", { defaultValue: "Aggregation row — click a cell to pick a function" })}>
        <span class="ppp-aggregation-sigma" aria-hidden="true">Σ</span>
      </div>
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
    <!--
      Single add-row affordance: DataGrid already renders its own footer
      "+ New note" button via onRowAdd. Rendering a second button here
      produced visible duplicate ("+ Добавить заметку" from DataGrid,
      then "+ Новая заметка" from this wrapper). DataGrid is the single
      source of truth.
    -->
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

  .ppp-datatable-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--size-2-2, 0.5rem);
    padding: var(--size-2-1, 0.25rem) var(--size-2-2, 0.5rem);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .ppp-table-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.625rem;
    background: color-mix(in srgb, var(--interactive-accent) 8%, var(--background-secondary));
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    font-size: var(--font-ui-smaller, 0.75rem);
    color: var(--text-muted);
  }
  .ppp-table-hint__icon {
    color: var(--interactive-accent);
    font-size: var(--font-ui-small);
    flex-shrink: 0;
  }
  .ppp-table-hint__text {
    flex: 1;
    line-height: 1.35;
  }
  .ppp-table-hint__dismiss {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    border-radius: var(--radius-s, 0.25rem);
    font-size: 0.7rem;
  }
  .ppp-table-hint__dismiss:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
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
    border-top: 1px solid var(--background-modifier-border);
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
    justify-content: center;
  }

  /* Σ glyph reuses the same visual code as the widget pipeline button
     (Phase 1C). Unified language: Σ = aggregation, ⚙ = config. */
  .ppp-aggregation-sigma {
    font-weight: 700;
    color: var(--text-accent);
    font-size: 0.9rem;
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
