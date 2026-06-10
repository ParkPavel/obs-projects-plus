<script lang="ts">
  /**
   * @deprecated Standalone DataTableWidget is scheduled for archive in #056.
   * Table functionality is now provided via DatabaseCall Table view tab
   * (DataTableContent.svelte). This file remains as the rendering engine
   * until the CSS Grid migration is complete.
   */
  import {
    DataFieldType,
    type DataFrame,
    type DataField,
    type DataRecord,
    type DataValue,
    type Optional,
  } from "src/lib/dataframe/dataframe";
  import { Notice } from "obsidian";
  import { exportRecords, type ExportFormat } from "src/lib/export/exportService";
  import type { ViewApi } from "src/lib/viewApi";
  import type { DataTableConfig, AggregationResult, AggregationConfig, ColumnAggregation, DataTableSortCriteria } from "src/ui/views/Dashboard/types";
  import { computeAggregations } from "src/lib/dashboard-engine/aggregation";
  import {
    computeVirtualScroll,
    shouldVirtualize,
    getRowHeight,
    type VirtualScrollState,
  } from "src/lib/dashboard-engine/virtualScroll";
  import {
    computeRowStyles,
    cellStyleToCSS,
  } from "src/lib/dashboard-engine/conditionalFormat";
  import { groupRecords, type RowGroup } from "./groupRows";
  import { sortRecords } from "src/ui/app/viewSort";
  import {
    createSubBase,
    renameSubBase,
    type SubBaseDefinition,
  } from "src/lib/database/subBase";
  import { applyFilter } from "src/ui/app/filterFunctions";
  import { PROPERTY_TYPES, type PropertyType } from "src/lib/visualizer/propertyTypes";
  import {
    ROLLUP_MODES,
    getRollupMode,
    modesForTarget,
    groupModes,
    classifyRollupTarget,
    type RollupModeId,
    type RollupModeGroup,
  } from "src/lib/database/rollupMode";
  import { openContextMenu, type ContextMenuEntry } from "src/lib/contextMenu";
  import type { FieldConfig } from "src/settings/settings";

  import DataGrid from "src/ui/views/Table/components/DataGrid/DataGrid.svelte";
  import type { GridColDef, GridRowProps } from "src/ui/views/Table/components/DataGrid/dataGrid";
  import { sortFields } from "src/ui/views/Table/helpers";
  import GroupHeader from "./GroupHeader.svelte";
  import FieldPresetMenu from "./FieldPresetMenu.svelte";
  import SubBaseTabs from "./SubBaseTabs.svelte";
  import RecordCardView from "src/ui/components/RecordCardView/RecordCardView.svelte";
  import { viewShortcuts } from "src/lib/keyboard/viewShortcuts";
  import { pxToRem, resolveColumnWidthPx } from "./widthUnits";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import PopoverList, { type PopoverItem } from "src/ui/components/FloatingPopup/PopoverList.svelte";
  import { getFieldIcon } from "src/ui/components/Navigation/SettingsMenu/tabs/filterHelpers";

  import {
    SELECTION_CONTEXT_KEY,
    EMPTY_SELECTION,
    type SelectionStore,
    type SelectionState,
  } from "src/ui/views/Dashboard/canvasSelectionStore";
  import { computeMatchingRowIds } from "./dataTableSelectionReceiver";
  import {
    computeDataTableSelectionToggle,
    isThisWidgetDriving,
  } from "./dataTableSelectionDriver";

  import { createEventDispatcher, getContext, setContext, onMount, onDestroy } from "svelte";
  import { writable, type Writable } from "svelte/store";
  import { app } from "src/lib/stores/obsidian";
  import { dataSource } from "src/lib/stores/dataframe";
  import { settings } from "src/lib/stores/settings";
  import { commandBus } from "src/lib/stores/commandBus";
  import { CreateNoteModal } from "src/ui/modals/createNoteModal";
  import { ConfigureFieldModal } from "src/ui/modals/configureField";
  import { CreateFieldModal } from "src/ui/modals/createFieldModal";
  import { createDataRecord } from "src/lib/dataApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import { i18n } from "src/lib/stores/i18n";

  // -- Props --------------------------------------------------
  export let frame: DataFrame;
  export let api: ViewApi;
  export let readonly: boolean;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let config: DataTableConfig | undefined;
  export let fields: import("src/lib/dataframe/dataframe").DataField[] = [];
  /** View-scoped column-layout snapshots (Phase 2b). */
  export let fieldPresets: import("src/ui/views/Dashboard/types").FieldPreset[] = [];
  export let activeFieldPresetId: string | undefined = undefined;
  /**
   * Stage A.9: current project, forwarded by `WidgetHost` from
   * `DatabaseViewCanvas`. Used by the column-configure flow to populate
   * the Relation/Rollup target-project pickers and to persist
   * cross-project config in `project.fieldConfig`. Optional because
   * existing isolated tests mount this widget without a project.
   */
  export let project:
    | import("src/settings/settings").ProjectDefinition
    | undefined = undefined;

  /**
   * #044.3a — stable widget identifier from the canvas. When mounted on a
   * `DashboardCanvas`, `WidgetHost` forwards `widget.id`; standalone Table
   * consumers leave this undefined and the receiver wiring is a no-op.
   */
  export let widgetId: string | undefined = undefined;

  // ── #044.3a — cross-widget selection (receiver only) ───────────
  // The store is mounted on `DashboardCanvas` (#044.1). When this widget is
  // hosted elsewhere (settings preview, standalone Table tests) the context
  // is absent — the reactive block below treats that as "no selection" and
  // skips all per-row decoration.
  const selectionStore =
    getContext<SelectionStore | undefined>(SELECTION_CONTEXT_KEY) ?? undefined;
  // `derived` would also work, but a plain `$:` block keeps the dependency
  // graph readable for the next maintainer.
  $: selection = (selectionStore ? ($selectionStore as SelectionState) : undefined) ?? EMPTY_SELECTION;

  const dispatch = createEventDispatcher<{
    configChange: DataTableConfig;
    fieldPresetsChange: {
      fieldPresets: import("src/ui/views/Dashboard/types").FieldPreset[];
      activeFieldPresetId: string | undefined;
    };
  }>();

  const projectStore = getContext<Writable<ProjectDefinition>>("project");

  // NPLAN-S4.1: provide relation candidate options to GridRelationCell via context
  const relationOptionsStore = writable<Map<string, string[]>>(new Map());
  setContext("ppp-relationOptions", relationOptionsStore);

  $: {
    const map = new Map<string, string[]>();
    for (const field of fields.filter((f) => f.type === DataFieldType.Relation)) {
      const vals = new Set<string>();
      for (const rec of frame.records) {
        const v = rec.values[field.name];
        if (v != null) {
          const str = String(v);
          const matches = str.match(/\[\[([^\]]+)\]\]/g);
          if (matches) matches.forEach((m) => vals.add(m.slice(2, -2)));
          else str.split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => vals.add(s));
        }
      }
      map.set(field.name, [...vals].sort());
    }
    relationOptionsStore.set(map);
  }

  // -- Inline add row -----------------------------------------
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
      // NPLAN-A2: auto-assign UniqueId field values
      const uniqueIdFields = fields.filter((f) => f.type === DataFieldType.UniqueId);
      if (uniqueIdFields.length > 0) {
        const counter = settings.bumpUniqueId(proj.id);
        for (const f of uniqueIdFields) {
          const prefix = (f.typeConfig as { uniqueIdPrefix?: string } | undefined)?.uniqueIdPrefix ?? "";
          autoFill[f.name] = `${prefix}${counter}`;
        }
      }
      api.addRecord(
        createDataRecord(name, proj, Object.keys(autoFill).length > 0 ? autoFill : undefined),
        fields,
        templatePath
      );
    }).open();
  }

  // Tab-at-end silent insert: creates a record without opening a modal.
  // Base-36 timestamp suffix guarantees a unique filename within the vault.
  function handleAddRowSilent(groupKey?: string): void {
    const project = $projectStore;
    if (!project || isReadonly) return;
    const name = `Untitled ${Date.now().toString(36)}`;
    const autoFill: Record<string, string> = { ...(config?.defaultValues ?? {}) };
    if (groupKey != null && config?.groupBy?.field) {
      autoFill[config.groupBy.field] = groupKey;
    }
    const uniqueIdFields = fields.filter((f) => f.type === DataFieldType.UniqueId);
    if (uniqueIdFields.length > 0) {
      const counter = settings.bumpUniqueId(project.id);
      for (const f of uniqueIdFields) {
        const prefix = (f.typeConfig as { uniqueIdPrefix?: string } | undefined)?.uniqueIdPrefix ?? "";
        autoFill[f.name] = `${prefix}${counter}`;
      }
    }
    void api.addRecord(
      createDataRecord(name, project, Object.keys(autoFill).length > 0 ? autoFill : undefined),
      fields,
      ""
    );
  }

  // -- Row open / edit ----------------------------------------
  let cardViewOpen = false;
  let cardViewRecord: DataRecord | null = null;

  function handleRowOpen(id: string, openMode: false | "tab" | "window") {
    $app.workspace.openLinkText(id, id, openMode);
  }

  function handleRowEdit(id: string, values: Record<string, Optional<DataValue>>) {
    cardViewRecord = { id, values } as DataRecord;
    cardViewOpen = true;
  }

  async function handleCardSave(record: DataRecord) {
    await api.updateRecord(record, fields);
  }

  async function handleCardRename(newName: string) {
    if (!cardViewRecord) return;
    const file = $app.vault.getAbstractFileByPath(cardViewRecord.id);
    if (file && "parent" in file) {
      const newPath = file.parent?.path
        ? `${file.parent.path}/${newName}.md`
        : `${newName}.md`;
      await $app.fileManager.renameFile(file, newPath);
    }
  }

  // -- Column operations --------------------------------------
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
      // Same field+direction > remove (toggle off)
      next = current.filter((_, i) => i !== existing);
    } else if (existing >= 0) {
      // Same field, different direction > update
      next = current.map((c, i) => (i === existing ? { ...c, order } : c));
    } else {
      // New field > replace all (single-key mode from context menu)
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
          // Stage A.9: persist Relation/Rollup config in project.fieldConfig
          // (the source of truth used by the cross-project enrichment
          // engine). The Table-level fieldConfig (width/hide/pinned) is
          // saved above; Stage A's relation/rollup keys live on the
          // project itself.
          if (project && updated.typeConfig) {
            settings.updateFieldConfig(
              project.id,
              updated.name,
              fields.map((f) => f.name),
              updated.typeConfig
            );
          }
        }
      },
      $settings.projects,
      project?.id ?? ""
    ).open();
  }

  function handleColumnInsert(anchor: string, direction: number) {
    new CreateFieldModal(
      $app,
      fields,
      async (field, value) => {
        const position = fields.findIndex((f) => anchor === f.name) + direction;
        await api.addField(field, value, position);

        const orderFields = fields
          .map((f) => f.name)
          .filter((f) => f !== field.name);
        if (position >= 0) orderFields.splice(position, 0, field.name);
        saveConfig({ orderFields });
      },
      $settings.projects,
      project?.id ?? ""
    ).open();
  }

  function handleColumnRename(oldName: string, newName: string) {
    const field = fields.find((f) => f.name === oldName);
    if (!field) return;
    api.updateField({ ...field, name: newName }, oldName);
  }

  // -- R2.1b: Column-header context menu � property-type override + rollup-mode picker

  /**
   * Persist a partial patch on `project.fieldConfig[fieldName]`.
   * Strips `undefined`-valued keys so callers can use them as
   * "delete this key" sentinels under exactOptionalPropertyTypes.
   */
  function persistFieldConfigPatch(
    fieldName: string,
    patch: Record<string, unknown>
  ): void {
    if (!project) return;
    const existing = (project.fieldConfig?.[fieldName] ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...existing, ...patch };
    for (const key of Object.keys(merged)) {
      if (merged[key] === undefined) {
        delete merged[key];
      }
    }
    settings.updateFieldConfig(
      project.id,
      fieldName,
      fields.map((f) => f.name),
      merged as FieldConfig
    );
  }

  function setPropertyTypeOverride(
    fieldName: string,
    type: PropertyType | null
  ): void {
    persistFieldConfigPatch(fieldName, { type: type ?? undefined });
  }

  /**
   * Atomic mode-function sync: when `mode.fn === null` (presentational)
   * we keep the existing engine `function` so the kernel stays valid.
   */
  function setRollupMode(fieldName: string, modeId: RollupModeId): void {
    if (!project) return;
    const existing = project.fieldConfig?.[fieldName];
    const rollup = existing?.rollup;
    if (!rollup) return;
    const desc = getRollupMode(modeId);
    if (!desc) return;
    const fn = desc.fn ?? rollup.function;
    const nextRollup = { ...rollup, mode: modeId, function: fn };
    persistFieldConfigPatch(fieldName, { rollup: nextRollup });
  }

  /**
   * Resolve the target field's coarse kind for `modesForTarget` filtering.
   * Walks `fieldConfig.rollup.{targetProjectId, targetField}` and looks up
   * the target project's fields via the data sources of that project's
   * `DataField[]` if available; otherwise falls back to user override
   * `fieldConfig[targetField].type`. Returns "any" when unresolvable.
   */
  function resolveRollupTargetKind(rollup: NonNullable<FieldConfig["rollup"]>): string {
    const projects = $settings.projects;
    const targetProj = rollup.targetProjectId
      ? projects.find((p) => p.id === rollup.targetProjectId)
      : undefined;
    const overrideType = targetProj?.fieldConfig?.[rollup.targetField]?.type;
    if (overrideType) return overrideType;
    return "any";
  }

  function buildExtraColumnMenuEntries(column: GridColDef): ContextMenuEntry[] {
    const t = $i18n.t;
    const field = fields.find((f) => f.name === column.field);
    if (!field || field.derived) return [];

    const currentType = field.typeConfig?.type ?? null;
    const propertyTypeSubmenu: ContextMenuEntry[] = [
      {
        title: t("views.dashboard.table.column-menu.property-type-auto"),
        checked: currentType === null,
        onClick: () => setPropertyTypeOverride(column.field, null),
      },
      { separator: true },
      ...PROPERTY_TYPES.map<ContextMenuEntry>((type) => ({
        title: t(`data-types.${type}`),
        checked: currentType === type,
        onClick: () => setPropertyTypeOverride(column.field, type),
      })),
    ];

    const entries: ContextMenuEntry[] = [
      {
        title: t("views.dashboard.table.column-menu.property-type"),
        icon: "type",
        onClick: () => {},
        submenu: propertyTypeSubmenu,
      },
    ];

    // Rollup mode picker � only when the field is configured as a rollup.
    const rollupCfg = field.typeConfig?.rollup;
    if (rollupCfg) {
      const targetKind = resolveRollupTargetKind(rollupCfg);
      const applicable = modesForTarget(
        classifyRollupTarget(targetKind)
      );
      const grouped = groupModes(applicable);
      const currentMode = rollupCfg.mode ?? null;

      const rollupSubmenu: ContextMenuEntry[] = [];
      const groupOrder: RollupModeGroup[] = ["show", "count", "percent", "more"];
      let firstGroup = true;
      for (const g of groupOrder) {
        const list = grouped[g];
        if (!list || list.length === 0) continue;
        if (!firstGroup) rollupSubmenu.push({ separator: true });
        firstGroup = false;
        for (const m of list) {
          rollupSubmenu.push({
            title: t(m.i18nKey),
            checked: currentMode === m.id,
            onClick: () => setRollupMode(column.field, m.id),
          });
        }
      }

      entries.push({
        title: t("views.dashboard.table.column-menu.rollup-mode"),
        icon: "sigma",
        onClick: () => {},
        submenu: rollupSubmenu,
      });
    }

    return entries;
  }
  // Keep ROLLUP_MODES referenced so lint sees it in use elsewhere.
  void ROLLUP_MODES;

  // -- Derived state ------------------------------------------
  $: ({ fields, records: rawRecords } = frame);

  // R2.2 � sub-base partitioning (applied before sort/group)
  $: subBases = config?.subBases ?? [];
  $: activeSubBaseId =
    config?.activeSubBaseId && subBases.some((s) => s.id === config.activeSubBaseId)
      ? config.activeSubBaseId
      : (subBases[0]?.id ?? null);
  $: activeSubBase = subBases.find((s) => s.id === activeSubBaseId) ?? null;
  $: filteredRecords = activeSubBase
    ? applyFilter({ ...frame, records: rawRecords }, activeSubBase.filter).records
    : rawRecords;

  $: sortCriteria = config?.sortCriteria ?? [];
  $: records = sortCriteria.length > 0
    ? sortRecords([...filteredRecords], { criteria: sortCriteria.map(c => ({ ...c, enabled: true })) })
    : filteredRecords;
  $: sortedFields = sortFields(fields, config?.orderFields ?? []);
  $: fieldConfig = config?.fieldConfig ?? {};

  // C19: count of fields the user has explicitly hidden
  $: hiddenFieldCount = fields.filter((f) => fieldConfig[f.name]?.hide === true).length;

  // Quick search — local state, does not persist to config
  let searchQuery = "";
  let showSearchBar = false;

  function openSearchBar() {
    showSearchBar = true;
    setTimeout(() => {
      (document.querySelector(".ppp-search-input") as HTMLInputElement)?.focus();
    }, 0);
  }

  $: searchedRecords = searchQuery.trim()
    ? records.filter((r) => {
        const q = searchQuery.toLowerCase().trim();
        return Object.values(r.values).some((v) => {
          if (v == null) return false;
          if (Array.isArray(v)) return v.some((item) => String(item).toLowerCase().includes(q));
          return String(v).toLowerCase().includes(q);
        });
      })
    : records;

  // ══ FloatingPopup-backed dropdowns (#034.2a) ══
  let activePopover: {
    anchorEl: HTMLElement;
    items: PopoverItem[];
    searchable: boolean;
  } | null = null;

  function rebuildFieldVisibilityItems(): PopoverItem[] {
    return fields.map((f) => ({
      label: f.name,
      icon: getFieldIcon(f.type),
      selected: fieldConfig[f.name]?.hide !== true,
      keepOpen: true,
      handler: () => {
        const nowHiding = fieldConfig[f.name]?.hide !== true;
        saveConfig({
          fieldConfig: {
            ...fieldConfig,
            [f.name]: { ...fieldConfig[f.name], hide: nowHiding },
          },
        });
      },
    }));
  }

  function openFieldVisibilityPop(anchor: HTMLElement) {
    activePopover = {
      anchorEl: anchor,
      searchable: false,
      items: rebuildFieldVisibilityItems(),
    };
  }

  // Quick sort indicator (shows active sort criteria count, allows clear)
  $: activeSortCount = (config?.sortCriteria ?? []).length + (config?.sortField ? 1 : 0);

  function openSortPop(anchor: HTMLElement) {
    const criteria = config?.sortCriteria ?? [];
    const legacyField = config?.sortField;
    const items: PopoverItem[] = [
      ...(legacyField ? [{
        label: `${legacyField} ${config?.sortAsc ? "↑" : "↓"}`,
        icon: config?.sortAsc ? "arrow-up" : "arrow-down",
        selected: true,
        handler: () => { const { sortField: _f, sortAsc: _a, ...rest } = config ?? {}; void _f; void _a; dispatch("configChange", { ...rest } as DataTableConfig); },
      }] : []),
      ...criteria.map((c) => ({
        label: `${c.field} ${c.order === "asc" ? "↑" : "↓"}`,
        icon: c.order === "asc" ? "arrow-up" : "arrow-down",
        selected: true,
        handler: () => saveConfig({ sortCriteria: criteria.filter((x) => x !== c) }),
      })),
      ...(criteria.length > 0 || legacyField ? [{
        label: $i18n.t("views.dashboard.table.sort-clear-all", { defaultValue: "Clear all sorting" }),
        icon: "x",
        selected: false,
        handler: () => { const { sortField: _f, sortAsc: _a, ...rest } = config ?? {}; void _f; void _a; dispatch("configChange", { ...rest, sortCriteria: [] } as DataTableConfig); },
      }] : [{
        label: $i18n.t("views.dashboard.table.sort-hint", { defaultValue: "Right-click a column header to sort" }),
        icon: "info",
        selected: false,
        handler: () => { /* no-op */ },
      }]),
    ];
    activePopover = { anchorEl: anchor, searchable: false, items };
  }

  // Quick group-by picker
  $: activeGroupField = config?.groupBy?.field ?? "";

  function openGroupPop(anchor: HTMLElement) {
    const noGroupEntry: PopoverItem = {
      label: $i18n.t("views.dashboard.table.group-none", { defaultValue: "None (clear grouping)" }),
      icon: "x",
      selected: !activeGroupField,
      handler: () => {
        const { groupBy: _omit, ...rest } = config ?? {};
        void _omit;
        saveConfig(rest as DataTableConfig);
      },
    };
    const fieldEntries: PopoverItem[] = fields.map((f) => ({
      label: f.name,
      icon: getFieldIcon(f.type),
      selected: f.name === activeGroupField,
      handler: () => {
        saveConfig({
          groupBy: {
            field: f.name,
            sortOrder: "asc",
            hiddenGroups: config?.groupBy?.hiddenGroups ?? [],
            collapsedGroups: config?.groupBy?.collapsedGroups ?? [],
            showEmptyGroups: config?.groupBy?.showEmptyGroups ?? false,
          },
        });
      },
    }));
    activePopover = {
      anchorEl: anchor,
      searchable: true,
      items: [noGroupEntry, ...fieldEntries],
    };
  }

  function handlePopoverSelect(
    e: CustomEvent<{ item: PopoverItem; keepOpen: boolean }>,
  ): void {
    if (e.detail.keepOpen) {
      // keepOpen items (field-visibility toggles) rebuild the list in place
      // so the checkmark state reflects the new fieldConfig immediately.
      if (activePopover) {
        activePopover = {
          ...activePopover,
          items: rebuildFieldVisibilityItems(),
        };
      }
      return;
    }
    activePopover = null;
  }

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

  $: columns = (() => {
    const base = sortedFields
      .filter((field) => {
        if (field.repeated) {
          return field.type === DataFieldType.String;
        }
        return true;
      })
      .map<GridColDef>((field) => {
        const sc = sortCriteria.find(c => c.field === field.name);
        const userHide = fieldConfig[field.name]?.hide;
        const defaultHide = field.derived && field.name === "path";
        return {
          ...field,
          field: field.name,
          width: resolveColumnWidthPx(fieldConfig[field.name], defaultColumnWidth[field.type] ?? 180),
          hide: userHide ?? defaultHide,
          pinned: fieldConfig[field.name]?.pinned ?? false,
          editable: !field.derived,
          ...(sc ? { sort: { direction: sc.order } } : {}),
        };
      });
    return config?.hideEmptyFields
      ? base.filter((col) => records.some((r) => r.values[col.field] != null && r.values[col.field] !== ""))
      : base;
  })();
  $: exportableFields = columns
    .filter((c) => !c.hide)
    .map((c) => fields.find((f) => f.name === c.field))
    .filter((f): f is DataField => f != null);

  function handleExportClick(e: MouseEvent) {
    const formats: Array<{ label: string; format: ExportFormat }> = [
      { label: "CSV (.csv)", format: "csv" },
      { label: "TSV (.tsv)", format: "tsv" },
      { label: "JSON (.json)", format: "json" },
      { label: "Markdown table (.md)", format: "markdown" },
    ];
    openContextMenu(
      formats.map(({ label, format }) => ({
        title: label,
        onClick: () => {
          const content = exportRecords(frame.records, exportableFields, format);
          navigator.clipboard.writeText(content).then(() => {
            new Notice(
              $i18n.t("views.dashboard.table.export-copied", {
                defaultValue: "Copied to clipboard",
              })
            );
          });
        },
      })),
      e,
    );
  }

  $: conditionalFormats = config?.conditionalFormats ?? [];

  // #044.3a — receiver: compute which rows match the active canvas selection.
  // `null` means "no decoration" (empty selection or self-emitted); a Set
  // means: rows in the set are highlighted, others are dimmed. We feed the
  // *searched* record list so the matching honours the user's local search
  // narrowing as well as their persisted filters.
  $: matchingRowIds = widgetId
    ? computeMatchingRowIds({
        records: searchedRecords,
        selection,
        myWidgetId: widgetId,
      })
    : null;

  // ── #044.3b — driver: context-menu entry "Filter canvas by this row" ───
  // The driver field defaults to "path" per spec §5.2. When a future config
  // exposes a custom primary-key field, switch this constant to read it.
  // Toggle uses the value at `selectionDriverField` of the clicked row; the
  // shared `computeDataTableSelectionToggle` helper centralises set/clear/
  // noop semantics (same shape as ChartWidget driver in #044.2).
  const selectionDriverField = "path";

  function handleRowFilterCanvas(rowId: string, row: Record<string, unknown>): void {
    if (!widgetId || !selectionStore || !$selectionStore) return;
    const rawValue = row[selectionDriverField];
    const value = rawValue == null ? "" : String(rawValue);
    const decision = computeDataTableSelectionToggle($selectionStore, {
      widgetId,
      field: selectionDriverField,
      value,
    });
    switch (decision.kind) {
      case "set":
        selectionStore.setSelection({
          source: decision.source,
          field: decision.field,
          values: decision.values,
        });
        break;
      case "clear":
        selectionStore.clearSelection();
        break;
      case "noop":
        // Empty value (e.g. row without a path) — refuse to set a selection
        // that would either match everything or nothing.
        break;
    }
    // `rowId` is currently unused; kept in the signature so DataGrid's prop
    // contract stays generic (a future variant might key on rowId directly
    // instead of looking values up by field name).
    void rowId;
  }

  // Tells DataGrid which row's context-menu should flip its label to "Clear
  // canvas filter". `null` when no own-driven selection or no matching row
  // in the current `searchedRecords` view (e.g. user filtered the driving
  // row out — the toggle still works, but the label stays in "Filter…"
  // direction since the driven row is no longer visible).
  $: driverRowId = (() => {
    if (!widgetId) return null;
    if (!isThisWidgetDriving(selection, widgetId)) return null;
    if (selection.field === null || selection.values.length === 0) return null;
    const driverField = selection.field;
    const driverValue = selection.values[0] ?? "";
    const match = searchedRecords.find(
      (r) => String(r.values[driverField] ?? "") === driverValue,
    );
    return match?.id ?? null;
  })();

  $: rows = searchedRecords.map<GridRowProps>(({ id, values }) => {
    const row: GridRowProps = { rowId: id, row: values };
    const styledRow = (() => {
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
    })();
    if (matchingRowIds === null) return styledRow;
    return matchingRowIds.has(id)
      ? { ...styledRow, highlighted: true }
      : { ...styledRow, dimmed: true };
  });

  // -- Grouping -----------------------------------------------
  $: hasGroupBy = !!config?.groupBy;
  $: groups = hasGroupBy && config?.groupBy
    ? groupRecords(searchedRecords, config.groupBy)
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
    // #044.3a — propagate receiver flags into grouped rows so highlight/dim
    // applies consistently whether the table is flat or grouped.
    const matching = matchingRowIds;
    return group.records.map(({ id, values }) => {
      const base: GridRowProps = { rowId: id, row: values };
      if (matching === null) return base;
      return matching.has(id)
        ? { ...base, highlighted: true }
        : { ...base, dimmed: true };
    });
  }

  // -- Aggregation --------------------------------------------
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

  // R2.2 � subscribe to global `add-sub-base` command. Each DataTable
  // widget on the canvas reacts independently; in practice canvases have
  // a single table so this gives the user a one-click discoverability path.
  let lastSubBaseBusTs = 0;
  const unsubSubBaseBus = commandBus.subscribe((msg) => {
    if (!msg || msg.action !== "add-sub-base") return;
    if (msg.ts <= lastSubBaseBusTs) return;
    lastSubBaseBusTs = msg.ts;
    if (isReadonly) return;
    handleSubBaseAdd();
  });
  onDestroy(unsubSubBaseBus);

  // -- Virtual scroll ------------------------------------------
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

  // -- Config forwarding --------------------------------------
  function saveConfig(updates: Partial<DataTableConfig>) {
    const updated = { ...config, ...updates } as DataTableConfig;
    dispatch("configChange", updated);
  }

  // -- R2.2 sub-base handlers ---------------------------------
  function handleSubBaseSelect(event: CustomEvent<{ id: string }>): void {
    saveConfig({ activeSubBaseId: event.detail.id });
  }
  function handleSubBaseAdd(): void {
    const list = config?.subBases ?? [];
    const id = `sb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const name = $i18n.t("views.dashboard.sub-bases.default-name", {
      defaultValue: "New view",
    });
    const next: SubBaseDefinition[] = [...list, createSubBase(id, name)];
    saveConfig({ subBases: next, activeSubBaseId: id });
  }
  function handleSubBaseRename(event: CustomEvent<{ id: string; name: string }>): void {
    const list = config?.subBases ?? [];
    const next = list.map((sb) =>
      sb.id === event.detail.id ? renameSubBase(sb, event.detail.name) : sb,
    );
    saveConfig({ subBases: next });
  }
  function handleSubBaseRemove(event: CustomEvent<{ id: string }>): void {
    const list = config?.subBases ?? [];
    const next = list.filter((sb) => sb.id !== event.detail.id);
    const wasActive = config?.activeSubBaseId === event.detail.id;
    const updates: { subBases: SubBaseDefinition[]; activeSubBaseId?: string } = {
      subBases: next,
    };
    if (wasActive) {
      const fallback = next[0]?.id;
      if (fallback !== undefined) updates.activeSubBaseId = fallback;
    }
    saveConfig(updates);
  }

  // -- Record lookup map for O(1) colorModel ------------------
  $: recordMap = new Map(frame.records.map((r) => [r.id, r]));

  // -- FieldPreset menu handlers (Phase 2b) -------------------
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
      presets: import("src/ui/views/Dashboard/types").FieldPreset[];
      activeId: string | undefined;
    }>,
  ) {
    dispatch("fieldPresetsChange", {
      fieldPresets: e.detail.presets,
      activeFieldPresetId: e.detail.activeId,
    });
  }
</script>

<div
  class="ppp-datatable-widget"
  use:viewShortcuts={{
    ...(!isReadonly ? { "new-record": () => handleAddRow() } : {}),
    "focus-filter": (e) => { e.preventDefault(); openSearchBar(); },
    "export": (e) => { e.preventDefault(); const content = exportRecords(frame.records, exportableFields, "csv"); navigator.clipboard.writeText(content).then(() => new Notice($i18n.t("views.dashboard.table.export-copied", { defaultValue: "Copied to clipboard" }))); },
  }}
>
  <!-- Field-preset bar (Phase 2b). Hidden in readonly mode so query-result
       views don't expose mutation-heavy controls. -->
  {#if !isReadonly}
    <div class="ppp-datatable-toolbar" role="toolbar" aria-label={$i18n.t("views.dashboard.field-presets.aria-label")}>
      <FieldPresetMenu
        presets={fieldPresets}
        activeId={activeFieldPresetId}
        currentTable={config ?? {}}
        readonly={isReadonly}
        on:apply={handleFieldPresetApply}
        on:save={handleFieldPresetSave}
      />
      <!-- C19: quick field visibility toggle -->
      <button
        type="button"
        class="ppp-fields-btn"
        class:ppp-fields-btn--active={hiddenFieldCount > 0}
        on:click={(e) => openFieldVisibilityPop(e.currentTarget)}
        aria-label={$i18n.t("views.dashboard.table.hide-fields", { defaultValue: "Toggle field visibility" })}
        title={$i18n.t("views.dashboard.table.hide-fields", { defaultValue: "Toggle field visibility" })}
      >
        {#if hiddenFieldCount > 0}
          <span class="ppp-fields-badge">{hiddenFieldCount}</span>
          {$i18n.t("views.dashboard.table.hidden", { count: hiddenFieldCount, defaultValue: "hidden" })}
        {:else}
          {$i18n.t("views.dashboard.table.fields", { defaultValue: "Fields" })}
        {/if}
      </button>
      <!-- Quick group-by toggle -->
      <button
        type="button"
        class="ppp-group-btn"
        class:ppp-group-btn--active={!!activeGroupField}
        on:click={(e) => openGroupPop(e.currentTarget)}
        aria-label={$i18n.t("views.dashboard.table.group-by", { defaultValue: "Group by field" })}
        title={$i18n.t("views.dashboard.table.group-by", { defaultValue: "Group by field" })}
      >
        {#if activeGroupField}
          <span class="ppp-group-badge">{activeGroupField}</span>
        {:else}
          {$i18n.t("views.dashboard.table.group", { defaultValue: "Group" })}
        {/if}
      </button>
      <!-- Quick sort indicator -->
      <button
        type="button"
        class="ppp-sort-btn"
        class:ppp-sort-btn--active={activeSortCount > 0}
        on:click={(e) => openSortPop(e.currentTarget)}
        aria-label={$i18n.t("views.dashboard.table.sort", { defaultValue: "Sort" })}
        title={$i18n.t("views.dashboard.table.sort", { defaultValue: "Sort" })}
      >
        {#if activeSortCount > 0}
          <span class="ppp-sort-badge">{activeSortCount}</span>
          {$i18n.t("views.dashboard.table.sorted", { defaultValue: "sorted" })}
        {:else}
          {$i18n.t("views.dashboard.table.sort", { defaultValue: "Sort" })}
        {/if}
      </button>
      <!-- Aggregation footer toggle -->
      <button
        type="button"
        class="ppp-agg-toggle-btn"
        class:ppp-agg-toggle-btn--active={showAggregation}
        on:click={() => saveConfig({ showAggregationRow: !showAggregation })}
        aria-label={showAggregation ? $i18n.t("views.dashboard.table.hide-aggregations", { defaultValue: "Hide aggregation row" }) : $i18n.t("views.dashboard.table.show-aggregations", { defaultValue: "Show aggregation row" })}
        title={showAggregation ? $i18n.t("views.dashboard.table.hide-aggregations", { defaultValue: "Hide aggregation row" }) : $i18n.t("views.dashboard.table.show-aggregations", { defaultValue: "Show aggregation row" })}
      >Σ</button>
      <!-- Quick search toggle -->
      <button
        type="button"
        class="clickable-icon ppp-search-btn"
        class:ppp-search-btn--active={showSearchBar}
        on:click={() => { showSearchBar = !showSearchBar; if (!showSearchBar) searchQuery = ""; }}
        aria-label={$i18n.t("views.dashboard.table.search", { defaultValue: "Search records" })}
        title={$i18n.t("views.dashboard.table.search", { defaultValue: "Search records" })}
      >🔍</button>
      <button
        type="button"
        class="clickable-icon ppp-export-btn"
        on:click={handleExportClick}
        aria-label={$i18n.t("views.dashboard.table.export", { defaultValue: "Export" })}
        title={$i18n.t("views.dashboard.table.export", { defaultValue: "Export" })}
      >⬇</button>
    </div>
  {/if}
  {#if showSearchBar}
    <div class="ppp-search-bar" role="search">
      <input
        class="ppp-search-input"
        type="search"
        bind:value={searchQuery}
        placeholder={$i18n.t("views.dashboard.table.search-placeholder", { defaultValue: "Search…" })}
        aria-label={$i18n.t("views.dashboard.table.search", { defaultValue: "Search records" })}
        on:keydown={(e) => { if (e.key === "Escape") { showSearchBar = false; searchQuery = ""; } }}
      />
      {#if searchQuery}
        <span class="ppp-search-count">{searchedRecords.length}</span>
      {/if}
    </div>
  {/if}
  {#if !isReadonly && !(config?.hintDismissed)}
    <div class="ppp-table-hint" role="note">
      <span class="ppp-table-hint__icon" aria-hidden="true">?</span>
      <span class="ppp-table-hint__text">
        {$i18n.t("views.dashboard.table.header-hint", {
          defaultValue: "Right-click a column header to rename, change type, hide, pin or reorder. Drag the edge to resize.",
        })}
      </span>
      <button
        type="button"
        class="ppp-table-hint__dismiss clickable-icon"
        on:click={() => saveConfig({ hintDismissed: true })}
        aria-label={$i18n.t("common.dismiss", { defaultValue: "Dismiss" })}
        title={$i18n.t("common.dismiss", { defaultValue: "Dismiss" })}
      >?</button>
    </div>
  {/if}
  {#if subBases.length > 0}
    <SubBaseTabs
      {subBases}
      activeId={activeSubBaseId}
      readonly={isReadonly}
      on:select={handleSubBaseSelect}
      on:add={handleSubBaseAdd}
      on:rename={handleSubBaseRename}
      on:remove={handleSubBaseRemove}
    />
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
                iconField={config?.iconField}
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
                onRowAddSilent={() => handleAddRowSilent(group.key)}
                onRowChange={(rowId, row) => api.updateRecord({ id: rowId, values: row }, fields)}
                onRowDelete={(rowId) => api.deleteRecord(rowId)}
                onRowOpen={handleRowOpen}
                onRowEdit={handleRowEdit}
                onColumnConfigure={handleColumnConfigure}
                onColumnDelete={(field) => api.deleteField(field)}
                onColumnHide={handleColumnHide}
                onColumnPin={handleColumnPin}
                onColumnInsert={handleColumnInsert}
                onColumnRename={handleColumnRename}
                getExtraColumnMenuEntries={buildExtraColumnMenuEntries}
                onRowFilterCanvas={widgetId && selectionStore ? handleRowFilterCanvas : undefined}
                {driverRowId}
              />
            {/if}
          {/each}
        {:else}
          <DataGrid
            {columns}
            iconField={config?.iconField}
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
            onRowAddSilent={() => handleAddRowSilent(group.key)}
            onRowChange={(rowId, row) => api.updateRecord({ id: rowId, values: row }, fields)}
            onRowDelete={(rowId) => api.deleteRecord(rowId)}
            onRowOpen={handleRowOpen}
            onRowEdit={handleRowEdit}
            onColumnConfigure={handleColumnConfigure}
            onColumnDelete={(field) => api.deleteField(field)}
            onColumnHide={handleColumnHide}
            onColumnPin={handleColumnPin}
            onColumnInsert={handleColumnInsert}
            onColumnRename={handleColumnRename}
                getExtraColumnMenuEntries={buildExtraColumnMenuEntries}
                onRowFilterCanvas={widgetId && selectionStore ? handleRowFilterCanvas : undefined}
                {driverRowId}
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
              iconField={config?.iconField}
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
              onRowAddSilent={() => handleAddRowSilent()}
              onRowChange={(rowId, row) => api.updateRecord({ id: rowId, values: row }, fields)}
              onRowDelete={(rowId) => api.deleteRecord(rowId)}
              onRowOpen={handleRowOpen}
              onRowEdit={handleRowEdit}
              onColumnConfigure={handleColumnConfigure}
              onColumnDelete={(field) => api.deleteField(field)}
              onColumnHide={handleColumnHide}
              onColumnPin={handleColumnPin}
              onColumnInsert={handleColumnInsert}
              onColumnRename={handleColumnRename}
                getExtraColumnMenuEntries={buildExtraColumnMenuEntries}
                onRowFilterCanvas={widgetId && selectionStore ? handleRowFilterCanvas : undefined}
                {driverRowId}
            />
          </div>
        </div>
      </div>
    {:else}
      <DataGrid
        {columns}
        iconField={config?.iconField}
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
        onRowAddSilent={() => handleAddRowSilent()}
        onRowChange={(rowId, row) => api.updateRecord({ id: rowId, values: row }, fields)}
        onRowDelete={(rowId) => api.deleteRecord(rowId)}
        onRowOpen={handleRowOpen}
        onRowEdit={handleRowEdit}
        onColumnConfigure={handleColumnConfigure}
        onColumnDelete={(field) => api.deleteField(field)}
        onColumnHide={handleColumnHide}
        onColumnPin={handleColumnPin}
        onColumnInsert={handleColumnInsert}
        onColumnRename={handleColumnRename}
                getExtraColumnMenuEntries={buildExtraColumnMenuEntries}
                onRowFilterCanvas={widgetId && selectionStore ? handleRowFilterCanvas : undefined}
                {driverRowId}
      />
    {/if}
  {/if}

  {#if showAggregation}
    <div class="ppp-aggregation-row">
      <div class="ppp-aggregation-cell ppp-aggregation-cell--row-header" role="rowheader" aria-label={$i18n.t("views.dashboard.aggregation.row-label", { defaultValue: "Aggregation row � click a cell to pick a function" })} title={$i18n.t("views.dashboard.aggregation.row-label", { defaultValue: "Aggregation row � click a cell to pick a function" })}>
        <span class="ppp-aggregation-sigma" aria-hidden="true">?</span>
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
            <span class="ppp-aggregation-placeholder">?</span>
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
              >{$i18n.t("views.dashboard.aggregation.none", { defaultValue: "None" })}</button>
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
      produced visible duplicate ("+ �������� �������" from DataGrid,
      then "+ ����� �������" from this wrapper). DataGrid is the single
      source of truth.
    -->
  {/if}
  </div>

  <RecordCardView
    open={cardViewOpen}
    fields={fields}
    record={cardViewRecord}
    allRecords={frame.records}
    autosave={$projectStore?.autosave ?? true}
    onSave={handleCardSave}
    onOpenNote={(openMode) => cardViewRecord && $app.workspace.openLinkText(cardViewRecord.id, cardViewRecord.id, openMode)}
    onRenameNote={handleCardRename}
    on:close={() => { cardViewOpen = false; cardViewRecord = null; }}
  />
</div>

<FloatingPopup
  triggerEl={activePopover?.anchorEl ?? null}
  open={activePopover !== null}
  placement="bottom-start"
  role="menu"
  on:close={() => (activePopover = null)}
>
  {#if activePopover}
    <PopoverList
      items={activePopover.items}
      searchable={activePopover.searchable}
      on:select={handlePopoverSelect}
    />
  {/if}
</FloatingPopup>

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

  /* C19: field visibility quick toggle button */
  .ppp-fields-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller, 0.75rem);
    cursor: pointer;
    transition: color 100ms ease, background 100ms ease, border-color 100ms ease;
  }

  .ppp-fields-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
  }

  .ppp-fields-btn--active {
    color: var(--interactive-accent);
    border-color: var(--interactive-accent);
  }

  .ppp-fields-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1rem;
    height: 1rem;
    padding: 0 0.1875rem;
    font-size: 0.5625rem;
    font-weight: 700;
    border-radius: 0.5rem;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    line-height: 1;
  }

  .ppp-group-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller, 0.75rem);
    cursor: pointer;
    transition: color 100ms ease, background 100ms ease, border-color 100ms ease;
  }

  .ppp-group-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
  }

  .ppp-group-btn--active {
    color: var(--interactive-accent);
    border-color: var(--interactive-accent);
  }

  .ppp-group-badge {
    max-width: 6rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  .ppp-sort-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    height: 1.5rem;
    padding: 0 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-muted);
    font-size: 0.75rem;
    cursor: pointer;
    white-space: nowrap;
    transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
  }

  .ppp-sort-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .ppp-sort-btn--active {
    color: var(--interactive-accent);
    border-color: var(--interactive-accent);
  }

  .ppp-sort-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1rem;
    height: 1rem;
    padding: 0 0.25rem;
    border-radius: 0.5rem;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1;
  }

  /* Quick search */
  .ppp-search-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-muted);
    font-size: 0.75rem;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 120ms ease, color 120ms ease;
  }

  .ppp-search-btn:hover,
  .ppp-search-btn--active {
    opacity: 1;
    color: var(--interactive-accent);
  }

  .ppp-search-bar {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .ppp-search-input {
    flex: 1;
    height: 1.625rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.8125rem;
    font-family: var(--font-interface);
    padding: 0 0.5rem;
    outline: none;
    box-sizing: border-box;
    transition: border-color 120ms ease;
  }

  .ppp-search-input:focus { border-color: var(--interactive-accent); }
  .ppp-search-input::placeholder { color: var(--text-faint); }

  .ppp-search-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    padding: 0 0.25rem;
  }

  .ppp-agg-toggle-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 1.5rem;
    padding: 0 0.375rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
  }

  .ppp-agg-toggle-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .ppp-agg-toggle-btn--active {
    color: var(--interactive-accent);
    border-color: var(--interactive-accent);
    background: rgba(var(--interactive-accent-rgb, 122, 104, 238), 0.08);
  }

  .ppp-export-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-muted);
    font-size: 0.875rem;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 120ms ease, color 120ms ease;
  }

  .ppp-export-btn:hover {
    opacity: 1;
    color: var(--text-normal);
  }

  .ppp-export-btn:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.0625rem;
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
    z-index: var(--ppp-db-z-sticky, 10);
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

  /* ? glyph reuses the same visual code as the widget pipeline button
     (Phase 1C). Unified language: ? = aggregation, ? = config. */
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
    box-shadow: var(--shadow-s, 0 0.125rem 0.5rem rgba(0, 0, 0, 0.15));
    z-index: var(--ppp-db-z-dropdown, 100);
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
