<script lang="ts">
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { FilterTabConfig } from "../../types";
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let config: Record<string, unknown>;
  export let source: DataFrame;

  const dispatch = createEventDispatcher<{ filter: { field: string; value: string | null } }>();

  let activeTab: string | null = null;

  // Access typed config from raw object
  $: field = (config["field"] as string) ?? "";
  // Reset active tab when field changes
  $: field, (activeTab = null);
  $: configTabs = (config["tabs"] as FilterTabConfig[] | undefined) ?? [];
  $: showAll = (config["showAll"] as boolean) ?? true;
  $: uniqueValues = field ? extractUniqueValues(source, field) : [];
  $: tabs = configTabs.length
    ? configTabs
    : uniqueValues.map((v, i) => ({ id: `_auto_${i}`, label: v, field, value: v }));

  function extractUniqueValues(df: DataFrame, fieldName: string): string[] {
    const seen = new Set<string>();
    for (const record of df.records) {
      const val = record.values[fieldName];
      if (val != null && val !== "") {
        seen.add(String(val));
      }
    }
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function onTabClick(value: string | null) {
    activeTab = value;
    dispatch("filter", { field, value });
  }

  function onKeyDown(e: KeyboardEvent) {
    const target = e.currentTarget as HTMLElement;
    const parent = target.parentElement;
    if (!parent) return;
    const buttons = Array.from(parent.querySelectorAll<HTMLElement>('[role="tab"]'));
    const idx = buttons.indexOf(target);
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % buttons.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + buttons.length) % buttons.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = buttons.length - 1;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      target.click();
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      buttons[next]?.focus();
    }
  }
</script>

<div class="ppp-filter-tabs" role="tablist">
  {#if showAll}
    <button
      class="ppp-filter-tab"
      class:active={activeTab === null}
      role="tab"
      aria-selected={activeTab === null}
      tabindex={activeTab === null ? 0 : -1}
      on:click={() => onTabClick(null)}
      on:keydown={onKeyDown}
    >
      {$i18n.t("views.database.filter-tabs.all")}
    </button>
  {/if}
  {#each tabs as tab (tab.id)}
    <button
      class="ppp-filter-tab"
      class:active={activeTab === tab.value}
      role="tab"
      aria-selected={activeTab === tab.value}
      tabindex={activeTab === tab.value ? 0 : -1}
      on:click={() => onTabClick(tab.value)}
      on:keydown={onKeyDown}
    >
      {tab.label}
    </button>
  {/each}
</div>

<style>
  .ppp-filter-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .ppp-filter-tab {
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .ppp-filter-tab:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-filter-tab:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: -2px;
  }

  .ppp-filter-tab.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }
</style>
