<script lang="ts">
  /**
   * WidgetHost — #067 F1 (UT2026-F): thin router.
   *
   * Assembles a reactive WidgetRenderContext, looks the widget type up in
   * widgetComponentRegistry, and mounts the result inside WidgetShell.
   * All frame math (backlink enrichment, transform pipeline, right-frame
   * resolution) lives here; all markup/chrome lives in WidgetShell /
   * WidgetHeaderActions; all type-specific knowledge lives in the registry.
   */
  import type { DataFrame, DataRecord, DataField } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { WidgetDefinition, ChartConfig, StatsConfig, WidgetSourceConfig, WidgetDataContext, LinkedSelectionConfig, DataTableConfig, FieldPreset } from "../types";
  import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";

  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import { executeTransform } from "src/lib/dashboard-engine/transformExecutor";
  import { enrichWithBacklinks } from "src/lib/dashboard-engine/relationResolver";
  import { getConfigPanel } from "./configPanelRegistry";
  import { WIDGET_CONTENT, WIDGET_PANELS, hasPipelineButton, type WidgetRenderContext } from "./widgetComponentRegistry";
  import { convertLegacyWidget, isRetiredLegacyType, unwrapDataTableConfigChange } from "./legacyMigration";
  import WidgetShell from "./WidgetShell.svelte";
  import WidgetHeaderActions from "./WidgetHeaderActions.svelte";
  import WidgetSetupWizard from "./WidgetSetupWizard.svelte";
  import LegacyWidgetPlaceholder from "./LegacyWidgetPlaceholder.svelte";
  import PipelineEditor from "./PipelineEditor.svelte";
  import DatabaseCallSettings from "./DatabaseCall/DatabaseCallSettings.svelte";

  export let widget: WidgetDefinition;
  export let frame: DataFrame;
  export let api: ViewApi;
  export let readonly: boolean;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let fields: DataField[];
  export let tableConfig: DataTableConfig | undefined;
  export let fieldPresets: FieldPreset[] = [];
  export let activeFieldPresetId: string | undefined = undefined;
  export let availableSources: Array<{ id: string; name: string }> = [];
  export let availableWidgets: Array<{ id: string; title: string }> = [];
  export let rightFrames: ReadonlyMap<string, DataFrame> = new Map();
  export let project: import("src/settings/settings").ProjectDefinition | undefined = undefined;
  /** Multi-DataTable: primary widget round-trips the root `config.table`. */
  export let isPrimaryDataTable: boolean = true;

  const dispatch = createEventDispatcher<{
    configChange: { id: string; changes: Partial<WidgetDefinition> };
    tableConfigChange: DataTableConfig;
    fieldPresetsChange: { fieldPresets: FieldPreset[]; activeFieldPresetId: string | undefined };
    removeWidget: string;
  }>();

  let showConfig = false, showPipeline = false, renameSignal = 0;

  $: collapsed = widget.collapsed ?? false;
  $: currentPipeline = widget.transform ?? ({ steps: [] } as TransformPipeline);
  $: panelDescriptor = getConfigPanel(widget.type);

  // ── Frame math ─────────────────────────────────────────────
  $: relationFieldNames = fields
    .filter((f) => f.type === DataFieldType.Relation && !f.derived)
    .map((f) => f.name);
  $: enrichedFrame = relationFieldNames.length > 0 ? enrichWithBacklinks(frame, relationFieldNames) : frame;
  $: transformedFrame = currentPipeline.steps.length > 0
    ? executeTransform(enrichedFrame, currentPipeline, { rightFrames }).data
    : enrichedFrame;

  const asChartConfig = (cfg: Record<string, unknown>): ChartConfig | null =>
    cfg && "chartType" in cfg && "xAxis" in cfg ? (cfg as unknown as ChartConfig) : null;
  const asStatsConfig = (cfg: Record<string, unknown>): StatsConfig | null =>
    cfg && "cards" in cfg ? (cfg as unknown as StatsConfig) : null;
  $: chartConfig = widget.type === "chart" ? asChartConfig(widget.config) : null;
  $: statsConfig = widget.type === "stats" ? asStatsConfig(widget.config) : null;
  $: chartRightFrame = (() => {
    if (widget.type !== "chart" || !chartConfig) return null;
    const id = (chartConfig as { correlation?: { rightSourceId?: string } })?.correlation?.rightSourceId;
    return id ? rightFrames.get(id) ?? null : null;
  })();

  // NPLAN-V7.1: per-widget independent source for `database-call`.
  $: dbCallSourceConfig = widget.type === "database-call" ? widget.sourceConfig : undefined;
  $: dbCallFrame = dbCallSourceConfig?.projectId ? rightFrames.get(dbCallSourceConfig.projectId) ?? frame : transformedFrame;
  $: dbCallLinkedSelection = widget.type === "database-call" ? (widget.config as unknown as WidgetDataContext).linkedSelection : undefined;

  // Multi-DataTable per-widget config overlay (primary keeps root config).
  $: widgetTableConfig = (widget.config as { table?: DataTableConfig })?.table;
  $: effectiveTableConfig = isPrimaryDataTable ? tableConfig : widgetTableConfig ?? tableConfig;

  $: ctx = {
    widget, frame, transformedFrame, api, readonly, getRecordColor, fields,
    fieldPresets, activeFieldPresetId, availableSources, project,
    effectiveTableConfig, pipelineStepCount: currentPipeline.steps.length,
    chartConfig, statsConfig, chartRightFrame,
    dbCallFrame, dbCallFields: dbCallFrame.fields, dbCallSourceConfig, dbCallLinkedSelection,
  } satisfies WidgetRenderContext;

  $: contentEntry = WIDGET_CONTENT[widget.type];
  $: panelEntry = WIDGET_PANELS[widget.type];
  $: contentRenderable = contentEntry ? (contentEntry.canRender?.(ctx) ?? true) : false;
  $: panelRenderable = (widget.type !== "chart" || chartConfig !== null) && (widget.type !== "stats" || statsConfig !== null);

  // ── Event plumbing ─────────────────────────────────────────
  function patchWidget(changes: Partial<WidgetDefinition>) {
    dispatch("configChange", { id: widget.id, changes });
  }
  function handleWidgetConfigChange(newConfig: Record<string, unknown>) {
    patchWidget({ config: newConfig });
  }
  /** data-table renders through DatabaseCallBlock (F3) — unwrap or convert. */
  function handleContentConfigChange(e: CustomEvent<unknown>) {
    if (widget.type !== "data-table") {
      handleWidgetConfigChange(e.detail as Record<string, unknown>);
      return;
    }
    const result = unwrapDataTableConfigChange(e.detail as Record<string, unknown>);
    if (result.kind === "convert") {
      patchWidget({ type: "database-call", config: result.config });
    } else if (isPrimaryDataTable) {
      dispatch("tableConfigChange", result.tableConfig as DataTableConfig);
    } else {
      handleWidgetConfigChange({ ...(widget.config ?? {}), table: result.tableConfig });
    }
  }
  /** Toggle panel, seeding type defaults on first configure. */
  function toggleConfig() {
    if (!panelDescriptor.isConfigured(widget.config ?? {})) {
      handleWidgetConfigChange(panelDescriptor.initDefaults(fields));
      showConfig = true;
      return;
    }
    showConfig = !showConfig;
  }
  function handlePipelineSave(e: CustomEvent<TransformPipeline>) {
    patchWidget({ transform: e.detail });
    showPipeline = false;
  }
  function handleLinkedSelectionChange(e: CustomEvent<LinkedSelectionConfig | undefined>) {
    const cfg = { ...widget.config };
    if (e.detail !== undefined) cfg["linkedSelection"] = e.detail;
    else delete cfg["linkedSelection"];
    handleWidgetConfigChange(cfg);
  }
  function handleDbCallSourceChange(e: CustomEvent<WidgetSourceConfig>) {
    patchWidget({ sourceConfig: e.detail });
  }
