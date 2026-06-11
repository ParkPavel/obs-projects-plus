<script lang="ts">
  /**
   * CellChoiceDropdown — F2.2 (TABLE_V2_CANON §3). Select/Status in-place
   * editor: search input + filtered option list. Option creation UX
   * (colored "Create …" row) lands with the header property editor in F2.4.
   */
  import { createEventDispatcher, tick } from "svelte";

  export let draft: string;
  export let options: string[] = [];

  const dispatch = createEventDispatcher<{
    commit: string;
    cancel: void;
  }>();

  let inputEl: HTMLInputElement | null = null;
  void tick().then(() => inputEl?.focus());

  $: filtered = options.filter(
    (o) => draft.trim() === "" || o.toLowerCase().includes(draft.trim().toLowerCase())
  );

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      dispatch("commit", draft);
    } else if (e.key === "Escape") {
      e.preventDefault();
      dispatch("cancel");
    }
  }
</script>

<div class="ppp-t2-choice">
  <input
    bind:this={inputEl}
    class="ppp-t2-choice-input"
    type="text"
    bind:value={draft}
    on:keydown={handleKeydown}
    on:blur={() => setTimeout(() => dispatch("commit", draft), 150)}
  />
  {#if filtered.length > 0}
    <div class="ppp-t2-choice-list" role="listbox">
      {#each filtered as opt (opt)}
        <button
          class="ppp-t2-choice-item"
          role="option"
          aria-selected={opt === draft}
          on:mousedown|preventDefault={() => dispatch("commit", opt)}
        >{opt}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .ppp-t2-choice {
    width: 100%;
    position: relative;
  }

  .ppp-t2-choice-input {
    width: 100%;
    min-width: 0;
    border: none;
    background: transparent;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    outline: none;
    padding: 0;
  }

  .ppp-t2-choice-list {
    position: absolute;
    top: calc(100% + 0.375rem);
    left: -0.5rem;
    min-width: 10rem;
    max-height: 12rem;
    overflow-y: auto;
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    box-shadow: var(--ppp-shadow-md, 0 4px 12px rgba(15, 15, 15, 0.1));
    z-index: 3;
    padding: 0.25rem;
  }

  .ppp-t2-choice-item {
    display: block;
    width: 100%;
    padding: 0.25rem 0.5rem;
    border: none;
    background: transparent;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    text-align: left;
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }

  .ppp-t2-choice-item:hover {
    background: var(--background-modifier-hover);
  }
</style>
