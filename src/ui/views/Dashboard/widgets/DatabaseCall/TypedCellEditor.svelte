<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import type { DataField, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { isImeKey, recordImeCompositionEnd } from "src/ui/components/fields/draftController";
  import { keepInView } from "src/ui/components/fields/keepInView";
  import { i18n } from "src/lib/stores/i18n";
  import { cellDraftText, parseCellDraft } from "./typedCellDraft";
  import { onCellRetry } from "./tableEditing";

  type DateFormatConfig = import("src/settings/v3/settings").DateFormatConfig;
  export let field: DataField;
  export let value: Optional<DataValue>;
  export let dateFormat: DateFormatConfig | undefined = undefined;
  export let saving = false;
  export let retryVersion = 0;

  const dispatch = createEventDispatcher<{ commit: Optional<DataValue>; cancel: void; invalid: boolean }>();
  // Mounted only during editing: seed once, never reset the draft on a flush.
  let draft = cellDraftText(field, value, dateFormat);
  let inputEl: HTMLInputElement | null = null;
  let committed = false;
  let composing = false;
  let invalid = false;
  const retry = onCellRetry(() => { committed = false; });
  $: retry(retryVersion);
  void tick().then(() => inputEl?.focus());

  $: inputError = field.type === DataFieldType.Date
    ? $i18n.t("views.dashboard.table-v2.invalid-date", { defaultValue: "Complete the date; the stored value has not changed" })
    : $i18n.t("views.dashboard.table-v2.invalid-number", { defaultValue: "Enter a valid number; the stored value has not changed" });

  function setInvalid(on: boolean): void {
    invalid = on;
    dispatch("invalid", on);
  }

  function commitDraft(): void {
    if (committed || composing || saving) return;
    const parsed = parseCellDraft(field, value, draft, dateFormat);
    setInvalid(!parsed.ok);
    if (!parsed.ok) return;
    committed = true;
    dispatch("commit", parsed.value);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (saving || composing || isImeKey(e)) return;
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Escape") {
      e.preventDefault();
      committed = true;
      dispatch("cancel");
    }
  }
</script>

<!-- 3.7.2 B1: a date is typed too (14.10.2026, 1.11, «завтра»); the day goes on as YYYY-MM-DD. -->
<input use:keepInView={{ confirm: commitDraft }} bind:this={inputEl} class="ppp-t2-editor" type="text" bind:value={draft}
  class:ppp-t2-editor--number={field.type === DataFieldType.Number} class:ppp-t2-editor--date={field.type === DataFieldType.Date}
  inputmode={field.type === DataFieldType.Number ? "decimal" : undefined}
  enterkeyhint="done"
  readonly={saving} aria-busy={saving}
  placeholder={field.type === DataFieldType.Date ? $i18n.t("common.date-typed-placeholder") : undefined}
  aria-label={invalid ? `${field.name}: ${inputError}` : field.name}
  title={invalid ? inputError : undefined} aria-invalid={invalid ? "true" : undefined}
  on:input={() => setInvalid(false)}
  on:compositionstart={() => { composing = true; }} on:compositionend={(event) => { recordImeCompositionEnd(event); composing = false; }}
  on:keydown={handleKeydown} on:blur={commitDraft} />

<style>
  .ppp-t2-editor {
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

  .ppp-t2-editor--number {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
