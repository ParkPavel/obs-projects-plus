<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { DataFieldType, type DataField, type DataValue, type Optional } from "src/lib/dataframe/dataframe";
  import ComboField from "src/ui/components/fields/ComboField.svelte";
  import { namesToOptions } from "src/ui/components/fields/comboOptions";
  import { i18n } from "src/lib/stores/i18n";
  import { cellDraftText, parseCellDraft } from "./typedCellDraft";
  import { onCellRetry } from "./tableEditing";
  type DateFormatConfig = import("src/settings/v3/settings").DateFormatConfig;
  export let field: DataField;
  export let value: Optional<DataValue>;
  export let options: string[] = [];
  export let dateFormat: DateFormatConfig | undefined = undefined;
  export let saving = false;
  export let retryVersion = 0;
  const dispatch = createEventDispatcher<{ commit: Optional<DataValue>; cancel: void; invalid: boolean }>();
  let input: ComboField;
  let invalid = false;
  const initial = cellDraftText(field, value, dateFormat);
  const retry = onCellRetry(() => input?.retryCommit());
  $: retry(retryVersion);
  $: choices = namesToOptions(options.map(raw => cellDraftText(field, raw, dateFormat))
    .filter(raw => raw.trim() !== "" && parseCellDraft(field, value, raw, dateFormat).ok));
  $: inputError = field.type === DataFieldType.Date
    ? $i18n.t("views.dashboard.table-v2.invalid-date", { defaultValue: "Complete the date; the stored value has not changed" })
    : $i18n.t("views.dashboard.table-v2.invalid-number", { defaultValue: "Enter a valid number; the stored value has not changed" });
  function setInvalid(on: boolean): void { invalid = on; dispatch("invalid", on); }
  function validate(raw: string): boolean {
    const result = parseCellDraft(field, value, raw, dateFormat);
    setInvalid(!result.ok); return result.ok;
  }
  function commit(raw: string): void {
    const result = parseCellDraft(field, value, raw, dateFormat);
    if (result.ok && !saving) dispatch("commit", result.value);
  }
</script>

<ComboField bind:this={input} value={initial} options={choices} {validate}
  readOnly={saving} allowCustom allowEmpty commitUnchanged preserveInvalidOnBlur
  commitOnDestroy={false} focusOnMount
  inputClass="ppp-t2-editor {field.type === DataFieldType.Number ? 'ppp-t2-editor--number' : field.type === DataFieldType.Date ? 'ppp-t2-editor--date' : ''}"
  aria-busy={saving}
  inputMode={field.type === DataFieldType.Number ? "decimal" : "text"}
  ariaLabel={invalid ? `${field.name}: ${inputError}` : field.name}
  title={invalid ? inputError : undefined}
  placeholder={field.type === DataFieldType.Date ? $i18n.t("common.date-typed-placeholder") : ""}
  on:draftChange={() => setInvalid(false)} on:commit={(e) => commit(e.detail.value)} on:cancel={() => dispatch("cancel")} />

<style>
  :global(.ppp-t2-editor) {
    width: 100%;
    min-width: 0;
    border: none;
    background: transparent;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    outline: none;
    padding: 0;
    height: 100%;
  }
  :global(.ppp-t2-editor--number) { text-align: right; font-variant-numeric: tabular-nums; }
</style>
