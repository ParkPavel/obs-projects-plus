<script lang="ts">
  /**
   * FilterPills — purely presentational Notion-style filter pills (#077).
   *
   * Renders enabled filter conditions as removable pills plus an "add"
   * trigger. Owns no filter state, no popup, no engine — consumers
   * (BlockFilterBar, ViewFilterBar) wire remove/addClick to their own
   * FilterPanel + FloatingPopup. Single shared implementation.
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { FilterCondition } from "src/settings/base/settings";
  import { getOperatorLabel } from "src/ui/components/Navigation/SettingsMenu/tabs/filterHelpers";

  export let conditions: FilterCondition[] = [];
  export let readonly = false;
  export let ariaLabel: string | undefined = undefined;
  export let addLabel: string | undefined = undefined;
  export let removeLabel: string | undefined = undefined;
  export let triggerEl: HTMLButtonElement | null = null;
  export let open = false;

  const dispatch = createEventDispatcher<{ remove: number; addClick: void }>();

  $: enabled = conditions.filter((c) => c.enabled !== false);
  $: resolvedAria = ariaLabel ?? $i18n.t("components.filter-pills.aria", { defaultValue: "Filter" });
  $: resolvedAdd = addLabel ?? $i18n.t("components.filter-pills.add", { defaultValue: "Filter" });
  $: resolvedRemove = removeLabel ?? $i18n.t("components.filter-pills.remove", { defaultValue: "Remove condition" });

  function pillText(cond: FilterCondition): string {
    const tail = cond.value !== undefined && cond.value !== "" ? ` ${cond.value}` : "";
    return `${cond.field} ${getOperatorLabel(cond.operator)}${tail}`;
  }
</script>

{#if !readonly || enabled.length > 0}
  <div class="ppp-filterpills" role="toolbar" aria-label={resolvedAria}>
    {#each enabled as cond, i (`${cond.field}-${i}`)}
      <span class="ppp-filterpills-pill">
        <span class="ppp-filterpills-pill-text">{pillText(cond)}</span>
        {#if !readonly}
          <button
            class="ppp-filterpills-pill-x clickable-icon"
            on:click={() => dispatch("remove", i)}
            aria-label={resolvedRemove}
          ><Icon name="x" size="sm" /></button>
        {/if}
      </span>
    {/each}
    {#if !readonly}
      <button
        bind:this={triggerEl}
        class="ppp-filterpills-add"
        class:ppp-filterpills-add--active={open}
        on:click={() => dispatch("addClick")}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name="filter" size="sm" />
        {enabled.length === 0 ? resolvedAdd : ""}
      </button>
    {/if}
  </div>
{/if}

<style>
  .ppp-filterpills {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .ppp-filterpills-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.1875rem;
    height: 1.75rem;
    padding: 0 0.5rem;
    border: 0.0625rem solid var(--interactive-accent);
    border-radius: 0.875rem;
    background: transparent;
    color: var(--text-accent);
    font-size: var(--font-ui-smaller);
  }

  .ppp-filterpills-pill-text {
    max-width: 16rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-filterpills-pill-x {
    display: inline-flex;
    align-items: center;
    border: none;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    padding: 0;
  }

  .ppp-filterpills-pill-x:hover {
    color: var(--text-normal);
  }

  .ppp-filterpills-add {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    height: 1.75rem;
    padding: 0 0.5rem;
    border: none;
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
  }

  .ppp-filterpills-add:hover,
  .ppp-filterpills-add--active {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }
</style>
