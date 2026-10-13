<script lang="ts">
  import DataProjectPicker from "../_shared/DataProjectPicker.svelte";
  import ChartSeriesEditor from "./ChartSeriesEditor.svelte";
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { ChartSeriesConfig, LinkedSelectionConfig } from "../../types";
  import FollowSelectionPicker from "../_shared/FollowSelectionPicker.svelte";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import type { ChartConfig, ChartType, ChartStyle, ScatterChartConfig, ChartAxisX } from "../../types";
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { resuggestChart } from "./chartSuggest";
  import { i18n } from "src/lib/stores/i18n";
  import { isRelationCompanionField } from "src/lib/engine/crossProjectResolver";
  import { chartAggregations, chartYAxis } from "./chartAggregations";
  import { aggregationLabel, aggregationConsequence } from "src/lib/dashboard-engine/aggregationOptions";

  export let config: ChartConfig;
  export let fields: DataField[];
  /** Sibling projects available as correlation sources (scatter). */
  export let availableSources: Array<{ id: string; name: string }> = [];
  /** 3.6.0: loaded frames of the projects the extra series read. */
  export let seriesFrames: ReadonlyMap<string, DataFrame> = new Map();
  /** 3.6.0: blocks whose selection this chart may follow. */
  export let availableWidgets: Array<{ id: string; title: string }> = [];

  const dispatch = createEventDispatcher<{ change: ChartConfig }>();

  /** 3.7.2 B6: the source's records, for "Re-pick from data" (fields alone otherwise). */
  export let records: readonly DataRecord[] = [];

  // 3.7.2 B6 — two tabs as in Google Sheets. View state only: never written to the config.
  let tab: "setup" | "customize" = "setup";

  const TYPE_ICONS: Record<ChartType, string> = {
    bar: "bar-chart-2",
    "horizontal-bar": "bar-chart-horizontal",
    "stacked-bar": "bar-chart-big",
    line: "line-chart",
    area: "area-chart",
    pie: "pie-chart",
    donut: "circle-dot",
    number: "hash",
    progress: "gauge",
    scatter: "scatter-chart",
  };

  const COLOR_SCHEMES: ChartStyle["colorScheme"][] = ["auto", "accent", "categorical", "sequential"];

  function onColorSchemeChange(e: Event) {
    updateStyle({ colorScheme: (e.target as HTMLSelectElement).value as ChartStyle["colorScheme"] });
  }

  function repick() {
    dispatch("change", resuggestChart(config, fields, records));
  }

  /** The caption is removed, not stored empty, when cleared. */
  function setTitle(value: string) {
    const next = value.trim();
    if (next === (config.title ?? "")) return;
    const { title: _drop, ...rest } = config;
    void _drop;
    dispatch("change", next ? { ...rest, title: next } : rest);
  }

  const CHART_TYPES: { value: ChartType; labelKey: string }[] = [
    { value: "bar", labelKey: "views.dashboard.chart.types.bar" },
    { value: "horizontal-bar", labelKey: "views.dashboard.chart.types.horizontal-bar" },
    { value: "stacked-bar", labelKey: "views.dashboard.chart.types.stacked-bar" },
    { value: "line", labelKey: "views.dashboard.chart.types.line" },
    { value: "area", labelKey: "views.dashboard.chart.types.area" },
    { value: "pie", labelKey: "views.dashboard.chart.types.pie" },
    { value: "donut", labelKey: "views.dashboard.chart.types.donut" },
    { value: "number", labelKey: "views.dashboard.chart.types.number" },
    { value: "progress", labelKey: "views.dashboard.chart.types.progress" },
    { value: "scatter", labelKey: "views.dashboard.chart.types.scatter" },
  ];

  // The engine's `__resolved__` relation companions (crossProjectResolver.ts)
  // are pipeline plumbing, not something a user picks an axis by.
  $: fieldNames = fields
    .filter((f) => !isRelationCompanionField(f.name))
    .map((f) => f.name);
  $: isScatter = config.chartType === "scatter";
  $: yAggregations = chartAggregations(fields.find(f => f.name === config.yAxis.property));
  $: unsupportedAggregation = !isScatter && config.yAxis.property !== "count" && !yAggregations.includes(config.yAxis.aggregation);
  $: tr = (key: string, defaultValue: string) => $i18n.t(key, { defaultValue });

  // #096.3 — granularity <select> is gated on the X-axis field being a Date.
  // Dispatch by DataFieldType (invariant #1), never by field name.
  $: xFieldIsDate =
    fields.find((f) => f.name === config.xAxis.property)?.type === DataFieldType.Date;

  // #107 — Status-grouping toggle is gated on the X field carrying non-empty
  // statusGroups so UI visibility mirrors the engine's hasAnyBucket activation.
  $: xFieldHasStatusGroups = (() => {
    const sg = fields.find((f) => f.name === config.xAxis.property)?.typeConfig?.statusGroups;
    return !!(sg && ((sg.todo?.length ?? 0) + (sg.inProgress?.length ?? 0) + (sg.complete?.length ?? 0)) > 0);
  })();

  const GRANULARITIES: NonNullable<ChartAxisX["dateGranularity"]>[] = [
    "day",
    "week",
    "month",
    "quarter",
    "year",
  ];

  function onGranularityChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value as NonNullable<ChartAxisX["dateGranularity"]>;
    emit({ xAxis: { ...config.xAxis, dateGranularity: val } });
  }

  // Access extra scatter props from the config object
  $: raw = config as unknown as Record<string, unknown>;
  $: colorBy = (raw["colorBy"] as string) ?? "";
  $: sizeBy = (raw["sizeBy"] as string) ?? "";
  $: showTrendLine = (raw["showTrendLine"] as boolean) ?? true;
  $: showR2 = (raw["showR2"] as boolean) ?? true;
  $: scatterPointRadius = (raw["pointRadius"] as number) ?? 5;
  $: scatterOpacity = (raw["opacity"] as number) ?? 0.8;
  $: correlation = (raw["correlation"] as ScatterChartConfig["correlation"]) ?? undefined;

  function emit(partial: Partial<ChartConfig>) {
    dispatch("change", { ...config, ...partial });
  }

  function emitRaw(partial: Record<string, unknown>) {
    dispatch("change", { ...config, ...partial } as ChartConfig);
  }

  $: dataProjectId = (config as unknown as { dataProjectId?: string }).dataProjectId;

  /** 3.6.0 — follow another block's selection; the key is removed when off. */
  function setLinkedSelection(next: LinkedSelectionConfig | undefined) {
    const { linkedSelection: _drop, ...rest } = config as unknown as Record<string, unknown>;
    void _drop;
    dispatch("change", (next ? { ...rest, linkedSelection: next } : rest) as unknown as ChartConfig);
  }

  /** 3.6.0 — the extra series; the key is removed when there are none. */
  function setSeries(next: ChartSeriesConfig[]) {
    const { series: _drop, ...rest } = config as unknown as Record<string, unknown>;
    void _drop;
    dispatch("change", (next.length > 0 ? { ...rest, series: next } : rest) as unknown as ChartConfig);
  }

  /** 3.6.0 — read another project; the empty value reads this one (key removed). */
  function setDataProject(id: string) {
    const { dataProjectId: _drop, ...rest } = config as unknown as Record<string, unknown>;
    void _drop;
    dispatch("change", (id ? { ...rest, dataProjectId: id } : rest) as unknown as ChartConfig);
  }

  function setCorrelationEnabled(enabled: boolean) {
    if (!enabled) {
      // Strip the key rather than set undefined (exactOptionalPropertyTypes).
      const { correlation: _, ...rest } = config as unknown as Record<string, unknown>;
      dispatch("change", rest as unknown as ChartConfig);
      return;
    }
    const first = availableSources[0];
    emitRaw({
      correlation: {
        rightSourceId: first?.id ?? "",
        on: { leftKey: fields[0]?.name ?? "", rightKey: "" },
      },
    });
  }

  function updateCorrelation(partial: Partial<NonNullable<ScatterChartConfig["correlation"]>>) {
    if (!correlation) return;
    emitRaw({
      correlation: {
        ...correlation,
        ...partial,
        on: { ...correlation.on, ...(partial.on ?? {}) },
      },
    });
  }

  function updateStyle(partial: Partial<ChartStyle>) {
    emit({ style: { ...config.style, ...partial } });
  }

  function onChartTypeChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    emit({ chartType: val as ChartType });
  }

  function onAggregationChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    emit({ yAxis: { ...config.yAxis, aggregation: val as ChartConfig["yAxis"]["aggregation"] } });
  }

  function onSortChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    emit({ xAxis: { ...config.xAxis, sortBy: val as "value" | "label" | "manual" } });
  }

  function onGroupModeChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value as "values" | "semantic";
    emit({ groupMode: val });
  }

  function onHeightChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    updateStyle({ height: val as ChartStyle["height"] });
  }
