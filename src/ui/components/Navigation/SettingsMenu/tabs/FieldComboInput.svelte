<script lang="ts">
  /**
   * FieldComboInput (#093 slice 3) — a field picker that reads as a picker but
   * keeps the "select existing OR type a new field name" capability of the
   * underlying native <input list=datalist>. Adds the Notion-grammar affordances:
   * a leading field-type icon (or a "+" when the typed name is a new field) and a
   * trailing caret so it is recognisable as a chooser. No custom dropdown — the
   * native datalist still provides the existing-field list, so new-field creation
   * is never lost (the deliberate behaviour of the calendar field mapping).
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { getFieldIcon } from "./filterHelpers";

  export let value = "";
  export let fields: Array<{ name: string; type: string }> = [];
  export let id: string;
  export let placeholder = "";

  const dispatch = createEventDispatcher<{ change: string }>();

  $: matched = fields.find((f) => f.name === value);
  $: isNew = !!value && !matched;
  $: leadingIcon = matched ? getFieldIcon(matched.type) : isNew ? "plus" : "list";
</script>

<div class="field-combo">
  <span class="field-combo-lead" aria-hidden="true"><Icon name={leadingIcon} size="xs" /></span>
  <input
    id={`${id}-input`}
    class="field-combo-input"
    type="text"
    list={id}
    bind:value
    {placeholder}
    on:change={() => dispatch("change", value)}
  />
  {#if isNew}
    <span class="new-field-badge">{$i18n.t('settings-menu.view-config.calendar.field-mapping.new-field')}</span>
  {:else}
    <span class="field-combo-caret" aria-hidden="true"><Icon name="chevron-down" size="xs" /></span>
  {/if}
  <datalist {id}>
    {#each fields as f}
      <option value={f.name} />
    {/each}
  </datalist>
</div>

<style>
  .field-combo {
    position: relative;
    display: flex;
    align-items: center;
  }
  .field-combo-lead {
    position: absolute;
    left: 0.5rem;
    display: inline-flex;
    color: var(--text-muted);
    pointer-events: none;
  }
  .field-combo-input {
    flex: 1;
    padding-left: 1.75rem;
    padding-right: 1.75rem;
  }
  .field-combo-caret {
    position: absolute;
    right: 0.5rem;
    display: inline-flex;
    color: var(--text-muted);
    pointer-events: none;
  }
  .new-field-badge {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--interactive-accent);
    background: var(--background-secondary-alt);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    pointer-events: none;
    white-space: nowrap;
  }
</style>
