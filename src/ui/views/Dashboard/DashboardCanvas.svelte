<script lang="ts">
  /**
   * DashboardCanvas — top-level canvas for a single Database/Dashboard view.
   *
   * Owns: prop fan-in, derived reactive state (widgets, layout, filters),
   * and `saveConfig` as the single mutator of `config`. Imperative flows
   * (schema modals, template confirm, cross-source preload, widget grid)
   * are delegated to controllers in `dashboard*.ts` / `WidgetGrid.svelte`.
   */
  import type {
    DataFrame,
    DataRecord,
  } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { FilterCondition } from "src/settings/base/settings";
  import type { DatabaseViewConfig } from "./types";

  import ViewContent from "src/ui/components/Layout/ViewContent.svelte";
  import ViewLayout from "src/ui/components/Layout/ViewLayout.svelte";
  import { setContext } from "svelte";
  import { writable, type Writable } from "svelte/store";
  import { SHADOW_PLACEHOLDER_ITEM_ID } from "svelte-dnd-action";

  import FormulaBar from "./widgets/FormulaBar.svelte";
  import { applyFormulaFields } from "./engine/applyFormulaFields";
  import { applyAutoFields } from "./engine/applyAutoFields";
  import type { GetFileStat } from "./engine/applyAutoFields";
  import { createWidgetController } from "./dashboardWidgets";
  import { getDesignTokenCSS } from "./designTokens";
  import { isMobile } from "src/lib/stores/ui";
  import { i18n } from "src/lib/stores/i18n";
  import { settings } from "src/lib/stores/settings";
  import { externalFrameInvalidation } from "src/lib/stores/externalFrameInvalidation";
  import type { WidgetType, WidgetDefinition } from "./types";
  import { app } from "src/lib/stores/obsidian";
  import { onDestroy } from "svelte";
  import { Notice } from "obsidian";
  import { subscribeCanvasCommands } from "./dashboardCommands";
  import { collectReferencedSourceIds, createPreloadRunner, createPreloadSync } from "./dashboardPreload";
  import { createSchemaController } from "./dashboardSchema";
  import { createTemplatesController } from "./dashboardTemplates";
  import {
    applyFilterTab,
    formatFilterTooltip,
    promoteFilterTabToGlobal,
    type ActiveFilterTab,
  } from "./dashboardFilters";
  import DashboardToolbar from "./DashboardToolbar.svelte";
  import FilterBridge from "./FilterBridge.svelte";
  import TemplateConfirmDialog from "./TemplateConfirmDialog.svelte";
  import WidgetGrid from "./WidgetGrid.svelte";

  // ── Props ──────────────────────────────────────────────────
  export let project: ProjectDefinition;
  export let frame: DataFrame;
  export let readonly: boolean;
  export let api: ViewApi;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let config: DatabaseViewConfig | undefined;
  export let onConfigChange: (cfg: DatabaseViewConfig) => void;
  // Global filter conditions from view.filter (applied upstream in View.svelte).
  // Database view receives them purely for the bridge indicator — data is
  // already filtered by the time it reaches this canvas.
  export let globalFilters: FilterCondition[] = [];
  // Optional callback to persist a new view.filter. When present, the filter
  // bridge exposes a "promote to global" button on the local chip.
  export let onViewFilterChange: ((filter: { conjunction: "and" | "or"; conditions: FilterCondition[] }) => void) | undefined = undefined;

  // ── Reactive context ────────────────────────────────────────
  const projectStore = writable<ProjectDefinition>(project);
  setContext<Writable<ProjectDefinition>>("project", projectStore);
  $: projectStore.set(project);

  // ── Config helpers ─────────────────────────────────────────
  function saveConfig(cfg: DatabaseViewConfig) {
    config = cfg;
    onConfigChange(cfg);
  }

  $: widgets = config?.widgets ?? [];
  $: layoutMode = $isMobile ? "stack" : (config?.layoutMode ?? "stack");
  $: showToolbar = config?.showWidgetToolbar ?? false;
  $: quickActions = config?.quickActions ?? [];

  // ── Design tokens ──────────────────────────────────────────
  const tokenCSS = getDesignTokenCSS();

  // ── Widget management ──────────────────────────────────────
  // CRUD + event handlers delegated to dashboardWidgets.ts controller.
  // DnD handlers and toggles stay here — they mutate local component state
  // (dndWidgets, showToolbar, layoutMode) that cannot escape the Svelte scope
  // without unnecessary complexity. See dashboardWidgets.ts for rationale.
  const widgetController = createWidgetController({
    getConfig: () => config,
    saveConfig,
    i18nStore: i18n,
  });

  /**
   * Phase 2b — Field preset bubble-up from DataTableWidget.
   * Conditional spread on `activeFieldPresetId` is required by
   * `exactOptionalPropertyTypes: true` when clearing to undefined.
   */
  function handleFieldPresetsChange(
    e: CustomEvent<{
      fieldPresets: import("./types").FieldPreset[];
      activeFieldPresetId: string | undefined;
    }>,
  ) {
    if (!config) return;
    const { fieldPresets, activeFieldPresetId } = e.detail;
    const base: DatabaseViewConfig = { ...config, fieldPresets };
    if (activeFieldPresetId !== undefined) {
      saveConfig({ ...base, activeFieldPresetId });
    } else {
      // Strip the key so exactOptionalPropertyTypes stays satisfied.
      const { activeFieldPresetId: _omit, ...rest } = base;
      void _omit;
      saveConfig(rest);
    }
  }

  function toggleToolbar() {
    if (!config) return;
    saveConfig({ ...config, showWidgetToolbar: !showToolbar });
  }

  function toggleLayout() {
    if (!config) return;
    const next = layoutMode === "stack" ? "free" : "stack";
    saveConfig({ ...config, layoutMode: next });
  }

  // ── Schema controller (R5-013) ─────────────────────────────
  // Single canonical entry point for project schema management. The
  // Database canvas can be empty (no DataTable widget) and previously had
  // no surface for editing fields — users had to drop in a Table view
  // first. The Schema button + SchemaModal close that gap so Database
  // always exposes the full property universe of the current project.
  const schemaController = createSchemaController({
    app: $app,
    api,
    projectId: project.id,
    getFields: () => frame.fields,
    getProjects: () => $settings.projects,
    t: (key, opts) => $i18n.t(key, opts),
  });
  const openSchema = () => schemaController.openSchema();

  // ── Stage A.10 — command-palette bridge ─────────────────────
  const unsubCommandBus = subscribeCanvasCommands(
    () => schemaController.openSchema(),
    () => schemaController.openCreateField(),
  );
  onDestroy(unsubCommandBus);

  // ── Templates controller (R5-013) ──────────────────────────
  const templatesController = createTemplatesController({
    getConfig: () => config,
    getWidgets: () => widgets,
    saveConfig,
    toggleFormulaBar: () => (showFormulaBar = !showFormulaBar),
    t: (key, opts) => $i18n.t(key, opts),
  });
  const showTemplateReplaceConfirm = templatesController.showConfirm;

  // ── Recalculating indicator ────────────────────────────────
  // Flips to true whenever the upstream frame identity changes (vault event →
  // dataFrame.merge() → new frame prop). Cleared after one microtask.
  //
  // Why microtask (Promise.resolve) and not a timer?
  //   Chart pipeline execution (computeChartData → executeTransformCached) is
  //   fully synchronous. By the time the next microtask runs, Svelte has already
  //   committed all downstream reactive updates and the DOM reflects fresh data.
  //   A timer (setTimeout) would leave the dot visible longer than necessary.
  //
  // Why `void frame` (not `frame.records.length` etc.)?
  //   We want identity-level reactivity — any new frame object (even same data)
  //   signals a potential recalculation. Field-level access would prevent the
  //   block from re-running when records change without adding/removing fields.
  let isRecalculating = false;
  $: {
    void frame; // reactive on frame identity — see comment above
    isRecalculating = true;
    Promise.resolve().then(() => { isRecalculating = false; });
  }

  // ── Formula bar state ──────────────────────────────────────
  let showFormulaBar = false;
  $: fieldNames = frame.fields.map((f) => f.name);
  $: previewRecord = frame.records[0];

  // ── Filter-tabs state ──────────────────────────────────────
  // FilterTabsWidget dispatches `filter` events that must be applied to the
  // frame before it reaches other widgets. We keep a singleton active filter
  // (last clicked tab wins) and derive `displayFrame` by narrowing records.
  // Filter tabs widgets themselves still receive the full unfiltered frame so
  // their tab counts / auto-seeded values reflect the complete data set.
  let activeFilterTab: ActiveFilterTab | null = null;

  function handleFilterTab(e: CustomEvent<{ field: string; value: string | null }>) {
    const { field, value } = e.detail;
    // Clicking "All" (value === null) clears the filter
    activeFilterTab = value === null ? null : { field, value };
  }

  $: filteredFrame = applyFilterTab(frame, activeFilterTab);

  // MPLAN-001: evaluate user-defined formula columns and inject them as
  // derived fields so the Table cell router renders the computed values.
  // NPLAN-A1: then fill any AutoTime fields whose values weren't populated
  // by the datasource (e.g. user-defined names, non-frontmatter sources).
  $: getFileStat = ((a) => (path: string) => {
    const f = a?.vault.getAbstractFileByPath(path);
    if (!f || !("stat" in f)) return null;
    return (f as { stat: { ctime: number; mtime: number } }).stat;
  })($app) satisfies GetFileStat;
  $: displayFrame = applyAutoFields(
    applyFormulaFields(filteredFrame, config?.formulaFields),
    getFileStat
  );

  // ── Pillar 5 (Phase 5 UI): cross-source preloader ─────────
  // Scan widget configs for JoinStep.rightSourceId and scatter correlation
  // references. Preload each referenced project's DataFrame via ViewApi and
  // keep the results in a reactive Map forwarded to every WidgetHost.
  $: availableSources = ($settings.projects ?? [])
    .filter((p) => p.id !== project.id)
    .map((p) => ({ id: p.id, name: p.name }));

  const rightFramesStore = writable<ReadonlyMap<string, DataFrame>>(new Map());
  const syncPreload = createPreloadSync(
    createPreloadRunner(
      api.resolveExternalFrame?.bind(api),
      (frames) => rightFramesStore.set(frames)
    )
  );

  $: referencedIds = collectReferencedSourceIds(widgets, project);
  // Re-runs when the referenced-id set changes OR the external-frame cache
  // invalidates (vault modify/create/delete/rename, settings.projects mutate).
  $: syncPreload(referencedIds, $externalFrameInvalidation);

  // ── Filter-bridge indicators ──────────────────────────────
  // Surface both global (view.filter, applied upstream) and local
  // (activeFilterTab, applied in this canvas) filter state so users are not
  // confused when data appears narrowed by filters they can't see.
  $: activeGlobalFilters = globalFilters.filter((c) => c.enabled !== false);
  $: globalFilterTooltip = formatFilterTooltip(activeGlobalFilters);

  function promoteLocalToGlobal() {
    if (!activeFilterTab || !onViewFilterChange) return;
    const nextConditions = promoteFilterTabToGlobal(activeFilterTab, globalFilters);
    onViewFilterChange({ conjunction: "and", conditions: nextConditions });
    // Clear local filter — global now owns it.
    activeFilterTab = null;
  }

  // ── DnD reorder (stack mode) ──────────────────────────────
  // svelte-dnd-action needs mutable items with `id`
  $: dndWidgets = widgets.map((w) => ({ ...w }));
  $: canDnd = layoutMode === "stack" && !readonly;

  function handleDndConsider(e: CustomEvent) {
    dndWidgets = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent) {
    dndWidgets = e.detail.items;
    if (!config) return;
    // Persist new order (filter out DnD shadow placeholders)
    const reordered = dndWidgets.filter(
      (w) => w.id !== SHADOW_PLACEHOLDER_ITEM_ID.toString()
    );
    saveConfig({ ...config, widgets: reordered });
  }

  // Primary DataTable id: the first data-table widget in document order
  // continues to own the root `config.table`; subsequent widgets carry
  // their own `widget.config.table` overlay (multi-DataTable support).
  $: primaryDataTableId =
    config?.widgets.find((w) => w.type === "data-table")?.id ?? "";
