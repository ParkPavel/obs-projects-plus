<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  export let multi = false;
  export let count = 0;
  export let saving = false;
  export let loading = false;
  const dispatch = createEventDispatcher<{ done: void; clear: void; cancel: void }>();
</script>
<div class="ppp-rel-picker-actions">
  {#if multi}
    <span class="ppp-rel-picker-count">{count}</span>
    <button type="button" class="ppp-rel-picker-done mod-cta" disabled={saving || loading}
      on:pointerdown|preventDefault on:mousedown|preventDefault on:click={() => dispatch("done")}>
      {$i18n.t("views.dashboard.table-v2.relation-done", { defaultValue: "Done" })}
    </button>
  {:else}
    <button type="button" class="ppp-rel-picker-clear" disabled={saving || loading}
      on:pointerdown|preventDefault on:mousedown|preventDefault on:click={() => dispatch("clear")}>{$i18n.t("common.clear")}</button>
  {/if}
  <button type="button" class="ppp-rel-picker-cancel" disabled={saving}
    on:pointerdown|preventDefault on:mousedown|preventDefault on:click={() => dispatch("cancel")}>
    {$i18n.t("views.dashboard.table-v2.relation-cancel", { defaultValue: "Cancel" })}
  </button>
</div>
<style>
  .ppp-rel-picker-actions { display: flex; align-items: center; justify-content: flex-end; gap: 0.375em; flex: none; }
  .ppp-rel-picker-count { color: var(--text-faint); font-size: var(--font-ui-smaller); margin-right: auto; }
  button { min-height: var(--ppp-touch-target-min); padding: 0.2em 0.6em; font-size: var(--font-ui-small); border-radius: var(--radius-s); cursor: pointer; }
  .ppp-rel-picker-cancel, .ppp-rel-picker-clear { border: var(--ppp-border-width) solid var(--background-modifier-border); background: transparent; color: var(--text-muted); }
</style>
