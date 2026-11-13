<script lang="ts">
  import { followLinkedSelection, isFollowing } from "../_shared/selectionFollow";
  import type { DataFrame, DataRecord, DataValue } from "src/lib/dataframe/dataframe";
  import type { Optional } from "src/lib/dataframe/dataframe";
  import type { StatsConfig } from "../../types";
  import { i18n } from "src/lib/stores/i18n";
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

  $: cards = config.cards ?? [];
  $: availableFieldNames = new Set(source.fields.map((f) => f.name));

  // Receiver core: narrow source.records by the active selection (no-op when
  // no widgetId, no canvas store, or empty selection). Reference-equal to
  // `source.records` in the no-op path so downstream `$:` blocks short-circuit.
  // 3.6.0: a linked selection narrows through a relation (selectionFollow.ts).
  $: filteredRecords = config.linkedSelection
    ? followLinkedSelection(source.records, selection, config.linkedSelection)
    : widgetId
      ? filterRecordsBySelection({ records: source.records, selection, myWidgetId: widgetId })
      : source.records;

  // Dot indicator predicate — true exactly when a sibling-emitted selection is
  // narrowing this widget. Empty-result selections still show the dot (per
  // helper docs); a value of "—" or 0 then communicates the empty cohort.
  $: filteredActive = config.linkedSelection
    ? isFollowing(selection, config.linkedSelection)
    : widgetId ? isSelectionActive(selection, widgetId) : false;

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

<p class="ppp-stats-hint">{$i18n.t("views.dashboard.stats.summary-hint", { defaultValue: "Numeric summary — each card shows its field and aggregation. For a diagram, add a Chart widget." })}</p>
{#if cards.length === 0}
  <p class="ppp-stats-hint">{$i18n.t("views.dashboard.stats.empty-cards", { defaultValue: "Add a card in the widget settings." })}</p>
{/if}
<div class="ppp-stats-widget" style:--ppp-stats-columns={config.columns}>
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
    grid-template-columns: repeat(var(--ppp-stats-columns, 2), minmax(0, 1fr));
    gap: var(--ppp-space-md, 0.5rem);
    padding: var(--ppp-space-md, 0.5rem);
  }
  .ppp-stats-hint { margin: 0; padding: var(--ppp-space-sm); color: var(--text-muted); font-size: var(--font-ui-smaller); }
  @container widget (max-width: 30em) { .ppp-stats-widget { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @container widget (max-width: 20em) { .ppp-stats-widget { grid-template-columns: minmax(0, 1fr); } }
</style>
