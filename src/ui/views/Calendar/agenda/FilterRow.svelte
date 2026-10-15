<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TFile } from 'obsidian';
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
  
  const dispatch = createEventDispatcher<{
    update: AgendaFilter;
    remove: void;
  }>();
  
  export let filter: AgendaFilter;
  export let fields: DataField[] = [];
  export let records: DataRecord[] = [];
  export let prefix: string = '';
  
  const t = (key: string) => $i18n.t(`views.calendar.agenda.custom.filter-editor.${key}`);
  
  /* в”Ђв”Ђ State в”Ђв”Ђ */
  let showFieldDropdown = false;
  let showOperatorDropdown = false;
  let fieldTriggerEl: HTMLButtonElement | null = null;
  let operatorTriggerEl: HTMLButtonElement | null = null;

  /* в”Ђв”Ђ Reactive data в”Ђв”Ђ */
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

  /* в”Ђв”Ђ Icon helper в”Ђв”Ђ */
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

  /* в”Ђв”Ђ Toggle functions в”Ђв”Ђ */
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

  /* в”Ђв”Ђ Selection handlers в”Ђв”Ђ */
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
  
  /** Collect unique field values from records + vault for suggestions */
  function getValueSuggestions(): string[] {
    if (!currentField) return [];
    const fieldName = currentField.name;
    const MAX_SUGGESTIONS = 200;
    
    // Boolean field: offer true/false
    if (currentField.type === DataFieldType.Boolean) {
      return ['true', 'false'];
    }
    
    const values = new Set<string>();
    
    // в”Ђв”Ђ Primary source: actual DataRecords (most reliable) в”Ђв”Ђ
    if (records.length > 0) {
      for (const record of records) {
        const raw = record.values[fieldName];
        if (raw == null) continue;
        
        // Strip wiki-link: [[path|display]] в†’ display
        let val: string;
        if (typeof raw === 'string') {
          const m = raw.match(/^\[\[([^\]]+)\]\]$/);
          if (m && m[1]) {
            const inner = m[1];
            const pipe = inner.indexOf('|');
            val = pipe >= 0 ? inner.substring(pipe + 1) : inner;
          } else {
            val = raw;
          }
        } else if (Array.isArray(raw)) {
          raw.forEach(v => {
            const s = String(v).trim();
            if (s && s !== 'undefined' && s !== 'null') values.add(s);
          });
          continue;
        } else {
          val = String(raw);
        }
        
        const trimmed = val.trim();
        if (trimmed && trimmed !== 'undefined' && trimmed !== 'null') {
          values.add(trimmed);
        }
      }
    }
    
    // в”Ђв”Ђ Secondary source: vault frontmatter scan (supplements records) в”Ђв”Ђ
    if ($app && values.size < MAX_SUGGESTIONS) {
      const vault = $app.vault;
      const metadataCache = $app.metadataCache;
      
      // Special handling for tags field
      if (fieldName === 'tags' && currentField.repeated) {
        vault.getMarkdownFiles().forEach((file: TFile) => {
          const cache = metadataCache.getFileCache(file);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Obsidian CachedMetadata tags type
          if (cache?.['tags']) {
            cache['tags'].forEach((tag: any) => { values.add(tag.tag); });
          }
          if (cache?.frontmatter?.['tags']) {
            const tags = Array.isArray(cache.frontmatter['tags'])
              ? cache.frontmatter['tags']
              : [cache.frontmatter['tags']];
            tags.forEach((tag: string) => values.add(typeof tag === 'string' ? `#${tag}` : tag));
          }
        });
      } else {
        vault.getMarkdownFiles().forEach((file: TFile) => {
          if (values.size >= MAX_SUGGESTIONS) return;
          const cache = metadataCache.getFileCache(file);
          const fv = cache?.frontmatter?.[fieldName];
          if (fv != null) {
            if (Array.isArray(fv)) {
              fv.forEach(v => {
                const s = String(v).trim();
                if (s && s !== 'undefined' && s !== 'null') values.add(s);
              });
            } else {
              const s = String(fv).trim();
              if (s && s !== 'undefined' && s !== 'null') values.add(s);
            }
          }
        });
      }
    }
    
    const sorted = Array.from(values).sort();
    return sorted.length > MAX_SUGGESTIONS ? sorted.slice(0, MAX_SUGGESTIONS) : sorted;
  }
  
  // The suggestions follow the field, the records and the vault; `currentField` is a
  // new object on every edit of the row, so the key is its name: typing must not rescan
  // the vault on each keystroke.
  $: suggestionField = currentField?.name;
  $: valueSuggestions = collectSuggestions(suggestionField, records, $app);
  function collectSuggestions(_name: string | undefined, _records: DataRecord[], _app: unknown): string[] {
    return getValueSuggestions();
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
  
  /* в”Ђв”Ђ Disabled filter row в”Ђв”Ђ */
  .filter-row--disabled {
    opacity: 0.5;
  }
  
  .filter-row--disabled .chip,
  .filter-row--disabled .value-area,
  .filter-row--disabled .no-value {
    pointer-events: none;
  }
  
  /* в”Ђв”Ђ Row prefix (Р“РґРµ / Рё) в”Ђв”Ђ */
  .row-prefix {
    flex-shrink: 0;
    width: 2rem;
    text-align: right;
    color: var(--text-muted);
    font-size: 0.75rem;
    padding-right: 0.125rem;
    user-select: none;
  }
  
  /* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
     CHIP BUTTONS вЂ” pill selectors
     в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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
  
  /* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
     VALUE вЂ” inline text input
     в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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
  
  /* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
     DELETE вЂ” trash icon (hidden until row hover)
     в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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
  
  /* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
     TOUCH DEVICES
     в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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
