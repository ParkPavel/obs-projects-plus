<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";
  import { enabledFilterConditionCount } from "src/lib/engine/filterCompose";
  import type { FilterDefinition } from "src/settings/base/settings";
  import FilterPills from "./FilterPills.svelte";

  export let value: FilterDefinition | undefined = undefined;
  $: count = enabledFilterConditionCount(value);
  $: label = $i18n.t(value?.conjunction === "or" ? "components.filter.or" : "components.filter.and");
</script>

{#if count > 0}
  <div class="ppp-filter-summary" role="group" aria-label={label}>
    <span class="ppp-filter-summary-conjunction">{label}</span>
    <FilterPills conditions={value?.conditions ?? []} readonly />
    {#each value?.groups ?? [] as group}
      <svelte:self value={group} />
    {/each}
  </div>
{/if}

<style>
  .ppp-filter-summary { display: flex; flex-direction: column; gap: 0.4em; min-width: 0; padding-inline-start: 0.5em; border-inline-start: var(--ppp-border-width) solid var(--background-modifier-border); }
  .ppp-filter-summary-conjunction { color: var(--text-muted); font-size: var(--font-ui-smaller); }
</style>
