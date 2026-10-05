<!--
  FormulaEditor — surface-agnostic formula editor shell (R5-022).

  Delegates the textarea + autocomplete + signature popover to FormulaConstructor.
  This component adds the slot API (header/footer/help) used by configuration
  modals and settings panels that need to embed a formula editor with custom chrome.

  Note: `enableVisualMode` prop and FormulaVisualEditor were removed (R5-022).
  The visual node-editor approach was rejected — code mode is the only surface.
-->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import FormulaConstructor from "src/ui/components/FormulaConstructor/FormulaConstructor.svelte";

  export let expression: string = "";
  export let placeholder: string = "";
  export let rows: number = 6;
  export let disabled: boolean = false;
  /** Opt-in syntax highlighting; on by default for embedded editors (#077). */
  export let highlight: boolean = true;
  /** Optional validator returning string[] error messages. */
  export let validate: ((expr: string) => string[]) | undefined = undefined;
  export const ariaLabel: string = "";
  /** Field names forwarded to FormulaConstructor for autocomplete. */
  export let fields: string[] = [];

  const dispatch = createEventDispatcher<{
    change: string;
    commit: string;
    cancel: void;
  }>();

  let inputValue: string = expression;
  let adopted: string = expression;
  let rootEl: HTMLElement | null = null;

  /**
   * Adopt `expression` from the parent only when it really changed and the
   * user is not typing in the formula. This lives in a function the `$:` below
   * calls, never in the statement itself: `inputValue` is bound, and in
   * Svelte 3 a binding to a variable assigned inside a `$:` statement re-runs
   * that statement on the next flush (R0.34) — the trap that reset typed
   * values in the 3.7.0 table cells.
   */
  function adoptExpression(next: string): void {
    if (next === inputValue) {
      // The parent echoing what is already shown is not a change to adopt.
      adopted = next;
      return;
    }
    if (next === adopted) return;
    const active = rootEl?.ownerDocument.activeElement;
    if (active instanceof HTMLTextAreaElement && rootEl?.contains(active)) return;
    adopted = next;
    inputValue = next;
  }
  $: adoptExpression(expression);

  // Adapt external `validate(expr)` to FormulaConstructor's `validate(expr, fields)` signature.
  // FormulaConstructor's default validator already uses `fields` — this wrapper
  // allows callers to provide a field-unaware validator without prop drilling.
  $: constructorValidate = validate
    ? (expr: string, _fields: string[]) => validate!(expr)
    : undefined;
</script>

<div class="formula-editor" bind:this={rootEl}>
  <slot name="header" />

  <FormulaConstructor
    bind:value={inputValue}
    {fields}
    {highlight}
    {placeholder}
    {rows}
    {disabled}
    {...(constructorValidate ? { validate: constructorValidate } : {})}
    on:change={(e) => { inputValue = e.detail; dispatch("change", e.detail); }}
    on:commit={() => dispatch("commit", inputValue)}
  />

  <slot name="help" />
  <slot name="footer" />
</div>

<style>
  .formula-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }
</style>
