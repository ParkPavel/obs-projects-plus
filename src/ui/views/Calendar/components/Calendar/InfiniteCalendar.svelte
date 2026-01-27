<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import dayjs from 'dayjs';
  import type { DataRecord } from 'src/lib/dataframe/dataframe';
  import type { ProcessedCalendarData } from '../../types';
  import type { CalendarInterval } from '../../calendar';
  import MonthBlock from './MonthBlock.svelte';
  import TwoWeeksBlock from './TwoWeeksBlock.svelte';
  import { settings } from 'src/lib/stores/settings';

  export let groupedRecords: Record<string, DataRecord[]>;
  export let processedData: ProcessedCalendarData | null = null;
  export let firstDayOfWeek: number;
  export let checkField: string | undefined;
  export let onRecordClick: ((record: DataRecord) => void) | undefined;
  export let onRecordChange: ((date: dayjs.Dayjs, record: DataRecord) => void) | undefined;
  export let onRecordCheck: ((record: DataRecord, checked: boolean) => void) | undefined;
  export let onRecordAdd: ((date: dayjs.Dayjs) => void) | undefined;
  export let onDayTap: ((date: dayjs.Dayjs, records: DataRecord[], event?: MouseEvent | TouchEvent) => void) | undefined;
  export let onScrollToCurrent: ((callback: () => void) => void) | undefined;
  export let onScrollToDate: ((callback: (date: dayjs.Dayjs) => void) => void) | undefined;
  export let targetDate: dayjs.Dayjs | null = null;
  /** Position to scroll to when navigating: 'start', 'center', 'end' */
  export let scrollPosition: 'start' | 'center' | 'end' = 'center';
  /** Whether this view is currently active/visible */
  export let isActive: boolean = false;
  export let isMobile: boolean = false;
  export let dateFieldName: string | undefined;
  export let endDateFieldName: string | undefined;
  export let timezone: string = "local";
  /** Display mode for day cells: 'list' (default) or 'bars' (relative time bars) */
  export let displayMode: 'list' | 'bars' = 'list';
  /** Start hour for time bars (0-23), default 7 */
  export let startHour: number = 7;
  /** End hour for time bars (0-23), default 21 */
  export let endHour: number = 21;
  /** Calendar interval - 'month' or '2weeks' */
  export let interval: CalendarInterval = 'month';

  // Derived: is 2weeks mode
  $: is2WeeksMode = interval === '2weeks';
  
  // Track interval and targetDate changes together to prevent double initialization
  let lastInterval: CalendarInterval | null = null;
  let lastTargetDate: string | null = null;
  let isInitializing = false;
  let reattachTimeout: number | null = null;
  
  // Debounced reattach helper to prevent 3x redundant calls
  const debouncedReattach = () => {
    if (reattachTimeout !== null) {
      clearTimeout(reattachTimeout);
    }
    reattachTimeout = window.setTimeout(() => {
      // v7.5: Always try to re-find scrollable parent when view becomes visible
      const newParent = findScrollableParent();
      if (newParent && newParent !== scrollableParent) {
        // Detach from old parent if exists
        if (scrollableParent) {
          scrollableParent.removeEventListener('scroll', handleScroll);
        }
        scrollableParent = newParent;
        scrollableParent.addEventListener('scroll', handleScroll, { passive: true });
        // Trigger initial check after reattachment
        requestAnimationFrame(() => {
          checkAndLoadMore();
        });
      } else if (!scrollableParent && newParent) {
        scrollableParent = newParent;
        scrollableParent.addEventListener('scroll', handleScroll, { passive: true });
        requestAnimationFrame(() => {
          checkAndLoadMore();
        });
      }
      reattachTimeout = null;
    }, 150); // 150ms debounce
  };
  
  // Track previous isActive state - initialize to same as isActive so first change is detected
  let wasActive = isActive;
  
  // Combined reactive handler for interval, targetDate, and isActive changes
  $: {
    const intervalChanged = interval !== lastInterval && lastInterval !== null;
    const targetDateChanged = targetDate && targetDate.format('YYYY-MM-DD') !== lastTargetDate;
    const becameActive = isActive && !wasActive;
    
    // Update wasActive tracking
    if (isActive !== wasActive) {
      wasActive = isActive;
    }
    
    // Trigger navigation when:
    // 1. View becomes active (whether targetDate is set or not)
    // 2. Interval changes while active
    // 3. targetDate changes while active
    const shouldNavigate = (becameActive || (intervalChanged && isActive) || (targetDateChanged && isActive)) && !isInitializing;
    
    if (shouldNavigate) {
      isInitializing = true;
      lastInterval = interval;
      if (targetDate) {
        lastTargetDate = targetDate.format('YYYY-MM-DD');
      }
      
      // Wait for CSS display:block to take effect
      requestAnimationFrame(() => {
        debouncedReattach();
        
        // Give DOM time to update visibility and reattach scroll parent
        setTimeout(() => {
          const parent = scrollableParent || findScrollableParent();
          
          if (parent || container) {
            // CRITICAL: Always reinitialize units when navigation is triggered
            if (targetDate) {
              initializeUnitsAroundDate(targetDate);
            } else {
              initializeUnits();
            }
            
            // Wait for units to render using Svelte tick() + increased timeout
            tick().then(() => {
              setTimeout(async () => {
                if (targetDate) {
                  scrollToDate(targetDate!, scrollPosition);
                } else {
                  scrollToCurrent();
                }
                isInitializing = false;
              }, 300); // Increased from 100ms to 300ms to ensure DOM render
            });
          } else {
            isInitializing = false;
          }
        }, 100);
      });
    }
  }
  
  let container: HTMLDivElement | null = null;
  let scrollableParent: HTMLElement | null = null;

  const INITIAL_BUFFER = 5; // v7.5: Increased buffer for better viewport coverage
  const LOAD_THRESHOLD = 2; // units from edge to trigger load
  const LOAD_BATCH = 3; // units to add at once
  
  // Universal: units are either months or 2-week periods
  let units: dayjs.Dayjs[] = [];
  let unitElements: (HTMLElement | null)[] = [];
  let isLoadingPrev = false;
  let isLoadingNext = false;
  let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Get the unit start date from any date
   * - For months: start of month
   * - For 2weeks: start of the 2-week period (aligned to firstDayOfWeek)
   */
  function getUnitStart(date: dayjs.Dayjs): dayjs.Dayjs {
    if (is2WeeksMode) {
      // Align to first day of week
      const weekday = date.day();
      const diff = (weekday - firstDayOfWeek + 7) % 7;
      return date.subtract(diff, 'day').startOf('day');
    }
    return date.startOf('month');
  }
  
  /**
   * Add units (months or 2-week periods) to a date
   */
  function addUnits(date: dayjs.Dayjs, count: number): dayjs.Dayjs {
    if (is2WeeksMode) {
      return date.add(count * 14, 'day');
    }
    return date.add(count, 'month');
  }
  
  /**
   * Subtract units from a date
   */
  function subtractUnits(date: dayjs.Dayjs, count: number): dayjs.Dayjs {
    if (is2WeeksMode) {
      return date.subtract(count * 14, 'day');
    }
    return date.subtract(count, 'month');
  }

  function initializeUnits() {
    const now = getUnitStart(dayjs());
    units = [];
    
    // Start from INITIAL_BUFFER units BEFORE current
    const startUnit = subtractUnits(now, INITIAL_BUFFER);
    
    for (let i = 0; i < INITIAL_BUFFER * 2 + 1; i++) {
      units.push(addUnits(startUnit, i));
    }
  }

  function findScrollableParent(): HTMLElement | null {
    if (!container) return null;
    
    let el = container.parentElement;
    while (el) {
      const style = window.getComputedStyle(el);
      // Check both overflow and overflow-y (shorthand and specific)
      const overflowY = style.overflowY;
      const overflow = style.overflow;
      if (overflowY === 'auto' || overflowY === 'scroll' || overflow === 'auto' || overflow === 'scroll') {
        // v4.0.0: Don't require scrollHeight > clientHeight at this moment
        // Content may not be rendered yet, but parent IS scrollable
        return el;
      }
      el = el.parentElement;
    }
    // Fallback: try the container's direct parent
    if (container.parentElement) {
      const style = window.getComputedStyle(container.parentElement);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll' || 
          style.overflow === 'auto' || style.overflow === 'scroll') {
        return container.parentElement;
      }
    }
    return null;
  }
  
  /**
   * Ensure scrollableParent is valid, re-find if needed
   */
  function ensureScrollableParent(): HTMLElement | null {
    if (scrollableParent && document.contains(scrollableParent)) {
      return scrollableParent;
    }
    scrollableParent = findScrollableParent();
    if (scrollableParent) {
      scrollableParent.addEventListener('scroll', handleScroll, { passive: true });
    }
    return scrollableParent;
  }

  function getCurrentUnitIndex(): number {
    if (!container) return -1;
    
    // Find the first unit that is visible in the viewport
    // We use a simple heuristic: the first unit whose bottom is below the top of the viewport
    // (or parent container top) is the current one.
    
    const parentRect = scrollableParent?.getBoundingClientRect();
    const parentTop = parentRect?.top ?? 0;
    
    for (let i = 0; i < units.length; i++) {
      const el = unitElements[i];
      if (el) {
        const rect = el.getBoundingClientRect();
        // If the bottom of the element is significantly below the top of the parent
        // it means this element is occupying the top space
        if (rect.bottom > parentTop + 50) {
          return i;
        }
      }
    }
    return units.length - 1;
  }

  function prependUnits() {
    if (isLoadingPrev || !units[0]) return;
    isLoadingPrev = true;
    
    const oldScrollHeight = scrollableParent?.scrollHeight ?? 0;
    const oldScrollTop = scrollableParent?.scrollTop ?? 0;
    
    const newUnits: dayjs.Dayjs[] = [];
    let current = units[0];
    
    for (let i = 0; i < LOAD_BATCH; i++) {
      current = subtractUnits(current, 1);
      newUnits.unshift(current);
    }
    
    units = [...newUnits, ...units];
    
    // Maintain scroll position after DOM update
    requestAnimationFrame(() => {
      if (scrollableParent) {
        const newScrollHeight = scrollableParent.scrollHeight;
        const heightDiff = newScrollHeight - oldScrollHeight;
        scrollableParent.scrollTop = oldScrollTop + heightDiff;
      }
      isLoadingPrev = false;
    });
  }

  function appendUnits() {
    if (isLoadingNext || !units[units.length - 1]) return;
    isLoadingNext = true;
    
    const newUnits: dayjs.Dayjs[] = [];
    let current: dayjs.Dayjs | undefined = units[units.length - 1];
    
    for (let i = 0; i < LOAD_BATCH; i++) {
      if (current) {
        current = addUnits(current, 1);
        newUnits.push(current);
      }
    }
    
    units = [...units, ...newUnits];
    
    requestAnimationFrame(() => {
      isLoadingNext = false;
    });
  }

  function handleScroll() {
    if (!scrollableParent || !container) return;
    
    // Debounce scroll handling
    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer);
    }
    
    scrollDebounceTimer = setTimeout(() => {
      checkAndLoadMore();
    }, 50);
  }

  function checkAndLoadMore() {
    // Ensure scrollable parent exists and is valid
    if (!scrollableParent || !document.contains(scrollableParent)) {
      scrollableParent = findScrollableParent();
      if (!scrollableParent) return; // Still not found, abort
      // Re-attach scroll listener
      scrollableParent.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    const currentIndex = getCurrentUnitIndex();
    
    // v4.0.1: Additional scroll position checks for mobile reliability
    const scrollTop = scrollableParent?.scrollTop ?? 0;
    const scrollHeight = scrollableParent?.scrollHeight ?? 0;
    const clientHeight = scrollableParent?.clientHeight ?? 0;
    
    // v7.5: Skip if no scrollable content yet (prevents infinite append loop)
    if (scrollHeight <= clientHeight) {
      // Content doesn't overflow yet - check if we need more initial content
      if (units.length < INITIAL_BUFFER * 2 + 3 && !isLoadingNext) {
        appendUnits();
      }
      return;
    }
    
    // Near top: scrollTop < 500px
    const nearTop = scrollTop < 500;
    // Near bottom: scrollTop + clientHeight > scrollHeight - 500px
    const nearBottom = scrollTop + clientHeight > scrollHeight - 500;
    
    // Check if near the top - load earlier units
    if ((currentIndex <= LOAD_THRESHOLD || nearTop) && !isLoadingPrev) {
      prependUnits();
    }
    
    // Check if near the bottom - load later units
    if ((currentIndex >= units.length - LOAD_THRESHOLD - 1 || nearBottom) && !isLoadingNext) {
      appendUnits();
    }
  }

  // Helper for NavigableCalendar interface
  export function getScrollableParent(): HTMLElement | null {
    return scrollableParent;
  }

  // Helper for NavigableCalendar interface
  export function findElementForDate(date: dayjs.Dayjs): HTMLElement | null {
    const unitDate = getUnitStart(date);
    const index = units.findIndex(u => u.isSame(unitDate, interval === '2weeks' ? 'day' : 'month'));
    if (index >= 0) {
      return unitElements[index] || null;
    }
    return null;
  }

  function scrollToCurrent() {
    scrollToDate(dayjs(), 'center');
  }
  
  /**
   * Прокрутить к дате с заданной позицией
   * @param date - Целевая дата
   * @param position - Позиция в viewport: 'start', 'center', 'end'
   */
  export function scrollToDate(date: dayjs.Dayjs, position: 'start' | 'center' | 'end' = 'start') {
    const targetUnit = getUnitStart(date);
    
    // Ensure we have a valid scrollable parent
    const parent = ensureScrollableParent();
    
    if (!parent || !container) {
      // Retry after mount
      setTimeout(() => scrollToDate(date, position), 100);
      return;
    }
    
    // Find the index of the target unit
    const targetUnitIndex = units.findIndex(u => {
      if (is2WeeksMode) {
        // For 2-weeks, check if the date falls within this 2-week period
        const unitEnd = u.add(13, 'day');
        return date.isSameOrAfter(u, 'day') && date.isSameOrBefore(unitEnd, 'day');
      }
      return u.isSame(targetUnit, 'month');
    });
    
    if (targetUnitIndex === -1) {
      // Target unit not in range - reinitialize around target
      initializeUnitsAroundDate(date);
      requestAnimationFrame(() => scrollToDate(date, position));
      return;
    }
    
    requestAnimationFrame(() => {
      const targetElement = unitElements[targetUnitIndex];
      if (!targetElement || !scrollableParent) return;
      
      // Get animation behavior from settings
      const behavior = $settings.preferences.animationBehavior === 'instant' ? 'auto' : 'smooth';
      
      // Реализация позиционирования
      if (position === 'center') {
        // Use scrollIntoView with block: 'center' for reliable centering
        targetElement.scrollIntoView({ behavior, block: 'center' });
      } else if (position === 'end') {
        targetElement.scrollIntoView({ behavior, block: 'end' });
      } else {
        // position === 'start' (default behavior)
        targetElement.scrollIntoView({ behavior, block: 'start' });
      }
    });
  }
  
  function initializeUnitsAroundDate(date: dayjs.Dayjs) {
    const targetUnit = getUnitStart(date);
    units = [];
    
    // Start from INITIAL_BUFFER units BEFORE target
    const startUnit = subtractUnits(targetUnit, INITIAL_BUFFER);
    
    for (let i = 0; i < INITIAL_BUFFER * 2 + 1; i++) {
      units.push(addUnits(startUnit, i));
    }
  }

  onMount(() => {
    // Track initial interval to detect changes
    lastInterval = interval;
    
    // DO NOT initialize units here - let reactive statement handle it
    // This prevents initializing with wrong date (today) before targetDate is set
    
    // Find and attach to scrollable parent with retry logic
    const attachScrollHandler = (retryCount = 0) => {
      scrollableParent = findScrollableParent();
      
      if (scrollableParent) {
        scrollableParent.addEventListener('scroll', handleScroll, { passive: true });
      } else if (retryCount < 10) {
        // v7.5: Increased retry count and use exponential backoff
        setTimeout(() => attachScrollHandler(retryCount + 1), 100 * Math.min(retryCount + 1, 5));
      }
    };
    
    // Use requestAnimationFrame to ensure DOM is painted
    requestAnimationFrame(() => {
      attachScrollHandler();
    });
    
    // Register the scroll callback with parent
    if (onScrollToCurrent) {
      onScrollToCurrent(() => {
        // Ensure scrollable parent is still valid
        if (!scrollableParent || !document.contains(scrollableParent)) {
          scrollableParent = findScrollableParent();
          if (scrollableParent) {
            scrollableParent.addEventListener('scroll', handleScroll, { passive: true });
          }
        }
        setTimeout(() => scrollToCurrent(), 50);
      });
    }
    
    if (onScrollToDate) {
      onScrollToDate((date: dayjs.Dayjs) => {
        setTimeout(() => scrollToDate(date, 'center'), 50);
      });
    }
  });

  onDestroy(() => {
    if (scrollableParent) {
      scrollableParent.removeEventListener('scroll', handleScroll);
    }
    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer);
    }
  });
