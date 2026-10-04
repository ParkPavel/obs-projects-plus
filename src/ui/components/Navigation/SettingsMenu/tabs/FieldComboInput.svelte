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

  // settings-binds: the text being edited lives in `draft`, owned here. The
  // `value` prop is only ever read, never assigned: a parent that passes a
  // reactive declaration (`$: x = view.config.x`) would otherwise have that
  // declaration re-run on the next flush and write the saved value back over
  // an edit that commits later (a pick, Enter, blur) — the field looked as if
  // it refused every pick and every typed name.
  let draft = value;
  // The value the parent last passed, so only a real change of the prop is
  // adopted, not every re-render that hands the same value down again.
  let seenProp = value;
  // The last value dispatched or adopted: a commit of the same text is a no-op.
  let committed = value;
  let focused = false;
  // A prop change that arrived while the user was in the field.
  let propChangedWhileFocused = false;
  // The draft at focus: if it is unchanged at blur, nothing was edited.
  let draftAtFocus = value;

  function adoptProp(next: string): void {
    if (next === seenProp) return;
    seenProp = next;
    if (focused) {
      // Never pull the text from under the user's fingers.
      propChangedWhileFocused = true;
      return;
    }
    draft = next;
    committed = next;
  }
  $: adoptProp(value);

  // Picking a suggestion from the native datalist fires only `input` (Chromium:
  // inputType `insertReplacementText`, or a plain Event without one); `change`
  // waits for blur, so a pick looked ignored. A pick of an existing field, or
  // Enter, commits at once; typing a new name still commits on blur.
  function commit(): void {
    if (draft === committed) return;
    committed = draft;
    dispatch("change", draft);
  }
  function onInput(e: Event): void {
    draft = (e.currentTarget as HTMLInputElement).value;
    const kind = (e as InputEvent).inputType;
    const picked = kind === undefined || kind === "insertReplacementText";
    if (picked && fields.some((f) => f.name === draft)) commit();
  }
  function onKeydown(e: KeyboardEvent): void {
    // An Enter that accepts an IME candidate is part of the composition, not a
    // commit of the field name (229 is the composing keyCode some hosts report).
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter") commit();
  }
  function onFocus(): void {
    focused = true;
    propChangedWhileFocused = false;
    draftAtFocus = draft;
    // The baseline of this interaction is what the field shows now, so the
    // blur's change after a pick writes nothing a second time.
    committed = draft;
  }
  function onBlur(): void {
    focused = false;
    // The parent changed the value while the field was focused and the user
    // edited nothing: show the parent's value now. An edit made during the
    // focus has already been committed by `change`, and wins.
    if (propChangedWhileFocused && draft === draftAtFocus) {
      draft = seenProp;
      committed = seenProp;
    }
    propChangedWhileFocused = false;
  }

  $: matched = fields.find((f) => f.name === draft);
  $: isNew = !!draft && !matched;
  $: leadingIcon = matched ? getFieldIcon(matched.type) : isNew ? "plus" : "list";
</script>

<div class="field-combo">
  <span class="field-combo-lead" aria-hidden="true"><Icon name={leadingIcon} size="xs" /></span>
  <input
    id={`${id}-input`}
    class="field-combo-input"
    type="text"
    list={id}
    value={draft}
    {placeholder}
    on:focus={onFocus}
    on:blur={onBlur}
    on:input={onInput}
    on:keydown={onKeydown}
    on:change={commit}
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
