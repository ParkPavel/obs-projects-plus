<script lang="ts">
  /**
   * SearchField (stab-forms) — the one look and behaviour of a search string:
   * a search icon, the input, and a clear button that is visible whenever there
   * is something to clear (never hover-only). The query is the parent's; the
   * field reports each edit (`queryChange`) and a clear (`clear`, after
   * `queryChange` with ""). Keydown is forwarded so a consumer can add arrow
   * navigation; it must skip IME keys itself (`isImeKey`).
   */
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { keepInView } from "./keepInView";

  export let query = "";
  export let placeholder = "";
  export let clearable = true;
  export let ariaLabel: string | undefined = undefined;
  /** Extra class on the input, for a consumer that styles or queries it. */
  export let inputClass = "";
  /** Focus the input once mounted (after a tick, so a portalled parent is in place). */
  export let focusOnMount = false;
  /**
   * Id of the listbox this field filters, when it drives one: the input is then
   * a combobox over that list, and `activeDescendant` names the option the
   * arrow keys are on.
   */
  export let controls: string | undefined = undefined;
  export let activeDescendant: string | undefined = undefined;

  const dispatch = createEventDispatcher<{
    queryChange: string;
    clear: void;
  }>();

  let inputEl: HTMLInputElement | null = null;

  /** Move focus into the input. */
  export function focus(): void {
    inputEl?.focus();
  }

  onMount(async () => {
    if (!focusOnMount) return;
    await tick();
    inputEl?.focus();
  });

  function onInput(e: Event): void {
    dispatch("queryChange", (e.currentTarget as HTMLInputElement).value);
  }
  function clear(): void {
    dispatch("queryChange", "");
    dispatch("clear");
    inputEl?.focus();
  }
</script>

<div class="ppp-search-field">
  <span class="ppp-search-field-icon" aria-hidden="true"><Icon name="search" size="sm" /></span>
  <!-- svelte-ignore a11y-role-supports-aria-props -->
  <input
    bind:this={inputEl}
    use:keepInView
    class="ppp-search-field-input {inputClass}"
    type="text"
    role={controls ? "combobox" : "searchbox"}
    value={query}
    {placeholder}
    aria-label={ariaLabel ?? (placeholder || undefined)}
    aria-controls={controls}
    aria-expanded={controls ? "true" : undefined}
    aria-autocomplete={controls ? "list" : undefined}
    aria-activedescendant={activeDescendant}
    autocomplete="off"
    spellcheck="false"
    on:input={onInput}
    on:keydown
    on:mousedown|stopPropagation
  />
  {#if clearable && query !== ""}
    <button
      type="button"
      class="ppp-search-field-clear clickable-icon"
      aria-label={$i18n.t("common.clear", { defaultValue: "Clear" })}
      on:mousedown|preventDefault
      on:click={clear}
    ><Icon name="x" size="sm" /></button>
  {/if}
</div>

<style>
  .ppp-search-field {
    display: flex;
    align-items: center;
    gap: var(--ppp-space-3, 0.375rem);
    min-width: 0;
    padding: 0 var(--ppp-space-3, 0.375rem);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--ppp-radius-md, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
  }
  .ppp-search-field:focus-within {
    border-color: var(--interactive-accent);
  }
  .ppp-search-field-icon {
    display: inline-flex;
    flex: none;
    color: var(--text-muted);
  }
  .ppp-search-field-input {
    flex: 1;
    min-width: 0;
    height: 1.75rem;
    padding: 0;
    border: none;
    background: transparent;
    box-shadow: none;
    color: var(--text-normal);
    font-size: var(--ppp-font-size-md, 0.8125rem);
    outline: none;
  }
  .ppp-search-field-input:focus {
    border: none;
    box-shadow: none;
  }
  .ppp-search-field-clear {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }
  @media (pointer: coarse) {
    .ppp-search-field-input {
      height: 2.75rem;
    }
    .ppp-search-field-clear {
      min-width: 2.75rem;
      min-height: 2.75rem;
    }
  }
</style>
