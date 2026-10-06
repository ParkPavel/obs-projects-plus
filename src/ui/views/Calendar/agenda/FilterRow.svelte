<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { setIcon, type TFile } from 'obsidian';
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
  let fieldWrapperEl: HTMLDivElement | null = null;
  let operatorWrapperEl: HTMLDivElement;

  /* в”Ђв”Ђ Imperative dropdown containers (portaled to body) в”Ђв”Ђ */
  let operatorPopoverEl: HTMLDivElement | null = null;

  /* в”Ђв”Ђ Reactive data в”Ђв”Ђ */
  $: currentField = fields.find(f => f.name === filter.field);
  $: operators = currentField ? getOperatorsForFieldType(currentField.type) : [];
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

  /* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
     IMPERATIVE POPOVER вЂ” creates dropdown in activeDocument.body
     bypasses all transform/overflow/scoped-CSS issues
     в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */

  /* CSS classes are defined in styles.css under .ppp-popover-* prefix */

  /**
   * Position a popover relative to its trigger.
   *
   * Touch (pointer: coarse) вЂ” ALWAYS above the trigger:
   *   вЂў fixed height 11rem (в‰€4 touch items), full width with 0.5rem margins
   *   вЂў bottom edge sits 0.25rem above trigger top
   *   вЂў if the popover can't fit above, it shrinks to fit (min 5rem)
   *   вЂў never goes below trigger, never docks near keyboard
   *
   * Desktop вЂ” standard dropdown below or above.
   */
  function positionContainer(el: HTMLDivElement, trigger: HTMLElement, _minWRem: number) {
    // coercion-exempt: Class C - a computed CSS length read back from the DOM, not record data
    const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const toRem = (v: number) => `${(v / fs).toFixed(2)}rem`;
    const isTouch = window.matchMedia('(pointer: coarse)').matches;

    if (isTouch) {
      const vv = window.visualViewport;
      const gap = 0.25 * fs;
      const wantH = 11 * fs;

      function place() {
        const rect = trigger.getBoundingClientRect();
        const visTop = vv ? vv.offsetTop : 0;
        const visH  = vv ? vv.height : window.innerHeight;
        const visBot = visTop + visH;
        const anchor = Math.min(rect.top, visBot - gap);
        const avail  = anchor - visTop - gap * 2;
        const h   = Math.max(5 * fs, Math.min(wantH, avail));
        const top = Math.max(visTop + gap, anchor - h - gap);

        el.style.top       = toRem(top);
        el.style.height    = toRem(h);
        el.style.maxHeight = toRem(h);
      }

      // Position and the hidden start are classes (catalogue audit C6); the
      // desktop placement's inline bottom would outrank the class, so it goes.
      el.classList.add('ppp-popover-container--mobile-kbd', 'ppp-popover-container--pending');
      el.style.removeProperty('bottom');

      // Start invisible вЂ” searchInput.focus() will trigger keyboard AFTER
      // this function returns, making the initial position wrong.
      // Show after first resize (keyboard settled) or fallback timeout.
      place();  // approximate position, hidden

      let revealed = false;
      function reveal() {
        if (revealed) return;
        revealed = true;
        place();  // re-run with actual viewport
        el.classList.remove('ppp-popover-container--pending');
      }

      // Fallback: if keyboard was already open, no resize fires вЂ” reveal after short delay
      const fallbackTimer = setTimeout(reveal, 120);

      if (vv) {
        const onVV = () => {
          if (!revealed) {
            clearTimeout(fallbackTimer);
            reveal();
          } else {
            place();
          }
        };
        vv.addEventListener('resize', onVV);
        vv.addEventListener('scroll', onVV);
        (el as any).__vvCleanup = () => {
          clearTimeout(fallbackTimer);
          vv.removeEventListener('resize', onVV);
          vv.removeEventListener('scroll', onVV);
        };
      } else {
        // No visualViewport вЂ” just show immediately
        clearTimeout(fallbackTimer);
        reveal();
      }
      return;
    }

    const r = trigger.getBoundingClientRect();

    // Desktop
    const vv = window.visualViewport;
    const visH = vv ? vv.height : window.innerHeight; 
    const gap = 0.75 * fs;
    const minW = _minWRem * fs;
    let left = r.left;
    const width = Math.max(r.width, minW);
    if (left + width > window.innerWidth - gap) left = window.innerWidth - width - gap;
    if (left < 0.25 * fs) left = 0.25 * fs;

    const spaceBelow = visH - r.bottom - gap;
    const spaceAbove = r.top - gap;
    const flipUp = spaceBelow < 12.5 * fs && spaceAbove > spaceBelow;
    const maxH = flipUp ? spaceAbove : Math.max(spaceBelow, 12.5 * fs);

    el.style.left = toRem(left);
    el.style.width = toRem(width);
    el.style.maxHeight = toRem(maxH);

    if (flipUp) {
      el.style.bottom = toRem(window.innerHeight - r.top + 0.25 * fs);
      el.style.top = 'auto';
    } else {
      el.style.top = toRem(r.bottom + 0.25 * fs);
      el.style.bottom = 'auto';
    }
  }

  /* в”Ђв”Ђ FIELD DROPDOWN в”Ђв”Ђ */
  // The field list is a FloatingPopup around PopoverList (see the markup).

  /* в”Ђв”Ђ OPERATOR DROPDOWN в”Ђв”Ђ */
  function renderOperatorPopover() {
    destroyOperatorPopover();
    const chip = operatorWrapperEl?.querySelector('.chip') as HTMLElement;
    if (!chip) return;

    const container = activeDocument.createElement('div');
    container.addClass('ppp-popover-container');
    container.classList.add('ppp-filter-popover');
    positionContainer(container, chip, 13.75);

    const list = activeDocument.createElement('div');
    list.addClass('ppp-popover-list');
    container.appendChild(list);

    operators.forEach(op => {
      const btn = activeDocument.createElement('button');
      const isSelected = op === filter.operator;
      btn.addClass('ppp-popover-item');
        if (isSelected) btn.addClass('ppp-popover-item--selected');
      btn.type = 'button';

      const label = activeDocument.createElement('span');
      label.addClass('ppp-popover-label');
      label.textContent = getOperatorLabel(op);
      btn.appendChild(label);

      if (isSelected) {
        const check = activeDocument.createElement('span');
        check.addClass('ppp-popover-item-icon');
        setIcon(check, 'check');
        btn.appendChild(check);
      }

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectOperator(op);
      });
      list.appendChild(btn);
    });

    activeDocument.body.appendChild(container);
    operatorPopoverEl = container;
  }

  function destroyOperatorPopover() {
    if (operatorPopoverEl) {
      if ((operatorPopoverEl as any).__vvCleanup) (operatorPopoverEl as any).__vvCleanup();
      operatorPopoverEl.parentNode?.removeChild(operatorPopoverEl);
    }
    operatorPopoverEl = null;
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
    renderOperatorPopover();
  }

  function closeFieldDropdown() {
    showFieldDropdown = false;
  }

  function closeOperatorDropdown() {
    showOperatorDropdown = false;
    destroyOperatorPopover();
  }

  /* Close the operator dropdown on an outside click (the field list and the
     value suggestions close themselves). */
  function handleWindowMousedown(e: MouseEvent) {
    const target = e.target as Node;
    if (showOperatorDropdown && operatorWrapperEl && !operatorWrapperEl.contains(target)
        && (!operatorPopoverEl || !operatorPopoverEl.contains(target))) {
      closeOperatorDropdown();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeOperatorDropdown();
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

  onDestroy(() => {
    destroyOperatorPopover();
  });
</script>

<svelte:window on:mousedown={handleWindowMousedown} on:keydown={handleKeydown} />

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
  <div class="chip-wrapper" bind:this={fieldWrapperEl}>
    <button class="chip chip--field" type="button" aria-haspopup="listbox" aria-expanded={showFieldDropdown} on:click={openFieldDropdown} title={filter.field || ''}>
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
  <div class="chip-wrapper" bind:this={operatorWrapperEl}>
    <button class="chip chip--operator" type="button" aria-haspopup="listbox" aria-expanded={showOperatorDropdown} on:click={openOperatorDropdown}>
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
  triggerEl={fieldWrapperEl}
  open={showFieldDropdown}
  placement="bottom-start"
  role="menu"
  on:close={closeFieldDropdown}
>
  {#if showFieldDropdown}
    <PopoverList items={fieldItems} searchable />
  {/if}
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

  /* v3.2.1: Mobile keyboard вЂ” reverse column so list scrolls upward
     from search bar anchored near trigger. Applied via JS classList.add(),
     so :global() is required. Compiled into main.css в†’ auto-merged. */
  :global(.ppp-popover-container--mobile-kbd) {
    flex-direction: column-reverse;
    position: fixed;
    bottom: auto;
  }
  /* Hidden until the keyboard settles and the popover is placed. */
  :global(.ppp-popover-container--pending) {
    opacity: 0;
    pointer-events: none;
  }
  /* The filter popovers' list, hover and selected-icon colour were inline
     styles set per item (catalogue audit C6). */
  :global(.ppp-filter-popover .ppp-popover-list) {
    flex: 1;
    min-height: 0;
  }
  :global(.ppp-filter-popover .ppp-popover-item:hover) {
    background: var(--background-modifier-hover);
  }
  :global(.ppp-filter-popover .ppp-popover-item--selected .ppp-popover-item-icon) {
    color: var(--interactive-accent);
  }
  :global(.ppp-popover-container--mobile-kbd) :global(.ppp-popover-search) {
    border-bottom: none;
    border-top: var(--ppp-border-width) solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
  }
</style>
