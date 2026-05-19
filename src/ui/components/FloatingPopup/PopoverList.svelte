<!--
  PopoverList.svelte — presentational helper for FloatingPopup.

  Replaces the imperative `makePopover(anchor, items[])` API from the
  archived `popoverDropdown.ts`. Renders a flat list of selectable items
  with optional inline search. Reuses the global `.ppp-pop-*` CSS so the
  visual styling matches the legacy popover exactly.

  Wire-up in a consumer:
    <FloatingPopup triggerEl={…} bind:open …>
      <PopoverList {items} {searchable} on:select={handle} />
    </FloatingPopup>

  The parent owns the popup open state. Item.handler runs locally on
  select; the parent decides whether to close (default) or keep open
  (when item.keepOpen === true).

  Item interactions use `mousedown` with `preventDefault` so the
  originating focused element (e.g. a `<input>` triggering a type-ahead
  popover) keeps focus and keystrokes continue to flow into it.
-->
<script lang="ts" context="module">
  export interface PopoverItem {
    label: string;
    icon?: string;
    selected?: boolean;
    /** When true, the parent should not close the popover after select. */
    keepOpen?: boolean;
    /** Optional callback invoked alongside the `select` event. */
    handler?: () => void;
  }
</script>

<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { setIcon } from "obsidian";

  export let items: PopoverItem[] = [];
  export let searchable: boolean = false;

  const dispatch = createEventDispatcher<{
    select: { item: PopoverItem; keepOpen: boolean };
  }>();

  let query = "";

  $: filtered = (() => {
    if (!searchable) return items;
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.label.toLowerCase().includes(q));
  })();

  function handleSelect(item: PopoverItem, e: MouseEvent): void {
    // Preserve focus of an external trigger (e.g. text input).
    e.preventDefault();
    item.handler?.();
    dispatch("select", { item, keepOpen: item.keepOpen === true });
  }

  function iconAction(node: HTMLElement, icon: string) {
    setIcon(node, icon);
    return {
      update(next: string) {
        node.empty();
        setIcon(node, next);
      },
    };
  }

  // When the search field is mounted (searchable), focus it so typing
  // narrows results. This is opt-in: FloatingPopup's autoFocus prop
  // can be set to `false` by callers that need the original trigger
  // to keep focus instead.
  let searchInput: HTMLInputElement | null = null;
  $: if (searchable && searchInput) {
    void focusSearch();
  }
  async function focusSearch(): Promise<void> {
    await tick();
    searchInput?.focus();
  }
</script>

{#if searchable}
  <div class="ppp-pop-search">
    <input
      bind:this={searchInput}
      type="text"
      class="ppp-pop-search-input"
      placeholder="🔍"
      bind:value={query}
      on:mousedown|stopPropagation
    />
  </div>
{/if}

<div class="ppp-pop-list" role="presentation">
  {#each filtered as item (item.label)}
    <button
      type="button"
      role="menuitem"
      class="ppp-pop-item"
      class:ppp-pop-item--selected={item.selected}
      on:mousedown={(e) => handleSelect(item, e)}
    >
      {#if item.icon}
        <span class="ppp-pop-muted" use:iconAction={item.icon}></span>
      {/if}
      <span class="ppp-popover-label">{item.label}</span>
      {#if item.selected}
        <span
          class="ppp-pop-muted ppp-pop-item-check"
          style="color: var(--interactive-accent);"
          use:iconAction={"check"}
        ></span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .ppp-pop-search {
    padding: var(--ppp-space-2, 0.25rem) var(--ppp-space-4, 0.5rem);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }
  .ppp-pop-search-input {
    width: 100%;
    height: 1.75rem;
    padding: 0 var(--ppp-space-3, 0.375rem);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--ppp-radius-md, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--ppp-font-size-md, 0.8125rem);
    outline: none;
  }
  .ppp-pop-search-input:focus {
    border-color: var(--interactive-accent);
  }
  .ppp-popover-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppp-pop-item:hover {
    background: var(--background-modifier-hover);
  }
</style>
