<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import dayjs from 'dayjs';
  import FormulaMode from 'src/ui/components/FormulaEditor/FormulaMode.svelte';
  import { formulaEditorSemantics, validateVersionedFormula } from 'src/lib/formula/version';
  import { evaluateAgendaFormula } from './filterEngine';
  import type { DataField, DataRecord } from 'src/lib/dataframe/dataframe';
  import { i18n } from 'src/lib/stores/i18n';
  import FormulaConstructorFull from 'src/ui/components/FormulaConstructor/FormulaConstructorFull.svelte';

  export let formula: string = '';
  export let fields: DataField[] = [];
  export let records: DataRecord[] = [];
  export let referenceDate: dayjs.Dayjs = dayjs();
  export let version: string | undefined = undefined;
  $: semantics = formulaEditorSemantics(version, 'legacy-filter');

  const dispatch = createEventDispatcher<{
    change: string;
    modechange: import("src/lib/formula/version").VersionedFormula;
  }>();

  // i18n helper rooted at the Calendar agenda advanced-filter namespace.
  $: t = (key: string, params?: Record<string, unknown>) =>
    params !== undefined
      ? $i18n.t(`views.calendar.agenda.custom.advanced-filter.${key}`, params)
      : $i18n.t(`views.calendar.agenda.custom.advanced-filter.${key}`);

  // Field-name list for FormulaConstructor (it expects string[], not DataField[]).
  $: fieldNames = fields.map((f) => f.name);

  // The selected executable profile owns validation as well as help.
  function calendarValidate(expr: string, availableFields: string[]): string[] {
    return validateVersionedFormula(expr, availableFields, version, 'legacy-filter');
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

  let previewCount: number | null = null;
  let previewError: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function schedulePreview(expression: string, savedVersion: string | undefined, source: DataRecord[], schema: DataField[], date: dayjs.Dayjs) {
    clearTimeout(timer);
    previewCount = null;
    previewError = null;
    timer = setTimeout(() => {
      if (!expression.trim() || validateVersionedFormula(expression, schema.map(field => field.name), savedVersion, 'legacy-filter').length) return;
      const result = evaluateAgendaFormula(source, expression, savedVersion, date, schema);
      previewCount = result.records.length;
      previewError = result.error;
    }, 700);
  }
  $: schedulePreview(formula, version, records, fields, referenceDate);
  onDestroy(() => clearTimeout(timer));

  function handleChange(e: CustomEvent<string>) {
    formula = e.detail;
    dispatch('change', formula);
  }
</script>

<FormulaMode {version} on:change={(event) => { version = event.detail.formulaVersion; dispatch("modechange", event.detail); }} />
{#if semantics}
<FormulaConstructorFull
  {semantics}
  value={formula}
  fields={fieldNames}
  validate={calendarValidate}
  {snippets}
  placeholder={t('textarea-placeholder')}
  rows={6}
  on:change={handleChange}
>
  <div slot="preview" aria-live="polite">
    {#if previewError}<p role="alert">{previewError}</p>
    {:else if previewCount !== null}<p class="ppp-formula-agenda-preview">{$i18n.t("formula-mode.matches", { count: previewCount, total: records.length })}</p>{/if}
  </div>
</FormulaConstructorFull>
{:else}
  <textarea value={formula} rows={6} readonly aria-label={t("textarea-placeholder")}></textarea>
{/if}
