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

  export let series: readonly ChartSeriesConfig[] = [];
  /** The fields of this chart's own input. */
  export let fields: DataField[] = [];
  export let availableSources: Array<{ id: string; name: string }> = [];
  /** Loaded frames of other projects, by id. */
  export let seriesFrames: ReadonlyMap<string, DataFrame> = new Map();

  const dispatch = createEventDispatcher<{ change: ChartSeriesConfig[] }>();

  const AGGREGATIONS = [
    ["sum", "views.dashboard.chart.aggregations.sum"],
    ["avg", "views.dashboard.chart.aggregations.average"],
    ["min", "views.dashboard.chart.aggregations.min"],
    ["max", "views.dashboard.chart.aggregations.max"],
    ["median", "views.dashboard.chart.aggregations.median"],
    ["count_total", "views.dashboard.chart.aggregations.count"],
  ] as const;

  function fieldsOf(s: ChartSeriesConfig): string[] {
    const frame = s.dataProjectId ? seriesFrames.get(s.dataProjectId) : undefined;
    return (s.dataProjectId ? frame?.fields ?? [] : fields).map((f) => f.name);
  }

  function update(index: number, patch: Partial<ChartSeriesConfig>) {
    const next = series.map((s, i) => {
      if (i !== index) return s;
      const merged: Record<string, unknown> = { ...s, ...patch };
      // Optional keys are removed rather than stored empty.
      for (const key of ["label", "dataProjectId", "xProperty"]) if (!merged[key]) delete merged[key];
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
    dispatch("change", [...series, { id, property: fields[0]?.name ?? "count", aggregation: "sum" }]);
  }

  function remove(index: number) {
    dispatch("change", series.filter((_, i) => i !== index));
  }
</script>

<div class="ppp-chart-series">
  <div class="ppp-chart-series__title">{$i18n.t("views.dashboard.chart.series.title")}</div>
  {#each series as s, i (s.id)}
    {@const names = fieldsOf(s)}
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
            <option value="count">{$i18n.t("views.dashboard.chart.aggregations.count")}</option>
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
            {#each AGGREGATIONS as [value, key]}<option {value}>{$i18n.t(key)}</option>{/each}
          </select>
        </label>
      {/if}
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
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    padding: var(--size-4-2);
  }
</style>
