<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import {
    evaluateFormulaValue,
    validateFormulaExpression,
    getFormulaFunctions,
  } from "../engine/formulaEngine";
  import type { DataRecord, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import FormulaVisualEditor from "./FormulaVisualEditor.svelte";

  export let expression: string = "";
  export let fields: string[] = [];
  export let previewRecord: DataRecord | undefined = undefined;

  const dispatch = createEventDispatcher<{
    apply: { name: string; expression: string };
    cancel: void;
  }>();

  let fieldName = "";
  let inputValue = expression;
  // Keep inputValue in sync when parent changes formula (e.g. field switch)
  let lastExpression = expression;
  $: if (expression !== lastExpression) {
    inputValue = expression;
    lastExpression = expression;
  }
  let errors: string[] = [];
  let previewValue: Optional<DataValue> = null;
  let showSuggestions = false;
  let cursorWord = "";
  let filteredSuggestions: string[] = [];
  let selectedSuggestionIndex = -1;
  let mode: "code" | "visual" = "code";

  const allFunctions = getFormulaFunctions();

  $: {
    errors = inputValue.trim()
      ? validateFormulaExpression(inputValue, fields)
      : [];
    previewValue =
      inputValue.trim() && errors.length === 0 && previewRecord
        ? evaluateFormulaValue(inputValue, previewRecord)
        : null;
  }

  $: {
    const word = cursorWord.toUpperCase();
    if (word.length > 0) {
      const fnMatches = allFunctions.filter((f) => f.startsWith(word));
      const fieldMatches = fields.filter((f) =>
        f.toUpperCase().startsWith(word)
      );
      filteredSuggestions = [...fnMatches, ...fieldMatches].slice(0, 12);
    } else {
      filteredSuggestions = [];
    }
    selectedSuggestionIndex = -1;
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    inputValue = target.value;

    // Extract word at cursor for autocomplete
    const pos = target.selectionStart ?? 0;
    const before = inputValue.substring(0, pos);
    const match = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    cursorWord = match ? match[0] : "";
    showSuggestions = cursorWord.length > 0 && filteredSuggestions.length > 0;
  }

  function insertSuggestion(suggestion: string) {
    const doc = activeDocument ?? document;
    const textarea = doc.querySelector(
      ".ppp-formula-input"
    ) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const pos = textarea.selectionStart ?? 0;
    const before = inputValue.substring(0, pos);
    const after = inputValue.substring(pos);
    const match = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    const replaceFrom = match ? pos - match[0].length : pos;

    // If it's a function, add parentheses
    const isFunc = allFunctions.includes(suggestion);
    const insert = isFunc ? suggestion + "(" : suggestion;

    inputValue =
      inputValue.substring(0, replaceFrom) + insert + after;
    showSuggestions = false;
    cursorWord = "";

    // Restore focus
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = replaceFrom + insert.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (showSuggestions) {
        showSuggestions = false;
        e.stopPropagation();
      } else {
        dispatch("cancel");
      }
    }
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedSuggestionIndex =
          selectedSuggestionIndex < filteredSuggestions.length - 1
            ? selectedSuggestionIndex + 1
            : 0;
        scrollSuggestionIntoView();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedSuggestionIndex =
          selectedSuggestionIndex > 0
            ? selectedSuggestionIndex - 1
            : filteredSuggestions.length - 1;
        scrollSuggestionIntoView();
        return;
      }
      if (e.key === "Enter" && !e.ctrlKey && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        insertSuggestion(filteredSuggestions[selectedSuggestionIndex] as string);
        return;
      }
    }
    if (e.key === "Enter" && e.ctrlKey) {
      if (errors.length === 0 && inputValue.trim()) {
        dispatch("apply", { name: fieldName.trim(), expression: inputValue.trim() });
      }
    }
    if (e.key === "Tab" && showSuggestions && filteredSuggestions.length > 0) {
      e.preventDefault();
      const idx = selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0;
      insertSuggestion(filteredSuggestions[idx] as string);
    }
  }

  function scrollSuggestionIntoView() {
    requestAnimationFrame(() => {
      const doc = activeDocument ?? document;
      const el = doc.querySelector(".ppp-formula-suggestion--selected");
      if (el) el.scrollIntoView({ block: "nearest" });
    });
  }

  function formatPreview(val: Optional<DataValue>): string {
    if (val == null) return "—";
    if (typeof val === "boolean") return val ? "true" : "false";
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  }
</script>

