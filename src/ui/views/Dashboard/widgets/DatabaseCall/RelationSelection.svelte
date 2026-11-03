<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  export let selected: string[] = [];
  export let saving = false;
  const dispatch = createEventDispatcher<{ remove: string }>();
</script>

{#if selected.length}
  <div class="ppp-rel-selection">
    {#each selected as target (target)}
      <span class="ppp-rel-selection-item" data-relation-selected={target}>
        <span title={target}>{target}</span>
        <button type="button" disabled={saving}
          aria-label={`${$i18n.t("common.remove", { defaultValue: "Remove" })}: ${target}`}
          on:mousedown|preventDefault on:click={() => dispatch("remove", target)}>×</button>
      </span>
    {/each}
  </div>
{/if}

<style>
  .ppp-rel-selection { display: flex; flex-wrap: wrap; gap: 0.25em; min-width: 0; }
  .ppp-rel-selection-item { display: inline-flex; align-items: center; gap: 0.25em; max-width: 100%; min-width: 0; border-radius: var(--radius-s); background: var(--background-secondary); }
  .ppp-rel-selection-item > span { padding-inline-start: 0.375em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ppp-rel-selection .ppp-rel-selection-item > button { flex: 0 0 auto; width: var(--ppp-touch-target-min); height: var(--ppp-touch-target-min); min-width: var(--ppp-touch-target-min); padding: 0; border: none; box-shadow: none; background: transparent; color: var(--text-muted); }
</style>