</script>

<ViewLayout>
  <ViewContent>
    <div class="ppp-database-root" style={tokenCSS} role="region" aria-label={$i18n.t("views.dashboard.name")}>
    <!-- Toolbar row -->
    <div class="ppp-toolbar-row">
      <DashboardToolbar
        {showToolbar}
        {layoutMode}
        {readonly}
        {showFormulaBar}
        currentWidgets={widgets}
        on:toggleToolbar={toggleToolbar}
        on:toggleLayout={toggleLayout}
        on:openSchema={openSchema}
        on:toggleFormulaBar={() => (showFormulaBar = !showFormulaBar)}
        on:addWidget={(e) => widgetController.addWidget(e.detail)}
        on:applyTemplate={(e) => {
          templatesController.requestReplace(e.detail).catch((err) => {
            new Notice($i18n.t("views.dashboard.canvas.error-apply-template", { defaultValue: "Failed to apply template." }));
            // eslint-disable-next-line no-console
            console.warn("[obs-projects-plus] applyTemplate failed", err);
          });
        }}
      />
      {#if isRecalculating}
        <span class="ppp-recalc-dot" aria-label={$i18n.t("views.dashboard.canvas.recalculating", { defaultValue: "Recalculating…" })} aria-live="polite" />
      {/if}
    </div>

    {#if !readonly && quickActions.length > 0}
      <div class="ppp-quick-actions" role="group" aria-label={$i18n.t("views.dashboard.quick.group", { defaultValue: "Quick actions" })}>
        {#each quickActions as action (action.id)}
          <button
            class="ppp-quick-action clickable-icon"
            on:click={() => templatesController.handleQuickAction(action)}
            aria-label={action.labelKey ? $i18n.t(action.labelKey, { defaultValue: action.label }) : action.label}
          >
            {action.labelKey ? $i18n.t(action.labelKey, { defaultValue: action.label }) : action.label}
          </button>
        {/each}
      </div>
    {/if}

    <TemplateConfirmDialog
      show={$showTemplateReplaceConfirm}
      on:confirm={templatesController.confirmReplace}
      on:cancel={templatesController.cancelReplace}
    />

    <!-- Formula bar -->
    {#if showFormulaBar && !readonly}
      <FormulaBar
        fields={fieldNames}
        {previewRecord}
        on:apply={(e) => {
          if (!config) return;
          const { name, expression } = e.detail;
          const existing = config.formulaFields ?? [];
          const updated = existing.some((f) => f.name === name)
            ? existing.map((f) => f.name === name ? { ...f, expression } : f)
            : [...existing, { name, expression }];
          saveConfig({ ...config, formulaFields: updated });
          showFormulaBar = false;
        }}
        on:cancel={() => (showFormulaBar = false)}
      />
    {/if}

    <!-- Local ↔ Global filter bridge -->
    <FilterBridge
      {activeGlobalFilters}
      {activeFilterTab}
      {globalFilterTooltip}
      {readonly}
      canPromote={!!onViewFilterChange}
      on:promote={promoteLocalToGlobal}
      on:clear={() => (activeFilterTab = null)}
    />

    <!-- Widget grid -->
    <WidgetGrid
      {widgets}
      {dndWidgets}
      {canDnd}
      {layoutMode}
      {frame}
      {displayFrame}
      {api}
      {readonly}
      {getRecordColor}
      fields={frame.fields}
      tableConfig={config?.table}
      {primaryDataTableId}
      fieldPresets={config?.fieldPresets ?? []}
      activeFieldPresetId={config?.activeFieldPresetId}
      {availableSources}
      rightFrames={$rightFramesStore}
      {project}
      on:consider={handleDndConsider}
      on:finalize={handleDndFinalize}
      on:filter={handleFilterTab}
      on:showToolbar={() => { if (!config) return; saveConfig({ ...config, showWidgetToolbar: true }); }}
      on:configChange={widgetController.handleWidgetConfigChange}
      on:tableConfigChange={widgetController.handleTableConfigChange}
      on:fieldPresetsChange={handleFieldPresetsChange}
      on:removeWidget={(e) => widgetController.removeWidget(e.detail)}
    />
    </div>
  </ViewContent>
</ViewLayout>

<style>
  .ppp-database-root {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 100%;
    gap: var(--ppp-space-sm, 0.375rem);
  }

  .ppp-toolbar-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .ppp-recalc-dot {
    display: inline-block;
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background: var(--interactive-accent);
    opacity: 0.7;
    animation: ppp-pulse 0.8s ease-in-out infinite alternate;
    flex-shrink: 0;
  }

  @keyframes ppp-pulse {
    from { opacity: 0.3; }
    to   { opacity: 0.9; }
  }

  .ppp-quick-actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .ppp-quick-action {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }

  .ppp-quick-action:hover {
    border-color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  .ppp-quick-action:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.0625rem;
  }
</style>
