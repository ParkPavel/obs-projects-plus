<script lang="ts">
  import { app } from '../../../lib/stores/obsidian';
  import { onMount, createEventDispatcher } from 'svelte';
  import { Icon } from "obsidian-svelte";
  import { i18n } from '../../../lib/stores/i18n';
  import { hexToHsv, hsvToHex } from '../../../lib/colors/math';

  const dispatch = createEventDispatcher<{ change: string }>();

  /** Current color value (hex) */
  export let value: string = '#3b82f6';
  /**
   * Optional palette of colors already in use by the surrounding project
   * context (e.g. sibling agenda lists, project highlight rules). Rendered
   * as a swatch row above Favorites so the user can re-use existing
   * colors without retyping. Empty array hides the section.
   */
  export let projectPalette: string[] = [];
  /** Custom label for the project palette section. */
  export let projectPaletteLabel: string = '';

  // Internal HSV state
  let hueValue = 220;
  let saturationValue = 70;
  let valueValue = 95;
  
  // Refs
  let satLightElement: HTMLDivElement;
  let hueSliderElement: HTMLDivElement;
  
  // Drag state
  let isDraggingSatLight = false;
  let isDraggingHue = false;
  
  // Hex input
  let customHexInput = '';
  let hexInputError = false;

  // Deduplicated, normalized project palette — strips empties and
  // collapses case-insensitive duplicates so the section never repeats.
  $: normalizedProjectPalette = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of projectPalette) {
      if (!c) continue;
      const key = c.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(c.trim());
    }
    return out;
  })();
  
  // Favorites - stored in localStorage (shared with DayPopup/RecordItem)
  const FAVORITES_KEY = 'obsidian-projects-calendar-favorites';
  let favorites: Array<{ color: string; name: string }> = [];
  
  onMount(() => {
    parseHex(value);
    loadFavorites();
  });
  
  function loadFavorites() {
    try {
      const appInstance = (window as any).app || $app;
      const stored = appInstance?.loadLocalStorage(FAVORITES_KEY);
      if (stored) {
        favorites = JSON.parse(stored);
      } else {
        favorites = [];
      }
    } catch (e) {
      console.warn('Failed to load color favorites:', e);
      favorites = [];
    }
  }
  
  function saveFavorites() {
    try {
      const appInstance = (window as any).app || $app;
      appInstance?.saveLocalStorage(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {
      console.warn('Failed to save color favorites:', e);
    }
  }
  
  function addToFavorites() {
    const color = currentHex.toLowerCase();
    if (!favorites.find(f => f.color.toLowerCase() === color)) {
      favorites = [...favorites, { color, name: 'Custom' }];
      saveFavorites();
    }
  }
  
  function removeFromFavorites(color: string) {
    favorites = favorites.filter(f => f.color.toLowerCase() !== color.toLowerCase());
    saveFavorites();
  }
  
  let lastExternalValue = value;
  $: if (value !== lastExternalValue) {
    lastExternalValue = value;
    parseHex(value);
  }
  
  // Current hex from HSV
  $: currentHex = hsvToHex(hueValue, saturationValue, valueValue);
  
  function parseHex(hex: string) {
    if (!hex) return;
    const result = hexToHsv(hex);
    if (result) {
      hueValue = result.h;
      saturationValue = result.s;
      valueValue = result.v;
    }
  }
  
  // Apply color immediately
  function applyColor() {
    const hex = hsvToHex(hueValue, saturationValue, valueValue);
    lastExternalValue = hex;
    dispatch('change', hex);
  }
  
  // Select from favorites
  function selectColor(color: string) {
    parseHex(color);
    lastExternalValue = color;
    dispatch('change', color);
  }
  
  // === Saturation/Value picker handlers ===
  function handleSatLightMouseDown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDraggingSatLight = true;
    updateSatLight(e.clientX, e.clientY);
    window.addEventListener('mousemove', handleSatLightMouseMove);
    window.addEventListener('mouseup', handleSatLightMouseUp);
  }
  
  function handleSatLightMouseMove(e: MouseEvent) {
    if (!isDraggingSatLight) return;
    e.preventDefault();
    updateSatLight(e.clientX, e.clientY);
  }
  
  function handleSatLightMouseUp() {
    isDraggingSatLight = false;
    window.removeEventListener('mousemove', handleSatLightMouseMove);
    window.removeEventListener('mouseup', handleSatLightMouseUp);
    applyColor();
  }
  
  function handleSatLightTouchStart(e: TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDraggingSatLight = true;
    const touch = e.touches[0];
    if (touch) {
      updateSatLight(touch.clientX, touch.clientY);
    }
  }
  
  function handleSatLightTouchMove(e: TouchEvent) {
    if (!isDraggingSatLight) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
      updateSatLight(touch.clientX, touch.clientY);
    }
  }
  
  function handleSatLightTouchEnd() {
    isDraggingSatLight = false;
    applyColor();
  }
  
  function updateSatLight(clientX: number, clientY: number) {
    if (!satLightElement) return;
    const rect = satLightElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    saturationValue = Math.round((x / rect.width) * 100);
    valueValue = Math.round(100 - (y / rect.height) * 100);
  }
  
  // === Hue slider handlers ===
  function handleHueMouseDown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDraggingHue = true;
    updateHue(e.clientX);
    window.addEventListener('mousemove', handleHueMouseMove);
    window.addEventListener('mouseup', handleHueMouseUp);
  }
  
  function handleHueMouseMove(e: MouseEvent) {
    if (!isDraggingHue) return;
    e.preventDefault();
    updateHue(e.clientX);
  }
  
  function handleHueMouseUp() {
    isDraggingHue = false;
    window.removeEventListener('mousemove', handleHueMouseMove);
    window.removeEventListener('mouseup', handleHueMouseUp);
    applyColor();
  }
  
  function handleHueTouchStart(e: TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDraggingHue = true;
    const touch = e.touches[0];
    if (touch) {
      updateHue(touch.clientX);
    }
  }
  
  function handleHueTouchMove(e: TouchEvent) {
    if (!isDraggingHue) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
      updateHue(touch.clientX);
    }
  }
  
  function handleHueTouchEnd() {
    isDraggingHue = false;
    applyColor();
  }
  
  function updateHue(clientX: number) {
    if (!hueSliderElement) return;
    const rect = hueSliderElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    hueValue = Math.round((x / rect.width) * 360);
  }
  
  // === Hex input handlers ===
  function applyCustomHex() {
    const clean = customHexInput.trim();
    if (/^#?[0-9A-Fa-f]{3,6}$/.test(clean)) {
      const hex = clean.startsWith('#') ? clean : '#' + clean;
      parseHex(hex);
      hexInputError = false;
      customHexInput = '';
      applyColor();
    } else {
      hexInputError = true;
    }
  }
  
  function handleHexKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyCustomHex();
    }
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="color-picker">
  <!-- Section: HSV Picker -->
  <div class="palette-section">
    <span class="palette-label">{$i18n.t('components.color.pick-color')}</span>
    
    <!-- Saturation/Value picker -->
    <div 
      class="sat-light-picker"
      bind:this={satLightElement}
      style:--hue={hueValue}
      on:mousedown|stopPropagation={handleSatLightMouseDown}
      on:touchstart|stopPropagation|preventDefault={handleSatLightTouchStart}
      on:touchmove|stopPropagation={handleSatLightTouchMove}
      on:touchend|stopPropagation={handleSatLightTouchEnd}
      role="slider"
      aria-label="Saturation and brightness"
      aria-valuenow={saturationValue}
      tabindex="0"
    >
      <div 
        class="sat-light-handle"
        style:left="{saturationValue}%"
        style:top="{100 - valueValue}%"
      ></div>
    </div>
    
    <!-- Hue slider -->
    <div 
      class="hue-slider"
      bind:this={hueSliderElement}
      on:mousedown|stopPropagation={handleHueMouseDown}
      on:touchstart|stopPropagation|preventDefault={handleHueTouchStart}
      on:touchmove|stopPropagation={handleHueTouchMove}
      on:touchend|stopPropagation={handleHueTouchEnd}
      role="slider"
      aria-label="Hue"
      aria-valuenow={hueValue}
      tabindex="0"
    >
      <div 
        class="hue-handle"
        style:left="{(hueValue / 360) * 100}%"
      ></div>
    </div>
    
    <!-- Preview row (matches DayPopup hsl-preview-row) -->
    <div class="preview-row">
      <div class="color-preview" style:background-color={currentHex}></div>
      <div class="hsv-values">
        <span>H: {hueValue}°</span>
        <span>S: {saturationValue}%</span>
        <span>V: {valueValue}%</span>
      </div>
      <button 
        class="action-btn star-btn"
        on:click|stopPropagation={addToFavorites}
        type="button"
        title={$i18n.t('components.color.add-to-favorites')}
      >
        <Icon name="star" size="sm" />
      </button>
      <button 
        class="action-btn apply-btn"
        on:click|stopPropagation={applyColor}
        type="button"
        title={$i18n.t('components.color.apply-color')}
      >
        <Icon name="check" size="sm" />
      </button>
    </div>
  </div>
  
  <!-- Section: Favorites (matches DayPopup palette-grid compact) -->
  {#if normalizedProjectPalette.length > 0}
    <div class="palette-section">
      <div class="section-header">
        <span class="palette-label">{projectPaletteLabel || $i18n.t('components.color.project-palette')}</span>
      </div>
      <div class="favorites-grid">
        {#each normalizedProjectPalette as pc}
          <div class="swatch-container">
            <button
              class="color-swatch"
              class:selected={currentHex.toLowerCase() === pc.toLowerCase()}
              style:--swatch-color={pc}
              on:click|stopPropagation={() => selectColor(pc)}
              type="button"
              title={pc}
            >
              {#if currentHex.toLowerCase() === pc.toLowerCase()}
                <Icon name="check" size="xs" />
              {/if}
            </button>
            <button
              class="remove-btn star-promote-btn"
              on:click|stopPropagation={() => { selectColor(pc); addToFavorites(); }}
              type="button"
              title={$i18n.t('components.color.add-to-favorites')}
              aria-label={$i18n.t('components.color.add-to-favorites')}
            >★</button>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="palette-section">
    <div class="section-header">
      <span class="palette-label">{$i18n.t('components.color.favorites')}</span>
      {#if favorites.length === 0}
        <span class="empty-hint">{$i18n.t('components.color.favorites-empty-hint')}</span>
      {/if}
    </div>
    <div class="favorites-grid">
      {#each favorites as fav}
        <div class="swatch-container">
          <button
            class="color-swatch"
            class:selected={currentHex.toLowerCase() === fav.color.toLowerCase()}
            style:--swatch-color={fav.color}
            on:click|stopPropagation={() => selectColor(fav.color)}
            type="button"
            title={fav.name}
          >
            {#if currentHex.toLowerCase() === fav.color.toLowerCase()}
              <Icon name="check" size="xs" />
            {/if}
          </button>
          <button
            class="remove-btn"
            on:click|stopPropagation={() => removeFromFavorites(fav.color)}
            type="button"
            title={$i18n.t('common.remove')}
          >×</button>
        </div>
      {/each}
    </div>
  </div>
  
  <!-- Section: Hex input (matches DayPopup hex-input-row) -->
  <div class="palette-section">
    <span class="palette-label">{$i18n.t('components.color.hex-code')}</span>
    <div class="hex-row">
      <div class="hex-preview" style:--preview-color={customHexInput || currentHex}></div>
      <input
        type="text"
        class="hex-input"
        class:error={hexInputError}
        placeholder="#RRGGBB"
        bind:value={customHexInput}
        on:keydown={handleHexKeydown}
        on:click|stopPropagation={() => {}}
        maxlength="9"
      />
      <button 
        class="action-btn apply-btn"
        on:click|stopPropagation={applyCustomHex}
        disabled={!customHexInput}
        type="button"
        title={$i18n.t('common.apply')}
      >
        <Icon name="check" size="sm" />
      </button>
    </div>
    {#if hexInputError}
      <span class="hex-error">{$i18n.t('components.color.invalid-format')}</span>
    {/if}
  </div>
</div>

<style>
  /* =====================================================
   * ColorPicker - Unified with DayPopup Structure
   * Hierarchical Design System (Matryoshka)
   * ===================================================== */
  
  .color-picker {
    /* Root variables */
    --cp-base: 1rem;
    --cp-padding: calc(var(--cp-base) * 0.5);
    --cp-gap: calc(var(--cp-base) * 0.625);
    --cp-radius: calc(var(--cp-base) * 0.5);
    --cp-border: 0.0625rem;
    
    /* Element sizes */
    --cp-picker-height: calc(var(--cp-base) * 7);
    --cp-hue-height: calc(var(--cp-base) * 1);
    --cp-handle-size: calc(var(--cp-base) * 0.875);
    --cp-preview-size: calc(var(--cp-base) * 1.75);
    --cp-btn-size: calc(var(--cp-base) * 1.75);
    --cp-swatch-size: calc(var(--cp-base) * 1.5);
    
    display: flex;
    flex-direction: column;
    gap: var(--cp-gap);
    padding: var(--cp-padding);
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    user-select: none;
    overflow: hidden;
  }
  
  /* === Section === */
  .palette-section {
    width: 100%;
    box-sizing: border-box;
    overflow: visible;
  }
  
  .palette-label {
    display: block;
    font-size: calc(var(--cp-base) * 0.6875);
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: calc(var(--cp-base) * 0.5);
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: calc(var(--cp-base) * 0.5);
  }
  
  .section-header .palette-label {
    margin-bottom: 0;
  }
  
  .empty-hint {
    font-size: calc(var(--cp-base) * 0.6875);
    color: var(--text-faint);
  }
  
  /* === Saturation/Value Picker === */
  .sat-light-picker {
    position: relative;
    width: 100%;
    height: var(--cp-picker-height);
    border-radius: var(--cp-radius);
    background-color: hsl(var(--hue), 100%, 50%);
    background-image: 
      linear-gradient(to top, #000, transparent),
      linear-gradient(to right, #fff, transparent);
    cursor: crosshair;
    touch-action: none;
    margin-bottom: var(--cp-gap);
  }
  
  .sat-light-handle {
    position: absolute;
    width: var(--cp-handle-size);
    height: var(--cp-handle-size);
    border: 0.125rem solid white;
    border-radius: 50%;
    box-shadow: 0 0 0 var(--cp-border) rgba(0, 0, 0, 0.3),
                0 0.125rem 0.25rem rgba(0, 0, 0, 0.3);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  
  /* === Hue Slider === */
  .hue-slider {
    position: relative;
    width: 100%;
    height: var(--cp-hue-height);
    border-radius: calc(var(--cp-hue-height) / 2);
    background: linear-gradient(to right,
      hsl(0, 100%, 50%),
      hsl(60, 100%, 50%),
      hsl(120, 100%, 50%),
      hsl(180, 100%, 50%),
      hsl(240, 100%, 50%),
      hsl(300, 100%, 50%),
      hsl(360, 100%, 50%)
    );
    cursor: pointer;
    touch-action: none;
    margin-bottom: var(--cp-gap);
  }
  
  .hue-handle {
    position: absolute;
    top: 50%;
    width: var(--cp-handle-size);
    height: var(--cp-handle-size);
    background: white;
    border: 0.125rem solid rgba(0, 0, 0, 0.2);
    border-radius: 50%;
    box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.2);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  
  /* === Preview Row === */
  .preview-row {
    display: flex;
    align-items: center;
    gap: calc(var(--cp-base) * 0.375);
    width: 100%;
    box-sizing: border-box;
  }
  
  .color-preview {
    width: var(--cp-preview-size);
    height: var(--cp-preview-size);
    min-width: var(--cp-preview-size);
    border-radius: calc(var(--cp-base) * 0.25);
    border: var(--cp-border) solid var(--background-modifier-border);
    flex-shrink: 0;
  }
  
  .hsv-values {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--cp-base) * 0.125) calc(var(--cp-base) * 0.375);
    font-size: calc(var(--cp-base) * 0.625);
    font-family: var(--font-monospace);
    color: var(--text-muted);
  }
  
  /* === Action Buttons === */
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--cp-btn-size);
    height: var(--cp-btn-size);
    min-width: var(--cp-btn-size);
    max-width: var(--cp-btn-size);
    min-height: var(--cp-btn-size);
    max-height: var(--cp-btn-size);
    padding: 0;
    border: none;
    border-radius: calc(var(--cp-base) * 0.25);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
    box-sizing: border-box;
    overflow: hidden;
  }
  
  .star-btn {
    background: var(--background-secondary-alt);
    color: var(--text-muted);
  }
  
  .star-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .apply-btn {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .apply-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  
  .apply-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* === Favorites Grid === */
  .favorites-grid {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--cp-base) * 0.5);
    width: calc(100% + calc(var(--cp-base) * 0.5));
    max-height: calc((var(--cp-swatch-size) + calc(var(--cp-base) * 0.75)) * 3);
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
    padding: calc(var(--cp-base) * 0.5);
    margin: calc(var(--cp-base) * -0.25);
  }
  
  .swatch-container {
    position: relative;
    width: var(--cp-swatch-size);
    height: var(--cp-swatch-size);
    flex-shrink: 0;
  }
  
  .color-swatch {
    width: 100%;
    height: 100%;
    background: var(--swatch-color);
    border: 0.125rem solid transparent;
    border-radius: calc(var(--cp-base) * 0.375);
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    padding: 0;
    box-sizing: border-box;
  }
  
  .color-swatch:hover {
    transform: scale(1.05);
    box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.2);
  }
  
  .color-swatch.selected {
    border-color: var(--text-normal);
    box-shadow: 0 0 0 0.125rem var(--background-primary);
  }
  
  .remove-btn {
    position: absolute;
    top: calc(var(--cp-base) * -0.25);
    right: calc(var(--cp-base) * -0.25);
    width: calc(var(--cp-base) * 0.75);
    height: calc(var(--cp-base) * 0.75);
    background: var(--background-primary);
    border: var(--cp-border) solid var(--background-modifier-border);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(var(--cp-base) * 0.4375);
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 2;
    color: var(--text-muted);
    padding: 0;
  }
  
  .swatch-container:hover .remove-btn {
    opacity: 1;
  }
  
  .remove-btn:hover {
    color: var(--text-error);
    border-color: var(--text-error);
    background: var(--color-red-light, #fee2e2);
  }
  
  /* === Hex Input Row === */
  .hex-row {
    display: flex;
    align-items: center;
    gap: calc(var(--cp-base) * 0.375);
    width: 100%;
    box-sizing: border-box;
  }
  
  .hex-preview {
    width: calc(var(--cp-base) * 1.5);
    height: calc(var(--cp-base) * 1.5);
    min-width: calc(var(--cp-base) * 1.5);
    background: var(--preview-color, var(--text-accent));
    border-radius: calc(var(--cp-base) * 0.25);
    border: var(--cp-border) solid var(--background-modifier-border);
    flex-shrink: 0;
  }
  
  .hex-input {
    flex: 1;
    min-width: 0;
    padding: calc(var(--cp-base) * 0.25) calc(var(--cp-base) * 0.375);
    border: var(--cp-border) solid var(--background-modifier-border);
    border-radius: calc(var(--cp-base) * 0.25);
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-size: calc(var(--cp-base) * 0.75);
    transition: all 0.15s ease;
  }
  
  .hex-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 0.125rem rgba(var(--interactive-accent-rgb), 0.2);
  }
  
  .hex-input.error {
    border-color: var(--text-error);
    animation: shake 0.3s ease;
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-0.25rem); }
    75% { transform: translateX(0.25rem); }
  }
  
  .hex-error {
    display: block;
    font-size: calc(var(--cp-base) * 0.6875);
    color: var(--text-error);
    margin-top: calc(var(--cp-base) * 0.375);
  }
  
  /* === Mobile Touch Targets v5.0.0 === */
  @media (max-width: 48rem), (pointer: coarse) {
    .color-picker {
      --cp-picker-height: calc(var(--cp-base) * 10);
      --cp-hue-height: calc(var(--cp-base) * 1.5);
      --cp-handle-size: calc(var(--cp-base) * 1.5);
      --cp-preview-size: calc(var(--cp-base) * 2.25);
      --cp-btn-size: calc(var(--cp-base) * 2.5);
      --cp-swatch-size: calc(var(--cp-base) * 2);
      
      /* v5.0.0: Ensure proper touch handling */
      touch-action: pan-y;
      overscroll-behavior: contain;
    }
    
    /* v5.0.0: Sliders need precise touch control */
    .sat-light-picker,
    .hue-slider {
      touch-action: none;
      /* Increase touch target slightly */
      min-height: calc(var(--cp-base) * 2);
    }
    
    .hex-input {
      font-size: var(--cp-base);
      padding: calc(var(--cp-base) * 0.5);
    }
    
    .color-swatch:hover {
      transform: none;
    }
    
    .color-swatch:active {
      transform: scale(0.95);
    }
    
    .remove-btn {
      opacity: 1;
      width: calc(var(--cp-base) * 0.625);
      height: calc(var(--cp-base) * 0.625);
      font-size: calc(var(--cp-base) * 0.375);
      top: calc(var(--cp-base) * -0.25);
      right: calc(var(--cp-base) * -0.25);
    }
  }
  
  /* v5.0.0: Landscape optimizations */
  @media (max-height: 500px) and (orientation: landscape) {
    .color-picker {
      /* Reduce heights in landscape to fit content */
      --cp-picker-height: calc(var(--cp-base) * 6);
      --cp-hue-height: calc(var(--cp-base) * 1.25);
      --cp-gap: calc(var(--cp-base) * 0.375);
    }
    
    .palette-section {
      margin-bottom: calc(var(--cp-base) * 0.375);
    }
    
    .favorites-grid {
      max-height: calc((var(--cp-swatch-size) + calc(var(--cp-base) * 0.5)) * 2);
    }
  }
</style>