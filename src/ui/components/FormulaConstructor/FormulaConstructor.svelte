<script lang="ts">
  // FormulaConstructor — unified formula text editor with autocomplete and
  // signature popover. Extracted from FormulaBar.svelte (R5-022) to eliminate
  // four diverging formula-input surfaces across the plugin.
  //
  // Design principles:
  //   • Owns ONLY the textarea + dropdown + signature. Actions (Apply/Cancel),
  //     preview, and field-name input stay in the parent (FormulaBar).
  //   • Uses `document.querySelector` relative to `containerEl` so it works
  //     inside Obsidian popout windows without an explicit activeDocument prop.
  //   • No visual/node mode — FormulaVisualEditor was deleted (R5-022).
  //     Code mode is the only mode. The toggle was removed from FormulaBar too.
  //
  // Usage:
  //   <FormulaConstructor
  //     bind:value={expr}
  //     {fields}
  //     on:change={(e) => expr = e.detail}
  //     on:commit={() => handleApply()}
  //   />

  import { createEventDispatcher, onMount } from "svelte";
  import {
    validateFormulaExpression,
    getFormulaFunctions,
  } from "src/lib/formula";
  import {
    getFormulaMetadata,
    findEnclosingCall,
    type FormulaMetadata,
  } from "src/ui/views/Dashboard/engine/formulaMetadata";
  import { i18n } from "src/lib/stores/i18n";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";

  // ── Snippets catalog (default) ──────────────────────────────
  // Small built-in catalog for empty-state Ctrl+Space discovery. Each surface
  // (FormulaBar / YamlVisualizer / custom) can override via `snippets` prop.
  export type FormulaSnippet = {
    /** Display label in dropdown (e.g. "SUM(field)") */
    label: string;
    /** Text to insert into the textarea (cursor lands at the end) */
    insert: string;
    /** Optional one-line hint shown next to label */
    description?: string;
  };

  const DEFAULT_SNIPPETS: FormulaSnippet[] = [
    { label: "SUM(field)", insert: "SUM(", description: "Сумма значений поля" },
    { label: "AVG(field)", insert: "AVG(", description: "Среднее значение" },
    { label: "COUNT()", insert: "COUNT(", description: "Количество записей" },
    { label: "IF(cond, then, else)", insert: "IF(", description: "Условное выражение" },
    { label: "TODAY()", insert: "TODAY()", description: "Сегодняшняя дата" },
    { label: "CONCAT(a, b)", insert: "CONCAT(", description: "Склейка строк" },
  ];

  // ── Props ───────────────────────────────────────────────────
  export let value: string = "";
  export let fields: string[] = [];
  /** Custom validator; defaults to the canonical formula validator. */
  export let validate: (expr: string, fields: string[]) => string[] =
    (expr, flds) => validateFormulaExpression(expr, flds);
  export let placeholder: string = "";
  export let rows: number = 3;
  export let disabled: boolean = false;
  /**
   * Catalog shown on Ctrl+Space when textarea is empty. Pass `[]` to disable
   * the snippet picker (Ctrl+Space then falls back to "all functions").
   */
  export let snippets: FormulaSnippet[] = DEFAULT_SNIPPETS;

  const dispatch = createEventDispatcher<{
    /** Emitted on every keystroke. `detail` = current expression string. */
    change: string;
    /** Emitted on Ctrl+Enter when the expression is valid. */
    commit: void;
  }>();

  // ── State ───────────────────────────────────────────────────
  let errors: string[] = [];
  let showSuggestions = false;
  let cursorWord = "";
  let cursorPosition = 0;
  let filteredSuggestions: string[] = [];
  let selectedSuggestionIndex = -1;
  let activeSignature: FormulaMetadata | null = null;
  let containerEl: HTMLDivElement;
  let textareaEl: HTMLTextAreaElement;
  let suggestionListEl: HTMLDivElement | null = null;
  /**
   * True when Ctrl+Space forced suggestions open without a cursor word.
   * Auto-resets when the user types (cursorWord appears) or cancels (Esc/insert).
   */
  let forceOpen = false;

  const allFunctions = getFormulaFunctions();

  // Snippets shown when forceOpen and value is empty; otherwise hidden.
  $: snippetsMode = forceOpen && value.trim() === "" && snippets.length > 0;

  // ── Reactive derived ────────────────────────────────────────
  $: errors = value.trim() ? validate(value, fields) : [];

  $: {
    const word = cursorWord.toUpperCase();
    if (word.length > 0) {
      const fnMatches = allFunctions.filter((f) => f.startsWith(word));
      const fieldMatches = fields.filter((f) => f.toUpperCase().startsWith(word));
      filteredSuggestions = [...fnMatches, ...fieldMatches].slice(0, 12);
    } else if (forceOpen && value.trim() !== "") {
      filteredSuggestions = allFunctions.slice(0, 12);
    } else {
      filteredSuggestions = [];
    }
    selectedSuggestionIndex = -1;
  }

  // Signature popover: prefer highlighted suggestion, otherwise enclosing call.
  // Why two sources:
  //   1. Arrow-key navigation over suggestions → show metadata for highlighted item
  //   2. Cursor inside a call (e.g. "SUM(a, |") → show SUM signature even without typing
  $: {
    let meta: FormulaMetadata | undefined;
    if (showSuggestions && selectedSuggestionIndex >= 0) {
      const candidate = filteredSuggestions[selectedSuggestionIndex];
      if (candidate) meta = getFormulaMetadata(candidate);
    }
    if (!meta) {
      const enclosing = findEnclosingCall(value, cursorPosition);
      if (enclosing) meta = getFormulaMetadata(enclosing);
    }
    activeSignature = meta ?? null;
  }

  // ── Event handlers ──────────────────────────────────────────
  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    value = target.value;
    dispatch("change", value);
    updateCursor(target);
  }

  function handleCursorMove(e: Event) {
    updateCursor(e.target as HTMLTextAreaElement);
  }

  function updateCursor(el: HTMLTextAreaElement) {
    const pos = el.selectionStart ?? 0;
    cursorPosition = pos;
    const before = value.substring(0, pos);
    const match = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    cursorWord = match ? match[0] : "";
    // Typing a word past force-open mode returns control to normal cursor-driven flow.
    if (cursorWord.length > 0) forceOpen = false;
    showSuggestions =
      (cursorWord.length > 0 && filteredSuggestions.length > 0) ||
      (forceOpen && (filteredSuggestions.length > 0 || snippetsMode));
  }

  function insertSuggestion(suggestion: string) {
    const textarea = textareaEl;
    if (!textarea) return;

    const pos = textarea.selectionStart ?? 0;
    const before = value.substring(0, pos);
    const after = value.substring(pos);
    const match = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    const replaceFrom = match ? pos - match[0].length : pos;
    // Functions get opening paren appended so cursor lands inside the call.
    const insert = allFunctions.includes(suggestion) ? suggestion + "(" : suggestion;

    value = value.substring(0, replaceFrom) + insert + after;
    dispatch("change", value);
    showSuggestions = false;
    forceOpen = false;
    cursorWord = "";

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = replaceFrom + insert.length;
      textarea.setSelectionRange(newPos, newPos);
      cursorPosition = newPos;
    });
  }

  function insertSnippet(snippet: FormulaSnippet) {
    const textarea = textareaEl;
    if (!textarea) return;

    value = snippet.insert;
    dispatch("change", value);
    showSuggestions = false;
    forceOpen = false;
    cursorWord = "";

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = value.length;
      textarea.setSelectionRange(newPos, newPos);
      cursorPosition = newPos;
    });
  }

  function scrollSuggestionIntoView() {
    requestAnimationFrame(() => {
      // suggestionListEl lives inside FloatingPopup portal (outside containerEl DOM tree).
      const el = suggestionListEl?.querySelector(".ppp-fc-suggestion--selected");
      if (el) el.scrollIntoView({ block: "nearest" });
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    // Ctrl+Space: force-open suggestions even when cursor word is empty.
    // Empty textarea → snippet catalog; otherwise → first 12 functions.
    if (e.ctrlKey && (e.code === "Space" || e.key === " ")) {
      e.preventDefault();
      forceOpen = true;
      showSuggestions = true;
      selectedSuggestionIndex = 0;
      return;
    }

    if (e.key === "Escape") {
      if (showSuggestions) {
        showSuggestions = false;
        forceOpen = false;
        e.stopPropagation();
        return;
      }
    }

    const listLen = snippetsMode ? snippets.length : filteredSuggestions.length;

    if (showSuggestions && listLen > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedSuggestionIndex =
          selectedSuggestionIndex < listLen - 1
            ? selectedSuggestionIndex + 1
            : 0;
        scrollSuggestionIntoView();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedSuggestionIndex =
          selectedSuggestionIndex > 0
            ? selectedSuggestionIndex - 1
            : listLen - 1;
        scrollSuggestionIntoView();
        return;
      }
      if (e.key === "Enter" && !e.ctrlKey && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        if (snippetsMode) {
          insertSnippet(snippets[selectedSuggestionIndex] as FormulaSnippet);
        } else {
          insertSuggestion(filteredSuggestions[selectedSuggestionIndex] as string);
        }
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const idx = selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0;
        if (snippetsMode) {
          insertSnippet(snippets[idx] as FormulaSnippet);
        } else {
          insertSuggestion(filteredSuggestions[idx] as string);
        }
        return;
      }
    }

    if (e.key === "Enter" && e.ctrlKey) {
      if (errors.length === 0 && value.trim()) dispatch("commit");
    }
  }
</script>

<div class="ppp-fc" bind:this={containerEl} on:keydown={handleKeydown}>
  <div class="ppp-fc-editor">
    <textarea
      bind:this={textareaEl}
      class="ppp-fc-textarea"
      class:ppp-fc-textarea--error={errors.length > 0}
      {value}
      {rows}
      {disabled}
      {placeholder}
      on:input={handleInput}
      on:click={handleCursorMove}
      on:keyup={handleCursorMove}
      on:focus={handleCursorMove}
      spellcheck="false"
    ></textarea>

    <!-- Signature popover: appears below textarea, shows function metadata -->
    {#if activeSignature}
      <div class="ppp-fc-signature" role="status" aria-live="polite">
        <code class="ppp-fc-signature-code">{activeSignature.signature}</code>
        <span class="ppp-fc-signature-meta">
          <span>{$i18n.t("views.dashboard.formula.signature-returns")}: <strong>{activeSignature.returnType}</strong></span>
          <span>{activeSignature.category}</span>
        </span>
        <p class="ppp-fc-signature-doc">{activeSignature.doc}</p>
      </div>
    {/if}

    <!-- Suggestion popover via FloatingPopup (canonical popup engine).
         autoFocus=false → textarea retains focus, keystrokes flow into handleKeydown.
         Esc / outside-mousedown в FloatingPopup → on:close → синхронизируется state. -->
    <FloatingPopup
      triggerEl={textareaEl}
      open={showSuggestions && (snippetsMode || filteredSuggestions.length > 0)}
      placement="bottom-start"
      offsetRem={0.25}
      role="listbox"
      autoFocus={false}
      ariaLabel={snippetsMode ? "Formula snippets" : "Formula suggestions"}
      on:close={() => { showSuggestions = false; forceOpen = false; }}
    >
      {#if snippetsMode}
        <div
          class="ppp-fc-suggestions ppp-fc-suggestions--snippets"
          bind:this={suggestionListEl}
        >
          {#each snippets as snippet, i}
            <button
              class="ppp-fc-suggestion ppp-fc-suggestion--snippet"
              class:ppp-fc-suggestion--selected={i === selectedSuggestionIndex}
              role="option"
              aria-selected={i === selectedSuggestionIndex}
              on:click|stopPropagation={() => insertSnippet(snippet)}
            >
              <span class="ppp-fc-snippet-label">{snippet.label}</span>
              {#if snippet.description}
                <span class="ppp-fc-snippet-doc">{snippet.description}</span>
              {/if}
            </button>
          {/each}
        </div>
      {:else}
        <div class="ppp-fc-suggestions" bind:this={suggestionListEl}>
          {#each filteredSuggestions as suggestion, i}
            <button
              class="ppp-fc-suggestion"
              class:ppp-fc-suggestion--fn={allFunctions.includes(suggestion)}
              class:ppp-fc-suggestion--selected={i === selectedSuggestionIndex}
              role="option"
              aria-selected={i === selectedSuggestionIndex}
              on:click|stopPropagation={() => insertSuggestion(suggestion)}
            >
              {suggestion}
            </button>
          {/each}
        </div>
      {/if}
    </FloatingPopup>
  </div>

  <!-- Validation errors -->
  {#if errors.length > 0}
    <div class="ppp-fc-errors" role="alert">
      {#each errors as error}
        <div class="ppp-fc-error">{error}</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .ppp-fc {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .ppp-fc-editor {
    position: relative;
  }

  .ppp-fc-textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-secondary);
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-size: var(--font-ui-small);
    resize: vertical;
    min-height: 4rem;
    box-sizing: border-box;
  }

  .ppp-fc-textarea:focus {
    border-color: var(--interactive-accent);
    outline: none;
  }

  .ppp-fc-textarea--error {
    border-color: var(--text-error);
  }

  .ppp-fc-textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Suggestion list — rendered inside FloatingPopup, so no absolute positioning.
     FloatingPopup owns border, shadow, padding, and viewport-aware placement. */
  .ppp-fc-suggestions {
    display: flex;
    flex-direction: column;
    min-width: 12rem;
    max-height: 12rem;
    overflow-y: auto;
  }

  .ppp-fc-suggestions--snippets {
    min-width: 16rem;
  }

  .ppp-fc-suggestion {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.25rem 0.5rem;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-size: var(--font-ui-small);
  }

  .ppp-fc-suggestion:hover,
  .ppp-fc-suggestion--selected {
    background: var(--background-modifier-hover);
  }

  .ppp-fc-suggestion--fn {
    color: var(--text-accent);
  }

  .ppp-fc-suggestion--snippet {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0.375rem 0.5rem;
  }

  .ppp-fc-snippet-label {
    color: var(--text-accent);
    font-family: var(--font-monospace);
    font-size: var(--font-ui-small);
  }

  .ppp-fc-snippet-doc {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .ppp-fc-signature {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.25rem;
    padding: 0.375rem 0.5rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    font-size: var(--font-ui-smaller);
  }

  .ppp-fc-signature-code {
    font-family: var(--font-monospace);
    font-size: var(--font-ui-small);
    color: var(--text-accent);
  }

  .ppp-fc-signature-meta {
    display: inline-flex;
    gap: 0.75rem;
    color: var(--text-muted);
  }

  .ppp-fc-signature-doc {
    margin: 0;
    color: var(--text-normal);
  }

  .ppp-fc-errors {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .ppp-fc-error {
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
  }
</style>
