<script lang="ts">
  import type { DataFrame, DataValue } from "src/lib/dataframe/dataframe";
  import type { Optional } from "src/lib/dataframe/dataframe";
  import type { StatsConfig, StatsCardConfig } from "../../types";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import StatsCard from "./StatsCard.svelte";

  export let config: StatsConfig;
  export let source: DataFrame;

  /** Build default cards from numeric fields when config is empty */
  function buildDefaultCards(df: DataFrame): StatsCardConfig[] {
    const cards: StatsCardConfig[] = [
      { id: "_count", label: "Total", field: "*", aggregation: "count" },
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

  function getFieldValues(fieldName: string): Optional<DataValue>[] {
    if (fieldName === "*") return source.records.map(() => true);
    return source.records.map((r) => r.values[fieldName] ?? undefined);
  }
</script>

<div class="ppp-stats-widget" style="--stats-columns: {columns}">
  {#each cards as card (card.id)}
    <StatsCard config={card} values={getFieldValues(card.field)} />
  {/each}
</div>

<style>
  .ppp-stats-widget {
    display: grid;
    grid-template-columns: repeat(var(--stats-columns, 3), 1fr);
    gap: var(--ppp-space-md, 0.5rem);
    padding: var(--ppp-space-md, 0.5rem);
  }

  /* Matryoshka: adapt to widget container width */
  @container widget (max-width: 20rem) {
    .ppp-stats-widget {
      grid-template-columns: 1fr;
    }
  }
  @container widget (min-width: 20rem) and (max-width: 35rem) {
    .ppp-stats-widget {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
