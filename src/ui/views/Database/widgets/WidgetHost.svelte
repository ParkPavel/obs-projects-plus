<script lang="ts">
  import type {
    DataFrame,
    DataRecord,
  } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import type { WidgetDefinition, ChartConfig, StatsConfig } from "../types";
  import type { DataTableConfig, FieldPreset } from "../types";
  import type { TransformPipeline } from "../engine/transformTypes";

  import { createEventDispatcher } from "svelte";
  import DataTableWidget from "./DataTable/DataTableWidget.svelte";
  import ChartWidget from "./Chart/ChartWidget.svelte";
  import ChartConfigPanel from "./Chart/ChartConfig.svelte";
  import StatsWidget from "./Stats/StatsWidget.svelte";
  import StatsConfigPanel from "./Stats/StatsConfig.svelte";
  import ComparisonWidget from "./Comparison/ComparisonWidget.svelte";
  import ComparisonConfigPanel from "./Comparison/ComparisonConfig.svelte";
  import ChecklistWidget from "./Checklist/ChecklistWidget.svelte";
  import ChecklistConfigPanel from "./Checklist/ChecklistConfig.svelte";
  import PipelineEditor from "./PipelineEditor.svelte";
  import ViewPortWidget from "./ViewPort/ViewPortWidget.svelte";
  import ViewPortConfigPanel from "./ViewPort/ViewPortConfig.svelte";
  import FilterTabsWidget from "./FilterTabs/FilterTabsWidget.svelte";
  import FilterTabsConfigPanel from "./FilterTabs/FilterTabsConfig.svelte";
  import SummaryRowWidget from "./SummaryRow/SummaryRowWidget.svelte";
  import SummaryRowConfigPanel from "./SummaryRow/SummaryRowConfig.svelte";
  import { getConfigPanel } from "./configPanelRegistry";
  import { ariaWidget } from "../engine/accessibility";
  import { executeTransform } from "../engine/transformExecutor";
  import { enrichWithBacklinks } from "../engine/relationResolver";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { resizable } from "./resizable";
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
  /** Pillar 5 UI: preloaded frames for JoinStep + scatter correlation. */
  export let rightFrames: ReadonlyMap<string, DataFrame> = new Map();

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

  // Widget meta for resize constraints
  $: meta = getWidgetMeta(widget.type);
  $: resizableParams = {
    w: widget.layout.w,
    h: collapsed ? 1 : widget.layout.h,
    minW: widget.layout.minW ?? meta?.defaultLayout.minW ?? 2,
    minH: widget.layout.minH ?? meta?.defaultLayout.minH ?? 1,
    enabled: !collapsed && !readonly,
    onResize: (newW: number, newH: number) => {
      dispatch("configChange", {
        id: widget.id,
        changes: {
          layout: { ...widget.layout, w: newW, h: newH },
        },
      });
    },
  };

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
  role={widgetAria.role}
  aria-labelledby={`ppp-widget-title-${widget.id}`}
  tabindex={widgetAria.tabindex}
  style:grid-column={widget.layout.w === 12
    ? "1 / -1"
    : `span ${widget.layout.w}`}
  style:grid-row={`span ${collapsed ? 1 : widget.layout.h}`}
  use:resizable={resizableParams}
