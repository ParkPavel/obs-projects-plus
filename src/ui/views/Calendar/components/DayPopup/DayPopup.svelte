<script lang="ts">
  /**
   * DayPopup.svelte - v7.0.0 iOS-Style Complete Redesign
   * 
   * Premium iOS-style popup for day events with:
   * - Adaptive layout: Bottom sheet (mobile) / Card (desktop)
   * - Smooth spring animations
   * - Gesture support (swipe to dismiss)
   * - Safe area handling
   * - Perfect touch targets (44px minimum)
   * - Accessibility (ARIA, focus trap)
   */
  import dayjs from "dayjs";
  import { createEventDispatcher, onMount, onDestroy, tick } from "svelte";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import type { ProjectDefinition } from "src/settings/settings";
  import { formatDateForDisplay } from "src/lib/helpers";
  import { i18n } from "src/lib/stores/i18n";
  import RecordItem from "./RecordItem.svelte";
  import { DuplicatePopup } from "../DuplicatePopup";
  import type { ProcessedRecord } from "../../types";

  // ═══════════════════════════════════════════════════════════════
  // PROPS
  // ═══════════════════════════════════════════════════════════════
  
  export let project: ProjectDefinition;
  export let date: dayjs.Dayjs;
  export let records: DataRecord[];
  export let checkField: string | undefined;
  export let visible: boolean = false;
  export let getRecordColor: ((record: DataRecord) => string | null) | undefined = undefined;
  // v4.0.3: eventColorField for direct color reading from record.values
  export let eventColorField: string | undefined = undefined;
  // v8.0.0: processedData for new DuplicatePopup
  export let processedData: import('../../types').ProcessedCalendarData | null = null;
  export let firstDayOfWeek: number = 1;
  // v8.1.0: config for timezone and other calendar config
  export let config: import('../../types').CalendarConfig | undefined = undefined;
  // Note: anchorX and anchorY are preserved for API compatibility but not used in iOS-style popup
  export const anchorX: number | undefined = undefined;
  export const anchorY: number | undefined = undefined;
  
  // ═══════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════
  
  const dispatch = createEventDispatcher<{
    close: void;
    recordClick: DataRecord;
    recordOpenInNewWindow: DataRecord;
    recordSettings: DataRecord;
    recordDelete: DataRecord;
    recordDuplicate: { 
      record: DataRecord; 
      targetDates: dayjs.Dayjs[];
      customTime?: { startTime: dayjs.Dayjs; endTime: dayjs.Dayjs } | null;
    };
    recordTimeChange: { record: DataRecord; newTime: string };
    recordCheck: { record: DataRecord; checked: boolean };
    recordColorChange: { record: DataRecord; color: string };
    createNote: dayjs.Dayjs;
  }>();

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  
  let showDuplicatePopup = false;
  let duplicateRecord: DataRecord | null = null;
  let duplicateProcessedRecord: ProcessedRecord | null = null;
  let popupElement: HTMLDivElement | null = null;
  let contentElement: HTMLDivElement | null = null;
  let portalContainer: HTMLDivElement | null = null;
  
  // Layout mode
  let isMobile = false;
  let isClosing = false;
  
  // Gesture state for swipe-to-dismiss
  let dragStartY = 0;
  let isDragging = false;
  let dragOffset = 0;
  
  // v4.0.3: Get color from record.values (eventColorField) with fallback to getRecordColor
  function getColorForRecord(record: DataRecord): string | null {
    // Priority 1: Direct from record.values using eventColorField
    if (eventColorField && record.values[eventColorField]) {
      const color = record.values[eventColorField];
      if (typeof color === 'string') return color;
    }
    // Priority 2: Check "eventColor" field as fallback
    if (record.values['eventColor']) {
      const color = record.values['eventColor'];
      if (typeof color === 'string') return color;
    }
    // Priority 3: Check "color" field as fallback
    if (record.values['color']) {
      const color = record.values['color'];
      if (typeof color === 'string') return color;
    }
    // Priority 4: Use getRecordColor callback if provided
    return getRecordColor?.(record) ?? null;
  }

  // ═══════════════════════════════════════════════════════════════
  // PORTAL - Mount popup inside workspace-leaf to respect plugin boundaries
  // ═══════════════════════════════════════════════════════════════
  
  function createPortal(node: HTMLElement) {
    // Find the plugin's workspace-leaf container - mount portal INSIDE it
    // This respects Obsidian's sidebar boundaries
    const workspaceLeaf = node.closest('.workspace-leaf-content') as HTMLElement || 
                          node.closest('.workspace-leaf') as HTMLElement;
    
    if (workspaceLeaf) {
      // Create portal container inside workspace-leaf (not body)
      portalContainer = document.createElement('div');
      portalContainer.className = 'obsidian-projects-popup-portal';
      // z-index 100 is enough within workspace-leaf scope
      portalContainer.style.cssText = 'position: absolute; inset: 0; z-index: 100; pointer-events: none; overflow: hidden;';
      
      // Ensure workspace-leaf has relative positioning for absolute child
      const computedStyle = window.getComputedStyle(workspaceLeaf);
      if (computedStyle.position === 'static') {
        workspaceLeaf.style.position = 'relative';
      }
      
      workspaceLeaf.appendChild(portalContainer);
    } else {
      // Fallback to body if no workspace-leaf found
      portalContainer = document.createElement('div');
      portalContainer.className = 'obsidian-projects-popup-portal';
      portalContainer.style.cssText = 'position: fixed; inset: 0; z-index: 100; pointer-events: none;';
      document.body.appendChild(portalContainer);
    }
    
    // Move node to portal
    portalContainer.appendChild(node);
    node.style.pointerEvents = 'auto';
    
    return {
      destroy() {
        // Cleanup
        if (portalContainer && portalContainer.parentNode) {
          portalContainer.parentNode.removeChild(portalContainer);
        }
        portalContainer = null;
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════
  
  $: formattedDate = formatDateForDisplay(date, project) ?? date.format('D MMMM YYYY');
  $: dayOfWeek = date.format('dddd');
  $: isToday = date.isSame(dayjs(), 'day');
  
  // Date badge
  $: dateBadge = isToday 
    ? ($i18n.t('views.calendar.popup.today') ?? 'Сегодня')
    : '';

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE - v5.0.0: Added orientation change handling
  // ═══════════════════════════════════════════════════════════════
  
  function detectLayout() {
    isMobile = window.innerWidth < 768 || window.innerHeight < 600;
  }
  
  // v5.0.0: Handle orientation changes smoothly
  function handleOrientationChange() {
    // Recalculate layout after orientation change completes
    setTimeout(() => {
      detectLayout();
      // Reset drag state to prevent stuck UI
      dragOffset = 0;
      isDragging = false;
      // Force reflow of content
      if (contentElement) {
        contentElement.scrollTop = 0;
      }
    }, 100);
  }
  
  onMount(() => {
    detectLayout();
    window.addEventListener('resize', detectLayout);
    // v5.0.0: Listen for orientation changes on mobile
    window.addEventListener('orientationchange', handleOrientationChange);
    // Fallback for devices that don't fire orientationchange
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    }
  });
  
  onDestroy(() => {
    window.removeEventListener('resize', detectLayout);
    window.removeEventListener('orientationchange', handleOrientationChange);
    if (window.screen?.orientation) {
      window.screen.orientation.removeEventListener('change', handleOrientationChange);
    }
    document.body.style.overflow = '';
    // Cleanup portal if still exists
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
    }
  });
  
  // React to visibility changes
  $: if (visible) {
    openPopup();
  }

  // ═══════════════════════════════════════════════════════════════
  // OPEN / CLOSE LOGIC
  // ═══════════════════════════════════════════════════════════════
  
  async function openPopup() {
    isClosing = false;
    dragOffset = 0;
    
    // Lock body scroll on mobile
    if (isMobile) {
      document.body.style.overflow = 'hidden';
    }
    
    await tick();
    
    // Focus first interactive element
    setTimeout(() => {
      popupElement?.querySelector<HTMLElement>('button, [tabindex="0"]')?.focus();
    }, 300);
  }
  
  function closePopup() {
    if (isClosing) return;
    
    isClosing = true;
    
    // Unlock body scroll
    document.body.style.overflow = '';
    
    setTimeout(() => {
      visible = false;
      isClosing = false;
      dispatch('close');
    }, 200);
  }

  // ═══════════════════════════════════════════════════════════════
  // GESTURE HANDLERS (Swipe to dismiss on mobile)
  // v5.0.0: Improved to not interfere with color palette interactions
  // ═══════════════════════════════════════════════════════════════
  
  function handleTouchStart(e: TouchEvent) {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    if (!touch) return;
    
    // v5.0.0: CRITICAL - Don't initiate drag if touch is inside color palette
    const target = e.target as HTMLElement;
    if (target.closest('[data-color-palette]') || 
        target.closest('.color-palette') ||
        target.closest('.sat-light-picker') ||
        target.closest('.hue-slider')) {
      return; // Let color palette handle its own touches
    }
    
    // Only allow drag from header or when scrolled to top
    const isHeader = target.closest('.ios-popup-header') || target.closest('.ios-popup-drag-indicator');
    const isScrolledToTop = contentElement ? contentElement.scrollTop <= 0 : true;
    
    if (!isHeader && !isScrolledToTop) return;
    
    dragStartY = touch.clientY;
    isDragging = true;
  }
  
  function handleTouchMove(e: TouchEvent) {
    if (!isDragging || !isMobile) return;
    
    // v5.0.0: Double-check we're not in color palette
    const target = e.target as HTMLElement;
    if (target.closest('[data-color-palette]') || target.closest('.color-palette')) {
      isDragging = false;
      return;
    }
    
    const touch = e.touches[0];
    if (!touch) return;
    
    const delta = touch.clientY - dragStartY;
    
    // For top sheet: allow dragging UP (negative delta)
    if (delta < 0) {
      dragOffset = delta;
      e.preventDefault();
    }
  }
  
  function handleTouchEnd() {
    if (!isDragging) return;
    
    isDragging = false;
    
    // Close if dragged up more than 100px
    if (dragOffset < -100) {
      closePopup();
    } else {
      // Spring back
      dragOffset = 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closePopup();
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closePopup();
    }
  }
  
  function handleRecordClick(record: DataRecord) {
    dispatch('recordClick', record);
  }
  
  function handleRecordOpenInNewWindow(record: DataRecord) {
    dispatch('recordOpenInNewWindow', record);
  }
  
  function handleRecordSettings(record: DataRecord) {
    // Close popup first to prevent z-index conflict with Obsidian modal
    closePopup();
    // Slight delay to ensure popup is closed before modal opens
    setTimeout(() => {
      dispatch('recordSettings', record);
    }, 50);
  }
  
  function handleRecordDelete(record: DataRecord) {
    dispatch('recordDelete', record);
  }
  
  function handleRecordDuplicate(record: DataRecord) {
    duplicateRecord = record;
    
    // Find corresponding ProcessedRecord
    if (processedData) {
      duplicateProcessedRecord = processedData.processed.find(pr => pr.record.id === record.id) ?? null;
    }
    
    showDuplicatePopup = true;
  }
  
  function handleDuplicateConfirm(event: CustomEvent<{ 
    sourceRecord: ProcessedRecord; 
    targetDates: dayjs.Dayjs[];
    customTime: { startTime: dayjs.Dayjs; endTime: dayjs.Dayjs } | null;
  }>) {
    const { targetDates, customTime } = event.detail;
    
    if (duplicateRecord) {
      dispatch('recordDuplicate', { 
        record: duplicateRecord, 
        targetDates,
        customTime 
      });
    }
    showDuplicatePopup = false;
    duplicateRecord = null;
    duplicateProcessedRecord = null;
  }
  
  function handleRecordTimeChange(record: DataRecord, newTime: string) {
    dispatch('recordTimeChange', { record, newTime });
  }
  
  function handleRecordCheck(record: DataRecord, checked: boolean) {
    dispatch('recordCheck', { record, checked });
  }
  
  function handleRecordColorChange(record: DataRecord, color: string) {
    dispatch('recordColorChange', { record, color });
  }
  
  function handleCreateNote() {
    dispatch('createNote', date);
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
  <!-- iOS-style Backdrop - mounted to body via portal -->
  <div 
    use:createPortal
    class="ios-popup-backdrop"
    class:mobile={isMobile}
    class:closing={isClosing}
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === 'Enter' && closePopup()}
    role="presentation"
    tabindex="-1"
  >
    <!-- Popup Container -->
    <div 
      bind:this={popupElement}
      class="ios-popup"
      class:mobile={isMobile}
      class:desktop={!isMobile}
      class:closing={isClosing}
      class:dragging={isDragging}
      style:--drag-offset="{dragOffset}px"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-popup-title"
      on:touchstart={handleTouchStart}
      on:touchmove={handleTouchMove}
      on:touchend={handleTouchEnd}
      on:click|stopPropagation={() => {}}
      on:keydown|stopPropagation={() => {}}
    >
      <!-- Header -->
      <header class="ios-popup-header">
        <div class="ios-popup-header-content">
          <div class="ios-popup-date-section">
            <h2 id="ios-popup-title" class="ios-popup-title">
              {formattedDate}
            </h2>
            <div class="ios-popup-subtitle">
              <span class="ios-popup-weekday">{dayOfWeek}</span>
              {#if isToday}
                <span class="ios-popup-badge today">{dateBadge}</span>
              {/if}
            </div>
          </div>
          
          <button 
            class="ios-popup-close-btn"
            on:click={closePopup}
            aria-label="Закрыть"
            type="button"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </header>
      
      <!-- Footer with Create button (moved to top on mobile) -->
      <footer class="ios-popup-footer">
        <button 
          class="ios-popup-create-btn"
          on:click={handleCreateNote}
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>{$i18n.t("views.calendar.new-note") ?? "Новая заметка"}</span>
        </button>
      </footer>
      
      <!-- Content -->
      <div 
        bind:this={contentElement}
        class="ios-popup-content"
      >
        {#if records.length === 0}
          <!-- Empty State -->
          <div class="ios-popup-empty">
            <div class="ios-popup-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <p class="ios-popup-empty-text">
              {$i18n.t("views.calendar.no-events") ?? "Нет событий"}
            </p>
            <p class="ios-popup-empty-hint">
              {$i18n.t("views.calendar.popup.empty-hint") ?? "Нажмите кнопку выше, чтобы создать"}
            </p>
          </div>
        {:else}
          <!-- Records List -->
          <div class="ios-popup-records">
            {#each records as record (record.id)}
              <RecordItem
                {record}
                {checkField}
                currentColor={getColorForRecord(record) ?? undefined}
                onColorChange={(color) => handleRecordColorChange(record, color)}
                on:openNote={() => handleRecordClick(record)}
                on:openInNewWindow={() => handleRecordOpenInNewWindow(record)}
                on:settings={() => handleRecordSettings(record)}
                on:delete={() => handleRecordDelete(record)}
                on:duplicate={() => handleRecordDuplicate(record)}
                on:timeChange={({ detail }) => handleRecordTimeChange(record, detail)}
                on:check={({ detail }) => handleRecordCheck(record, detail)}
                on:colorChange={({ detail }) => handleRecordColorChange(record, detail)}
              />
            {/each}
          </div>
        {/if}
      </div>
      
      <!-- Drag Indicator (mobile only) - at bottom for top sheet -->
      {#if isMobile}
        <div class="ios-popup-drag-indicator">
          <div class="ios-popup-drag-handle"></div>
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if showDuplicatePopup && duplicateProcessedRecord && processedData}
  <DuplicatePopup
    visible={showDuplicatePopup}
    sourceRecord={duplicateProcessedRecord}
    existingData={processedData}
    {firstDayOfWeek}
    displayMode="bars"
    startHour={7}
    endHour={21}
    timezone={config?.timezone || 'local'}
    on:confirm={handleDuplicateConfirm}
    on:close={() => { 
      showDuplicatePopup = false; 
      duplicateRecord = null;
      duplicateProcessedRecord = null;
    }}
  />
{/if}

<style>
  /* ═══════════════════════════════════════════════════════════════
     iOS POPUP - CSS VARIABLES
     ═══════════════════════════════════════════════════════════════ */
  .ios-popup-backdrop {
    --ios-radius: 1.25rem;
    --ios-bg: var(--background-primary);
    --ios-border: var(--background-modifier-border);
    --ios-shadow: 0 -0.5rem 2.5rem rgba(0, 0, 0, 0.25);
    --ios-accent: var(--interactive-accent);
    --ios-touch: 2.75rem; /* 44px iOS minimum */
  }

  /* ═══════════════════════════════════════════════════════════════
     BACKDROP
     ═══════════════════════════════════════════════════════════════ */
  .ios-popup-backdrop {
    /* Use absolute positioning to stay within workspace-leaf bounds */
    position: absolute;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    background: rgba(0, 0, 0, 0);
    animation: ios-backdrop-in 0.3s ease forwards;
    -webkit-tap-highlight-color: transparent;
  }
  
  .ios-popup-backdrop.closing {
    animation: ios-backdrop-out 0.2s ease forwards;
  }
  
  .ios-popup-backdrop:not(.mobile) {
    align-items: center;
  }
  
  @keyframes ios-backdrop-in {
    from { background: rgba(0, 0, 0, 0); }
    to { background: rgba(0, 0, 0, 0.4); }
  }
  
  @keyframes ios-backdrop-out {
    from { background: rgba(0, 0, 0, 0.4); }
    to { background: rgba(0, 0, 0, 0); }
  }

  /* ═══════════════════════════════════════════════════════════════
     POPUP CONTAINER
     ═══════════════════════════════════════════════════════════════ */
  .ios-popup {
    display: flex;
    flex-direction: column;
    background: var(--ios-bg);
    overflow: hidden;
    /* Use percentage of container instead of viewport */
    max-height: 90%;
    min-height: 12rem;
    will-change: transform;
    /* CRITICAL: Enable pointer events for popup content (parent has pointer-events: none) */
    pointer-events: auto;
  }
  
  /* Mobile: Top sheet (slides from top) */
  .ios-popup.mobile {
    width: 100%;
    max-width: 100%;
    border-radius: 0 0 var(--ios-radius) var(--ios-radius);
    box-shadow: var(--ios-shadow);
    transform: translateY(calc(var(--drag-offset, 0px)));
    animation: ios-sheet-in-top 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards;
    padding-top: env(safe-area-inset-top, 0);
  }
  
  .ios-popup.mobile.closing {
    animation: ios-sheet-out-top 0.25s cubic-bezier(0.32, 0.72, 0, 1) forwards;
  }
  
  .ios-popup.mobile.dragging {
    transition: none;
  }
  
  /* Desktop: Centered card */
  .ios-popup.desktop {
    width: 24rem;
    max-width: calc(100% - 2rem);
    border-radius: var(--ios-radius);
    box-shadow: 
      0 1.5rem 3rem -0.5rem rgba(0, 0, 0, 0.25),
      0 0 0 1px var(--ios-border);
    animation: ios-card-in 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards;
  }
  
  .ios-popup.desktop.closing {
    animation: ios-card-out 0.2s ease forwards;
  }
  
  @keyframes ios-sheet-in-top {
    from { transform: translateY(-100%); }
    to { transform: translateY(0); }
  }
  
  @keyframes ios-sheet-out-top {
    from { transform: translateY(var(--drag-offset, 0px)); }
    to { transform: translateY(-100%); }
  }
  
  @keyframes ios-card-in {
    from { opacity: 0; transform: scale(0.9) translateY(1rem); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  
  @keyframes ios-card-out {
    from { opacity: 1; transform: scale(1); }
    to { opacity: 0; transform: scale(0.95); }
  }

  /* ═══════════════════════════════════════════════════════════════
     DRAG INDICATOR
     ═══════════════════════════════════════════════════════════════ */
  .ios-popup-drag-indicator {
    display: flex;
    justify-content: center;
    padding: 0.625rem 0 0.375rem;
    cursor: grab;
  }
  
  .ios-popup-drag-indicator:active {
    cursor: grabbing;
  }
  
  .ios-popup-drag-handle {
    width: 2.25rem;
    height: 0.3125rem;
    border-radius: 0.25rem;
    background: var(--ios-border);
    opacity: 0.6;
  }

  /* ═══════════════════════════════════════════════════════════════
     HEADER
     ═══════════════════════════════════════════════════════════════ */
  .ios-popup-header {
    flex-shrink: 0;
    border-bottom: 1px solid var(--ios-border);
  }
  
  .ios-popup-header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1rem 1rem 1.25rem;
    gap: 1rem;
  }
  
  .ios-popup-date-section {
    flex: 1;
    min-width: 0;
  }
  
  .ios-popup-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-normal);
    line-height: 1.3;
  }
  
  .ios-popup-subtitle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.125rem;
  }
  
  .ios-popup-weekday {
    font-size: 0.9375rem;
    color: var(--text-muted);
    text-transform: capitalize;
  }
  
  .ios-popup-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  
  .ios-popup-badge.today {
    background: var(--ios-accent);
    color: var(--text-on-accent);
  }
  
  /* Close Button */
  .ios-popup-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--ios-touch);
    height: var(--ios-touch);
    min-width: var(--ios-touch);
    min-height: var(--ios-touch);
    border: none;
    border-radius: 50%;
    background: var(--background-secondary);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }
  
  .ios-popup-close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .ios-popup-close-btn:active {
    transform: scale(0.92);
  }
  
  .ios-popup-close-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  /* ═══════════════════════════════════════════════════════════════
     CONTENT
     ═══════════════════════════════════════════════════════════════ */
  .ios-popup-content {
    flex: 1 1 auto;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    min-height: 4rem;
  }
  
  /* Small viewports need special handling */
  @media (max-height: 25rem) { /* 400px at 16px base */
    .ios-popup {
      max-height: calc(100vh - 1rem);
      max-height: calc(100dvh - 1rem);
    }
    
    .ios-popup-content {
      min-height: 2rem;
    }
    
    .ios-popup-empty {
      padding: 1rem;
    }
    
    .ios-popup-empty-icon {
      display: none;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     EMPTY STATE
     ═══════════════════════════════════════════════════════════════ */
  .ios-popup-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 1.5rem;
    text-align: center;
  }
  
  .ios-popup-empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 4.5rem;
    height: 4.5rem;
    margin-bottom: 1rem;
    border-radius: 50%;
    background: var(--background-secondary);
    color: var(--text-faint);
  }
  
  .ios-popup-empty-icon svg {
    opacity: 0.6;
  }
  
  .ios-popup-empty-text {
    margin: 0 0 0.25rem;
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-muted);
  }
  
  .ios-popup-empty-hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-faint);
  }

  /* ═══════════════════════════════════════════════════════════════
     RECORDS LIST
     ═══════════════════════════════════════════════════════════════ */
  .ios-popup-records {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.75rem 1rem;
  }

  /* ═══════════════════════════════════════════════════════════════
     FOOTER
     ═══════════════════════════════════════════════════════════════ */
  .ios-popup-footer {
    flex-shrink: 0;
    padding: 0.75rem 1rem 1rem;
    border-top: 1px solid var(--ios-border);
    background: var(--ios-bg);
  }
  
  .ios-popup-create-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    height: var(--ios-touch);
    min-height: var(--ios-touch);
    padding: 0 1.25rem;
    border: none;
    border-radius: 0.75rem;
    background: var(--ios-accent);
    color: var(--text-on-accent);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .ios-popup-create-btn:hover {
    filter: brightness(1.05);
  }
  
  .ios-popup-create-btn:active {
    transform: scale(0.98);
    filter: brightness(0.95);
  }
  
  .ios-popup-create-btn svg {
    flex-shrink: 0;
  }

  /* ═══════════════════════════════════════════════════════════════
     SCROLLBAR
     ═══════════════════════════════════════════════════════════════ */
  .ios-popup-content::-webkit-scrollbar {
    width: 0.5rem;
  }
  
  .ios-popup-content::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .ios-popup-content::-webkit-scrollbar-thumb {
    background: var(--ios-border);
    border-radius: 0.25rem;
  }
  
  .ios-popup-content::-webkit-scrollbar-thumb:hover {
    background: var(--background-modifier-border-hover);
  }

  /* ═══════════════════════════════════════════════════════════════
     RESPONSIVE
     ═══════════════════════════════════════════════════════════════ */
  @media (max-width: 30rem) { /* 480px at 16px base */
    .ios-popup-header-content {
      padding: 0.75rem 1rem;
    }
    
    .ios-popup-title {
      font-size: 1.125rem;
    }
    
    .ios-popup-weekday {
      font-size: 0.875rem;
    }
    
    .ios-popup-records {
      padding: 0.5rem 0.75rem;
    }
    
    .ios-popup-footer {
      padding: 0.5rem 0.75rem 0.75rem;
    }
  }
  
  /* Very small screens - compact everything */
  @media (max-width: 20rem), (max-height: 30rem) { /* 320px / 480px at 16px base */
    .ios-popup-header-content {
      padding: 0.5rem 0.75rem;
      gap: 0.5rem;
    }
    
    .ios-popup-title {
      font-size: 1rem;
    }
    
    .ios-popup-subtitle {
      font-size: 0.75rem;
    }
    
    .ios-popup-close-btn {
      width: 2.75rem;
      height: 2.75rem;
      min-width: 2.75rem;
      min-height: 2.75rem;
    }
    
    .ios-popup-footer {
      padding: 0.5rem;
    }
    
    .ios-popup-create-btn {
      height: 2.5rem;
      min-height: 2.5rem;
      font-size: 0.875rem;
    }
    
    .ios-popup-drag-indicator {
      padding: 0.375rem 0 0.25rem;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     v5.0.0: LANDSCAPE ORIENTATION SUPPORT
     ═══════════════════════════════════════════════════════════════ */
  @media (orientation: landscape) and (max-height: 500px) {
    /* In landscape on small devices, use side sheet instead of top sheet */
    .ios-popup.mobile {
      width: min(50vw, 24rem);
      max-width: 50vw;
      height: 100%;
      max-height: 100%;
      border-radius: var(--ios-radius) 0 0 var(--ios-radius);
      animation: ios-sheet-in-right 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards;
      /* Position on right side */
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      left: auto;
    }
    
    .ios-popup.mobile.closing {
      animation: ios-sheet-out-right 0.2s ease forwards;
    }
    
    /* Adjust layout for horizontal orientation */
    .ios-popup-header {
      padding: 0.5rem;
    }
    
    .ios-popup-content {
      flex: 1;
      min-height: 0;
    }
    
    .ios-popup-footer {
      padding: 0.5rem;
    }
    
    /* Hide drag indicator in landscape - doesn't make sense */
    .ios-popup-drag-indicator {
      display: none;
    }
    
    /* Backdrop alignment for landscape */
    .ios-popup-backdrop.mobile {
      justify-content: flex-end;
      align-items: stretch;
    }
  }
  
  @keyframes ios-sheet-in-right {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  
  @keyframes ios-sheet-out-right {
    from { transform: translateX(0); }
    to { transform: translateX(100%); }
  }

  /* ═══════════════════════════════════════════════════════════════
     REDUCED MOTION
     ═══════════════════════════════════════════════════════════════ */
  @media (prefers-reduced-motion: reduce) {
    .ios-popup-backdrop,
    .ios-popup,
    .ios-popup-close-btn,
    .ios-popup-create-btn {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>