<script lang="ts">
  import {
    Switch,
    Icon,
  } from "obsidian-svelte";
  import ComboField from "../fields/ComboField.svelte";
  import NumberField from "../fields/NumberField.svelte";
  import { namesToOptions } from "../fields/comboOptions";
  import { configuredChoiceOptions, choiceValueAllowed } from "src/lib/suggestions/choiceOptions";
  import { vaultPathSource } from "src/lib/suggestions/vaultPaths";
  import { app } from "src/lib/stores/obsidian";
  import DateInput from "../DateInput.svelte";
  import DatetimeInput from "../DatetimeInput.svelte";
  import { ColorPicker } from "src/ui/components/ColorPicker";
  import { ImagePreview } from "src/ui/components/ImagePreview";
  import dayjs from "dayjs";
  import { onDestroy } from 'svelte';

  import { TagList } from "src/ui/components/TagList";
  import { i18n } from "src/lib/stores/i18n";
  import { DEFAULT_COLOR } from "src/lib/stores/palettes";
  import { isColorFieldName, normalizeHexColor } from "src/lib/colors/recordColor";
  import { formatDisplayValue } from "src/lib/helpers/dateDisplay";
  import {
    DataFieldType,
    isBoolean,
    isDate,
    isNumber,
    isOptionalList,
    isString,
    type DataField,
    type DataValue,
    type Optional,
  } from "src/lib/dataframe/dataframe";

  export let field: DataField;
  export let value: Optional<DataValue>;
  // REFACTOR-304: reactive sync — re-derive `cachedValue` whenever the
  // parent updates `value`. The previous `let cachedValue = …` only ran
  // at component construction, so a parent-side change (e.g. record
  // reload, undo, external edit) left `cachedValue` stale and the next
  // `on:blur` would push the obsolete date back through `onChange`.
  let cachedValue: Optional<Date> = isDate(value) ? value : null;
  $: cachedValue = isDate(value) ? value : null;
  export let onChange: (value: Optional<DataValue>) => void;
  export let readonly: boolean = false;
  export let suggestions: string[] = [];

  // ── N1 — a prop change is not user input ────────────────────────────
  // obsidian-svelte's inputs re-dispatch their change event whenever the
  // PARENT hands them a new `value` prop, not only on a real keystroke or
  // click (NumberInput/Switch/Autocomplete all use `$: dispatch(...)`).
  // FieldControl used to forward that dispatch straight to `onChange`, so a
  // stale record pushed back into a peek/modal wrote its own stale values
  // back to disk. Each `commit*` below compares the reported value against
  // what THIS component last passed the control down, and writes only when
  // they differ — true for a keystroke, false for an echo — and returns
  // early when `readonly`, so no branch can write through a control it also
  // has to keep disabled.
  function datesEqual(a: Optional<Date>, b: Optional<Date>): boolean {
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    return Object.is(a, b);
  }

  // NumberField keeps incomplete/IME text private until a valid commit.
  // An explicitly confirmed empty number retains #180a's absent/undefined contract.
  function commitNumber(detail: number | null) {
    if (readonly || (detail !== null && !Number.isFinite(detail))) return;
    const passedDown = isNumber(value) ? value : null;
    if (Object.is(detail, passedDown)) return;
    onChange(detail === null ? undefined : detail);
  }

  function commitBoolean(detail: boolean) {
    if (readonly) return;
    if (Object.is(detail, isBoolean(value) ? value : false)) return;
    onChange(detail);
  }

  function commitSelection(detail: string) {
    if (readonly || !choiceValueAllowed(field, detail)) return;
    if (Object.is(detail, isString(value) ? value : "")) return;
    onChange(detail);
  }

  function commitDate(next: Optional<Date>) {
    if (readonly) return;
    if (datesEqual(next, isDate(value) ? value : null)) return;
    onChange(next);
  }

  // ========================================
  // TEXT INPUT STATE
  // ========================================
  // The draft lives in TextField; this only debounces the live save and
  // remembers what the field held when typing began, so Escape can undo a
  // debounced write as well as the text.
  let entryValue: string | null = null;
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let textScope = JSON.stringify([field.name, field.type]);
  $: syncTextScope(JSON.stringify([field.name, field.type]), readonly);
  function syncTextScope(scope: string, locked: boolean): void {
    if (scope !== textScope || locked) {
      clearTimer();
      entryValue = null;
      showColorPicker = false;
    }
    textScope = scope;
  }

  $: localDisplayValue = isString(value) ? value : '';
  
  onDestroy(() => {
    if (typingTimer) clearTimeout(typingTimer);
  });

  // Options of the suggestion list: the field's own options when it has them,
  // otherwise the values already used in the project.
  $: declaredChoices = configuredChoiceOptions(field);
  $: options = namesToOptions(declaredChoices ?? [
    ...new Set([...(field.typeConfig?.options ?? []), ...suggestions]),
  ]);
  // Suggestions used the commit-only branch before; do not leave an old live
  // timer running when its source arrives, or replace the field to switch it.
  $: if (options.length > 0) clearTimer();
    
  // Field type detection (color heuristic shared via UT2026-C contract)
  const IMAGE_FIELDS = ['cover', 'banner', 'image', 'thumbnail', 'icon'];
  const TIME_FIELDS = ['time', 'starttime', 'endtime'];

  $: isColorField = isColorFieldName(field.name);
  $: isImageField = IMAGE_FIELDS.some(img => field.name.toLowerCase().includes(img));
  $: isTimeField = TIME_FIELDS.some(tf => field.name.toLowerCase().includes(tf));
  $: imagePaths = vaultPathSource(field.type === DataFieldType.String && isImageField && !readonly &&
    typeof $app?.vault?.getAllLoadedFiles === "function" ? $app : undefined);
  $: imageOptions = namesToOptions([...new Set([...suggestions, ...$imagePaths.files
    .filter(file => /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)$/i.test(file.path)).map(file => file.path)])]);
  $: colorOptions = options.filter(option => normalizeHexColor(option.id) !== null);
  $: timeOptions = options.filter(option => !!option.id.trim() && validTime(option.id));
  
  // ========================================
  // TEXT INPUT HANDLERS (with typing buffer)
  // ========================================
  // UT2026-C (#070): hand-typed colors are canonicalized (#RGB / case /
  // whitespace → #rrggbb) so the stored frontmatter matches what readers
  // resolve. Invalid text is stored as-is — the user sees their typo
  // instead of a silently dropped color.
  function commitTextBuffer(raw: string) {
    if (readonly) return;
    onChange(isColorField ? normalizeHexColor(raw) ?? raw : raw);
  }

  function clearTimer(): void {
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = null;
  }

  function onTextInput(e: CustomEvent<string>) {
    if (readonly) return;
    const text = e.detail;
    if (entryValue === null) entryValue = localDisplayValue;
    // Debounce: save after 500ms of no typing
    clearTimer();
    typingTimer = setTimeout(() => {
      typingTimer = null;
      commitTextBuffer(text);
    }, 500);
  }

  function onTextCommit(e: CustomEvent<{ value: string }>) {
    clearTimer();
    entryValue = null;
    // Save final value on Enter / blur (a debounced save may already have it)
    if (e.detail.value !== localDisplayValue) commitTextBuffer(e.detail.value);
  }

  function onTextCancel() {
    clearTimer();
    // Escape restored the text; a debounced write is undone with it.
    if (!readonly && entryValue !== null && entryValue !== localDisplayValue) onChange(entryValue);
    entryValue = null;
  }

  // A time is typed as HH:MM (the native time wheel was one of the "different
  // problem in every window"); an empty field clears the value.
  const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
  function validTime(text: string): boolean {
    return text.trim() === "" || TIME_RE.test(text.trim());
  }
  function normalizeTime(text: string): string {
    const m = TIME_RE.exec(text.trim());
    return m ? `${(m[1] ?? "").padStart(2, "0")}:${m[2] ?? ""}` : "";
  }

  // ========================================
  // COLOR PICKER - v5.1.0 INLINE MODE
  // Палитра встроена в форму, не popup
  // ========================================
  let showColorPicker = false;
  
  function toggleColorPicker() {
    if (readonly) return;
    showColorPicker = !showColorPicker;
  }
  
  function handleColorChange(event: CustomEvent<string>) {
    if (readonly) return;
    const newColor = event.detail;
    // v5.1.1: Just call onChange - localDisplayValue will update via $: reactivity
    onChange(newColor);
  }
  
  // v5.1.0: Handle click on color swatch area to prevent misclicks
  function handleColorAreaClick(e: MouseEvent) {
    // Only handle clicks directly on the area, not children
    if (e.target === e.currentTarget) {
      e.stopPropagation();
    }
  }
  
  // ========================================
  // TIME INPUT
  // ========================================
  function handleTimeCommit(e: CustomEvent<{ value: string }>) {
    if (readonly) return;
    const next = normalizeTime(e.detail.value);
    if (next !== localDisplayValue) onChange(next);
  }

  // ========================================
  // IMAGE REMOVE
  // ========================================
  function handleImageRemove() {
    onChange('');
  }
