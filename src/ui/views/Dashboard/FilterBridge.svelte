<script lang="ts">
  import type { FilterCondition } from "src/settings/base/settings";
  import { i18n } from "src/lib/stores/i18n";
  import { createEventDispatcher } from "svelte";

  export let activeGlobalFilters: FilterCondition[];
  export let activeFilterTab: { field: string; value: string | null } | null;
  export let globalFilterTooltip: string;
  export let readonly: boolean;
  export let canPromote: boolean;

  const dispatch = createEventDispatcher<{
    promote: void;
    clear: void;
  }>();
</script>

{#if activeGlobalFilters.length > 0 || activeFilterTab}
  <div class="ppp-filter-bridge" role="status" aria-live="polite">
    {#if activeGlobalFilters.length > 0}
      <span class="ppp-filter-bridge-chip ppp-filter-bridge-chip--global" title={globalFilterTooltip}>
        <span class="ppp-filter-bridge-icon" aria-hidden="true">🌐</span>
        <span class="ppp-filter-bridge-label">
          {$i18n.t("views.dashboard.canvas.filter-bridge-global", {
            defaultValue: "Global filter: {{count}} condition(s)",
            count: activeGlobalFilters.length,
          })}
        </span>
      </span>
    {/if}
    {#if activeFilterTab}
      <span class="ppp-filter-bridge-chip ppp-filter-bridge-chip--local">
        <span class="ppp-filter-bridge-icon" aria-hidden="true">⎘</span>
        <span class="ppp-filter-bridge-label">
          {$i18n.t("views.dashboard.canvas.filter-bridge-local", {
            defaultValue: "Local: {{field}} = {{value}}",
            field: activeFilterTab.field,
            value: activeFilterTab.value,
          })}
        </span>
        {#if canPromote && !readonly}
          <button
            class="ppp-filter-bridge-promote"
            type="button"
            on:click={() => dispatch("promote")}
            title={$i18n.t("views.dashboard.canvas.filter-bridge-promote", { defaultValue: "Save as global filter" })}
            aria-label={$i18n.t("views.dashboard.canvas.filter-bridge-promote", { defaultValue: "Save as global filter" })}
          >↥</button>
        {/if}
        <button
          class="ppp-filter-bridge-clear"
          type="button"
          on:click={() => dispatch("clear")}
          title={$i18n.t("views.dashboard.canvas.filter-bridge-clear", { defaultValue: "Clear local filter" })}
          aria-label={$i18n.t("views.dashboard.canvas.filter-bridge-clear", { defaultValue: "Clear local filter" })}
        >×</button>
      </span>
    {/if}
  </div>
{/if}

<style>
  .ppp-filter-bridge {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .ppp-filter-bridge-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.1875rem 0.5rem;
    font-size: var(--font-ui-smaller);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
  }

  .ppp-filter-bridge-chip--global {
    border-color: var(--interactive-accent);
    color: var(--text-normal);
  }

  .ppp-filter-bridge-chip--local {
    border-color: var(--color-orange, var(--text-accent));
    color: var(--text-normal);
  }

  .ppp-filter-bridge-icon {
    font-size: 0.75rem;
    line-height: 1;
  }

  .ppp-filter-bridge-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    padding: 0;
    margin-left: 0.125rem;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .ppp-filter-bridge-clear:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-filter-bridge-promote {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    padding: 0;
    margin-left: 0.125rem;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--interactive-accent);
    font-size: 0.75rem;
    line-height: 1;
    cursor: pointer;
  }

  .ppp-filter-bridge-promote:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
</style>
