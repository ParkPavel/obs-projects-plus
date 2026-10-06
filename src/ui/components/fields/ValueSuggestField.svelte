<script lang="ts">
  /**
   * ValueSuggestField (stab-forms, step 5) — the value box of a filter or colour
   * rule: free text with the values the field already holds offered as
   * suggestions. It is the shared ComboField (own draft, role=combobox, portalled
   * listbox), so a typed value is never overwritten by a parent that re-renders
   * and a pick commits once.
   *
   * `input` reports every edit (a consumer that filters live debounces it);
   * `commit` reports the settled text once (Enter, a pick, Tab, blur). The
   * consumer owns persistence and may treat both as the same write.
   */
  import { createEventDispatcher } from "svelte";
  import ComboField from "./ComboField.svelte";

  export let value = "";
  export let suggestions: string[] = [];
  export let placeholder = "";
  export let ariaLabel: string | undefined = undefined;
  export let disabled = false;

  const dispatch = createEventDispatcher<{
    input: string;
    commit: string;
  }>();

  $: options = suggestions.map((s) => ({ id: s, label: s }));
</script>

<div class="ppp-value-field">
  <ComboField
    {value}
    {options}
    allowCustom
    {placeholder}
    {ariaLabel}
    {disabled}
    inputClass="ppp-value-field-input"
    on:draftChange={(e) => dispatch("input", e.detail)}
    on:commit={(e) => dispatch("commit", e.detail.value)}
  />
</div>

<style>
  .ppp-value-field {
    min-width: 0;
    width: 100%;
  }
  .ppp-value-field :global(.ppp-value-field-input) {
    width: 100%;
    height: 1.625rem;
    box-sizing: border-box;
    padding: 0 0.5rem;
    border: var(--ppp-border-width) solid var(--background-modifier-border);
    border-radius: 0.375rem;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.8125rem;
    font-family: var(--font-interface);
    outline: none;
  }
  .ppp-value-field :global(.ppp-value-field-input)::placeholder {
    color: var(--text-faint);
  }
  .ppp-value-field :global(.ppp-value-field-input):focus {
    border-color: var(--interactive-accent);
  }
  @media (pointer: coarse) {
    .ppp-value-field :global(.ppp-value-field-input) {
      height: var(--ppp-touch-target-min);
      font-size: 0.875rem;
    }
  }
</style>
