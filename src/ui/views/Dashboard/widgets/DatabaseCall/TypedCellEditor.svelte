<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import type { DataField, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { dateInputValue } from "src/lib/helpers/dateShape";
  import { toNumber } from "src/lib/engine/numeric";
  import { isImeKey } from "src/ui/components/fields/draftController";
  import { i18n } from "src/lib/stores/i18n";
  import { editedCellValue } from "./editedCellValue";

  type DateFormatConfig = import("src/settings/v3/settings").DateFormatConfig;
  export let field: DataField;
  export let value: Optional<DataValue>;
  export let dateFormat: DateFormatConfig | undefined = undefined;

  const dispatch = createEventDispatcher<{ commit: Optional<DataValue>; cancel: void; invalid: boolean }>();
  // Mounted only during editing: seed once, never reset the draft on a flush.
  let draft = field.type === DataFieldType.Date ? dateInputValue(value, dateFormat?.writeFormat) : value == null ? "" : String(value);
  let inputEl: HTMLInputElement | null = null;
  let committed = false;
  let composing = false;
  let invalid = false;
  void tick().then(() => inputEl?.focus());

  $: inputError = field.type === DataFieldType.Date
    ? $i18n.t("views.dashboard.table-v2.invalid-date", { defaultValue: "Complete the date; the stored value has not changed" })
    : $i18n.t("views.dashboard.table-v2.invalid-number", { defaultValue: "Enter a valid number; the stored value has not changed" });

  function setInvalid(on: boolean): void {
    invalid = on;
    dispatch("invalid", on);
  }

  function commitDraft(): void {
    if (committed || composing) return;
    // Empty deliberately clears; native incomplete dates also report empty.
    setInvalid((field.type === DataFieldType.Number && draft.trim() !== "" && toNumber(draft) === null) ||
      (field.type === DataFieldType.Date && inputEl?.validity.badInput === true));
    if (invalid) return;
    committed = true;
    dispatch("commit", editedCellValue(field, value, draft, dateFormat));
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (composing || isImeKey(e)) return;
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

{#if field.type === DataFieldType.Date}
  <input bind:this={inputEl} class="ppp-t2-editor" type="date" bind:value={draft}
    aria-label={invalid ? `${field.name}: ${inputError}` : field.name}
    title={invalid ? inputError : undefined} aria-invalid={invalid ? "true" : undefined}
    on:input={() => setInvalid(false)} on:keydown={handleKeydown} on:blur={commitDraft} />
{:else}
<input bind:this={inputEl} class="ppp-t2-editor" type="text"
  class:ppp-t2-editor--number={field.type === DataFieldType.Number}
  inputmode={field.type === DataFieldType.Number ? "decimal" : undefined}
  aria-label={invalid ? `${field.name}: ${inputError}` : field.name}
  title={invalid ? inputError : undefined} aria-invalid={invalid ? "true" : undefined}
  on:input={() => setInvalid(false)}
  on:compositionstart={() => { composing = true; }} on:compositionend={() => { composing = false; }}
  bind:value={draft} on:keydown={handleKeydown} on:blur={commitDraft} />
{/if}

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
