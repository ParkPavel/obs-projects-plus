<script lang="ts">
  /**
   * StatsConfig — user-facing editor for cards of a Stats widget.
   * Each card: label, source field, aggregation, format, optional currency.
   * Plus grid columns count (layout primitive).
   */
  import type { DataField } from "src/lib/dataframe/dataframe";
  import {
    AGGREGATIONS,
    aggregationOption,
    aggregationOptionsFor,
    type AggregationOption,
  } from "src/lib/dashboard-engine/aggregationOptions";
  import type { StatsConfig, StatsCardConfig, ColumnAggregation } from "../../types";
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import WidgetConfigShell from "../_shared/WidgetConfigShell.svelte";

  export let config: StatsConfig;
  export let fields: DataField[] = [];

  const dispatch = createEventDispatcher<{
    change: StatsConfig;
    close: void;
  }>();

  /**
   * #180d: this list, its labels and its ordering used to live here, and five
   * other surfaces each had their own. `count_total` was labelled simply
   * "Count", which is the ambiguity no reference product ships — a user cannot
   * tell whether an empty cell is in the answer. The one table now names each
   * option and states its consequence, and the option's `title` carries that
   * consequence so the choice is checkable before it is made.
   *
   * The full set is still offered when no field is chosen yet, because #093
   * fixed a real defect that way: a stored aggregation the select did not know
   * rendered as an EMPTY dropdown.
   */
  $: selectedField = (name: string) => fields.find((f) => f.name === name);
  $: optionsFor = (fieldName: string): AggregationOption[] => {
    const field = selectedField(fieldName);
    const allowed = field ? new Set(aggregationOptionsFor(field)) : null;
    return AGGREGATIONS.filter(
      (o) => o.value !== "none" && (allowed === null || allowed.has(o.value))
    );
  };

  const FORMATS = ["number", "percent", "currency", "duration"] as const;

  $: cards = config.cards.slice();
  $: columnsCount = config.columns;
  $: fieldNames = fields.map((f) => f.name);

  function emit(next: Partial<StatsConfig>) {
    dispatch("change", { ...config, ...next });
  }

  function addCard() {
    const first = fields[0]?.name ?? "*";
    const id = `card_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    emit({
      cards: [
        ...cards,
        { id, label: "New card", field: first, aggregation: "count_total", format: "number" },
      ],
    });
  }

  function updateCard(idx: number, patch: Partial<StatsCardConfig>) {
    const next = cards.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    emit({ cards: next });
  }

  function removeCard(idx: number) {
    emit({ cards: cards.filter((_, i) => i !== idx) });
  }

  function inputVal(e: Event): string {
    return (e.currentTarget as HTMLInputElement).value;
  }
  function selectVal(e: Event): string {
    return (e.currentTarget as HTMLSelectElement).value;
  }
  function onAggChange(idx: number, e: Event) {
    updateCard(idx, { aggregation: selectVal(e) as ColumnAggregation });
  }
  function onFormatChange(idx: number, e: Event) {
    const v = selectVal(e);
    const fmt = v === "percent" || v === "currency" || v === "number" || v === "duration" ? v : "number";
    updateCard(idx, { format: fmt });
  }
  function onColumnsChange(e: Event) {
    // coercion-exempt: Class C - plugin/widget configuration from a form control, not record data
    const v = Number(selectVal(e));
    const cols = v === 2 || v === 3 || v === 4 ? v : 3;
    emit({ columns: cols });
  }
  function toggleSparkline(idx: number, e: Event) {
    const checked = (e.currentTarget as HTMLInputElement).checked;
    updateCard(idx, { sparkline: checked });
  }
</script>

<WidgetConfigShell
  title={$i18n.t("views.dashboard.stats.config.title", { defaultValue: "Stats cards" })}
  subtitle={$i18n.t("views.dashboard.stats.config.subtitle", { defaultValue: "Each card shows one aggregation from the (post-pipeline) data. Use * as field for Count of records." })}
  on:close={() => dispatch("close")}
>
  <div class="ppp-cfg-row">
    <label>
      {$i18n.t("views.dashboard.stats.config.columns", { defaultValue: "Grid columns" })}
      <select value={columnsCount} on:change={onColumnsChange}>
        <option value={2}>2</option>
        <option value={3}>3</option>
        <option value={4}>4</option>
      </select>
    </label>
  </div>

  {#if cards.length === 0}
    <p class="ppp-stats-config-hint">
      {$i18n.t("views.dashboard.stats.config.empty", { defaultValue: "No cards yet. Add one to show a KPI tile." })}
    </p>
  {/if}

  <div class="ppp-cfg-list">
    {#each cards as card, idx (card.id)}
      <div class="ppp-cfg-item ppp-stats-config-item">
        <label>
          {$i18n.t("views.dashboard.stats.config.label", { defaultValue: "Label" })}
          <input
            type="text"
            value={card.label}
            on:input={(e) => updateCard(idx, { label: inputVal(e) })}
          />
        </label>

        <label>
          {$i18n.t("views.dashboard.stats.config.field", { defaultValue: "Field" })}
          <input
            type="text"
            list="ppp-stats-fields"
            value={card.field}
            placeholder="*"
            on:input={(e) => updateCard(idx, { field: inputVal(e) })}
          />
        </label>

        <label>
          {$i18n.t("views.dashboard.stats.config.aggregation", { defaultValue: "Aggregation" })}
          <select
            value={card.aggregation}
            on:change={(e) => onAggChange(idx, e)}
          >
            {#each optionsFor(card.field) as agg (agg.value)}
              <option value={agg.value} title={agg.consequence}>
                {$i18n.t("views.dashboard.agg." + agg.value, { defaultValue: agg.label })}
              </option>
            {/each}
            {#if card.aggregation && !optionsFor(card.field).some((o) => o.value === card.aggregation)}
              <!-- #093: a stored aggregation this field would not be offered
                   today still has to appear, or the dropdown renders empty and
                   the card looks unconfigured. -->
              <option value={card.aggregation}>
                {$i18n.t("views.dashboard.agg." + card.aggregation, {
                  defaultValue: aggregationOption(card.aggregation)?.label ?? card.aggregation,
                })}
              </option>
            {/if}
          </select>
        </label>

        <label>
          {$i18n.t("views.dashboard.stats.config.format", { defaultValue: "Format" })}
          <select
            value={card.format ?? "number"}
            on:change={(e) => onFormatChange(idx, e)}
          >
            {#each FORMATS as fmt (fmt)}
              <option value={fmt}>
                {$i18n.t("views.dashboard.stats.config.fmt-" + fmt, { defaultValue: fmt })}
              </option>
            {/each}
          </select>
        </label>

        {#if card.format === "currency"}
          <label class="ppp-stats-currency">
            {$i18n.t("views.dashboard.stats.config.currency", { defaultValue: "Symbol" })}
            <input
              type="text"
              value={card.currencySymbol ?? "$"}
              maxlength="3"
              on:input={(e) => updateCard(idx, { currencySymbol: inputVal(e) })}
            />
          </label>
        {/if}

        <label class="ppp-stats-sparkline">
          <input
            type="checkbox"
            checked={card.sparkline ?? false}
            on:change={(e) => toggleSparkline(idx, e)}
          />
          <span>{$i18n.t("views.dashboard.stats.config.sparkline", { defaultValue: "Sparkline" })}</span>
        </label>

        <button
          type="button"
          class="ppp-cfg-remove"
          on:click={() => removeCard(idx)}
          aria-label={$i18n.t("common.remove", { defaultValue: "Remove" })}
          title={$i18n.t("common.remove", { defaultValue: "Remove" })}
        >✕</button>
      </div>
    {/each}
  </div>

  <button type="button" class="ppp-cfg-add" on:click={addCard}>
    + {$i18n.t("views.dashboard.stats.config.add", { defaultValue: "Add card" })}
  </button>

  <datalist id="ppp-stats-fields">
    <option value="*" />
    {#each fieldNames as name (name)}
      <option value={name} />
    {/each}
  </datalist>
</WidgetConfigShell>

<style>
  .ppp-stats-config-hint {
    margin: 0;
    padding: 0.375rem 0.5rem;
    font-size: var(--font-ui-smaller, 0.75rem);
    color: var(--text-muted);
    background: var(--background-modifier-hover);
    border-radius: var(--radius-s, 0.25rem);
  }
  .ppp-stats-currency {
    flex: 0 0 4.5rem;
  }
  .ppp-stats-sparkline {
    flex: 0 0 auto !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 0.3rem !important;
    font-size: var(--font-ui-smaller, 0.75rem);
    color: var(--text-muted);
    white-space: nowrap;
  }
</style>
