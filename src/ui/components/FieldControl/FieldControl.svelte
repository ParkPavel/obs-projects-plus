<script lang="ts">
  import {
    Autocomplete,
    NumberInput,
    Switch,
    Icon,
  } from "obsidian-svelte";
  import DateInput from "../DateInput.svelte";
  import DatetimeInput from "../DatetimeInput.svelte";
  import { ColorPicker } from "src/ui/components/ColorPicker";
  import { ImagePreview } from "src/ui/components/ImagePreview";
  import dayjs from "dayjs";
  import { onDestroy } from 'svelte';

  import { TagList } from "src/ui/components/TagList";
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
  let cachedValue: Optional<Date> = isDate(value) ? value : null;
  export let onChange: (value: Optional<DataValue>) => void;
  export let readonly: boolean = false;
  export let suggestions: string[] = [];
  
  // ========================================
  // TEXT INPUT STATE
  // ========================================
  // textInputActive: true when user is focused on text input
  // textInputBuffer: local buffer to prevent cursor jumping during typing
  // typingTimer: debounce timer for onChange calls
  
  let textInputActive = false;
  let textInputBuffer = '';
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  
  // ========================================
  // REACTIVITY: localDisplayValue
  // ========================================
  // When NOT typing: derive from value prop (reactive)
  // When typing: use textInputBuffer (local state)
  // The template uses: value={textInputActive ? textInputBuffer : localDisplayValue}
  
  $: localDisplayValue = isString(value) ? value : '';
  
  onDestroy(() => {
    if (typingTimer) clearTimeout(typingTimer);
  });

  // Options for autocomplete - merge field options with suggestions
  $: options = (() => {
    // Если есть опции в typeConfig, используем их
    if (field.typeConfig?.options?.length) {
      return field.typeConfig.options.map((option) => ({
        label: option,
        description: "",
        value: option,
      }));
    }
    // Иначе используем динамические подсказки из существующих значений
    if (suggestions.length > 0) {
      return suggestions.map((suggestion) => ({
        label: suggestion,
        description: "📝", // индикатор что это существующее значение
        value: suggestion,
      }));
    }
    return [];
  })();
    
  // Field type detection
  const COLOR_FIELDS = ['color', 'eventcolor', 'tagcolor', 'backgroundcolor'];
  const IMAGE_FIELDS = ['cover', 'banner', 'image', 'thumbnail', 'icon'];
  const TIME_FIELDS = ['time', 'starttime', 'endtime'];
  
  $: isColorField = COLOR_FIELDS.some(cf => field.name.toLowerCase().includes(cf));
  $: isImageField = IMAGE_FIELDS.some(img => field.name.toLowerCase().includes(img));
  $: isTimeField = TIME_FIELDS.some(tf => field.name.toLowerCase().includes(tf));
  
  // ========================================
  // TEXT INPUT HANDLERS (with typing buffer)
  // ========================================
  function onTextFocus() {
    textInputActive = true;
    textInputBuffer = localDisplayValue;
  }
  
  function onTextInput(e: Event) {
    const target = e.target as HTMLInputElement;
    textInputBuffer = target.value;
    
    // Debounce: save after 500ms of no typing
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      onChange(textInputBuffer);
    }, 500);
  }
  
  function onTextBlur() {
    textInputActive = false;
    if (typingTimer) clearTimeout(typingTimer);
    // Save final value on blur
    if (textInputBuffer !== localDisplayValue) {
      onChange(textInputBuffer);
    }
  }
  
  // ========================================
  // COLOR PICKER - v5.1.0 INLINE MODE
  // Палитра встроена в форму, не popup
  // ========================================
  let showColorPicker = false;
  
  function toggleColorPicker() {
    showColorPicker = !showColorPicker;
  }
  
  function handleColorChange(event: CustomEvent<string>) {
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
  function handleTimeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    onChange(target.value);
  }
  
  // ========================================
  // IMAGE REMOVE
  // ========================================
  function handleImageRemove() {
    onChange('');
  }
</script>

