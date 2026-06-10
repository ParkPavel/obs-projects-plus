<script lang="ts">
  import type {
    DataFrame,
    DataRecord,
  } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import type { WidgetDefinition, ChartConfig, StatsConfig, WidgetSourceConfig, SubBaseCanvasConfig, WidgetDataContext } from "../types";
  import type { DataTableConfig, FieldPreset } from "../types";
  import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";

  import { createEventDispatcher, onMount } from "svelte";
  import { Icon } from "obsidian-svelte";
  import DataTableWidget from "src/archive/dashboard-v1/DataTable/DataTableWidget.svelte";
  import ChartWidget from "./Chart/ChartWidget.svelte";
  import ChartConfigPanel from "./Chart/ChartConfig.svelte";
  import StatsWidget from "./Stats/StatsWidget.svelte";
  import StatsConfigPanel from "./Stats/StatsConfig.svelte";
  import ComparisonWidget from "src/archive/dashboard-v1/Comparison/ComparisonWidget.svelte";
  import ComparisonConfigPanel from "src/archive/dashboard-v1/Comparison/ComparisonConfig.svelte";
  import ChecklistWidget from "./Checklist/ChecklistWidget.svelte";
  import ChecklistConfigPanel from "./Checklist/ChecklistConfig.svelte";
  import PipelineEditor from "./PipelineEditor.svelte";
  import ViewPortWidget from "src/archive/dashboard-v1/ViewPort/ViewPortWidget.svelte";
  import ViewPortConfigPanel from "src/archive/dashboard-v1/ViewPort/ViewPortConfig.svelte";
  import FilterTabsWidget from "./FilterTabs/FilterTabsWidget.svelte";
  import FilterTabsConfigPanel from "./FilterTabs/FilterTabsConfig.svelte";
  import SummaryRowWidget from "src/archive/dashboard-v1/SummaryRow/SummaryRowWidget.svelte";
  import SummaryRowConfigPanel from "src/archive/dashboard-v1/SummaryRow/SummaryRowConfig.svelte";
  import DataListWidget from "src/archive/dashboard-v1/DataList/DataListWidget.svelte";
  import DataListConfigPanel from "src/archive/dashboard-v1/DataList/DataListConfig.svelte";
  import SubBaseCanvasWidget from "src/archive/dashboard-v1/SubBaseCanvas/SubBaseCanvasWidget.svelte";
  import SubBaseCanvasConfigPanel from "src/archive/dashboard-v1/SubBaseCanvas/SubBaseCanvasConfig.svelte";
  import YamlVisualizerWidget from "src/archive/dashboard-v1/YamlVisualizer/YamlVisualizerWidget.svelte";
  import DatabaseCallBlock from "./DatabaseCall/DatabaseCallBlock.svelte";
  import DatabaseCallSettings from "./DatabaseCall/DatabaseCallSettings.svelte";
  import TimelineWidget from "src/archive/dashboard-v1/Timeline/TimelineWidget.svelte";
  import TimelineConfigPanel from "src/archive/dashboard-v1/Timeline/TimelineConfig.svelte";
  import CoverBannerWidget from "./CoverBanner/CoverBannerWidget.svelte";
  import CoverBannerConfigPanel from "./CoverBanner/CoverBannerConfig.svelte";
  import TextWidget from "./TextWidget/TextWidget.svelte";
  import DividerWidget from "./DividerWidget/DividerWidget.svelte";
  import { getConfigPanel } from "./configPanelRegistry";
  import { ariaWidget } from "src/lib/dashboard-engine/accessibility";
  import { executeTransform } from "src/lib/dashboard-engine/transformExecutor";
  import { enrichWithBacklinks } from "src/lib/dashboard-engine/relationResolver";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { getWidgetMeta } from "./widgetRegistry";

  // ── Props ──────────────────────────────────────────────────
  export let widget: WidgetDefinition;
  export let frame: DataFrame;
  export let api: ViewApi;
  export let readonly: boolean;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let fields: DataField[];
  export let tableConfig: DataTableConfig | undefined;
  /** View-scoped FieldPreset list (Phase 2b). */
  export let fieldPresets: FieldPreset[] = [];
  export let activeFieldPresetId: string | undefined = undefined;
  /** Pillar 5 UI: sibling projects picker list (forwarded to editors). */
  export let availableSources: Array<{ id: string; name: string }> = [];
  /** Canvas Selection Bus: sibling widget list for "Link to block" picker. */
  export let availableWidgets: Array<{ id: string; title: string }> = [];
  /** Pillar 5 UI: preloaded frames for JoinStep + scatter correlation. */
  export let rightFrames: ReadonlyMap<string, DataFrame> = new Map();
  /**
   * Stage A.9: current project. Forwarded to widgets so the
   * `ConfigureFieldModal` can populate the Relation/Rollup target-project
   * pickers. Optional to preserve backward compatibility with tests that
   * mount `WidgetHost` in isolation.
   */
  export let project:
    | import("src/settings/settings").ProjectDefinition
    | undefined = undefined;
  /**
   * Multi-DataTable support: when `false`, this widget owns its
   * `widget.config.table` overlay rather than sharing the root
   * `tableConfig`. The first DataTable widget remains "primary" so
   * legacy single-table views keep round-tripping through
   * `config.table` without migration.
   */
  export let isPrimaryDataTable: boolean = true;

  const dispatch = createEventDispatcher<{
    configChange: { id: string; changes: Partial<WidgetDefinition> };
    tableConfigChange: DataTableConfig;
    fieldPresetsChange: {
      fieldPresets: FieldPreset[];
      activeFieldPresetId: string | undefined;
    };
    removeWidget: string;
  }>();

  // ── State ──────────────────────────────────────────────────
  $: collapsed = widget.collapsed ?? false;
  let showConfig = false;
  let showPipeline = false;
  let renderError: string | null = null;

  // DG-9: one-shot IntersectionObserver — renders skeleton until visible
  let hostEl: HTMLDivElement;
  let contentVisible = false;

  onMount(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          contentVisible = true;
          obs.disconnect();
        }
      },
      { threshold: 0 },
    );
    obs.observe(hostEl);
    return () => obs.disconnect();
  });

  // Widget meta retained for default minW/minH resolution downstream
  // (e.g., when widgets compute their initial WindowState in FreeCanvas).
  $: meta = getWidgetMeta(widget.type);
  $: void meta; // referenced by future spec-driven min-size constants

  function toggleCollapse() {
    dispatch("configChange", {
      id: widget.id,
      changes: { collapsed: !collapsed },
    });
  }

  function handleWidgetConfigChange(newConfig: Record<string, unknown>) {
    dispatch("configChange", {
      id: widget.id,
      changes: { config: newConfig },
    });
  }

  function handleChartConfigChange(e: CustomEvent<ChartConfig>) {
    handleWidgetConfigChange(e.detail as unknown as Record<string, unknown>);
  }

  function handlePipelineSave(e: CustomEvent<TransformPipeline>) {
    dispatch("configChange", {
      id: widget.id,
      changes: { transform: e.detail },
    });
    showPipeline = false;
  }

  function asChartConfig(cfg: Record<string, unknown>): ChartConfig | null {
    if (!cfg || typeof cfg !== "object") return null;
    // Valid if it has chartType + xAxis (real ChartConfig structure)
    if ("chartType" in cfg && "xAxis" in cfg) {
      return cfg as unknown as ChartConfig;
    }
    return null;
  }

  function asStatsConfig(cfg: Record<string, unknown>): StatsConfig | null {
    if (!cfg || typeof cfg !== "object") return null;
    if ("cards" in cfg) {
      return cfg as unknown as StatsConfig;
    }
    return null;
  }

  $: chartConfig = widget.type === "chart" ? asChartConfig(widget.config) : null;
  $: statsConfig = widget.type === "stats" ? asStatsConfig(widget.config) : null;

  // ── Config panel registry (Phase 2a — INTERFACE RECLAMATION) ──────────
  $: panelDescriptor = getConfigPanel(widget.type);

  function handleStatsConfigChange(e: CustomEvent<StatsConfig>) {
    handleWidgetConfigChange(e.detail as unknown as Record<string, unknown>);
  }

  function handleSubBaseCanvasChange(e: CustomEvent<SubBaseCanvasConfig>) {
    handleWidgetConfigChange(e.detail as unknown as Record<string, unknown>);
  }

  function handleYamlVisualizerConfigChange(e: CustomEvent<unknown>) {
    handleWidgetConfigChange(e.detail as Record<string, unknown>);
  }

  // ── Multi-DataTable: per-widget config overlay ────────────
  // Primary widget continues to read/write the root `tableConfig`
  // (back-compat for legacy single-table views). Non-primary widgets
  // own their `widget.config.table`, so resizing/sorting one table
  // never leaks into the others sharing the same canvas.
  $: widgetTableConfig = (widget.config as { table?: DataTableConfig })?.table;
  $: effectiveTableConfig = isPrimaryDataTable
    ? tableConfig
    : widgetTableConfig ?? tableConfig;

  function handleDataTableConfigChange(e: CustomEvent<DataTableConfig>) {
    if (isPrimaryDataTable) {
      dispatch("tableConfigChange", e.detail);
      return;
    }
    handleWidgetConfigChange({
      ...(widget.config ?? {}),
      table: e.detail,
    });
  }

  /**
   * Uniform cog-click handler. Either toggles the panel if widget is
   * already configured, or seeds defaults and opens the panel.
   */
  function toggleConfig() {
    if (panelDescriptor.isConfigured(widget.config ?? {})) {
      showConfig = !showConfig;
      return;
    }
    handleWidgetConfigChange(panelDescriptor.initDefaults(fields));
    showConfig = true;
  }

  /** Back-compat shim for setup-wizard "Configure" buttons inline in content. */
  function initChartConfig() {
    toggleConfig();
  }
  function initStatsConfig() {
    toggleConfig();
  }
  $: currentPipeline = widget.transform ?? { steps: [] };
  $: widgetAria = ariaWidget(widget.title);

  // Discover relation fields and enrich frame with bi-directional backlinks
  $: relationFieldNames = fields
    .filter((f) => f.type === DataFieldType.Relation && !f.derived)
    .map((f) => f.name);
  $: enrichedFrame = relationFieldNames.length > 0
    ? enrichWithBacklinks(frame, relationFieldNames)
    : frame;

  // Apply transform pipeline to frame data (if configured)
  $: transformedFrame = currentPipeline.steps.length > 0
    ? executeTransform(enrichedFrame, currentPipeline, { rightFrames }).data
    : enrichedFrame;

  // Pillar 5: resolve correlation right-frame for scatter widgets.
  $: chartRightFrame = (() => {
    if (widget.type !== "chart" || !chartConfig) return null;
    const scatterCfg = chartConfig as { correlation?: { rightSourceId?: string } };
    const id = scatterCfg?.correlation?.rightSourceId;
    if (!id) return null;
    return rightFrames.get(id) ?? null;
  })();

  // NPLAN-V7.1: per-widget independent source for `database-call` widgets.
  // The projectId is resolved via the canvas-level right-frame preload channel
  // (collectReferencedSourceIds → dashboardPreload), so vault-change
  // invalidation is handled automatically without extra stores here.
  $: dbCallSourceConfig = widget.type === "database-call" ? widget.sourceConfig : undefined;
  $: dbCallFrame = dbCallSourceConfig?.projectId ? (rightFrames.get(dbCallSourceConfig.projectId) ?? frame) : transformedFrame;
  $: dbCallFields = dbCallFrame.fields;
  $: dbCallLinkedSelection = widget.type === "database-call" ? (widget.config as unknown as WidgetDataContext).linkedSelection : undefined;

  function handleDbCallSourceChange(e: CustomEvent<WidgetSourceConfig>) {
    dispatch("configChange", { id: widget.id, changes: { sourceConfig: e.detail } });
  }

  function handleLinkedSelectionChange(e: CustomEvent<import("../types").LinkedSelectionConfig | undefined>) {
    const cfg = { ...widget.config };
    if (e.detail !== undefined) {
      cfg["linkedSelection"] = e.detail;
    } else {
      delete cfg["linkedSelection"];
    }
    handleWidgetConfigChange(cfg);
  }

  /** Capture unhandled errors scoped to this widget's DOM subtree */
  function captureErrors(node: HTMLElement) {
    function handleResourceError(e: Event) {
      // Capture-phase listener on the widget node catches resource loading errors
      // (img, script failures) from child elements within this widget only.
      if (e.target instanceof HTMLElement && node.contains(e.target)) {
        renderError = `Failed to load: ${(e.target as HTMLElement).tagName.toLowerCase()}`;
      }
    }
    // use capture phase — resource error events do not bubble
    node.addEventListener("error", handleResourceError, true);
    return {
      destroy() {
        node.removeEventListener("error", handleResourceError, true);
      },
    };
  }
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div
  class="ppp-widget-host"
  class:ppp-widget-host--collapsed={collapsed}
  bind:this={hostEl}
  role={widgetAria.role}
  aria-labelledby={`ppp-widget-title-${widget.id}`}
  tabindex={widgetAria.tabindex}
