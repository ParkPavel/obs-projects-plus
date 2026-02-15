<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { setIcon } from 'obsidian';
  import { Icon } from 'obsidian-svelte';
  import { i18n } from 'src/lib/stores/i18n';
  import { getDateFormulaSuggestions, testDateFormula, isDateFormula } from 'src/lib/helpers/dateFormulaParser';
  import type { DateFormulaSuggestion } from 'src/lib/helpers/dateFormulaParser';
  
  const dispatch = createEventDispatcher<{
    input: string;
  }>();
  
  export let value: string = '';
  export let placeholder: string = '';
  
  let showSuggestions = false;
  let filteredSuggestions: DateFormulaSuggestion[] = [];
  let selectedIndex = 0;
  let inputElement: HTMLInputElement;
  
  /** Imperative popover element portaled to activeDocument.body */
  let popoverEl: HTMLDivElement | null = null;
  
  const allSuggestions = getDateFormulaSuggestions();
  
  $: {
    const query = value.toLowerCase().trim();
    if (query.length > 0) {
      filteredSuggestions = allSuggestions.filter(s => 
        s.formula.toLowerCase().includes(query) ||
        s.label.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query)
      );
    } else {
      filteredSuggestions = allSuggestions;
    }
    selectedIndex = 0;
  }
  
  // Re-render popover when filtered suggestions change while visible
  $: if (showSuggestions && popoverEl) {
    renderPopoverContent(filteredSuggestions, selectedIndex);
  }
  
  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
    dispatch('input', value);
  }
  
  /* ═══════════════════════════════════════
     IMPERATIVE POPOVER — portaled to activeDocument.body
     Bypasses transform/overflow/scoped-CSS issues in Obsidian modals
     ═══════════════════════════════════════ */

  function computePopoverPosition(trigger: HTMLElement): { top: number; left: number; width: number; maxH: number; flipUp: boolean } {
    const rect = trigger.getBoundingClientRect();
    let left = rect.left;
    const width = Math.max(rect.width, 300);
    if (left + width > window.innerWidth - 16) left = window.innerWidth - width - 16;
    if (left < 8) left = 8;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const flipUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const maxH = flipUp ? Math.min(spaceAbove, 320) : Math.min(spaceBelow, 320);
    const top = flipUp ? 0 : rect.bottom + 4;
    return { top, left, width, maxH, flipUp };
  }

  function createPopover() {
    destroyPopover();
    if (!inputElement) return;

    const pos = computePopoverPosition(inputElement);

    const el = activeDocument.createElement('div');
    el.setAttribute('style', [
      'position:fixed', `z-index:10000`,
      `left:${pos.left}px`, `width:${pos.width}px`, `max-height:${pos.maxH}px`,
      'border:1px solid var(--background-modifier-border)',
      'border-radius:8px', 'background:var(--background-primary)',
      'box-shadow:0 6px 24px rgba(0,0,0,0.28),0 2px 8px rgba(0,0,0,0.14)',
      'overflow:hidden', 'display:flex', 'flex-direction:column',
      'font-family:var(--font-interface)',
    ].join(';'));

    if (pos.flipUp) {
      const rect = inputElement.getBoundingClientRect();
      el.style.bottom = `${window.innerHeight - rect.top + 4}px`;
      el.style.top = 'auto';
    } else {
      el.style.top = `${pos.top}px`;
    }

    // ── Header ──
    const header = activeDocument.createElement('div');
    header.setAttribute('style', [
      'display:flex', 'align-items:center', 'gap:6px',
      'padding:6px 10px', 'border-bottom:1px solid var(--background-modifier-border)',
      'background:var(--background-secondary)', 'color:var(--text-muted)',
      'font-size:11px', 'font-weight:600', 'flex-shrink:0',
    ].join(';'));
    const clockSpan = activeDocument.createElement('span');
    setIcon(clockSpan, 'clock');
    header.appendChild(clockSpan);
    header.appendChild(activeDocument.createTextNode(
      ' ' + ($i18n.t('views.calendar.agenda.custom.filter-editor.date-suggestions') || 'Формулы дат')
    ));
    el.appendChild(header);

    // ── List container ──
    const list = activeDocument.createElement('div');
    list.setAttribute('style', 'flex:1;overflow-y:auto;padding:4px 0;');
    list.dataset['role'] = 'list';
    el.appendChild(list);

    // ── Footer ──
    const footer = activeDocument.createElement('div');
    footer.setAttribute('style', [
      'padding:4px 10px', 'border-top:1px solid var(--background-modifier-border)',
      'background:var(--background-secondary)', 'text-align:center', 'flex-shrink:0',
    ].join(';'));
    const footerSmall = activeDocument.createElement('small');
    footerSmall.setAttribute('style', 'color:var(--text-faint);font-size:10px;');
    footerSmall.textContent = '↑↓ · Enter · Esc';
    footer.appendChild(footerSmall);
    el.appendChild(footer);

    activeDocument.body.appendChild(el);
    popoverEl = el;
    renderPopoverContent(filteredSuggestions, selectedIndex);
  }

  function renderPopoverContent(suggestions: DateFormulaSuggestion[], selIdx: number) {
    if (!popoverEl) return;
    const list = popoverEl.querySelector('[data-role="list"]') as HTMLElement | null;
    if (!list) return;
    list.empty();

    if (suggestions.length === 0) {
      const empty = activeDocument.createElement('div');
      empty.setAttribute('style', 'padding:12px;text-align:center;color:var(--text-faint);font-size:12px;');
      empty.textContent = 'Нет совпадений';
      list.appendChild(empty);
      return;
    }

    // Group by category
    const categoryLabels: Record<string, string> = {
      relative: '📅 Относительные',
      week: '📆 Неделя',
      month: '🗓 Месяц',
      year: '📋 Год',
    };
    let lastCat = '';

    suggestions.forEach((s, idx) => {
      // Category separator
      if (s.category !== lastCat) {
        lastCat = s.category;
        const sep = activeDocument.createElement('div');
        sep.setAttribute('style', [
          'padding:4px 12px 2px', 'color:var(--text-faint)',
          'font-size:10px', 'font-weight:600', 'text-transform:uppercase',
          'letter-spacing:0.04em',
          idx > 0 ? 'margin-top:4px;border-top:1px solid var(--background-modifier-border-focus,rgba(128,128,128,0.15))' : '',
        ].join(';'));
        sep.textContent = categoryLabels[s.category] || s.category;
        list.appendChild(sep);
      }

      const isSelected = idx === selIdx;

      // Single-line item: [formula] label  — description
      const btn = activeDocument.createElement('button');
      btn.type = 'button';
      btn.tabIndex = -1;
      btn.title = s.description;
      btn.setAttribute('style', [
        'width:100%', 'display:flex', 'align-items:center', 'gap:8px',
        'padding:5px 10px', 'border:none', 'border-radius:4px',
        `background:${isSelected ? 'var(--background-modifier-hover)' : 'transparent'}`,
        'text-align:left', 'cursor:pointer', 'font-family:var(--font-interface)',
        'box-sizing:border-box', 'min-height:28px',
      ].join(';'));

      // Formula badge
      const badge = activeDocument.createElement('code');
      badge.setAttribute('style', [
        'padding:1px 6px', 'border-radius:3px', 'flex-shrink:0',
        'background:var(--background-modifier-success,rgba(0,180,0,0.12))',
        'color:var(--text-accent)', 'font-size:11px', 'font-family:var(--font-monospace)',
        'font-weight:600', 'white-space:nowrap',
      ].join(';'));
      badge.textContent = s.formula;
      btn.appendChild(badge);

      // Label
      const label = activeDocument.createElement('span');
      label.setAttribute('style', 'color:var(--text-normal);font-size:12px;font-weight:500;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;');
      label.textContent = s.label;
      btn.appendChild(label);

      // Short description (right-aligned, muted)
      const desc = activeDocument.createElement('span');
      desc.setAttribute('style', 'color:var(--text-faint);font-size:10px;white-space:nowrap;flex-shrink:0;');
      desc.textContent = s.description;
      btn.appendChild(desc);

      btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--background-modifier-hover)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = isSelected ? 'var(--background-modifier-hover)' : 'transparent'; });
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectSuggestion(s.formula);
      });

      list.appendChild(btn);
    });

    // Scroll selected into view
    const btns = list.querySelectorAll('button');
    if (btns[selIdx]) {
      btns[selIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  function destroyPopover() {
    if (popoverEl && popoverEl.parentNode) {
      popoverEl.parentNode.removeChild(popoverEl);
    }
    popoverEl = null;
  }

  function handleFocus() {
    showSuggestions = true;
    createPopover();
  }
  
  function handleBlur() {
    // Small delay to allow mousedown on suggestion to fire
    setTimeout(() => {
      showSuggestions = false;
      destroyPopover();
    }, 200);
  }
  
  function selectSuggestion(formula: string) {
    value = formula;
    dispatch('input', value);
    showSuggestions = false;
    destroyPopover();
    inputElement?.focus();
  }
  
  function handleKeyDown(e: KeyboardEvent) {
    if (!showSuggestions || filteredSuggestions.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % filteredSuggestions.length;
        renderPopoverContent(filteredSuggestions, selectedIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = selectedIndex === 0 ? filteredSuggestions.length - 1 : selectedIndex - 1;
        renderPopoverContent(filteredSuggestions, selectedIndex);
        break;
      case 'Enter':
        e.preventDefault();
        const selected = filteredSuggestions[selectedIndex];
        if (selected) {
          selectSuggestion(selected.formula);
        }
        break;
      case 'Escape':
        e.preventDefault();
        showSuggestions = false;
        destroyPopover();
        break;
    }
  }
  
  $: isFormula = isDateFormula(value);
  $: formulaTest = isFormula ? testDateFormula(value) : '';
  
  onDestroy(() => {
    destroyPopover();
  });
</script>

<div class="date-formula-input">
  <div class="input-wrapper">
    <input
      bind:this={inputElement}
      type="text"
      class="formula-input"
      class:is-formula={isFormula}
      {value}
      {placeholder}
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      on:keydown={handleKeyDown}
    />
    {#if isFormula}
      <div class="formula-indicator" title="Date formula detected">
        <Icon name="calendar-clock" size="xs" />
      </div>
    {/if}
  </div>
  
  {#if isFormula && formulaTest}
    <div class="formula-preview" class:error={formulaTest.startsWith('❌')}>
      {formulaTest}
    </div>
  {/if}
</div>

<style>
  .date-formula-input {
    position: relative;
    min-width: 0;
    width: 100%;
  }
  
  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  
  .formula-input {
    width: 100%;
    height: 26px;
    padding: 0 24px 0 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    font-family: var(--font-monospace);
    outline: none;
    box-sizing: border-box;
    transition: border-color 100ms ease;
  }
  
  .formula-input:focus {
    border-color: var(--interactive-accent);
  }
  
  .formula-input.is-formula {
    border-color: var(--interactive-accent);
    background: var(--background-primary-alt);
  }
  
  .formula-indicator {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    color: var(--interactive-accent);
    pointer-events: none;
  }
  
  .formula-preview {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-muted);
    font-size: 11px;
    font-family: var(--font-monospace);
    line-height: 1.3;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .formula-preview.error {
    background: var(--background-modifier-error);
    color: var(--text-error);
  }

  @media (pointer: coarse) {
    .formula-input {
      height: 34px;
      font-size: 14px;
    }
  }
</style>
