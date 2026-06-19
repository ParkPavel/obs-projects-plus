<script lang="ts">
  import type { DataField } from "src/lib/dataframe/dataframe";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import type { ChartConfig, ChartType, ChartStyle, ScatterChartConfig, ChartAxisX } from "../../types";
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let config: ChartConfig;
  export let fields: DataField[];
  /** Sibling projects available as correlation sources (scatter). */
  export let availableSources: Array<{ id: string; name: string }> = [];

  const dispatch = createEventDispatcher<{ change: ChartConfig }>();

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

  $: fieldNames = fields.map((f) => f.name);
  $: isScatter = config.chartType === "scatter";

  // #096.3 — granularity <select> is gated on the X-axis field being a Date.
  // Dispatch by DataFieldType (invariant #1), never by field name.
  $: xFieldIsDate =
    fields.find((f) => f.name === config.xAxis.property)?.type === DataFieldType.Date;

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

  function onHeightChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    updateStyle({ height: val as ChartStyle["height"] });
  }
</script>

<div class="ppp-chart-config">
  <details class="ppp-config-section" open>
    <summary class="ppp-config-section-header">{$i18n.t("views.dashboard.chart.section.data")}</summary>
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

  <label class="ppp-config-row">
    <span>{$i18n.t("views.dashboard.chart.x-axis")}</span>
    <select
      value={config.xAxis.property}
      on:change={(e) => emit({ xAxis: { ...config.xAxis, property: e.currentTarget.value } })}
    >
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
      on:change={(e) => emit({ yAxis: { ...config.yAxis, property: e.currentTarget.value } })}
    >
      <option value="count">{$i18n.t("views.dashboard.chart.aggregations.count")}</option>
      {#each fieldNames as name}
        <option value={name}>{name}</option>
      {/each}
    </select>
  </label>

  {#if config.yAxis.property !== "count"}
    <label class="ppp-config-row">
      <span>{$i18n.t("views.dashboard.chart.aggregation")}</span>
      <select
        value={config.yAxis.aggregation}
        on:change={onAggregationChange}
      >
        <option value="sum">{$i18n.t("views.dashboard.chart.aggregations.sum")}</option>
        <option value="avg">{$i18n.t("views.dashboard.chart.aggregations.average")}</option>
        <option value="min">{$i18n.t("views.dashboard.chart.aggregations.min")}</option>
        <option value="max">{$i18n.t("views.dashboard.chart.aggregations.max")}</option>
        <option value="median">{$i18n.t("views.dashboard.chart.aggregations.median")}</option>
        <option value="count_total">{$i18n.t("views.dashboard.chart.aggregations.count")}</option>
        <option value="count_unique">{$i18n.t("views.dashboard.chart.aggregations.unique")}</option>
      </select>
    </label>
  {/if}

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

  </details>

  <!-- Display options (collapsible) -->
  <details class="ppp-config-section" open>
    <summary class="ppp-config-section-header">{$i18n.t("views.dashboard.chart.section.display")}</summary>

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
      <span>{$i18n.t("views.dashboard.chart.options.legend")}</span>
    </label>

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
  </details>

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
        on:input={(e) => emitRaw({ pointRadius: parseInt(e.currentTarget.value) })}
      />
      <output class="ppp-range-value">{scatterPointRadius}</output>
    </label>

    <label class="ppp-config-row">
      <span>{$i18n.t("views.dashboard.chart.scatter.opacity")}</span>
      <input
        type="range" min="0.2" max="1.0" step="0.1"
        value={scatterOpacity}
        on:input={(e) => emitRaw({ opacity: parseFloat(e.currentTarget.value) })}
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

  .ppp-config-hint {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    font-style: italic;
    padding: 0.125rem 0;
  }
</style>
