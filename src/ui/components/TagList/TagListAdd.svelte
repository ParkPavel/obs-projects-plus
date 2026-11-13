<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { DataFieldType, type DataValue } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import ComboField from "../fields/ComboField.svelte";
  import NumberField from "../fields/NumberField.svelte";
  import DateField from "../fields/DateField.svelte";
  import { namesToOptions } from "../fields/comboOptions";

  export let type: DataFieldType = DataFieldType.String;
  export let withTime = false;
  export let suggestions: string[] = [];
  export let allowCustom = true;
  const dispatch = createEventDispatcher<{ add: DataValue; close: void }>();
  let combo: ComboField, number: NumberField, date: DateField;
  let root: HTMLElement;
  $: options = namesToOptions(type === DataFieldType.Boolean ? ["true", "false"] : suggestions);
  onMount(() => (number ?? date ?? combo)?.focus());

  function add(value: DataValue | null): void {
    if (value === null) return;
    dispatch("add", value);
    combo?.reset(""); number?.reset(); date?.reset();
  }
  function addText(event: CustomEvent<{ value: string; reason: string }>): void {
    const raw = event.detail.value;
    if (type === DataFieldType.Boolean) {
      if (raw === "true" || raw === "false") add(raw === "true");
    } else {
      const selected = event.detail.reason === "select" || options.some(option => option.id === raw);
      const value = selected ? raw : raw.trim();
      if (value.trim()) add(value);
    }
  }
  function closeAfterBlur(): void {
    void Promise.resolve().then(() => {
      if (root?.contains(root.ownerDocument.activeElement)) return;
      if ((number ?? date ?? combo)?.isComposing()) return;
      if (root?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.value.trim()) return;
      dispatch("close");
    });
  }
</script>

<span class="tag-list-add" bind:this={root} on:focusout={closeAfterBlur}>
  {#if type === DataFieldType.Number}
    <NumberField bind:this={number} value={null} {suggestions} preserveInvalidOnBlur
      ariaLabel={$i18n.t("common.add-item")} placeholder={$i18n.t("common.add-item")}
      on:commit={event => add(event.detail)} on:cancel={() => dispatch("close")} />
  {:else if type === DataFieldType.Date}
    <DateField bind:this={date} value={null} {withTime} {suggestions} required preserveInvalidOnBlur
      ariaLabel={$i18n.t("common.add-item")}
      on:change={event => add(event.detail)} on:cancel={() => dispatch("close")} />
  {:else}
    <ComboField bind:this={combo} value="" {options}
      allowCustom={type !== DataFieldType.Boolean && allowCustom}
      commitOnDestroy={false} preserveInvalidOnBlur
      ariaLabel={$i18n.t("common.add-item")} placeholder={$i18n.t("common.add-item")}
      on:commit={addText} on:cancel={() => dispatch("close")} />
  {/if}
</span>

<style>
  .tag-list-add { flex: 1 1 8rem; min-width: 0; }
  .tag-list-add :global(.ppp-combo), .tag-list-add :global(.ppp-combo-input) { width: 100%; }
</style>
