<script lang="ts">
  import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { FilterDefinition } from "src/settings/base/settings";
  import type { DatabaseViewConfig, WidgetDefinition, FieldPreset } from "./types";
  import ViewContent from "src/ui/components/Layout/ViewContent.svelte";
  import ViewLayout from "src/ui/components/Layout/ViewLayout.svelte";
  import { setContext, onDestroy } from "svelte";
  import { writable, type Writable } from "svelte/store";
  import { SHADOW_PLACEHOLDER_ITEM_ID, type DndEvent } from "svelte-dnd-action";
  import { createDataProviderRegistry, DATA_PROVIDER_REGISTRY_CONTEXT_KEY } from "src/lib/stores/dataProviderRegistry";
  import { i18n } from "src/lib/stores/i18n";
  import { settings } from "src/lib/stores/settings";
  import { externalFrameInvalidation } from "src/lib/stores/externalFrameInvalidation";
  import { app } from "src/lib/stores/obsidian";
  import FormulaBar from "./widgets/FormulaBar.svelte";
  import { buildDisplayFrame } from "./dashboardFramePipeline";
  import type { GetFileStat } from "src/lib/dashboard-engine/applyAutoFields";
  import { createWidgetController } from "./dashboardWidgets";
  import { subscribeCanvasCommands } from "./dashboardCommands";
  import { collectReferencedSourceIds, createPreloadRunner, createPreloadSync, readyFrames, type ExternalSourceState } from "./dashboardPreload";
  import { createSchemaController } from "./dashboardSchema";
  import { applyFilterTab, promoteFilterTabToGlobal, type ActiveFilterTab } from "./dashboardFilters";
  import DashboardToolbar from "./DashboardToolbar.svelte";
  import FilterBridge from "./FilterBridge.svelte";
  import WidgetGrid from "./WidgetGrid.svelte";
  import SmartSuggestionBus from "./SmartSuggestionBus.svelte";
  import { createSuggestionController } from "./dashboardSuggest";
  import { createSelectionStore, bindEscapeClear, SELECTION_CONTEXT_KEY, type SelectionStore } from "./canvasSelectionStore";
  import { createConfigEcho } from "./dashboardConfigEcho";

  export let project: ProjectDefinition;
  export let frame: DataFrame;
  export let readonly: boolean;
  export let api: ViewApi;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let config: DatabaseViewConfig | undefined;
  export let onConfigChange: (cfg: DatabaseViewConfig) => void;
  /** #125: the COMPLETE stored filter, not just the enabled subset. */
  export let globalFilter: FilterDefinition | undefined = undefined;
  export let onViewFilterChange: ((filter: FilterDefinition) => void) | undefined = undefined;
  const projectStore = writable<ProjectDefinition>(project);
  setContext<Writable<ProjectDefinition>>("project", projectStore);
  $: projectStore.set(project);
  const dataProviderRegistry = createDataProviderRegistry();
  setContext(DATA_PROVIDER_REGISTRY_CONTEXT_KEY, dataProviderRegistry);
  onDestroy(() => dataProviderRegistry.clear());
  // #100 optimistic-echo guard (#071): raw `config` is read ONLY by the receiver
  // `$:` below — all other reads go through effectiveConfig. See dashboardConfigEcho.ts.
  const configEcho = createConfigEcho<DatabaseViewConfig | undefined>(config);
  let commitTick = 0, effectiveConfig: DatabaseViewConfig | undefined = configEcho.current;
  function saveConfig(cfg: DatabaseViewConfig) {
    configEcho.commit(cfg); onConfigChange(cfg); commitTick += 1;
    void Promise.resolve().then(() => { configEcho.reconcile(); commitTick += 1; });
  }
  $: effectiveConfig = (commitTick, configEcho.receiveProp(config), configEcho.current);
  $: widgets = effectiveConfig?.widgets ?? [];
  $: showToolbar = effectiveConfig?.showWidgetToolbar ?? false;
  // #191. Filtered by kind HERE as well as in the migration, and the two are
  // not redundant. The migration cleans the stored file; this decides what is
  // drawn from whatever it is handed — and after the template dispatcher was
  // removed every button runs the one remaining action, so an unfiltered
  // «Обзорный пресет» left in a config would silently toggle the formula bar.
  // Drawing only what this canvas can honour is the correctness half.
  // Array-ness checked, not assumed: the migrator leaves a malformed value alone
  // rather than throw, and `.filter()` on a string would down the whole canvas.
  $: quickActions = (Array.isArray(effectiveConfig?.quickActions) ? effectiveConfig.quickActions : [])
    .filter((action) => action?.kind === "toggle-formula-bar");
  const widgetController = createWidgetController({ getConfig: () => effectiveConfig, saveConfig, i18nStore: i18n });
  function handleFieldPresetsChange(e: CustomEvent<{ fieldPresets: FieldPreset[]; activeFieldPresetId: string | undefined }>) {
    if (!effectiveConfig) return;
    const { fieldPresets, activeFieldPresetId } = e.detail;
    const base: DatabaseViewConfig = { ...effectiveConfig, fieldPresets };
    if (activeFieldPresetId !== undefined) saveConfig({ ...base, activeFieldPresetId });
    else { const { activeFieldPresetId: _omit, ...rest } = base; void _omit; saveConfig(rest); }
  }
  function toggleToolbar() { if (effectiveConfig) saveConfig({ ...effectiveConfig, showWidgetToolbar: !showToolbar }); }
  const t = (key: string, opts?: Record<string, unknown>) => opts !== undefined ? $i18n.t(key, opts) : $i18n.t(key);
  const schemaController = createSchemaController({
    app: $app, api, projectId: project.id, t,
    getFields: () => frame.fields, getRecords: () => frame.records, getProjects: () => $settings.projects,
  });
  const unsubCommands = subscribeCanvasCommands(() => schemaController.openSchema(), () => schemaController.openCreateField());
  onDestroy(() => { unsubCommands(); schemaController.dispose(); }); // CV-2: nothing opens after the view is gone
  let isRecalculating = false, showFormulaBar = false, activeFilterTab: ActiveFilterTab | null = null;
  $: { void frame; isRecalculating = true; void Promise.resolve().then(() => { isRecalculating = false; }); }
  $: fieldNames = frame.fields.map((f) => f.name);
  $: previewRecord = frame.records[0];
  function handleFilterTab(e: CustomEvent<{ field: string; value: string | null }>) {
    const { field, value } = e.detail;
    activeFilterTab = value === null ? null : { field, value };
  }
  $: filteredFrame = applyFilterTab(frame, activeFilterTab);
  $: getFileStat = ((a) => (path: string) => {
    const f = a?.vault.getAbstractFileByPath(path);
    return f && "stat" in f ? (f as { stat: { ctime: number; mtime: number } }).stat : null;
  })($app) satisfies GetFileStat;
  $: displayFrame = buildDisplayFrame(filteredFrame, effectiveConfig, getFileStat);
  $: availableSources = ($settings.projects ?? []).filter((p) => p.id !== project.id).map((p) => ({ id: p.id, name: p.name }));
  $: availableWidgets = widgets.map((w) => ({ id: w.id, title: w.title }));
  const sourceStatesStore = writable<ReadonlyMap<string, ExternalSourceState>>(new Map());
  $: rightFrames = readyFrames($sourceStatesStore); // #136 derived — cannot drift
  const syncPreload = createPreloadSync(createPreloadRunner(
    api.resolveExternalFrame ? (id: string) => api.resolveExternalFrame!(id).then((f) => f ?? undefined) : undefined,
    (states) => sourceStatesStore.set(states)
  ));
  $: syncPreload(collectReferencedSourceIds(widgets, project), $externalFrameInvalidation);
  function promoteLocalToGlobal() {
    if (!activeFilterTab || !onViewFilterChange) return;
    onViewFilterChange(promoteFilterTabToGlobal(activeFilterTab, globalFilter, frame.fields));
    activeFilterTab = null;
  }
  $: dndWidgets = widgets.map((w) => ({ ...w }));
  function handleDndConsider(e: CustomEvent<DndEvent<WidgetDefinition>>) { dndWidgets = e.detail.items; }
  function handleDndFinalize(e: CustomEvent<DndEvent<WidgetDefinition>>) {
    dndWidgets = e.detail.items;
    if (!effectiveConfig) return;
    saveConfig({ ...effectiveConfig, widgets: dndWidgets.filter((w) => w.id !== SHADOW_PLACEHOLDER_ITEM_ID.toString()) });
  }
  $: primaryDataTableId = effectiveConfig?.widgets.find((w) => w.type === "data-table" || w.type === "database-call")?.id ?? "";
  const selectionStore: SelectionStore = createSelectionStore();
  setContext<SelectionStore>(SELECTION_CONTEXT_KEY, selectionStore);
  onDestroy(bindEscapeClear(selectionStore));
  function handleFormulaApply(e: CustomEvent<{ name: string; expression: string }>) {
    widgetController.applyFormulaField(e.detail.name, e.detail.expression);
    showFormulaBar = false;
  }
  const suggest = createSuggestionController({
    getConfig: () => effectiveConfig,
    saveConfig,
    addWidget: (t, init) => widgetController.addWidget(t, init),
    getPrimaryWidgetId: () => effectiveConfig?.widgets.find((w) => w.type === "data-table" || w.type === "database-call")?.id,
  });
