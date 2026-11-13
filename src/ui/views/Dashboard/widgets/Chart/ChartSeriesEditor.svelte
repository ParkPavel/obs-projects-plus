<script lang="ts">
  /**
   * ChartSeriesEditor — the extra lines of a chart (3.6.0, ChartConfig.series).
   *
   * Each series names its field and aggregation, optionally another project
   * and the x field there, and the axis it is read against — weight on the
   * left and training minutes on the right, or the massage room's income next
   * to the studio's payments. A project's fields are offered once its frame
   * has loaded; until then the field is typed.
   */
  import { createEventDispatcher } from "svelte";
  import type { DataField, DataFrame } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import type { ChartSeriesConfig } from "../../types";
  import { chartAggregations, chartYAxis } from "./chartAggregations";
  import { aggregationLabel, aggregationConsequence } from "src/lib/dashboard-engine/aggregationOptions";
  import { isRelationCompanionField } from "src/lib/engine/crossProjectResolver";

  export let series: readonly ChartSeriesConfig[] = [];
  /** The fields of this chart's own input. */
  export let fields: DataField[] = [];
  export let availableSources: Array<{ id: string; name: string }> = [];
  /** Loaded frames of other projects, by id. */
  export let seriesFrames: ReadonlyMap<string, DataFrame> = new Map();
  /** True when the chart follows another block's selection: each series names its relation field. */
  export let following = false;

  const dispatch = createEventDispatcher<{ change: ChartSeriesConfig[] }>();

  $: tr = (key: string, defaultValue: string) => $i18n.t(key, { defaultValue });

  function fieldsOf(s: ChartSeriesConfig, local = fields, frames = seriesFrames): DataField[] {
    const frame = s.dataProjectId ? frames.get(s.dataProjectId) : undefined;
    return (s.dataProjectId ? frame?.fields ?? [] : local).filter(f => !isRelationCompanionField(f.name));
  }

  function update(index: number, patch: Partial<ChartSeriesConfig>) {
    const next = series.map((s, i) => {
      if (i !== index) return s;
      const merged: Record<string, unknown> = { ...s, ...patch };
      const candidate = { ...s, ...patch };
      // Reconcile only explicit edits, never a frame arriving or a panel opening.
      if ("property" in patch || ("dataProjectId" in patch && (!candidate.dataProjectId || seriesFrames.has(candidate.dataProjectId)))) {
        merged["aggregation"] = chartYAxis({ yAxis: candidate }, candidate.property, fieldsOf(candidate)).aggregation;
      }
      // Optional keys are removed rather than stored empty.
      for (const key of ["label", "dataProjectId", "xProperty", "selectionField"]) if (!merged[key]) delete merged[key];
      if (merged["axis"] !== "right") delete merged["axis"];
      return merged as unknown as ChartSeriesConfig;
    });
    dispatch("change", next);
  }

  function setAggregation(index: number, value: string) {
    update(index, { aggregation: value as ChartSeriesConfig["aggregation"] });
  }

  function add() {
    const id = `s${Date.now().toString(36)}`;
    const first = fieldsOf({ id, property: "count", aggregation: "count_total" })[0];
    dispatch("change", [...series, { id, property: first?.name ?? "count", aggregation: chartAggregations(first).includes("sum") ? "sum" : "count_total" }]);
  }

  function remove(index: number) {
    dispatch("change", series.filter((_, i) => i !== index));
  }
</script>

