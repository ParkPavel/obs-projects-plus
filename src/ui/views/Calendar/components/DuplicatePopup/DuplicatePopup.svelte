<script lang="ts">
  import { onDestroy, createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
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
  
  /** "HH:mm" from a time input, or null while it is empty or partial. */
  function parseClock(text: string): { h: number; m: number } | null {
    const match = /^(\d{1,2}):(\d{2})/.exec(text);
    // coercion-exempt: Class B - lexing an HH:MM token from a time input
    return match ? { h: parseInt(match[1] ?? "0", 10), m: parseInt(match[2] ?? "0", 10) } : null;
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
      <!-- i3-calendar: laid out like Obsidian's own modals — title and a plain
           close icon on top, the controls in the body, the actions in a footer
           (on a phone a sheet whose footer sits above the home indicator, the
           primary action under the thumb). -->
      <header class="modal-header">
        <h2 id="duplicate-modal-title" class="modal-title">{$i18n.t("views.calendar.duplicate.title")}</h2>
        <button
          class="close-btn clickable-icon"
          on:click={handleClose}
          aria-label={$i18n.t('common.close')}
        >
          <Icon name="x" size="sm" />
        </button>
      </header>

      <div class="modal-toolbar">
        <button
          class="toolbar-btn today-btn"
          on:click={handleScrollToToday}
          title={$i18n.t('views.calendar.duplicate.today')}
        >
          <Icon name="calendar" size="sm" /> {$i18n.t("views.calendar.duplicate.today")}
        </button>
        {#if hasCollisions}
          <span class="collision-warning"><Icon name="alert-triangle" size="xs" /> {collisionCount}</span>
        {/if}
      </div>
      
      <!-- TIME EDITOR (if timed event) -->
      {#if hasTimed && store.editedTime && sourceRecord.timeInfo}
        {@const editedTime = store.editedTime}
        <div class="time-row">
          <span class="time-label">{$i18n.t("views.calendar.duplicate.time")}:</span>
          <!-- i3-calendar: only the clock is chosen here (the day is picked on
               the grid), so the field is a time field — a date-time field
               showed «07.10…», the source's date. -->
          <div class="time-field">
            <input
              type="time"
              class="time-input"
              value={editedTime.startTime.format("HH:mm")}
              aria-label={$i18n.t("views.calendar.duplicate.time")}
              on:change={(e) => { const t = parseClock(e.currentTarget.value); if (t) updateStartTime(t.h, t.m); }}
            />
          </div>
          <span class="time-sep">—</span>
          <div class="time-field">
            <input
              type="time"
              class="time-input"
              value={editedTime.endTime.format("HH:mm")}
              aria-label={$i18n.t("views.calendar.duplicate.time")}
              on:change={(e) => { const t = parseClock(e.currentTarget.value); if (t) updateEndTime(t.h, t.m); }}
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

      <footer class="modal-footer">
        <button class="footer-btn" on:click={handleClose}>{$i18n.t("views.calendar.duplicate.cancel")}</button>
        <button class="footer-btn mod-cta" on:click={handleConfirm} disabled={selectedCount === 0}>
          {$i18n.t("views.calendar.duplicate.confirm")}{#if selectedCount > 0}&nbsp;({selectedCount}){/if}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  /* i3-calendar: Obsidian's modal grammar. Desktop: a centred card on the
     cover. Narrow window or phone: a full-height sheet whose footer clears
     the home indicator. Layer: Obsidian's modal layer, not a literal 1100,
     so the field lists (popover layer) still open above it. */
  .duplicate-backdrop {
    position: fixed;
    inset: 0;
    background: var(--background-modifier-cover);
    z-index: var(--layer-modal, 50);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .duplicate-modal {
    background: var(--modal-background, var(--background-primary));
    border: var(--modal-border-width, 0.0625rem) solid var(--modal-border-color, var(--background-modifier-border));
    border-radius: var(--modal-radius, var(--radius-l));
    width: 90%;
    max-width: 28rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-l);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    gap: var(--size-4-2);
    padding: var(--size-4-4) var(--size-4-4) var(--size-4-2);
    flex-shrink: 0;
  }

  .modal-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--font-ui-large, 1.125rem);
    font-weight: var(--font-semibold, 600);
    line-height: 1.3;
    color: var(--text-normal);
    text-wrap: balance;
  }

  .close-btn {
    flex: none;
  }

  .modal-toolbar {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    padding: 0 var(--size-4-4) var(--size-4-2);
    flex-shrink: 0;
  }

  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4-1);
  }

  .collision-warning {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4-1);
    font-size: var(--font-ui-smaller);
    color: var(--text-warning);
  }

  .time-row {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    padding: var(--size-4-2) var(--size-4-4);
    border-top: var(--border-width, 0.0625rem) solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .time-label {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .time-field {
    flex: 1 1 0;
    min-width: 0;
  }

  .time-input {
    width: 100%;
    font-variant-numeric: tabular-nums;
  }

  .time-sep {
    color: var(--text-muted);
  }

  .calendar-container {
    flex: 1 1 auto;
    overflow: auto;
    min-height: 0;
    border-top: var(--border-width, 0.0625rem) solid var(--background-modifier-border);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--size-4-2);
    padding: var(--size-4-3) var(--size-4-4);
    border-top: var(--border-width, 0.0625rem) solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .footer-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* A narrow window (a phone, a split pane): the sheet fills it, and the two
     actions share the footer's width so the primary one is easy to reach. */
  @media (max-width: 30rem) {
    .duplicate-backdrop {
      align-items: stretch;
    }

    .duplicate-modal {
      width: 100%;
      max-width: 100%;
      max-height: 100%;
      border: none;
      border-radius: 0;
      padding-top: env(safe-area-inset-top, 0);
    }

    .modal-footer {
      padding-bottom: max(var(--size-4-3), env(safe-area-inset-bottom, 0));
    }

    .modal-footer .footer-btn {
      flex: 1;
      min-height: var(--ppp-touch-target-min);
    }
  }
</style>
