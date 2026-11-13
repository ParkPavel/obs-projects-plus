<script lang="ts">
  /**
   * SearchField (stab-forms) — the one look and behaviour of a search string:
   * a search icon, the input, and a clear button that is visible whenever there
   * is something to clear (never hover-only). The query is the parent's; the
   * field reports each edit (`queryChange`) and a clear (`clear`, after
   * `queryChange` with ""). Keydown is forwarded so a consumer can add arrow
   * navigation; it must skip IME keys itself (`isImeKey`).
   */
  import { createEventDispatcher, onMount, onDestroy, tick } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { createDraftController, recordImeCompositionEnd } from "./draftController";
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
  export let expanded = true;
  export let readOnly = false;
  export let inputEl: HTMLInputElement | null = null;
  export let onConfirm: (() => void) | undefined = undefined;

  const dispatch = createEventDispatcher<{
    queryChange: string;
    clear: void;
  }>();

  let alive = true;
  const ctl = createDraftController(query);
  let text = query, reportedQuery = query;
  onDestroy(() => { alive = false; });
  export function isComposing(): boolean { return ctl.isComposing(); }
  /** An explicit completion replaces the query; ordinary prop echoes still do not. */
  export function reset(next: string): void { if (alive) { ctl.reset(next); pull(); reportedQuery = text; } }
  function confirm(): void { if (alive && !readOnly && !ctl.isComposing()) onConfirm?.(); }

  // i3-input: the field shows its own text while it has focus. The input was
  // bound to the parent's `query`, so a late or debounced echo of an older
  // query replaced what was being typed. A query the parent sets while the
  // field is not being typed in (a reset, a restore) is still shown.
  function pull(): void { text = ctl.getState().draft; }
  function adopt(next: string): void { if (ctl.refresh(next)) { pull(); reportedQuery = text; } }
  $: adopt(query);

  /** Move focus into the input. */
  export function focus(): void {
    if (alive) inputEl?.focus();
  }

  onMount(async () => {
    if (!focusOnMount) return;
    await tick();
    if (alive && inputEl?.isConnected) inputEl.focus();
  });

  function onInput(e: Event): void {
    if (readOnly) return;
    ctl.input((e.currentTarget as HTMLInputElement).value); pull(); reportQuery();
  }
  function reportQuery(): void {
    if (alive && !readOnly && !ctl.isComposing() && text !== reportedQuery) { reportedQuery = text; dispatch("queryChange", text); }
  }
  function onBlur(): void { ctl.blur(); pull(); }
  function onCompositionEnd(event: CompositionEvent): void {
    if (!alive) return;
    recordImeCompositionEnd(event);
    if (inputEl && inputEl.value !== text) ctl.input(inputEl.value);
    ctl.compositionEnd(); pull(); reportQuery();
    if (ctl.needsBlurCommit()) { ctl.blur(); pull(); }
  }
  function clear(): void {
    if (readOnly || ctl.isComposing()) return;
    ctl.input(""); pull(); reportQuery();
    dispatch("clear");
    inputEl?.focus();
  }
</script>

<div class="ppp-search-field">
  <span class="ppp-search-field-icon" aria-hidden="true"><Icon name="search" size="sm" /></span>
  <!-- svelte-ignore a11y-role-supports-aria-props -->
  <input
    bind:this={inputEl}
    use:keepInView={onConfirm ? { confirm } : undefined}
    class="ppp-search-field-input {inputClass}"
    type="text"
    role={controls ? "combobox" : "searchbox"}
    value={text}
    readonly={readOnly}
    {placeholder}
    aria-label={ariaLabel ?? (placeholder || undefined)}
    aria-controls={controls}
    aria-expanded={controls ? expanded : undefined}
    aria-autocomplete={controls ? "list" : undefined}
    aria-activedescendant={activeDescendant}
    autocomplete="off"
    spellcheck="false"
    on:input={onInput}
    on:focus={() => { ctl.focus(text); reportedQuery = text; }}
    on:blur={onBlur}
    on:keydown
    on:compositionstart={() => ctl.compositionStart()}
    on:compositionend={onCompositionEnd}
    on:mousedown|stopPropagation
  />
  {#if clearable && text !== ""}
    <button
      type="button"
      class="ppp-search-field-clear clickable-icon"
      aria-label={$i18n.t("common.clear", { defaultValue: "Clear" })}
      disabled={readOnly}
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