<div class="ppp-formula-bar" on:keydown={handleKeydown}>
  <div class="ppp-formula-header">
    <span class="ppp-formula-title">{$i18n.t("views.database.formula.title")}</span>
    <div class="ppp-formula-mode-toggle">
      <button
        class="ppp-mode-btn"
        class:ppp-mode-btn--active={mode === "code"}
        on:click={() => mode = "code"}
      >
        {$i18n.t("views.database.formula.mode-code")}
      </button>
      <button
        class="ppp-mode-btn"
        class:ppp-mode-btn--active={mode === "visual"}
        on:click={() => mode = "visual"}
      >
        {$i18n.t("views.database.formula.mode-visual")}
      </button>
    </div>
    <span class="ppp-formula-hint">{$i18n.t("views.database.formula.hint")}</span>
  </div>

  <div class="ppp-formula-name-row">
    <label class="ppp-formula-label" for="formula-name">{$i18n.t("views.database.formula.field-name")}</label>
    <input
      id="formula-name"
      class="ppp-formula-name-input"
      type="text"
      bind:value={fieldName}
      placeholder={$i18n.t("views.database.formula.field-placeholder")}
    />
  </div>

  {#if mode === "code"}
    <div class="ppp-formula-editor">
      <textarea
        class="ppp-formula-input"
        class:ppp-formula-input--error={errors.length > 0}
        value={inputValue}
        on:input={handleInput}
        placeholder={$i18n.t("views.database.formula.expression-placeholder")}
        rows="3"
        spellcheck="false"
      ></textarea>

      {#if showSuggestions && filteredSuggestions.length > 0}
        <div class="ppp-formula-suggestions" role="listbox">
          {#each filteredSuggestions as suggestion, i}
            <button
              class="ppp-formula-suggestion"
              class:ppp-formula-suggestion--fn={allFunctions.includes(suggestion)}
              class:ppp-formula-suggestion--selected={i === selectedSuggestionIndex}
              role="option"
              aria-selected={i === selectedSuggestionIndex}
              on:click|stopPropagation={() => insertSuggestion(suggestion)}
            >
              {suggestion}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="ppp-formula-editor">
      <FormulaVisualEditor
        expression={inputValue}
        {fields}
        on:change={(e) => { inputValue = e.detail; }}
      />
    </div>
  {/if}

  {#if errors.length > 0}
    <div class="ppp-formula-errors">
      {#each errors as error}
        <div class="ppp-formula-error">{error}</div>
      {/each}
    </div>
  {/if}

  {#if previewValue != null}
    <div class="ppp-formula-preview">
      <span class="ppp-formula-preview-label">{$i18n.t("views.database.formula.preview")}</span>
      <span class="ppp-formula-preview-value">{formatPreview(previewValue)}</span>
    </div>
  {/if}

  <div class="ppp-formula-actions">
    <button class="ppp-btn ppp-btn--secondary" on:click={() => dispatch("cancel")}>
      {$i18n.t("views.database.formula.cancel")}
    </button>
    <button
      class="ppp-btn ppp-btn--primary"
      disabled={errors.length > 0 || !inputValue.trim() || !fieldName.trim()}
      on:click={() => dispatch("apply", { name: fieldName.trim(), expression: inputValue.trim() })}
    >
      {$i18n.t("views.database.formula.apply")}
    </button>
  </div>
</div>

<style>
  .ppp-formula-bar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 6px);
    font-size: var(--font-ui-small);
  }

  .ppp-formula-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .ppp-formula-title {
    font-weight: 600;
    color: var(--text-normal);
  }

  .ppp-formula-mode-toggle {
    display: inline-flex;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    overflow: hidden;
  }

  .ppp-mode-btn {
    padding: 0.125rem 0.5rem;
    font-size: var(--font-ui-smaller);
    border: none;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .ppp-mode-btn:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-mode-btn--active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-mode-btn--active:hover {
    background: var(--interactive-accent-hover);
  }

  .ppp-formula-hint {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }

  .ppp-formula-editor {
    position: relative;
  }

  .ppp-formula-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ppp-formula-label {
    color: var(--text-muted);
    white-space: nowrap;
  }

  .ppp-formula-name-input {
    flex: 1;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
  }

  .ppp-formula-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    background: var(--background-secondary);
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-size: var(--font-ui-small);
    resize: vertical;
    min-height: 4rem;
    box-sizing: border-box;
  }

  .ppp-formula-input:focus {
    border-color: var(--interactive-accent);
    outline: none;
  }

  .ppp-formula-input--error {
    border-color: var(--text-error);
  }

  .ppp-formula-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 10;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    max-height: 12rem;
    overflow-y: auto;
    box-shadow: var(--shadow-s, 0 2px 8px rgba(0,0,0,0.15));
  }

  .ppp-formula-suggestion {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.25rem 0.5rem;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-size: var(--font-ui-small);
  }

  .ppp-formula-suggestion:hover,
  .ppp-formula-suggestion--selected {
    background: var(--background-modifier-hover);
  }

  .ppp-formula-suggestion--fn {
    color: var(--text-accent);
  }

  .ppp-formula-errors {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .ppp-formula-error {
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
  }

  .ppp-formula-preview {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.25rem 0.5rem;
    background: var(--background-secondary);
    border-radius: var(--radius-s, 4px);
  }

  .ppp-formula-preview-label {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }

  .ppp-formula-preview-value {
    font-family: var(--font-monospace);
    color: var(--text-normal);
  }

  .ppp-formula-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .ppp-btn {
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: var(--radius-s, 4px);
    font-size: var(--font-ui-small);
    cursor: pointer;
  }

  .ppp-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ppp-btn--primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-btn--primary:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }

  .ppp-btn--secondary {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-btn--secondary:hover {
    background: var(--background-modifier-border);
  }
</style>