</script>

<div class="ppp-chart-config">
  <div class="ppp-chart-config-tabs" role="tablist">
    <button type="button" role="tab" class="ppp-chart-config-tab" class:is-active={tab === "setup"}
      aria-selected={tab === "setup"} on:click={() => (tab = "setup")}
    >{tr("views.dashboard.chart.tabs.setup", "Setup")}</button>
    <button type="button" role="tab" class="ppp-chart-config-tab" class:is-active={tab === "customize"}
      aria-selected={tab === "customize"} on:click={() => (tab = "customize")}
    >{tr("views.dashboard.chart.tabs.customize", "Customize")}</button>
  </div>

  {#if tab === "setup"}
  <div class="ppp-chart-config-panel" role="tabpanel">
  <div class="ppp-chart-type-grid" role="radiogroup" aria-label={$i18n.t("views.dashboard.chart.type")}>
    {#each CHART_TYPES as ct (ct.value)}
      <button type="button" role="radio" class="ppp-chart-type-btn" class:is-active={config.chartType === ct.value}
        aria-checked={config.chartType === ct.value} aria-label={$i18n.t(ct.labelKey)} title={$i18n.t(ct.labelKey)}
        on:click={() => { if (config.chartType !== ct.value) emit({ chartType: ct.value }); }}
      ><Icon name={TYPE_ICONS[ct.value]} /></button>
    {/each}
  </div>

  <label class="ppp-config-row">
    <span>{$i18n.t("views.dashboard.chart.type")}</span>
    <select
      value={config.chartType}
      on:change={onChartTypeChange}
    >
      {#each CHART_TYPES as ct}
        <option value={ct.value}>{$i18n.t(ct.labelKey)}</option>
      {/each}
    </select>
  </label>

  <div class="ppp-chart-repick">
    <button type="button" class="ppp-chart-repick-btn" on:click={repick}>{tr("views.dashboard.chart.repick", "Re-pick from data")}</button>
    <span class="ppp-config-hint">{tr("views.dashboard.chart.repick-hint", "Type and axes are chosen from the source's fields.")}</span>
  </div>

  <DataProjectPicker
    value={dataProjectId}
    {availableSources}
    on:change={(e) => setDataProject(e.detail)}
  />

  <label class="ppp-config-row">
    <span>{$i18n.t("views.dashboard.chart.x-axis")}</span>
    <select
      value={config.xAxis.property}
      on:change={(e) => emit({ xAxis: { ...config.xAxis, property: e.currentTarget.value } })}
    >
      {#if config.chartType === "number" || !config.xAxis.property}
        <option value="">{tr("views.dashboard.chart.x-none", "All records (one total)")}</option>
      {/if}
      {#each fieldNames as name}
        <option value={name}>{name}</option>
      {/each}
    </select>
  </label>

  {#if xFieldIsDate}
    <label class="ppp-config-row">
      <span>{$i18n.t("views.dashboard.chart.granularity")}</span>
      <select
        value={config.xAxis.dateGranularity ?? "month"}
        on:change={onGranularityChange}
      >
        {#each GRANULARITIES as g}
          <option value={g}>{$i18n.t(`views.dashboard.chart.granularities.${g}`)}</option>
        {/each}
      </select>
    </label>
  {/if}

  <label class="ppp-config-row">
    <span>{$i18n.t("views.dashboard.chart.y-axis")}</span>
    <select
      value={config.yAxis.property}
      on:change={(e) => emit({ yAxis: chartYAxis(config, e.currentTarget.value, fields) })}
    >
      <option value="count">{aggregationLabel("count_total", tr)}</option>
      {#each fieldNames as name}
        <option value={name}>{name}</option>
      {/each}
    </select>
  </label>

  {#if !isScatter && config.yAxis.property !== "count"}
    <label class="ppp-config-row">
      <span>{$i18n.t("views.dashboard.chart.aggregation")}</span>
      <select
        value={config.yAxis.aggregation}
        on:change={onAggregationChange}
      >
        {#if unsupportedAggregation}<option value={config.yAxis.aggregation} disabled>{aggregationLabel(config.yAxis.aggregation, tr)}</option>{/if}
        {#each yAggregations as aggregation}
          <option value={aggregation} title={aggregationConsequence(aggregation, tr)}>{aggregationLabel(aggregation, tr)}</option>
        {/each}
      </select>
    </label>
  {/if}

  {#if !isScatter}<p class="ppp-config-hint ppp-chart-aggregation-hint" role={unsupportedAggregation ? "alert" : "note"}>
    {#if unsupportedAggregation}{$i18n.t("views.dashboard.chart.unsupported-aggregation", { defaultValue: "This aggregation is not supported for the selected field. Choose a compatible operation." })}
    {:else}{aggregationConsequence(config.yAxis.property === "count" ? "count_total" : config.yAxis.aggregation, tr)}{/if}
  </p>{/if}

  <label class="ppp-config-row">
    <span>{$i18n.t("views.dashboard.chart.sort-by")}</span>
    <select
      value={config.xAxis.sortBy}
      on:change={onSortChange}
    >
      <option value="label">{$i18n.t("views.dashboard.chart.sort.label")}</option>
      <option value="value">{$i18n.t("views.dashboard.chart.sort.value")}</option>
      <option value="manual">{$i18n.t("views.dashboard.chart.sort.manual")}</option>
    </select>
  </label>

  {#if xFieldHasStatusGroups}
    <label class="ppp-config-row">
      <span>{$i18n.t("views.dashboard.chart.group-mode.label", { defaultValue: "Status grouping" })}</span>
      <select value={config.groupMode ?? "values"} on:change={onGroupModeChange}>
        <option value="values">{$i18n.t("views.dashboard.chart.group-mode.values", { defaultValue: "Values" })}</option>
        <option value="semantic">{$i18n.t("views.dashboard.chart.group-mode.semantic", { defaultValue: "Semantic groups" })}</option>
      </select>
    </label>
  {/if}

  <label class="ppp-config-check">
    <input type="checkbox" checked={config.xAxis.omitZero}
      on:change={(e) => emit({ xAxis: { ...config.xAxis, omitZero: e.currentTarget.checked } })} />
    <span>{$i18n.t("views.dashboard.chart.options.hide-zero")}</span>
  </label>

  <label class="ppp-config-check">
    <input type="checkbox" checked={!!config.yAxis.cumulative}
      on:change={(e) => emit({ yAxis: { ...config.yAxis, cumulative: e.currentTarget.checked } })} />
    <span>{$i18n.t("views.dashboard.chart.options.cumulative")}</span>
  </label>

  <FollowSelectionPicker
    value={config.linkedSelection}
    {availableWidgets}
    {fields}
    on:change={(e) => setLinkedSelection(e.detail)}
  />

  {#if config.chartType === "line" || config.chartType === "area" || config.chartType === "bar"}
    <ChartSeriesEditor
      following={!!config.linkedSelection}
      series={config.series ?? []}
      {fields}
      {availableSources}
      {seriesFrames}
      on:change={(e) => setSeries(e.detail)}
    />
  {/if}

  <!-- Scatter-specific options -->
  {#if isScatter}
    <details class="ppp-config-section">
      <summary class="ppp-config-section-header">{$i18n.t("views.dashboard.chart.section.scatter")}</summary>
    <div class="ppp-config-divider"></div>

    <label class="ppp-config-row">
      <span>{$i18n.t("views.dashboard.chart.scatter.color-by")}</span>
      <select
        value={colorBy}
        on:change={(e) => emitRaw({ colorBy: e.currentTarget.value || undefined })}
      >
        <option value="">{$i18n.t("views.dashboard.chart.scatter.none")}</option>
        {#each fieldNames as name}
          <option value={name}>{name}</option>
        {/each}
      </select>
    </label>

    <label class="ppp-config-row">
      <span>{$i18n.t("views.dashboard.chart.scatter.size-by")}</span>
      <select
        value={sizeBy}
        on:change={(e) => emitRaw({ sizeBy: e.currentTarget.value || undefined })}
      >
        <option value="">{$i18n.t("views.dashboard.chart.scatter.none")}</option>
        {#each fieldNames as name}
          <option value={name}>{name}</option>
        {/each}
      </select>
    </label>

    <label class="ppp-config-check">
      <input type="checkbox" checked={showTrendLine}
        on:change={(e) => emitRaw({ showTrendLine: e.currentTarget.checked })} />
      <span>{$i18n.t("views.dashboard.chart.scatter.trend-line")}</span>
    </label>

    <label class="ppp-config-check">
      <input type="checkbox" checked={showR2}
        on:change={(e) => emitRaw({ showR2: e.currentTarget.checked })} />
      <span>{$i18n.t("views.dashboard.chart.scatter.r-squared")}</span>
    </label>

    <label class="ppp-config-row">
      <span>{$i18n.t("views.dashboard.chart.scatter.point-size")}</span>
      <input
        type="range" min="2" max="10" step="1"
        value={scatterPointRadius}
        on:input={(e) => emitRaw({ pointRadius: /* coercion-exempt: a range control's own value, bounded by min/max/step above — a widget setting, not record data */ parseInt(e.currentTarget.value) })}
      />
      <output class="ppp-range-value">{scatterPointRadius}</output>
    </label>

    <label class="ppp-config-row">
      <span>{$i18n.t("views.dashboard.chart.scatter.opacity")}</span>
      <input
        type="range" min="0.2" max="1.0" step="0.1"
        value={scatterOpacity}
        on:input={(e) => emitRaw({ opacity: /* coercion-exempt: a range control's own value, bounded by min/max/step above — a widget setting, not record data */ parseFloat(e.currentTarget.value) })}
      />
      <output class="ppp-range-value">{scatterOpacity.toFixed(1)}</output>
    </label>

    <!-- Pillar 5: cross-source correlation (Phase 5 UI) -->
    <div class="ppp-config-divider"></div>
    <label class="ppp-config-check">
      <input
        type="checkbox"
        checked={!!correlation}
        on:change={(e) => setCorrelationEnabled(e.currentTarget.checked)}
        aria-describedby={availableSources.length === 0 ? "ppp-scatter-no-sources-hint" : undefined}
      />
      <span>{$i18n.t("views.dashboard.chart.scatter.correlate-enable", { defaultValue: "Correlate with another source" })}</span>
    </label>

    {#if correlation}
      {#if availableSources.length === 0}
        <div
          class="ppp-config-hint"
          id="ppp-scatter-no-sources-hint"
          role="note"
        >
          {$i18n.t("views.dashboard.chart.scatter.no-sources", { defaultValue: "No sibling projects found in this vault." })}
        </div>
      {:else}
        <div class="ppp-config-hint" role="note">
          {$i18n.t("views.dashboard.chart.scatter.correlate-hint", {
            defaultValue: "X comes from this widget's source; Y comes from the selected right source, matched by join key.",
          })}
        </div>
        <label class="ppp-config-row">
          <span>{$i18n.t("views.dashboard.chart.scatter.right-source", { defaultValue: "Right source (Y)" })}</span>
          <select
            value={correlation.rightSourceId}
            on:change={(e) => updateCorrelation({ rightSourceId: e.currentTarget.value })}
          >
            {#each availableSources as src (src.id)}
              <option value={src.id}>{src.name}</option>
            {/each}
          </select>
        </label>

        <label class="ppp-config-row">
          <span>{$i18n.t("views.dashboard.chart.scatter.left-key", { defaultValue: "Left join key (this source)" })}</span>
          <select
            value={correlation.on.leftKey}
            on:change={(e) => updateCorrelation({ on: { leftKey: e.currentTarget.value, rightKey: correlation.on.rightKey } })}
          >
            {#each fieldNames as name (name)}
              <option value={name}>{name}</option>
            {/each}
          </select>
        </label>

        <label class="ppp-config-row">
          <span>{$i18n.t("views.dashboard.chart.scatter.right-key", { defaultValue: "Right join key (right source)" })}</span>
          <input
            type="text"
            value={correlation.on.rightKey}
            placeholder={$i18n.t("views.dashboard.chart.scatter.right-key-placeholder", { defaultValue: "field name in right source" })}
            on:input={(e) => updateCorrelation({ on: { leftKey: correlation.on.leftKey, rightKey: e.currentTarget.value } })}
          />
        </label>
      {/if}
    {/if}
    </details>
  {/if}
  </div>
  {:else}
  <div class="ppp-chart-config-panel" role="tabpanel">
  <div class="ppp-config-row">
    <span>{tr("views.dashboard.chart.title", "Chart title")}</span>
    <TextField
      value={config.title ?? ""}
      placeholder={tr("views.dashboard.chart.title-placeholder", "No title")}
      ariaLabel={tr("views.dashboard.chart.title", "Chart title")}
      on:commit={(e) => setTitle(e.detail.value)}
    />
  </div>

  <label class="ppp-config-row">
    <span>{tr("views.dashboard.chart.colors", "Colours")}</span>
    <select value={config.style.colorScheme} on:change={onColorSchemeChange}>
      {#each COLOR_SCHEMES as scheme}
        <option value={scheme}>{tr(`views.dashboard.chart.color-schemes.${scheme}`, scheme)}</option>
      {/each}
    </select>
  </label>

  <label class="ppp-config-row">
    <span>{$i18n.t("views.dashboard.chart.height")}</span>
    <select
      value={config.style.height}
      on:change={onHeightChange}
    >
      <option value="small">{$i18n.t("views.dashboard.chart.heights.small")}</option>
      <option value="medium">{$i18n.t("views.dashboard.chart.heights.medium")}</option>
      <option value="large">{$i18n.t("views.dashboard.chart.heights.large")}</option>
    </select>
  </label>

  <label class="ppp-config-check">
    <input type="checkbox" checked={config.style.showGrid}
      on:change={(e) => updateStyle({ showGrid: e.currentTarget.checked })} />
    <span>{$i18n.t("views.dashboard.chart.options.grid")}</span>
  </label>

  <label class="ppp-config-check">
    <input type="checkbox" checked={config.style.showLabels}
      on:change={(e) => updateStyle({ showLabels: e.currentTarget.checked })} />
    <span>{$i18n.t("views.dashboard.chart.options.labels")}</span>
  </label>

  <label class="ppp-config-check">
    <input type="checkbox" checked={config.style.showValues}
      on:change={(e) => updateStyle({ showValues: e.currentTarget.checked })} />
    <span>{$i18n.t("views.dashboard.chart.options.values")}</span>
  </label>

  <label class="ppp-config-check">
    <input type="checkbox" checked={config.style.showLegend}
      on:change={(e) => updateStyle({ showLegend: e.currentTarget.checked })} />
    <span>{tr("views.dashboard.chart.options.legend", "Legend")}</span>
  </label>
  </div>
  {/if}
</div>

<style>
  .ppp-chart-config {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.5rem;
    font-size: var(--font-ui-small);
  }

  .ppp-config-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .ppp-config-row span {
    color: var(--text-muted);
    flex-shrink: 0;
    min-width: 5rem;
  }

  .ppp-config-row select,
  .ppp-config-row input[type="range"] {
    flex: 1;
    min-width: 0;
  }

  .ppp-range-value {
    flex-shrink: 0;
    min-width: 2rem;
    text-align: right;
    color: var(--text-normal);
    font-variant-numeric: tabular-nums;
  }

  .ppp-config-check {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    cursor: pointer;
  }

  .ppp-config-check span {
    color: var(--text-muted);
  }

  .ppp-config-divider {
    height: var(--ppp-border-width);
    background: var(--background-modifier-border);
    margin: 0.25rem 0;
  }

  .ppp-config-section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .ppp-config-section-header {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    padding: 0.125rem 0;
  }

  .ppp-config-hint {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    font-style: italic;
    padding: 0.125rem 0;
  }

  /* 3.7.2 B6 — Setup / Customize tabs, as in Google Sheets. */
  .ppp-chart-config-tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: var(--ppp-border-width) solid var(--background-modifier-border);
  }

  .ppp-chart-config-tab {
    flex: 1;
    background: none;
    box-shadow: none;
    border: none;
    border-bottom: 0.125rem solid transparent;
    border-radius: 0;
    color: var(--text-muted);
    padding: 0.375rem 0.5rem;
    cursor: pointer;
  }

  .ppp-chart-config-tab.is-active {
    color: var(--text-normal);
    border-bottom-color: var(--interactive-accent);
    font-weight: 600;
  }

  .ppp-chart-config-panel {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .ppp-chart-type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(2.25rem, 1fr));
    gap: 0.25rem;
  }

  .ppp-chart-type-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2.25rem;
    padding: 0.25rem;
    border: var(--ppp-border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    color: var(--text-muted);
    cursor: pointer;
  }

  .ppp-chart-type-btn.is-active {
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    background: color-mix(in srgb, var(--interactive-accent) 10%, var(--background-primary));
  }

  .ppp-chart-repick {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }

  .ppp-chart-repick-btn {
    cursor: pointer;
  }

  .ppp-config-row :global(input) {
    flex: 1;
    min-width: 0;
  }
</style>
