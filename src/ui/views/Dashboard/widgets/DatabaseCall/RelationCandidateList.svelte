<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { optionDomId, reveal } from "src/ui/components/fields/comboOptions";
  export let listId: string;
  export let labels: string[];
  export let selectedIds: string[];
  export let active: number;
  export let multi: boolean;
  export let loading: boolean;
  export let failed: boolean;
  export let saving: boolean;
  export let showSetup: boolean;
  const dispatch = createEventDispatcher<{ choose: string; retry: void; setup: void }>();
</script>

{#if failed}
  <div class="ppp-rel-picker-error" role="alert">
    <span>{$i18n.t("views.dashboard.table-v2.relation-load-error")}</span>
    <button type="button" disabled={saving} on:mousedown|preventDefault on:click={() => dispatch("retry")}>
      {$i18n.t("views.dashboard.table-v2.relation-retry")}
    </button>
  </div>
{:else if !loading && showSetup}
  <button type="button" class="ppp-rel-picker-setup" disabled={saving} on:mousedown|preventDefault on:click={() => dispatch("setup")}>
    {$i18n.t("relation-setup.open", { defaultValue: "Link database…" })}
  </button>
{/if}
<div class="ppp-rel-picker-list" id={listId} role="listbox" aria-multiselectable={multi} aria-busy={loading}>
  {#if loading}
    <span class="ppp-rel-picker-hint" role="presentation">…</span>
  {:else if labels.length === 0 && !failed && !showSetup}
    <span class="ppp-rel-picker-hint" role="presentation">{$i18n.t("views.dashboard.table-v2.relation-empty", { defaultValue: "No records to link" })}</span>
  {:else}
    {#each labels as label, i (label)}
      <button type="button" id={optionDomId(listId, label)} class="ppp-rel-picker-item"
        class:ppp-rel-picker-item--active={i === active} role="option" aria-selected={selectedIds.includes(label)}
        disabled={saving || loading} title={label} use:reveal={i === active}
        on:pointerdown|preventDefault on:mousedown|preventDefault on:click={() => dispatch("choose", label)}>
        {#if multi}<span class="ppp-rel-picker-mark" aria-hidden="true">{#if selectedIds.includes(label)}<Icon name="check" size="xs" />{/if}</span>{/if}
        <span class="ppp-rel-picker-label">{label}</span>
      </button>
    {/each}
  {/if}
</div>

<style>
  .ppp-rel-picker-list { max-height: 12em; overflow-y: auto; display: flex; flex-direction: column; }
  .ppp-rel-picker-list > .ppp-rel-picker-item { display: flex; align-items: center; gap: 0.375em; min-height: var(--ppp-touch-target-min); padding: 0.25em 0.375em; border: none; box-shadow: none; background: transparent; color: var(--text-normal); font-size: var(--font-ui-small); text-align: left; border-radius: var(--radius-s); cursor: pointer; }
  .ppp-rel-picker-list > .ppp-rel-picker-item--active { background: var(--background-modifier-hover); }
  .ppp-rel-picker-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ppp-rel-picker-mark { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 1em; width: 1em; height: 1em; border: var(--ppp-border-width) solid var(--text-muted); border-radius: var(--radius-s); }
  .ppp-rel-picker-hint { padding: 0.375em; color: var(--text-faint); font-size: var(--font-ui-smaller); }
  .ppp-rel-picker-error { display: flex; flex-direction: column; gap: 0.375em; color: var(--text-error); }
  .ppp-rel-picker-setup { padding: 0.25em 0.375em; font-size: var(--font-ui-small); color: var(--interactive-accent); background: transparent; border: none; cursor: pointer; text-align: left; }
  @media (hover: hover) and (pointer: fine) { .ppp-rel-picker-list > .ppp-rel-picker-item:hover { background: var(--background-modifier-hover); } }
</style>
