<script lang="ts">
  import { onDestroy, createEventDispatcher } from "svelte";
  import DateField from "src/ui/components/fields/DateField.svelte";
  import dayjs from "dayjs";
  import type { ProcessedRecord, ProcessedCalendarData } from "../../types";
  import { duplicateStore } from "src/lib/stores/duplicateStore";
  import { i18n } from "src/lib/stores/i18n";
  import { focusTrap } from "src/lib/a11y/focusTrap";
  import { portal } from "src/ui/portal";
  import DuplicateCalendarView from "./DuplicateCalendarView.svelte";
  import { calendarLogger } from '../../logger';

  export let visible: boolean = false;
  export let sourceRecord: ProcessedRecord;
  export let existingData: ProcessedCalendarData;
  export let firstDayOfWeek: number = 1;
  export let displayMode: 'list' | 'bars' = 'bars';
  export let startHour: number = 7;
  export let endHour: number = 21;
  export let timezone: string = 'local';
  
  const dispatch = createEventDispatcher<{
    confirm: { 
      sourceRecord: ProcessedRecord; 
      targetDates: dayjs.Dayjs[];
      customTime: { startTime: dayjs.Dayjs; endTime: dayjs.Dayjs } | null;
    };
    close: void;
  }>();
  
  let backdropElement: HTMLDivElement;
  let calendarViewComponent: DuplicateCalendarView;
  
  // Subscribe to store
  $: store = $duplicateStore;
  $: selectedCount = store.selectedDates.size;
  $: hasCollisions = store.collisions.size > 0;
  $: collisionCount = store.collisions.size;
  $: hasTimed = sourceRecord.timeInfo !== null && sourceRecord.timeInfo !== undefined;
  
  // Source date for calendar initialization - use startDate or today
  $: sourceDate = sourceRecord.startDate || dayjs();
  
  // Инициализация при открытии
  $: if (visible && sourceRecord) {
    duplicateStore.init(sourceRecord, existingData);
  }
  
  function handleClose() {
    duplicateStore.reset();
    visible = false;
    dispatch("close");
  }
  
  function handleConfirm() {
    const targetDates = duplicateStore.getTargetDates();
    
    dispatch("confirm", {
      sourceRecord,
      targetDates,
      customTime: store.editedTime,
    });
    
    handleClose();
  }
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === backdropElement) {
      handleClose();
    }
  }
  
  // Escape is heard on the window itself, not on the document: it closes this
  // window and nothing behind it. The trap keeps focus inside, so the key
  // always starts here; stopping it keeps Obsidian from also acting on it.
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      handleClose();
    }
  }
  
  function updateStartTime(h: number, m: number) {
    if (store.editedTime) {
      const newStart = store.editedTime.startTime.hour(h).minute(m);
      duplicateStore.setStartTime(newStart);
    }
  }
  
  function updateEndTime(h: number, m: number) {
    if (store.editedTime) {
      const newEnd = store.editedTime.endTime.hour(h).minute(m);
      duplicateStore.setEndTime(newEnd);
    }
  }
  
  function handleScrollToToday() {
    if (calendarViewComponent) {
      // Используем timezone проекта для правильного определения "сегодня"
      // Сначала получаем локальное время, затем конвертируем в timezone проекта
      const today = timezone && timezone !== 'local' 
        ? dayjs.tz(dayjs(), timezone) 
        : dayjs();
      
      calendarLogger.debug('[DuplicatePopup] ScrollToToday', {
        data: {
          timezone,
          today: today.format('YYYY-MM-DD HH:mm'),
          sourceDate: sourceDate.format('YYYY-MM-DD')
        }
      });
      
      calendarViewComponent.scrollToDate(today);
    }
  }
  
  onDestroy(() => {
    duplicateStore.reset();
  });
</script>

