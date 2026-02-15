<script lang="ts">
  import { createEventDispatcher, tick, onDestroy } from 'svelte';
  import { setIcon } from 'obsidian';
  import { Icon } from 'obsidian-svelte';
  import { i18n } from 'src/lib/stores/i18n';
  import { app } from 'src/lib/stores/obsidian';
  import { DataFieldType, type DataField, type DataRecord } from 'src/lib/dataframe/dataframe';
  import type { AgendaFilter, AgendaFilterOperator } from 'src/settings/v3/settings';
  import { getOperatorsForFieldType, operatorNeedsValue } from './operatorHelpers';
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
  
  /* ── State ── */
  let showFieldDropdown = false;
  let showOperatorDropdown = false;
  let fieldSearch = '';
  let fieldWrapperEl: HTMLDivElement;
  let operatorWrapperEl: HTMLDivElement;
  let valueInputEl: HTMLInputElement;

  /* ── Imperative dropdown containers (portaled to body) ── */
  let fieldPopoverEl: HTMLDivElement | null = null;
  let operatorPopoverEl: HTMLDivElement | null = null;
  let valuePopoverEl: HTMLDivElement | null = null;
  let showValueDropdown = false;
  let valueSelectedIdx = 0;

  /* ── Reactive data ── */
  $: currentField = fields.find(f => f.name === filter.field);
  $: operators = currentField ? getOperatorsForFieldType(currentField.type) : [];
  $: needsValue = operatorNeedsValue(filter.operator);
  $: isDateField = currentField?.type === DataFieldType.Date;
  $: filteredFields = fieldSearch.trim()
    ? fields.filter(f => f.name.toLowerCase().includes(fieldSearch.trim().toLowerCase()))
    : fields;

  let fieldSelectedIdx = 0;
  $: if (filteredFields) fieldSelectedIdx = 0;

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

  /* ═══════════════════════════════════════
     IMPERATIVE POPOVER — creates dropdown in activeDocument.body
     bypasses all transform/overflow/scoped-CSS issues
     ═══════════════════════════════════════ */

  /* CSS classes are defined in styles.css under .ppp-popover-* prefix */

  function computePosition(trigger: HTMLElement, minW: number): { top: number; left: number; width: number; maxH: number; flipUp: boolean } {
    const rect = trigger.getBoundingClientRect();
    let left = rect.left;
    const width = Math.max(rect.width, minW);
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
    if (left < 4) left = 4;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const flipUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const top = flipUp ? 0 : rect.bottom + 4;
    const maxH = flipUp ? spaceAbove : Math.max(spaceBelow, 200);
    return { top, left, width, maxH, flipUp };
  }

  function positionContainer(el: HTMLDivElement, trigger: HTMLElement, minW: number) {
    const pos = computePosition(trigger, minW);
    el.style.left = `${pos.left}px`;
    el.style.width = `${pos.width}px`;
    el.style.maxHeight = `${pos.maxH}px`;
    if (pos.flipUp) {
      el.style.bottom = `${window.innerHeight - trigger.getBoundingClientRect().top + 4}px`;
      el.style.top = 'auto';
    } else {
      el.style.top = `${pos.top}px`;
      el.style.bottom = 'auto';
    }
  }

  /* ── FIELD DROPDOWN ── */
  function renderFieldPopover() {
    destroyFieldPopover();
    const chip = fieldWrapperEl?.querySelector('.chip') as HTMLElement;
    if (!chip) return;

    const container = activeDocument.createElement('div');
    container.addClass('ppp-popover-container');
    container.classList.add('ppp-filter-popover');
    positionContainer(container, chip, 260);

    // Search bar
    const searchBar = activeDocument.createElement('div');
    searchBar.addClass('ppp-popover-search');
    const searchIcon = activeDocument.createElement('span');
    setIcon(searchIcon, 'search');
    searchBar.appendChild(searchIcon);
    const searchInput = activeDocument.createElement('input');
    searchInput.addClass('ppp-popover-search-input');
    searchInput.type = 'text';
    searchInput.placeholder = t('field-placeholder') || 'Search fields...';
    searchInput.autocomplete = 'off';
    searchInput.spellcheck = false;
    searchBar.appendChild(searchInput);
    container.appendChild(searchBar);

    // List
    const list = activeDocument.createElement('div');
    list.addClass('ppp-popover-list');
    // min-height for at least 5 items (5×32 = 160), but max 300
    const itemH = 32;
    const visibleCount = Math.min(Math.max(fields.length, 1), 8);
    list.style.maxHeight = `${Math.min(visibleCount * itemH + 8, 300)}px`;
    if (fields.length >= 5) {
      list.style.minHeight = `${5 * itemH + 8}px`;
    }
    container.appendChild(list);

    function renderItems(searchText: string) {
      list.empty();
      const lower = searchText.trim().toLowerCase();
      const filtered = lower
        ? fields.filter(f => f.name.toLowerCase().includes(lower))
        : fields;

      if (filtered.length === 0) {
        const empty = activeDocument.createElement('div');
        empty.addClass('ppp-popover-empty');
        empty.textContent = t('no-value') || 'No results';
        list.appendChild(empty);
        return;
      }

      filtered.forEach(f => {
        const btn = activeDocument.createElement('button');
        const isSelected = f.name === filter.field;
        btn.addClass('ppp-popover-item');
        if (isSelected) btn.addClass('ppp-popover-item--selected');
        btn.type = 'button';

        // Icon
        const iconSpan = activeDocument.createElement('span');
        iconSpan.addClass('ppp-popover-item-icon');
        const iconName = getFieldIconName(f);
        setIcon(iconSpan, iconName);
        if (isSelected) iconSpan.style.color = 'var(--interactive-accent)';
        btn.appendChild(iconSpan);

        // Label
        const label = activeDocument.createElement('span');
        label.addClass('ppp-popover-label');
        label.textContent = f.name;
        btn.appendChild(label);

        // Check mark
        if (isSelected) {
          const check = activeDocument.createElement('span');
          check.addClass('ppp-popover-item-icon');
          check.style.color = 'var(--interactive-accent)';
          setIcon(check, 'check');
          btn.appendChild(check);
        }

        btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--background-modifier-hover)'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = isSelected ? '' : 'transparent'; });
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          selectField(f.name);
        });
        list.appendChild(btn);
      });
    }

    renderItems('');

    searchInput.addEventListener('input', () => {
      renderItems(searchInput.value);
    });
    searchInput.addEventListener('keydown', (e) => {
      const items = list.querySelectorAll('button');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        fieldSelectedIdx = Math.min(fieldSelectedIdx + 1, items.length - 1);
        items[fieldSelectedIdx]?.scrollIntoView({ block: 'nearest' });
        items.forEach((it, i) => { (it as HTMLElement).style.background = i === fieldSelectedIdx ? 'var(--background-modifier-hover)' : 'transparent'; });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        fieldSelectedIdx = Math.max(fieldSelectedIdx - 1, 0);
        items[fieldSelectedIdx]?.scrollIntoView({ block: 'nearest' });
        items.forEach((it, i) => { (it as HTMLElement).style.background = i === fieldSelectedIdx ? 'var(--background-modifier-hover)' : 'transparent'; });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        (items[fieldSelectedIdx] as HTMLElement)?.click();
      } else if (e.key === 'Escape') {
        closeFieldDropdown();
      }
    });

    activeDocument.body.appendChild(container);
    fieldPopoverEl = container;
    searchInput.focus();
  }

  function destroyFieldPopover() {
    if (fieldPopoverEl && fieldPopoverEl.parentNode) {
      fieldPopoverEl.parentNode.removeChild(fieldPopoverEl);
    }
    fieldPopoverEl = null;
  }

  /* ── OPERATOR DROPDOWN ── */
  function renderOperatorPopover() {
    destroyOperatorPopover();
    const chip = operatorWrapperEl?.querySelector('.chip') as HTMLElement;
    if (!chip) return;

    const container = activeDocument.createElement('div');
    container.addClass('ppp-popover-container');
    container.classList.add('ppp-filter-popover');
    positionContainer(container, chip, 220);

    const list = activeDocument.createElement('div');
    list.addClass('ppp-popover-list');
    const itemH = 32;
    const visibleCount = Math.min(Math.max(operators.length, 1), 8);
    list.style.maxHeight = `${Math.min(visibleCount * itemH + 8, 300)}px`;
    if (operators.length >= 5) {
      list.style.minHeight = `${5 * itemH + 8}px`;
    }
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
        check.style.color = 'var(--interactive-accent)';
        setIcon(check, 'check');
        btn.appendChild(check);
      }

      btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--background-modifier-hover)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = isSelected ? '' : 'transparent'; });
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
    if (operatorPopoverEl && operatorPopoverEl.parentNode) {
      operatorPopoverEl.parentNode.removeChild(operatorPopoverEl);
    }
    operatorPopoverEl = null;
  }

  /* ── Toggle functions ── */
  async function openFieldDropdown() {
    closeOperatorDropdown();
    if (showFieldDropdown) { closeFieldDropdown(); return; }
    fieldSearch = '';
    fieldSelectedIdx = 0;
    showFieldDropdown = true;
    await tick();
    renderFieldPopover();
  }

  function openOperatorDropdown() {
    closeFieldDropdown();
    if (showOperatorDropdown) { closeOperatorDropdown(); return; }
    showOperatorDropdown = true;
    renderOperatorPopover();
  }

  function closeFieldDropdown() {
    showFieldDropdown = false;
    destroyFieldPopover();
  }

  function closeOperatorDropdown() {
    showOperatorDropdown = false;
    destroyOperatorPopover();
  }

  /* Close dropdowns on outside click */
  function handleWindowMousedown(e: MouseEvent) {
    const target = e.target as Node;
    if (showFieldDropdown && fieldWrapperEl && !fieldWrapperEl.contains(target)
        && (!fieldPopoverEl || !fieldPopoverEl.contains(target))) {
      closeFieldDropdown();
    }
    if (showOperatorDropdown && operatorWrapperEl && !operatorWrapperEl.contains(target)
        && (!operatorPopoverEl || !operatorPopoverEl.contains(target))) {
      closeOperatorDropdown();
    }
    if (showValueDropdown && valueInputEl && !valueInputEl.contains(target)
        && (!valuePopoverEl || !valuePopoverEl.contains(target))) {
      closeValueDropdown();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeFieldDropdown();
      closeOperatorDropdown();
      closeValueDropdown();
    }
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
  
  function handleValueInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    dispatch('update', { ...filter, value: val });
    // Re-compute suggestions if stale, then show filtered list
    if (valueSuggestions.length === 0) {
      valueSuggestions = getValueSuggestions();
    }
    showValueSuggestions(val);
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
    
    // ── Primary source: actual DataRecords (most reliable) ──
    if (records.length > 0) {
      for (const record of records) {
        const raw = record.values[fieldName];
        if (raw == null) continue;
        
        // Strip wiki-link: [[path|display]] → display
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
    
    // ── Secondary source: vault frontmatter scan (supplements records) ──
    if ($app && values.size < MAX_SUGGESTIONS) {
      const vault = $app.vault;
      const metadataCache = $app.metadataCache;
      
      // Special handling for tags field
      if (fieldName === 'tags' && currentField.repeated) {
        vault.getMarkdownFiles().forEach(file => {
          const cache = metadataCache.getFileCache(file);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Obsidian CachedMetadata tags type
          if (cache?.['tags']) {
            cache['tags'].forEach((tag: any) => { values.add(tag.tag); });
          }
          if (cache?.frontmatter?.['tags']) {
            const tags = Array.isArray(cache.frontmatter['tags'])
              ? cache.frontmatter['tags']
              : [cache.frontmatter['tags']];
            tags.forEach(tag => values.add(typeof tag === 'string' ? `#${tag}` : tag));
          }
        });
      } else {
        vault.getMarkdownFiles().forEach(file => {
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
  
  // Declare valueSuggestions, then reactively recompute when deps change
  let valueSuggestions: string[] = [];
  $: if (currentField || records || $app) {
    valueSuggestions = getValueSuggestions();
  }

  /* ── VALUE SUGGESTIONS POPOVER ── */
  function showValueSuggestions(inputText: string) {
    if (valueSuggestions.length === 0 || !valueInputEl) {
      closeValueDropdown();
      return;
    }
    const q = (inputText ?? '').toLowerCase().trim();
    const filtered = q
      ? valueSuggestions.filter(s => s.toLowerCase().includes(q))
      : valueSuggestions;
    if (filtered.length === 0) {
      closeValueDropdown();
      return;
    }
    showValueDropdown = true;
    valueSelectedIdx = 0;
    renderValuePopover(filtered);
  }

  function renderValuePopover(items: string[]) {
    destroyValuePopover();
    if (!valueInputEl || items.length === 0) return;

    const container = activeDocument.createElement('div');
    container.addClass('ppp-popover-container');
    container.classList.add('ppp-filter-popover');
    positionContainer(container, valueInputEl, 200);

    const list = activeDocument.createElement('div');
    list.addClass('ppp-popover-list');
    const itemH = 32;
    const visibleCount = Math.min(Math.max(items.length, 1), 8);
    list.style.maxHeight = `${Math.min(visibleCount * itemH + 8, 300)}px`;
    container.appendChild(list);

    items.forEach((val, idx) => {
      const btn = activeDocument.createElement('button');
      const isSelected = val === String(filter.value ?? '');
      btn.addClass('ppp-popover-item');
      if (isSelected) btn.addClass('ppp-popover-item--selected');
      if (idx === valueSelectedIdx) btn.addClass('ppp-popover-item--hover');
      btn.type = 'button';
      btn.dataset['idx'] = String(idx);

      const label = activeDocument.createElement('span');
      label.addClass('ppp-popover-label');
      label.textContent = val;
      btn.appendChild(label);

      if (isSelected) {
        const check = activeDocument.createElement('span');
        check.addClass('ppp-popover-item-icon');
        check.style.color = 'var(--interactive-accent)';
        setIcon(check, 'check');
        btn.appendChild(check);
      }

      btn.addEventListener('mouseenter', () => {
        valueSelectedIdx = idx;
        const btns = list.querySelectorAll('button');
        btns.forEach((b, i) => {
          (b as HTMLElement).style.background = i === idx ? 'var(--background-modifier-hover)' : 'transparent';
        });
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = isSelected ? '' : 'transparent';
      });
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent blur
        selectValue(val);
      });
      list.appendChild(btn);
    });

    // Footer hint
    const footer = activeDocument.createElement('div');
    footer.addClass('ppp-popover-footer');
    footer.createSpan({ text: '↑↓ навигация' });
    footer.createSpan({ text: 'Enter — вставить' });
    footer.createSpan({ text: 'Esc — закрыть' });
    container.appendChild(footer);

    activeDocument.body.appendChild(container);
    valuePopoverEl = container;
  }

  function selectValue(val: string) {
    dispatch('update', { ...filter, value: val });
    closeValueDropdown();
    // Update the input element directly
    tick().then(() => {
      if (valueInputEl) {
        valueInputEl.value = val;
        valueInputEl.focus();
      }
    });
  }

  function handleValueKeydown(e: KeyboardEvent) {
    if (!showValueDropdown || !valuePopoverEl) return;
    const items = valuePopoverEl.querySelectorAll('button');
    if (items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      valueSelectedIdx = Math.min(valueSelectedIdx + 1, items.length - 1);
      items.forEach((it, i) => { (it as HTMLElement).style.background = i === valueSelectedIdx ? 'var(--background-modifier-hover)' : 'transparent'; });
      items[valueSelectedIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      valueSelectedIdx = Math.max(valueSelectedIdx - 1, 0);
      items.forEach((it, i) => { (it as HTMLElement).style.background = i === valueSelectedIdx ? 'var(--background-modifier-hover)' : 'transparent'; });
      items[valueSelectedIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      (items[valueSelectedIdx] as HTMLElement)?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeValueDropdown();
    }
  }

  function handleValueFocus() {
    // Re-compute suggestions eagerly on focus (in case reactive update hasn't fired yet)
    valueSuggestions = getValueSuggestions();
    if (valueSuggestions.length > 0) {
      showValueSuggestions(String(filter.value ?? ''));
    }
  }

  function handleValueBlur() {
    // Delay to allow mousedown on popover items
    setTimeout(() => closeValueDropdown(), 200);
  }

  function destroyValuePopover() {
    if (valuePopoverEl && valuePopoverEl.parentNode) {
      valuePopoverEl.parentNode.removeChild(valuePopoverEl);
    }
    valuePopoverEl = null;
  }

  function closeValueDropdown() {
    showValueDropdown = false;
    destroyValuePopover();
  }

  onDestroy(() => {
    destroyFieldPopover();
    destroyOperatorPopover();
    destroyValuePopover();
  });
</script>

<svelte:window on:mousedown={handleWindowMousedown} on:keydown={handleKeydown} />

<div class="filter-row" class:filter-row--disabled={filter.enabled === false}>
  <!-- Row prefix: Где / и -->
  {#if prefix}
    <span class="row-prefix">{prefix}</span>
  {/if}
  
  <!-- ═══ Enable/Disable toggle ═══ -->
  <button
    class="row-toggle clickable-icon"
    class:row-toggle--off={filter.enabled === false}
    type="button"
    on:click|stopPropagation={() => dispatch('update', { ...filter, enabled: filter.enabled === false ? true : false })}
    title={filter.enabled === false ? (t('enable-filter') || 'Enable filter') : (t('disable-filter') || 'Disable filter')}
  >
    <Icon name={filter.enabled === false ? 'eye-off' : 'eye'} size="sm" />
  </button>

  <!-- ═══ Field chip ═══ -->
  <div class="chip-wrapper" bind:this={fieldWrapperEl}>
    <button class="chip chip--field" type="button" on:click={openFieldDropdown} title={filter.field || ''}>
      <span class="chip-icon">
        <Icon name={getFieldIconName(currentField)} size="sm" />
      </span>
      <span class="chip-label">{filter.field || t('field-placeholder')}</span>
      <span class="chip-chevron">
        <Icon name="chevron-down" size="xs" />
      </span>
    </button>
  </div>
  
  <!-- ═══ Operator chip ═══ -->
  <div class="chip-wrapper" bind:this={operatorWrapperEl}>
    <button class="chip chip--operator" type="button" on:click={openOperatorDropdown}>
      <span class="chip-label">{getOperatorLabel(filter.operator)}</span>
      <span class="chip-chevron">
        <Icon name="chevron-down" size="xs" />
      </span>
    </button>
  </div>
  
  <!-- ═══ Value area ═══ -->
  <div class="value-area">
    {#if needsValue}
      {#if isDateField}
        <DateFormulaInput
          value={filter.value?.toString() ?? ''}
          placeholder={t('value-placeholder') || 'Value...'}
          on:input={(e) => handleDateValue(e.detail)}
        />
      {:else}
        <input
          bind:this={valueInputEl}
          class="value-input"
          type="text"
          value={filter.value ?? ''}
          on:input={handleValueInput}
          on:keydown={handleValueKeydown}
          on:focus={handleValueFocus}
          on:blur={handleValueBlur}
          placeholder={t('value-placeholder') || 'Value...'}
        />
      {/if}
    {:else}
      <span class="no-value">{t('no-value') || '—'}</span>
    {/if}
  </div>
  
  <!-- ═══ Delete button ═══ -->
  <button
    class="row-delete clickable-icon"
    type="button"
    on:click|stopPropagation={() => dispatch('remove')}
    title={t('remove-filter')}
  >
    <Icon name="trash-2" size="sm" />
  </button>
</div>

<style>
  /* ═══════════════════════════════════════
     ROW — single inline horizontal row
     ═══════════════════════════════════════ */
  .filter-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0;
    min-height: 32px;
  }
  
  .filter-row:hover {
    background: var(--background-secondary);
    border-radius: 6px;
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
  .filter-row--disabled .value-input,
  .filter-row--disabled .no-value {
    pointer-events: none;
  }
  
  /* ── Row prefix (Где / и) ── */
  .row-prefix {
    flex-shrink: 0;
    width: 32px;
    text-align: right;
    color: var(--text-muted);
    font-size: 12px;
    padding-right: 2px;
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
    gap: 4px;
    height: 26px;
    padding: 0 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 13px;
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
    outline: 2px solid var(--interactive-accent);
    outline-offset: 1px;
  }
  
  .chip-icon {
    display: inline-flex;
    align-items: center;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  
  .chip-label {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .chip-chevron {
    display: inline-flex;
    align-items: center;
    color: var(--text-faint);
    flex-shrink: 0;
    margin-left: 2px;
  }
  
  .chip--field .chip-label {
    font-weight: 500;
  }
  
  /* ═══════════════════════════════════════
     VALUE — inline text input
     ═══════════════════════════════════════ */
  .value-area {
    flex: 1;
    min-width: 80px;
  }
  
  .value-input {
    width: 100%;
    height: 26px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    font-family: var(--font-interface);
    padding: 0 8px;
    outline: none;
    transition: border-color 100ms ease;
    box-sizing: border-box;
  }
  
  .value-input::placeholder {
    color: var(--text-faint);
  }
  
  .value-input:focus {
    border-color: var(--interactive-accent);
  }
  
  .no-value {
    display: inline-block;
    color: var(--text-faint);
    font-size: 12px;
    font-style: italic;
    padding: 4px 8px;
  }
  
  /* ═══════════════════════════════════════
     DELETE — trash icon (hidden until row hover)
     ═══════════════════════════════════════ */
  .row-toggle {
    flex-shrink: 0;
    color: var(--text-faint);
    border-radius: 4px;
    padding: 4px;
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
    border-radius: 4px;
    padding: 4px;
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
      gap: 4px;
      min-height: 40px;
    }
    
    .chip {
      height: 34px;
      padding: 0 10px;
      font-size: 14px;
    }
    
    .value-input {
      height: 34px;
      font-size: 14px;
    }
    
    .row-toggle {
      opacity: 1;
      padding: 6px;
    }
    
    .row-delete {
      opacity: 1;
      padding: 6px;
    }
  }
</style>
