<script lang="ts">
  // DateFormulaInput — inline date-formula filter cell (#077, slice 4).
  //
  // Thin wrapper over the canonical FormulaConstructor. The parallel imperative
  // portal, hand-rolled keyboard nav, and inline-style suggestion renderer were
  // removed: date suggestions now flow through FormulaConstructor's snippet
  // catalog (Ctrl+Space) and its FloatingPopup dropdown. Inline cell sizing is
  // preserved via the `.date-formula-input` scope overriding the FC textarea
  // min-height (FC defaults to a multi-line editor).

  import { createEventDispatcher } from 'svelte';
  import { Icon } from 'obsidian-svelte';
  import { getDateFormulaSuggestions, isDateFormula } from 'src/lib/formula';
  import FormulaConstructor, {
    type FormulaSnippet,
  } from 'src/ui/components/FormulaConstructor/FormulaConstructor.svelte';

  const dispatch = createEventDispatcher<{
    input: string;
  }>();

  export let value: string = '';
  export let placeholder: string = '';

  // Bridge date-formula suggestions into FormulaConstructor's snippet catalog.
  // DateFormulaSuggestion {formula,label,description} → FormulaSnippet
  // {label, insert, description}.
  const snippets: FormulaSnippet[] = getDateFormulaSuggestions().map((s) => ({
    label: `${s.formula} — ${s.label}`,
    insert: s.formula,
    description: s.description,
  }));

  // Date filter cells accept short DQL tokens (today, sow, today+1w). They are
  // NOT validated against the formula engine, so suppress error decoration.
  function noValidate(): string[] {
    return [];
  }

  $: isFormula = isDateFormula(value);

  function handleChange(e: CustomEvent<string>) {
    value = e.detail;
    dispatch('input', value);
  }
</script>

<div class="date-formula-input" class:is-formula={isFormula}>
  <FormulaConstructor
    {value}
    fields={[]}
    validate={noValidate}
    {snippets}
    {placeholder}
    rows={1}
    on:change={handleChange}
  />
  {#if isFormula}
    <div class="formula-indicator" title="Date formula detected">
      <Icon name="calendar-clock" size="xs" />
    </div>
  {/if}
</div>

<style>
  .date-formula-input {
    position: relative;
    min-width: 0;
    width: 100%;
  }

  /* Collapse FormulaConstructor's multi-line editor into a single inline cell. */
  .date-formula-input :global(.ppp-fc-textarea) {
    height: 1.625rem;
    min-height: 1.625rem;
    padding: 0.25rem 1.5rem 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    resize: none;
    overflow: hidden;
    white-space: nowrap;
  }

  .date-formula-input.is-formula :global(.ppp-fc-textarea) {
    border-color: var(--interactive-accent);
    background: var(--background-primary-alt);
  }

  .formula-indicator {
    position: absolute;
    right: 0.375rem;
    top: 0.8125rem;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    color: var(--interactive-accent);
    pointer-events: none;
  }

  @media (pointer: coarse) {
    .date-formula-input :global(.ppp-fc-textarea) {
      height: 2.125rem;
      min-height: 2.125rem;
      font-size: 0.875rem;
    }

    .formula-indicator {
      top: 1.0625rem;
    }
  }
</style>
