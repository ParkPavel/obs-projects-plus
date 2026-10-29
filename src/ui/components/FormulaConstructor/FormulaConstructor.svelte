<script lang="ts" context="module">
  export type FormulaSnippet = {
    label: string;
    insert: string;
    description?: string;
  };
</script>

<script lang="ts">
  // FormulaConstructor — unified formula text editor with autocomplete and
  // signature popover. Extracted from FormulaBar.svelte (R5-022) to eliminate
  // four diverging formula-input surfaces across the plugin.
  //
  // Design principles:
  //   • Owns ONLY the textarea + dropdown + signature. Actions (Apply/Cancel),
  //     preview, and field-name input stay in the parent (FormulaBar).
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

  import { afterUpdate, createEventDispatcher, onDestroy, tick } from "svelte";
  import { suggestIndexCache, type FormulaSuggestionEntry } from "src/lib/engine/formulaSuggestIndex";
  import { debounceLatest } from "src/lib/engine/debounceLatest";
  import {
    validateExpression,
    getFormulaCatalog,
    type FormulaSemantics,
  } from "src/lib/formula";
  import {
    getFormulaMetadata,
    findEnclosingCall,
    localizedFormulaDoc,
    type FormulaMetadata,
  } from "src/lib/dashboard-engine/formulaMetadata";
  import { i18n } from "src/lib/stores/i18n";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import { isImeKey } from "src/ui/components/fields/draftController";
  import { keepInView } from "src/ui/components/fields/keepInView";
  import { releaseOnOutsideTap } from "src/ui/components/fields/releaseOnOutsideTap";
  import { tokenize, type Token } from "src/lib/helpers/formulaParser";
  import { MAX_FORMULA_INPUT_LENGTH } from "src/lib/formula/limits";

  // ── Snippets catalog (default) ──────────────────────────────
  // Small built-in catalog for empty-state Ctrl+Space discovery. Each surface
  // (FormulaBar / YamlVisualizer / custom) can override via `snippets` prop.
  // i3-final: descriptions in the reader's language (they were Russian for
  // everyone); CONCAT is not a function of the engine, the conditional
  // aggregates are.
  const DEFAULT_SNIPPETS: FormulaSnippet[] = [
    { label: "SUM(@column)", insert: "SUM(@", description: $i18n.t("views.dashboard.formula.snippet-sum") },
    { label: "AVG(@column)", insert: "AVG(@", description: $i18n.t("views.dashboard.formula.snippet-avg") },
    { label: "COUNT()", insert: "COUNT(", description: $i18n.t("views.dashboard.formula.snippet-count") },
    { label: "IF(cond, then, else)", insert: "IF(", description: $i18n.t("views.dashboard.formula.snippet-if") },
    { label: "TODAY()", insert: "TODAY()", description: $i18n.t("views.dashboard.formula.snippet-today") },
    { label: 'SUMIF(@range, ">0", @sum_range)', insert: "SUMIF(@", description: $i18n.t("views.dashboard.formula.snippet-sumif") },
    { label: 'COUNTIF(@range, "done")', insert: "COUNTIF(@", description: $i18n.t("views.dashboard.formula.snippet-countif") },
  ];

  // ── Props ───────────────────────────────────────────────────
  export let value: string = "";
  export let fields: string[] = [];
  /** Custom validator; defaults to the canonical formula validator. */
  export let semantics: FormulaSemantics = "legacy-computed";
  export let ariaLabel: string = "";
  export let validate: ((expr: string, fields: string[]) => string[]) | undefined = undefined;
  export let placeholder: string = "";
  export let rows: number = 3;
  export let disabled: boolean = false;
  /**
   * Opt-in syntax highlighting via an aria-hidden overlay underlay. Off by
   * default so existing surfaces are visually unchanged. Caret + editing stay
   * on the native textarea; the underlay only colorizes tokens.
   */
  export let highlight: boolean = false;
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
    validation: { errors: string[]; pending: boolean; value: string };
  }>();

  // ── State ───────────────────────────────────────────────────
  let errors: string[] = [];
  let showSuggestions = false;
  let cursorWord = "";
  let cursorPosition = 0;
  let filteredSuggestions: FormulaSuggestionEntry[] = [];
  let columnContext = false;
  let selectedSuggestionIndex = -1;
  let activeSignature: FormulaMetadata | null = null;
  let textareaEl: HTMLTextAreaElement;
  let highlightEl: HTMLDivElement | null = null;
  let suggestionListEl: HTMLDivElement | null = null;
  let composing = false;

  /** Help and external tools insert at the native selection, preserving surrounding text. */
  export function insertText(text: string): void {
    if (disabled || composing || !textareaEl) return;
    const start = textareaEl.selectionStart ?? value.length;
    const end = textareaEl.selectionEnd ?? start;
    value = value.slice(0, start) + text + value.slice(end);
    dispatch("change", value);
    void tick().then(() => {
      if (!textareaEl?.isConnected) return;
      textareaEl.focus();
      textareaEl.setSelectionRange(start + text.length, start + text.length);
      updateCursor(textareaEl);
    });
  }

  // ── Syntax highlight (#077) ─────────────────────────────────
  type HighlightSegment = { text: string; cls: string };

  function tokenClass(type: Token["type"]): string {
    switch (type) {
      case "FUNCTION": return "ppp-fc-tok-fn";
      case "FIELD": return "ppp-fc-tok-field";
      case "STRING": return "ppp-fc-tok-string";
      case "NUMBER": return "ppp-fc-tok-number";
      case "BOOLEAN":
      case "NULL": return "ppp-fc-tok-keyword";
      case "OPERATOR":
      case "LPAREN":
      case "RPAREN":
      case "LBRACKET":
      case "RBRACKET":
      case "COMMA": return "ppp-fc-tok-operator";
      default: return "";
    }
  }

  // Split `expr` into colored token segments + uncolored gaps (whitespace,
  // comments). Falls back to a single plain segment if the tokenizer throws.
  function buildHighlightSegments(expr: string, profile: FormulaSemantics): HighlightSegment[] {
    // Keep pasted source intact without building an unbounded token/DOM tree.
    if (expr.length > MAX_FORMULA_INPUT_LENGTH) return [{ text: expr, cls: "" }];
    if (expr === "") return [];
    try {
      const tokens = tokenize(expr, profile === "unified-v1" ? "strict" : "legacy");
      const segments: HighlightSegment[] = [];
      let pos = 0;
      for (const tok of tokens) {
        if (tok.type === "EOF") break;
        if (typeof tok.start !== "number" || typeof tok.end !== "number") {
          return [{ text: expr, cls: "" }];
        }
        if (tok.start > pos) {
          segments.push({ text: expr.slice(pos, tok.start), cls: "" });
        }
        segments.push({ text: expr.slice(tok.start, tok.end), cls: tokenClass(tok.type) });
        pos = tok.end;
      }
      if (pos < expr.length) {
        segments.push({ text: expr.slice(pos), cls: "" });
      }
      return segments;
    } catch {
      return [{ text: expr, cls: "" }];
    }
  }

  $: highlightSegments = highlight ? buildHighlightSegments(value, semantics) : [];

  function syncScroll() {
    if (highlightEl && textareaEl) {
      highlightEl.scrollTop = textareaEl.scrollTop;
      highlightEl.scrollLeft = textareaEl.scrollLeft;
    }
  }
  // i3-final: a value set from outside (a snippet, a parent) moves the
  // textarea's scroll without a scroll event; the layer follows after render.
  afterUpdate(syncScroll);
  /**
   * True when Ctrl+Space forced suggestions open without a cursor word.
   * Auto-resets when the user types (cursorWord appears) or cancels (Esc/insert).
   */
  let forceOpen = false;

  $: allFunctions = getFormulaCatalog(semantics).map(definition => definition.name);
  const reservedFunctions = new Set(getFormulaCatalog("unified-v1").map(definition => definition.name));
  function bareField(name: string): boolean {
    return /^[\p{L}_][\p{L}\p{N}_]*$/u.test(name) && !["TRUE", "FALSE", "NULL"].includes(name.toUpperCase())
      && (semantics === "unified-v1" || !reservedFunctions.has(name.toUpperCase()));
  }
  $: suggestibleFields = semantics === "legacy-filter" ? fields.filter(bareField) : fields;
  const EMPTY_NAMES: readonly string[] = [];
  $: contextFields = columnContext ? semantics === "legacy-filter" ? EMPTY_NAMES
    : fields.filter(name => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(name)) : suggestibleFields;

  // Snippets shown when forceOpen and value is empty; otherwise hidden.
  $: snippetsMode = forceOpen && value.trim() === "" && snippets.length > 0;

  // ── Reactive derived ────────────────────────────────────────
  // B5 — validation parses the whole expression against every field, so it
  // waits for a pause in typing; suggestions answer at once from an index
  // built once per schema (src/lib/engine/formulaSuggestIndex.ts).
  // i2-data (D20): 700 ms, not 150 — «paid +» is a formula being typed, not
  // an error; the message waits until the person stops.
  const validation = debounceLatest((expr: string) => {
    errors = expr.trim() ? (validate ? validate(expr, fields) : validateExpression(expr, fields, semantics)) : [];
    dispatch("validation", { errors, pending: false, value: expr });
  }, 700);
  onDestroy(() => validation.cancel());
  $: {
    void fields;
    void semantics;
    void validate;
    dispatch("validation", { errors: [], pending: true, value });
    validation.call(value);
  }
  /** Answers a commit on the expression as it is now, not as it was 150 ms ago. */
  function validateNow(): void {
    validation.call(value);
    validation.flush();
  }

  /** Buttons and keyboard shortcuts commit the same currently visible native draft. */
  export function commitCurrent(): void {
    if (disabled || composing) return;
    validateNow();
    if (errors.length === 0 && value.trim()) dispatch("commit");
  }

  const suggestCache = suggestIndexCache();
  $: suggestIndex = suggestCache.get(columnContext ? EMPTY_NAMES : allFunctions, contextFields);

  $: {
    const word = cursorWord.toUpperCase();
    if (word.length > 0) {
      filteredSuggestions = suggestIndex.suggestEntries(word, 12);
    } else if (forceOpen && value.trim() !== "") {
      filteredSuggestions = columnContext
        ? contextFields.slice(0, 12).map(label => ({ label, kind: "field" }))
        : allFunctions.slice(0, 12).map(label => ({ label, kind: "function" }));
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
      if (candidate?.kind === "function") meta = getFormulaMetadata(candidate.label, semantics);
    }
    if (!meta) {
      const enclosing = findEnclosingCall(value, cursorPosition, semantics);
      if (enclosing) meta = getFormulaMetadata(enclosing, semantics);
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
    if (composing) return;
    const pos = el.selectionStart ?? 0;
    cursorPosition = pos;
    const before = value.substring(0, pos);
    const match = before.match(/[\p{L}_][\p{L}\p{N}_]*$/u);
    cursorWord = match ? match[0] : "";
    columnContext = before[pos - cursorWord.length - 1] === "@";
    // Typing a word past force-open mode returns control to normal cursor-driven flow.
    if (cursorWord.length > 0) forceOpen = false;
    showSuggestions =
      (cursorWord.length > 0 && filteredSuggestions.length > 0) ||
      (forceOpen && (filteredSuggestions.length > 0 || snippetsMode));
  }

  function insertSuggestion(suggestion: FormulaSuggestionEntry) {
    const textarea = textareaEl;
    if (!textarea) return;

    const pos = textarea.selectionStart ?? 0;
    const before = value.substring(0, pos);
    const after = value.substring(pos);
    const match = before.match(/[\p{L}_][\p{L}\p{N}_]*$/u);
    const replaceFrom = match ? pos - match[0].length : pos;
    // Functions get opening paren appended so cursor lands inside the call.
    const name = suggestion.label;
    const quoted = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
    const insert = suggestion.kind === "function" ? name + "("
      : columnContext || bareField(name) ? name : `PROP("${quoted}")`;

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
    if (composing || isImeKey(e)) return;
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
          insertSuggestion(filteredSuggestions[selectedSuggestionIndex]!);
        }
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const idx = selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0;
        if (snippetsMode) {
          insertSnippet(snippets[idx] as FormulaSnippet);
        } else {
          insertSuggestion(filteredSuggestions[idx]!);
        }
        return;
      }
    }

    if (e.key === "Enter" && e.ctrlKey) {
      commitCurrent();
    }
  }