>
  <!-- Header -->
  <div class="ppp-widget-header">
    <button
      class="ppp-widget-collapse-btn clickable-icon"
      on:click={toggleCollapse}
      aria-label={collapsed ? $i18n.t("views.dashboard.widget.expand") : $i18n.t("views.dashboard.widget.collapse")}
      aria-expanded={!collapsed}
    >
      {collapsed ? "›" : "‹"}
    </button>
    <span id={`ppp-widget-title-${widget.id}`} class="ppp-widget-title">{widget.title}</span>
    <span class="ppp-widget-type-badge" aria-hidden="true">({widget.type})</span>
    {#if panelDescriptor.hasCog && !readonly}
      <button
        class="ppp-widget-settings-btn clickable-icon"
        on:click={toggleConfig}
        aria-label={$i18n.t("views.dashboard.widget.configure", { defaultValue: "Configure widget" })}
        title={$i18n.t("views.dashboard.widget.configure", { defaultValue: "Configure widget" })}
      ><Icon name="settings-2" size="sm" /></button>
    {/if}
    {#if !readonly && widget.type !== "data-table" && widget.type !== "text" && widget.type !== "divider"}
      <button
        class="ppp-widget-pipeline-btn clickable-icon"
        class:ppp-widget-pipeline-btn--active={currentPipeline.steps.length > 0}
        on:click={() => (showPipeline = !showPipeline)}
        aria-label={$i18n.t("views.dashboard.widget.pipeline", { defaultValue: "Data transform pipeline" })}
        title={currentPipeline.steps.length > 0
          ? $i18n.t("views.dashboard.widget.pipeline-active", {
              defaultValue: "Pipeline: {{count}} step(s) — filter, group, unnest, sort",
              count: currentPipeline.steps.length,
            })
          : $i18n.t("views.dashboard.widget.pipeline-tip", {
              defaultValue: "Data pipeline — filter, group, unnest, sort (empty)",
            })}
      >
        <span class="ppp-widget-pipeline-glyph">∑</span>{#if currentPipeline.steps.length > 0}<span class="ppp-widget-pipeline-count">{currentPipeline.steps.length}</span>{/if}
      </button>
    {/if}
    {#if !readonly}
      <button
        class="ppp-widget-lock-btn clickable-icon"
        class:ppp-widget-lock-btn--locked={widget.layout.locked}
        on:click={() => dispatch("configChange", { id: widget.id, changes: { layout: { ...widget.layout, locked: !(widget.layout.locked ?? false) } } })}
        aria-label={widget.layout.locked ? $i18n.t("views.dashboard.widget.unlock", { defaultValue: "Unlock widget" }) : $i18n.t("views.dashboard.widget.lock", { defaultValue: "Lock widget position" })}
        title={widget.layout.locked ? $i18n.t("views.dashboard.widget.unlock", { defaultValue: "Unlock widget" }) : $i18n.t("views.dashboard.widget.lock", { defaultValue: "Lock widget position" })}
      ><Icon name={widget.layout.locked ? "lock" : "unlock"} size="sm" /></button>
      <button
        class="ppp-widget-remove-btn clickable-icon"
        on:click={() => dispatch("removeWidget", widget.id)}
        aria-label={$i18n.t("views.dashboard.widget.remove")}
      ><Icon name="x" size="sm" /></button>
    {/if}
  </div>

  <!-- Config panel (chart) -->
  {#if showConfig && widget.type === "chart" && chartConfig}
    <ChartConfigPanel
      config={chartConfig}
      {fields}
      {availableSources}
      on:change={handleChartConfigChange}
    />
  {/if}

  {#if showConfig && widget.type === "checklist"}
    <ChecklistConfigPanel
      config={widget.config}
      fields={transformedFrame.fields}
      on:change={(e) => handleWidgetConfigChange(e.detail)}
      on:close={() => (showConfig = false)}
    />
  {/if}

  {#if showConfig && widget.type === "stats" && statsConfig}
    <StatsConfigPanel
      config={statsConfig}
      fields={transformedFrame.fields}
      on:change={handleStatsConfigChange}
      on:close={() => (showConfig = false)}
    />
  {/if}

  {#if showConfig && widget.type === "summary-row"}
    <SummaryRowConfigPanel
      config={widget.config}
      fields={transformedFrame.fields}
      on:change={(e) => handleWidgetConfigChange(e.detail)}
      on:close={() => (showConfig = false)}
    />
  {/if}

  {#if showConfig && widget.type === "data-list"}
    <DataListConfigPanel
      config={widget.config}
      fields={transformedFrame.fields}
      on:change={(e) => handleWidgetConfigChange(e.detail)}
      on:close={() => (showConfig = false)}
    />
  {/if}

  {#if showConfig && widget.type === "sub-base-canvas"}
    <SubBaseCanvasConfigPanel
      config={widget.config}
      fields={transformedFrame.fields}
      source={transformedFrame}
      on:change={(e) => handleWidgetConfigChange(e.detail)}
      on:close={() => (showConfig = false)}
    />
  {/if}

  {#if showConfig && widget.type === "comparison"}
    <ComparisonConfigPanel
      config={widget.config}
      fields={transformedFrame.fields}
      on:change={(e) => handleWidgetConfigChange(e.detail)}
      on:close={() => (showConfig = false)}
    />
  {/if}

  {#if showConfig && widget.type === "filter-tabs"}
    <FilterTabsConfigPanel
      config={widget.config}
      fields={transformedFrame.fields}
      source={transformedFrame}
      on:change={(e) => handleWidgetConfigChange(e.detail)}
      on:close={() => (showConfig = false)}
    />
  {/if}

  {#if showConfig && widget.type === "view-port"}
    <ViewPortConfigPanel
      config={widget.config}
      on:change={(e) => handleWidgetConfigChange(e.detail)}
      on:close={() => (showConfig = false)}
    />
  {/if}

  {#if showConfig && widget.type === "database-call"}
    <DatabaseCallSettings
      sourceConfig={dbCallSourceConfig}
      {availableSources}
      availableWidgets={availableWidgets.filter(w => w.id !== widget.id)}
      linkedSelection={dbCallLinkedSelection}
      fields={dbCallFields}
      on:change={handleDbCallSourceChange}
      on:linkedSelectionChange={handleLinkedSelectionChange}
      on:close={() => (showConfig = false)}
    />
  {/if}

  {#if showConfig && widget.type === "timeline"}
    <TimelineConfigPanel
      config={widget.config}
      fields={transformedFrame.fields}
      on:change={(e) => handleWidgetConfigChange(e.detail)}
      on:close={() => (showConfig = false)}
    />
  {/if}

  {#if showConfig && widget.type === "cover-banner"}
    <CoverBannerConfigPanel
      config={widget.config}
      on:change={(e) => handleWidgetConfigChange(e.detail)}
      on:close={() => (showConfig = false)}
    />
  {/if}

  <!-- Transform pipeline editor -->
  {#if showPipeline}
    <PipelineEditor
      pipeline={currentPipeline}
      fields={frame.fields}
      source={frame}
      {availableSources}
      on:save={handlePipelineSave}
      on:cancel={() => (showPipeline = false)}
    />
  {/if}

  <!-- Content -->
  {#if !collapsed}
    <div class="ppp-widget-content" use:captureErrors>
      {#if !contentVisible}
        <div class="ppp-widget-skeleton" aria-hidden="true"></div>
      {:else if renderError}
        <div class="ppp-widget-error">
          <span class="ppp-widget-error-icon"><Icon name="alert-triangle" size="sm" /></span>
          <span>{renderError}</span>
          <button class="ppp-widget-error-retry" on:click={() => { renderError = null; }}>
            {$i18n.t("common.retry", { defaultValue: "Retry" })}
          </button>
        </div>
      {:else if widget.type === "data-table"}
        <DataTableWidget
          frame={transformedFrame}
          {api}
          {readonly}
          {getRecordColor}
          fields={transformedFrame.fields}
          config={effectiveTableConfig}
          {fieldPresets}
          {activeFieldPresetId}
          {project}
          widgetId={widget.id}
          on:configChange={handleDataTableConfigChange}
          on:fieldPresetsChange={(e) => dispatch("fieldPresetsChange", e.detail)}
        />
      {:else if widget.type === "chart" && chartConfig}
        <ChartWidget config={chartConfig} source={transformedFrame} rightFrame={chartRightFrame} widgetId={widget.id} />
      {:else if widget.type === "chart" && !chartConfig}
        <div class="ppp-widget-setup-wizard">
          <span class="ppp-widget-setup-icon"><Icon name="bar-chart-2" size="lg" /></span>
          <span>{$i18n.t("views.dashboard.widget.chart-not-configured", { defaultValue: "Chart is not configured" })}</span>
          <button class="ppp-widget-setup-btn" on:click={initChartConfig}>
            {$i18n.t("views.dashboard.widget.configure", { defaultValue: "Configure" })}
          </button>
        </div>
      {:else if widget.type === "stats" && statsConfig}
        <StatsWidget config={statsConfig} source={transformedFrame} widgetId={widget.id} />
      {:else if widget.type === "stats" && !statsConfig}
        <div class="ppp-widget-setup-wizard">
          <span class="ppp-widget-setup-icon"><Icon name="trending-up" size="lg" /></span>
          <span>{$i18n.t("views.dashboard.widget.stats-not-configured", { defaultValue: "Stats widget is not configured" })}</span>
          <button class="ppp-widget-setup-btn" on:click={initStatsConfig}>
            {$i18n.t("views.dashboard.widget.configure", { defaultValue: "Configure" })}
          </button>
        </div>
      {:else if widget.type === "comparison"}
        <ComparisonWidget config={widget.config} source={transformedFrame} />
      {:else if widget.type === "checklist"}
        <ChecklistWidget
          config={widget.config}
          source={transformedFrame}
          {api}
          {readonly}
          fields={transformedFrame.fields}
          pipelineSteps={currentPipeline.steps.length}
        />
      {:else if widget.type === "view-port"}
        <ViewPortWidget
          config={widget.config}
          on:configChange={(e) => handleWidgetConfigChange(e.detail)}
        />
      {:else if widget.type === "filter-tabs"}
        <FilterTabsWidget
          config={widget.config}
          source={transformedFrame}
          on:filter
        />
      {:else if widget.type === "summary-row"}
        <SummaryRowWidget
          config={widget.config}
          source={transformedFrame}
          pipelineSteps={currentPipeline.steps.length}
        />
      {:else if widget.type === "data-list"}
        <DataListWidget
          config={widget.config}
          source={transformedFrame}
          pipelineSteps={currentPipeline.steps.length}
        />
      {:else if widget.type === "sub-base-canvas"}
        <SubBaseCanvasWidget
          config={widget.config}
          source={transformedFrame}
          on:change={handleSubBaseCanvasChange}
        />
      {:else if widget.type === "yaml-visualizer"}
        {#if project}
          <YamlVisualizerWidget
            config={widget.config}
            source={transformedFrame}
            {project}
            {api}
            {readonly}
            on:change={handleYamlVisualizerConfigChange}
          />
        {:else}
          <div class="ppp-widget-placeholder">
            {$i18n.t("views.dashboard.widget.not-configured", { type: widget.type })}
          </div>
        {/if}
      {:else if widget.type === "database-call"}
        <DatabaseCallBlock
          frame={dbCallFrame}
          {api}
          {readonly}
          {getRecordColor}
          fields={dbCallFields}
          {fieldPresets}
          {activeFieldPresetId}
          {project}
          config={widget.config}
          widgetId={widget.id}
          widgetTitle={widget.title}
          linkedSelection={dbCallLinkedSelection}
          on:configChange={(e) => handleWidgetConfigChange(e.detail)}
          on:fieldPresetsChange={(e) => dispatch("fieldPresetsChange", e.detail)}
        />
      {:else if widget.type === "timeline"}
        <TimelineWidget source={transformedFrame} config={widget.config} />
      {:else if widget.type === "cover-banner"}
        <CoverBannerWidget config={widget.config} />
      {:else if widget.type === "text"}
        <TextWidget
          config={widget.config}
          {readonly}
          on:change={(e) => handleWidgetConfigChange(e.detail)}
        />
      {:else if widget.type === "divider"}
        <DividerWidget
          config={widget.config}
          {readonly}
          on:change={(e) => handleWidgetConfigChange(e.detail)}
        />
      {:else}
        <div class="ppp-widget-placeholder">
          {$i18n.t("views.dashboard.widget.not-configured", { type: widget.type })}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ppp-widget-host {
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-m, 0.5rem);
    background: var(--background-primary);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    /* Matryoshka: each widget is a container context for its children */
    container-type: inline-size;
    container-name: widget;
    transition: transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
  }

  .ppp-widget-host--collapsed {
    min-height: auto;
  }

  .ppp-widget-header {
    display: flex;
    align-items: center;
    gap: var(--ppp-space-sm, 0.25rem);
    padding: var(--ppp-space-sm, 0.25rem) var(--ppp-space-md, 0.5rem);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    background: var(--background-secondary);
    user-select: none;
    min-height: 2.25rem;
  }

  .ppp-widget-collapse-btn {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--radius-s, 0.25rem);
    transition: transform var(--ppp-duration-normal, 0.15s) ease, color var(--ppp-duration-normal, 0.15s) ease;
  }

  .ppp-widget-host--collapsed .ppp-widget-collapse-btn {
    transform: rotate(-90deg);
  }

  .ppp-widget-collapse-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .ppp-widget-title {
    font-weight: var(--font-semibold, 600);
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-widget-type-badge {
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    flex-shrink: 0;
    opacity: 0;
    transition: opacity var(--ppp-duration-normal, 0.15s) ease;
  }

  .ppp-widget-header:hover .ppp-widget-type-badge {
    opacity: 1;
  }

  .ppp-widget-settings-btn {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--text-faint);
    border-radius: var(--radius-s, 0.25rem);
    opacity: 0;
    transition: opacity 120ms ease, transform 120ms ease, color 120ms ease, background 120ms ease;
  }

  .ppp-widget-host:hover .ppp-widget-settings-btn {
    opacity: 1;
  }

  .ppp-widget-settings-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
    transform: scale(1.02);
  }

  .ppp-widget-remove-btn {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--text-faint);
    border-radius: var(--radius-s, 0.25rem);
    margin-left: auto;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .ppp-widget-host:hover .ppp-widget-remove-btn {
    opacity: 1;
  }

  .ppp-widget-remove-btn:hover {
    color: var(--text-error);
    background: var(--background-modifier-hover);
  }

  .ppp-widget-lock-btn {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--text-faint);
    border-radius: var(--radius-s, 0.25rem);
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .ppp-widget-host:hover .ppp-widget-lock-btn {
    opacity: 1;
  }

  .ppp-widget-lock-btn--locked {
    opacity: 1;
    color: var(--text-accent);
  }

  .ppp-widget-lock-btn:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-widget-pipeline-btn {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--text-faint);
    border-radius: var(--radius-s, 0.25rem);
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .ppp-widget-host:hover .ppp-widget-pipeline-btn {
    opacity: 1;
  }

  .ppp-widget-pipeline-btn:hover {
    color: var(--text-accent);
    background: var(--background-modifier-hover);
  }

  /* Active state: pipeline has steps — stay visible, use accent color + subtle pulse on badge */
  .ppp-widget-pipeline-btn--active {
    opacity: 1;
    color: var(--text-accent);
  }

  .ppp-widget-pipeline-glyph {
    font-size: 0.9rem;
    line-height: 1;
    font-weight: 700;
  }

  .ppp-widget-pipeline-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0.875rem;
    height: 0.875rem;
    padding: 0 0.1875rem;
    margin-left: 0.1875rem;
    font-size: 0.625rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text-on-accent, var(--background-primary));
    background: var(--interactive-accent);
    border-radius: 0.4375rem;
  }

  .ppp-widget-content {
    flex: 1;
    overflow: auto;
  }

  .ppp-widget-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--ppp-space-xl, 1.5rem);
    color: var(--text-faint);
    font-style: italic;
  }

  .ppp-widget-error {
    display: flex;
    align-items: center;
    gap: var(--ppp-space-sm, 0.25rem);
    padding: var(--ppp-space-md, 0.5rem) var(--ppp-space-lg, 1rem);
    background: var(--background-modifier-error-rgb, rgba(255, 0, 0, 0.05));
    border-left: 0.1875rem solid var(--text-error);
    color: var(--text-error);
    font-size: var(--font-ui-small);
  }

  .ppp-widget-error-icon {
    flex-shrink: 0;
  }

  .ppp-widget-error-retry {
    margin-left: auto;
    padding: 0.15rem 0.5rem;
    border: 0.0625rem solid var(--text-error);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-error);
    cursor: pointer;
    font-size: var(--font-ui-smaller);
  }

  .ppp-widget-error-retry:hover {
    background: var(--text-error);
    color: var(--background-primary);
  }

  .ppp-widget-setup-wizard {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--ppp-space-sm, 0.25rem);
    padding: var(--ppp-space-xl, 1.5rem);
    color: var(--text-muted);
  }

  .ppp-widget-setup-icon {
    font-size: 1.5rem;
  }

  .ppp-widget-setup-btn {
    margin-top: var(--ppp-space-sm, 0.25rem);
    padding: 0.25rem 0.75rem;
    border: 0.0625rem solid var(--interactive-accent);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--interactive-accent);
    cursor: pointer;
    font-size: var(--font-ui-small);
    transition: background 120ms ease, color 120ms ease;
  }

  .ppp-widget-setup-btn:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  /* Touch devices: always show hover-only action buttons */
  @media (pointer: coarse) {
    .ppp-widget-type-badge,
    .ppp-widget-settings-btn,
    .ppp-widget-remove-btn,
    .ppp-widget-lock-btn,
    .ppp-widget-pipeline-btn {
      opacity: 1;
    }
  }

  /* DG-9 lazy-render skeleton */
  .ppp-widget-skeleton {
    flex: 1;
    min-height: 4rem;
    background: linear-gradient(
      90deg,
      var(--background-modifier-border) 25%,
      var(--background-secondary-alt, var(--background-secondary)) 50%,
      var(--background-modifier-border) 75%
    );
    background-size: 200% 100%;
    animation: ppp-shimmer 1.4s infinite linear;
    border-radius: var(--radius-s, 0.25rem);
  }

  @keyframes ppp-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>
