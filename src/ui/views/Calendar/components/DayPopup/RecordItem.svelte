<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy, tick } from "svelte";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { Icon } from "obsidian-svelte";

  export let record: DataRecord;
  export let checkField: string | undefined;
  /** Optional current color */
  export let currentColor: string | undefined = undefined;
  /** Callback when color changes */
  export let onColorChange: ((color: string) => void) | undefined = undefined;

  let optimisticColor: string | null = null;

  const dispatch = createEventDispatcher<{
    openNote: void;
    openInNewWindow: void;
    settings: void;
    delete: void;
    duplicate: void;
    timeChange: string;
    check: boolean;
    colorChange: string;
  }>();

  let showActions = false;
  let showColorPalette = false;
  let customHexInput = '';
  let hexInputError = false;
  let tapTimeout: ReturnType<typeof setTimeout> | null = null;
  let longPressTimeout: ReturnType<typeof setTimeout> | null = null;
  let doubleTapTimeout: ReturnType<typeof setTimeout> | null = null;
  let touchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastTapTime = 0;
  const DOUBLE_TAP_INTERVAL = 300;
  let isLongPress = false;
  // Block synthetic click after touch
  let touchHandled = false;
  let touchHandledTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Cleanup timers on component destroy to prevent memory leaks
  onDestroy(() => {
    if (tapTimeout) {
      clearTimeout(tapTimeout);
      tapTimeout = null;
    }
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      longPressTimeout = null;
    }
    if (touchHandledTimeout) {
      clearTimeout(touchHandledTimeout);
      touchHandledTimeout = null;
    }
    // Cleanup doubleTapTimeout
    if (doubleTapTimeout) {
      clearTimeout(doubleTapTimeout);
      doubleTapTimeout = null;
    }
  });
  
  // HSV color picker state (not HSL - HSV is standard)
  let hueValue = 250; 
  let saturationValue = 70;
  let valueValue = 100;
  let hueSliderElement: HTMLDivElement | null = null;
  let satLightElement: HTMLDivElement | null = null;
  let isDraggingHue = false;
  let isDraggingSatLight = false;
  
  // Favorites storage key
  const FAVORITES_KEY = 'obsidian-projects-calendar-favorites';
  
  // Load favorites from local storage
  let favoriteColors: Array<{ color: string; name: string }> = [];
  
  onMount(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        favoriteColors = JSON.parse(stored);
      } else {
        // Empty by default - user builds their own palette
        favoriteColors = [];
      }
    } catch (e) {
      console.error('Failed to load favorites', e);
      favoriteColors = [];
    }
  });

  function addToFavorites(hex: string) {
    if (!favoriteColors.find(c => c.color === hex)) {
      favoriteColors = [...favoriteColors, { color: hex, name: 'Custom' }];
      saveFavorites();
    }
  }

  function removeFromFavorites(hex: string) {
    favoriteColors = favoriteColors.filter(c => c.color !== hex);
    saveFavorites();
  }

  function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteColors));
  }
  
  // Computed HSV color
  $: hsvColor = hsvToHex(hueValue, saturationValue, valueValue);
  
  // Convert current color to HSV on mount
  $: {
    if (currentColor && showColorPalette) {
      const hsv = hexToHsv(currentColor);
      if (hsv) {
        hueValue = hsv.h;
        saturationValue = hsv.s;
        valueValue = hsv.v;
      }
    }
  }
  
  /**
   * Convert hex color to HSV
   */
  function hexToHsv(hex: string): { h: number; s: number; v: number } | null {
    hex = hex.replace(/^#/, '');
    
    let r: number, g: number, b: number;
    if (hex.length === 3) {
      const c0 = hex.charAt(0);
      const c1 = hex.charAt(1);
      const c2 = hex.charAt(2);
      r = parseInt(c0 + c0, 16);
      g = parseInt(c1 + c1, 16);
      b = parseInt(c2 + c2, 16);
    } else if (hex.length >= 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return null;
    }
    
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let h = 0;
    let s = 0;
    const v = max;
    
    if (delta !== 0) {
      s = delta / max;
      
      if (max === r) {
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
      } else if (max === g) {
        h = ((b - r) / delta + 2) / 6;
      } else {
        h = ((r - g) / delta + 4) / 6;
      }
    }
    
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      v: Math.round(v * 100)
    };
  }
  
  /**
   * Convert HSV to hex
   */
  function hsvToHex(h: number, s: number, v: number): string {
    s /= 100;
    v /= 100;
    
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    
    let r = 0, g = 0, b = 0;
    
    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }
    
    const toHex = (val: number) => {
      const hex = Math.round((val + m) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  
  /**
   * Handle hue slider interaction
   */
  function handleHueMouseDown(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingHue = true;
    updateHueFromEvent(event);
    window.addEventListener('mousemove', handleHueMouseMove);
    window.addEventListener('mouseup', handleHueMouseUp);
  }
  
  function handleHueMouseMove(event: MouseEvent) {
    if (isDraggingHue) {
      updateHueFromEvent(event);
    }
  }
  
  function handleHueMouseUp() {
    isDraggingHue = false;
    window.removeEventListener('mousemove', handleHueMouseMove);
    window.removeEventListener('mouseup', handleHueMouseUp);
  }
  
  function updateHueFromEvent(event: MouseEvent) {
    if (!hueSliderElement) return;
    const rect = hueSliderElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    hueValue = Math.round((x / rect.width) * 360);
  }
  
  /**
   * Handle hue slider touch
   */
  function handleHueTouchStart(event: TouchEvent) {
    isDraggingHue = true;
    updateHueFromTouch(event);
  }
  
  function handleHueTouchMove(event: TouchEvent) {
    if (isDraggingHue) {
      event.preventDefault();
      updateHueFromTouch(event);
    }
  }
  
  function handleHueTouchEnd() {
    isDraggingHue = false;
  }
  
  function updateHueFromTouch(event: TouchEvent) {
    if (!hueSliderElement || !event.touches[0]) return;
    const rect = hueSliderElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.touches[0].clientX - rect.left, rect.width));
    hueValue = Math.round((x / rect.width) * 360);
  }
  
  /**
   * Handle saturation/lightness picker interaction
   */
  function handleSatLightMouseDown(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingSatLight = true;
    updateSatLightFromEvent(event);
    window.addEventListener('mousemove', handleSatLightMouseMove);
    window.addEventListener('mouseup', handleSatLightMouseUp);
  }
  
  function handleSatLightMouseMove(event: MouseEvent) {
    if (isDraggingSatLight) {
      updateSatLightFromEvent(event);
    }
  }
  
  function handleSatLightMouseUp() {
    isDraggingSatLight = false;
    window.removeEventListener('mousemove', handleSatLightMouseMove);
    window.removeEventListener('mouseup', handleSatLightMouseUp);
  }
  
  function updateSatLightFromEvent(event: MouseEvent) {
    if (!satLightElement) return;
    const rect = satLightElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
    saturationValue = Math.round((x / rect.width) * 100);
    valueValue = Math.round(100 - (y / rect.height) * 100);
  }
  
  /**
   * Handle saturation/lightness touch
   */
  function handleSatLightTouchStart(event: TouchEvent) {
    isDraggingSatLight = true;
    updateSatLightFromTouch(event);
  }
  
  function handleSatLightTouchMove(event: TouchEvent) {
    if (isDraggingSatLight) {
      event.preventDefault();
      updateSatLightFromTouch(event);
    }
  }
  
  function handleSatLightTouchEnd() {
    isDraggingSatLight = false;
  }
  
  function updateSatLightFromTouch(event: TouchEvent) {
    if (!satLightElement || !event.touches[0]) return;
    const rect = satLightElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.touches[0].clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(event.touches[0].clientY - rect.top, rect.height));
    saturationValue = Math.round((x / rect.width) * 100);
    valueValue = Math.round(100 - (y / rect.height) * 100);
  }
  
  /**
   * Apply the current HSV color
   */
  function applyHslColor() {
    const hexColor = hsvToHex(hueValue, saturationValue, valueValue);
    handleColorSelect(hexColor);
  }

  $: recordName = record.id.split('/').pop()?.replace('.md', '') || 'Untitled';
  $: isChecked = checkField ? !!record.values[checkField] : false;
  $: displayColor = optimisticColor || currentColor || 'var(--text-accent)';
  
  // Reset optimistic color when prop changes (from external update)
  $: if (currentColor) {
    if (optimisticColor === currentColor) {
       optimisticColor = null; 
    }
  }

  /**
   * v4.0.0: Corrected interaction model
   * 
   * ПРАВИЛЬНАЯ ЛОГИКА:
   * - Single tap/click → показать Actions menu (настройки записи)
   * - Ctrl+Click (desktop) → открыть заметку в новой вкладке
   * - Double tap (mobile) → открыть заметку в новой вкладке
   * - Long press (mobile) → расширенное контекстное меню
   * 
   * ВАЖНО: Tap должен показывать настройки, НЕ открывать заметку!
   */
  
  // Double tap detection - variables declared at top of script
  // lastTapTime and DOUBLE_TAP_INTERVAL are local to handleTouchEnd
  
  function handleClick(event: MouseEvent) {
    // CRITICAL FIX v4.0.1: Check target FIRST, before any event manipulation
    // This prevents opening notes when clicking inside color palette
    const target = event.target as HTMLElement;
    
    // IGNORE clicks inside color-palette and its children
    // Check for data attribute first (most reliable)
    if (target && (
      target.closest('[data-color-palette]') ||
      target.closest('.color-palette') || 
      target.closest('.record-actions') ||
      target.closest('.action-button') ||
      target.closest('.check-button') ||
      target.closest('.color-swatch') ||
      target.closest('.remove-favorite') ||
      target.closest('.hsl-apply-button') ||
      target.closest('.hex-apply-button') ||
      target.closest('.hex-input') ||
      target.closest('.sat-light-picker') ||
      target.closest('.hue-slider') ||
      target.closest('.palette-section') ||
      target.closest('.palette-grid') ||
      target.closest('.swatch-container')
    )) {
      // Don't prevent default or stop propagation - let children handle it
      return;
    }
    
    // Only now do we take control of the event
    event.preventDefault();
    event.stopPropagation();
    
    // Block synthetic click after touch
    if (touchHandled) {
      touchHandled = false;
      return;
    }
    
    // Ctrl+Click → open in new tab (desktop)
    if (event.ctrlKey || event.metaKey) {
      dispatch('openInNewWindow');
      return;
    }
    
    // Normal click → toggle actions menu (show settings)
    showActions = !showActions;
    if (!showActions) {
      showColorPalette = false;
    }
  }
  
  /**
   * Touch start - begin long press detection
   */
  function handleTouchStart(event: TouchEvent) {
    isLongPress = false;
    
    longPressTimeout = setTimeout(() => {
      isLongPress = true;
      // Long press → show actions menu + haptic feedback
      showActions = true;
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 400);
  }
  
  /**
   * Touch end - detect single tap vs double tap
   * 
   * - Single tap → toggle actions menu (settings)
   * - Double tap → open note in new tab
   */
  function handleTouchEnd(event: TouchEvent) {
    // Clear debounce timer
    if (touchDebounceTimeout) {
      clearTimeout(touchDebounceTimeout);
    }
    
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      longPressTimeout = null;
    }
    
    // CRITICAL v4.0.1: Ignore touches inside color-palette or record-actions
    // Extended list of selectors to match handleClick
    const target = event.target as HTMLElement;
    if (target && (
      target.closest('[data-color-palette]') ||
      target.closest('.color-palette') || 
      target.closest('.record-actions') ||
      target.closest('.action-button') ||
      target.closest('.check-button') ||
      target.closest('.color-swatch') ||
      target.closest('.remove-favorite') ||
      target.closest('.hsl-apply-button') ||
      target.closest('.hex-apply-button') ||
      target.closest('.hex-input') ||
      target.closest('.sat-light-picker') ||
      target.closest('.hue-slider') ||
      target.closest('.palette-section') ||
      target.closest('.palette-grid') ||
      target.closest('.swatch-container')
    )) {
      return; // Don't trigger record open - these have their own handlers
    }
    
    // Debounce: если уже в процессе обработки, игнорируем
    if (touchHandled) {
      return;
    }
    
    // Block synthetic click
    touchHandled = true;
    if (touchHandledTimeout) clearTimeout(touchHandledTimeout);
    touchHandledTimeout = setTimeout(() => {
      touchHandled = false;
    }, 400);
    
    // If long press already fired, don't process tap
    if (isLongPress) {
      isLongPress = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    const now = Date.now();
    
    // Double tap detection
    if (now - lastTapTime < DOUBLE_TAP_INTERVAL) {
      // Double tap → open note in new tab
      lastTapTime = 0;
      if (doubleTapTimeout) {
        clearTimeout(doubleTapTimeout);
        doubleTapTimeout = null;
      }
      dispatch('openInNewWindow');
    } else {
      // Potential single tap - wait for possible second tap
      lastTapTime = now;
      
      doubleTapTimeout = setTimeout(() => {
        if (lastTapTime === now) {
          // No second tap - execute single tap action
          // Single tap → toggle actions menu (NOT open note)
          showActions = !showActions;
          if (!showActions) {
            showColorPalette = false;
          }
        }
      }, DOUBLE_TAP_INTERVAL);
    }
  }
  
  /**
   * Touch move - cancel long press if finger moves
   */
  function handleTouchMove() {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      longPressTimeout = null;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      // Enter/Space → toggle actions menu
      showActions = !showActions;
      if (!showActions) {
        showColorPalette = false;
      }
    }
  }

  function toggleActions() {
    showActions = !showActions;
    if (!showActions) {
      showColorPalette = false;
    }
  }

  function handleCheck() {
    dispatch('check', !isChecked);
  }
  
  function toggleColorPalette() {
    showColorPalette = !showColorPalette;
    // v5.0.0: When palette opens, scroll the record into view for better UX
    if (showColorPalette) {
      tick().then(() => {
        const palette = document.querySelector('.color-palette[data-color-palette="true"]');
        if (palette) {
          palette.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }
  }
  
  /**
   * v5.0.0: Handle touch events on the palette container to prevent
   * parent DayPopup from capturing swipes and closing
   */
  function handlePaletteTouchStart(e: TouchEvent) {
    // Stop propagation to prevent DayPopup swipe-to-dismiss
    e.stopPropagation();
  }
  
  function handlePaletteTouchMove(e: TouchEvent) {
    // Allow vertical scroll within palette, block horizontal swipes
    const target = e.target as HTMLElement;
    const isSlider = target.closest('.sat-light-picker') || target.closest('.hue-slider');
    
    // For sliders - let them handle their own events
    if (isSlider) {
      e.stopPropagation();
      return;
    }
    
    // For scrollable content - allow vertical scroll, stop horizontal
    e.stopPropagation();
  }
  
  function handlePaletteTouchEnd(e: TouchEvent) {
    e.stopPropagation();
  }
  
  async function handleColorSelect(color: string) {
    // v4.0.1: Force immediate UI update for mobile responsiveness
    optimisticColor = color;
    await tick(); // Force Svelte to update DOM immediately
    
    dispatch('colorChange', color);
    onColorChange?.(color);
    showColorPalette = false;
    customHexInput = '';
    hexInputError = false;
  }
  
  /**
   * Validate and apply custom hex color
   * Supports #RGB, #RRGGBB, #RRGGBBAA formats
   */
  function applyCustomHex() {
    // Clean up input: remove spaces, ensure # prefix
    let hex = customHexInput.trim();
    if (!hex.startsWith('#')) {
      hex = '#' + hex;
    }
    
    // Validate hex format
    const hexRegex = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
    if (hexRegex.test(hex)) {
      // Convert 3-char to 6-char if needed
      if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
      }
      handleColorSelect(hex);
    } else {
      hexInputError = true;
      setTimeout(() => hexInputError = false, 1500);
    }
  }
  
  function handleHexKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyCustomHex();
    }
  }
