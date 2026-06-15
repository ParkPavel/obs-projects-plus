<script lang="ts">
  // FormulaBar — field-definition wrapper around FormulaConstructor (R5-022).
  //
  // Responsibility split:
  //   FormulaConstructor  → textarea + autocomplete + signature + validation errors
  //   FormulaBar          → field-name input + preview evaluation + apply/cancel actions
  //
  // The code/visual mode toggle and FormulaVisualEditor were removed (R5-022).
  // The visual node-editor approach was rejected — code mode is the only mode.

  import { createEventDispatcher, onDestroy } from "svelte";
  import {
    evaluateFormulaWithError,
    validateFormulaExpression,
  } from "src/lib/dashboard-engine/formulaEngine";
  import type { DataRecord, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import FormulaConstructor from "src/ui/components/FormulaConstructor/FormulaConstructor.svelte";
  import FormulaDebugPanel from "./FormulaDebugPanel.svelte";

  export let expression: string = "";
  export let fields: string[] = [];
  export let previewRecord: DataRecord | undefined = undefined;

  const dispatch = createEventDispatcher<{
    apply: { name: string; expression: string };
    cancel: void;
  }>();

  let fieldName = "";
  let inputValue = expression;
  // Keep inputValue in sync when parent changes formula (e.g. field switch).
  // Svelte reactive assignment, not an event — avoids double-fire on user input.
  let lastExpression = expression;
  $: if (expression !== lastExpression) {
    inputValue = expression;
    lastExpression = expression;
  }

  let previewValue: Optional<DataValue> = null;
  let runtimeError: string | null = null;
  let debugDismissed = false;
  let cursorPosition = 0;

  // DG-9: debounce live preview 300ms so formula evaluation doesn't fire on every keystroke
  let previewTimer: ReturnType<typeof setTimeout> | undefined;

  function schedulePreview(expr: string) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const hasContent = expr.trim().length > 0;
      const isValid = validateFormulaExpression(expr, fields).length === 0;
      if (hasContent && isValid && previewRecord) {
        const result = evaluateFormulaWithError(expr, previewRecord);
        previewValue = result.value;
        runtimeError = result.error ?? null;
      } else {
        previewValue = null;
        runtimeError = null;
      }
    }, 300);
  }

  $: schedulePreview(inputValue);

  onDestroy(() => clearTimeout(previewTimer));

  // Reset debug panel when runtime error is resolved, but NOT on every keystroke:
  // resetting while the user is still typing would dismiss the panel mid-edit.
  $: if (!runtimeError) debugDismissed = false;

  function formatPreview(val: Optional<DataValue>): string {
    if (val == null) return "–";
    if (typeof val === "boolean") return val ? "true" : "false";
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  }

  function handleApply() {
    dispatch("apply", { name: fieldName.trim(), expression: inputValue.trim() });
  }
</script>

<div class="ppp-formula-bar">
  <div class="ppp-formula-header">
    <span class="ppp-formula-title">{$i18n.t("views.dashboard.formula.title")}</span>
    <span class="ppp-formula-hint">{$i18n.t("views.dashboard.formula.hint")}</span>
  </div>

  <div class="ppp-formula-name-row">
    <label class="ppp-formula-label" for="formula-name">
      {$i18n.t("views.dashboard.formula.field-name")}
    </label>
    <input
      id="formula-name"
      class="ppp-formula-name-input"
      type="text"
      bind:value={fieldName}
      placeholder={$i18n.t("views.dashboard.formula.field-placeholder")}
    />
  </div>

  <FormulaConstructor
    bind:value={inputValue}
    {fields}
    highlight
    placeholder={$i18n.t("views.dashboard.formula.expression-placeholder")}
    rows={3}
    on:change={(e) => { inputValue = e.detail; }}
    on:commit={handleApply}
  />

  {#if runtimeError && !debugDismissed}
    <FormulaDebugPanel
      message={runtimeError}
      {cursorPosition}
      expression={inputValue}
      on:dismiss={() => (debugDismissed = true)}
    />
  {/if}

  {#if previewValue != null}
    <div class="ppp-formula-preview">
      <span class="ppp-formula-preview-label">{$i18n.t("views.dashboard.formula.preview")}</span>
      <span class="ppp-formula-preview-value">{formatPreview(previewValue)}</span>
    </div>
  {/if}

  <div class="ppp-formula-actions">
    <button class="ppp-btn ppp-btn--secondary" on:click={() => dispatch("cancel")}>
      {$i18n.t("views.dashboard.formula.cancel")}
    </button>
    <button
      class="ppp-btn ppp-btn--primary"
      disabled={!inputValue.trim() || !fieldName.trim()}
      on:click={handleApply}
    >
      {$i18n.t("views.dashboard.formula.apply")}
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
    border-radius: var(--radius-m, 0.375rem);
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

  .ppp-formula-hint {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
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
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
  }

  .ppp-formula-preview {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.25rem 0.5rem;
    background: var(--background-secondary);
    border-radius: var(--radius-s, 0.25rem);
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
    border-radius: var(--radius-s, 0.25rem);
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
