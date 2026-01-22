<script lang="ts">
  /**
   * YearHeatmap.svelte
   * 
   * GitHub-style year heatmap visualization showing event density per day.
   * Displays 12 months in a grid (4 columns x 3 rows or horizontal scroll).
   * 
   * Features:
   * - Heat intensity based on event count per day
   * - Click on day to navigate to that date
   * - Click on month to zoom into month view
   * - Responsive: stacked on mobile, grid on desktop
   * - Year navigation via buttons and horizontal swipes
   * 
   * v6.1: Added year navigation (swipes + buttons)
   */
  import { createEventDispatcher } from 'svelte';
  import dayjs from 'dayjs';
  import type { DataRecord } from 'src/lib/dataframe/dataframe';
  import type { ProjectDefinition } from 'src/settings/settings';
  import { formatDateForDisplay } from 'src/lib/helpers';
  import type { ProcessedCalendarData, ProcessedRecord } from '../../types';
  import { i18n } from "src/lib/stores/i18n";

  export let project: ProjectDefinition;
  export let year: number;
  export let groupedRecords: Record<string, DataRecord[]>;
  export let processedData: ProcessedCalendarData | null = null;
  export let now: dayjs.Dayjs | null = null;
  export let isMobile: boolean = false;
  export let firstDayOfWeek: number = 0;
  export let onDayClick: ((date: dayjs.Dayjs, records: DataRecord[]) => void) | undefined;
  export let onMonthClick: ((month: dayjs.Dayjs, position?: string) => void) | undefined;
  /** Callback when user wants to navigate to a different year */
  export let onYearChange: ((year: number) => void) | undefined;

  const dispatch = createEventDispatcher();
  
  // Swipe detection state - DISABLED on mobile to prevent conflicts with Obsidian sidebars
  // v4.0.0: Use buttons for year navigation on mobile instead of swipes
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  const SWIPE_THRESHOLD = 50; // Minimum distance for swipe
  const SWIPE_MAX_VERTICAL = 50; // Max vertical deviation for horizontal swipe

  // Generate months for the year
  $: months = Array.from({ length: 12 }, (_, i) => dayjs().year(year).month(i).startOf('month'));
  
  // Force reactivity when processedData or groupedRecords change
  // This counter increments whenever data changes, forcing re-render
  $: dataVersion = (processedData?.processed?.length ?? 0) + Object.keys(groupedRecords ?? {}).length;
  
  // Loading state: более строгая проверка инициализации
  // Считаем данные загруженными только если хотя бы один из источников НЕ null/undefined
  $: isDataLoaded = processedData !== null && processedData !== undefined && groupedRecords !== null && groupedRecords !== undefined;
  $: hasAnyData = dataVersion > 0;
  
  // Pre-computed event counts for all days in the year (reactive)
  // This ensures heatmap updates immediately when data changes
  $: eventCountsMap = computeEventCountsForYear(year, processedData, groupedRecords);
  
  /**
   * Compute event counts for all days in a year
   * Returns a Map<YYYY-MM-DD, count> for O(1) lookup
   */
  function computeEventCountsForYear(
    yr: number, 
    pd: ProcessedCalendarData | null, 
    gr: Record<string, DataRecord[]>
  ): Map<string, number> {
    const counts = new Map<string, number>();
    
    // Start from Jan 1 of the year
    const startDate = dayjs().year(yr).startOf('year');
    const endDate = dayjs().year(yr).endOf('year');
    
    let cursor = startDate;
    while (cursor.isBefore(endDate) || cursor.isSame(endDate, 'day')) {
      const dateStr = cursor.format('YYYY-MM-DD');
      
      // Primary: processedData.grouped
      const processedRecords = pd?.grouped?.[dateStr];
      if (processedRecords && processedRecords.length > 0) {
        counts.set(dateStr, processedRecords.length);
      } else {
        // Fallback: groupedRecords
        const rawRecords = gr?.[dateStr];
        if (rawRecords && rawRecords.length > 0) {
          counts.set(dateStr, rawRecords.length);
        }
      }
      
      cursor = cursor.add(1, 'day');
    }
    
    return counts;
  }
  
  // Calculate heat levels for each day
  function getHeatLevel(count: number): number {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 6) return 3;
    return 4; // 7+ events
  }

  /**
   * Get DataRecord[] for a specific date (for popup/click handlers)
   */
  function getRecordsForDate(date: dayjs.Dayjs): DataRecord[] {
    const dateStr = date.format('YYYY-MM-DD');
    
    // Primary: extract records from ProcessedRecord[]
    if (processedData?.grouped?.[dateStr]) {
      return processedData.grouped[dateStr]
        .filter((pr: ProcessedRecord) => pr?.record != null)
        .map((pr: ProcessedRecord) => pr.record);
    }
    
    // Fallback: direct DataRecord[]
    return groupedRecords?.[dateStr] || [];
  }

  // Calculate total events in a month using pre-computed map
  function getMonthEventCount(month: dayjs.Dayjs, countsMap: Map<string, number>): number {
    const monthStart = month.startOf('month');
    const daysInMonth = month.daysInMonth();
    let total = 0;
    for (let i = 0; i < daysInMonth; i++) {
      const dateStr = monthStart.add(i, 'day').format('YYYY-MM-DD');
      total += countsMap.get(dateStr) ?? 0;
    }
    return total;
  }

  // Generate week grid for a month (similar to GitHub contribution graph)
  function generateMonthWeeks(month: dayjs.Dayjs): { date: dayjs.Dayjs; isOutside: boolean }[][] {
    const firstDay = month.startOf('month');
    const lastDay = month.endOf('month');
    
    // Start from the first day of the week containing the first day of month
    // Respect firstDayOfWeek setting
    const dayOfWeek = firstDay.day(); // 0=Sun, 1=Mon...
    const diff = (dayOfWeek - firstDayOfWeek + 7) % 7;
    let cursor = firstDay.subtract(diff, 'day');

    const weeks: { date: dayjs.Dayjs; isOutside: boolean }[][] = [];
    
    while (cursor.isBefore(lastDay) || cursor.isSame(lastDay, 'day')) {
      const week: { date: dayjs.Dayjs; isOutside: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = cursor.add(d, 'day');
        week.push({
          date,
          isOutside: date.month() !== month.month()
        });
      }
      weeks.push(week);
      cursor = cursor.add(1, 'week');
      
      // Safety limit
      if (weeks.length > 6) break;
    }
    
    return weeks;
  }

  function handleDayClick(date: dayjs.Dayjs) {
    const records = getRecordsForDate(date);
    if (onDayClick) {
      onDayClick(date, records);
    }
    dispatch('dayClick', { date, records });
  }

  function handleMonthClick(month: dayjs.Dayjs) {
    if (onMonthClick) {
      onMonthClick(month, 'center');
    }
    dispatch('monthClick', { month, position: 'center' });
  }

  // Get weekday labels (first letter)
  const baseLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  $: weekdayLabels = Array.from({ length: 7 }, (_, i) => baseLabels[(i + firstDayOfWeek) % 7]);
  
  // Year navigation with debounce protection
  let isNavigating = false;
  const NAVIGATION_COOLDOWN = 300; // ms
  
  function navigateYear(delta: number) {
    if (isNavigating) return; // Prevent rapid navigation
    isNavigating = true;
    
    const newYear = year + delta;
    if (onYearChange) {
      onYearChange(newYear);
    }
    dispatch('yearChange', { year: newYear });
    
    setTimeout(() => {
      isNavigating = false;
    }, NAVIGATION_COOLDOWN);
  }
  
  function handlePrevYear() {
    navigateYear(-1);
  }
  
  function handleNextYear() {
    navigateYear(1);
  }
  
  // Swipe handlers for year navigation - ONLY ON DESKTOP
  // v4.0.0: Disabled on mobile to prevent conflicts with Obsidian sidebar gestures
  function handleTouchStart(e: TouchEvent) {
    if (isMobile) return; // Skip on mobile - use buttons instead
    if (!e.touches[0]) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }
  
  function handleTouchEnd(e: TouchEvent) {
    if (isMobile) return; // Skip on mobile - use buttons instead
    if (isNavigating) return; // Prevent rapid swipes
    if (!e.changedTouches[0]) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = Math.abs(touchEndY - touchStartY);
    const duration = Date.now() - touchStartTime;
    
    // v7.0: Much stricter horizontal swipe detection
    // Only trigger if horizontal movement is 3x more than vertical
    // This prevents year navigation when user is scrolling vertically
    const isHorizontalSwipe = Math.abs(deltaX) > SWIPE_THRESHOLD && 
                              deltaY < SWIPE_MAX_VERTICAL && 
                              Math.abs(deltaX) > deltaY * 3 &&
                              duration < 400;
    
    if (isHorizontalSwipe) {
      if (deltaX > 0) {
        // Swipe right = previous year
        handlePrevYear();
      } else {
        // Swipe left = next year
        handleNextYear();
      }
    }
  }
