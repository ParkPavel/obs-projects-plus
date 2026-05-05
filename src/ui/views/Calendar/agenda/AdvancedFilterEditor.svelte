<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
  import { Icon } from 'obsidian-svelte';
  import type { DataField } from 'src/lib/dataframe/dataframe';
  import { validateFormula, type ValidationError } from 'src/lib/helpers/formulaParser';

  export let formula: string = '';
  export let fields: DataField[] = [];

  const dispatch = createEventDispatcher<{
    change: string;
  }>();

  let textarea: HTMLTextAreaElement;
  let errors: ValidationError[] = [];
  let showHelp = false;

  // в”Ђв”Ђ Autocomplete state в”Ђв”Ђ
  let acVisible = false;
  let acItems: AcItem[] = [];
  let acIndex = 0;
  let acPopover: HTMLDivElement | null = null;
  let acWordStart = 0;
  let acWordEnd = 0;

  interface AcItem {
    label: string;        // Display name (e.g. AND, status)
    insert: string;       // Text to insert
    kind: 'function' | 'field' | 'keyword' | 'snippet';
    args?: string;        // Function signature hint
    desc: string;         // Description
    category?: string;    // Category name
  }

  // в”Ђв”Ђ Full function catalog (DQL-aligned) в”Ђв”Ђ
  const FUNCTION_CATALOG: AcItem[] = [
    // Logical
    { label: 'AND', insert: 'AND(', kind: 'function', args: '...СѓСЃР»РѕРІРёСЏ', desc: 'Р’СЃРµ СѓСЃР»РѕРІРёСЏ РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ TRUE', category: 'рџ”— Р›РѕРіРёС‡РµСЃРєРёРµ' },
    { label: 'OR', insert: 'OR(', kind: 'function', args: '...СѓСЃР»РѕРІРёСЏ', desc: 'РҐРѕС‚СЏ Р±С‹ РѕРґРЅРѕ СѓСЃР»РѕРІРёРµ TRUE', category: 'рџ”— Р›РѕРіРёС‡РµСЃРєРёРµ' },
    { label: 'NOT', insert: 'NOT(', kind: 'function', args: 'СѓСЃР»РѕРІРёРµ', desc: 'РРЅРІРµСЂС‚РёСЂСѓРµС‚ СѓСЃР»РѕРІРёРµ', category: 'рџ”— Р›РѕРіРёС‡РµСЃРєРёРµ' },

    // Empty checks
    { label: 'IS_EMPTY', insert: 'IS_EMPTY(', kind: 'function', args: 'РїРѕР»Рµ', desc: 'РџРѕР»Рµ РїСѓСЃС‚РѕРµ (null/""/ [])', category: 'рџ”Ќ РџСЂРѕРІРµСЂРєРё' },
    { label: 'IS_NOT_EMPTY', insert: 'IS_NOT_EMPTY(', kind: 'function', args: 'РїРѕР»Рµ', desc: 'РџРѕР»Рµ РЅРµ РїСѓСЃС‚РѕРµ', category: 'рџ”Ќ РџСЂРѕРІРµСЂРєРё' },

    // String
    { label: 'CONTAINS', insert: 'CONTAINS(', kind: 'function', args: 'РїРѕР»Рµ, "С‚РµРєСЃС‚"', desc: 'РЎРѕРґРµСЂР¶РёС‚ С‚РµРєСЃС‚ (СЂРµРіРёСЃС‚СЂ РёРіРЅРѕСЂ.)', category: 'рџ“ќ РЎС‚СЂРѕРєРё' },
    { label: 'NOT_CONTAINS', insert: 'NOT_CONTAINS(', kind: 'function', args: 'РїРѕР»Рµ, "С‚РµРєСЃС‚"', desc: 'РќРµ СЃРѕРґРµСЂР¶РёС‚ С‚РµРєСЃС‚', category: 'рџ“ќ РЎС‚СЂРѕРєРё' },
    { label: 'STARTS_WITH', insert: 'STARTS_WITH(', kind: 'function', args: 'РїРѕР»Рµ, "РїСЂРµС„РёРєСЃ"', desc: 'РќР°С‡РёРЅР°РµС‚СЃСЏ СЃ', category: 'рџ“ќ РЎС‚СЂРѕРєРё' },
    { label: 'ENDS_WITH', insert: 'ENDS_WITH(', kind: 'function', args: 'РїРѕР»Рµ, "СЃСѓС„С„РёРєСЃ"', desc: 'Р—Р°РєР°РЅС‡РёРІР°РµС‚СЃСЏ РЅР°', category: 'рџ“ќ РЎС‚СЂРѕРєРё' },

    // Date constants
    { label: 'TODAY', insert: 'TODAY()', kind: 'function', args: '', desc: 'РўРµРєСѓС‰Р°СЏ РґР°С‚Р°', category: 'рџ“… Р”Р°С‚С‹' },
    { label: 'NOW', insert: 'NOW()', kind: 'function', args: '', desc: 'РўРµРєСѓС‰Р°СЏ РґР°С‚Р° (= TODAY)', category: 'рџ“… Р”Р°С‚С‹' },
    { label: 'TOMORROW', insert: 'TOMORROW()', kind: 'function', args: '', desc: 'Р—Р°РІС‚СЂР°', category: 'рџ“… Р”Р°С‚С‹' },
    { label: 'YESTERDAY', insert: 'YESTERDAY()', kind: 'function', args: '', desc: 'Р’С‡РµСЂР°', category: 'рџ“… Р”Р°С‚С‹' },

    // Date checks
    { label: 'IS_TODAY', insert: 'IS_TODAY(', kind: 'function', args: 'РґР°С‚Р°РџРѕР»Рµ', desc: 'Р”Р°С‚Р° = СЃРµРіРѕРґРЅСЏ', category: 'рџ“… Р”Р°С‚С‹' },
    { label: 'IS_THIS_WEEK', insert: 'IS_THIS_WEEK(', kind: 'function', args: 'РґР°С‚Р°РџРѕР»Рµ', desc: 'Р”Р°С‚Р° РЅР° СЌС‚РѕР№ РЅРµРґРµР»Рµ', category: 'рџ“… Р”Р°С‚С‹' },
    { label: 'IS_THIS_MONTH', insert: 'IS_THIS_MONTH(', kind: 'function', args: 'РґР°С‚Р°РџРѕР»Рµ', desc: 'Р”Р°С‚Р° РІ СЌС‚РѕРј РјРµСЃСЏС†Рµ', category: 'рџ“… Р”Р°С‚С‹' },
    { label: 'IS_BEFORE', insert: 'IS_BEFORE(', kind: 'function', args: 'РґР°С‚Р°1, РґР°С‚Р°2', desc: 'РґР°С‚Р°1 СЂР°РЅСЊС€Рµ РґР°С‚Р°2', category: 'рџ“… Р”Р°С‚С‹' },
    { label: 'IS_AFTER', insert: 'IS_AFTER(', kind: 'function', args: 'РґР°С‚Р°1, РґР°С‚Р°2', desc: 'РґР°С‚Р°1 РїРѕР·Р¶Рµ РґР°С‚Р°2', category: 'рџ“… Р”Р°С‚С‹' },
    { label: 'IS_ON_AND_BEFORE', insert: 'IS_ON_AND_BEFORE(', kind: 'function', args: 'РґР°С‚Р°1, РґР°С‚Р°2', desc: 'РґР°С‚Р°1 в‰¤ РґР°С‚Р°2', category: 'рџ“… Р”Р°С‚С‹' },
    { label: 'IS_ON_AND_AFTER', insert: 'IS_ON_AND_AFTER(', kind: 'function', args: 'РґР°С‚Р°1, РґР°С‚Р°2', desc: 'РґР°С‚Р°1 в‰Ґ РґР°С‚Р°2', category: 'рџ“… Р”Р°С‚С‹' },
    { label: 'IS_OVERDUE', insert: 'IS_OVERDUE(', kind: 'function', args: 'РґР°С‚Р°РџРѕР»Рµ', desc: 'Р”Р°С‚Р° РїСЂРѕСЃСЂРѕС‡РµРЅР°', category: 'рџ“… Р”Р°С‚С‹' },
    { label: 'IS_UPCOMING', insert: 'IS_UPCOMING(', kind: 'function', args: 'РґР°С‚Р°РџРѕР»Рµ', desc: 'Р”Р°С‚Р° РїСЂРµРґСЃС‚РѕСЏС‰Р°СЏ', category: 'рџ“… Р”Р°С‚С‹' },
    { label: 'DATE_ADD', insert: 'DATE_ADD(', kind: 'function', args: 'РґР°С‚Р°, РєРѕР»-РІРѕ, "d|w|m|y"', desc: 'Р”РѕР±Р°РІРёС‚СЊ Рє РґР°С‚Рµ', category: 'рџ“… Р”Р°С‚С‹' },
    { label: 'DATE_SUB', insert: 'DATE_SUB(', kind: 'function', args: 'РґР°С‚Р°, РєРѕР»-РІРѕ, "d|w|m|y"', desc: 'Р’С‹С‡РµСЃС‚СЊ РёР· РґР°С‚С‹', category: 'рџ“… Р”Р°С‚С‹' },

    // Arrays
    { label: 'HAS_ANY_OF', insert: 'HAS_ANY_OF(', kind: 'function', args: 'РїРѕР»Рµ, ["a","b"]', desc: 'РњР°СЃСЃРёРІ СЃРѕРґРµСЂР¶РёС‚ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕ', category: 'рџ“‹ РњР°СЃСЃРёРІС‹ / РўРµРіРё' },
    { label: 'HAS_ALL_OF', insert: 'HAS_ALL_OF(', kind: 'function', args: 'РїРѕР»Рµ, ["a","b"]', desc: 'РњР°СЃСЃРёРІ СЃРѕРґРµСЂР¶РёС‚ РІСЃРµ', category: 'рџ“‹ РњР°СЃСЃРёРІС‹ / РўРµРіРё' },
    { label: 'HAS_NONE_OF', insert: 'HAS_NONE_OF(', kind: 'function', args: 'РїРѕР»Рµ, ["a","b"]', desc: 'РњР°СЃСЃРёРІ РЅРµ СЃРѕРґРµСЂР¶РёС‚ РЅРё РѕРґРЅРѕРіРѕ', category: 'рџ“‹ РњР°СЃСЃРёРІС‹ / РўРµРіРё' },
  ];

  // в”Ђв”Ђ Snippet templates for common patterns в”Ђв”Ђ
  const SNIPPET_CATALOG: AcItem[] = [
    { label: 'рџ“Њ РђРєС‚РёРІРЅС‹Рµ Р·Р°РґР°С‡Рё', insert: 'AND(status = "Active", IS_NOT_EMPTY(dueDate))', kind: 'snippet', desc: 'РђРєС‚РёРІРЅС‹Рµ СЃ РґР°С‚РѕР№', category: 'вљЎ РЁР°Р±Р»РѕРЅС‹' },
    { label: 'рџ”Ґ РЎСЂРѕС‡РЅС‹Рµ РїСЂРѕСЃСЂРѕС‡РµРЅРЅС‹Рµ', insert: 'AND(IS_OVERDUE(dueDate), CONTAINS(tags, "urgent"))', kind: 'snippet', desc: 'РџСЂРѕСЃСЂРѕС‡РµРЅРЅС‹Рµ + urgent', category: 'вљЎ РЁР°Р±Р»РѕРЅС‹' },
    { label: 'рџ“… Р—Р°РґР°С‡Рё РЅР° СЌС‚Сѓ РЅРµРґРµР»СЋ', insert: 'IS_THIS_WEEK(dueDate)', kind: 'snippet', desc: 'Р’СЃРµ РЅР° СЌС‚РѕР№ РЅРµРґРµР»Рµ', category: 'вљЎ РЁР°Р±Р»РѕРЅС‹' },
    { label: 'рџ“‹ РџРѕ СЃС‚Р°С‚СѓСЃСѓ Рё РїСЂРёРѕСЂРёС‚РµС‚Сѓ', insert: 'AND(status = "", priority > 5)', kind: 'snippet', desc: 'Р¤РёР»СЊС‚СЂ РїРѕ РґРІСѓРј РїРѕР»СЏРј', category: 'вљЎ РЁР°Р±Р»РѕРЅС‹' },
    { label: 'рџ—“ Р‘РµР· РґР°С‚С‹ РёР»Рё РїСЂРѕСЃСЂРѕС‡РµРЅРЅС‹Рµ', insert: 'OR(IS_EMPTY(dueDate), IS_OVERDUE(dueDate))', kind: 'snippet', desc: 'РџСѓСЃС‚Р°СЏ РґР°С‚Р° РР›Р РїСЂРѕСЃСЂРѕС‡РµРЅРѕ', category: 'вљЎ РЁР°Р±Р»РѕРЅС‹' },
  ];

  // Keyword items
  const KEYWORD_ITEMS: AcItem[] = [
    { label: 'true', insert: 'true', kind: 'keyword', desc: 'Р›РѕРіРёС‡РµСЃРєРѕРµ TRUE' },
    { label: 'false', insert: 'false', kind: 'keyword', desc: 'Р›РѕРіРёС‡РµСЃРєРѕРµ FALSE' },
    { label: 'null', insert: 'null', kind: 'keyword', desc: 'РџСѓСЃС‚РѕРµ Р·РЅР°С‡РµРЅРёРµ' },
  ];

  // в”Ђв”Ђ Build full autocomplete list в”Ђв”Ђ
  function buildAcItems(query: string): AcItem[] {
    const q = query.toLowerCase();
    const results: AcItem[] = [];

    // If empty query and cursor at start в†’ show snippets first
    if (!q && formula.trim() === '') {
      results.push(...SNIPPET_CATALOG);
    }

    // Functions matching query
    for (const fn of FUNCTION_CATALOG) {
      if (!q || fn.label.toLowerCase().includes(q)) {
        results.push(fn);
      }
    }

    // Fields matching query
    for (const field of fields) {
      if (!q || field.name.toLowerCase().includes(q)) {
        results.push({
          label: field.name,
          insert: field.name,
          kind: 'field',
          desc: `РџРѕР»Рµ (${fieldTypeLabel(field.type)})`,
          category: 'рџ“„ РџРѕР»СЏ',
        });
      }
    }

    // Keywords
    for (const kw of KEYWORD_ITEMS) {
      if (q && kw.label.startsWith(q)) {
        results.push(kw);
      }
    }

    // Snippets (when query matches)
    if (q) {
      for (const sn of SNIPPET_CATALOG) {
        if (sn.label.toLowerCase().includes(q) || sn.desc.toLowerCase().includes(q)) {
          if (!results.includes(sn)) results.push(sn);
        }
      }
    }

    return results.slice(0, 20); // Limit to 20 items
  }

  function fieldTypeLabel(type: string): string {
    const map: Record<string, string> = {
      string: 'РЎС‚СЂРѕРєР°', number: 'Р§РёСЃР»Рѕ', boolean: 'Р§РµРєР±РѕРєСЃ',
      date: 'Р”Р°С‚Р°', unknown: 'РќРµРёР·РІРµСЃС‚РЅРѕ', list: 'РЎРїРёСЃРѕРє',
    };
    return map[type] ?? type;
  }

  // в”Ђв”Ђ Extract the word at cursor в”Ђв”Ђ
  function getWordAtCursor(): { word: string; start: number; end: number } {
    if (!textarea) return { word: '', start: 0, end: 0 };
    const pos = textarea.selectionStart;
    const text = formula;
    
    // Walk backward to find word start
    let start = pos;
    while (start > 0) {
      const ch = text[start - 1]!;
      if (/[a-zA-Z0-9_]/.test(ch)) {
        start--;
      } else {
        break;
      }
    }
    
    // Word is from start to cursor position
    return { word: text.substring(start, pos), start, end: pos };
  }

  // в”Ђв”Ђ Show autocomplete popover (imperative DOM) в”Ђв”Ђ
  function showAutocomplete() {
    const { word, start, end } = getWordAtCursor();
    acWordStart = start;
    acWordEnd = end;

    const items = buildAcItems(word);
    if (items.length === 0) {
      hideAutocomplete();
      return;
    }

    acItems = items;
    acIndex = 0;
    acVisible = true;
    renderAcPopover();
  }

  function hideAutocomplete() {
    acVisible = false;
    acItems = [];
    if (acPopover) {
      acPopover.remove();
      acPopover = null;
    }
  }

  function applyAcItem(item: AcItem) {
    if (!textarea) return;
    
    const before = formula.substring(0, acWordStart);
    const after = formula.substring(acWordEnd);
    
    formula = before + item.insert + after;
    dispatch('change', formula);
    
    hideAutocomplete();
    
    // Place cursor after inserted text
    const newPos = acWordStart + item.insert.length;
    tick().then(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  // в”Ђв”Ђ Render the autocomplete popover вЂ” Google Sheets-style inline hint в”Ђв”Ђ
  function renderAcPopover() {
    if (acPopover) acPopover.remove();
    if (!textarea || acItems.length === 0) return;

    const rect = textarea.getBoundingClientRect();
    // Position: flush to textarea's left edge, directly ABOVE the textarea.
    // This keeps it out of the way вЂ” user sees suggestions while typing.
    const popupMaxH = 220;
    const spaceAbove = rect.top - 8;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const useAbove = spaceAbove >= 100 || spaceAbove > spaceBelow;

    const el = activeDocument.createElement('div');
    el.setAttribute('style', [
      'position:fixed',
      `left:${rect.left}px`,
      `width:${rect.width}px`,
      useAbove
        ? `bottom:${window.innerHeight - rect.top + 2}px`
        : `top:${rect.bottom + 2}px`,
      'z-index:10001',
      `max-height:${Math.min(popupMaxH, useAbove ? spaceAbove : spaceBelow)}px`,
      'overflow-y:auto',
      'overflow-x:hidden',
      // Translucent background вЂ” like Google Sheets
      'background:color-mix(in srgb, var(--background-primary) 88%, transparent)',
      'backdrop-filter:blur(0.75rem)',
      '-webkit-backdrop-filter:blur(0.75rem)',
      'border:1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent)',
      'border-radius:0.5rem',
      'box-shadow:0 0.25rem 1rem rgba(0,0,0,0.12)',
      'padding:0.1875rem 0',
      'font-size:0.75rem',
    ].join(';'));

    renderAcContent(el);
    activeDocument.body.appendChild(el);
    acPopover = el;
  }

  function renderAcContent(el: HTMLDivElement) {
    el.empty();

    let lastCategory = '';

    acItems.forEach((item, idx) => {
      // Category separator
      if (item.category && item.category !== lastCategory) {
        lastCategory = item.category;
        const sep = activeDocument.createElement('div');
        sep.setAttribute('style', [
          'padding:0.25rem 0.75rem 0.125rem',
          'font-size:0.6875rem',
          'font-weight:600',
          'color:var(--text-muted)',
          'user-select:none',
          idx > 0 ? 'border-top:1px solid color-mix(in srgb, var(--background-modifier-border) 40%, transparent);margin-top:1px;padding-top:1px' : '',
        ].join(';'));
        sep.textContent = item.category;
        el.appendChild(sep);
      }

      const row = activeDocument.createElement('div');
      const isActive = idx === acIndex;
      row.setAttribute('style', [
        'display:flex',
        'align-items:center',
        'gap:0.375rem',
        'padding:0.1875rem 0.5rem',
        'cursor:pointer',
        'min-height:1.5rem',
        'transition:background 0.08s ease',
        'border-radius:0.25rem',
        'margin:0 0.1875rem',
        isActive
          ? 'background:color-mix(in srgb, var(--interactive-accent) 18%, transparent)'
          : '',
      ].join(';'));
      row.dataset['acIdx'] = String(idx);

      // Subtle kind indicator (monochrome, just a letter)
      const badge = activeDocument.createElement('span');
      badge.setAttribute('style', [
        'display:inline-flex',
        'align-items:center',
        'justify-content:center',
        'width:1rem',
        'height:1rem',
        'border-radius:0.1875rem',
        'font-size:0.5625rem',
        'font-weight:600',
        'flex-shrink:0',
        'opacity:0.55',
        isActive
          ? 'color:var(--interactive-accent);opacity:0.9'
          : 'color:var(--text-muted)',
      ].join(';'));
      badge.textContent = item.kind === 'function' ? 'Ж’' : item.kind === 'field' ? 'в—†' : item.kind === 'snippet' ? 'вљЎ' : 'K';
      row.appendChild(badge);

      // Label
      const label = activeDocument.createElement('span');
      label.setAttribute('style', [
        'font-family:var(--font-monospace)',
        'font-size:0.75rem',
        'font-weight:500',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
        isActive ? 'color:var(--text-normal)' : 'color:var(--text-normal)',
      ].join(';'));
      label.textContent = item.label;
      row.appendChild(label);

      // Args hint (for functions) вЂ” subtle inline
      if (item.args !== undefined && item.args !== '') {
        const args = activeDocument.createElement('span');
        args.setAttribute('style', [
          'color:var(--text-faint)',
          'font-size:0.6875rem',
          'opacity:0.7',
          'white-space:nowrap',
        ].join(';'));
        args.textContent = `(${item.args})`;
        row.appendChild(args);
      }

      // Description вЂ” only show for active item to keep it ultra-compact
      if (isActive && item.desc) {
        const desc = activeDocument.createElement('span');
        desc.setAttribute('style', [
          'margin-left:auto',
          'color:var(--text-faint)',
          'font-size:0.625rem',
          'white-space:nowrap',
          'overflow:hidden',
          'text-overflow:ellipsis',
          'max-width:8.75rem',
          'flex-shrink:0',
        ].join(';'));
        desc.textContent = item.desc;
        row.appendChild(desc);
      }

      // Events
      row.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent blur
        applyAcItem(item);
      });
      row.addEventListener('mouseenter', () => {
        acIndex = idx;
        updateAcHighlight(el);
      });

      el.appendChild(row);
    });
  }

  function updateAcHighlight(el: HTMLDivElement) {
    const rows = el.querySelectorAll<HTMLDivElement>('[data-ac-idx]');
    rows.forEach((row) => {
      const idx = Number(row.dataset['acIdx']);
      const isActive = idx === acIndex;
      if (isActive) {
        row.style.background = 'color-mix(in srgb, var(--interactive-accent) 18%, transparent)';
        row.scrollIntoView({ block: 'nearest' });
      } else {
        row.style.background = '';
      }
      // Update badge opacity
      const badge = row.querySelector('span');
      if (badge && badge.style.width === '1rem') {
        badge.style.opacity = isActive ? '0.9' : '0.55';
        badge.style.color = isActive ? 'var(--interactive-accent)' : 'var(--text-muted)';
      }
    });
  }

  function scrollAcToIndex() {
    if (!acPopover) return;
    const rows = acPopover.querySelectorAll<HTMLDivElement>('[data-ac-idx]');
    const target = rows[acIndex];
    if (target) target.scrollIntoView({ block: 'nearest' });
    updateAcHighlight(acPopover);
  }

  // в”Ђв”Ђ Validate formula on change в”Ђв”Ђ
  $: {
    if (formula.trim()) {
      const fieldNames = fields.map(f => f.name);
      errors = validateFormula(formula, fieldNames);
    } else {
      errors = [];
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    formula = target.value;
    dispatch('change', formula);

    // Trigger autocomplete after typing
    requestAnimationFrame(() => showAutocomplete());
  }

  function insertText(text: string) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = formula.substring(0, start);
    const after = formula.substring(end);
    formula = before + text + after;
    dispatch('change', formula);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + text.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }

  function handleKeyDown(e: KeyboardEvent) {
    // в”Ђв”Ђ Autocomplete keyboard navigation в”Ђв”Ђ
    if (acVisible && acItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        acIndex = (acIndex + 1) % acItems.length;
        scrollAcToIndex();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        acIndex = (acIndex - 1 + acItems.length) % acItems.length;
        scrollAcToIndex();
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (acItems[acIndex]) {
          e.preventDefault();
          applyAcItem(acItems[acIndex]!);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
        return;
      }
    }

    // Ctrl+Space: Force show autocomplete
    if (e.ctrlKey && e.key === ' ') {
      e.preventDefault();
      showAutocomplete();
      return;
    }

    // Tab when no AC: Insert spaces
    if (e.key === 'Tab' && !acVisible) {
      e.preventDefault();
      insertText('  ');
    }
  }

  function handleBlur() {
    // Delay to allow mousedown on popover items
    setTimeout(() => hideAutocomplete(), 200);
  }

  function handleFocus() {
    // Show snippets if formula is empty
    if (formula.trim() === '') {
      requestAnimationFrame(() => showAutocomplete());
    }
  }

  onMount(() => {
    if (textarea) textarea.focus();
  });

  onDestroy(() => {
    hideAutocomplete();
  });
