<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { Icon } from "obsidian-svelte";
  import ComboField from "./ComboField.svelte";
  import type { ComboOption } from "./comboOptions";

  export let value = "";
  export let options: ComboOption[] = [];
  export let displayLabel: string | undefined = undefined;
  export let ariaLabel: string | undefined = undefined;
  export let disabled = false;
  export let contextKey = "";
  let alive = true;
  onDestroy(() => { alive = false; });
  const dispatch = createEventDispatcher<{ change: string }>();
  $: selected = options.find(option => option.id === value);
  $: choose = forContext(contextKey);

  function forContext(owner: string) {
    return (event: CustomEvent<ComboOption>): void => {
      if (!alive || disabled || owner !== contextKey) return;
      const option = options.find(candidate => candidate.id === event.detail.id && candidate.label === event.detail.label);
      if (option && option.id !== value) dispatch("change", option.id);
    };
  }
</script>

<div class="ppp-option-field" class:has-icon={!!selected?.icon}>
  {#if selected?.icon}<span class="ppp-option-icon" aria-hidden="true"><Icon name={selected.icon} size="sm" /></span>{/if}
  {#key contextKey}
    <ComboField value={selected?.label ?? displayLabel ?? value} {options} {disabled}
      ariaLabel={ariaLabel ?? displayLabel ?? selected?.label ?? value}
      allowUnlistedUnchanged commitOnDestroy={false} inputClass="ppp-option-field-input" on:select={choose} />
  {/key}
  <span class="ppp-option-caret" aria-hidden="true"><Icon name="chevron-down" size="xs" /></span>
</div>

<style>
  .ppp-option-field { position: relative; display: flex; flex: 1; width: 10em; max-width: 100%; min-width: 0; height: 100%; }
  .ppp-option-field :global(.ppp-combo) { width: 100%; height: 100%; }
  .ppp-option-field :global(.ppp-option-field-input) { width: 100%; height: 100%; min-width: 0; padding: 0 1.25em 0 0; border: none; background: transparent; box-shadow: none; box-sizing: border-box; }
  .has-icon :global(.ppp-option-field-input) { padding-left: 1.5em; }
  .ppp-option-icon, .ppp-option-caret { position: absolute; display: inline-flex; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-muted); }
  .ppp-option-icon { left: 0; }
  .ppp-option-caret { right: 0; }
</style>