</script>

<div 
  class="year-heatmap" 
  class:mobile={isMobile}
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
>
  <div class="year-header">
    <div class="year-nav">
      <button 
        class="nav-button" 
        on:click={handlePrevYear}
        title="{$i18n.t('views.calendar.heatmap.previousYear')}"
        aria-label="Previous year"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h2 class="year-title">{year}</h2>
      <button 
        class="nav-button" 
        on:click={handleNextYear}
        title="{$i18n.t('views.calendar.heatmap.nextYear')}"
        aria-label="Next year"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
    <div class="year-legend">
      <span class="legend-label">{$i18n.t("views.calendar.heatmap.less")}</span>
      <div class="legend-scale">
        {#each [0, 1, 2, 3, 4] as level}
          <div class="legend-cell heat-{level}" title="{level === 0 ? 'No events' : `${level} event${level > 1 ? 's' : ''}`}"></div>
        {/each}
      </div>
      <span class="legend-label">{$i18n.t("views.calendar.heatmap.more")}</span>
    </div>
  </div>

  {#if !isDataLoaded}
    <!-- Loading state -->
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <span class="loading-text">{$i18n.t("views.calendar.heatmap.loading") || "Загрузка..."}</span>
    </div>
  {:else if !hasAnyData}
    <!-- Empty state -->
    <div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      <span class="empty-text">{$i18n.t("views.calendar.heatmap.noData") || "Нет событий"}</span>
    </div>
  {:else}
    <!-- Data grid -->
    <div class="months-grid">
      {#each months as month}
        {@const monthWeeks = generateMonthWeeks(month)}
        <div class="month-card">
          <button 
            class="month-name" 
            on:click={() => handleMonthClick(month)}
            title="{$i18n.t('views.calendar.heatmap.clickToViewMonth')}"
          >
            {month.format('MMMM')}
          </button>
          
          <div class="month-grid">
            <!-- Weekday labels (only show on first month in row for desktop) -->
            <div class="weekday-labels">
              {#each weekdayLabels as label, i}
                <span class="weekday-label" class:hidden={i % 2 === 1}>{label}</span>
              {/each}
            </div>
            
            <!-- Days grid -->
            <div class="days-grid" data-version={dataVersion}>
              {#each monthWeeks as week}
                <div class="week-row">
                  {#each week as { date, isOutside }}
                    {@const dateStr = date.format('YYYY-MM-DD')}
                    {@const count = eventCountsMap.get(dateStr) ?? 0}
                    {@const heatLevel = getHeatLevel(count)}
                    {@const isToday = now && date.isSame(now, 'day')}
                    {@const displayDate = formatDateForDisplay(date, project) ?? date.format('MMM D, YYYY')}
                    <button
                      class="day-cell heat-{heatLevel}"
                      class:outside={isOutside}
                      class:today={isToday}
                      title="{displayDate}: {count} event{count !== 1 ? 's' : ''}"
                      on:click={() => handleDayClick(date)}
                      disabled={isOutside}
                    >
                      <span class="sr-only">{displayDate}: {count} events</span>
                    </button>
                  {/each}
                </div>
              {/each}
            </div>
          </div>
          
          <!-- Month summary -->
          <div class="month-summary">
            <span class="event-count">{getMonthEventCount(month, eventCountsMap)} {$i18n.t("views.calendar.heatmap.events")}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .year-heatmap {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    /* Let parent handle scroll - no overflow here */
    overflow: visible;
    /* Ensure proper sizing + MINIMUM HEIGHT to prevent black screen */
    width: 100%;
    min-height: 30rem;
    box-sizing: border-box;
    touch-action: pan-y; /* Allow vertical scroll, capture horizontal */
    /* v4.0.1: Explicit background to prevent black screen on mobile dark theme */
    background-color: var(--background-primary, #1e1e1e);
  }

  .year-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .year-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .nav-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem;
    border: none;
    background: var(--background-modifier-hover);
    border-radius: var(--radius-s);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .nav-button:hover {
    background: var(--background-modifier-active-hover);
    color: var(--text-normal);
  }
  
  .nav-button:active {
    transform: scale(0.95);
  }

  .year-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-normal);
    min-width: 4rem;
    text-align: center;
  }

  .year-legend {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .legend-scale {
    display: flex;
    gap: 2px;
  }

  .legend-cell {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 2px;
  }

  .months-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
    flex: 1;
  }
  
  /* Loading state */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 4rem 2rem;
    color: var(--text-muted);
  }
  
  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .loading-text {
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  
  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 4rem 2rem;
    color: var(--text-muted);
  }
  
  .empty-icon {
    opacity: 0.5;
  }
  
  .empty-text {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .month-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--background-secondary);
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
  }

  .month-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-normal);
    background: none;
    border: none;
    padding: 0.25rem 0.5rem;
    margin: -0.25rem -0.5rem;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.15s ease;
  }

  .month-name:hover {
    background: var(--background-modifier-hover);
  }

  .month-grid {
    display: flex;
    gap: 0.25rem;
  }

  .weekday-labels {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-right: 0.25rem;
  }

  .weekday-label {
    font-size: 0.625rem;
    color: var(--text-muted);
    height: 0.75rem;
    line-height: 0.75rem;
    text-align: center;
  }

  .weekday-label.hidden {
    visibility: hidden;
  }

  .days-grid {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .week-row {
    display: flex;
    gap: 2px;
  }

  .day-cell {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 2px;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: transform 0.1s ease, box-shadow 0.1s ease;
  }

  .day-cell:hover:not(:disabled) {
    transform: scale(1.2);
    box-shadow: 0 0 0 1px var(--text-accent);
  }

  .day-cell:disabled {
    cursor: default;
  }

  .day-cell.outside {
    opacity: 0;
    pointer-events: none;
  }

  .day-cell.today {
    box-shadow: 0 0 0 2px var(--text-accent);
  }

  /* Heat levels - GitHub-inspired colors */
  .heat-0 {
    background-color: var(--background-modifier-border);
  }

  .heat-1 {
    background-color: var(--color-green-dim, #9be9a8);
  }

  .heat-2 {
    background-color: var(--color-green, #40c463);
  }

  .heat-3 {
    background-color: var(--color-green-bright, #30a14e);
  }

  .heat-4 {
    background-color: var(--color-green-intense, #216e39);
  }

  /* Dark theme adjustments - use :global for body theme class */
  :global(.theme-dark) .heat-1 {
    background-color: #0e4429;
  }

  :global(.theme-dark) .heat-2 {
    background-color: #006d32;
  }

  :global(.theme-dark) .heat-3 {
    background-color: #26a641;
  }

  :global(.theme-dark) .heat-4 {
    background-color: #39d353;
  }

  .month-summary {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
    padding-top: 0.25rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Mobile layout - v8.0 FIT ENTIRE YEAR ON SCREEN */
  .year-heatmap.mobile {
    padding: 0.5rem;
    gap: 0.5rem;
    /* CRITICAL: Fit entire year on screen without scroll */
    height: 100%;
    max-height: 100%;
    overflow: hidden;
    /* v4.0.0: Allow Obsidian sidebar gestures - don't block touch */
    touch-action: pan-x pan-y;
  }
  
  .year-heatmap.mobile .year-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }
  
  .year-heatmap.mobile .year-nav {
    gap: 0.25rem;
  }
  
  .year-heatmap.mobile .year-title {
    font-size: 1rem;
    min-width: 3rem;
  }
  
  .year-heatmap.mobile .year-legend {
    font-size: 0.5rem;
    gap: 0.125rem;
  }
  
  .year-heatmap.mobile .legend-cell {
    width: 0.5rem;
    height: 0.5rem;
  }
  
  /* v8.0: 4x3 grid to fit 12 months on screen */
  .year-heatmap.mobile .months-grid {
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: 0.375rem;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  
  .year-heatmap.mobile .month-card {
    padding: 0.25rem;
    gap: 0.125rem;
    min-height: 0;
    overflow: hidden;
  }
  
  .year-heatmap.mobile .month-name {
    font-size: 0.5rem;
    padding: 0.125rem 0.25rem;
    margin: 0;
    min-height: 1.5rem;
    display: flex;
    align-items: center;
    /* Touch-friendly via invisible expansion */
    position: relative;
  }
  
  .year-heatmap.mobile .month-name::before {
    content: '';
    position: absolute;
    inset: -0.25rem;
  }
  
  /* v8.0: Ultra-compact cells to fit year */
  .year-heatmap.mobile .day-cell {
    /* Dynamic size: 7 cells per row fit in ~25% screen width minus padding */
    width: calc((100% - 12px) / 7);
    aspect-ratio: 1;
    max-width: 0.5rem;
    max-height: 0.5rem;
    min-width: 0.25rem;
    min-height: 0.25rem;
    /* Touch-friendly tap area via invisible expansion */
    position: relative;
  }
  
  .year-heatmap.mobile .day-cell::before {
    content: '';
    position: absolute;
    inset: -0.375rem;
    /* Ensure tap target is at least 2.75rem */
    min-width: 2rem;
    min-height: 2rem;
  }
  
  .year-heatmap.mobile .weekday-labels {
    display: none; /* Hide to save space on mobile */
  }
  
  .year-heatmap.mobile .month-summary {
    font-size: 0.5rem;
    padding-top: 0.125rem;
  }
  
  .year-heatmap.mobile .nav-button {
    padding: 0.375rem;
    min-width: 2.25rem;
    min-height: 2.25rem;
  }
  
  .year-heatmap.mobile .week-row {
    gap: 1px;
  }
  
  .year-heatmap.mobile .days-grid {
    gap: 1px;
  }
  
  .year-heatmap.mobile .month-grid {
    gap: 0;
  }

  /* Desktop media queries - NOT for mobile (mobile uses .mobile class) */
  @media (max-width: 56.25rem) { /* 900px at 16px base */
    .months-grid:not(.year-heatmap.mobile .months-grid) {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 37.5rem) { /* 600px at 16px base */
    .months-grid:not(.year-heatmap.mobile .months-grid) {
      grid-template-columns: repeat(2, 1fr);
    }

    .year-header:not(.year-heatmap.mobile .year-header) {
      flex-direction: row;
      align-items: center;
    }
  }
</style>
