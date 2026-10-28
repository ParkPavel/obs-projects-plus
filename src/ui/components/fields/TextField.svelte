<script lang="ts">
  /**
   * TextField (stab-forms) — the one text input with a draft. The control owns
   * its text while the user is in it; the `value` prop is only ever read, so a
   * parent that re-renders with the old value cannot overwrite an edit that
   * commits later (R0.34). Enter and blur commit once; Escape restores the text
   * the field had on entry; an IME composition suppresses Enter and Escape.
   * Consumers own validation (`validate`) and persistence (`commit`).
   */
  import { createEventDispatcher } from "svelte";
  import { createDraftController, isImeKey } from "./draftController";
  import { keepInView } from "./keepInView";
  import { releaseOnOutsideTap } from "./releaseOnOutsideTap";

  export let value = "";
  export let placeholder = "";
  export let disabled = false;
  export let inputMode: "text" | "numeric" | "decimal" | "search" | "email" | "url" | "tel" | "none" = "text";
  /** A draft that fails is not committed; the field is marked invalid. */
  export let validate: ((draft: string) => boolean) | undefined = undefined;
  export let id: string | undefined = undefined;
  export let ariaLabel: string | undefined = undefined;
  export let inputClass = "";
  /** The consumer's own verdict on the value (a name already taken). */
  export let error = false;
  /** Report a blur that changed nothing (a cell editor that must leave edit mode). */
  export let commitUnchanged = false;

  /** A consumer whose persistence failed can keep the draft and permit retry. */
  export function retryCommit(): void { ctl.arm(); }
  /** A containing editor owns Tab navigation; commit through this field once. */
  export function commitForNavigation(): void { emit("tab"); }

  const dispatch = createEventDispatcher<{
    input: string;
    commit: { value: string; reason: "enter" | "blur" | "tab" };
    cancel: void;
  }>();

  const ctl = createDraftController(value);
  let draft = value;
  let invalid = false;
  let inputEl: HTMLInputElement | null = null;

  function pull(): void {
    draft = ctl.getState().draft;
  }
  function adopt(next: string): void {
    if (ctl.refresh(next)) pull();
  }
  $: adopt(value);

  /** Replace the text outright, without a commit (a form cleared after use). */
  export function reset(next: string): void {
    ctl.reset(next);
    pull();
    invalid = false;
  }

  /** Move focus into the field. */
  export function focus(): void {
    inputEl?.focus();
  }

  /** Focus the field with its whole text selected (a rename). */
  export function select(): void {
    inputEl?.focus();
    inputEl?.select();
  }

  function accepts(text: string): boolean {
    const ok = validate ? validate(text) : true;
    invalid = !ok;
    return ok;
  }

  function emit(reason: "enter" | "blur" | "tab"): void {
    const verdict = accepts(ctl.getState().draft);
    const result = reason === "blur" ? ctl.blur({ accept: verdict, unchanged: commitUnchanged }) : ctl.commit(reason, { accept: verdict, unchanged: commitUnchanged });
    pull();
    // A rejected draft left on blur was restored, so nothing is invalid any more.
    if (reason === "blur") invalid = false;
    if (result) dispatch("commit", { value: result.value, reason });
  }

  function onFocus(): void {
    ctl.focus(draft);
  }
  function onInput(e: Event): void {
    ctl.input((e.currentTarget as HTMLInputElement).value);
    pull();
    invalid = false;
    dispatch("input", draft);
  }
  function onKeydown(e: KeyboardEvent): void {
    if (ctl.isComposing(e) || isImeKey(e)) return;
    if (e.key === "Enter") {
      e.preventDefault();
      emit("enter");
    } else if (e.key === "Escape") {
      const edited = ctl.getState().draft !== ctl.getState().baseline;
      ctl.cancel();
      pull();
      invalid = false;
      // The restore consumed this Escape; an untouched field lets it through.
      if (edited) e.stopPropagation();
      dispatch("cancel");
    }
  }
</script>

<input
  bind:this={inputEl}
  use:keepInView
  use:releaseOnOutsideTap
  {id}
  class="ppp-text-field {inputClass}"
  class:ppp-text-field--invalid={invalid || error}
  type="text"
  inputmode={inputMode}
  autocapitalize="off"
  autocorrect="off"
  value={draft}
  {placeholder}
  {disabled}
  aria-label={ariaLabel}
  aria-invalid={invalid || error ? "true" : undefined}
  on:focus={onFocus}
  on:blur={() => emit("blur")}
  on:input={onInput}
  on:keydown={onKeydown}
  on:compositionstart={() => ctl.compositionStart()}
  on:compositionend={() => ctl.compositionEnd()}
  {...$$restProps}
/>

<style>
  .ppp-text-field {
    min-width: 0;
    min-inline-size: 0;
    max-inline-size: 100%;
    text-overflow: ellipsis;
    color: var(--text-normal);
  }
  .ppp-text-field--invalid {
    border-color: var(--text-error);
  }
</style>
