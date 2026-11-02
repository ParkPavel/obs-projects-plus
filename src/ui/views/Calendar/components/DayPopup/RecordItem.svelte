<script lang="ts">
  import { createEventDispatcher, onDestroy, tick } from "svelte";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { Icon } from "obsidian-svelte";
  import { Notice } from "obsidian";
  import { noticeFor } from "src/lib/errors/errorText";
  import { getScrollBehavior } from 'src/lib/helpers/animation';
  import ColorPicker from "src/ui/components/ColorPicker/ColorPicker.svelte";

  export let record: DataRecord;
  export let checkField: string | undefined;
  /** Optional current color */
  export let currentColor: string | undefined = undefined;
  /** Callback when color changes */
  export let onColorChange: ((color: string) => Promise<boolean>) | undefined = undefined;
  let savingColor = false;

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
  let paletteElement: HTMLDivElement | null = null;
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
   * v3.0.1: Track touch position for scroll detection
   */
  let touchStartY = 0;
  let touchMoved = false;
  const SCROLL_THRESHOLD = 10; // px - movement before considered scroll
  
  function handleTouchStart(event: TouchEvent) {
    isLongPress = false;
    touchMoved = false;
    
    // v3.0.1: Store touch start position
    const touch = event.touches[0];
    if (touch) {
      touchStartY = touch.clientY;
    }
    
    longPressTimeout = setTimeout(() => {
      if (!touchMoved) {
        isLongPress = true;
        // Long press → show actions menu + haptic feedback
        showActions = true;
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    }, 400);
  }
  
  /**
   * Touch end - detect single tap vs double tap
   * v3.0.1: Ignore if user was scrolling
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
    
    // v3.0.1: If user was scrolling, don't trigger any action
    if (touchMoved) {
      touchMoved = false;
      return;
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
   * v3.0.1: Track movement distance for scroll detection
   */
  function handleTouchMove(event: TouchEvent) {
    const touch = event.touches[0];
    if (touch) {
      const deltaY = Math.abs(touch.clientY - touchStartY);
      if (deltaY > SCROLL_THRESHOLD) {
        touchMoved = true;
      }
    }
    
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      longPressTimeout = null;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget || savingColor) return;
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
    if (savingColor) return;
    showActions = !showActions;
    if (!showActions) {
      showColorPalette = false;
    }
  }

  function handleCheck() {
    dispatch('check', !isChecked);
  }
  
  function toggleColorPalette() {
    if (savingColor) return;
    showColorPalette = !showColorPalette;
    // v5.0.0: When palette opens, scroll the record into view for better UX
    if (showColorPalette) {
      tick().then(() => {
        if (paletteElement?.isConnected) {
          paletteElement.scrollIntoView?.({ behavior: getScrollBehavior(), block: 'nearest' });
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
    if (savingColor) return false;
    savingColor = true;
    try {
      // The async writer acknowledges persistence. Legacy event consumers get
      // one event only; never invoke both paths for the same selection.
      if (onColorChange) {
        if (!await onColorChange(color)) return false;
      } else dispatch('colorChange', color);
      optimisticColor = color;
      showColorPalette = false;
      return true;
    } catch (error) {
      console.error("[Projects+] popup color write failed", error);
      new Notice(noticeFor("PPP-311"));
      return false;
    } finally { savingColor = false; }
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
      aria-label={$i18n.t("common.actions")}
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
        <div aria-busy={savingColor}
          bind:this={paletteElement}
          class="color-palette"
          data-color-palette="true"
          role="region"
          aria-label={$i18n.t("views.calendar.colors.palette")}
          on:touchstart|stopPropagation={handlePaletteTouchStart}
          on:touchmove|stopPropagation={handlePaletteTouchMove}
          on:touchend|stopPropagation={handlePaletteTouchEnd}
          on:click|stopPropagation={() => {}}
        >
          <ColorPicker value={displayColor} saveColor={handleColorSelect} />
        </div>
      {/if}
      
      <!-- Open note button - primary action -->
      <button 
        class="action-button primary" 
        on:click|stopPropagation={() => dispatch('openNote')}
      >
        <Icon name="file-text" size="sm" />
        <span>{$i18n.t("views.calendar.record.open") ?? "Open note"}</span>
      </button>
      
      <!-- Open in new tab -->
      <button 
        class="action-button" 
        on:click|stopPropagation={() => dispatch('openInNewWindow')}
      >
        <Icon name="external-link" size="sm" />
        <span>{$i18n.t("views.calendar.record.open-new-tab") ?? "Open in new tab"}</span>
      </button>
      
      <button 
        class="action-button" 
        on:click|stopPropagation={() => dispatch('settings')}
      >
        <Icon name="settings" size="sm" />
        <span>{$i18n.t("views.calendar.record.settings")}</span>
      </button>
      
      <button 
        class="action-button" 
        on:click|stopPropagation={() => dispatch('duplicate')}
      >
        <Icon name="copy" size="sm" />
        <span>{$i18n.t("views.calendar.record.duplicate")}</span>
      </button>
      
      <button 
        class="action-button danger" 
        on:click|stopPropagation={() => dispatch('delete')}
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
    transition: background var(--ppp-duration-normal, 0.15s) var(--ppp-ease-out, ease);
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
    width: var(--ppp-border-width-thick, 0.125rem);
    height: 1.5rem;
    background: var(--indicator-color, var(--text-accent));
    border-radius: var(--ppp-radius-sm, 0.125rem);
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
    border: 0.125rem solid var(--background-modifier-border);
    border-radius: var(--ppp-radius-lg, 0.375rem);
    background: transparent;
    color: var(--text-on-accent);
    cursor: pointer;
    transition: background var(--ppp-duration-normal, 0.15s) var(--ppp-ease-out, ease),
                border-color var(--ppp-duration-normal, 0.15s) var(--ppp-ease-out, ease);
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
    border-radius: var(--ppp-radius-lg, 0.375rem) ;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: background var(--ppp-duration-normal, 0.15s) var(--ppp-ease-out, ease),
                color var(--ppp-duration-normal, 0.15s) var(--ppp-ease-out, ease);
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
    border-top: 0.0625rem solid var(--background-modifier-border);
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: none;
    border-radius: var(--ppp-radius-lg, 0.375rem);
    background: transparent;
    color: var(--text-normal);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background var(--ppp-duration-normal, 0.15s) var(--ppp-ease-out, ease);
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
  
  .color-palette {
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    background: var(--background-primary);
    border: var(--ppp-border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    overflow: hidden;
  }
</style>
