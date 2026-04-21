<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { sanitizeColor } from "../../engine/conditionalFormat";

  export let groupKey: string;
  export let count: number;
  export let collapsed: boolean;
  export let color: string | null = null;
  /** Nesting level: 0 = top-level group, 1 = sub-group */
  export let level: number = 0;

  $: safeColor = color ? sanitizeColor(color) : null;

  const dispatch = createEventDispatcher<{
    toggle: void;
  }>();
</script>

<button
  class="ppp-group-header"
  class:ppp-group-header--collapsed={collapsed}
  class:ppp-group-header--sub={level > 0}
  style:padding-left="{0.5 + level * 1.25}rem"
  on:click={() => dispatch("toggle")}
>
  <span class="ppp-group-chevron">
    {collapsed ? "▸" : "▾"}
  </span>
  {#if safeColor}
    <span class="ppp-group-dot" style:background-color={safeColor}></span>
  {/if}
  <span class="ppp-group-name">{groupKey || $i18n.t("views.database.group.empty")}</span>
  <span class="ppp-group-count">{count}</span>
</button>

<style>
  .ppp-group-header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    padding: 0.375rem 0.5rem;
    border: none;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary-alt, var(--background-secondary));
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    font-weight: 600;
    cursor: pointer;
    text-align: left;
  }

  .ppp-group-header:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-group-header--sub {
    font-size: calc(var(--font-ui-small) - 1px);
    font-weight: 500;
  }

  .ppp-group-chevron {
    flex-shrink: 0;
    width: 1rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .ppp-group-dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .ppp-group-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-group-count {
    flex-shrink: 0;
    color: var(--text-faint);
    font-weight: 400;
    font-size: var(--font-ui-smaller);
  }
</style>
