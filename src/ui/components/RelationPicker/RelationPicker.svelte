<script lang="ts">
  /**
   * RelationPicker — reusable relation multi-select popover (R5-019).
   *
   * Extracted from GridRelationCell/RelationPopover.svelte to be a
   * shared component usable in any context (grid cells, modals,
   * record cards, config panels). The parent positions it via CSS;
   * this component handles search, chip display, and keyboard nav.
   *
   * Props:
   *   options  – candidate record names (bare, no [[...]]) to show in search list
   *   selected – currently selected bare record names
   *   onAdd    – called when user adds a record name
   *   onRemove – called when user removes a record name
   *   onClose  – called on Esc or outside-click
   */
  import { onMount, onDestroy } from "svelte";

  export let options: string[] = [];
  export let selected: string[] = [];
  export let onAdd: (name: string) => void;
  export let onRemove: (name: string) => void;
  export let onClose: () => void;

  let query = "";
  let inputEl: HTMLInputElement;
  let popoverEl: HTMLElement | null = null;

  $: filtered = options.filter(
    (o) => !selected.includes(o) && o.toLowerCase().includes(query.toLowerCase())
  );

  // Offer "Add X" when typed name isn't already in options or selected
  $: showCreate =
    query.trim() !== "" &&
    !options.some((o) => o.toLowerCase() === query.trim().toLowerCase()) &&
    !selected.some((s) => s.toLowerCase() === query.trim().toLowerCase());

  onMount(() => {
    setTimeout(() => inputEl?.focus(), 30);
    document.addEventListener("mousedown", handleOutsideClick, { capture: true });
  });
  onDestroy(() => {
    document.removeEventListener("mousedown", handleOutsideClick, { capture: true });
  });

  function handleAdd(name: string) {
    onAdd(name);
    query = "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      if (filtered.length > 0) {
        handleAdd(filtered[0]!);
      } else if (showCreate) {
        handleAdd(query.trim());
      }
    }
  }

  function handleOutsideClick(e: MouseEvent) {
    if (e.target instanceof Node && !popoverEl?.contains(e.target)) {
      onClose();
    }
  }
</script>

<div class="ppp-relpicker" bind:this={popoverEl} role="dialog" aria-label="Select relations">
  {#if selected.length > 0}
    <div class="ppp-relpicker-chips">
      {#each selected as name}
        <span class="ppp-relpicker-chip">
          <span class="ppp-relpicker-chip-label">{name}</span>
          <button
            class="ppp-relpicker-chip-remove"
            aria-label="Remove {name}"
            on:click|stopPropagation={() => onRemove(name)}
          >×</button>
        </span>
      {/each}
    </div>
  {/if}

  <div class="ppp-relpicker-search-wrap">
    <input
      bind:this={inputEl}
      bind:value={query}
      class="ppp-relpicker-search"
      placeholder="Search or add…"
      type="text"
      on:keydown={handleKeydown}
    />
  </div>

  <div class="ppp-relpicker-list" role="listbox">
    {#each filtered.slice(0, 20) as opt}
      <button
        class="ppp-relpicker-option"
        role="option"
        aria-selected="false"
        on:click|stopPropagation={() => handleAdd(opt)}
      >{opt}</button>
    {/each}
    {#if showCreate}
      <button
        class="ppp-relpicker-option ppp-relpicker-option--create"
        role="option"
        aria-selected="false"
        on:click|stopPropagation={() => handleAdd(query.trim())}
      >+ Add "{query.trim()}"</button>
    {/if}
    {#if filtered.length === 0 && !showCreate}
      <span class="ppp-relpicker-empty">No matches</span>
    {/if}
  </div>
</div>

<style>
  .ppp-relpicker {
    min-width: 14rem;
    max-width: 22rem;
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-m, 0.375rem);
    box-shadow: var(--shadow-l, 0 0.5rem 1.5rem rgba(0, 0, 0, 0.15));
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .ppp-relpicker-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.375rem 0.5rem 0;
  }

  .ppp-relpicker-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.0625rem 0.375rem;
    border-radius: 0.75rem;
    background: var(--ppp-chip-blue-bg, var(--interactive-accent));
    color: var(--ppp-chip-blue-fg, var(--text-on-accent));
    font-size: var(--font-ui-smaller);
    max-width: 10rem;
    overflow: hidden;
  }

  .ppp-relpicker-chip-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-relpicker-chip-remove {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
    font-size: 0.75rem;
  }

  .ppp-relpicker-chip-remove:hover {
    opacity: 1;
  }

  .ppp-relpicker-search-wrap {
    padding: 0.375rem 0.5rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }

  .ppp-relpicker-search {
    width: 100%;
    background: var(--background-modifier-form-field);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    padding: 0.25rem 0.5rem;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    outline: none;
    box-sizing: border-box;
  }

  .ppp-relpicker-search:focus {
    border-color: var(--interactive-accent);
  }

  .ppp-relpicker-list {
    max-height: 12rem;
    overflow-y: auto;
    padding: 0.25rem 0;
  }

  .ppp-relpicker-option {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.3125rem 0.75rem;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-relpicker-option:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-relpicker-option--create {
    color: var(--interactive-accent);
    font-style: italic;
  }

  .ppp-relpicker-empty {
    display: block;
    padding: 0.375rem 0.75rem;
    font-size: var(--font-ui-small);
    color: var(--text-faint);
  }
</style>
