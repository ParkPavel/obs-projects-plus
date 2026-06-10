<script lang="ts">
  import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { FilterCondition } from "src/settings/base/settings";
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
  import { Notice } from "obsidian";
  import FormulaBar from "./widgets/FormulaBar.svelte";
  import { buildDisplayFrame } from "./dashboardFramePipeline";
  import type { GetFileStat } from "src/lib/dashboard-engine/applyAutoFields";
  import { createWidgetController } from "./dashboardWidgets";
  import { getDesignTokenCSS } from "./designTokens";
  import { subscribeCanvasCommands } from "./dashboardCommands";
  import { collectReferencedSourceIds, createPreloadRunner, createPreloadSync } from "./dashboardPreload";
  import { createSchemaController } from "./dashboardSchema";
  import { createTemplatesController } from "./dashboardTemplates";
  import { applyFilterTab, formatFilterTooltip, promoteFilterTabToGlobal, type ActiveFilterTab } from "./dashboardFilters";
  import DashboardToolbar from "./DashboardToolbar.svelte";
  import FilterBridge from "./FilterBridge.svelte";
  import TemplateConfirmDialog from "./TemplateConfirmDialog.svelte";
  import WidgetGrid from "./WidgetGrid.svelte";
  import { createSelectionStore, SELECTION_CONTEXT_KEY, type SelectionStore } from "./canvasSelectionStore";

  export let project: ProjectDefinition;
  export let frame: DataFrame;
  export let readonly: boolean;
  export let api: ViewApi;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let config: DatabaseViewConfig | undefined;
  export let onConfigChange: (cfg: DatabaseViewConfig) => void;
  export let globalFilters: FilterCondition[] = [];
  export let onViewFilterChange: ((filter: { conjunction: "and" | "or"; conditions: FilterCondition[] }) => void) | undefined = undefined;
  const projectStore = writable<ProjectDefinition>(project);
  setContext<Writable<ProjectDefinition>>("project", projectStore);
  $: projectStore.set(project);
  const dataProviderRegistry = createDataProviderRegistry();
  setContext(DATA_PROVIDER_REGISTRY_CONTEXT_KEY, dataProviderRegistry);
  onDestroy(() => dataProviderRegistry.clear());
  function saveConfig(cfg: DatabaseViewConfig) { config = cfg; onConfigChange(cfg); }
  $: widgets = config?.widgets ?? [];
  $: showToolbar = config?.showWidgetToolbar ?? false;
  $: quickActions = config?.quickActions ?? [];
  const tokenCSS = getDesignTokenCSS();
  const widgetController = createWidgetController({ getConfig: () => config, saveConfig, i18nStore: i18n });

  function handleFieldPresetsChange(e: CustomEvent<{ fieldPresets: FieldPreset[]; activeFieldPresetId: string | undefined }>) {
    if (!config) return;
    const { fieldPresets, activeFieldPresetId } = e.detail;
    const base: DatabaseViewConfig = { ...config, fieldPresets };
    if (activeFieldPresetId !== undefined) saveConfig({ ...base, activeFieldPresetId });
    else { const { activeFieldPresetId: _omit, ...rest } = base; void _omit; saveConfig(rest); }
  }
  function toggleToolbar() { if (!config) return; saveConfig({ ...config, showWidgetToolbar: !showToolbar }); }
  const schemaController = createSchemaController({
    app: $app, api, projectId: project.id,
    getFields: () => frame.fields, getProjects: () => $settings.projects,
    t: (key, opts) => opts !== undefined ? $i18n.t(key, opts) : $i18n.t(key),
  });
  const openSchema = () => schemaController.openSchema();
  onDestroy(subscribeCanvasCommands(() => schemaController.openSchema(), () => schemaController.openCreateField()));

  const templatesController = createTemplatesController({
    getConfig: () => config, getWidgets: () => widgets, saveConfig,
    toggleFormulaBar: () => (showFormulaBar = !showFormulaBar),
    t: (key, opts) => opts !== undefined ? $i18n.t(key, opts) : $i18n.t(key),
  });
  const showTemplateReplaceConfirm = templatesController.showConfirm;
  let isRecalculating = false;
  $: { void frame; isRecalculating = true; Promise.resolve().then(() => { isRecalculating = false; }); }
  let showFormulaBar = false;
  $: fieldNames = frame.fields.map((f) => f.name);
  $: previewRecord = frame.records[0];
  let activeFilterTab: ActiveFilterTab | null = null;
  function handleFilterTab(e: CustomEvent<{ field: string; value: string | null }>) {
    const { field, value } = e.detail;
    activeFilterTab = value === null ? null : { field, value };
  }
  $: filteredFrame = applyFilterTab(frame, activeFilterTab);
  $: getFileStat = ((a) => (path: string) => {
    const f = a?.vault.getAbstractFileByPath(path);
    if (!f || !("stat" in f)) return null;
    return (f as { stat: { ctime: number; mtime: number } }).stat;
  })($app) satisfies GetFileStat;
  $: displayFrame = buildDisplayFrame(filteredFrame, config, getFileStat);

  $: availableSources = ($settings.projects ?? []).filter((p) => p.id !== project.id).map((p) => ({ id: p.id, name: p.name }));
  $: availableWidgets = widgets.map((w) => ({ id: w.id, title: w.title }));
  const rightFramesStore = writable<ReadonlyMap<string, DataFrame>>(new Map());
  const syncPreload = createPreloadSync(createPreloadRunner(
    api.resolveExternalFrame ? (id: string) => api.resolveExternalFrame!(id).then((f) => f ?? undefined) : undefined,
    (frames) => rightFramesStore.set(frames)
  ));
  $: referencedIds = collectReferencedSourceIds(widgets, project);
  $: syncPreload(referencedIds, $externalFrameInvalidation);
  $: activeGlobalFilters = globalFilters.filter((c) => c.enabled !== false);
  $: globalFilterTooltip = formatFilterTooltip(activeGlobalFilters);
  function promoteLocalToGlobal() {
    if (!activeFilterTab || !onViewFilterChange) return;
    onViewFilterChange({ conjunction: "and", conditions: promoteFilterTabToGlobal(activeFilterTab, globalFilters) });
    activeFilterTab = null;
  }

  $: dndWidgets = widgets.map((w) => ({ ...w }));
  $: canDnd = !readonly;
  function handleDndConsider(e: CustomEvent<DndEvent<WidgetDefinition>>) { dndWidgets = e.detail.items; }
  function handleDndFinalize(e: CustomEvent<DndEvent<WidgetDefinition>>) {
    dndWidgets = e.detail.items;
    if (!config) return;
    saveConfig({ ...config, widgets: dndWidgets.filter((w) => w.id !== SHADOW_PLACEHOLDER_ITEM_ID.toString()) });
  }
  $: primaryDataTableId = config?.widgets.find((w) => w.type === "data-table")?.id ?? "";
  const selectionStore: SelectionStore = createSelectionStore();
  setContext<SelectionStore>(SELECTION_CONTEXT_KEY, selectionStore);
  if (typeof document !== "undefined") {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") selectionStore.clearSelection(); };
    document.addEventListener("keydown", onKey);
    onDestroy(() => document.removeEventListener("keydown", onKey));
  }

  function handleFormulaApply(e: CustomEvent<{ name: string; expression: string }>) {
    if (!config) return;
    const { name, expression } = e.detail;
    const existing = config.formulaFields ?? [];
    const updated = existing.some((f) => f.name === name)
      ? existing.map((f) => f.name === name ? { ...f, expression } : f)
      : [...existing, { name, expression }];
    saveConfig({ ...config, formulaFields: updated });
    showFormulaBar = false;
  }
  function handleApplyTemplate(e: CustomEvent<WidgetDefinition[]>) {
    templatesController.requestReplace(e.detail).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn("[obs-projects-plus] applyTemplate failed", err);
      new Notice($i18n.t("views.dashboard.canvas.error-apply-template", { defaultValue: "Failed to apply template." }));
    });
  }
