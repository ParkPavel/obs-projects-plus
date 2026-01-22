<script lang="ts">
  import dayjs from "dayjs";
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { Icon } from "obsidian-svelte";

  export let visible: boolean = false;
  export let currentDate: dayjs.Dayjs;
  /** Optional: Record title for preview bar */
  export let recordTitle: string = "Event";
  /** Optional: Record color for preview bar */
  export let recordColor: string = "var(--interactive-accent)";
  /** First day of week: 0 = Sunday, 1 = Monday */
  export let firstDayOfWeek: number = 1;
  
  const dispatch = createEventDispatcher<{
    confirm: dayjs.Dayjs[];
    close: void;
  }>();
  
  let selectedDates: Set<string> = new Set();
  
  // КРИТИЧНО: Показывать ЭТОТ ЖЕ месяц, а не навигацию по другим месяцам
  // viewMonth фиксирован на месяце currentDate
  let viewMonth: dayjs.Dayjs = currentDate.startOf('month');
  let popupElement: HTMLDivElement | null = null;
  let hoveredDate: dayjs.Dayjs | null = null;

  // Generate month grid like real calendar (week rows)
  $: monthWeeks = generateMonthWeeks(viewMonth, firstDayOfWeek);
  $: monthLabel = viewMonth.format('MMMM YYYY');
  
  // Generate weekday labels based on firstDayOfWeek
  $: weekdayLabels = generateWeekdayLabels(firstDayOfWeek);

  /**
   * Generate weekday labels starting from firstDayOfWeek
   */
  function generateWeekdayLabels(fdow: number): string[] {
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      labels.push(dayjs().day((i + fdow) % 7).format('dd').toUpperCase());
    }
    return labels;
  }

  /**
   * Generate month as array of weeks (like real calendar)
   */
  function generateMonthWeeks(month: dayjs.Dayjs, fdow: number): dayjs.Dayjs[][] {
    const weeks: dayjs.Dayjs[][] = [];
    const firstDay = month.startOf('month');
    const lastDay = month.endOf('month');
    
    // Calculate the start of the first week (may include days from previous month)
    const startOfFirstWeek = firstDay.startOf('week').add((fdow - firstDay.startOf('week').day() + 7) % 7, 'day');
    const actualStart = startOfFirstWeek.isAfter(firstDay) 
      ? startOfFirstWeek.subtract(7, 'day') 
      : startOfFirstWeek;
    
    let current = actualStart;
    
    // Generate weeks until we pass the last day of month
    while (current.isBefore(lastDay) || current.isSame(lastDay, 'day')) {
      const week: dayjs.Dayjs[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(current);
        current = current.add(1, 'day');
      }
      weeks.push(week);
    }
    
    return weeks;
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
  
  function isSourceDate(date: dayjs.Dayjs): boolean {
    return date.isSame(currentDate, 'day');
  }

  function handleConfirm() {
    const dates = Array.from(selectedDates).map(d => dayjs(d));
    dispatch('confirm', dates);
  }

  function handleClose() {
    visible = false;
    selectedDates = new Set();
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
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }
  
  // Position popup to stay within viewport
  function calculatePosition() {
    if (!popupElement) return;
    
    const rect = popupElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const PADDING = 16;
    
    // Check if popup goes beyond viewport
    if (rect.right > viewportWidth - PADDING) {
      popupElement.style.transform = `translateX(${viewportWidth - PADDING - rect.right}px)`;
    }
    if (rect.bottom > viewportHeight - PADDING) {
      popupElement.style.transform = `translateY(${viewportHeight - PADDING - rect.bottom}px)`;
    }
  }
  
  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    if (visible) {
      setTimeout(calculatePosition, 50);
    }
  });
  
  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
  
  $: if (visible && popupElement) {
    setTimeout(calculatePosition, 50);
  }
</script>

