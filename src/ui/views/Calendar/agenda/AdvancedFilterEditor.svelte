<!--
  AdvancedFilterEditor — Calendar Agenda formula filter editor (#022.6).

  Thin shell over `FormulaConstructorFull` (#077). The toolbar (Help toggle +
  validation badge) and the help panel are owned by the wrapper; this file only
  supplies Calendar-specific validate, snippets, and the Calendar-only function
  reference via `helpExtraCategories`.

  Public contract is preserved for the only consumer (`AgendaListEditor`):
    • props: `formula: string`, `fields: DataField[]`
    • event: `change` with `detail: string`

  Calendar agenda formulas use functions resolved by `parseFormula`
  (`IS_OVERDUE`, `IS_TODAY`, `HAS_ANY_OF`, …) which live outside the
  canonical `EXTENDED_FUNCTIONS` registry. We therefore pass a custom
  `validate` adapter built on `validateFormula` from `src/lib/formula`
  so that Calendar-specific functions are NOT flagged as "Unknown".
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DataField } from 'src/lib/dataframe/dataframe';
  import { validateFormula } from 'src/lib/formula';
  import { i18n } from 'src/lib/stores/i18n';
  import FormulaConstructorFull from 'src/ui/components/FormulaConstructor/FormulaConstructorFull.svelte';

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

  // Calendar-only functions that are resolved by `parseFormula` and therefore
  // absent from the metadata registry FormulaHelpPanel reads. Surfaced as extra
  // help sections so users still discover IS_OVERDUE/HAS_ANY_OF/etc.
  $: helpExtraCategories = [
    {
      title: t('help-title-dates'),
      entries: [
        { signature: 'IS_TODAY(date)' },
        { signature: 'IS_OVERDUE(date)' },
        { signature: 'IS_THIS_WEEK(date)' },
        { signature: 'IS_BEFORE(date1, date2)' },
        { signature: 'TOMORROW()' },
        { signature: 'YESTERDAY()' },
      ],
    },
    {
      title: t('help-title-checks'),
      entries: [
        { signature: 'IS_EMPTY(field)' },
        { signature: 'IS_NOT_EMPTY(field)' },
      ],
    },
    {
      title: t('help-title-arrays'),
      entries: [
        { signature: 'HAS_ANY_OF(tags, ["a","b"])' },
        { signature: 'HAS_ALL_OF(tags, ["a","b"])' },
      ],
    },
  ];

  function handleChange(e: CustomEvent<string>) {
    formula = e.detail;
    dispatch('change', formula);
  }
</script>

<FormulaConstructorFull
  value={formula}
  fields={fieldNames}
  validate={calendarValidate}
  {snippets}
  {helpExtraCategories}
  placeholder={t('textarea-placeholder')}
  rows={6}
  on:change={handleChange}
/>
