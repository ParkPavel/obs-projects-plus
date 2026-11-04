<script lang="ts">
  import OptionField from "./OptionField.svelte";
  type Choice = { value: string; label: string; icon?: string };
  export let options: readonly Choice[] = [];
  export let value = "";
  export let placeholder = "";
  export let tooltip = "";
  export let allowEmpty = false;
  export let disabled = false;
  export let contextKey = "";
  $: choices = options.map(option => ({ id: option.value, label: option.label, ...(option.icon ? { icon: option.icon } : {}) }));
  $: selectable = allowEmpty && !choices.some(option => option.id === "")
    ? [{ id: "", label: placeholder }, ...choices] : choices;
</script>

<OptionField {value} options={selectable} {disabled} {contextKey}
  displayLabel={value === "" ? placeholder : undefined}
  ariaLabel={tooltip || placeholder || value} on:change />
