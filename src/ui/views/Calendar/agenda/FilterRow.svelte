<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Icon } from 'obsidian-svelte';
  import FloatingPopup from 'src/ui/components/FloatingPopup/FloatingPopup.svelte';
  import PopoverList, { type PopoverItem } from 'src/ui/components/FloatingPopup/PopoverList.svelte';
  import ValueSuggestField from 'src/ui/components/fields/ValueSuggestField.svelte';
  import { i18n } from 'src/lib/stores/i18n';
  import { app } from 'src/lib/stores/obsidian';
  import { DataFieldType, type DataField, type DataRecord } from 'src/lib/dataframe/dataframe';
  import type { AgendaFilter, AgendaFilterOperator } from 'src/settings/v3/settings';
  import { getOperatorsForFieldType } from './operatorHelpers';
  import { operatorNeedsValue } from 'src/settings/base/settings';
  import DateFormulaInput from './DateFormulaInput.svelte';
  import { templateFoldersOf, valueSuggestions as projectValueSuggestions } from 'src/lib/suggestions/valueSuggestions';
  
  const dispatch = createEventDispatcher<{
    update: AgendaFilter;
    remove: void;
  }>();
  
  export let filter: AgendaFilter;
  export let fields: DataField[] = [];
  export let records: DataRecord[] = [];
  export let prefix: string = '';
  
  const t = (key: string) => $i18n.t(`views.calendar.agenda.custom.filter-editor.${key}`);
  
  /* ── State ── */
  let showFieldDropdown = false;
  let showOperatorDropdown = false;
  let fieldTriggerEl: HTMLButtonElement | null = null;
  let operatorTriggerEl: HTMLButtonElement | null = null;

  /* ── Reactive data ── */
  $: currentField = fields.find(f => f.name === filter.field);
  $: operators = currentField ? getOperatorsForFieldType(currentField.type) : [];
  $: operatorItems = operators.map((op): PopoverItem => ({
    label: getOperatorLabel(op), selected: op === filter.operator, handler: () => selectOperator(op),
  }));
  $: needsValue = operatorNeedsValue(filter.operator);
  $: isDateField = currentField?.type === DataFieldType.Date;
  // The field list is the shared PopoverList (search, arrows, Enter, touch).
  $: fieldItems = fields.map((f): PopoverItem => ({
    label: f.name,
    icon: getFieldIconName(f),
    selected: f.name === filter.field,
    handler: () => selectField(f.name),
  }));

  /* ── Icon helper ── */
  function getFieldIconName(field: DataField | undefined): string {
    if (!field) return 'file-text';
    if (field.name === 'file' || field.name === 'File') return 'file';
    switch (field.type) {
      case DataFieldType.String: return 'type';
      case DataFieldType.Number: return 'hash';
      case DataFieldType.Boolean: return 'check-square';
      case DataFieldType.Date: return 'calendar';
      case DataFieldType.List: return 'list';
      default: return 'file-text';
    }
  }

  function getOperatorLabel(op: string): string {
    const pfx = 'views.calendar.agenda.custom.filter-editor.operators.';
    const withDashes = $i18n.t(`${pfx}${op}`);
    if (withDashes && !withDashes.startsWith(pfx)) return withDashes;
    const withUnderscores = $i18n.t(`${pfx}${op.replace(/-/g, '_')}`);
    if (withUnderscores && !withUnderscores.startsWith(pfx)) return withUnderscores;
    return op.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /* ── Toggle functions ── */
  function openFieldDropdown() {
    closeOperatorDropdown();
    showFieldDropdown = !showFieldDropdown;
  }

  function openOperatorDropdown() {
    closeFieldDropdown();
    if (showOperatorDropdown) { closeOperatorDropdown(); return; }
    showOperatorDropdown = true;
  }

  function closeFieldDropdown() {
    showFieldDropdown = false;
  }

  function closeOperatorDropdown() {
    showOperatorDropdown = false;
  }

  /* ── Selection handlers ── */
  function selectField(name: string) {
    const newField = fields.find(f => f.name === name);
    if (!newField) return;
    const ops = getOperatorsForFieldType(newField.type);
    const op = ops.includes(filter.operator) ? filter.operator : ops[0] || 'is';
    dispatch('update', { ...filter, field: name, operator: op, value: '' });
    closeFieldDropdown();
  }
  
  function selectOperator(op: AgendaFilterOperator) {
    dispatch('update', {
      ...filter,
      operator: op,
      value: operatorNeedsValue(op) ? filter.value : null,
    });
    closeOperatorDropdown();
  }
  
  // The value the parent was last given. An edit reports it as the user types and the
  // commit that settles it (Enter, a pick, blur) carries the same text: one write.
  let sentValue = '';
  $: sentValue = String(filter.value ?? '');
  function sendValue(val: string) {
    if (val === sentValue) return;
    sentValue = val;
    dispatch('update', { ...filter, value: val });
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DateFormulaInput dispatches string via CustomEvent
  function handleDateValue(value: any) {
    dispatch('update', { ...filter, value });
  }
  
  // The values the project's records hold for the field, after its declared options;
  // templates never count (w4-p05). One memo per set of records, shared with the
  // filter panel and the colour rules, so typing does not rebuild the list.
  $: valueSuggestions = suggestionsOf(records, currentField, $app);
  function suggestionsOf(source: DataRecord[], field: DataField | undefined, obsidianApp: unknown): string[] {
    return projectValueSuggestions(source, field, { templateFolders: templateFoldersOf(obsidianApp) });
  }

</script>


<div class="filter-row" class:filter-row--disabled={filter.enabled === false}>
  <!-- Row prefix: Where / and -->
  {#if prefix}
    <span class="row-prefix">{prefix}</span>
  {/if}
  
  <!-- Enable/Disable toggle -->
  <button
    class="row-toggle clickable-icon"
    class:row-toggle--off={filter.enabled === false}
    type="button"
    aria-pressed={filter.enabled !== false}
    aria-label={filter.enabled === false ? (t('enable-filter') || 'Enable filter') : (t('disable-filter') || 'Disable filter')}
    on:click|stopPropagation={() => dispatch('update', { ...filter, enabled: filter.enabled === false ? true : false })}
    title={filter.enabled === false ? (t('enable-filter') || 'Enable filter') : (t('disable-filter') || 'Disable filter')}
  >
    <Icon name={filter.enabled === false ? 'eye-off' : 'eye'} size="sm" />
  </button>

  <!-- Field chip -->
  <div class="chip-wrapper">
    <button bind:this={fieldTriggerEl} class="chip chip--field" type="button" aria-haspopup="menu" aria-expanded={showFieldDropdown} on:click={openFieldDropdown} title={filter.field || ''}>
      <span class="chip-icon">
        <Icon name={getFieldIconName(currentField)} size="sm" />
      </span>
      <span class="chip-label">{filter.field || t('field-placeholder')}</span>
      <span class="chip-chevron">
        <Icon name="chevron-down" size="xs" />
      </span>
    </button>
  </div>
  
  <!-- Operator chip -->
  <div class="chip-wrapper">
    <button bind:this={operatorTriggerEl} class="chip chip--operator" type="button" aria-haspopup="menu" aria-expanded={showOperatorDropdown} on:click={openOperatorDropdown}>
      <span class="chip-label">{getOperatorLabel(filter.operator)}</span>
      <span class="chip-chevron">
        <Icon name="chevron-down" size="xs" />
      </span>
    </button>
  </div>
  
  <!-- Value area -->
  <div class="value-area">
    {#if needsValue}
      {#if isDateField}
        <DateFormulaInput
          value={filter.value?.toString() ?? ''}
          placeholder={t('value-placeholder') || 'Value...'}
          on:input={(e) => handleDateValue(e.detail)}
        />
      {:else}
        <ValueSuggestField
          value={filter.value == null ? '' : String(filter.value)}
          suggestions={valueSuggestions}
          placeholder={t('value-placeholder') || 'Value...'}
          on:input={(e) => sendValue(e.detail)}
          on:commit={(e) => sendValue(e.detail)}
        />
      {/if}
    {:else}
      <span class="no-value">{t('no-value') || '—'}</span>
    {/if}
  </div>
  
  <!-- Delete button -->
  <button
    class="row-delete clickable-icon"
    type="button"
    aria-label={t('remove-filter')}
    on:click|stopPropagation={() => dispatch('remove')}
    title={t('remove-filter')}
  >
    <Icon name="trash-2" size="sm" />
  </button>
</div>

<FloatingPopup
  triggerEl={fieldTriggerEl}
  open={showFieldDropdown}
  placement="bottom-start"
  role="menu"
  on:close={closeFieldDropdown}
>
  {#if showFieldDropdown}
    <PopoverList items={fieldItems} searchable />
  {/if}
</FloatingPopup>

<FloatingPopup triggerEl={operatorTriggerEl} open={showOperatorDropdown} role="menu" on:close={closeOperatorDropdown}>
  {#if showOperatorDropdown}<PopoverList items={operatorItems} />{/if}
</FloatingPopup>

<style>
  /* ROW — single inline horizontal row */
  .filter-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.1875rem 0;
    min-height: 2rem;
  }
  
  .filter-row:hover {
    background: var(--background-secondary);
    border-radius: 0.375rem;
  }
  
  .filter-row:hover .row-delete,
  .filter-row:hover .row-toggle {
    opacity: 1;
  }
  
  /* ── Disabled filter row ── */
  .filter-row--disabled {
    opacity: 0.5;
  }
  
  .filter-row--disabled .chip,
  .filter-row--disabled .value-area,
  .filter-row--disabled .no-value {
    pointer-events: none;
  }
  
  /* ── Row prefix (Где / и) ── */
  .row-prefix {
    flex-shrink: 0;
    width: 2rem;
    text-align: right;
    color: var(--text-muted);
    font-size: 0.75rem;
    padding-right: 0.125rem;
    user-select: none;
  }
  
  /* ═══════════════════════════════════════
     CHIP BUTTONS — pill selectors
     ═══════════════════════════════════════ */
  .chip-wrapper {
    position: relative;
    flex-shrink: 0;
  }
  
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    height: 1.625rem;
    padding: 0 0.5rem;
    border: var(--ppp-border-width) solid var(--background-modifier-border);
    border-radius: 0.375rem;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.8125rem;
    font-family: var(--font-interface);
    white-space: nowrap;
    transition: border-color 100ms ease, background 100ms ease;
    line-height: 1;
  }
  
  .chip:hover {
    border-color: var(--interactive-accent);
    background: var(--background-primary-alt);
  }
  
  .chip:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.0625rem;
  }
  
  .chip-icon {
    display: inline-flex;
    align-items: center;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  
  .chip-label {
    max-width: 7.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .chip-chevron {
    display: inline-flex;
    align-items: center;
    color: var(--text-faint);
    flex-shrink: 0;
    margin-left: 0.125rem;
  }
  
  .chip--field .chip-label {
    font-weight: 500;
  }
  
  /* ═══════════════════════════════════════
     VALUE — inline text input
     ═══════════════════════════════════════ */
  .value-area {
    flex: 1;
    min-width: 5rem;
  }
  
  .no-value {
    display: inline-block;
    color: var(--text-faint);
    font-size: 0.75rem;
    font-style: italic;
    padding: 0.25rem 0.5rem;
  }
  
  /* ═══════════════════════════════════════
     DELETE — trash icon (hidden until row hover)
     ═══════════════════════════════════════ */
  .row-toggle {
    flex-shrink: 0;
    color: var(--text-faint);
    border-radius: 0.25rem;
    padding: 0.25rem;
    opacity: 0;
    transition: opacity 100ms ease, color 100ms ease;
  }
  
  .row-toggle:hover {
    color: var(--interactive-accent);
  }
  
  .row-toggle--off {
    opacity: 1;
    color: var(--text-faint);
  }
  
  .row-delete {
    flex-shrink: 0;
    color: var(--text-faint);
    border-radius: 0.25rem;
    padding: 0.25rem;
    opacity: 0;
    transition: opacity 100ms ease, color 100ms ease;
  }
  
  .row-delete:hover {
    color: var(--text-error);
    background: rgba(var(--color-red-rgb, 255, 0, 0), 0.06);
  }
  
  /* ═══════════════════════════════════════
     TOUCH DEVICES
     ═══════════════════════════════════════ */
  @media (pointer: coarse) {
    .filter-row {
      gap: 0.25rem;
      min-height: 2.5rem;
      flex-wrap: wrap;
    }
    
    .row-prefix {
      width: 1.5rem;
      font-size: 0.6875rem;
    }
    
    .chip-wrapper {
      flex-shrink: 1;
      min-width: 0;
    }
    
    .chip {
      height: 2.125rem;
      padding: 0 0.5rem;
      font-size: 0.8125rem;
      flex-shrink: 1;
      min-width: 0;
      overflow: hidden;
    }
    
    .chip-label {
      max-width: 4.5rem;
    }
    
    .value-area {
      min-width: 0;
      flex-basis: 3.125rem;
      flex-grow: 1;
    }
    
    .row-toggle {
      opacity: 1;
      padding: 0.25rem;
    }
    
    .row-delete {
      opacity: 1;
      padding: 0.25rem;
    }
  }

</style>
