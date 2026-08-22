<script lang="ts">
  /**
   * Dashboard V2 (DG-2) — database-call block MVP.
   *
   * Renders ViewTabBar + active tab's view (Table/Board/Calendar/...).
   * Each tab owns its config; switching preserves state. Sprint 2 MVP
   * reuses parent frame; independent source loading deferred to S3+.
   */
  import { createEventDispatcher } from "svelte";
  import type {
    DataFrame,
    DataRecord,
    DataField,
  } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ViewTab, DataTableConfig, FieldPreset, LinkedSelectionConfig } from "../../types";
  import type { ProjectDefinition } from "src/settings/settings";

  import ViewTabBar from "../ViewTabBar.svelte";
  import DataTableContent from "./DataTableContent.svelte";
  import BoardView from "src/ui/views/Board/BoardView.svelte";
  import CalendarView from "src/ui/views/Calendar/CalendarView.svelte";
  import GalleryView from "src/ui/views/Gallery/GalleryView.svelte";
  import type { BoardConfig } from "src/ui/views/Board/types";
  import type { CalendarConfig } from "src/ui/views/Calendar/types";
  import type { GalleryConfig } from "src/ui/views/Gallery/types";
  import { i18n } from "src/lib/stores/i18n";
  import { getContext, onMount, onDestroy } from "svelte";
  import { writable } from "svelte/store";
  import {
    DATA_PROVIDER_REGISTRY_CONTEXT_KEY,
    type DataProvider,
    type DataProviderRegistry,
  } from "src/lib/stores/dataProviderRegistry";
  import {
    SELECTION_CONTEXT_KEY,
    EMPTY_SELECTION,
    composeEffectiveFilter,
    type SelectionStore,
  } from "../../canvasSelectionStore";
  import { applyFilter } from "src/lib/engine/filterEvaluator";
  import { filterByLinkedSelection } from "./relationFilterAdapter";
  import type { FilterDefinition } from "src/settings/base/settings";
  import type { LegacyLinkedSelectionStatus } from "src/lib/relations/relationContract";
  import BlockFilterBar from "./BlockFilterBar.svelte";
  import EmptyState from "src/ui/components/EmptyState/EmptyState.svelte";
  import { CreateNoteModal } from "src/ui/modals/createNoteModal";
  import { createDataRecord } from "src/lib/dataApi";
  import { app } from "src/lib/stores/obsidian";

  export let frame: DataFrame;
  export let api: ViewApi;
  export let readonly: boolean;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let fields: DataField[];
  export let fieldPresets: FieldPreset[] = [];
  export let activeFieldPresetId: string | undefined = undefined;
  export let project: ProjectDefinition | undefined = undefined;
  export let config: Record<string, unknown>;
  /** Canvas Selection Bus: drives auto-filter when a master block has a selection. */
  export let linkedSelection: LinkedSelectionConfig | undefined = undefined;
  /** #114 (E1/E4): runtime validation result from WidgetHost — drives label rendering. */
  export let linkedSelectionValidation: LegacyLinkedSelectionStatus | undefined = undefined;
  /**
   * Widget identity from the enclosing WidgetDefinition. Required for
   * DataProvider registration so this Database Window can be referenced
   * from cross-widget series configs. See DATA_PROVIDER_SPEC.md §2.4.
   */
  export let widgetId: string = "";
  export let widgetTitle: string = "";
  /** #092: pipeline reach so the block can offer recovery when steps hid every row. */
  export let pipelineStepCount: number = 0;
  export let pipelineInputRowCount: number = 0;

  const dispatch = createEventDispatcher<{
    configChange: Record<string, unknown>;
    fieldPresetsChange: {
      fieldPresets: FieldPreset[];
      activeFieldPresetId: string | undefined;
    };
    openPipeline: void;
    clearPipeline: void;
  }>();

  // ── Canvas Selection Bus (#Phase4) ─────────────────────────
  const _ctx = getContext<SelectionStore | undefined>(SELECTION_CONTEXT_KEY);
  const canvasStore = _ctx ?? writable(EMPTY_SELECTION);

  // #114 (E7): composeEffectiveFilter consolidates linked + canvas selection.
  // When linkedSelection is configured and valid, it maps the selection through
  // the relationField. When validation fails, falls back to canvas condition.
  $: effectiveConditions = composeEffectiveFilter({
    userFilters: [],
    selection: $canvasStore,
    myWidgetId: widgetId,
    linkedSelection,
    validationResult: linkedSelectionValidation,
  });
  $: autoFilter = effectiveConditions.length > 0 ? effectiveConditions[0] : null;

  // #114 (E4): three-state label derived from validation + canvas activity.
  $: filterLabel = (() => {
    if (linkedSelection && linkedSelectionValidation === "valid") return "relation" as const;
    if (linkedSelection && linkedSelectionValidation !== undefined && linkedSelectionValidation !== "valid") return "broken" as const;
    if ($canvasStore.source !== null && $canvasStore.values.length > 0) return "canvas" as const;
    return null;
  })();

  // #099.1 — block-level filter (WidgetDataContext.subFilter, SPEC §3.4):
  // applied through the canonical filterEvaluator BEFORE the linked-selection
  // auto-filter, instantly on every pill/builder change.
  $: subFilter = config["subFilter"] as FilterDefinition | undefined;
  $: subFiltered = subFilter && subFilter.conditions.length > 0 ? applyFilter(frame, subFilter) : frame;

  $: effectiveFrame = autoFilter
    ? { ...subFiltered, records: filterByLinkedSelection(subFiltered.records, autoFilter, subFiltered.fields) }
    : subFiltered;

  function handleSubFilterChange(e: CustomEvent<FilterDefinition | undefined>) {
    const next = { ...config };
    if (e.detail) next["subFilter"] = e.detail;
    else delete next["subFilter"];
    dispatch("configChange", next);
  }

  $: tabs = (config["viewTabs"] as ViewTab[]) ?? [];
  $: activeTabId = String(config["activeTabId"] ?? tabs[0]?.id ?? "");
  $: activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  $: activeTabTableConfig = activeTab?.config as DataTableConfig | undefined;

  function handleTabSwitch(e: CustomEvent<string>) {
    dispatch("configChange", {
      ...config,
      activeTabId: e.detail,
    });
  }

  // #088: tabs are created WITH a type and named by it («Board», «Table 2»).
  const VIEW_TYPE_LABELS: Record<string, { key: string; def: string }> = {
    table: { key: "views.dashboard.database-call.view-type.table", def: "Table" },
    board: { key: "views.dashboard.database-call.view-type.board", def: "Board" },
    calendar: { key: "views.dashboard.database-call.view-type.calendar", def: "Calendar" },
    gallery: { key: "views.dashboard.database-call.view-type.gallery", def: "Gallery" },
  };

  function handleTabAdd(e: CustomEvent<ViewTab["viewType"]>) {
    addTab(typeof e.detail === "string" ? e.detail : "table");
  }

  function addTab(viewType: ViewTab["viewType"]) {
    const meta = VIEW_TYPE_LABELS[viewType] ?? VIEW_TYPE_LABELS["table"]!;
    const base = $i18n.t(meta.key, { defaultValue: meta.def });
    const sameType = tabs.filter((t) => t.viewType === viewType).length;
    const newTab: ViewTab = {
      id: `tab-${Date.now()}`,
      label: sameType > 0 ? `${base} ${sameType + 1}` : base,
      viewType,
      config: {},
    };
    dispatch("configChange", {
      ...config,
      viewTabs: [...tabs, newTab],
      activeTabId: newTab.id,
    });
  }

  // ── #065 empty states ───────────────────────────────────────
  // "No matches" (auto-filter narrowed everything away) vs "no records
  // at all" — only the former offers a clear-filter action.
  $: isFilterEmpty =
    effectiveFrame.records.length === 0 && frame.records.length > 0;

  // #092: the transform pipeline consumed input rows yet emitted nothing — a
  // recoverable dead-end distinct from filter/empty-source states.
  $: pipelineHidAll =
    pipelineStepCount > 0 &&
    pipelineInputRowCount > 0 &&
    effectiveFrame.records.length === 0 &&
    !isFilterEmpty;

  function handleAddFirstRecord() {
    const p = project;
    if (!p) return;
    new CreateNoteModal($app, p, (name, templatePath) => {
      api.addRecord(createDataRecord(name, p), fields, templatePath);
    }).open();
  }

  function handleClearCanvasFilter() {
    // «Clear filter» honors EVERY source of narrowing: the canvas selection
    // and the block's own subFilter (#099.1).
    _ctx?.clearSelection();
    if (subFilter) {
      const next = { ...config };
      delete next["subFilter"];
      dispatch("configChange", next);
    }
  }

  function handleDataTableConfigChange(e: CustomEvent<DataTableConfig>) {
    if (!activeTab) return;
    const updatedTabs = tabs.map((t) =>
      t.id === activeTab.id
        ? { ...t, config: e.detail as unknown as Record<string, unknown> }
        : t
    );
    dispatch("configChange", {
      ...config,
      viewTabs: updatedTabs,
    });
  }

  function handleViewConfigChange(cfg: Record<string, unknown>) {
    if (!activeTab) return;
    dispatch("configChange", {
      ...config,
      viewTabs: tabs.map((t) =>
        t.id === activeTab.id ? { ...t, config: cfg } : t
      ),
    });
  }

  function handleTabRemove(e: CustomEvent<string>) {
    const id = e.detail;
    const updated = tabs.filter((t) => t.id !== id);
    const newActiveId =
      activeTabId === id ? (updated[0]?.id ?? "") : activeTabId;
    dispatch("configChange", {
      ...config,
      viewTabs: updated,
      activeTabId: newActiveId,
    });
  }

  function handleTabRename(e: CustomEvent<{ id: string; label: string }>) {
    const { id, label } = e.detail;
    dispatch("configChange", {
      ...config,
      viewTabs: tabs.map((t) => (t.id === id ? { ...t, label } : t)),
    });
  }

  // Derived helpers for embedded Board/Calendar/Gallery
  $: getRecord = (id: string) =>
    effectiveFrame.records.find((r) => r.id === id);
  const sortRecords = (records: ReadonlyArray<DataRecord>) => [...records];
  $: boardConfig = (activeTab?.config ?? {}) as BoardConfig;
  $: calendarConfig = (activeTab?.config ?? undefined) as CalendarConfig | undefined;
  $: galleryConfig = (activeTab?.config ?? undefined) as GalleryConfig | undefined;
  let dataVersion = 0;
  $: { void effectiveFrame; dataVersion++; }

  function handleBoardConfigChange(cfg: BoardConfig) {
    handleViewConfigChange(cfg as unknown as Record<string, unknown>);
  }
  function handleCalendarConfigChange(cfg: CalendarConfig) {
    handleViewConfigChange(cfg as unknown as Record<string, unknown>);
  }
  function handleGalleryConfigChange(cfg: GalleryConfig) {
    handleViewConfigChange(cfg as unknown as Record<string, unknown>);
  }

  // ── DataProvider registration (#031.3) ──────────────────────
  // Each Database Window registers itself as a named data source on
  // the surrounding canvas so cross-widget consumers (Chart, Stats)
  // can subscribe via series config. See DATA_PROVIDER_SPEC.md §2.4.
  // Registry is optional: legacy stack-mode canvases that don't set
  // context still work — registration is just skipped.
  const registry = getContext<DataProviderRegistry | undefined>(
    DATA_PROVIDER_REGISTRY_CONTEXT_KEY
  );
  const providerFrame = writable<DataFrame>(frame);
  $: providerFrame.set(effectiveFrame);

  let registeredProvider: DataProvider | null = null;

  onMount(() => {
    if (!registry || !widgetId) return;
    registeredProvider = {
      id: widgetId,
      name: widgetTitle || widgetId,
      frame$: { subscribe: providerFrame.subscribe },
      refresh() {
        providerFrame.set(effectiveFrame);
      },
    };
    registry.register(registeredProvider);
  });

  onDestroy(() => {
    if (registry && registeredProvider) {
      registry.unregister(registeredProvider.id);
    }
  });