>
  <!-- Header -->
  <div class="ppp-widget-header">
    <button
      class="ppp-widget-collapse-btn clickable-icon"
      on:click={toggleCollapse}
      aria-label={collapsed ? $i18n.t("views.database.widget.expand") : $i18n.t("views.database.widget.collapse")}
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
        aria-label={$i18n.t("views.database.widget.configure", { defaultValue: "Configure widget" })}
        title={$i18n.t("views.database.widget.configure", { defaultValue: "Configure widget" })}
      >⚙</button>
    {/if}
    {#if !readonly && widget.type !== "data-table"}
      <button
        class="ppp-widget-pipeline-btn clickable-icon"
        class:ppp-widget-pipeline-btn--active={currentPipeline.steps.length > 0}
        on:click={() => (showPipeline = !showPipeline)}
        aria-label={$i18n.t("views.database.widget.pipeline", { defaultValue: "Data transform pipeline" })}
        title={currentPipeline.steps.length > 0
          ? $i18n.t("views.database.widget.pipeline-active", {
              defaultValue: "Pipeline: {{count}} step(s) — filter, group, unnest, sort",
              count: currentPipeline.steps.length,
            })
          : $i18n.t("views.database.widget.pipeline-tip", {
              defaultValue: "Data pipeline — filter, group, unnest, sort (empty)",
            })}
      >
        <span class="ppp-widget-pipeline-glyph">∑</span>{#if currentPipeline.steps.length > 0}<span class="ppp-widget-pipeline-count">{currentPipeline.steps.length}</span>{/if}
      </button>
    {/if}
    {#if !readonly}
      <button
        class="ppp-widget-remove-btn clickable-icon"
        on:click={() => dispatch("removeWidget", widget.id)}
        aria-label={$i18n.t("views.database.widget.remove")}
      >✕</button>
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
      {#if renderError}
        <div class="ppp-widget-error">
          <span class="ppp-widget-error-icon">⚠</span>
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
          config={tableConfig}
          {fieldPresets}
          {activeFieldPresetId}
          on:configChange={(e) => dispatch("tableConfigChange", e.detail)}
          on:fieldPresetsChange={(e) => dispatch("fieldPresetsChange", e.detail)}
        />
      {:else if widget.type === "chart" && chartConfig}
        <ChartWidget config={chartConfig} source={transformedFrame} rightFrame={chartRightFrame} />
      {:else if widget.type === "chart" && !chartConfig}
        <div class="ppp-widget-setup-wizard">
          <span class="ppp-widget-setup-icon">📊</span>
          <span>{$i18n.t("views.database.widget.chart-not-configured", { defaultValue: "Chart is not configured" })}</span>
          <button class="ppp-widget-setup-btn" on:click={initChartConfig}>
            {$i18n.t("views.database.widget.configure", { defaultValue: "Configure" })}
          </button>
        </div>
      {:else if widget.type === "stats" && statsConfig}
        <StatsWidget config={statsConfig} source={transformedFrame} />
      {:else if widget.type === "stats" && !statsConfig}
        <div class="ppp-widget-setup-wizard">
          <span class="ppp-widget-setup-icon">📈</span>
          <span>{$i18n.t("views.database.widget.stats-not-configured", { defaultValue: "Stats widget is not configured" })}</span>
          <button class="ppp-widget-setup-btn" on:click={initStatsConfig}>
            {$i18n.t("views.database.widget.configure", { defaultValue: "Configure" })}
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
      {:else}
        <div class="ppp-widget-placeholder">
          {$i18n.t("views.database.widget.not-configured", { type: widget.type })}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ppp-widget-host {
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 0.5rem);
    background: var(--background-primary);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    /* Matryoshka: each widget is a container context for its children */
    container-type: inline-size;
    container-name: widget;
  }

  .ppp-widget-host--collapsed {
    min-height: auto;
  }

  .ppp-widget-header {
    display: flex;
    align-items: center;
    gap: var(--ppp-space-sm, 0.25rem);
    padding: var(--ppp-space-sm, 0.25rem) var(--ppp-space-md, 0.5rem);
    border-bottom: 1px solid var(--background-modifier-border);
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
    border: 1px solid var(--text-error);
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
    border: 1px solid var(--interactive-accent);
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
    .ppp-widget-remove-btn,
    .ppp-widget-pipeline-btn {
      opacity: 1;
    }
  }

  /* Resize handle (injected by use:resizable action) */
  :global(.ppp-resize-handle) {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 1rem;
    height: 1rem;
    cursor: nwse-resize;
    opacity: 0;
    transition: opacity 120ms ease;
    z-index: 5;
    background: linear-gradient(
      135deg,
      transparent 50%,
      var(--text-faint) 50%,
      var(--text-faint) 60%,
      transparent 60%,
      transparent 70%,
      var(--text-faint) 70%,
      var(--text-faint) 80%,
      transparent 80%
    );
  }

  .ppp-widget-host:hover :global(.ppp-resize-handle) {
    opacity: 0.6;
  }

  :global(.ppp-resize-handle:hover) {
    opacity: 1 !important;
  }

  :global(.ppp-widget-host--resizing) {
    outline: 0.125rem dashed var(--interactive-accent);
    outline-offset: -0.0625rem;
  }

  @media (pointer: coarse) {
    :global(.ppp-resize-handle) {
      opacity: 0.5;
      width: 1.5rem;
      height: 1.5rem;
    }
  }
</style>