{#if visible}
  <div class="duplicate-backdrop" on:click={handleBackdropClick} on:keydown={handleBackdropKeydown} role="presentation">
    <div 
      bind:this={popupElement}
      class="duplicate-popup" 
      role="dialog" 
      aria-modal="true"
    >
      <header class="popup-header">
        <h3>{$i18n.t("views.calendar.duplicate.title")}</h3>
        <button class="close-button" on:click={handleClose} aria-label="Close">
          <Icon name="x" size="md" />
        </button>
      </header>

      <div class="month-nav">
        <!-- CRITICAL: No navigation - show ONLY current event's month -->
        <span class="month-label-fixed">{monthLabel}</span>
      </div>

      <div class="calendar-grid">
        <div class="weekday-header">
          {#each weekdayLabels as day}
            <span class="weekday">{day}</span>
          {/each}
        </div>
        
        <!-- Week-based grid with strip sections like MonthBlock (v6.3: Improved) -->
        {#each monthWeeks as week (week[0]?.format('YYYY-WW'))}
          <!-- Strip section for selected events in this week (rendered ABOVE week row) -->
          {@const selectedDaysInWeek = week.filter(d => isSelected(d))}
          {@const hoveredInWeek = hoveredDate && week.find(d => d.isSame(hoveredDate, 'day'))}
          {#if selectedDaysInWeek.length > 0 || hoveredInWeek}
            <div class="week-strip-section" style="height: var(--ppp-event-strip-height, 1.25rem); margin-bottom: var(--ppp-spacing-3xs, 2px);">
              <div class="strip-lane">
                {#each week as day}
                  {@const isSelectedDay = isSelected(day)}
                  {@const isHoveredDay = hoveredDate?.isSame(day, 'day') && !isSelected(day)}
                  {@const showStrip = isSelectedDay || isHoveredDay}
                  {#if showStrip}
                    <!-- Check if this is start/end/mid segment -->
                    <!-- v3.3.0: Account for hovered day when calculating segment type -->
                    {@const prevDay = day.subtract(1, 'day')}
                    {@const nextDay = day.add(1, 'day')}
                    {@const prevActive = isSelected(prevDay) || (hoveredDate?.isSame(prevDay, 'day') ?? false)}
                    {@const nextActive = isSelected(nextDay) || (hoveredDate?.isSame(nextDay, 'day') ?? false)}
                    {@const isFirst = !prevActive || prevDay.day() > day.day()}
                    {@const isLast = !nextActive || nextDay.day() < day.day()}
                    <div 
                      class="strip-segment"
                      class:is-start={isFirst}
                      class:is-end={isLast}
                      class:is-only={isFirst && isLast}
                      class:is-mid={!isFirst && !isLast}
                      class:is-preview={isHoveredDay}
                      style:--strip-color={recordColor}
                    >
                      {#if isFirst}
                        <span class="strip-dot"></span>
                        <span class="strip-label">{recordTitle}</span>
                      {:else}
                        <span class="strip-continuation"></span>
                      {/if}
                    </div>
                  {:else}
                    <div class="strip-empty"></div>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}
          
          <!-- Week row with day cells -->
          <div class="week-row">
            {#each week as day}
              <button
                class="day-cell"
                class:selected={isSelected(day)}
                class:hovered={hoveredDate?.isSame(day, 'day')}
                class:outside={!isCurrentMonth(day)}
                class:today={isToday(day)}
                class:source={isSourceDate(day)}
                style:--preview-color={recordColor}
                on:click={() => toggleDate(day)}
                on:mouseenter={() => hoveredDate = day}
                on:mouseleave={() => hoveredDate = null}
              >
                <span class="day-number">{day.date()}</span>
              </button>
            {/each}
          </div>
        {/each}
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
    backdrop-filter: blur(0.25rem);
    -webkit-backdrop-filter: blur(0.25rem);
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
    border-radius: 1rem;
    width: 90%;
    max-width: 26rem;
    padding: 1.25rem;
    animation: scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0.5rem 2rem rgba(0, 0, 0, 0.2);
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
    margin-bottom: 1rem;
  }

  .popup-header h3 {
    font-size: 1.0625rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-normal);
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    min-width: 2.75rem;
    min-height: 2.75rem;
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
    margin-bottom: 0.75rem;
    padding: 0.5rem;
    background: var(--background-secondary);
    border-radius: 0.5rem;
  }

  .month-label-fixed {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-normal);
    text-transform: capitalize;
    flex: 1;
    text-align: center;
  }

  .calendar-grid {
    margin-bottom: 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .weekday-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    padding: 0.5rem 0;
  }

  .weekday {
    font-size: 0.6875rem;
    color: var(--text-muted);
    text-align: center;
    font-weight: 500;
    -webkit-user-select: none;
    user-select: none;
  }

  /* Week-based structure matching MonthBlock (v6.3: Improved alignment) */
  .week-strip-section {
    display: flex;
    flex-direction: column;
    width: 100%;
    background: var(--background-primary);
  }
  
  .strip-lane {
    display: flex;
    height: 1.375rem;
    min-height: 1.375rem;
    width: 100%;
  }
  
  .strip-segment {
    --strip-color: var(--interactive-accent);
    flex: 1 1 0;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    height: 100%;
    padding: 0 0.25rem;
    background: color-mix(in srgb, var(--strip-color) 18%, var(--background-primary));
    border-top: 2px solid var(--strip-color);
    border-bottom: 1px solid color-mix(in srgb, var(--strip-color) 25%, transparent);
    font-size: 0.6875rem;
    line-height: 1;
    overflow: hidden;
    border-left: none;
    border-right: none;
    max-width: calc(100% / 7);
  }
  
  .strip-segment.is-preview {
    opacity: 0.5;
    border-style: dashed;
  }
  
  .strip-segment.is-start {
    border-left: 2px solid var(--strip-color);
    border-top-left-radius: 0.25rem;
    border-bottom-left-radius: 0.25rem;
    margin-left: 0.125rem;
  }
  
  .strip-segment.is-end {
    border-right: 2px solid var(--strip-color);
    border-top-right-radius: 0.25rem;
    border-bottom-right-radius: 0.25rem;
    margin-right: 0.125rem;
  }
  
  .strip-segment.is-only {
    border: 2px solid var(--strip-color);
    border-radius: 0.25rem;
    margin-left: 0.125rem;
    margin-right: 0.125rem;
  }
  
  .strip-segment.is-mid {
    border-radius: 0;
    margin-left: 0;
    margin-right: 0;
  }
  
  .strip-dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background: var(--strip-color);
    flex-shrink: 0;
  }
  
  .strip-label {
    color: var(--text-normal);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }
  
  .strip-continuation {
    width: 100%;
    height: var(--ppp-border-width-thick, 0.125rem);
    background: var(--strip-color);
    opacity: 0.4;
  }
  
  .strip-empty {
    flex: 1 1 0;
    min-width: 0;
    box-sizing: border-box;
    max-width: calc(100% / 7);
  }

  .week-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid var(--background-modifier-border);
  }
  
  .week-row:last-child {
    border-bottom: none;
  }

  .day-cell {
    --preview-color: var(--interactive-accent);
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: none;
    border-right: 1px solid var(--background-modifier-border);
    background: transparent;
    color: var(--text-normal);
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 2.75rem;
    position: relative;
  }
  
  .day-cell:last-child {
    border-right: none;
  }
  
  .day-number {
    position: relative;
    z-index: 1;
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.15s ease;
  }

  .day-cell:hover {
    background: var(--background-modifier-hover);
  }

  .day-cell.outside {
    color: var(--text-faint);
  }
  
  .day-cell.outside .day-number {
    opacity: 0.5;
  }

  .day-cell.today .day-number {
    font-weight: 600;
    color: var(--text-on-accent);
    background: var(--interactive-accent);
  }
  
  .day-cell.source {
    background: hsla(var(--interactive-accent-hsl), 0.08);
  }
  
  .day-cell.source .day-number {
    border: 1px dashed var(--interactive-accent);
  }

  .day-cell.selected {
    background: hsla(var(--interactive-accent-hsl), 0.15);
  }
  
  .day-cell.selected .day-number {
    color: var(--interactive-accent);
    font-weight: 600;
  }
  
  .day-cell.hovered:not(.selected) {
    background: hsla(var(--interactive-accent-hsl), 0.08);
  }

  .selected-count {
    text-align: center;
    font-size: 0.8125rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
    padding: 0.5rem;
    background: var(--background-secondary);
    border-radius: 0.5rem;
  }

  .popup-footer {
    display: flex;
    gap: 0.625rem;
  }

  .cancel-button,
  .confirm-button {
    flex: 1;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 0.625rem;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 2.75rem;
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
  
  /* Mobile responsive */
  @media (max-width: 30rem) {
    .duplicate-popup {
      width: 95%;
      padding: 1rem;
    }
    
    .day-cell {
      min-height: 2.25rem;
    }
    
    .day-number {
      width: 1.5rem;
      height: 1.5rem;
      font-size: 0.75rem;
    }
    
    .strip-label {
      display: none;
    }
    
    .strip-lane {
      height: 1.125rem;
      min-height: 1.125rem;
    }
  }
</style>
