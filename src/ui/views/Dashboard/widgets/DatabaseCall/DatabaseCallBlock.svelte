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
  import type { BlockSource } from "../linkedSourceState";
  import type { NamedSourceView } from "src/lib/datasources/namedSource";
  import { namedSourceNotice } from "./namedSourceNotice";
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
  /**
   * #118: the host already applied `config.subFilter` upstream of the transform
   * pipeline (canonical order A→C→B). The block still owns the filter UI, it
   * just must not filter the frame a second time.
   */
  export let scopeApplied: boolean = false;
  /**
   * #169: raised by the widget header when the user presses the block's own
   * primary action. A counter rather than a callback, so the action runs in the
   * component that already owns the interaction instead of the header growing a
   * second, differently-behaving way to create a record.
   */
  export let primaryActionSignal: number = 0;
  /**
   * #184: which of the project's sources this block shows, and whether that
   * could be resolved. Defaulted so any other mounter is unaffected.
   *
   * `broken` and `pending` are rendered as themselves below. That is the whole
   * reason the resolver returns four cases instead of a frame and a boolean:
   * "the filter matched nothing", "the source you named is gone" and "the data
   * has not arrived" are one picture on screen — an empty table — and they need
   * three different reactions from the user.
   */
  export let namedSource: NamedSourceView = { kind: "ok", frame: { fields: [], records: [] }, label: undefined };
  /**
   * #139: this block reads a source it cannot safely write to.
   *
   * A linked-source block renders another project's records but is handed the
   * PARENT dashboard's `api` and `project`, so creating a record lands it in the
   * wrong project and row edits go through the wrong api. Until a
   * source-specific write API exists, data writes are disabled here.
   *
   * Config writes are NOT affected: a view tab or a block filter belongs to the
   * widget in the parent dashboard, which is exactly where they are stored.
   */
  export let sourceReadOnly: boolean = false;
  /**
   * #136: what this block is actually reading. When the source is not `ready`
   * the block renders a state instead of records — it used to render the parent
   * project's records instead, which is data from somewhere the user did not ask
   * for, presented as if it were theirs.
   */
  export let sourceState: BlockSource = { kind: "parent", frame: { fields: [], records: [] } as unknown as DataFrame };

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
  // #149: "relation" now means the relation is actually narrowing this block,
  // not merely that it is configured. A valid but idle link said
  // "Filtered by relation" while showing every record — the label described the
  // wiring, and the user read it as a description of the data.
  $: selectionActive = $canvasStore.source !== null && $canvasStore.values.length > 0;
  $: filterLabel = (() => {
    if (linkedSelection && linkedSelectionValidation === "valid") {
      return selectionActive ? ("relation" as const) : ("relation-idle" as const);
    }
    if (linkedSelection && linkedSelectionValidation !== undefined && linkedSelectionValidation !== "valid") return "broken" as const;
    if (selectionActive) return "canvas" as const;
    return null;
  })();
  // #149: which record the relation is pointing at, so the label can say it.
  $: selectedLabel = $canvasStore.values.length === 1
    ? String($canvasStore.values[0]).replace(/^\[\[|\]\]$/g, "")
    : `${$canvasStore.values.length}`;

  // #099.1 — block-level filter (WidgetDataContext.subFilter, SPEC §3.4):
  // applied through the canonical filterEvaluator BEFORE the linked-selection
  // auto-filter, instantly on every pill/builder change.
  //
  // #118 (ADR A→C→B): when the host already narrowed the frame by this same
  // subFilter ahead of the transform pipeline, `scopeApplied` is set and
  // re-applying here is skipped — a reshape step may have renamed or dropped
  // the fields the conditions name, which would drop every row.
  // #184: what this block says about the source it was pointed at. The copy
  // lives in a pure function so "three states say three different things" is
  // executable — this component cannot be mounted in jest (a require cycle
  // through BoardView), so inline markup could only ever be grep-checked.
  $: sourceNotice = namedSourceNotice(namedSource);

  $: subFilter = config["subFilter"] as FilterDefinition | undefined;
  $: hasSubFilter =
    !!subFilter &&
    ((subFilter.conditions?.length ?? 0) > 0 || (subFilter.groups?.length ?? 0) > 0);
  $: subFiltered =
    hasSubFilter && !scopeApplied ? applyFilter(frame, subFilter as FilterDefinition) : frame;

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

  // #169. The header outlives the content: on a COLLAPSED widget this component
  // is not mounted at all, so a signal raised while collapsed arrives as a
  // mount-time value rather than as a change, and comparing against 0 is what
  // makes that click work instead of doing nothing. The host resets the signal
  // on every collapse toggle, so a later expand cannot replay a spent one.
  let seenPrimarySignal = 0;
  let newRowSignal = 0;
  $: if (primaryActionSignal > seenPrimarySignal) {
    seenPrimarySignal = primaryActionSignal;
    runPrimaryAction();
  }

  /**
   * Add a record through whichever creation path is actually on screen.
   *
   * With rows present the table shows an inline «+ New» at the body end, and
   * that is the one the user already reaches; with none, the block shows an
   * empty state whose own button opens the create-note modal. Routing to the
   * mounted one is what keeps this a shortcut to an existing interaction
   * rather than a second way to make a record.
   *
   * A NON-TABLE tab with records is the case that must do nothing, and the
   * adversarial review of #169 is why it is written out rather than left to
   * fall through: Board, Calendar and Gallery each create a record with the
   * context of what you are looking at — the column's value, the day you
   * clicked, the active filter. The generic modal below has none of it, so on
   * a Calendar tab it would write a record with no date, which then does not
   * appear in the calendar that made it. The header does not offer the action
   * for those blocks at all (`primaryActionFor`), and this guard is the second
   * lock on the same door.
   */
  function runPrimaryAction() {
    if (readonly || sourceReadOnly || !project) return;
    // A broken named source renders a notice INSTEAD of the table, so the
    // inline row this would open does not exist. The frame behind it is the
    // whole project, so the row-count test below would happily raise a signal
    // nothing is listening to — the silent-nothing defect #169 closed for a
    // collapsed widget, returning through a different door. The header does not
    // offer the action here either; this is the second lock.
    if (namedSource.kind === "broken") return;
    if (activeTab && activeTab.viewType !== "table") return;
    if (effectiveFrame.records.length > 0) newRowSignal += 1;
    else handleAddFirstRecord();
  }

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
  <!--
    #136: an external source that is not ready gets a state, never a substitute.
    This branch comes FIRST, ahead of the tabs check: a block whose source is
    gone should say so rather than offering to configure views over nothing.
  -->
  {#if sourceState.kind === "loading"}
    <EmptyState
      icon="loader"
      title={$i18n.t("views.dashboard.database-call.source-loading", {
        defaultValue: "Loading the linked project…"
      })}
    />
  {:else if sourceState.kind === "unavailable"}
    <EmptyState
      icon="unlink"
      title={$i18n.t("views.dashboard.database-call.source-unavailable", {
        defaultValue: "Linked project unavailable"
      })}
      hint={$i18n.t("views.dashboard.database-call.source-unavailable-hint", {
        defaultValue: "The project this block reads was not found: {{id}}",
        id: sourceState.projectId
      })}
    />
  {:else if sourceState.kind === "error"}
    <EmptyState
      icon="alert-triangle"
      title={$i18n.t("views.dashboard.database-call.source-error", {
        defaultValue: "Could not load the linked project"
      })}
      hint={sourceState.message}
    />
  {:else if sourceNotice && sourceNotice.placement === "screen"}
    <!--
      #184. AFTER the sourceState chain: a block reading another project ignores
      `sourceId` by construction, so the external state wins. The order WITHIN
      the notice matters too and is decided in the resolver: `pending` beats
      `broken`, because the provider writes `frameParts` inside its query
      promise and a block can read the previous project's parts for an instant
      when the user switches projects — otherwise that flashes "your source is
      gone" on every switch.
    -->
    <EmptyState
      icon={sourceNotice.icon}
      title={$i18n.t(sourceNotice.key, { defaultValue: sourceNotice.fallback, ...sourceNotice.vars })}
      hint={sourceNotice.hint ?? ""}
    />
  {:else if tabs.length === 0}
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
        {$i18n.t("views.dashboard.database-call.filter-label.relation-named", {
          defaultValue: "Showing records where {{field}} is {{value}}",
          field: linkedSelection?.relationField ?? "",
          value: selectedLabel,
        })}
      </span>
    {:else if filterLabel === "relation-idle"}
      <span class="ppp-dbc-filter-label ppp-dbc-filter-label--relation" aria-label="Linked by relation">
        {$i18n.t("views.dashboard.database-call.filter-label.relation-idle", {
          defaultValue: "Linked through {{field}} — select a row to narrow this block",
          field: linkedSelection?.relationField ?? "",
        })}
      </span>
    {:else if filterLabel === "canvas"}
      <span class="ppp-dbc-filter-label ppp-dbc-filter-label--canvas" aria-label="Filtered by canvas selection">
        {$i18n.t("views.dashboard.database-call.filter-label.canvas", { defaultValue: "Filtered by canvas selection" })}
      </span>
    {:else if filterLabel === "broken"}
      <span class="ppp-dbc-filter-label ppp-dbc-filter-label--broken" aria-label="Relation broken">
        {selectionActive
          ? $i18n.t("views.dashboard.database-call.filter-label.broken-v2", {
              defaultValue:
                "Relation '{{field}}' is broken ({{reason}}) — this block is filtered by the plain selection instead",
              field: linkedSelection?.relationField ?? "",
              reason: linkedSelectionValidation ?? "",
            })
          : $i18n.t("views.dashboard.database-call.filter-label.broken-idle", {
              defaultValue:
                "Relation '{{field}}' is broken ({{reason}}) — this block shows every record",
              field: linkedSelection?.relationField ?? "",
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
              hint={sourceNotice && sourceNotice.placement === "hint"
                ? $i18n.t(sourceNotice.key, { defaultValue: sourceNotice.fallback, ...sourceNotice.vars })
                : ""}
            >
              <svelte:fragment slot="actions">
                {#if !readonly && !sourceReadOnly && project}
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
              readonly={readonly || sourceReadOnly}
              {getRecordColor}
              {fields}
              config={activeTabTableConfig}
              {fieldPresets}
              {activeFieldPresetId}
              {project}
              {widgetId}
              {newRowSignal}
              on:configChange={handleDataTableConfigChange}
              on:fieldPresetsChange={(e) => dispatch("fieldPresetsChange", e.detail)}
            />
          {/if}
        {:else if activeTab.viewType === "board" && project}
          <BoardView
            {project}
            frame={effectiveFrame}
            {api}
            readonly={readonly || sourceReadOnly}
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
            readonly={readonly || sourceReadOnly}
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
            readonly={readonly || sourceReadOnly}
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
