<script lang="ts">
  import type { DataField } from "src/lib/dataframe/dataframe";
  import type { ChartConfig, ChartType, ChartStyle } from "../../types";
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let config: ChartConfig;
  export let fields: DataField[];

  const dispatch = createEventDispatcher<{ change: ChartConfig }>();

  const CHART_TYPES: { value: ChartType; labelKey: string }[] = [
    { value: "bar", labelKey: "views.database.chart.types.bar" },
    { value: "horizontal-bar", labelKey: "views.database.chart.types.horizontal-bar" },
    { value: "stacked-bar", labelKey: "views.database.chart.types.stacked-bar" },
    { value: "line", labelKey: "views.database.chart.types.line" },
    { value: "area", labelKey: "views.database.chart.types.area" },
    { value: "pie", labelKey: "views.database.chart.types.pie" },
    { value: "donut", labelKey: "views.database.chart.types.donut" },
    { value: "number", labelKey: "views.database.chart.types.number" },
    { value: "progress", labelKey: "views.database.chart.types.progress" },
    { value: "scatter", labelKey: "views.database.chart.types.scatter" },
  ];

  $: fieldNames = fields.map((f) => f.name);
  $: isScatter = config.chartType === "scatter";

  // Access extra scatter props from the config object
  $: raw = config as unknown as Record<string, unknown>;
  $: colorBy = (raw["colorBy"] as string) ?? "";
  $: sizeBy = (raw["sizeBy"] as string) ?? "";
  $: showTrendLine = (raw["showTrendLine"] as boolean) ?? true;
  $: showR2 = (raw["showR2"] as boolean) ?? true;
  $: scatterPointRadius = (raw["pointRadius"] as number) ?? 5;
  $: scatterOpacity = (raw["opacity"] as number) ?? 0.8;

  function emit(partial: Partial<ChartConfig>) {
    dispatch("change", { ...config, ...partial });
  }

  function emitRaw(partial: Record<string, unknown>) {
    dispatch("change", { ...config, ...partial } as ChartConfig);
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

  function onHeightChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    updateStyle({ height: val as ChartStyle["height"] });
  }
</script>

