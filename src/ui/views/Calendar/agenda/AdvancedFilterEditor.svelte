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

  // ── Autocomplete state ──
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

  // ── Full function catalog (DQL-aligned) ──
  const FUNCTION_CATALOG: AcItem[] = [
    // Logical
    { label: 'AND', insert: 'AND(', kind: 'function', args: '...условия', desc: 'Все условия должны быть TRUE', category: '🔗 Логические' },
    { label: 'OR', insert: 'OR(', kind: 'function', args: '...условия', desc: 'Хотя бы одно условие TRUE', category: '🔗 Логические' },
    { label: 'NOT', insert: 'NOT(', kind: 'function', args: 'условие', desc: 'Инвертирует условие', category: '🔗 Логические' },

    // Empty checks
    { label: 'IS_EMPTY', insert: 'IS_EMPTY(', kind: 'function', args: 'поле', desc: 'Поле пустое (null/""/ [])', category: '🔍 Проверки' },
    { label: 'IS_NOT_EMPTY', insert: 'IS_NOT_EMPTY(', kind: 'function', args: 'поле', desc: 'Поле не пустое', category: '🔍 Проверки' },

    // String
    { label: 'CONTAINS', insert: 'CONTAINS(', kind: 'function', args: 'поле, "текст"', desc: 'Содержит текст (регистр игнор.)', category: '📝 Строки' },
    { label: 'NOT_CONTAINS', insert: 'NOT_CONTAINS(', kind: 'function', args: 'поле, "текст"', desc: 'Не содержит текст', category: '📝 Строки' },
    { label: 'STARTS_WITH', insert: 'STARTS_WITH(', kind: 'function', args: 'поле, "префикс"', desc: 'Начинается с', category: '📝 Строки' },
    { label: 'ENDS_WITH', insert: 'ENDS_WITH(', kind: 'function', args: 'поле, "суффикс"', desc: 'Заканчивается на', category: '📝 Строки' },

    // Date constants
    { label: 'TODAY', insert: 'TODAY()', kind: 'function', args: '', desc: 'Текущая дата', category: '📅 Даты' },
    { label: 'NOW', insert: 'NOW()', kind: 'function', args: '', desc: 'Текущая дата (= TODAY)', category: '📅 Даты' },
    { label: 'TOMORROW', insert: 'TOMORROW()', kind: 'function', args: '', desc: 'Завтра', category: '📅 Даты' },
    { label: 'YESTERDAY', insert: 'YESTERDAY()', kind: 'function', args: '', desc: 'Вчера', category: '📅 Даты' },

    // Date checks
    { label: 'IS_TODAY', insert: 'IS_TODAY(', kind: 'function', args: 'датаПоле', desc: 'Дата = сегодня', category: '📅 Даты' },
    { label: 'IS_THIS_WEEK', insert: 'IS_THIS_WEEK(', kind: 'function', args: 'датаПоле', desc: 'Дата на этой неделе', category: '📅 Даты' },
    { label: 'IS_THIS_MONTH', insert: 'IS_THIS_MONTH(', kind: 'function', args: 'датаПоле', desc: 'Дата в этом месяце', category: '📅 Даты' },
    { label: 'IS_BEFORE', insert: 'IS_BEFORE(', kind: 'function', args: 'дата1, дата2', desc: 'дата1 раньше дата2', category: '📅 Даты' },
    { label: 'IS_AFTER', insert: 'IS_AFTER(', kind: 'function', args: 'дата1, дата2', desc: 'дата1 позже дата2', category: '📅 Даты' },
    { label: 'IS_ON_AND_BEFORE', insert: 'IS_ON_AND_BEFORE(', kind: 'function', args: 'дата1, дата2', desc: 'дата1 ≤ дата2', category: '📅 Даты' },
    { label: 'IS_ON_AND_AFTER', insert: 'IS_ON_AND_AFTER(', kind: 'function', args: 'дата1, дата2', desc: 'дата1 ≥ дата2', category: '📅 Даты' },
    { label: 'IS_OVERDUE', insert: 'IS_OVERDUE(', kind: 'function', args: 'датаПоле', desc: 'Дата просрочена', category: '📅 Даты' },
    { label: 'IS_UPCOMING', insert: 'IS_UPCOMING(', kind: 'function', args: 'датаПоле', desc: 'Дата предстоящая', category: '📅 Даты' },
    { label: 'DATE_ADD', insert: 'DATE_ADD(', kind: 'function', args: 'дата, кол-во, "d|w|m|y"', desc: 'Добавить к дате', category: '📅 Даты' },
    { label: 'DATE_SUB', insert: 'DATE_SUB(', kind: 'function', args: 'дата, кол-во, "d|w|m|y"', desc: 'Вычесть из даты', category: '📅 Даты' },

    // Arrays
    { label: 'HAS_ANY_OF', insert: 'HAS_ANY_OF(', kind: 'function', args: 'поле, ["a","b"]', desc: 'Массив содержит хотя бы одно', category: '📋 Массивы / Теги' },
    { label: 'HAS_ALL_OF', insert: 'HAS_ALL_OF(', kind: 'function', args: 'поле, ["a","b"]', desc: 'Массив содержит все', category: '📋 Массивы / Теги' },
    { label: 'HAS_NONE_OF', insert: 'HAS_NONE_OF(', kind: 'function', args: 'поле, ["a","b"]', desc: 'Массив не содержит ни одного', category: '📋 Массивы / Теги' },
  ];

  // ── Snippet templates for common patterns ──
  const SNIPPET_CATALOG: AcItem[] = [
    { label: '📌 Активные задачи', insert: 'AND(status = "Active", IS_NOT_EMPTY(dueDate))', kind: 'snippet', desc: 'Активные с датой', category: '⚡ Шаблоны' },
    { label: '🔥 Срочные просроченные', insert: 'AND(IS_OVERDUE(dueDate), CONTAINS(tags, "urgent"))', kind: 'snippet', desc: 'Просроченные + urgent', category: '⚡ Шаблоны' },
    { label: '📅 Задачи на эту неделю', insert: 'IS_THIS_WEEK(dueDate)', kind: 'snippet', desc: 'Все на этой неделе', category: '⚡ Шаблоны' },
    { label: '📋 По статусу и приоритету', insert: 'AND(status = "", priority > 5)', kind: 'snippet', desc: 'Фильтр по двум полям', category: '⚡ Шаблоны' },
    { label: '🗓 Без даты или просроченные', insert: 'OR(IS_EMPTY(dueDate), IS_OVERDUE(dueDate))', kind: 'snippet', desc: 'Пустая дата ИЛИ просрочено', category: '⚡ Шаблоны' },
  ];

  // Keyword items
  const KEYWORD_ITEMS: AcItem[] = [
    { label: 'true', insert: 'true', kind: 'keyword', desc: 'Логическое TRUE' },
    { label: 'false', insert: 'false', kind: 'keyword', desc: 'Логическое FALSE' },
    { label: 'null', insert: 'null', kind: 'keyword', desc: 'Пустое значение' },
  ];

  // ── Build full autocomplete list ──
  function buildAcItems(query: string): AcItem[] {
    const q = query.toLowerCase();
    const results: AcItem[] = [];

    // If empty query and cursor at start → show snippets first
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
          desc: `Поле (${fieldTypeLabel(field.type)})`,
          category: '📄 Поля',
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
      string: 'Строка', number: 'Число', boolean: 'Чекбокс',
      date: 'Дата', unknown: 'Неизвестно', list: 'Список',
    };
    return map[type] ?? type;
  }

  // ── Extract the word at cursor ──
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

  // ── Show autocomplete popover (imperative DOM) ──
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

  // ── Render the autocomplete popover using imperative DOM ──
  function renderAcPopover() {
    if (acPopover) acPopover.remove();
    if (!textarea || acItems.length === 0) return;

    const rect = textarea.getBoundingClientRect();
    // Approximate cursor position (line-based)
    const textBeforeCursor = formula.substring(0, textarea.selectionStart);
    const lines = textBeforeCursor.split('\n');
    const lineIndex = lines.length - 1;
    const charWidth = 8.5; // approximate monospace
    const cursorCol = (lines[lineIndex] ?? '').length;

    // Horizontal: at cursor column, clamped to not overflow right edge
    const popWidth = 400; // approximate popup width
    const popX = Math.min(
      rect.left + Math.min(cursorCol * charWidth, rect.width - 20),
      window.innerWidth - popWidth - 8
    );
    
    // Vertical: always position BELOW the textarea, never overlapping it
    const popupMaxH = 300;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    let popY: number;
    if (spaceBelow >= popupMaxH) {
      // Enough space below — place directly under textarea
      popY = rect.bottom + 4;
    } else if (spaceBelow >= 120) {
      // Some space below — use it (popup will be shorter via max-height)
      popY = rect.bottom + 4;
    } else {
      // No space below — place above textarea
      popY = rect.top - popupMaxH - 4;
      if (popY < 4) popY = 4;
    }

    const el = activeDocument.createElement('div');
    el.setAttribute('style', [
      'position:fixed',
      `left:${Math.max(4, popX)}px`,
      `top:${popY}px`,
      'z-index:10001',
      'min-width:340px',
      'max-width:480px',
      `max-height:${Math.min(popupMaxH, Math.max(spaceBelow, 120))}px`,
      'overflow-y:auto',
      'background:var(--background-primary)',
      'border:1px solid var(--background-modifier-border)',
      'border-radius:6px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.25)',
      'padding:4px 0',
      'font-size:13px',
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
          'padding:4px 12px 2px',
          'font-size:11px',
          'font-weight:600',
          'color:var(--text-muted)',
          'user-select:none',
          idx > 0 ? 'border-top:1px solid var(--background-modifier-border);margin-top:2px;padding-top:6px' : '',
        ].join(';'));
        sep.textContent = item.category;
        el.appendChild(sep);
      }

      const row = activeDocument.createElement('div');
      const isActive = idx === acIndex;
      row.setAttribute('style', [
        'display:flex',
        'align-items:center',
        'gap:8px',
        'padding:5px 12px',
        'cursor:pointer',
        'min-height:28px',
        'transition:background 0.1s',
        isActive ? 'background:var(--interactive-accent);color:var(--text-on-accent)' : '',
      ].join(';'));
      row.dataset['acIdx'] = String(idx);

      // Kind badge
      const badge = activeDocument.createElement('span');
      const badgeColors: Record<string, string> = {
        function: 'background:#7c3aed;color:#fff',
        field: 'background:#0891b2;color:#fff',
        keyword: 'background:#d97706;color:#fff',
        snippet: 'background:#059669;color:#fff',
      };
      badge.setAttribute('style', [
        'display:inline-flex',
        'align-items:center',
        'justify-content:center',
        'min-width:20px',
        'height:18px',
        'border-radius:3px',
        'font-size:10px',
        'font-weight:700',
        'padding:0 4px',
        'flex-shrink:0',
        badgeColors[item.kind] ?? '',
      ].join(';'));
      badge.textContent = item.kind === 'function' ? 'ƒ' : item.kind === 'field' ? '◆' : item.kind === 'snippet' ? '⚡' : 'K';
      row.appendChild(badge);

      // Label
      const label = activeDocument.createElement('span');
      label.setAttribute('style', [
        'font-family:var(--font-monospace)',
        'font-weight:600',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
      ].join(';'));
      label.textContent = item.label;
      row.appendChild(label);

      // Args hint (for functions)
      if (item.args !== undefined && item.args !== '') {
        const args = activeDocument.createElement('span');
        args.setAttribute('style', [
          'color:' + (isActive ? 'var(--text-on-accent)' : 'var(--text-muted)'),
          'font-size:11px',
          'opacity:0.8',
          'white-space:nowrap',
        ].join(';'));
        args.textContent = `(${item.args})`;
        row.appendChild(args);
      }

      // Description (right-aligned)
      const desc = activeDocument.createElement('span');
      desc.setAttribute('style', [
        'margin-left:auto',
        'color:' + (isActive ? 'var(--text-on-accent)' : 'var(--text-faint)'),
        'font-size:11px',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
        'max-width:160px',
        'flex-shrink:0',
      ].join(';'));
      desc.textContent = item.desc;
      row.appendChild(desc);

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

    // Footer hint
    const footer = activeDocument.createElement('div');
    footer.setAttribute('style', [
      'padding:4px 12px',
      'font-size:10px',
      'color:var(--text-faint)',
      'border-top:1px solid var(--background-modifier-border)',
      'display:flex',
      'gap:12px',
    ].join(';'));
    footer.createSpan({ text: '↑↓ навигация' });
    footer.createSpan({ text: 'Tab / Enter — вставить' });
    footer.createSpan({ text: 'Esc — закрыть' });
    el.appendChild(footer);
  }

  function updateAcHighlight(el: HTMLDivElement) {
    const rows = el.querySelectorAll<HTMLDivElement>('[data-ac-idx]');
    rows.forEach((row) => {
      const idx = Number(row.dataset['acIdx']);
      const isActive = idx === acIndex;
      if (isActive) {
        row.style.background = 'var(--interactive-accent)';
        row.style.color = 'var(--text-on-accent)';
        row.scrollIntoView({ block: 'nearest' });
      } else {
        row.style.background = '';
        row.style.color = '';
      }
      // Update desc/args colors
      const spans = row.querySelectorAll('span');
      spans.forEach((span) => {
        if (span.style.marginLeft === 'auto' || span.style.opacity === '0.8') {
          span.style.color = isActive ? 'var(--text-on-accent)' : 'var(--text-faint)';
        }
      });
    });
  }

  function scrollAcToIndex() {
    if (!acPopover) return;
    const rows = acPopover.querySelectorAll<HTMLDivElement>('[data-ac-idx]');
    const target = rows[acIndex];
    if (target) target.scrollIntoView({ block: 'nearest' });
    updateAcHighlight(acPopover);
  }

  // ── Validate formula on change ──
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
    // ── Autocomplete keyboard navigation ──
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
        title="Автодополнение (Ctrl+Space)"
      >
        <Icon name="sparkles" size="sm" />
        <span>Авто</span>
      </button>
      <button 
        class="toolbar-btn" 
        on:click={() => showHelp = !showHelp}
        class:active={showHelp}
        title="Справка по синтаксису"
      >
        <Icon name="help-circle" size="sm" />
        <span>Справка</span>
      </button>
    </div>
    <div class="toolbar-hint">
      {#if errors.length > 0}
        <span class="hint-error">⚠ {errors.length} {errors.length === 1 ? 'ошибка' : 'ошибок'}</span>
      {:else if formula.trim()}
        <span class="hint-valid">✓ Формула валидна</span>
      {:else}
        <span class="hint-info">Ctrl+Space — подсказки</span>
      {/if}
    </div>
  </div>

  <!-- Help Panel -->
  {#if showHelp}
    <div class="help-panel">
      <div class="help-columns">
        <div class="help-col">
          <h4>🔗 Логические</h4>
          <code>AND(условие1, условие2)</code>
          <code>OR(условие1, условие2)</code>
          <code>NOT(условие)</code>
          
          <h4>📝 Строки</h4>
          <code>CONTAINS(поле, "текст")</code>
          <code>STARTS_WITH(поле, "начало")</code>
          <code>ENDS_WITH(поле, "конец")</code>
          
          <h4>🔍 Проверки</h4>
          <code>IS_EMPTY(поле)</code>
          <code>IS_NOT_EMPTY(поле)</code>
        </div>
        <div class="help-col">
          <h4>📅 Даты</h4>
          <code>IS_TODAY(дата)  IS_OVERDUE(дата)</code>
          <code>IS_THIS_WEEK(дата)</code>
          <code>IS_BEFORE(дата1, дата2)</code>
          <code>TODAY()  TOMORROW()  YESTERDAY()</code>
          <code>DATE_ADD(дата, 1, "w")</code>
          
          <h4>📋 Массивы / Теги</h4>
          <code>HAS_ANY_OF(теги, ["a","b"])</code>
          <code>HAS_ALL_OF(теги, ["a","b"])</code>
          
          <h4>⚙ Операторы</h4>
          <code>=  !=  &gt;  &lt;  &gt;=  &lt;=  +  -  *  /</code>
        </div>
      </div>
      <div class="help-examples">
        <strong>Примеры:</strong>
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
      placeholder={'Начните вводить формулу или нажмите Ctrl+Space...\n\nПримеры:\nAND(status = "Active", priority > 5)\nIS_OVERDUE(dueDate)\nCONTAINS(tags, "urgent")'}
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

  /* ── Toolbar ── */
  .editor-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--size-4-2) var(--size-4-3);
    background: var(--background-secondary);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }

  .toolbar-group {
    display: flex;
    gap: var(--size-4-2);
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: var(--size-4-1);
    padding: var(--size-4-2) var(--size-4-3);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
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
    padding: 0 var(--size-4-2);
  }

  .hint-error { color: var(--text-error); font-weight: 600; }
  .hint-valid { color: var(--color-green); font-weight: 500; }
  .hint-info { color: var(--text-faint); }

  /* ── Help panel ── */
  .help-panel {
    padding: var(--size-4-3);
    background: var(--background-secondary);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    max-height: 18rem;
    overflow-y: auto;
  }

  .help-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--size-4-4);
  }

  .help-col h4 {
    margin: var(--size-4-2) 0 var(--size-4-1);
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-normal);
  }

  .help-col h4:first-child { margin-top: 0; }

  .help-col code, .help-examples code {
    display: block;
    padding: 0.125rem var(--size-4-2);
    margin: 0.125rem 0;
    background: var(--code-background);
    border-radius: var(--radius-s);
    font-family: var(--font-monospace);
    font-size: var(--font-ui-smaller);
    color: var(--code-normal);
    line-height: 1.6;
  }

  .help-examples {
    margin-top: var(--size-4-3);
    padding-top: var(--size-4-3);
    border-top: 0.0625rem solid var(--background-modifier-border);
  }

  .help-examples strong {
    display: block;
    font-size: var(--font-ui-small);
    margin-bottom: var(--size-4-1);
    color: var(--text-muted);
  }

  /* ── Editor ── */
  .editor-container {
    position: relative;
    flex: 1;
    min-height: 10rem;
  }

  .formula-textarea {
    width: 100%;
    min-height: 10rem;
    padding: var(--size-4-4);
    border: none;
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-size: var(--font-ui-medium);
    line-height: 1.6;
    resize: vertical;
  }

  .formula-textarea:focus {
    outline: none;
  }

  .formula-textarea.has-error {
    border-left: 0.1875rem solid var(--text-error);
  }

  .formula-textarea.has-valid {
    border-left: 0.1875rem solid var(--color-green);
  }

  .formula-textarea::placeholder {
    color: var(--text-faint);
    opacity: 0.5;
  }

  /* ── Validation Errors ── */
  .validation-errors {
    padding: var(--size-4-3);
    background: var(--background-modifier-error);
    border-top: 0.0625rem solid var(--text-error);
  }

  .error-item {
    display: flex;
    align-items: start;
    gap: var(--size-4-2);
    padding: var(--size-4-2) 0;
    color: var(--text-error);
    font-size: var(--font-ui-small);
  }

  .error-item:not(:last-child) {
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }
</style>
