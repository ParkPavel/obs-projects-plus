<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { getDateFormulaSuggestions, isDateFormula } from "src/lib/formula";
  import ValueSuggestField from "src/ui/components/fields/ValueSuggestField.svelte";
  export let value = "";
  export let placeholder = "";
  const dispatch = createEventDispatcher<{ input: string; commit: string }>();
  let reported = value;
  $: reported = value;
  function report(next: string): void {
    if (next === reported) return;
    reported = next;
    dispatch("input", next);
  }
  $: isFormula = isDateFormula(value);
  $: choices = getDateFormulaSuggestions().map(option => ({
    id: option.formula, value: option.formula, label: option.label,
    aliases: [option.formula, option.description], icon: "calendar",
  }));
</script>

<div class="date-formula-input" class:is-formula={isFormula}>
  <ValueSuggestField {value} {choices} {placeholder}
    ariaLabel={placeholder || $i18n.t("data-types.date")}
    on:input={(event) => report(event.detail)}
    on:commit={(event) => {
      report(event.detail);
      dispatch("commit", event.detail);
    }} />
  {#if isFormula}
    <span class="formula-indicator" title={$i18n.t("views.calendar.agenda.date-formula-detected")}><Icon name="calendar-clock" size="xs" /></span>
  {/if}
</div>

<style>
  .date-formula-input { position: relative; min-width: 0; width: 100%; }
  .date-formula-input :global(input.ppp-value-field-input) { padding-right: 1.5rem; }
  .date-formula-input.is-formula :global(input.ppp-value-field-input) { border-color: var(--interactive-accent); }
  .formula-indicator { position: absolute; right: 0.375rem; top: 50%; transform: translateY(-50%); display: flex; color: var(--interactive-accent); pointer-events: none; }
</style>