</script>

<!-- v3.0.2: Enhanced gesture handling -->
<div 
  class="record-item" 
  on:click={handleClick}
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
  on:touchmove={handleTouchMove}
  on:keydown={handleKeydown} 
  role="button" 
  tabindex="0"
>
  <div class="record-main">
    <!-- Color indicator -->
    <div 
      class="color-indicator" 
      style:--indicator-color={displayColor}
      aria-hidden="true"
    ></div>
    
    {#if checkField}
      <button 
        class="check-button" 
        class:checked={isChecked}
        on:click|stopPropagation={handleCheck}
        on:touchend|stopPropagation|preventDefault={handleCheck}
        aria-label={isChecked ? "Uncheck" : "Check"}
      >
        {#if isChecked}
          <Icon name="check" size="sm" />
        {/if}
      </button>
    {/if}
    
    <span class="record-name" class:checked={isChecked}>{recordName}</span>
    
    <button 
      class="actions-toggle" 
      on:click|stopPropagation={toggleActions}
      aria-label="Actions"
    >
      <Icon name="more-horizontal" size="sm" />
    </button>
  </div>

  {#if showActions}
    <div class="record-actions">
      <!-- Color picker button -->
      <button class="action-button color-action" on:click|stopPropagation={toggleColorPalette}>
        <div class="color-preview" style:--preview-color={displayColor}></div>
        <span>{$i18n.t("views.calendar.record.color") ?? "Color"}</span>
        <Icon name={showColorPalette ? "chevron-up" : "chevron-down"} size="sm" />
      </button>
      
      <!-- Color Palette - v5.0.0: Proper touch handling to prevent scroll conflicts -->
      {#if showColorPalette}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div 
          class="color-palette"
          data-color-palette="true"
          role="region"
          aria-label="Color picker palette"
          on:touchstart|stopPropagation={handlePaletteTouchStart}
          on:touchmove|stopPropagation={handlePaletteTouchMove}
          on:touchend|stopPropagation={handlePaletteTouchEnd}
          on:click|stopPropagation={() => {}}
        >
          <!-- Visual HSL Picker -->
          <div class="palette-section">
            <span class="palette-label">{$i18n.t("views.calendar.colors.picker") ?? "Color Picker"}</span>
            
            <!-- Saturation/Lightness picker -->
            <div 
              class="sat-light-picker"
              bind:this={satLightElement}
              style:--hue={hueValue}
              on:mousedown|stopPropagation={handleSatLightMouseDown}
              on:touchstart|stopPropagation|preventDefault={handleSatLightTouchStart}
              on:touchmove|stopPropagation={handleSatLightTouchMove}
              on:touchend|stopPropagation={handleSatLightTouchEnd}
              role="slider"
              aria-label="Saturation and lightness"
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
              aria-valuemin="0"
              aria-valuemax="360"
              aria-valuenow={hueValue}
              tabindex="0"
            >
              <div 
                class="hue-handle"
                style:left="{(hueValue / 360) * 100}%"
              ></div>
            </div>
            
            <!-- Color preview and apply -->
            <div class="hsl-preview-row">
              <div class="hsl-preview" style:--preview-color={hsvColor}></div>
              <div class="hsl-values">
                <span>H: {hueValue}°</span>
                <span>S: {saturationValue}%</span>
                <span>V: {valueValue}%</span>
              </div>
              <button 
                class="hsl-apply-button"
                on:click|stopPropagation={() => addToFavorites(hsvToHex(hueValue, saturationValue, valueValue))}
                on:touchend|stopPropagation|preventDefault={() => addToFavorites(hsvToHex(hueValue, saturationValue, valueValue))}
                aria-label="Save to favorites"
                style="margin-right: var(--ppp-spacing-xs, 0.25rem); background: var(--background-secondary-alt); color: var(--text-muted);"
              >
                <Icon name="star" size="sm" />
              </button>
              <button 
                class="hsl-apply-button"
                on:click|stopPropagation={applyHslColor}
                on:touchend|stopPropagation|preventDefault={applyHslColor}
                aria-label="Apply color"
              >
                <Icon name="check" size="sm" />
              </button>
            </div>
          </div>
          
          <!-- Quick colors (favorites) -->
          <div class="palette-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--ppp-spacing-sm, 0.5rem);">
               <span class="palette-label" style="margin-bottom: 0;">{$i18n.t("views.calendar.colors.quick") ?? "Favorites"}</span>
               {#if favoriteColors.length === 0}
                 <span style="font-size: 0.7em; color: var(--text-muted);">No favorites</span>
               {/if}
            </div>
            <div class="palette-grid compact">
              {#each favoriteColors as { color, name }}
                <div class="swatch-container" style="position: relative;">
                  <button
                    class="color-swatch"
                    class:selected={displayColor === color}
                    style:--swatch-color={color}
                    on:click|stopPropagation={() => handleColorSelect(color)}
                    on:touchend|stopPropagation|preventDefault={() => handleColorSelect(color)}
                    title={name}
                    aria-label="Select {name}"
                  >
                    {#if displayColor === color}
                      <Icon name="check" size="xs" />
                    {/if}
                  </button>
                  <button
                    class="remove-favorite"
                    on:click|stopPropagation={() => removeFromFavorites(color)}
                    on:touchend|stopPropagation|preventDefault={() => removeFromFavorites(color)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          </div>
          
          <!-- Custom hex input -->
          <div class="palette-section">
            <span class="palette-label">{$i18n.t("views.calendar.colors.hex") ?? "Hex Code"}</span>
            <div class="hex-input-row">
              <div class="hex-preview" style:--preview-color={customHexInput || displayColor}></div>
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
                class="hex-apply-button"
                on:click|stopPropagation={applyCustomHex}
                on:touchend|stopPropagation|preventDefault={applyCustomHex}
                disabled={!customHexInput}
                aria-label="Apply color"
              >
                <Icon name="check" size="sm" />
              </button>
            </div>
            {#if hexInputError}
              <span class="hex-error">{$i18n.t("views.calendar.colors.invalid") ?? "Invalid hex"}</span>
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- Open note button - primary action -->
      <button 
        class="action-button primary" 
        on:click|stopPropagation={() => dispatch('openNote')}
        on:touchend|stopPropagation|preventDefault={() => dispatch('openNote')}
      >
        <Icon name="file-text" size="sm" />
        <span>{$i18n.t("views.calendar.record.open") ?? "Open note"}</span>
      </button>
      
      <!-- Open in new tab -->
      <button 
        class="action-button" 
        on:click|stopPropagation={() => dispatch('openInNewWindow')}
        on:touchend|stopPropagation|preventDefault={() => dispatch('openInNewWindow')}
      >
        <Icon name="external-link" size="sm" />
        <span>{$i18n.t("views.calendar.record.open-new-tab") ?? "Open in new tab"}</span>
      </button>
      
      <button 
        class="action-button" 
        on:click|stopPropagation={() => dispatch('settings')}
        on:touchend|stopPropagation|preventDefault={() => dispatch('settings')}
      >
        <Icon name="settings" size="sm" />
        <span>{$i18n.t("views.calendar.record.settings")}</span>
      </button>
      
      <button 
        class="action-button" 
        on:click|stopPropagation={() => dispatch('duplicate')}
        on:touchend|stopPropagation|preventDefault={() => dispatch('duplicate')}
      >
        <Icon name="copy" size="sm" />
        <span>{$i18n.t("views.calendar.record.duplicate")}</span>
      </button>
      
      <button 
        class="action-button danger" 
        on:click|stopPropagation={() => dispatch('delete')}
        on:touchend|stopPropagation|preventDefault={() => dispatch('delete')}
      >
        <Icon name="trash-2" size="sm" />
        <span>{$i18n.t("views.calendar.record.delete")}</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .record-item {
    background: var(--background-secondary);
    border-radius: 0.625rem;
    padding: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .record-item:active {
    background: var(--background-modifier-hover);
    transform: scale(0.98);
  }

  .record-main {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }
  
  /* Color indicator on left edge */
  .color-indicator {
    width: 0.25rem;
    height: 1.5rem;
    background: var(--indicator-color, var(--text-accent));
    border-radius: 0.125rem;
    flex-shrink: 0;
  }

  .check-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.375rem;
    height: 1.375rem;
    min-width: 2.75rem;
    min-height: 2.75rem;
    border: 2px solid var(--background-modifier-border);
    border-radius: 0.375rem;
    background: transparent;
    color: var(--text-on-accent);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .check-button.checked {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
  }

  .record-name {
    flex: 1;
    font-size: 0.9375rem;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .record-name.checked {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .actions-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    min-width: 2.75rem;
    min-height: 2.75rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .actions-toggle:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .record-actions {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--text-normal);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    min-height: 2.75rem;
  }

  .action-button:hover {
    background: var(--background-modifier-hover);
  }

  .action-button:active {
    transform: scale(0.98);
  }

  .action-button.danger {
    color: var(--text-error);
  }

  .action-button.danger:hover {
    background: rgba(var(--color-red-rgb), 0.1);
  }
  
  /* Primary action button (Open note) */
  .action-button.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .action-button.primary:hover {
    background: var(--interactive-accent-hover);
  }
  
  /* Color action button */
  .action-button.color-action {
    justify-content: flex-start;
  }
  
  .color-preview {
    width: 1.25rem;
    height: 1.25rem;
    background: var(--preview-color, var(--text-accent));
    border-radius: 0.25rem;
    flex-shrink: 0;
  }
  
  .action-button.color-action span {
    flex: 1;
  }
  
  /* Color Palette - Hierarchical Design System */
  .color-palette {
    /* === Palette root variables === */
    --palette-base: 1rem;
    --palette-padding: calc(var(--palette-base) * 0.75);
    --palette-radius: calc(var(--palette-base) * 0.5);
    --palette-gap: calc(var(--palette-base) * 0.75);
    --palette-border: 0.0625rem;
    
    background: var(--background-primary);
    border-radius: var(--palette-radius);
    padding: var(--palette-padding);
    margin-bottom: calc(var(--palette-base) * 0.5);
    border: var(--palette-border) solid var(--background-modifier-border);
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }
  
  .palette-section {
    margin-bottom: var(--palette-gap);
    width: 100%;
    box-sizing: border-box;
    max-height: none;
    overflow: visible;
  }
  
  .palette-section:last-child {
    margin-bottom: 0;
  }
  
  .palette-label {
    display: block;
    font-size: calc(var(--palette-base) * 0.6875);
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: calc(var(--palette-base) * 0.5);
  }
  
  /* HSV Color Picker - Saturation/Value area */
  .sat-light-picker {
    --hue: 250;
    position: relative;
    width: 100%;
    height: calc(var(--palette-base) * 8);
    border-radius: var(--palette-radius);
    background-color: hsl(var(--hue), 100%, 50%);
    background-image: 
      linear-gradient(to top, #000, transparent),
      linear-gradient(to right, #fff, transparent);
    cursor: crosshair;
    touch-action: none;
    margin-bottom: var(--palette-gap);
  }
  
  .sat-light-handle {
    position: absolute;
    width: var(--palette-base);
    height: var(--palette-base);
    border: 0.125rem solid white;
    border-radius: 50%;
    box-shadow: 0 0 0 0.0625rem rgba(0, 0, 0, 0.3), 
                0 0.125rem 0.25rem rgba(0, 0, 0, 0.3);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  
  /* Hue slider */
  .hue-slider {
    position: relative;
    width: 100%;
    height: calc(var(--palette-base) * 1.25);
    border-radius: calc(var(--palette-base) * 0.625);
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
    margin-bottom: var(--palette-gap);
  }
  
  .hue-handle {
    position: absolute;
    top: 50%;
    width: var(--palette-base);
    height: var(--palette-base);
    background: white;
    border: 0.125rem solid rgba(0, 0, 0, 0.2);
    border-radius: 50%;
    box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.2);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  
  /* HSL preview row */
  .hsl-preview-row {
    display: flex;
    align-items: center;
    gap: calc(var(--palette-base) * 0.5);
    width: 100%;
    box-sizing: border-box;
  }
  
  .hsl-preview {
    width: calc(var(--palette-base) * 2);
    height: calc(var(--palette-base) * 2);
    min-width: calc(var(--palette-base) * 2);
    background: var(--preview-color);
    border-radius: calc(var(--palette-base) * 0.375);
    border: var(--palette-border) solid var(--background-modifier-border);
    flex-shrink: 0;
  }
  
  .hsl-values {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--palette-base) * 0.25) calc(var(--palette-base) * 0.5);
    font-size: calc(var(--palette-base) * 0.6875);
    font-family: var(--font-monospace);
    color: var(--text-muted);
  }
  
  .hsl-apply-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--palette-base) * 2);
    height: calc(var(--palette-base) * 2);
    min-width: calc(var(--palette-base) * 2);
    max-width: calc(var(--palette-base) * 2);
    min-height: calc(var(--palette-base) * 2);
    max-height: calc(var(--palette-base) * 2);
    padding: 0;
    border: none;
    border-radius: calc(var(--palette-base) * 0.375);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
    box-sizing: border-box;
    overflow: hidden;
  }
  
  .hsl-apply-button:hover {
    filter: brightness(1.1);
  }
  
  .palette-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: calc(var(--palette-base) * 0.5);
    width: 100%;
    box-sizing: border-box;
  }
  
  .palette-grid.compact {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--palette-base) * 0.5);
    width: calc(100% + calc(var(--palette-base) * 0.5));
    max-height: calc((calc(var(--palette-base) * 2) + calc(var(--palette-base) * 0.75)) * 3);
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
    padding: calc(var(--palette-base) * 0.5);
    margin: calc(var(--palette-base) * -0.25);
  }
  
  .swatch-container {
    position: relative;
    width: calc(var(--palette-base) * 1.5);
    height: calc(var(--palette-base) * 1.5);
    flex-shrink: 0;
  }
  
  .color-swatch {
    width: 100%;
    aspect-ratio: 1;
    background: var(--swatch-color);
    border: 0.125rem solid transparent;
    border-radius: var(--palette-radius);
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    min-width: 0;
    max-width: 100%;
  }
  
  .palette-grid.compact .color-swatch {
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
    min-width: 0;
    border-radius: var(--palette-radius);
    padding: 0;
  }
  
  .color-swatch:hover {
    transform: scale(1.1);
    box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.2);
  }
  
  .color-swatch.selected {
    border-color: var(--text-normal);
    box-shadow: 0 0 0 0.125rem var(--background-primary);
  }
  
  /* Hex input row */
  .hex-input-row {
    display: flex;
    align-items: center;
    gap: calc(var(--palette-base) * 0.5);
    width: 100%;
    box-sizing: border-box;
  }
  
  .hex-preview {
    width: calc(var(--palette-base) * 1.75);
    height: calc(var(--palette-base) * 1.75);
    min-width: calc(var(--palette-base) * 1.75);
    background: var(--preview-color, var(--text-accent));
    border-radius: calc(var(--palette-base) * 0.375);
    border: var(--palette-border) solid var(--background-modifier-border);
    flex-shrink: 0;
  }
  
  .hex-input {
    flex: 1;
    min-width: 0;
    padding: calc(var(--palette-base) * 0.375) calc(var(--palette-base) * 0.5);
    border: var(--palette-border) solid var(--background-modifier-border);
    border-radius: calc(var(--palette-base) * 0.375);
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-size: calc(var(--palette-base) * 0.8125);
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
  
  .hex-apply-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--palette-base) * 2);
    height: calc(var(--palette-base) * 2);
    min-width: calc(var(--palette-base) * 2);
    max-width: calc(var(--palette-base) * 2);
    min-height: calc(var(--palette-base) * 2);
    max-height: calc(var(--palette-base) * 2);
    padding: 0;
    border: none;
    border-radius: calc(var(--palette-base) * 0.375);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
    box-sizing: border-box;
    overflow: hidden;
  }
  
  .hex-apply-button:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  
  .hex-apply-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .hex-error {
    display: block;
    font-size: calc(var(--palette-base) * 0.75);
    color: var(--text-error);
    margin-top: calc(var(--palette-base) * 0.375);
  }
  
  .swatch-container:hover .remove-favorite {
    opacity: 1;
  }
  
  .remove-favorite {
    position: absolute;
    top: calc(var(--palette-base) * -0.25);
    right: calc(var(--palette-base) * -0.25);
    width: calc(var(--palette-base) * 0.75);
    height: calc(var(--palette-base) * 0.75);
    background: var(--background-primary);
    border: var(--palette-border) solid var(--background-modifier-border);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(var(--palette-base) * 0.4375);
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 2;
    color: var(--text-muted);
    padding: 0;
  }
  
  .remove-favorite:hover {
    color: var(--text-error);
    border-color: var(--text-error);
    background: var(--color-red-light, #fee2e2);
  }
  
  /* Mobile: palette height limits - v5.0.0 optimized for touch */
  @media (max-width: 768px), (pointer: coarse) {
    .color-palette {
      /* v5.0.0: Remove fixed height limits - let content flow naturally */
      /* Parent .ios-popup-content handles scrolling */
      max-height: none;
      overflow: visible;
      /* CRITICAL: Allow vertical pan but capture horizontal */
      touch-action: pan-y pinch-zoom;
      /* Prevent iOS rubber-banding on this element */
      overscroll-behavior: contain;
    }
    
    .palette-section {
      max-height: none;
      overflow: visible;
      /* Ensure sections don't create nested scroll contexts */
      touch-action: inherit;
    }
    
    /* Sliders need precise touch control */
    .sat-light-picker,
    .hue-slider {
      touch-action: none;
      /* Prevent parent scroll while dragging */
      overscroll-behavior: none;
    }
    
    .remove-favorite {
      opacity: 1;
      width: calc(var(--palette-base) * 0.625) !important;
      height: calc(var(--palette-base) * 0.625) !important;
      min-width: calc(var(--palette-base) * 0.625) !important;
      min-height: calc(var(--palette-base) * 0.625) !important;
      max-width: calc(var(--palette-base) * 0.625) !important;
      max-height: calc(var(--palette-base) * 0.625) !important;
      font-size: calc(var(--palette-base) * 0.375);
      top: calc(var(--palette-base) * -0.1875);
      right: calc(var(--palette-base) * -0.1875);
      box-sizing: border-box;
    }
    
    .hsl-apply-button,
    .hex-apply-button {
      width: calc(var(--palette-base) * 2.5);
      height: calc(var(--palette-base) * 2.5);
      min-width: calc(var(--palette-base) * 2.5);
      max-width: calc(var(--palette-base) * 2.5);
      min-height: calc(var(--palette-base) * 2.5);
      max-height: calc(var(--palette-base) * 2.5);
    }
    
    .swatch-container {
      width: calc(var(--palette-base) * 2);
      height: calc(var(--palette-base) * 2);
    }
  }
</style>