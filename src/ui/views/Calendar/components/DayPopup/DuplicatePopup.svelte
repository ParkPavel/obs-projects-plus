<script lang="ts">
  import dayjs from "dayjs";
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { Icon } from "obsidian-svelte";

  export let visible: boolean = false;
  export let currentDate: dayjs.Dayjs;

  const dispatch = createEventDispatcher<{
    confirm: dayjs.Dayjs[];
    close: void;
  }>();

  let selectedDates: Set<string> = new Set();
  let viewMonth: dayjs.Dayjs = currentDate.startOf('month');

  $: monthDays = generateMonthDays(viewMonth);
  $: monthLabel = viewMonth.format('MMMM YYYY');

  function generateMonthDays(month: dayjs.Dayjs): dayjs.Dayjs[] {
    const days: dayjs.Dayjs[] = [];
    const firstDay = month.startOf('month');
    const lastDay = month.endOf('month');
    
    // Get the first day of the week for the month
    const startOfWeek = firstDay.startOf('week');
    const endOfWeek = lastDay.endOf('week');
    
    let current = startOfWeek;
    while (current.isBefore(endOfWeek) || current.isSame(endOfWeek, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }
    
    return days;
  }

  function toggleDate(date: dayjs.Dayjs) {
    const dateStr = date.format('YYYY-MM-DD');
    if (selectedDates.has(dateStr)) {
      selectedDates.delete(dateStr);
    } else {
      selectedDates.add(dateStr);
    }
    selectedDates = selectedDates; // trigger reactivity
  }

  function isSelected(date: dayjs.Dayjs): boolean {
    return selectedDates.has(date.format('YYYY-MM-DD'));
  }

  function isCurrentMonth(date: dayjs.Dayjs): boolean {
    return date.month() === viewMonth.month();
  }

  function isToday(date: dayjs.Dayjs): boolean {
    return date.isSame(dayjs(), 'day');
  }

  function prevMonth() {
    viewMonth = viewMonth.subtract(1, 'month');
  }

  function nextMonth() {
    viewMonth = viewMonth.add(1, 'month');
  }

  function handleConfirm() {
    const dates = Array.from(selectedDates).map(d => dayjs(d));
    dispatch('confirm', dates);
  }

  function handleClose() {
    visible = false;
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      handleClose();
    }
  }
</script>

{#if visible}
  <div class="duplicate-backdrop" on:click={handleBackdropClick} on:keydown={handleBackdropKeydown} role="presentation">
    <div class="duplicate-popup" role="dialog" aria-modal="true">
      <header class="popup-header">
        <h3>{$i18n.t("views.calendar.duplicate.title")}</h3>
        <button class="close-button" on:click={handleClose} aria-label="Close">
          <Icon name="x" size="md" />
        </button>
      </header>

      <div class="month-nav">
        <button class="nav-button" on:click={prevMonth} aria-label="Previous month">
          <Icon name="chevron-left" size="sm" />
        </button>
        <span class="month-label">{monthLabel}</span>
        <button class="nav-button" on:click={nextMonth} aria-label="Next month">
          <Icon name="chevron-right" size="sm" />
        </button>
      </div>

      <div class="calendar-grid">
        <div class="weekday-header">
          {#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as day}
            <span class="weekday">{day}</span>
          {/each}
        </div>
        <div class="days-grid">
          {#each monthDays as day}
            <button
              class="day-button"
              class:selected={isSelected(day)}
              class:outside={!isCurrentMonth(day)}
              class:today={isToday(day)}
              on:click={() => toggleDate(day)}
            >
              {day.date()}
            </button>
          {/each}
        </div>
      </div>

      <div class="selected-count">
        {$i18n.t("views.calendar.duplicate.selected", { count: selectedDates.size })}
      </div>

      <footer class="popup-footer">
        <button class="cancel-button" on:click={handleClose}>
          {$i18n.t("views.calendar.duplicate.cancel")}
        </button>
        <button 
          class="confirm-button" 
          on:click={handleConfirm}
          disabled={selectedDates.size === 0}
        >
          {$i18n.t("views.calendar.duplicate.confirm")}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .duplicate-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .duplicate-popup {
    background: var(--background-primary);
    border-radius: 16px;
    width: 90%;
    max-width: 340px;
    padding: 20px;
    animation: scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  @keyframes scaleIn {
    from { 
      transform: scale(0.9);
      opacity: 0;
    }
    to { 
      transform: scale(1);
      opacity: 1;
    }
  }

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .popup-header h3 {
    font-size: 17px;
    font-weight: 600;
    margin: 0;
    color: var(--text-normal);
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    cursor: pointer;
  }

  .month-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .nav-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  .nav-button:hover {
    background: var(--background-modifier-hover);
  }

  .month-label {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-normal);
  }

  .calendar-grid {
    margin-bottom: 12px;
  }

  .weekday-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    margin-bottom: 8px;
  }

  .weekday {
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    font-weight: 500;
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .day-button {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-normal);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .day-button:hover {
    background: var(--background-modifier-hover);
  }

  .day-button.outside {
    color: var(--text-faint);
  }

  .day-button.today {
    font-weight: 600;
    color: var(--interactive-accent);
  }

  .day-button.selected {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .selected-count {
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  .popup-footer {
    display: flex;
    gap: 10px;
  }

  .cancel-button,
  .confirm-button {
    flex: 1;
    padding: 12px 16px;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-button {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .cancel-button:hover {
    background: var(--background-modifier-border);
  }

  .confirm-button {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .confirm-button:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .confirm-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