</script>

<div class="ppp-fc" on:keydown={handleKeydown}>
  <div class="ppp-fc-editor">
    <div class="ppp-fc-input-stack" class:ppp-fc-input-stack--disabled={disabled}>
      {#if highlight}
        <div class="ppp-fc-highlight" bind:this={highlightEl} aria-hidden="true">
          {#each highlightSegments as seg}<span class={seg.cls}>{seg.text}</span>{/each}{#if value.endsWith("\n")}<span>{" "}</span>{/if}
        </div>
      {/if}
      <textarea
        bind:this={textareaEl}
        use:keepInView
        use:releaseOnOutsideTap
        class="ppp-fc-textarea"
        class:ppp-fc-textarea--error={errors.length > 0}
        class:ppp-fc-textarea--highlight={highlight}
        {value}
        {rows}
        {disabled}
        {placeholder}
        aria-label={ariaLabel || $i18n.t("views.dashboard.formula.title")}
        on:input={(e) => { handleInput(e); syncScroll(); }}
        on:click={handleCursorMove}
        on:keyup={handleCursorMove}
        on:focus={handleCursorMove}
        on:scroll={syncScroll}
        on:compositionstart={() => { composing = true; showSuggestions = false; }}
        on:compositionend={(event) => { composing = false; handleCursorMove(event); }}
        spellcheck="false"
      ></textarea>
    </div>

    <!-- Signature popover: appears below textarea, shows function metadata -->
    {#if activeSignature}
      <div class="ppp-fc-signature" role="status" aria-live="polite">
        <code class="ppp-fc-signature-code">{activeSignature.signature}</code>
        <span class="ppp-fc-signature-meta">
          <span>{$i18n.t("views.dashboard.formula.signature-returns")}: <strong>{activeSignature.returnType}</strong></span>
          <span>{$i18n.t(`views.dashboard.formula.help-category.${activeSignature.category}`)}</span>
        </span>
        <p class="ppp-fc-signature-doc">{localizedFormulaDoc(activeSignature.name, activeSignature.doc, (key, options) => $i18n.t(key, options), semantics)}</p>
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
      ariaLabel={snippetsMode
        ? $i18n.t("views.dashboard.formula.snippets-label")
        : $i18n.t("views.dashboard.formula.suggestions-label")}
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
              class:ppp-fc-suggestion--fn={suggestion.kind === "function"}
              class:ppp-fc-suggestion--selected={i === selectedSuggestionIndex}
              role="option"
              aria-selected={i === selectedSuggestionIndex}
              on:click|stopPropagation={() => insertSuggestion(suggestion)}
            >
              {suggestion.label}{suggestion.kind === "function" ? "(" : ""}
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
    /* N31: the visible text is the highlight layer, which inherited Obsidian's
       right-aligned setting control while the transparent textarea stayed at
       the start — the formula read right-aligned, the caret at the left. */
    text-align: start;
  }

  .ppp-fc-editor {
    position: relative;
  }

  .ppp-fc-input-stack {
    position: relative;
  }

  /* Highlight overlay (#077). The underlay paints colored tokens; the
     textarea sits on top with transparent text but a visible caret.
     i3-final: the glyphs drifted off the caret because the two layers had
     different boxes — a 0.0625rem border under a var(--ppp-border-width) one,
     and a textarea scrollbar narrowing the text column the layer kept. Both
     layers now take every box and text metric from this ONE rule, and both
     reserve the same scrollbar gutter, so a line wraps at the same glyph in
     each and the layer is scrolled with the textarea (syncScroll). */
  .ppp-fc-textarea,
  .ppp-fc-highlight {
    margin: 0;
    padding: 0.5rem;
    border: var(--ppp-border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    font-family: var(--font-monospace);
    font-size: var(--font-ui-small);
    font-weight: normal;
    font-style: normal;
    font-variant-ligatures: none;
    line-height: 1.4;
    letter-spacing: normal;
    word-spacing: normal;
    text-indent: 0;
    text-transform: none;
    tab-size: 4;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: break-word;
    scrollbar-gutter: stable;
    box-sizing: border-box;
  }

  .ppp-fc-textarea {
    display: block;
    width: 100%;
    background: var(--background-secondary);
    color: var(--text-normal);
    resize: vertical;
    min-height: 4rem;
    overflow-x: hidden;
    overflow-y: auto;
  }

  /* The shared touch input floor in tokens.css also enlarges textareas.
     Its painted underlay must receive the same size or glyphs leave the caret. */
  @media (pointer: coarse) {
    .ppp-fc-textarea,
    .ppp-fc-highlight {
      font-size: var(--ppp-input-font-size) !important;
    }
  }

  .ppp-fc-highlight {
    position: absolute;
    inset: 0;
    border-color: transparent;
    background: var(--background-secondary);
    overflow: hidden;
    pointer-events: none;
    color: var(--text-normal);
  }

  .ppp-fc-textarea--highlight {
    position: relative;
    background: transparent;
    color: transparent;
    caret-color: var(--text-normal);
  }

  /* On touch and high-contrast surfaces the native textarea paints both text
     and caret. Independent overlay font metrics cannot separate them. */
  @media (pointer: coarse), (forced-colors: active) {
    .ppp-fc-highlight { display: none; }
    .ppp-fc-textarea--highlight {
      color: var(--text-normal);
      background: var(--background-secondary);
    }
  }

  .ppp-fc-input-stack--disabled .ppp-fc-highlight {
    color: var(--text-muted);
  }

  .ppp-fc-highlight :global(.ppp-fc-tok-fn) { color: var(--ppp-fc-token-fn); }
  .ppp-fc-highlight :global(.ppp-fc-tok-field) { color: var(--ppp-fc-token-field); }
  .ppp-fc-highlight :global(.ppp-fc-tok-string) { color: var(--ppp-fc-token-string); }
  .ppp-fc-highlight :global(.ppp-fc-tok-number) { color: var(--ppp-fc-token-number); }
  .ppp-fc-highlight :global(.ppp-fc-tok-operator) { color: var(--ppp-fc-token-operator); }
  .ppp-fc-highlight :global(.ppp-fc-tok-keyword) { color: var(--ppp-fc-token-keyword); }

  .ppp-fc-input-stack--disabled .ppp-fc-highlight :global(span) {
    color: var(--text-muted);
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
    border: var(--ppp-border-width) solid var(--background-modifier-border);
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