</script>

<WidgetShell
  widgetId={widget.id}
  title={widget.title}
  widgetType={widget.type}
  {collapsed}
  {readonly}
  {renameSignal}
  on:toggleCollapse={() => patchWidget({ collapsed: !collapsed })}
  on:titleChange={(e) => patchWidget({ title: e.detail })}
>
  <svelte:fragment slot="actions">
    <WidgetHeaderActions
      {readonly}
      hasCog={panelDescriptor.hasCog && (panelEntry !== undefined || widget.type === "database-call")}
      hasPipeline={hasPipelineButton(widget.type)}
      pipelineStepCount={currentPipeline.steps.length}
      locked={widget.layout.locked ?? false}
      on:toggleConfig={toggleConfig}
      on:togglePipeline={() => (showPipeline = !showPipeline)}
      on:toggleLock={() => patchWidget({ layout: { ...widget.layout, locked: !(widget.layout.locked ?? false) } })}
      on:remove={() => dispatch("removeWidget", widget.id)}
      on:rename={() => (renameSignal += 1)}
    />
  </svelte:fragment>

  <svelte:fragment slot="panels">
    {#if showConfig && widget.type === "database-call"}
      <DatabaseCallSettings
        sourceConfig={dbCallSourceConfig}
        {availableSources}
        availableWidgets={availableWidgets.filter((w) => w.id !== widget.id)}
        linkedSelection={dbCallLinkedSelection}
        fields={dbCallFrame.fields}
        transform={currentPipeline}
        source={dbCallFrame}
        on:change={handleDbCallSourceChange}
        on:linkedSelectionChange={handleLinkedSelectionChange}
        on:transformChange={(e) => patchWidget({ transform: e.detail })}
        on:close={() => (showConfig = false)}
      />
    {:else if showConfig && panelEntry && panelRenderable}
      <svelte:component
        this={panelEntry.component}
        {...panelEntry.props(ctx)}
        on:change={(e) => handleWidgetConfigChange(e.detail)}
        on:close={() => (showConfig = false)}
      />
    {/if}
    {#if showPipeline}
      <PipelineEditor
        pipeline={currentPipeline}
        fields={frame.fields}
        source={frame}
        {availableSources}
        on:apply={(e) => patchWidget({ transform: e.detail })}
        on:save={handlePipelineSave}
      />
    {/if}
  </svelte:fragment>

  {#if contentEntry && contentRenderable}
    <svelte:component
      this={contentEntry.component}
      {...contentEntry.props(ctx)}
      on:configChange={handleContentConfigChange}
      on:change={(e) => handleWidgetConfigChange(e.detail)}
      on:filter
      on:fieldPresetsChange={(e) => dispatch("fieldPresetsChange", e.detail)}
    />
  {:else if contentEntry?.wizard}
    <WidgetSetupWizard
      icon={contentEntry.wizard.icon}
      message={$i18n.t(contentEntry.wizard.messageKey, { defaultValue: contentEntry.wizard.messageDefault })}
      on:configure={toggleConfig}
    />
  {:else if isRetiredLegacyType(widget.type)}
    <LegacyWidgetPlaceholder
      widgetType={widget.type}
      convertible={convertLegacyWidget(widget) !== null}
      {readonly}
      on:convert={() => { const patch = convertLegacyWidget(widget); if (patch) patchWidget(patch); }}
    />
  {:else}
    <div class="ppp-widget-placeholder">
      {$i18n.t("views.dashboard.widget.not-configured", { type: widget.type })}
    </div>
  {/if}
</WidgetShell>
