<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import dayjs from "dayjs";
  import type { ProcessedRecord, ProcessedCalendarData } from "../../types";
  import { duplicateStore } from "src/lib/stores/duplicateStore";
  import { i18n } from "src/lib/stores/i18n";
  import DuplicateCalendarView from "./DuplicateCalendarView.svelte";
  
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
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
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
      
      console.log('[DuplicatePopup] ScrollToToday:', {
        timezone,
        today: today.format('YYYY-MM-DD HH:mm'),
        sourceDate: sourceDate.format('YYYY-MM-DD')
      });
      
      calendarViewComponent.scrollToDate(today);
    }
  }
  
  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });
  
  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    duplicateStore.reset();
  });
</script>

{#if visible}
  <div 
    class="duplicate-backdrop" 
    bind:this={backdropElement}
    on:click={handleBackdropClick}
    role="presentation"
  >
    <div class="duplicate-modal">
      <!-- HEADER: Title + Close button -->
      <header class="modal-header">
        <h2 class="modal-title">{$i18n.t("views.calendar.duplicate.title") || "Выберите даты для дублирования"}</h2>
        <button 
          class="close-btn" 
          on:click={handleClose} 
          aria-label="Закрыть"
        >
          ✕
        </button>
      </header>
      
      <!-- TOOLBAR: Today + Status + Confirm -->
      <div class="modal-toolbar">
        <button 
          class="toolbar-btn today-btn" 
          on:click={handleScrollToToday}
          title="Сегодня"
        >
          📅 {$i18n.t("views.calendar.duplicate.today") || "Сегодня"}
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
          <input 
            type="time" 
            value={editedTime.startTime.format('HH:mm')}
            on:change={(e) => {
              const input = e.target;
              if (input instanceof HTMLInputElement) {
                const [h, m] = input.value.split(':').map(Number);
                if (h !== undefined && m !== undefined) {
                  updateStartTime(h, m);
                }
              }
            }}
            class="time-input"
          />
          <span class="time-sep">—</span>
          <input 
            type="time" 
            value={editedTime.endTime.format('HH:mm')}
            on:change={(e) => {
              const input = e.target;
              if (input instanceof HTMLInputElement) {
                const [h, m] = input.value.split(':').map(Number);
                if (h !== undefined && m !== undefined) {
                  updateEndTime(h, m);
                }
              }
            }}
            class="time-input"
          />
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
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(0.25rem);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .duplicate-modal {
    background: var(--background-primary);
    border-radius: 0.75rem;
    width: 90%;
    max-width: 26rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 0.5rem 2rem rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }
  
  /* ========== HEADER ========== */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    flex-shrink: 0;
  }
  
  .modal-title {
    font-size: 0.875rem;
    font-weight: 600;
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
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }
  
  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
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
    border-radius: 1rem;
    font-size: 0.6875rem;
    font-weight: 600;
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
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }
  
  .time-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  
  .time-input {
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.25rem;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.75rem;
    width: 4.5rem;
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
    .duplicate-modal {
      width: 100%;
      max-width: 100%;
      height: 100%;
      max-height: 100%;
      border-radius: 0;
    }
    
    .modal-header {
      padding: 0.5rem 0.75rem;
    }
    
    .modal-title {
      font-size: 0.8125rem;
    }
  }
</style>
