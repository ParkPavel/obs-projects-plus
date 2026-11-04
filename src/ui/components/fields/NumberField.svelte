<script lang="ts">
  /**
   * NumberField (3.7.2 B1b) — a TextField that holds a number. The draft is
   * text (so "1." or "-" survive while typing); a commit parses it with
   * `toNumber` and hands the consumer a number, or `null` for an empty field
   * when `allowEmpty`. A draft that is not a number, or falls outside
   * `min`/`max`, is not committed. `inputmode="decimal"` brings up the digit
   * keyboard on a phone without the spinner and wheel of `type="number"`.
   */
  import { createEventDispatcher } from "svelte";
  import { toNumber } from "src/lib/engine/numeric";
  import ComboField from "./ComboField.svelte";
  import { namesToOptions } from "./comboOptions";

  export let value: number | null | undefined = null;
  export let placeholder = "";
  export let disabled = false;
  export let min: number | undefined = undefined;
  export let max: number | undefined = undefined;
  /** Whole numbers only. */
  export let integer = false;
  /** An emptied field commits `null` instead of being rejected. */
  export let allowEmpty = false;
  export let id: string | undefined = undefined;
  export let ariaLabel: string | undefined = undefined;
  export let inputClass = "";
  export let suggestions: string[] = [];
  export let preserveInvalidOnBlur = false;

  /**
   * `input` reports each keystroke that reads as an acceptable number (a
   * live setting); `commit` reports Enter or leaving the field.
   */
  const dispatch = createEventDispatcher<{ input: number | null; commit: number | null; cancel: void }>();

  let field: ComboField;
  export function commitForNavigation(): boolean { return field?.commitForNavigation() ?? false; }
  export function isComposing(): boolean { return field?.isComposing() ?? false; }
  export function focus(): void {
    field?.focus();
  }

  $: text = value === null || value === undefined || !Number.isFinite(value) ? "" : String(value);
  $: options = namesToOptions(suggestions.filter(draft => parse(draft) !== undefined && draft.trim() !== ""));

  function parse(draft: string): number | null | undefined {
    const s = draft.trim().replace(",", ".");
    if (s === "") return allowEmpty ? null : undefined;
    const n = toNumber(s);
    if (n === null) return undefined;
    if (integer && !Number.isInteger(n)) return undefined;
    if (min !== undefined && n < min) return undefined;
    if (max !== undefined && n > max) return undefined;
    return n;
  }

  function onCommit(e: CustomEvent<{ value: string }>): void {
    const n = parse(e.detail.value);
    // TextField already reports only an edited text (or an explicit Enter).
    if (n !== undefined) dispatch("commit", n);
  }
</script>

<ComboField
  bind:this={field}
  value={text}
  {placeholder}
  {disabled}
  {id}
  {ariaLabel}
  {options}
  {preserveInvalidOnBlur}
  allowCustom
  commitOnDestroy={false}
  inputMode={integer && (min ?? 0) >= 0 ? "numeric" : "decimal"}
  inputClass="ppp-number-field {inputClass}"
  validate={(d) => parse(d) !== undefined}
  on:draftChange={(e) => {
    const n = parse(e.detail);
    if (n !== undefined) dispatch("input", n);
  }}
  on:commit={onCommit}
  on:cancel={() => dispatch("cancel")}
  on:keydown
  on:focus
  {...$$restProps}
/>
