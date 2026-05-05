<!--
  R3.1 — Shared FormulaEditor shell (Stage 1 skeleton).

  Surface-agnostic textarea-based formula input with:
  - Controlled `expression` prop with parent-reset support
    (architect risk #1: lastExpression guard pattern)
  - Optional `validate` callback returning string[] of error messages
  - Slots: `header` (mode toggle / name input), `footer` (Apply/Cancel),
    `help` (hint or extended help panel)
  - Events: `change` (every keystroke), `commit` (Ctrl/Cmd+Enter),
    `cancel` (Esc)

  Stage 1 deliberately omits autocomplete + signature popover + engine
  adapter; those land in Stage 3 (FormulaBar migration) where the
  Database engine is already a peer dependency. Stage 2 (YamlVisualizer
  modal) only needs the shell.
-->
<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let expression: string = "";
  export let placeholder: string = "";
  export let rows: number = 6;
  export let disabled: boolean = false;
  export let validate: ((expr: string) => string[]) | undefined = undefined;
  export let ariaLabel: string = "";

  const dispatch = createEventDispatcher<{
    change: string;
    commit: string;
    cancel: void;
  }>();

  // Local mirror of `expression` so the parent can imperatively reset
  // (e.g. modal reopened with a new field). Bare `let inputValue =
  // expression` would only run at mount; the `lastExpression` guard
  // re-syncs whenever the parent prop changes.
  let inputValue: string = expression;
  let lastExpression: string = expression;
  $: if (expression !== lastExpression) {
    inputValue = expression;
    lastExpression = expression;
  }

  $: errors =
    validate && inputValue.trim().length > 0 ? validate(inputValue) : [];

  function handleInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    inputValue = target.value;
    dispatch("change", inputValue);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      dispatch("commit", inputValue);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      dispatch("cancel");
    }
  }
</script>

<div class="formula-editor">
  <slot name="header" />

  <textarea
    class="formula-editor__textarea"
    class:formula-editor__textarea--invalid={errors.length > 0}
    {rows}
    {placeholder}
    {disabled}
    aria-label={ariaLabel || placeholder}
    aria-invalid={errors.length > 0}
    value={inputValue}
    on:input={handleInput}
    on:keydown={handleKeydown}
  />

  {#if errors.length > 0}
    <ul class="formula-editor__errors" role="alert">
      {#each errors as err}
        <li>{err}</li>
      {/each}
    </ul>
  {/if}

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
  .formula-editor__textarea {
    width: 100%;
    font-family: var(--font-monospace);
    font-size: 0.875rem;
    line-height: 1.4;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.25rem;
    background: var(--background-primary);
    color: var(--text-normal);
    resize: vertical;
  }
  .formula-editor__textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }
  .formula-editor__textarea--invalid {
    border-color: var(--text-error);
  }
  .formula-editor__errors {
    margin: 0;
    padding-left: 1.25rem;
    color: var(--text-error);
    font-size: 0.8125rem;
    list-style: disc;
  }
</style>
