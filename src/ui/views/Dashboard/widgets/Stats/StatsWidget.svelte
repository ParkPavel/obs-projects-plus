<script lang="ts">
  import type { DataFrame, DataRecord, DataValue } from "src/lib/dataframe/dataframe";
  import type { Optional } from "src/lib/dataframe/dataframe";
  import type { StatsConfig, StatsCardConfig } from "../../types";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import { getContext, onDestroy } from "svelte";
  import StatsCard from "./StatsCard.svelte";
  import {
    SELECTION_CONTEXT_KEY,
    EMPTY_SELECTION,
    type SelectionStore,
    type SelectionState,
  } from "../../canvasSelectionStore";
  import { filterRecordsBySelection, isSelectionActive } from "./statsSelectionReceiver";

  export let config: StatsConfig;
  export let source: DataFrame;
  /**
   * Canvas-unique widget id, propagated by `WidgetHost`. Required for the
   * cross-widget selection receiver: drives the self-skip rule and the
   * "filtered" dot indicator. When undefined (e.g. standalone test mounts
   * outside a DashboardCanvas) the widget renders unchanged.
   */
  export let widgetId: string | undefined = undefined;

  // Per-canvas SelectionStore from DashboardCanvas. May be undefined when the
  // widget is mounted outside a canvas (legacy embeds, isolated tests) — the
  // receiver code below tolerates that by falling back to EMPTY_SELECTION.
  const selectionStore: SelectionStore | undefined = getContext(SELECTION_CONTEXT_KEY);

  // Reactive snapshot of the current selection. `$selectionStore` auto-sub
  // cannot be used directly because the store may be undefined; subscribe
  // ONCE at component init and clean up in `onDestroy` so re-renders do not
  // stack listeners on the same store.
  let selection: SelectionState = EMPTY_SELECTION;
  const unsubscribeSelection = selectionStore
    ? selectionStore.subscribe((v) => (selection = v))
    : () => {};
  onDestroy(unsubscribeSelection);

  /** Build default cards from numeric fields when config is empty */
  function buildDefaultCards(df: DataFrame): StatsCardConfig[] {
    const cards: StatsCardConfig[] = [
      { id: "_count", label: "Total", field: "*", aggregation: "count_total" },
    ];
    const numFields = df.fields.filter(
      (f) => f.type === DataFieldType.Number
    );
    if (numFields.length > 0) {
      const f = numFields[0]!;
      cards.push(
        { id: "_sum", label: `${f.name} Sum`, field: f.name, aggregation: "sum", format: "number" },
        { id: "_avg", label: `${f.name} Avg`, field: f.name, aggregation: "avg", format: "number" }
      );
    }
    return cards;
  }

  $: cards = config.cards?.length ? config.cards : buildDefaultCards(source);
  $: columns = config.columns ?? 3;
  $: availableFieldNames = new Set(source.fields.map((f) => f.name));

  // Receiver core: narrow source.records by the active selection (no-op when
  // no widgetId, no canvas store, or empty selection). Reference-equal to
  // `source.records` in the no-op path so downstream `$:` blocks short-circuit.
  $: filteredRecords = widgetId
    ? filterRecordsBySelection({ records: source.records, selection, myWidgetId: widgetId })
    : source.records;

  // Dot indicator predicate — true exactly when a sibling-emitted selection is
  // narrowing this widget. Empty-result selections still show the dot (per
  // helper docs); a value of "—" or 0 then communicates the empty cohort.
  $: filteredActive = widgetId ? isSelectionActive(selection, widgetId) : false;

  function getFieldValues(records: readonly DataRecord[], fieldName: string): Optional<DataValue>[] {
    if (fieldName === "*") return records.map(() => true);
    return records.map((r) => r.values[fieldName] ?? undefined);
  }

  function isFieldMissing(fieldName: string): boolean {
    // "*" and empty name are always valid (count records)
    if (!fieldName || fieldName === "*") return false;
    return !availableFieldNames.has(fieldName);
  }
</script>

<div class="ppp-stats-widget">
  {#each cards as card (card.id)}
    <StatsCard
      config={card}
      values={getFieldValues(filteredRecords, card.field)}
      fieldMissing={isFieldMissing(card.field)}
      filtered={filteredActive}
    />
  {/each}
</div>

<style>
  .ppp-stats-widget {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--ppp-db-stats-card-min, 10rem), 1fr));
    gap: var(--ppp-space-md, 0.5rem);
    padding: var(--ppp-space-md, 0.5rem);
  }
</style>