</script>

<div class="field-control-wrapper">
  {#if field.derived || field.type === DataFieldType.Formula || field.type === DataFieldType.Rollup || field.type === DataFieldType.AutoTime || !!field.typeConfig?.rollup}
    <span class="field-computed-value">{formatDisplayValue(value) || "—"}</span>
  {:else if field.type === DataFieldType.Boolean && !field.repeated}
    <Switch
      checked={isBoolean(value) ? value : false}
      disabled={readonly}
      on:check={({ detail }) => commitBoolean(detail)}
    />
    
  {:else if (field.type === DataFieldType.List || field.repeated) && isOptionalList(value)}
    {#key JSON.stringify([field.name, field.type, readonly, !!field.typeConfig?.time])}
    <TagList
      edit={!readonly}
      values={value ?? []}
      richText={field.typeConfig?.richText ?? false}
      suggestions={options.map((option) => option.label)}
      type={field.type}
      withTime={!!field.typeConfig?.time}
      allowCustom={declaredChoices === null}
      {onChange}
    />
    {/key}

  {:else if field.type === DataFieldType.Select || field.type === DataFieldType.Status}
    {#key JSON.stringify([field.name, field.type, readonly])}
    <ComboField
      value={isString(value) ? value : ""}
      {options}
      allowCustom={declaredChoices === null}
      commitOnDestroy={false}
      allowEmpty allowUnlistedUnchanged
      disabled={readonly}
      ariaLabel={field.name}
      inputClass="field-combo-input"
      on:commit={({ detail }) => commitSelection(detail.value)}
    />
    {/key}
    
  {:else if field.type === DataFieldType.String}
    {#key JSON.stringify([field.name, field.type, readonly])}
    {#if isColorField}
      <!-- COLOR FIELD v5.1.0: INLINE PICKER -->
      <div class="color-field-container">
        <!-- Color header row -->
        <div class="color-field-row">
          <div 
            class="color-swatch" 
            style:background-color={localDisplayValue || '#888'}
          ></div>
          
          <ComboField
            value={localDisplayValue}
            options={colorOptions}
            allowCustom commitOnDestroy={false}
            placeholder="#RRGGBB"
            inputClass="color-hex-input"
            disabled={readonly}
            ariaLabel={field.name}
            on:draftChange={onTextInput}
            on:commit={onTextCommit}
            on:cancel={onTextCancel}
          />
          
          {#if !readonly}
            <button
              class="picker-btn"
              class:active={showColorPicker}
              on:click|stopPropagation={toggleColorPicker}
              type="button"
              aria-expanded={showColorPicker}
              aria-label={showColorPicker ? $i18n.t('components.color.collapse-palette') : $i18n.t('components.color.expand-palette')}
            >
              <Icon name={showColorPicker ? "chevron-up" : "palette"} size="sm" />
            </button>
          {/if}
        </div>

        <!-- INLINE Color Picker - встроен в форму, не popup -->
        {#if showColorPicker && !readonly}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div 
            class="color-picker-inline"
            on:click|stopPropagation={handleColorAreaClick}
            on:touchstart|stopPropagation={() => {}}
            on:touchmove|stopPropagation={() => {}}
            on:touchend|stopPropagation={() => {}}
          >
            <ColorPicker 
              value={localDisplayValue || DEFAULT_COLOR}
              on:change={handleColorChange}
            />
          </div>
        {/if}
      </div>
      
    {:else if isImageField}
      <ComboField
            value={localDisplayValue}
            options={imageOptions}
            allowCustom commitOnDestroy={false}
            placeholder={$i18n.t("components.field-control.image-placeholder")}
            inputClass="field-input"
            disabled={readonly}
            ariaLabel={field.name}
            on:draftChange={onTextInput}
            on:commit={onTextCommit}
            on:cancel={onTextCancel}
          />
      {#if localDisplayValue}
        <ImagePreview 
          src={localDisplayValue}
          removable={!readonly}
          on:remove={handleImageRemove}
          compact={true}
        />
      {/if}
      
    {:else if isTimeField}
      <ComboField
        value={localDisplayValue}
        options={timeOptions}
        allowCustom commitOnDestroy={false}
        placeholder="HH:MM"
        inputClass="field-input time-input"
        disabled={readonly}
        ariaLabel={field.name}
        validate={validTime}
        on:commit={handleTimeCommit}
      />
      
    {:else}
      <!-- One original input through source revisions. Plain text retains its
           live debounce; suggestion-backed text commits on Enter/pick/blur. -->
      <ComboField
        value={isString(value) ? value : ""}
        {options}
        allowCustom
        commitOnDestroy={false}
        disabled={readonly}
        ariaLabel={field.name}
        inputClass="field-input field-combo-input"
        placeholder={field.name}
        on:draftChange={(event) => {
          if (options.length === 0) onTextInput(event);
          else clearTimer();
        }}
        on:commit={onTextCommit}
        on:cancel={onTextCancel}
      />
    {/if}
    {/key}
    
  {:else if field.type === DataFieldType.Number}
    {#key JSON.stringify([field.name, field.type, readonly])}
      <NumberField
        value={isNumber(value) ? value : null}
        placeholder="0"
        ariaLabel={field.name}
        {suggestions}
        allowEmpty
        disabled={readonly}
        on:commit={({ detail }) => commitNumber(detail)}
      />
    {/key}

  {:else if field.type === DataFieldType.Date}
    {#key JSON.stringify([field.name, field.type, readonly, !!field.typeConfig?.time])}
    {#if field.typeConfig?.time}
      <DatetimeInput
        value={isDate(value) ? value : null}
        {suggestions}
        disabled={readonly}
        on:input={({ detail: v }) => (cachedValue = v)}
        on:blur={() => commitDate(cachedValue)}
      />
    {:else}
      <DateInput
        value={isDate(value) ? value : null}
        {suggestions}
        disabled={readonly}
        on:change={({ detail: v }) => (cachedValue = v)}
        on:blur={() => {
          if (!cachedValue || !isDate(value)) {
            commitDate(cachedValue);
            return;
          }
          const cachedDate = dayjs(cachedValue);
          const newDatetime = dayjs(value)
            .set("year", cachedDate.year())
            .set("month", cachedDate.month())
            .set("date", cachedDate.date());
          commitDate(newDatetime.toDate());
        }}
      />
    {/if}
    {/key}
  {/if}
</div>

<style>
  /* =====================================================
   * FieldControl - Hierarchical Design System (Matryoshka)
   * 
   * LEVEL 0: Root variables inherited from parent
   * LEVEL 1: Component wrapper
   * LEVEL 2: Field rows (color-field-row, etc.)
   * LEVEL 3: Interactive elements (inputs, buttons, swatches)
   * LEVEL 4: Dropdown overlays
   * ===================================================== */
  
  .field-control-wrapper {
    /* === LEVEL 0: Root variables === */
    --fc-base: 1rem;                                    /* 16 base */
    
    /* === LEVEL 1: Container metrics === */
    --fc-gap: calc(var(--fc-base) * 0.5);               /* 8 */
    
    /* === LEVEL 2: Row metrics === */
    --fc-row-gap: calc(var(--fc-base) * 0.5);           /* 8 */
    
    /* === LEVEL 3: Element metrics === */
    --fc-element-size: calc(var(--fc-base) * 2.25);     /* 36 */
    --fc-element-radius: calc(var(--fc-base) * 0.375);  /* 6 */
    --fc-input-padding-v: calc(var(--fc-base) * 0.5);   /* 8 */
    --fc-input-padding-h: calc(var(--fc-base) * 0.75);  /* 12 */
    --fc-border-width: 0.0625rem;                       /* 1 */
    --fc-border-width-thick: 0.125rem;                  /* 2 */
    
    /* === Typography === */
    --fc-font-size: calc(var(--fc-base) * 0.875);       /* 14 */
    
    /* === LEVEL 4: Dropdown metrics === */
    --fc-dropdown-radius: calc(var(--fc-base) * 0.75);  /* 12 */
    --fc-dropdown-padding: calc(var(--fc-base) * 0.5);  /* 8 */
    --fc-dropdown-shadow: var(--shadow-l);
    
    /* === Component styles === */
    width: 100%;
    position: relative;
  }
  
  /* === LEVEL 3: Generic field input === */
  .field-control-wrapper :global(.field-input),
  .field-control-wrapper :global(.field-combo-input) {
    width: 100%;
    padding: var(--fc-input-padding-v) var(--fc-input-padding-h);
    font-size: var(--fc-font-size);
    background: var(--background-primary);
    border: var(--fc-border-width) solid var(--background-modifier-border);
    border-radius: var(--fc-element-radius);
    color: var(--text-normal);
  }
  
  .field-control-wrapper :global(.field-input):focus,
  .field-control-wrapper :global(.field-combo-input):focus {
    outline: none;
    border-color: var(--interactive-accent);
  }
  
  .field-control-wrapper :global(.time-input) {
    font-family: var(--font-monospace);
  }
  
  /* === LEVEL 2: Color field row === */
  .color-field-row {
    display: flex;
    align-items: center;
    gap: var(--fc-row-gap);
    width: 100%;
    box-sizing: border-box;
  }
  .color-field-row :global(.ppp-combo) { flex: 1; min-width: 0; }
  
  /* === LEVEL 3: Color swatch === */
  .color-swatch {
    width: var(--fc-element-size);
    height: var(--fc-element-size);
    min-width: var(--fc-element-size);
    border-radius: var(--fc-element-radius);
    border: var(--fc-border-width-thick) solid var(--background-modifier-border);
    flex-shrink: 0;
  }
  
  /* === LEVEL 3: Color hex input === */
  .field-control-wrapper :global(.color-hex-input) {
    flex: 1;
    min-width: 0;
    padding: var(--fc-input-padding-v) var(--fc-input-padding-h);
    font-size: var(--fc-font-size);
    font-family: var(--font-monospace);
    background: var(--background-primary);
    border: var(--fc-border-width) solid var(--background-modifier-border);
    border-radius: var(--fc-element-radius);
    color: var(--text-normal);
  }
  
  .field-control-wrapper :global(.color-hex-input):focus {
    outline: none;
    border-color: var(--interactive-accent);
  }
  
  /* === LEVEL 3: Picker button === */
  .picker-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--fc-element-size);
    height: var(--fc-element-size);
    min-width: var(--fc-element-size);
    padding: 0;
    background: var(--background-secondary);
    border: var(--fc-border-width) solid var(--background-modifier-border);
    border-radius: var(--fc-element-radius);
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
  }
  
  .picker-btn:hover, .picker-btn.active {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  /* === v5.1.0: Color field container for inline layout === */
  .color-field-container {
    display: flex;
    flex-direction: column;
    gap: var(--fc-gap);
    width: 100%;
  }
  
  /* === v5.1.0: INLINE Color Picker - встроен в форму === */
  .color-picker-inline {
    width: 100%;
    background: var(--background-secondary);
    border: var(--fc-border-width) solid var(--background-modifier-border);
    border-radius: var(--fc-element-radius);
    padding: var(--fc-dropdown-padding);
    box-sizing: border-box;
    
    /* Smooth expand animation */
    animation: expandInline 0.2s ease-out;
    
    /* CRITICAL: Prevent scroll conflicts */
    touch-action: pan-y;
    overscroll-behavior: contain;
  }
  
  @keyframes expandInline {
    from { 
      opacity: 0; 
      max-height: 0;
      padding-top: 0;
      padding-bottom: 0;
    }
    to { 
      opacity: 1; 
      max-height: 31.25rem;
    }
  }
  
  /* Ensure ColorPicker fits properly in inline mode */
  .color-picker-inline :global(.color-picker) {
    width: 100%;
    max-width: 100%;
    padding: 0;
    box-sizing: border-box;
    overflow: visible;
    background: transparent;
  }
  
  .color-picker-inline :global(.color-picker > *) {
    max-width: 100%;
    box-sizing: border-box;
  }
  
  /* === Mobile optimizations for inline picker === */
  @media (max-width: 48rem), (pointer: coarse) {
    .color-picker-inline {
      padding: calc(var(--fc-base) * 0.75);
      border-radius: calc(var(--fc-base) * 0.75);
    }
    
    /* Ensure touch targets are large enough */
    .color-picker-inline :global(.color-picker) {
      --cp-picker-height: calc(var(--cp-base, 1rem) * 8);
      --cp-hue-height: calc(var(--cp-base, 1rem) * 1.5);
      --cp-handle-size: calc(var(--cp-base, 1rem) * 1.5);
      --cp-btn-size: calc(var(--cp-base, 1rem) * 2.5);
    }
    
    /* Sliders need precise control */
    .color-picker-inline :global(.sat-light-picker),
    .color-picker-inline :global(.hue-slider) {
      touch-action: none;
    }
  }
  
  /* Landscape mode - reduce picker height */
  @media (orientation: landscape) and (max-height: 31.25rem) {
    .color-picker-inline :global(.color-picker) {
      --cp-picker-height: calc(var(--cp-base, 1rem) * 5);
      --cp-gap: calc(var(--cp-base, 1rem) * 0.375);
    }
  }
  
  /* =====================================================
   * MOBILE: Override root variables for touch targets
   * ===================================================== */
  @media (max-width: 48rem), (pointer: coarse) {
    .field-control-wrapper {
      /* Touch-friendly sizes (44 minimum) */
      --fc-element-size: calc(var(--fc-base) * 2.5);      /* 40 */
      --fc-element-radius: calc(var(--fc-base) * 0.5);    /* 8 */
      --fc-input-padding-v: calc(var(--fc-base) * 0.625); /* 10 */
      --fc-input-padding-h: calc(var(--fc-base) * 0.75);  /* 12 */
      --fc-font-size: var(--fc-base);                     /* 16 - prevents zoom */
    }
    
    .field-control-wrapper :global(.field-input),
    .field-control-wrapper :global(.field-combo-input) {
      padding: calc(var(--fc-base) * 0.75);
    }
  }
</style>
