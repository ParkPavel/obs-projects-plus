<script lang="ts">
  /**
   * WidgetHost — #067 F1 (UT2026-F): thin router.
   *
   * Assembles a reactive WidgetRenderContext, looks the widget type up in
   * widgetComponentRegistry, and mounts the result inside WidgetShell.
   * Frame math (enrichment, axis A, pipeline, per-widget source) is computed
   * by hostFrames.ts and only wired here; markup/chrome lives in WidgetShell /
   * WidgetHeaderActions; type-specific knowledge lives in the registry.
   */
  import type { DataFrame, DataRecord, DataField } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { WidgetDefinition, WidgetSourceConfig, LinkedSelectionConfig, DataTableConfig, FieldPreset } from "../types";
  import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";

  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { computeHostFrames } from "./hostFrames";
  import { frameParts } from "src/lib/stores/dataframe";
  import { getConfigPanel } from "./configPanelRegistry";
  import { WIDGET_CONTENT, WIDGET_PANELS } from "./widgetComponentRegistry";
  import { hasPipelineButton, primaryActionFor } from "./headerChrome";
  import { buildRenderContext } from "./renderContext";
  import { convertLegacyWidget, isRetiredLegacyType, dataTableConfigChange } from "./legacyMigration";
  import WidgetShell from "./WidgetShell.svelte";
  import WidgetHeaderActions from "./WidgetHeaderActions.svelte";
  import WidgetPrimaryAction from "./WidgetPrimaryAction.svelte";
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
  export let sourceStates: ReadonlyMap<string, import("../dashboardPreload").ExternalSourceState> = new Map();
  export let project: import("src/settings/settings").ProjectDefinition | undefined = undefined;
  /** Multi-DataTable: primary widget round-trips the root `config.table`. */
  export let isPrimaryDataTable: boolean = true;

  const dispatch = createEventDispatcher<{
    configChange: { id: string; changes: Partial<WidgetDefinition> };
    tableConfigChange: DataTableConfig;
    fieldPresetsChange: { fieldPresets: FieldPreset[]; activeFieldPresetId: string | undefined };
    removeWidget: string;
  }>();

  let showConfig = false, showPipeline = false, renameSignal = 0, primaryActionSignal = 0;

  $: collapsed = widget.collapsed ?? false;
  $: currentPipeline = widget.transform ?? ({ steps: [] } as TransformPipeline);
  $: panelDescriptor = getConfigPanel(widget.type);

  // ── Frame math ─ all of it, in one pure function (see hostFrames.ts) ──
  // #184: every source the project declares, primary first — the block may name one.
  $: projectSources = project ? [project.dataSource, ...(project.additionalSources ?? [])] : [];
  $: frames = computeHostFrames({ widget, frame, fields, pipeline: currentPipeline, rightFrames,
        sourceStates, parts: $frameParts, sources: projectSources });
  $: ({ namedSource, scope, transformedFrame, pipelineInputRowCount, chartConfig, statsConfig,
        chartRightFrame, dbCall, pipelineSource } = frames);

  $: ctx = buildRenderContext({
    widget, frame, transformedFrame, api, readonly, getRecordColor, fields, fieldPresets,
    activeFieldPresetId, availableSources, project, tableConfig, isPrimaryDataTable,
    pipelineStepCount: currentPipeline.steps.length, pipelineInputRowCount, chartConfig,
    statsConfig, chartRightFrame, dbCall, scopeApplied: scope.applied, primaryActionSignal,
    namedSource,
  });

  // #169: the block's own action, and NOT run here. Hidden while the block
  // reads a linked project, where a write would land in the wrong vault (#139).
  $: primaryAction = readonly || dbCall.isExternal ? null : primaryActionFor(widget.type);

  function handlePrimaryAction() {
    // Expand FIRST: a collapsed widget renders its header but not the content
    // that owns the action. Order pinned by A169_widgetWeight.
    if (collapsed) patchWidget({ collapsed: false });
    primaryActionSignal += 1;
  }

  $: contentEntry = WIDGET_CONTENT[widget.type];
  $: panelEntry = WIDGET_PANELS[widget.type];
  $: contentRenderable = contentEntry ? (contentEntry.canRender?.(ctx) ?? true) : false;
  $: panelRenderable = (widget.type !== "chart" || chartConfig !== null) && (widget.type !== "stats" || statsConfig !== null);

  function patchWidget(changes: Partial<WidgetDefinition>) {
    dispatch("configChange", { id: widget.id, changes });
  }
  function handleWidgetConfigChange(newConfig: Record<string, unknown>) {
    patchWidget({ config: newConfig });
  }
  function handleContentConfigChange(e: CustomEvent<unknown>) {
    const detail = e.detail as Record<string, unknown>;
    if (widget.type !== "data-table") { handleWidgetConfigChange(detail); return; }
    const change = dataTableConfigChange(detail, widget.config, isPrimaryDataTable);
    if (change.kind === "convert") patchWidget({ type: "database-call", config: change.config });
    else if (change.kind === "table") {
      dispatch("tableConfigChange", change.tableConfig as DataTableConfig);
      patchWidget({ config: change.widgetConfig });
    } else handleWidgetConfigChange(change.widgetConfig);
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
  on:toggleCollapse={() => { primaryActionSignal = 0; patchWidget({ collapsed: !collapsed }); }}
  on:titleChange={(e) => patchWidget({ title: e.detail })}
>
  <svelte:fragment slot="actions">
    <WidgetPrimaryAction action={primaryAction} on:primaryAction={handlePrimaryAction} />
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
        sourceConfig={dbCall.sourceConfig}
        {availableSources}
        availableWidgets={availableWidgets.filter((w) => w.id !== widget.id)}
        linkedSelection={dbCall.linkedSelection}
        linkedSelectionValidation={ctx.dbCallLinkedSelectionValidation}
        fields={dbCall.frame.fields}
        on:change={handleDbCallSourceChange}
        on:linkedSelectionChange={handleLinkedSelectionChange}
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
        fields={pipelineSource.fields}
        source={pipelineSource}
        {rightFrames}
        sourceState={dbCall.source}
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
      on:openPipeline={() => (showPipeline = true)}
      on:clearPipeline={() => patchWidget({ transform: { steps: [] } })}
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