</script>

<ViewLayout>
  <ViewContent>
    <div class="ppp-database-root" style={tokenCSS} role="region" aria-label={$i18n.t("views.dashboard.name")}>
      <div class="ppp-toolbar-row">
        <DashboardToolbar {showToolbar} {readonly} {showFormulaBar} currentWidgets={widgets}
          on:toggleToolbar={toggleToolbar} on:openSchema={openSchema}
          on:toggleFormulaBar={() => (showFormulaBar = !showFormulaBar)}
          on:addWidget={(e) => widgetController.addWidget(e.detail)}
          on:applyTemplate={handleApplyTemplate} />
        {#if isRecalculating}<span class="ppp-recalc-dot" aria-label={$i18n.t("views.dashboard.canvas.recalculating", { defaultValue: "Recalculating…" })} aria-live="polite" />{/if}
      </div>
      {#if !readonly && quickActions.length > 0}
        <div class="ppp-quick-actions" role="group" aria-label={$i18n.t("views.dashboard.quick.group", { defaultValue: "Quick actions" })}>
          {#each quickActions as action (action.id)}
            <button class="ppp-quick-action clickable-icon" on:click={() => templatesController.handleQuickAction(action)}
              aria-label={action.labelKey ? $i18n.t(action.labelKey, { defaultValue: action.label }) : action.label}>
              {action.labelKey ? $i18n.t(action.labelKey, { defaultValue: action.label }) : action.label}
            </button>
          {/each}
        </div>
      {/if}
      <TemplateConfirmDialog show={$showTemplateReplaceConfirm} on:confirm={templatesController.confirmReplace} on:cancel={templatesController.cancelReplace} />
      {#if showFormulaBar && !readonly}
        <FormulaBar fields={fieldNames} {previewRecord} on:apply={handleFormulaApply} on:cancel={() => (showFormulaBar = false)} />
      {/if}
      <FilterBridge {activeGlobalFilters} {activeFilterTab} {globalFilterTooltip} {readonly}
        canPromote={!!onViewFilterChange} on:promote={promoteLocalToGlobal} on:clear={() => (activeFilterTab = null)} />
      <WidgetGrid
        {widgets} {dndWidgets} {canDnd} {frame} {displayFrame} {api} {readonly} {getRecordColor}
        fields={frame.fields} tableConfig={config?.table} {primaryDataTableId}
        fieldPresets={config?.fieldPresets ?? []} activeFieldPresetId={config?.activeFieldPresetId}
        {availableSources} {availableWidgets} rightFrames={$rightFramesStore} {project}
        on:consider={handleDndConsider} on:finalize={handleDndFinalize} on:filter={handleFilterTab}
        on:showToolbar={() => { if (!config) return; saveConfig({ ...config, showWidgetToolbar: true }); }}
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
  .ppp-database-root { display: flex; flex-direction: column; width: 100%; min-height: 100%; gap: var(--ppp-space-sm, 0.375rem); }
  .ppp-toolbar-row { display: flex; align-items: center; gap: 0.375rem; }
  .ppp-recalc-dot { display: inline-block; width: 0.375rem; height: 0.375rem; border-radius: 50%; background: var(--interactive-accent); opacity: 0.7; animation: ppp-pulse 0.8s ease-in-out infinite alternate; flex-shrink: 0; }
  @keyframes ppp-pulse { from { opacity: 0.3; } to { opacity: 0.9; } }
  .ppp-quick-actions { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; }
  .ppp-quick-action { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.625rem; font-size: var(--font-ui-small); color: var(--text-normal); background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: var(--radius-s, 0.25rem); cursor: pointer; }
  .ppp-quick-action:hover { border-color: var(--interactive-accent); background: var(--background-modifier-hover); }
  .ppp-quick-action:focus-visible { outline: 0.125rem solid var(--interactive-accent); outline-offset: 0.0625rem; }
</style>