</script>
<ViewLayout>
  <ViewContent>
    <div class="ppp-database-root" role="region" aria-label={$i18n.t("views.dashboard.name")}>
      <div class="ppp-toolbar-row">
        <DashboardToolbar {showToolbar} {readonly} {showFormulaBar} currentWidgets={widgets}
          on:toggleToolbar={toggleToolbar} on:openSchema={() => schemaController.openSchema()}
          on:toggleFormulaBar={() => (showFormulaBar = !showFormulaBar)}
          on:addWidget={(e) => widgetController.addWidget(e.detail)} />
        {#if isRecalculating}<span class="ppp-recalc-dot" aria-label={$i18n.t("views.dashboard.canvas.recalculating", { defaultValue: "Recalculating…" })} aria-live="polite" />{/if}
      </div>
      {#if !readonly && quickActions.length > 0}
        <div class="ppp-quick-actions" role="group" aria-label={$i18n.t("views.dashboard.quick.group", { defaultValue: "Quick actions" })}>
          {#each quickActions as action (action.id)}
            <!-- #191: `toggle-formula-bar` is the only kind left, so the call is
                 direct. A dispatcher over a union of one would be ceremony that
                 hides which of the two lines is the actual behaviour. -->
            <button class="ppp-quick-action clickable-icon" on:click={() => (showFormulaBar = !showFormulaBar)}
              aria-label={action.labelKey ? $i18n.t(action.labelKey, { defaultValue: action.label }) : action.label}>
              {action.labelKey ? $i18n.t(action.labelKey, { defaultValue: action.label }) : action.label}
            </button>
          {/each}
        </div>
      {/if}
      {#if showFormulaBar && !readonly}
        <FormulaBar fields={fieldNames} {previewRecord} on:apply={handleFormulaApply} on:cancel={() => (showFormulaBar = false)} />
      {/if}
      <FilterBridge {activeFilterTab} {readonly}
        canPromote={!!onViewFilterChange} on:promote={promoteLocalToGlobal} on:clear={() => (activeFilterTab = null)} />
      {#if !readonly && widgets.length > 0}
        <SmartSuggestionBus fields={frame.fields} {widgets} dismissed={effectiveConfig?.dismissedSuggestions ?? []}
          on:accept={suggest.accept} on:dismissForever={suggest.dismiss} />
      {/if}
      <WidgetGrid
        {widgets} {dndWidgets} canDnd={!readonly} {frame} {displayFrame} {api} {readonly} {getRecordColor}
        fields={frame.fields} tableConfig={effectiveConfig?.table} {primaryDataTableId}
        fieldPresets={effectiveConfig?.fieldPresets ?? []} activeFieldPresetId={effectiveConfig?.activeFieldPresetId}
        {availableSources} {availableWidgets} {rightFrames} sourceStates={$sourceStatesStore} {project}
        on:consider={handleDndConsider} on:finalize={handleDndFinalize} on:filter={handleFilterTab}
        on:showToolbar={() => { if (!effectiveConfig) return; saveConfig({ ...effectiveConfig, showWidgetToolbar: true }); }}
        on:addWidget={(e) => widgetController.addWidget(e.detail)}
        on:configChange={widgetController.handleWidgetConfigChange}
        on:tableConfigChange={widgetController.handleTableConfigChange}
        on:fieldPresetsChange={handleFieldPresetsChange}
        on:removeWidget={(e) => widgetController.removeWidget(e.detail)}
      />
    </div>
  </ViewContent>
</ViewLayout>
<style>
  /* Matryoshka rung (#166). Contained safely because this box is `width: 100%`: it never relied on intrinsic width. */
  .ppp-database-root { display: flex; flex-direction: column; width: 100%; min-height: 100%; gap: var(--ppp-space-sm, 0.375rem); container-type: inline-size; container-name: dashboard-root; }
  .ppp-toolbar-row { display: flex; align-items: center; gap: 0.375rem; }
  .ppp-recalc-dot { display: inline-block; width: 0.375rem; height: 0.375rem; border-radius: 50%; background: var(--interactive-accent); opacity: 0.7; animation: ppp-pulse 0.8s ease-in-out infinite alternate; flex-shrink: 0; }
  @keyframes ppp-pulse { from { opacity: 0.3; } to { opacity: 0.9; } }
  .ppp-quick-actions { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; }
  .ppp-quick-action { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.625rem; font-size: var(--font-ui-small); color: var(--text-normal); background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: var(--radius-s, 0.25rem); cursor: pointer; }
  .ppp-quick-action:hover { border-color: var(--interactive-accent); background: var(--background-modifier-hover); }
  .ppp-quick-action:focus-visible { outline: 0.125rem solid var(--interactive-accent); outline-offset: 0.0625rem; }
</style>
