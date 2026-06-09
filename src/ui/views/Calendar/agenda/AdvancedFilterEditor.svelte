<!--
  AdvancedFilterEditor — Calendar Agenda formula filter editor (#022.6).

  Thin shell over the canonical `FormulaConstructor` (R5-022). Replaces the
  773 LOC ad-hoc implementation that had its own imperative DOM portal,
  parallel suggestion catalog, and UTF-8-mojibake literals.

  Public contract is preserved for the only consumer (`AgendaListEditor`):
    • props: `formula: string`, `fields: DataField[]`
    • event: `change` with `detail: string`

  Calendar agenda formulas use functions resolved by `parseFormula`
  (`IS_OVERDUE`, `IS_TODAY`, `HAS_ANY_OF`, …) which live outside the
  canonical `EXTENDED_FUNCTIONS` registry. We therefore pass a custom
  `validate` adapter built on `validateFormula` from `src/lib/formula`
  so that Calendar-specific functions are NOT flagged as "Unknown".

  Original file archived to `.ai_internal/Archive/OLD-AdvancedFilterEditor.svelte`.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DataField } from 'src/lib/dataframe/dataframe';
  import { validateFormula } from 'src/lib/formula';
  import { i18n } from 'src/lib/stores/i18n';
  import FormulaConstructor from 'src/ui/components/FormulaConstructor/FormulaConstructor.svelte';

  export let formula: string = '';
  export let fields: DataField[] = [];

  const dispatch = createEventDispatcher<{
    change: string;
  }>();

  // i18n helper rooted at the Calendar agenda advanced-filter namespace.
  $: t = (key: string, params?: Record<string, unknown>) =>
    params !== undefined
      ? $i18n.t(`views.calendar.agenda.custom.advanced-filter.${key}`, params)
      : $i18n.t(`views.calendar.agenda.custom.advanced-filter.${key}`);

  // Field-name list for FormulaConstructor (it expects string[], not DataField[]).
  $: fieldNames = fields.map((f) => f.name);

  // Calendar-aware validator. `validateFormula` returns ValidationError[];
  // FormulaConstructor's `validate` prop expects string[].
  // We use this validator instead of the canonical `validateFormulaExpression`
  // because Calendar agenda functions (`IS_OVERDUE`, `IS_TODAY`, etc.) are
  // resolved inside `parseFormula`, NOT in `EXTENDED_FUNCTIONS`. Using the
  // canonical validator would incorrectly flag them as "Unknown function".
  function calendarValidate(expr: string, availableFields: string[]): string[] {
    return validateFormula(expr, availableFields).map((e) => e.message);
  }

  // Snippet catalog tailored for Calendar agenda. Labels are localised via
  // i18n keys; insert strings are language-independent formula source.
  // Shape matches FormulaConstructor's FormulaSnippet type (label/insert/description).
  $: snippets = [
    {
      label: t('snippet-active-tasks'),
      insert: 'AND(status = "Active", IS_NOT_EMPTY(dueDate))',
      description: t('snippet-active-tasks-desc'),
    },
    {
      label: t('snippet-urgent-overdue'),
      insert: 'AND(IS_OVERDUE(dueDate), CONTAINS(tags, "urgent"))',
      description: t('snippet-urgent-overdue-desc'),
    },
    {
      label: t('snippet-this-week'),
      insert: 'IS_THIS_WEEK(dueDate)',
      description: t('snippet-this-week-desc'),
    },
    {
      label: t('snippet-undated-overdue'),
      insert: 'OR(IS_EMPTY(dueDate), IS_OVERDUE(dueDate))',
      description: t('snippet-undated-overdue-desc'),
    },
  ];

  // Toolbar state: help panel toggle + error count surfaced for badge.
  let showHelp = false;
  // Error count for validation badge — recomputed on every formula change.
  $: errorCount = formula.trim() ? validateFormula(formula, fieldNames).length : 0;

  function handleChange(e: CustomEvent<string>) {
    formula = e.detail;
    dispatch('change', formula);
  }
</script>