<div class="ppp-chart-series">
  <div class="ppp-chart-series__title">{$i18n.t("views.dashboard.chart.series.title")}</div>
  {#each series as s, i (s.id)}
    {@const sourceFields = fieldsOf(s, fields, seriesFrames)}
    {@const names = sourceFields.map(f => f.name)}
    {@const aggregations = chartAggregations(sourceFields.find(f => f.name === s.property))}
    {@const unsupported = s.property !== "count" && !aggregations.includes(s.aggregation)}
    <div class="ppp-chart-series__item">
      <label class="ppp-config-row">
        <span>{$i18n.t("views.dashboard.chart.series.label")}</span>
        <input type="text" value={s.label ?? ""} placeholder={s.property}
          on:change={(e) => update(i, { label: e.currentTarget.value })} />
      </label>
      {#if availableSources.length > 0}
        <label class="ppp-config-row">
          <span>{$i18n.t("views.dashboard.data-project.label")}</span>
          <select value={s.dataProjectId ?? ""}
            on:change={(e) => update(i, { dataProjectId: e.currentTarget.value, xProperty: "" })}>
            <option value="">{$i18n.t("views.dashboard.chart.series.this-chart")}</option>
            {#each availableSources as src (src.id)}
              <option value={src.id}>{src.name}</option>
            {/each}
          </select>
        </label>
      {/if}
      <label class="ppp-config-row">
        <span>{$i18n.t("views.dashboard.chart.series.field")}</span>
        {#if names.length > 0}
          <select value={s.property} on:change={(e) => update(i, { property: e.currentTarget.value })}>
            <option value="count">{aggregationLabel("count_total", tr)}</option>
            {#if s.property !== "count" && !names.includes(s.property)}<option value={s.property} disabled>{s.property}</option>{/if}
            {#each names as name}<option value={name}>{name}</option>{/each}
          </select>
        {:else}
          <input type="text" value={s.property} on:change={(e) => update(i, { property: e.currentTarget.value })} />
        {/if}
      </label>
      {#if s.property !== "count"}
        <label class="ppp-config-row">
          <span>{$i18n.t("views.dashboard.chart.aggregation")}</span>
          <select value={s.aggregation}
            on:change={(e) => setAggregation(i, e.currentTarget.value)}>
            {#if unsupported}<option value={s.aggregation} disabled>{aggregationLabel(s.aggregation, tr)}</option>{/if}
            {#each aggregations as value}<option {value} title={aggregationConsequence(value, tr)}>{aggregationLabel(value, tr)}</option>{/each}
          </select>
        </label>
      {/if}
      <p class="ppp-config-hint" role={unsupported ? "alert" : "note"}>
        {#if unsupported}{$i18n.t("views.dashboard.chart.unsupported-aggregation", { defaultValue: "This aggregation is not supported for the selected field. Choose a compatible operation." })}
        {:else}{aggregationConsequence(s.property === "count" ? "count_total" : s.aggregation, tr)}{/if}
      </p>
      {#if s.dataProjectId}
        <label class="ppp-config-row">
          <span>{$i18n.t("views.dashboard.chart.series.x-field")}</span>
          {#if names.length > 0}
            <select value={s.xProperty ?? ""} on:change={(e) => update(i, { xProperty: e.currentTarget.value })}>
              <option value="">{$i18n.t("views.dashboard.chart.series.same-x")}</option>
              {#each names as name}<option value={name}>{name}</option>{/each}
            </select>
          {:else}
            <input type="text" value={s.xProperty ?? ""} on:change={(e) => update(i, { xProperty: e.currentTarget.value })} />
          {/if}
        </label>
      {/if}
      {#if following}
        <label class="ppp-config-row">
          <span>{$i18n.t("views.dashboard.follow.field")}</span>
          <select value={s.selectionField ?? ""} on:change={(e) => update(i, { selectionField: e.currentTarget.value })}>
            <option value="">—</option>
            {#each names as name}<option value={name}>{name}</option>{/each}
          </select>
        </label>
      {/if}
      <label class="ppp-config-row">
        <span>{$i18n.t("views.dashboard.chart.series.axis")}</span>
        <select value={s.axis ?? "left"} on:change={(e) => update(i, { axis: e.currentTarget.value === "right" ? "right" : "left" })}>
          <option value="left">{$i18n.t("views.dashboard.chart.series.axis-left")}</option>
          <option value="right">{$i18n.t("views.dashboard.chart.series.axis-right")}</option>
        </select>
      </label>
      <button type="button" class="ppp-chart-series__remove" on:click={() => remove(i)}>
        {$i18n.t("views.dashboard.chart.series.remove")}
      </button>
    </div>
  {/each}
  <button type="button" class="ppp-chart-series__add" on:click={add}>
    {$i18n.t("views.dashboard.chart.series.add")}
  </button>
</div>

<style>
  .ppp-chart-series {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
    margin-top: var(--size-4-2);
  }
  .ppp-chart-series__title {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }
  .ppp-chart-series__item {
    border: var(--ppp-border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    padding: var(--size-4-2);
  }
  .ppp-config-hint {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }
</style>