</script>

<div class="ppp-database-call-block">
  {#if tabs.length === 0}
    <EmptyState
      icon="database"
      title={$i18n.t("views.dashboard.database-call.empty", {
        defaultValue: "No views configured"
      })}
    >
      <svelte:fragment slot="actions">
        {#if !readonly}
          <button on:click={() => addTab("table")}>
            {$i18n.t("views.dashboard.database-call.add-first", {
              defaultValue: "Add first view"
            })}
          </button>
        {/if}
      </svelte:fragment>
    </EmptyState>
  {:else}
    <ViewTabBar
      {tabs}
      {activeTabId}
      {readonly}
      on:tabSwitch={handleTabSwitch}
      on:tabAdd={handleTabAdd}
      on:tabRemove={handleTabRemove}
      on:tabRename={handleTabRename}
    />
    <BlockFilterBar
      filter={subFilter}
      fields={frame.fields}
      records={frame.records}
      {readonly}
      on:change={handleSubFilterChange}
    />
    {#if filterLabel === "relation"}
      <span class="ppp-dbc-filter-label ppp-dbc-filter-label--relation" aria-label="Filtered by relation">
        {$i18n.t("views.dashboard.database-call.filter-label.relation", { defaultValue: "Filtered by relation" })}
      </span>
    {:else if filterLabel === "canvas"}
      <span class="ppp-dbc-filter-label ppp-dbc-filter-label--canvas" aria-label="Filtered by canvas selection">
        {$i18n.t("views.dashboard.database-call.filter-label.canvas", { defaultValue: "Filtered by canvas selection" })}
      </span>
    {:else if filterLabel === "broken"}
      <span class="ppp-dbc-filter-label ppp-dbc-filter-label--broken" aria-label="Relation broken">
        {$i18n.t("views.dashboard.database-call.filter-label.broken", {
          defaultValue: "Relation broken: {{reason}}",
          reason: linkedSelectionValidation ?? "",
        })}
      </span>
    {/if}
    <div
      class="ppp-database-call-content"
      role="tabpanel"
      id="ppp-tab-panel-{activeTabId}"
      aria-labelledby="ppp-tab-{activeTabId}"
    >
      {#if activeTab}
        {#if activeTab.viewType === "table"}
          {#if pipelineHidAll}
            <EmptyState
              icon="filter-x"
              title={$i18n.t("views.dashboard.database-call.pipeline-hid-all", {
                defaultValue: "The pipeline removed every row",
                count: pipelineStepCount,
              })}
            >
              <svelte:fragment slot="actions">
                {#if !readonly}
                  <button on:click={() => dispatch("openPipeline")}>
                    {$i18n.t("views.dashboard.database-call.open-pipeline", {
                      defaultValue: "Open pipeline"
                    })}
                  </button>
                  <button on:click={() => dispatch("clearPipeline")}>
                    {$i18n.t("views.dashboard.database-call.clear-pipeline", {
                      defaultValue: "Clear pipeline"
                    })}
                  </button>
                {/if}
              </svelte:fragment>
            </EmptyState>
          {:else if isFilterEmpty}
            <EmptyState
              icon="filter-x"
              title={$i18n.t("views.dashboard.database-call.no-matches", {
                defaultValue: "No matches"
              })}
            >
              <svelte:fragment slot="actions">
                <button on:click={handleClearCanvasFilter}>
                  {$i18n.t("views.dashboard.database-call.clear-filter", {
                    defaultValue: "Clear filter"
                  })}
                </button>
              </svelte:fragment>
            </EmptyState>
          {:else if effectiveFrame.records.length === 0}
            <EmptyState
              icon="database"
              title={$i18n.t("views.dashboard.database-call.no-records", {
                defaultValue: "No records yet"
              })}
            >
              <svelte:fragment slot="actions">
                {#if !readonly && project}
                  <button on:click={handleAddFirstRecord}>
                    {$i18n.t("views.dashboard.database-call.add-first-record", {
                      defaultValue: "Add first record"
                    })}
                  </button>
                {/if}
              </svelte:fragment>
            </EmptyState>
          {:else}
            <DataTableContent
              frame={effectiveFrame}
              {api}
              {readonly}
              {getRecordColor}
              {fields}
              config={activeTabTableConfig}
              {fieldPresets}
              {activeFieldPresetId}
              {project}
              {widgetId}
              on:configChange={handleDataTableConfigChange}
              on:fieldPresetsChange={(e) => dispatch("fieldPresetsChange", e.detail)}
            />
          {/if}
        {:else if activeTab.viewType === "board" && project}
          <BoardView
            {project}
            frame={effectiveFrame}
            {api}
            {readonly}
            {getRecordColor}
            {sortRecords}
            {getRecord}
            config={boardConfig}
            onConfigChange={handleBoardConfigChange}
            hasSort={false}
            hasFilter={false}
          />
        {:else if activeTab.viewType === "calendar" && project}
          <CalendarView
            {project}
            frame={effectiveFrame}
            {api}
            {readonly}
            {getRecordColor}
            config={calendarConfig}
            onConfigChange={handleCalendarConfigChange}
            {dataVersion}
          />
        {:else if activeTab.viewType === "gallery" && project}
          <GalleryView
            {project}
            frame={effectiveFrame}
            {api}
            {getRecordColor}
            config={galleryConfig}
            onConfigChange={handleGalleryConfigChange}
          />
        {:else}
          <div class="ppp-database-call-placeholder">
            <span>{$i18n.t("views.dashboard.database-call.view-not-implemented", {
              defaultValue: "{{viewType}} view not yet implemented",
              viewType: activeTab.viewType
            })}</span>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .ppp-database-call-block {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .ppp-database-call-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .ppp-database-call-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--text-faint);
    font-style: italic;
    font-family: var(--font-monospace);
    font-size: var(--font-ui-smaller);
  }

  .ppp-dbc-filter-label {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    font-size: var(--font-ui-smaller);
    border-radius: var(--radius-s, 0.25rem);
    line-height: 1.4;
  }

  .ppp-dbc-filter-label--relation {
    color: var(--color-green, var(--text-success));
    background: color-mix(in srgb, var(--color-green, var(--text-success)) 12%, var(--background-secondary));
  }

  .ppp-dbc-filter-label--canvas {
    color: var(--interactive-accent);
    background: color-mix(in srgb, var(--interactive-accent) 12%, var(--background-secondary));
  }

  .ppp-dbc-filter-label--broken {
    color: var(--text-warning, var(--text-muted));
    background: color-mix(in srgb, var(--text-warning, orange) 12%, var(--background-secondary));
  }
</style>
