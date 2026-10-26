<script lang="ts">
  /**
   * w4-filters (N11) — the value of one filter condition, the same cell on
   * every surface: the view's filter, colour rules and the agenda's lists.
   *
   * A date compared with a day (`is-on`, `is-before`, …) takes a date formula
   * — `today`, `today+7d`, `sow` — with its suggestions (the agenda had this
   * alone; the view's filter now reads the formula too, see filterEvaluator).
   * Anything else is the value box with the project's suggestions (w4-p05).
   * Typing reports `input`; a pick, Enter or leaving the box reports `commit`.
   */
  import { createEventDispatcher } from "svelte";
  import ValueSuggestField from "src/ui/components/fields/ValueSuggestField.svelte";
  import DateFormulaInput from "src/ui/views/Calendar/agenda/DateFormulaInput.svelte";
  import { getFilterOperatorType, type FilterOperator } from "src/settings/base/settings";

  export let fieldType: string | undefined;
  export let operator: FilterOperator;
  export let value: string;
  export let suggestions: string[] = [];
  export let placeholder = "";
  export let ariaLabel = "";

  const dispatch = createEventDispatcher<{ input: string; commit: string }>();

  $: dateFormula =
    (fieldType === "date" || fieldType === "autotime") && getFilterOperatorType(operator) === "binary-date";
</script>

{#if dateFormula}
  <DateFormulaInput {value} {placeholder} on:input={(e) => dispatch("input", e.detail)} />
{:else}
  <ValueSuggestField
    {value}
    {suggestions}
    {placeholder}
    {ariaLabel}
    on:input={(e) => dispatch("input", e.detail)}
    on:commit={(e) => dispatch("commit", e.detail)}
  />
{/if}