{#if visible}
  <!-- `use:portal` is declared BEFORE `use:focusTrap`: the trap moves focus
       inside on mount, and reparenting a subtree that holds focus drops it. The
       window lives on the body of its own document, above every leaf layer, so
       the day popup it was opened from cannot cover it. `ppp-modal` is the
       shared plugin-modal root: the reduced-motion and coarse-pointer rules in
       tokens.css reach a body-level surface through it. -->
  <div
    class="duplicate-backdrop ppp-modal"
    bind:this={backdropElement}
    use:portal={{ to: "document-body" }}
    use:focusTrap
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
    role="presentation"
  >
    <div
      class="duplicate-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
      tabindex="-1"
    >
      <!-- HEADER: Title + Close button -->
      <header class="modal-header">
        <h2 id="duplicate-modal-title" class="modal-title">{$i18n.t("views.calendar.duplicate.title")}</h2>
        <button 
          class="close-btn" 
          on:click={handleClose} 
          aria-label={$i18n.t('common.close')}
        >
          ✕
        </button>
      </header>
      
      <!-- TOOLBAR: Today + Status + Confirm -->
      <div class="modal-toolbar">
        <button 
          class="toolbar-btn today-btn" 
          on:click={handleScrollToToday}
          title={$i18n.t('views.calendar.duplicate.today')}
        >
          📅 {$i18n.t("views.calendar.duplicate.today")}
        </button>
        
        <div class="toolbar-status">
          {#if selectedCount > 0}
            <span class="status-badge">{selectedCount}</span>
            {#if hasCollisions}
              <span class="collision-warning">⚠️ {collisionCount}</span>
            {/if}
          {/if}
        </div>
        
        <button 
          class="toolbar-btn confirm-btn" 
          on:click={handleConfirm}
          disabled={selectedCount === 0}
        >
          ✓ {$i18n.t("views.calendar.duplicate.confirm") || "Дублировать"}
        </button>
      </div>
      
      <!-- TIME EDITOR (if timed event) -->
      {#if hasTimed && store.editedTime && sourceRecord.timeInfo}
        {@const editedTime = store.editedTime}
        <div class="time-row">
          <span class="time-label">{$i18n.t("views.calendar.duplicate.time") || "Время"}:</span>
          <div class="time-field">
            <DateField
              withTime
              value={editedTime.startTime.toDate()}
              ariaLabel={$i18n.t("views.calendar.duplicate.time") || "Время"}
              on:change={(e) => { if (e.detail) updateStartTime(e.detail.getHours(), e.detail.getMinutes()); }}
            />
          </div>
          <span class="time-sep">—</span>
          <div class="time-field">
            <DateField
              withTime
              value={editedTime.endTime.toDate()}
              ariaLabel={$i18n.t("views.calendar.duplicate.time") || "Время"}
              on:change={(e) => { if (e.detail) updateEndTime(e.detail.getHours(), e.detail.getMinutes()); }}
            />
          </div>
        </div>
      {/if}
      
      <!-- CALENDAR -->
      <div class="calendar-container">
        <DuplicateCalendarView
          bind:this={calendarViewComponent}
          {firstDayOfWeek}
          {sourceDate}
          {displayMode}
          {startHour}
          {endHour}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  .duplicate-backdrop {
    position: fixed;
    inset: 0;
    background: var(--background-modifier-cover);
    backdrop-filter: blur(0.25rem);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .duplicate-modal {
    background: var(--background-primary);
    border-radius: var(--ppp-radius-lg);
    width: 90%;
    max-width: 26rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-l);
    overflow: hidden;
  }
  
  /* ========== HEADER ========== */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    background: var(--background-secondary);
    flex-shrink: 0;
  }
  
  .modal-title {
    font-size: var(--ppp-font-size-md);
    font-weight: var(--ppp-font-weight-semibold);
    margin: 0;
    color: var(--text-normal);
  }
  
  .close-btn {
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 1rem;
  }
  
  .close-btn:hover {
    background: var(--background-modifier-hover);
  }
  
  /* ========== TOOLBAR ========== */
  .modal-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    gap: 0.5rem;
    background: var(--background-primary);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    flex-shrink: 0;
  }
  
  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    border: none;
    border-radius: var(--ppp-radius-sm);
    font-size: var(--ppp-font-size-sm);
    font-weight: var(--ppp-font-weight-medium);
    cursor: pointer;
    white-space: nowrap;
  }
  
  .today-btn {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .today-btn:hover {
    background: var(--background-modifier-border);
  }
  
  .confirm-btn {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .confirm-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  
  .confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .toolbar-status {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  
  .status-badge {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    padding: 0.125rem 0.5rem;
    border-radius: var(--ppp-radius-pill);
    font-size: var(--ppp-font-size-xs);
    font-weight: var(--ppp-font-weight-semibold);
  }
  
  .collision-warning {
    font-size: 0.6875rem;
    color: var(--text-warning);
  }
  
  /* ========== TIME ROW ========== */
  .time-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--background-secondary);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    flex-shrink: 0;
  }
  
  .time-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  
  .time-field {
    flex: 1 1 0;
    min-width: 0;
  }
  
  .time-sep {
    color: var(--text-muted);
    font-size: 0.75rem;
  }
  
  /* ========== CALENDAR CONTAINER ========== */
  .calendar-container {
    flex: 1 1 auto;
    overflow: auto;
    min-height: 0;
  }
  
  /* ========== MOBILE ========== */
  @media (max-width: 30rem) {
    .duplicate-backdrop {
      /* iOS safe area support */
      padding-top: env(safe-area-inset-top, 0);
      padding-bottom: env(safe-area-inset-bottom, 0);
      align-items: flex-start;
    }
    
    .duplicate-modal {
      width: 100%;
      max-width: 100%;
      height: 100%;
      max-height: 100%;
      border-radius: 0;
      /* Ensure modal respects safe areas */
      margin-top: env(safe-area-inset-top, 0);
    }
    
    .modal-header {
      padding: 1rem;
      /* Extra padding top for status bar overlap safety */
      padding-top: max(1rem, env(safe-area-inset-top, 1rem));
      min-height: 3.5rem;
      position: relative;
    }
    
    .modal-title {
      font-size: 1rem;
      padding-right: 3rem; /* Space for close button */
    }
    
    /* Larger close button for mobile touch targets - ALWAYS VISIBLE */
    .close-btn {
      position: absolute;
      top: 50%;
      right: 0.75rem;
      transform: translateY(-50%);
      width: var(--ppp-touch-target-min);
      height: var(--ppp-touch-target-min);
      min-width: var(--ppp-touch-target-min);
      min-height: var(--ppp-touch-target-min);
      font-size: 1.25rem;
      background: var(--background-modifier-hover);
      border: 0.125rem solid var(--background-modifier-border);
      border-radius: 0.5rem;
      z-index: 10;
    }
    
    /* Larger toolbar buttons for mobile */
    .toolbar-btn {
      min-height: var(--ppp-touch-target-min);
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
    }
    
    .time-row {
      flex-wrap: wrap;
    }
  }
</style>
