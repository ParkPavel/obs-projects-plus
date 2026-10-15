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

  Items are chosen by pointer, touch or keyboard. A pointer press selects on
  `mousedown` with `preventDefault` so the originating focused element (e.g.
  a text field triggering a type-ahead popover) keeps focus and keystrokes
  continue to flow into it; the `click` that ends the same tap is ignored.
  A click with no press before it (Enter or Space on a focused item, an
  assistive-technology activation) selects too. In the search field
  ArrowDown/ArrowUp move the active item and Enter chooses it.
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
  import { createEventDispatcher } from "svelte";
  import { setIcon } from "obsidian";
  import { i18n } from "src/lib/stores/i18n";
  import SearchField from "src/ui/components/fields/SearchField.svelte";
  import { isImeKey } from "src/ui/components/fields/draftController";
  import { filterOptions, stepActive } from "src/ui/components/fields/comboOptions";

  export let items: PopoverItem[] = [];
  export let searchable: boolean = false;

  const dispatch = createEventDispatcher<{
    select: { item: PopoverItem; keepOpen: boolean };
  }>();

  let query = "";
  // The item the arrow keys are on; -1 until the user types or navigates.
  let activeIdx = -1;
  // The item a pointer just chose, so the click of the same tap does not choose it again.
  let pointerPicked: string | null = null;

  $: filtered = searchable ? filterOptions(items, query) : items;

  function setQuery(next: string): void {
    query = next;
    activeIdx = searchable && filterOptions(items, next).length > 0 && next.trim() !== "" ? 0 : -1;
  }

  function pick(item: PopoverItem): void {
    item.handler?.();
    dispatch("select", { item, keepOpen: item.keepOpen === true });
  }

  function onItemMouseDown(item: PopoverItem, e: MouseEvent): void {
    // Preserve focus of an external trigger (e.g. text input).
    e.preventDefault();
    pointerPicked = item.label;
    pick(item);
  }

  function onItemClick(item: PopoverItem): void {
    if (pointerPicked === item.label) {
      pointerPicked = null;
      return;
    }
    pick(item);
  }

  function onSearchKeydown(e: KeyboardEvent): void {
    if (isImeKey(e)) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = stepActive(activeIdx, e.key === "ArrowDown" ? 1 : -1, filtered.length);
    } else if (e.key === "Enter") {
      const item = activeIdx >= 0 ? filtered[activeIdx] : undefined;
      if (!item) return;
      e.preventDefault();
      pick(item);
    }
  }

  function iconAction(node: HTMLElement, icon: string) {
    setIcon(node, icon);
    return {
      update(next: string) {
        node.replaceChildren();
        setIcon(node, next);
      },
    };
  }
</script>

{#if searchable}
  <div class="ppp-pop-search">
    <SearchField
      {query}
      focusOnMount
      inputClass="ppp-pop-search-input"
      ariaLabel={$i18n.t("common.search", { defaultValue: "Search" })}
      on:queryChange={(e) => setQuery(e.detail)}
      on:keydown={onSearchKeydown}
    />
  </div>
{/if}

<div class="ppp-pop-list" role="presentation">
  {#each filtered as item, i (item.label)}
    <button
      type="button"
      role="menuitem"
      class="ppp-pop-item"
      class:ppp-pop-item--selected={item.selected}
      class:ppp-pop-item--active={i === activeIdx}
      on:mousedown={(e) => onItemMouseDown(item, e)}
      on:click={() => onItemClick(item)}
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
  .ppp-popover-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppp-pop-item:hover,
  .ppp-pop-item--active {
    background: var(--background-modifier-hover);
  }
</style>