</script>

<div class="advanced-filter-editor">
  <!-- Toolbar -->
  <div class="editor-toolbar">
    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        on:click={() => {
          textarea?.focus();
          requestAnimationFrame(() => showAutocomplete());
        }}
        title="РђРІС‚РѕРґРѕРїРѕР»РЅРµРЅРёРµ (Ctrl+Space)"
      >
        <Icon name="sparkles" size="sm" />
        <span>РђРІС‚Рѕ</span>
      </button>
      <button 
        class="toolbar-btn" 
        on:click={() => showHelp = !showHelp}
        class:active={showHelp}
        title="РЎРїСЂР°РІРєР° РїРѕ СЃРёРЅС‚Р°РєСЃРёСЃСѓ"
      >
        <Icon name="help-circle" size="sm" />
        <span>РЎРїСЂР°РІРєР°</span>
      </button>
    </div>
    <div class="toolbar-hint">
      {#if errors.length > 0}
        <span class="hint-error">вљ  {errors.length} {errors.length === 1 ? 'РѕС€РёР±РєР°' : 'РѕС€РёР±РѕРє'}</span>
      {:else if formula.trim()}
        <span class="hint-valid">вњ“ Р¤РѕСЂРјСѓР»Р° РІР°Р»РёРґРЅР°</span>
      {:else}
        <span class="hint-info">Ctrl+Space вЂ” РїРѕРґСЃРєР°Р·РєРё</span>
      {/if}
    </div>
  </div>

  <!-- Help Panel -->
  {#if showHelp}
    <div class="help-panel">
      <div class="help-columns">
        <div class="help-col">
          <h4>рџ”— Р›РѕРіРёС‡РµСЃРєРёРµ</h4>
          <code>AND(СѓСЃР»РѕРІРёРµ1, СѓСЃР»РѕРІРёРµ2)</code>
          <code>OR(СѓСЃР»РѕРІРёРµ1, СѓСЃР»РѕРІРёРµ2)</code>
          <code>NOT(СѓСЃР»РѕРІРёРµ)</code>
          
          <h4>рџ“ќ РЎС‚СЂРѕРєРё</h4>
          <code>CONTAINS(РїРѕР»Рµ, "С‚РµРєСЃС‚")</code>
          <code>STARTS_WITH(РїРѕР»Рµ, "РЅР°С‡Р°Р»Рѕ")</code>
          <code>ENDS_WITH(РїРѕР»Рµ, "РєРѕРЅРµС†")</code>
          
          <h4>рџ”Ќ РџСЂРѕРІРµСЂРєРё</h4>
          <code>IS_EMPTY(РїРѕР»Рµ)</code>
          <code>IS_NOT_EMPTY(РїРѕР»Рµ)</code>
        </div>
        <div class="help-col">
          <h4>рџ“… Р”Р°С‚С‹</h4>
          <code>IS_TODAY(РґР°С‚Р°)  IS_OVERDUE(РґР°С‚Р°)</code>
          <code>IS_THIS_WEEK(РґР°С‚Р°)</code>
          <code>IS_BEFORE(РґР°С‚Р°1, РґР°С‚Р°2)</code>
          <code>TODAY()  TOMORROW()  YESTERDAY()</code>
          <code>DATE_ADD(РґР°С‚Р°, 1, "w")</code>
          
          <h4>рџ“‹ РњР°СЃСЃРёРІС‹ / РўРµРіРё</h4>
          <code>HAS_ANY_OF(С‚РµРіРё, ["a","b"])</code>
          <code>HAS_ALL_OF(С‚РµРіРё, ["a","b"])</code>
          
          <h4>вљ™ РћРїРµСЂР°С‚РѕСЂС‹</h4>
          <code>=  !=  &gt;  &lt;  &gt;=  &lt;=  +  -  *  /</code>
        </div>
      </div>
      <div class="help-examples">
        <strong>РџСЂРёРјРµСЂС‹:</strong>
        <code>AND(status = "Active", priority &gt; 5)</code>
        <code>OR(IS_EMPTY(dueDate), IS_OVERDUE(dueDate))</code>
        <code>AND(CONTAINS(tags, "urgent"), dueDate &lt;= TODAY())</code>
      </div>
    </div>
  {/if}

  <!-- Formula Editor -->
  <div class="editor-container">
    <textarea
      bind:this={textarea}
      class="formula-textarea"
      class:has-error={errors.length > 0}
      class:has-valid={errors.length === 0 && formula.trim() !== ''}
      value={formula}
      on:input={handleInput}
      on:keydown={handleKeyDown}
      on:blur={handleBlur}
      on:focus={handleFocus}
      placeholder={'РќР°С‡РЅРёС‚Рµ РІРІРѕРґРёС‚СЊ С„РѕСЂРјСѓР»Сѓ РёР»Рё РЅР°Р¶РјРёС‚Рµ Ctrl+Space...\n\nРџСЂРёРјРµСЂС‹:\nAND(status = "Active", priority > 5)\nIS_OVERDUE(dueDate)\nCONTAINS(tags, "urgent")'}
      spellcheck="false"
    />
    
    <!-- Validation Errors -->
    {#if errors.length > 0}
      <div class="validation-errors">
        {#each errors as error}
          <div class="error-item">
            <Icon name="alert-circle" size="xs" />
            <span>{error.message}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .advanced-filter-editor {
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    overflow: hidden;
  }

  /* в”Ђв”Ђ Toolbar в”Ђв”Ђ */
  .editor-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--size-4-1) var(--size-4-2);
    background: var(--background-secondary);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    gap: var(--size-4-2);
  }

  .toolbar-group {
    display: flex;
    gap: var(--size-4-1);
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.5rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toolbar-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .toolbar-btn.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .toolbar-hint {
    font-size: var(--font-ui-smaller);
    padding: 0 var(--size-4-1);
  }

  .hint-error { color: var(--text-error); font-weight: 600; }
  .hint-valid { color: var(--color-green); font-weight: 500; }
  .hint-info { color: var(--text-faint); }

  /* в”Ђв”Ђ Help panel в”Ђв”Ђ */
  .help-panel {
    padding: var(--size-4-2);
    background: var(--background-secondary);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    max-height: 14rem;
    overflow-y: auto;
  }

  .help-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--size-4-2);
  }

  .help-col h4 {
    margin: 0.35rem 0 0.15rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .help-col h4:first-child { margin-top: 0; }

  .help-col code, .help-examples code {
    display: block;
    padding: 0.1rem var(--size-4-1);
    margin: 0.1rem 0;
    background: var(--code-background);
    border-radius: var(--radius-s);
    font-family: var(--font-monospace);
    font-size: 0.65rem;
    color: var(--code-normal);
    line-height: 1.5;
  }

  .help-examples {
    margin-top: var(--size-4-2);
    padding-top: var(--size-4-2);
    border-top: 0.0625rem solid var(--background-modifier-border);
  }

  .help-examples strong {
    display: block;
    font-size: var(--font-ui-smaller);
    margin-bottom: var(--size-4-1);
    color: var(--text-muted);
  }

  /* в”Ђв”Ђ Editor в”Ђв”Ђ */
  .editor-container {
    position: relative;
    flex: 1;
    min-height: 6rem;
  }

  .formula-textarea {
    width: 100%;
    min-height: 6rem;
    padding: var(--size-4-2) var(--size-4-3);
    border: none;
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-size: var(--font-ui-small);
    line-height: 1.5;
    resize: vertical;
  }
  .formula-textarea.has-error {
    border-left: 0.125rem solid var(--text-error);
  }

  .formula-textarea.has-valid {
    border-left: 0.125rem solid var(--color-green);
  }

  .formula-textarea::placeholder {
    color: var(--text-faint);
    opacity: 0.5;
    font-size: var(--font-ui-smaller);
  }

  /* в”Ђв”Ђ Validation Errors в”Ђв”Ђ */
  .validation-errors {
    padding: var(--size-4-2);
    background: var(--background-modifier-error);
    border-top: 0.0625rem solid var(--text-error);
  }

  .error-item {
    display: flex;
    align-items: start;
    gap: var(--size-4-1);
    padding: var(--size-4-1) 0;
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
  }

  .error-item:not(:last-child) {
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }
</style>
