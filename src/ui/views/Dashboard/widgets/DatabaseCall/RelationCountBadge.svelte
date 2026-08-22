<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";
  export let count: number;
  export let loading: boolean;
</script>
{#if !loading}
  <span class="ppp-rel-count" aria-live="polite">
    {#if count > 0}
      {$i18n.t("relation-count.linked", { count, defaultValue: "{{count}} linked" })}
    {:else}
      {$i18n.t("relation-count.empty", { defaultValue: "No linked records yet" })}
    {/if}
  </span>
{/if}
<style>
  .ppp-rel-count {
    padding: 0.125rem 0.375rem;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }
</style>