<div class="advanced-filter-editor">
  <!-- Toolbar: Help toggle + live validation badge -->
  <div class="editor-toolbar">
    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        class:active={showHelp}
        on:click={() => (showHelp = !showHelp)}
        title={t('toolbar-help')}
        aria-label={t('toolbar-help')}
      >
        <span class="toolbar-btn-icon" aria-hidden="true">?</span>
        <span>{t('toolbar-help')}</span>
      </button>
    </div>
    <div class="toolbar-hint">
      {#if errorCount > 0}
        <span class="hint-error">{t('hint-error', { count: errorCount })}</span>
      {:else if formula.trim()}
        <span class="hint-valid">{t('hint-valid')}</span>
      {:else}
        <span class="hint-info">{t('hint-ctrl-space')}</span>
      {/if}
    </div>
  </div>

  <!-- Help panel (collapsible) -->
  {#if showHelp}
    <div class="help-panel">
      <div class="help-columns">
        <div class="help-col">
          <h4>{t('help-title-logical')}</h4>
          <code>AND(a, b)</code>
          <code>OR(a, b)</code>
          <code>NOT(a)</code>

          <h4>{t('help-title-strings')}</h4>
          <code>CONTAINS(field, "text")</code>
          <code>STARTS_WITH(field, "x")</code>
          <code>ENDS_WITH(field, "x")</code>

          <h4>{t('help-title-checks')}</h4>
          <code>IS_EMPTY(field)</code>
          <code>IS_NOT_EMPTY(field)</code>
        </div>
        <div class="help-col">
          <h4>{t('help-title-dates')}</h4>
          <code>IS_TODAY(date)  IS_OVERDUE(date)</code>
          <code>IS_THIS_WEEK(date)</code>
          <code>IS_BEFORE(date1, date2)</code>
          <code>TODAY()  TOMORROW()  YESTERDAY()</code>
          <code>DATE_ADD(date, 1, "w")</code>

          <h4>{t('help-title-arrays')}</h4>
          <code>HAS_ANY_OF(tags, ["a","b"])</code>
          <code>HAS_ALL_OF(tags, ["a","b"])</code>

          <h4>{t('help-title-operators')}</h4>
          <code>=  !=  &gt;  &lt;  &gt;=  &lt;=  +  -  *  /</code>
        </div>
      </div>
      <div class="help-examples">
        <strong>{t('help-examples-title')}</strong>
        <code>AND(status = "Active", priority &gt; 5)</code>
        <code>OR(IS_EMPTY(dueDate), IS_OVERDUE(dueDate))</code>
        <code>AND(CONTAINS(tags, "urgent"), dueDate &lt;= TODAY())</code>
      </div>
    </div>
  {/if}

  <!-- Canonical formula editor (FormulaConstructor handles textarea,
       autocomplete dropdown via FloatingPopup, signature popover,
       Ctrl+Space force-open, snippet catalog, Esc/Tab/Enter, Ctrl+Enter). -->
  <FormulaConstructor
    value={formula}
    fields={fieldNames}
    validate={calendarValidate}
    {snippets}
    placeholder={t('textarea-placeholder')}
    rows={6}
    on:change={handleChange}
  />
</div>

<style>
  .advanced-filter-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    overflow: hidden;
  }

  /* ── Toolbar ── */
  .editor-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--size-4-1) var(--size-4-2);
    background: var(--background-secondary);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    gap: var(--size-4-2);
  }

  .toolbar-group {
    display: flex;
    gap: var(--size-4-1);
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.5rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toolbar-btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 0.875rem;
    height: 0.875rem;
    border-radius: 50%;
    border: 0.0625rem solid currentColor;
    font-size: 0.625rem;
    font-weight: 700;
    line-height: 1;
  }

  .toolbar-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .toolbar-btn.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .toolbar-hint {
    font-size: var(--font-ui-smaller);
    padding: 0 var(--size-4-1);
  }

  .hint-error { color: var(--text-error); font-weight: 600; }
  .hint-valid { color: var(--color-green); font-weight: 500; }
  .hint-info { color: var(--text-faint); }

  /* ── Help panel ── */
  .help-panel {
    padding: var(--size-4-2);
    background: var(--background-secondary);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    max-height: 14rem;
    overflow-y: auto;
  }

  .help-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--size-4-2);
  }

  .help-col h4 {
    margin: 0.35rem 0 0.15rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .help-col h4:first-child { margin-top: 0; }

  .help-col code,
  .help-examples code {
    display: block;
    padding: 0.1rem var(--size-4-1);
    margin: 0.1rem 0;
    background: var(--code-background);
    border-radius: var(--radius-s);
    font-family: var(--font-monospace);
    font-size: 0.65rem;
    color: var(--code-normal);
    line-height: 1.5;
  }

  .help-examples {
    margin-top: var(--size-4-2);
    padding-top: var(--size-4-2);
    border-top: 0.0625rem solid var(--background-modifier-border);
  }

  .help-examples strong {
    display: block;
    font-size: var(--font-ui-smaller);
    margin-bottom: var(--size-4-1);
    color: var(--text-muted);
  }
</style>