<div class="ppp-chart-config">
  <label class="ppp-config-row">
    <span>{$i18n.t("views.database.chart.type")}</span>
    <select
      value={config.chartType}
      on:change={onChartTypeChange}
    >
      {#each CHART_TYPES as ct}
        <option value={ct.value}>{$i18n.t(ct.labelKey)}</option>
      {/each}
    </select>
  </label>

  <label class="ppp-config-row">
    <span>{$i18n.t("views.database.chart.x-axis")}</span>
    <select
      value={config.xAxis.property}
      on:change={(e) => emit({ xAxis: { ...config.xAxis, property: e.currentTarget.value } })}
    >
      {#each fieldNames as name}
        <option value={name}>{name}</option>
      {/each}
    </select>
  </label>

  <label class="ppp-config-row">
    <span>{$i18n.t("views.database.chart.y-axis")}</span>
    <select
      value={config.yAxis.property}
      on:change={(e) => emit({ yAxis: { ...config.yAxis, property: e.currentTarget.value } })}
    >
      <option value="count">{$i18n.t("views.database.chart.aggregations.count")}</option>
      {#each fieldNames as name}
        <option value={name}>{name}</option>
      {/each}
    </select>
  </label>

  {#if config.yAxis.property !== "count"}
    <label class="ppp-config-row">
      <span>{$i18n.t("views.database.chart.aggregation")}</span>
      <select
        value={config.yAxis.aggregation}
        on:change={onAggregationChange}
      >
        <option value="sum">{$i18n.t("views.database.chart.aggregations.sum")}</option>
        <option value="avg">{$i18n.t("views.database.chart.aggregations.average")}</option>
        <option value="min">{$i18n.t("views.database.chart.aggregations.min")}</option>
        <option value="max">{$i18n.t("views.database.chart.aggregations.max")}</option>
        <option value="median">{$i18n.t("views.database.chart.aggregations.median")}</option>
        <option value="count">{$i18n.t("views.database.chart.aggregations.count")}</option>
        <option value="count_unique">{$i18n.t("views.database.chart.aggregations.unique")}</option>
      </select>
    </label>
  {/if}

  <label class="ppp-config-row">
    <span>{$i18n.t("views.database.chart.sort-by")}</span>
    <select
      value={config.xAxis.sortBy}
      on:change={onSortChange}
    >
      <option value="label">{$i18n.t("views.database.chart.sort.label")}</option>
      <option value="value">{$i18n.t("views.database.chart.sort.value")}</option>
      <option value="manual">{$i18n.t("views.database.chart.sort.manual")}</option>
    </select>
  </label>

  <label class="ppp-config-row">
    <span>{$i18n.t("views.database.chart.height")}</span>
    <select
      value={config.style.height}
      on:change={onHeightChange}
    >
      <option value="small">{$i18n.t("views.database.chart.heights.small")}</option>
      <option value="medium">{$i18n.t("views.database.chart.heights.medium")}</option>
      <option value="large">{$i18n.t("views.database.chart.heights.large")}</option>
    </select>
  </label>

  <!-- Display options (collapsible) -->
  <details class="ppp-config-section" open>
    <summary class="ppp-config-section-header">{$i18n.t("views.database.chart.section.display")}</summary>

    <label class="ppp-config-check">
      <input type="checkbox" checked={config.style.showGrid}
        on:change={(e) => updateStyle({ showGrid: e.currentTarget.checked })} />
      <span>{$i18n.t("views.database.chart.options.grid")}</span>
    </label>

    <label class="ppp-config-check">
      <input type="checkbox" checked={config.style.showLabels}
        on:change={(e) => updateStyle({ showLabels: e.currentTarget.checked })} />
      <span>{$i18n.t("views.database.chart.options.labels")}</span>
    </label>

    <label class="ppp-config-check">
      <input type="checkbox" checked={config.style.showValues}
        on:change={(e) => updateStyle({ showValues: e.currentTarget.checked })} />
      <span>{$i18n.t("views.database.chart.options.values")}</span>
    </label>

    <label class="ppp-config-check">
      <input type="checkbox" checked={config.style.showLegend}
        on:change={(e) => updateStyle({ showLegend: e.currentTarget.checked })} />
      <span>{$i18n.t("views.database.chart.options.legend")}</span>
    </label>

    <label class="ppp-config-check">
      <input type="checkbox" checked={config.xAxis.omitZero}
        on:change={(e) => emit({ xAxis: { ...config.xAxis, omitZero: e.currentTarget.checked } })} />
      <span>{$i18n.t("views.database.chart.options.hide-zero")}</span>
    </label>

    <label class="ppp-config-check">
      <input type="checkbox" checked={!!config.yAxis.cumulative}
        on:change={(e) => emit({ yAxis: { ...config.yAxis, cumulative: e.currentTarget.checked } })} />
      <span>{$i18n.t("views.database.chart.options.cumulative")}</span>
    </label>
  </details>

  <!-- Scatter-specific options -->
  {#if isScatter}
    <div class="ppp-config-divider"></div>

    <label class="ppp-config-row">
      <span>{$i18n.t("views.database.chart.scatter.color-by")}</span>
      <select
        value={colorBy}
        on:change={(e) => emitRaw({ colorBy: e.currentTarget.value || undefined })}
      >
        <option value="">{$i18n.t("views.database.chart.scatter.none")}</option>
        {#each fieldNames as name}
          <option value={name}>{name}</option>
        {/each}
      </select>
    </label>

    <label class="ppp-config-row">
      <span>{$i18n.t("views.database.chart.scatter.size-by")}</span>
      <select
        value={sizeBy}
        on:change={(e) => emitRaw({ sizeBy: e.currentTarget.value || undefined })}
      >
        <option value="">{$i18n.t("views.database.chart.scatter.none")}</option>
        {#each fieldNames as name}
          <option value={name}>{name}</option>
        {/each}
      </select>
    </label>

    <label class="ppp-config-check">
      <input type="checkbox" checked={showTrendLine}
        on:change={(e) => emitRaw({ showTrendLine: e.currentTarget.checked })} />
      <span>{$i18n.t("views.database.chart.scatter.trend-line")}</span>
    </label>

    <label class="ppp-config-check">
      <input type="checkbox" checked={showR2}
        on:change={(e) => emitRaw({ showR2: e.currentTarget.checked })} />
      <span>{$i18n.t("views.database.chart.scatter.r-squared")}</span>
    </label>

    <label class="ppp-config-row">
      <span>{$i18n.t("views.database.chart.scatter.point-size")}</span>
      <input
        type="range" min="2" max="10" step="1"
        value={scatterPointRadius}
        on:input={(e) => emitRaw({ pointRadius: parseInt(e.currentTarget.value) })}
      />
    </label>

    <label class="ppp-config-row">
      <span>{$i18n.t("views.database.chart.scatter.opacity")}</span>
      <input
        type="range" min="0.2" max="1.0" step="0.1"
        value={scatterOpacity}
        on:input={(e) => emitRaw({ opacity: parseFloat(e.currentTarget.value) })}
      />
    </label>
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

  .ppp-config-row select {
    flex: 1;
    min-width: 0;
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
    height: 1px;
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
</style>