<div class="field-control-wrapper">
  {#if field.type === DataFieldType.Boolean}
    <Switch
      checked={isBoolean(value) ? value : false}
      on:check={({ detail }) => onChange(detail)}
    />
    
  {:else if field.repeated && isOptionalList(value)}
    <TagList edit={!readonly} values={value ?? []} {onChange} />
    
  {:else if field.type === DataFieldType.String}
    {#if isColorField}
      <!-- COLOR FIELD v5.1.0: INLINE PICKER -->
      <div class="color-field-container">
        <!-- Color header row -->
        <div class="color-field-row">
          <div 
            class="color-swatch" 
            style:background-color={localDisplayValue || '#888'}
          ></div>
          
          <input
            type="text"
            class="color-hex-input"
            value={textInputActive ? textInputBuffer : localDisplayValue}
            placeholder="#RRGGBB"
            on:focus={onTextFocus}
            on:input={onTextInput}
            on:blur={onTextBlur}
            disabled={readonly}
            spellcheck="false"
          />
          
          <button 
            class="picker-btn"
            class:active={showColorPicker}
            on:click|stopPropagation={toggleColorPicker}
            type="button"
            aria-expanded={showColorPicker}
            aria-label={showColorPicker ? "Свернуть палитру" : "Развернуть палитру"}
          >
            <Icon name={showColorPicker ? "chevron-up" : "palette"} size="sm" />
          </button>
        </div>
        
        <!-- INLINE Color Picker - встроен в форму, не popup -->
        {#if showColorPicker}
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
              value={localDisplayValue || '#3b82f6'}
              on:change={handleColorChange}
            />
          </div>
        {/if}
      </div>
      
    {:else if isImageField}
      <input
        type="text"
        class="field-input"
        value={textInputActive ? textInputBuffer : localDisplayValue}
        placeholder="https://... or [[Image.png]]"
        on:focus={onTextFocus}
        on:input={onTextInput}
        on:blur={onTextBlur}
        disabled={readonly}
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
      <input
        type="time"
        class="field-input time-input"
        value={localDisplayValue}
        on:change={handleTimeChange}
        disabled={readonly}
      />
      
    {:else if options.length > 0}
      <Autocomplete
        value={isString(value) ? value : ""}
        {options}
        on:change={({ detail }) => onChange(detail)}
      />
      
    {:else}
      <input
        type="text"
        class="field-input"
        value={textInputActive ? textInputBuffer : localDisplayValue}
        placeholder={field.name}
        on:focus={onTextFocus}
        on:input={onTextInput}
        on:blur={onTextBlur}
        disabled={readonly}
      />
    {/if}
    
  {:else if field.type === DataFieldType.Number}
    <NumberInput
      value={isNumber(value) ? value : null}
      placeholder="0"
      on:input={({ detail: val }) => onChange(val !== null ? val : undefined)}
    />
    
  {:else if field.type === DataFieldType.Date}
    {#if field.typeConfig?.time}
      <DatetimeInput
        value={isDate(value) ? value : null}
        on:input={({ detail: v }) => (cachedValue = v)}
        on:blur={() => onChange(cachedValue)}
      />
    {:else}
      <DateInput
        value={isDate(value) ? value : null}
        on:change={({ detail: v }) => (cachedValue = v)}
        on:blur={() => {
          if (!cachedValue || !isDate(value)) {
            onChange(cachedValue);
            return;
          }
          const cachedDate = dayjs(cachedValue);
          const newDatetime = dayjs(value)
            .set("year", cachedDate.year())
            .set("month", cachedDate.month())
            .set("date", cachedDate.date());
          onChange(newDatetime.toDate());
        }}
      />
    {/if}
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
    --fc-base: 1rem;                                    /* 16px base */
    
    /* === LEVEL 1: Container metrics === */
    --fc-gap: calc(var(--fc-base) * 0.5);               /* 8px */
    
    /* === LEVEL 2: Row metrics === */
    --fc-row-gap: calc(var(--fc-base) * 0.5);           /* 8px */
    
    /* === LEVEL 3: Element metrics === */
    --fc-element-size: calc(var(--fc-base) * 2.25);     /* 36px */
    --fc-element-radius: calc(var(--fc-base) * 0.375);  /* 6px */
    --fc-input-padding-v: calc(var(--fc-base) * 0.5);   /* 8px */
    --fc-input-padding-h: calc(var(--fc-base) * 0.75);  /* 12px */
    --fc-border-width: 0.0625rem;                       /* 1px */
    --fc-border-width-thick: 0.125rem;                  /* 2px */
    
    /* === Typography === */
    --fc-font-size: calc(var(--fc-base) * 0.875);       /* 14px */
    
    /* === LEVEL 4: Dropdown metrics === */
    --fc-dropdown-radius: calc(var(--fc-base) * 0.75);  /* 12px */
    --fc-dropdown-padding: calc(var(--fc-base) * 0.5);  /* 8px */
    --fc-dropdown-shadow: 0 0.5rem 2rem rgba(0, 0, 0, 0.25);
    
    /* === Component styles === */
    width: 100%;
    position: relative;
  }
  
  /* === LEVEL 3: Generic field input === */
  .field-input {
    width: 100%;
    padding: var(--fc-input-padding-v) var(--fc-input-padding-h);
    font-size: var(--fc-font-size);
    background: var(--background-primary);
    border: var(--fc-border-width) solid var(--background-modifier-border);
    border-radius: var(--fc-element-radius);
    color: var(--text-normal);
  }
  
  .field-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }
  
  .time-input {
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
  .color-hex-input {
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
  
  .color-hex-input:focus {
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
      max-height: 500px;
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
  @media (max-width: 768px), (pointer: coarse) {
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
  @media (orientation: landscape) and (max-height: 500px) {
    .color-picker-inline :global(.color-picker) {
      --cp-picker-height: calc(var(--cp-base, 1rem) * 5);
      --cp-gap: calc(var(--cp-base, 1rem) * 0.375);
    }
  }
  
  /* =====================================================
   * MOBILE: Override root variables for touch targets
   * ===================================================== */
  @media (max-width: 768px), (pointer: coarse) {
    .field-control-wrapper {
      /* Touch-friendly sizes (44px minimum) */
      --fc-element-size: calc(var(--fc-base) * 2.5);      /* 40px */
      --fc-element-radius: calc(var(--fc-base) * 0.5);    /* 8px */
      --fc-input-padding-v: calc(var(--fc-base) * 0.625); /* 10px */
      --fc-input-padding-h: calc(var(--fc-base) * 0.75);  /* 12px */
      --fc-font-size: var(--fc-base);                     /* 16px - prevents zoom */
    }
    
    .field-input {
      padding: calc(var(--fc-base) * 0.75);
    }
  }
</style>