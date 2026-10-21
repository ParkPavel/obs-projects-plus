<script lang="ts">
  /**
   * FieldComboInput (#093 slice 3) — a field picker that reads as a picker but
   * keeps the "select existing OR type a new field name" capability. Adds the
   * Notion-grammar affordances: a leading field-type icon (or a "+" when the
   * typed name is a new field) and a trailing caret so it is recognisable as a
   * chooser. The suggestion list is the shared ComboField listbox (stab-forms),
   * which replaced the native datalist: a pick, Enter and blur commit once,
   * Escape restores the name the field had on entry, and an IME composition
   * never commits. A new name is accepted as typed, so field creation is never
   * lost (the deliberate behaviour of the calendar field mapping).
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import ComboField from "src/ui/components/fields/ComboField.svelte";
  import { getFieldIcon } from "./filterHelpers";

  export let value = "";
  export let fields: Array<{ name: string; type: string }> = [];
  export let id: string;
  export let placeholder = "";

  const dispatch = createEventDispatcher<{ change: string }>();

  // settings-binds: the text being edited lives in the ComboField, which owns
  // the draft. The `value` prop is only ever read, never assigned: a parent that
  // passes a reactive declaration (`$: x = view.config.x`) would otherwise have
  // that declaration re-run on the next flush and write the saved value back
  // over an edit that commits later. `typed` mirrors the draft for the icon and
  // the new-field badge only.
  let typed = value;
  // The value the parent last passed, so only a real change of the prop is adopted.
  let seenProp = value;
  // The last value dispatched or adopted: a commit of the same text is a no-op.
  let committed = value;

  function follow(next: string): void {
    if (next === seenProp) return;
    seenProp = next;
    committed = next;
    typed = next;
  }
  $: follow(value);

  function onCommit(raw: string): void {
    // i3-settings: «Enddate» typed where `endDate` exists is that field, not a
    // new empty property beside it the calendar would never read.
    const t = raw.trim();
    const text = fields.find((f) => f.name === t)?.name ?? fields.find((f) => f.name.toLowerCase() === t.toLowerCase())?.name ?? t;
    typed = text;
    if (text === committed) return;
    committed = text;
    dispatch("change", text);
  }

  $: options = fields.map((f) => ({ id: f.name, label: f.name }));
  $: matched = fields.find((f) => f.name === typed);
  $: isNew = !!typed && !matched;
  $: leadingIcon = matched ? getFieldIcon(matched.type) : isNew ? "plus" : "list";
</script>

<div class="field-combo">
  <span class="field-combo-lead" aria-hidden="true"><Icon name={leadingIcon} size="xs" /></span>
  <ComboField
    id={`${id}-input`}
    inputClass="field-combo-input"
    {value}
    {options}
    allowCustom
    {placeholder}
    on:draftChange={(e) => (typed = e.detail)}
    on:commit={(e) => onCommit(e.detail.value)}
  />
  {#if isNew}
    <span class="new-field-badge">{$i18n.t('settings-menu.view-config.calendar.field-mapping.new-field')}</span>
  {:else}
    <span class="field-combo-caret" aria-hidden="true"><Icon name="chevron-down" size="xs" /></span>
  {/if}
</div>

<style>
  .field-combo {
    position: relative;
    display: flex;
    align-items: center;
  }
  .field-combo > :global(.ppp-combo) {
    flex: 1;
  }
  .field-combo :global(.field-combo-input) {
    padding-left: 1.75rem;
    padding-right: 1.75rem;
  }
  .field-combo-lead {
    position: absolute;
    left: 0.5rem;
    z-index: 1;
    display: inline-flex;
    color: var(--text-muted);
    pointer-events: none;
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