</script>

<div class="infinite-calendar" bind:this={container}>
  {#each units as unit, index (unit.format('YYYY-MM-DD'))}
    <div bind:this={unitElements[index]} class="unit-wrapper">
      {#if is2WeeksMode}
        <TwoWeeksBlock
          startDate={unit}
          {firstDayOfWeek}
          {groupedRecords}
          {processedData}
          {checkField}
          {onRecordClick}
          {onRecordChange}
          {onRecordCheck}
          {onRecordAdd}
          {onDayTap}
          {isMobile}
          {dateFieldName}
          endDateFieldName={endDateFieldName}
          {timezone}
          {displayMode}
          {startHour}
          {endHour}
        />
      {:else}
        <MonthBlock
          month={unit}
          {firstDayOfWeek}
          {groupedRecords}
          {processedData}
          {checkField}
          {onRecordClick}
          {onRecordChange}
          {onRecordCheck}
          {onRecordAdd}
          {onDayTap}
          {isMobile}
          {dateFieldName}
          endDateFieldName={endDateFieldName}
          {timezone}
          {displayMode}
          {startHour}
          {endHour}
        />
      {/if}
    </div>
  {/each}
  
  {#if isLoadingPrev}
    <div class="loading-indicator top">
      <span class="loading-dot"></span>
    </div>
  {/if}
  
  {#if isLoadingNext}
    <div class="loading-indicator bottom">
      <span class="loading-dot"></span>
    </div>
  {/if}
</div>

<style>
  .infinite-calendar {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    scroll-behavior: smooth;
  }

  .unit-wrapper {
    flex-shrink: 0;
    animation: unitFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes unitFadeIn {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .loading-indicator.top {
    order: -1;
  }

  .loading-dot {
    width: 0.5rem;
    height: 0.5rem;
    background: var(--interactive-accent);
    border-radius: 50%;
    animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(0.8);
    }
  }
</style>