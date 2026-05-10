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
  /** Optional validator returning string[] error messages. */
  export let validate: ((expr: string) => string[]) | undefined = undefined;
  export let ariaLabel: string = "";
  /** Field names forwarded to FormulaConstructor for autocomplete. */
  export let fields: string[] = [];

  const dispatch = createEventDispatcher<{
    change: string;
    commit: string;
    cancel: void;
  }>();

  let inputValue: string = expression;
  let lastExpression: string = expression;
  $: if (expression !== lastExpression) {
    inputValue = expression;
    lastExpression = expression;
  }

  // Adapt external `validate(expr)` to FormulaConstructor's `validate(expr, fields)` signature.
  // FormulaConstructor's default validator already uses `fields` — this wrapper
  // allows callers to provide a field-unaware validator without prop drilling.
  $: constructorValidate = validate
    ? (expr: string, _fields: string[]) => validate!(expr)
    : undefined;
</script>

<div class="formula-editor">
  <slot name="header" />

  <FormulaConstructor
    bind:value={inputValue}
    {fields}
    {placeholder}
    {rows}
    {disabled}
    validate={constructorValidate}
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
