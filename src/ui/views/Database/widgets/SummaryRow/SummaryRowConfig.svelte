<script lang="ts">
  /**
   * SummaryRowConfig — user-facing editor for columns of a SummaryRow widget.
   * Pure UI: reads config (columns array), dispatches merged `change` event.
   * Aggregation choices mirror ColumnAggregation union in types.ts.
   */
  import type { DataField } from "src/lib/dataframe/dataframe";
  import type { SummaryColumnConfig, ColumnAggregation } from "../../types";
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import WidgetConfigShell from "../_shared/WidgetConfigShell.svelte";

  export let config: Record<string, unknown> = {};
  export let fields: DataField[] = [];

  const dispatch = createEventDispatcher<{
    change: Record<string, unknown>;
    close: void;
  }>();

  const AGGREGATIONS: { value: ColumnAggregation; labelKey: string; defaultLabel: string }[] = [
    { value: "count", labelKey: "views.database.agg.count", defaultLabel: "Count" },
    { value: "count_unique", labelKey: "views.database.agg.unique", defaultLabel: "Unique" },
    { value: "sum", labelKey: "views.database.agg.sum", defaultLabel: "Sum" },
    { value: "avg", labelKey: "views.database.agg.avg", defaultLabel: "Average" },
    { value: "median", labelKey: "views.database.agg.median", defaultLabel: "Median" },
    { value: "min", labelKey: "views.database.agg.min", defaultLabel: "Min" },
    { value: "max", labelKey: "views.database.agg.max", defaultLabel: "Max" },
    { value: "range", labelKey: "views.database.agg.range", defaultLabel: "Range" },
    { value: "count_checked", labelKey: "views.database.agg.checked", defaultLabel: "✓ Count" },
    { value: "percent_checked", labelKey: "views.database.agg.pct-checked", defaultLabel: "% ✓" },
    { value: "percent_not_empty", labelKey: "views.database.agg.pct-filled", defaultLabel: "% filled" },
  ];

  const FORMATS = ["number", "percent", "currency"] as const;

  $: columns = ((config["columns"] as SummaryColumnConfig[] | undefined) ?? []).slice();
  $: fieldNames = fields.map((f) => f.name);

  function emit(next: SummaryColumnConfig[]) {
    dispatch("change", { ...config, columns: next });
  }

  function addColumn() {
    const first = fields[0]?.name ?? "";
    emit([...columns, { field: first, aggregation: "count", format: "number" }]);
  }

  function updateColumn(idx: number, patch: Partial<SummaryColumnConfig>) {
    const next = columns.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    emit(next);
  }

  function removeColumn(idx: number) {
    emit(columns.filter((_, i) => i !== idx));
  }

  function inputVal(e: Event): string {
    return (e.currentTarget as HTMLInputElement).value;
  }
  function selectVal(e: Event): string {
    return (e.currentTarget as HTMLSelectElement).value;
  }

  function onAggChange(idx: number, e: Event) {
    updateColumn(idx, { aggregation: selectVal(e) as ColumnAggregation });
  }
  function onFormatChange(idx: number, e: Event) {
    const v = selectVal(e);
    updateColumn(idx, { format: (v === "percent" || v === "currency" || v === "number" ? v : "number") });
  }
</script>

<WidgetConfigShell
  title={$i18n.t("views.database.summary.config.title", { defaultValue: "Summary columns" })}
  subtitle={$i18n.t("views.database.summary.config.subtitle", { defaultValue: "Pick fields and aggregations. Values recompute live after any data/pipeline change." })}
  on:close={() => dispatch("close")}
>
  {#if columns.length === 0}
    <p class="ppp-summary-config-hint">
      {$i18n.t("views.database.summary.config.empty", { defaultValue: "No columns yet. Add one to show an aggregated number next to the records." })}
    </p>
  {/if}

  <div class="ppp-cfg-list">
    {#each columns as col, idx (idx)}
      <div class="ppp-cfg-item">
        <label>
          {$i18n.t("views.database.summary.config.field", { defaultValue: "Field" })}
          <input
            type="text"
            list="ppp-summary-fields"
            value={col.field}
            on:input={(e) => updateColumn(idx, { field: inputVal(e) })}
          />
        </label>

        <label>
          {$i18n.t("views.database.summary.config.aggregation", { defaultValue: "Aggregation" })}
          <select
            value={col.aggregation}
            on:change={(e) => onAggChange(idx, e)}
          >
            {#each AGGREGATIONS as agg (agg.value)}
              <option value={agg.value}>
                {$i18n.t(agg.labelKey, { defaultValue: agg.defaultLabel })}
              </option>
            {/each}
          </select>
        </label>

        <label>
          {$i18n.t("views.database.summary.config.format", { defaultValue: "Format" })}
          <select
            value={col.format ?? "number"}
            on:change={(e) => onFormatChange(idx, e)}
          >
            {#each FORMATS as fmt (fmt)}
              <option value={fmt}>
                {$i18n.t("views.database.summary.config.fmt-" + fmt, { defaultValue: fmt })}
              </option>
            {/each}
          </select>
        </label>

        {#if col.format === "currency"}
          <label class="ppp-cfg-currency">
            {$i18n.t("views.database.summary.config.currency", { defaultValue: "Symbol" })}
            <input
              type="text"
              value={col.currencySymbol ?? "$"}
              maxlength="3"
              on:input={(e) => updateColumn(idx, { currencySymbol: inputVal(e) })}
            />
          </label>
        {/if}

        <button
          type="button"
          class="ppp-cfg-remove"
          on:click={() => removeColumn(idx)}
          aria-label={$i18n.t("common.remove", { defaultValue: "Remove" })}
          title={$i18n.t("common.remove", { defaultValue: "Remove" })}
        >✕</button>
      </div>
    {/each}
  </div>

  <button type="button" class="ppp-cfg-add" on:click={addColumn}>
    + {$i18n.t("views.database.summary.config.add", { defaultValue: "Add column" })}
  </button>

  <datalist id="ppp-summary-fields">
    {#each fieldNames as name (name)}
      <option value={name} />
    {/each}
  </datalist>
</WidgetConfigShell>

<style>
  .ppp-summary-config-hint {
    margin: 0;
    padding: 0.375rem 0.5rem;
    font-size: var(--font-ui-smaller, 0.75rem);
    color: var(--text-muted);
    background: var(--background-modifier-hover);
    border-radius: var(--radius-s, 0.25rem);
  }
  .ppp-cfg-currency {
    flex: 0 0 4.5rem;
  }
</style>
