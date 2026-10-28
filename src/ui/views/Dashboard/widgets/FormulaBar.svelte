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
  import type { DataFrame, DataRecord, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import type { FormulaFieldDef } from "../types";
  import { previewFormulaField, formulaWouldCycle } from "./formulaPreview";
  import { isImeKey } from "src/ui/components/fields/draftController";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import { i18n } from "src/lib/stores/i18n";
  import FormulaConstructor from "src/ui/components/FormulaConstructor/FormulaConstructor.svelte";
  import FormulaDebugPanel from "./FormulaDebugPanel.svelte";

  export let expression: string = "";
  export let fields: string[] = [];
  export let previewRecord: DataRecord | undefined = undefined;
  export let previewFrame: DataFrame | undefined = undefined;
  export let formulaFields: readonly FormulaFieldDef[] = [];

  const dispatch = createEventDispatcher<{
    apply: { name: string; expression: string };
    cancel: void;
  }>();

  let fieldName = "";
  let inputValue = expression;
  let adopted = expression;
  let barEl: HTMLElement | null = null;
  // Keep inputValue in sync when the parent changes the formula (e.g. a field
  // switch) — only on a real change, and not while the user types in it. The
  // assignment lives in a function the `$:` calls: `inputValue` is bound, and
  // a bound variable assigned inside a `$:` statement is re-run over the
  // user's text on the next flush in Svelte 3 (R0.34).
  function adoptExpression(next: string): void {
    if (next === inputValue) {
      adopted = next;
      // A parent that comes back to what is shown cancels an earlier deferred change.
      deferred = null;
      return;
    }
    if (next === adopted) {
      deferred = null;
      return;
    }
    const active = barEl?.ownerDocument.activeElement;
    if (active instanceof HTMLTextAreaElement && barEl?.contains(active)) {
      deferred = next;
      return;
    }
    deferred = null;
    adopted = next;
    inputValue = next;
  }

  /** A parent change that arrived while the user was in the formula. */
  let deferred: string | null = null;

  /**
   * On leaving the formula, take a deferred parent change if the user did not
   * edit the text meanwhile; text the user typed wins over it.
   */
  function adoptDeferred(e: FocusEvent): void {
    if (deferred === null) return;
    if (e.relatedTarget instanceof Node && barEl?.contains(e.relatedTarget)) return;
    const next = deferred;
    deferred = null;
    if (inputValue !== adopted) return;
    adopted = next;
    inputValue = next;
  }
  $: adoptExpression(expression);

  let previewValue: Optional<DataValue> = null;
  let runtimeError: string | null = null;
  let debugDismissed = false;
  let cursorPosition = 0;
  $: previewCyclic = formulaWouldCycle(formulaFields, fieldName.trim(), inputValue);
  $: nameTaken = fields.includes(fieldName.trim()) && !formulaFields.some(definition => definition.name === fieldName.trim());
  $: canApply = !!fieldName.trim() && !!inputValue.trim() && !nameTaken && !previewCyclic && validateFormulaExpression(inputValue, fields).length === 0;

  // DG-9 / B5: preview waits for a 150 ms pause in typing; hints do not wait
  let previewTimer: ReturnType<typeof setTimeout> | undefined;

  function schedulePreview(expr: string, name: string, source: DataFrame | undefined, definitions: readonly FormulaFieldDef[]) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const hasContent = expr.trim().length > 0;
      const isValid = validateFormulaExpression(expr, fields).length === 0;
      if (hasContent && isValid && source) {
        const result = previewFormulaField(source, definitions, name.trim(), expr);
        previewValue = result.value;
        runtimeError = result.error;
      } else if (hasContent && isValid && previewRecord) {
        const result = evaluateFormulaWithError(expr, previewRecord);
        previewValue = result.value;
        runtimeError = result.error ?? null;
      } else {
        previewValue = null;
        runtimeError = null;
      }
    }, 150);
  }

  $: schedulePreview(inputValue, fieldName, previewFrame, formulaFields);

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
    const name = fieldName.trim();
    const taken = fields.includes(name) && !formulaFields.some(definition => definition.name === name);
    if (!name || !inputValue.trim() || taken || formulaWouldCycle(formulaFields, name, inputValue) || validateFormulaExpression(inputValue, fields).length > 0) return;
    dispatch("apply", { name: fieldName.trim(), expression: inputValue.trim() });
  }
</script>

<div class="ppp-formula-bar" bind:this={barEl} on:focusout={adoptDeferred}
  on:keydown={(event) => { if (event.key === "Escape" && !isImeKey(event)) dispatch("cancel"); }}>
  <div class="ppp-formula-header">
    <span class="ppp-formula-title">{$i18n.t("views.dashboard.formula.title")}</span>
    <span class="ppp-formula-hint">{$i18n.t("views.dashboard.formula.hint")}</span>
  </div>
  <p class="ppp-formula-scope">{$i18n.t("views.dashboard.formula.scope")}</p>
  {#if formulaFields.length > 0}
    <div class="ppp-formula-saved" aria-label={$i18n.t("views.dashboard.formula.saved")}>
      {#each formulaFields as definition (definition.name)}
        <button type="button" on:click={() => { fieldName = definition.name; inputValue = definition.expression; }}>
          ƒ {definition.name}
        </button>
      {/each}
    </div>
  {/if}

  <div class="ppp-formula-name-row">
    <label class="ppp-formula-label" for="formula-name">
      {$i18n.t("views.dashboard.formula.field-name")}
    </label>
    <TextField
      id="formula-name"
      inputClass="ppp-formula-name-input"
      value={fieldName}
      on:input={(event) => (fieldName = event.detail)}
      on:cancel={() => dispatch("cancel")}
      placeholder={$i18n.t("views.dashboard.formula.field-placeholder")}
    />
  </div>
  {#if nameTaken}<p role="alert">{$i18n.t("modals.field.create.existing-name-error")}</p>{/if}
  {#if previewCyclic}<p role="alert">{$i18n.t("views.dashboard.formula.cycle")}</p>{/if}

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
      disabled={!canApply}
      on:click={handleApply}
    >
      {$i18n.t("views.dashboard.formula.apply")}
    </button>
  </div>
</div>

<style>
  .ppp-formula-scope { margin: 0; color: var(--text-muted); }
  .ppp-formula-saved { display: flex; flex-wrap: wrap; gap: 0.25em; }
  .ppp-formula-bar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--background-primary);
    border: var(--ppp-border-width) solid var(--background-modifier-border);
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

  .ppp-formula-name-row :global(.ppp-formula-name-input) {
    flex: 1;
    padding: 0.25rem 0.5rem;
    border: var(--ppp-border-width) solid var(--background-modifier-border);
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
