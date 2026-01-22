<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import dayjs from 'dayjs';
  import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
  import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
  import type { DataRecord } from 'src/lib/dataframe/dataframe';
  import type { ProcessedCalendarData } from '../../types';
  import { EventRenderType } from '../../types';
  import { i18n } from "src/lib/stores/i18n";
  import Day from './Day.svelte';
  import Week from './Week.svelte';
  import WeekHeader from './WeekHeader.svelte';
  import Weekday from './Weekday.svelte';
  import TimelineView from './TimelineView.svelte';
  import EventTimeline from './EventTimeline.svelte';
  import HeaderStripsSection from './HeaderStripsSection.svelte';
  import type { CalendarInterval } from '../../calendar';
  import { INFINITE_SCROLL, GESTURE, TIMING } from '../../constants';
  import { calendarLogger } from '../../logger';

  dayjs.extend(isSameOrAfter);
  dayjs.extend(isSameOrBefore);

  export let groupedRecords: Record<string, DataRecord[]>;
  export let processedData: ProcessedCalendarData | null = null;
  export let dataVersion: number = 0;
  export let firstDayOfWeek: number;
  export let interval: CalendarInterval;
  export let checkField: string | undefined;
  export let onRecordClick: ((record: DataRecord) => void) | undefined;
  export let onRecordChange: ((date: dayjs.Dayjs, record: DataRecord) => void) | undefined;
  export let onRecordCheck: ((record: DataRecord, checked: boolean) => void) | undefined;
  export let onRecordAdd: ((date: dayjs.Dayjs) => void) | undefined;
  export let onDayTap: ((date: dayjs.Dayjs, records: DataRecord[], event?: MouseEvent | TouchEvent) => void) | undefined;
  export let onScrollToCurrent: ((callback: () => void) => void) | undefined;
  export let onScrollToDate: ((callback: (date: dayjs.Dayjs) => void) => void) | undefined;
  export let targetDate: dayjs.Dayjs | null = null;
  /** Whether this view is currently active/visible */
  export let isActive: boolean = false;
  export let isMobile: boolean = false;
  export let now: dayjs.Dayjs | null = null;
  export let timeFormat: string = "24h";
  export let dateFieldName: string | undefined;
  export let endDateFieldName: string | undefined;
  export let timezone: string = "local";
  export let displayMode: 'headers' | 'bars' = 'headers';
  export let startHour: number = 6;
  export let endHour: number = 22;

  // Timeline view is available for day and week (not 2weeks or month)
  $: showTimeline = interval === 'day' || interval === 'week';
  $: useTimelineView = showTimeline && displayMode === 'bars';
  
  // v8.1.2: Calculate AllDay section height for sticky axis sync
  // MUST match TimelineView's STRIP_HEIGHT_REM exactly for alignment
  // Responsive: desktop uses 1.25rem, mobile uses 1.125rem
  const STRIP_HEIGHT_DESKTOP = 1.25;
  const STRIP_HEIGHT_MOBILE = 1.125;
  const STRIP_GAP_REM = 0.125;
  $: STRIP_HEIGHT_REM = isMobile ? STRIP_HEIGHT_MOBILE : STRIP_HEIGHT_DESKTOP;
  const DAY_HEADER_HEIGHT_REM = 3.75;
  
  /**
   * Calculate max lane from all processed events for AllDay section height
   * v8.3.1: Accept stripHeight as parameter to avoid closure issues with reactive vars
   */
  function calculateAllDayHeight(stripHeight: number): number {
    if (!processedData?.grouped) return 0;
    
    let maxLane = -1;
    let eventCount = 0;
    for (const dateStr in processedData.grouped) {
      const records = processedData.grouped[dateStr];
      if (!records) continue;
      for (const record of records) {
        if (
          record.renderType === EventRenderType.ALL_DAY ||
          record.renderType === EventRenderType.MULTI_DAY_ALLDAY ||
          record.renderType === EventRenderType.MULTI_DAY_TIMED
        ) {
          eventCount++;
          if (record.lane !== undefined && record.lane > maxLane) {
            maxLane = record.lane;
          }
        }
      }
    }
    
    if (maxLane < 0) return 0;
    // v8.3.1: Use passed stripHeight, not closure variable
    return (maxLane + 1) * stripHeight + maxLane * STRIP_GAP_REM;
  }
  
  // v8.3.1: Calculate AllDay height - recalculates when STRIP_HEIGHT_REM changes (mobile toggle)
  let allDayHeight = 0;
  $: {
    // Explicit dependencies: useTimelineView, processedData, STRIP_HEIGHT_REM
    if (useTimelineView && processedData?.grouped) {
      allDayHeight = calculateAllDayHeight(STRIP_HEIGHT_REM);
    } else {
      allDayHeight = 0;
    }
  }
  
  // v7.1: Data fingerprint for reactivity tracking
  // This changes when any record is added, removed, or modified (including time changes)
  $: dataFingerprint = (() => {
    if (!processedData?.grouped) return '';
    let fp = '';
    for (const dateStr of Object.keys(processedData.grouped).sort()) {
      const records = processedData.grouped[dateStr] || [];
      for (const r of records) {
        // Include record id, time info, and render type in fingerprint
        fp += r.record.id + '|';
        fp += (r.timeInfo?.startTime?.valueOf() ?? 0) + '|';
        fp += (r.timeInfo?.endTime?.valueOf() ?? 0) + '|';
        fp += r.renderType + '|';
      }
    }
    return fp;
  })();
  
  // v7.1: Reactive grouped records with new object reference when data changes
  // This forces child components to re-render even with keyed {#each}
  $: processedGroupedRecords = (() => {
    dataFingerprint; // Force re-evaluation when fingerprint changes
    const grouped = processedData?.grouped;
    return grouped ? { ...grouped } : {};
  })();
  
  // v6.5: Get current visible month from active period
  $: currentVisibleMonth = periods[currentPeriodIndex]?.startDate?.format('MMM').toUpperCase() ?? '';
  
  // Track state for change detection
  let lastInterval: CalendarInterval | null = null;
  let lastTargetDate: string | null = null;
  let lastIsActive: boolean = false;
  let isInitializing = false;
  
  // Simple reactive handler - detect ANY relevant change and navigate
  $: {
    const targetDateStr = targetDate?.format('YYYY-MM-DD') ?? null;
    
    // Detect changes
    const becameActive = isActive && !lastIsActive;
    const intervalChanged = interval !== lastInterval;
    const targetDateChanged = targetDateStr !== lastTargetDate;
    
    // Should we navigate? Only if:
    // - We're active AND
    // - Something changed (became active, interval changed, or target date changed)
    // - NOT currently initializing
    const hasChange = becameActive || (isActive && intervalChanged) || (isActive && targetDateChanged && targetDateStr !== null);
    
    if (hasChange && !isInitializing && container) {
      isInitializing = true;
      
      // Use targetDate if available, otherwise current date
      const dateToUse = targetDate || dayjs();
      
      // Execute navigation
      initializePeriodsAroundDate(dateToUse);
      setTimeout(() => {
        scrollToDate(dateToUse);
        isInitializing = false;
      }, 100);
    }
    
    // Always update tracking state at the end
    lastIsActive = isActive;
    lastInterval = interval;
    lastTargetDate = targetDateStr;
  }

  let container: HTMLDivElement | null = null;
  let wrapperElement: HTMLDivElement | null = null;
  
  // Using centralized constants from constants.ts (cast to number for flexibility)
  const INITIAL_BUFFER: number = INFINITE_SCROLL.INITIAL_BUFFER;
  const LOAD_THRESHOLD: number = INFINITE_SCROLL.LOAD_THRESHOLD;
  const LOAD_BATCH: number = INFINITE_SCROLL.LOAD_BATCH;
  
  // Mobile touch gesture handling (using centralized constants)
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartScrollLeft = 0;
  let isTouchScrolling = false;
  let isEdgeSwipe = false; // If true, let Obsidian handle the gesture
  
  // Each "period" is a set of dates based on the interval
  type Period = {
    id: string;
    startDate: dayjs.Dayjs;
    dates: dayjs.Dayjs[];
    weeks: dayjs.Dayjs[][];
    weekDays: dayjs.Dayjs[];
  };
  
  let periods: Period[] = [];
  let periodElements: (HTMLElement | null)[] = [];
  let isLoadingPrev = false;
  let isLoadingNext = false;
  let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let currentPeriodIndex = INITIAL_BUFFER;

  function getDaysInPeriod(baseDate: dayjs.Dayjs): number {
    switch (interval) {
      case 'day': return 1;
      case 'week': return 7;
      case '2weeks': return 14;
      default: return 7;
    }
  }

  function getPeriodStep(): { unit: dayjs.ManipulateType; amount: number } {
    switch (interval) {
      case 'day': return { unit: 'day', amount: 1 };
      case 'week': return { unit: 'week', amount: 1 };
      case '2weeks': return { unit: 'week', amount: 2 };
      default: return { unit: 'week', amount: 1 };
    }
  }

  function startOfWeek(date: dayjs.Dayjs): dayjs.Dayjs {
    const day = date.day();
    const diff = (day - firstDayOfWeek + 7) % 7;
    return date.subtract(diff, 'day').startOf('day');
  }

  function createPeriod(baseDate: dayjs.Dayjs): Period {
    const daysCount = getDaysInPeriod(baseDate);
    const dates: dayjs.Dayjs[] = [];
    
    let startDate: dayjs.Dayjs;
    
    if (interval === 'week' || interval === '2weeks') {
      startDate = startOfWeek(baseDate);
    } else {
      startDate = baseDate.startOf('day');
    }
    
    for (let i = 0; i < daysCount; i++) {
      dates.push(startDate.add(i, 'day'));
    }
    
    // Group dates into weeks (rows)
    const weeks: dayjs.Dayjs[][] = [];
    if (interval === '2weeks') {
      weeks.push(dates.slice(0, 7));
      weeks.push(dates.slice(7, 14));
    } else {
      weeks.push(dates);
    }
    
    // Weekday headers
    const weekDays = dates.slice(0, interval === '2weeks' ? 7 : daysCount);
    
    return {
      id: startDate.format('YYYY-MM-DD'),
      startDate,
      dates,
      weeks,
      weekDays
    };
  }

  async function prependPeriods() {
    if (isLoadingPrev || periods.length === 0) return;
    isLoadingPrev = true;
    
    const step = getPeriodStep();
    const firstPeriod = periods[0];
    if (!firstPeriod) {
      isLoadingPrev = false;
      return;
    }
    const newPeriods: Period[] = [];
    
    for (let i = LOAD_BATCH; i >= 1; i--) {
      let baseDate: dayjs.Dayjs;
      if (step.unit === 'week') {
        baseDate = firstPeriod.startDate.subtract(i * step.amount, 'week');
      } else {
        baseDate = firstPeriod.startDate.subtract(i * step.amount, 'day');
      }
      newPeriods.push(createPeriod(baseDate));
    }
    
    const oldScrollLeft = container?.scrollLeft ?? 0;
    
    periods = [...newPeriods, ...periods];
    currentPeriodIndex += LOAD_BATCH;
    
    await tick();

    if (container) {
      // Maintain scroll position using the new width of elements
      // This handles cases where scrollbars appear/disappear changing the width
      const firstEl = periodElements[0];
      const newWidth = firstEl?.offsetWidth ?? 0;
      const addedWidth = LOAD_BATCH * newWidth;
      container.scrollLeft = oldScrollLeft + addedWidth;
    }
    isLoadingPrev = false;
  }

  function appendPeriods() {
    if (isLoadingNext || periods.length === 0) return;
    isLoadingNext = true;
    
    const step = getPeriodStep();
    const lastPeriod = periods[periods.length - 1];
    if (!lastPeriod) {
      isLoadingNext = false;
      return;
    }
    const newPeriods: Period[] = [];
    
    for (let i = 1; i <= LOAD_BATCH; i++) {
      let baseDate: dayjs.Dayjs;
      if (step.unit === 'week') {
        baseDate = lastPeriod.startDate.add((i) * step.amount, 'week');
      } else {
        baseDate = lastPeriod.startDate.add(i * step.amount, 'day');
      }
      newPeriods.push(createPeriod(baseDate));
    }
    
    periods = [...periods, ...newPeriods];
    
    requestAnimationFrame(() => {
      isLoadingNext = false;
    });
  }

  function getCurrentPeriodIndex(): number {
    if (!container) return currentPeriodIndex;
    
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    let accumulatedWidth = 0;
    
    for (let i = 0; i < periods.length; i++) {
      const el = periodElements[i];
      const width = el?.offsetWidth ?? containerWidth;
      if (accumulatedWidth + width > scrollLeft + containerWidth / 2) {
        return i;
      }
      accumulatedWidth += width;
    }
    return periods.length - 1;
  }

  function handleScroll() {
    if (!container) return;
    
    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer);
    }
    
    // Cancel any pending snap during active scroll
    if (snapTimer) {
      clearTimeout(snapTimer);
      snapTimer = null;
    }
    
    scrollDebounceTimer = setTimeout(() => {
      checkAndLoadMore();
      // Schedule snap after scroll settles
      if (!isSnapping) {
        scheduleSnap();
      }
    }, 50);
  }

  function checkAndLoadMore() {
    if (!container) return;
    
    const idx = getCurrentPeriodIndex();
    currentPeriodIndex = idx;
    
    // v4.0.1: Additional scroll position checks for mobile reliability
    const scrollLeft = container?.scrollLeft ?? 0;
    const scrollWidth = container?.scrollWidth ?? 0;
    const clientWidth = container?.clientWidth ?? 0;
    
    // Near left edge: scrollLeft < 500px
    const nearLeft = scrollLeft < 500;
    // Near right edge: scrollLeft + clientWidth > scrollWidth - 500px
    const nearRight = scrollLeft + clientWidth > scrollWidth - 500;
    
    // Load more at edges
    if ((idx <= LOAD_THRESHOLD || nearLeft) && !isLoadingPrev) {
      prependPeriods();
    }
    
    if ((idx >= periods.length - LOAD_THRESHOLD - 1 || nearRight) && !isLoadingNext) {
      appendPeriods();
    }
  }

  function scrollToCurrent() {
    scrollToDate(dayjs());
  }
  
  // Track scroll attempts to prevent infinite recursion
  let scrollAttempts = 0;
  
  /**
   * Custom smooth scroll with easing function
   * Uses requestAnimationFrame for frame-perfect animation
   * Easing: ease-out cubic (smooth deceleration)
   */
  function smoothScrollTo(element: HTMLElement, targetLeft: number, duration: number = 400) {
    const startLeft = element.scrollLeft;
    const deltaLeft = targetLeft - startLeft;
    const startTime = performance.now();
    
    // Easing function: ease-out cubic (smoother deceleration)
    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };
    
    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      
      element.scrollLeft = startLeft + deltaLeft * easedProgress;
      
      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };
    
    requestAnimationFrame(animateScroll);
  }
  
  // Helper for NavigableCalendar interface
  export function getScrollableParent(): HTMLElement | null {
    return container;
  }

  // Helper for NavigableCalendar interface
  export function findElementForDate(date: dayjs.Dayjs): HTMLElement | null {
    return null; // Simplified implementation
  }

  export function scrollToDate(date: dayjs.Dayjs, position: 'start' | 'center' | 'end' = 'center') {
    if (!container) {
      if (scrollAttempts < TIMING.MAX_SCROLL_ATTEMPTS) {
        scrollAttempts++;
        setTimeout(() => scrollToDate(date), TIMING.SCROLL_RETRY_DELAY * 2);
      } else {
        calendarLogger.warn('scrollToDate: max attempts reached, container not available', { component: 'InfiniteHorizontalCalendar' });
        scrollAttempts = 0;
      }
      return;
    }
    
    const targetDay = date.startOf('day');
    
    // Find the period containing the target date
    const periodIndex = periods.findIndex(p => {
      const endDate = p.dates[p.dates.length - 1];
      return targetDay.isSameOrAfter(p.startDate, 'day') && targetDay.isSameOrBefore(endDate, 'day');
    });
    
    if (periodIndex === -1) {
      // Target date not in range - reinitialize around target date
      if (scrollAttempts < TIMING.MAX_SCROLL_ATTEMPTS) {
        scrollAttempts++;
        initializePeriodsAroundDate(date);
        requestAnimationFrame(() => scrollToDate(date));
      } else {
        calendarLogger.warn('scrollToDate: max attempts reached, period not found', { component: 'InfiniteHorizontalCalendar', data: { date: date.format('YYYY-MM-DD') } });
        scrollAttempts = 0;
      }
      return;
    }
    
    // Reset attempts on success
    scrollAttempts = 0;
    
    requestAnimationFrame(() => {
      const targetEl = periodElements[periodIndex];
      if (targetEl && container) {
        const scrollLeft = targetEl.offsetLeft - (container.clientWidth - targetEl.offsetWidth) / 2;
        // Use custom smooth scroll with easing instead of native behavior:'smooth'
        smoothScrollTo(container, Math.max(0, scrollLeft), 400);
      }
    });
  }
  
  function initializePeriodsAroundDate(date: dayjs.Dayjs) {
    const targetDay = date.startOf('day');
    periods = [];
    
    const step = getPeriodStep();
    
    // Create periods centered around the target date
    for (let i = -INITIAL_BUFFER; i <= INITIAL_BUFFER; i++) {
      let baseDate: dayjs.Dayjs;
      if (step.unit === 'week') {
        baseDate = startOfWeek(targetDay).add(i * step.amount, 'week');
      } else {
        baseDate = targetDay.add(i * step.amount, 'day');
      }
      periods.push(createPeriod(baseDate));
    }
    
    currentPeriodIndex = INITIAL_BUFFER;
  }

  /**
   * Handle navigation event from TimelineView
   * Alt+wheel triggers prev/next period navigation
   */
  function handleTimelineNavigate(event: CustomEvent<'prev' | 'next'>) {
    if (!container) return;
    
    const direction = event.detail;
    const periodWidth = container.querySelector('.period-container')?.clientWidth ?? container.clientWidth;
    
    // Scroll to prev/next period
    container.scrollBy({
      left: direction === 'next' ? periodWidth : -periodWidth,
      behavior: 'smooth'
    });
  }

  // Convert vertical scroll (wheel) to horizontal scroll
  // Alt+wheel: navigate between periods (dates)
  // Normal wheel: vertical scroll (time navigation) when in timeline mode
  function handleWheel(event: WheelEvent) {
    if (!container) return;
    
    // Don't handle Ctrl+wheel - let it bubble up for zoom handling
    if (event.ctrlKey || event.metaKey) return;
    
    // Alt+wheel: Navigate between periods (horizontal date navigation)
    if (event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      
      const periodWidth = container.querySelector('.period-container')?.clientWidth ?? container.clientWidth;
      
      if (event.deltaY > 0 || event.deltaX > 0) {
        // Scroll to next period
        container.scrollBy({
          left: periodWidth,
          behavior: 'smooth'
        });
      } else if (event.deltaY < 0 || event.deltaX < 0) {
        // Scroll to previous period
        container.scrollBy({
          left: -periodWidth,
          behavior: 'smooth'
        });
      }
      
      requestAnimationFrame(() => handleScroll());
      return;
    }
    
    // Shift+wheel: Also horizontal navigation (for mice without Alt)
    if (event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      event.stopPropagation();
      
      const periodWidth = container.querySelector('.period-container')?.clientWidth ?? container.clientWidth;
      
      if (event.deltaY > 0) {
        container.scrollBy({
          left: periodWidth,
          behavior: 'smooth'
        });
      } else {
        container.scrollBy({
          left: -periodWidth,
          behavior: 'smooth'
        });
      }
      
      requestAnimationFrame(() => handleScroll());
      return;
    }
    
    // When in timeline mode (day/week with bars), let vertical scroll pass through 
    // for time navigation - parent scrollable container handles it
    if (useTimelineView) {
      // Don't convert vertical to horizontal when in timeline mode
      // Let native vertical scroll work for time scrolling
      return;
    }
    
    // Non-timeline mode: convert vertical scrolling (deltaY) to horizontal
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      event.stopPropagation();
      
      // Calculate scroll amount - amplify for better UX
      const scrollAmount = event.deltaY * 2;
      
      // Use scrollBy for smoother behavior
      container.scrollBy({
        left: scrollAmount,
        behavior: 'auto' // instant, не 'smooth' для responsive feel
      });
      
      // Trigger scroll handler for infinite loading after scroll
      requestAnimationFrame(() => handleScroll());
    }
  }

  /**
   * Mobile touch gesture handlers
   * 
   * Edge swipes (within EDGE_THRESHOLD from screen edges) are NOT captured,
   * allowing Obsidian to handle back/forward navigation.
   * 
   * Horizontal swipes in the middle of screen scroll the calendar.
   * Vertical swipes are passed through for native scrolling.
   */
  function handleTouchStart(e: TouchEvent) {
    if (!container || !e.touches[0]) return;
    
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartScrollLeft = container.scrollLeft;
    isTouchScrolling = false;
    
    // Check if touch started near screen edge - let Obsidian handle
    const screenWidth = window.innerWidth;
    isEdgeSwipe = touch.clientX < GESTURE.EDGE_THRESHOLD || touch.clientX > screenWidth - GESTURE.EDGE_THRESHOLD;
  }
  
  function handleTouchMove(e: TouchEvent) {
    if (!container || !e.touches[0] || isEdgeSwipe) return;
    
    const touch = e.touches[0];
    const deltaX = touchStartX - touch.clientX;
    const deltaY = touchStartY - touch.clientY;
    
    // Determine scroll direction on first significant move
    if (!isTouchScrolling && (Math.abs(deltaX) > GESTURE.SWIPE_THRESHOLD || Math.abs(deltaY) > GESTURE.SWIPE_THRESHOLD)) {
      // Horizontal > vertical = we handle it
      isTouchScrolling = Math.abs(deltaX) > Math.abs(deltaY);
    }
    
    // If horizontal scrolling, take over
    if (isTouchScrolling) {
      e.preventDefault();
      container.scrollLeft = touchStartScrollLeft + deltaX;
    }
    // Else let native vertical scroll happen
  }
  
  function handleTouchEnd() {
    if (!container) return;
    
    isTouchScrolling = false;
    isEdgeSwipe = false;
    
    // Trigger infinite loading check (snap disabled - user request #9)
    requestAnimationFrame(() => {
      handleScroll();
      // v7.1: DISABLED snap - пользователь сообщил что доводчик мешает
      // scheduleSnap();
    });
  }
  
  // v6.5: Snap-to-grid for perfect period alignment
  let snapTimer: ReturnType<typeof setTimeout> | null = null;
  let isSnapping = false;
  const SNAP_DELAY = 120; // ms after scroll ends before snapping
  const SNAP_THRESHOLD = 0.30; // 30% of period width tolerance - wider for easier snap
  
  function scheduleSnap() {
    if (snapTimer) clearTimeout(snapTimer);
    if (isSnapping) return;
    
    snapTimer = setTimeout(() => {
      snapToPeriodEdge();
    }, SNAP_DELAY);
  }
  
  function snapToPeriodEdge() {
    if (!container || isSnapping) return;
    
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    
    // Find the period that should be snapped to
    let accumulatedWidth = 0;
    let bestSnapTarget: number | null = null;
    let minSnapDistance = Infinity;
    
    for (let i = 0; i < periods.length; i++) {
      const el = periodElements[i];
      const periodWidth = el?.offsetWidth ?? containerWidth;
      const periodStart = accumulatedWidth;
      const periodEnd = accumulatedWidth + periodWidth;
      
      // Check alignment to left edge of period
      const distToStart = Math.abs(scrollLeft - periodStart);
      // Check alignment to right edge (so period ends at viewport right edge)
      const distToEnd = Math.abs((scrollLeft + containerWidth) - periodEnd);
      
      // For week view: snap if within threshold of either edge
      const threshold = periodWidth * SNAP_THRESHOLD;
      
      if (distToStart < threshold && distToStart < minSnapDistance) {
        minSnapDistance = distToStart;
        bestSnapTarget = periodStart;
      }
      
      if (distToEnd < threshold && distToEnd < minSnapDistance) {
        minSnapDistance = distToEnd;
        bestSnapTarget = periodEnd - containerWidth;
      }
      
      accumulatedWidth += periodWidth;
    }
    
    // Perform smooth snap if we found a good target
    if (bestSnapTarget !== null && minSnapDistance > 2) {
      isSnapping = true;
      container.scrollTo({
        left: Math.max(0, bestSnapTarget),
        behavior: 'smooth'
      });
      // Reset snapping flag after animation
      setTimeout(() => {
        isSnapping = false;
      }, 300);
    }
  }

  onMount(() => {
    // Track initial state for change detection
    lastInterval = interval;
    lastTargetDate = targetDate?.format('YYYY-MM-DD') ?? null;
    lastIsActive = isActive;
    
    // Only initialize if active on mount (rare case - usually starts hidden)
    if (isActive && container) {
      const initialDate = targetDate || dayjs();
      initializePeriodsAroundDate(initialDate);
      
      // Auto-scroll after mount
      setTimeout(() => {
        scrollToDate(initialDate);
        if (useTimelineView && startHour > 0) {
          scrollToHour(startHour);
        }
      }, 150);
    }
    
    // Setup wheel listener for mouse/trackpad horizontal scroll
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      
      // Mobile touch gesture handling (non-passive for preventDefault in move)
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    
    if (onScrollToCurrent) {
      onScrollToCurrent(() => {
        setTimeout(() => scrollToCurrent(), 50);
      });
    }
    
    if (onScrollToDate) {
      onScrollToDate((date: dayjs.Dayjs) => {
        setTimeout(() => scrollToDate(date), 50);
      });
    }
  });

  onDestroy(() => {
    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer);
    }
    
    // Remove event listeners
    if (container) {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    }
  });
  
  /**
   * Scroll wrapper vertically to specific hour
   * v3.0.1: Used to scroll to startHour on mount for business hours default
   * v7.0: Mobile-adaptive hour height for better fit
   */
  function scrollToHour(hour: number) {
    if (!wrapperElement) return;
    const hourHeightRem = isMobile ? 2 : 3; // Mobile: 2rem, Desktop: 3rem - synced with TimelineView
    const scrollTop = hour * hourHeightRem * 16; // rem to px (16px base)
    wrapperElement.scrollTop = scrollTop;
  }
  
  // v7.0: Mobile-adaptive hour height for EventTimeline
  $: hourHeightForTimeline = isMobile ? 2 : 3;
</script>

<div class="infinite-horizontal-calendar-wrapper" class:with-timeline={useTimelineView} bind:this={wrapperElement}>
  <!-- Sticky time axis for timeline views (rendered once, outside scroll container) -->
  {#if useTimelineView}
    <div class="sticky-time-axis">
      <!-- v6.5: AllDay label row FIRST (above day names) -->
      {#if allDayHeight > 0}
        <div class="sticky-allday-row" style:height="{allDayHeight}rem">
          <div class="sticky-allday-label">All day</div>
        </div>
      {/if}
      <!-- v6.5: Month name on same row as day names/dates -->
      <div class="sticky-time-axis-header" style:height="{DAY_HEADER_HEIGHT_REM}rem">
        <div class="axis-month-label">{currentVisibleMonth}</div>
      </div>
      <!-- v3.0.1: Always show full 24h timeline for scrollable day view -->
      <EventTimeline 
        startHour={0}
        endHour={24}
        timeFormat={timeFormat === '12h' ? '12h' : '24h'}
        userTimezone={timezone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : timezone}
        hourHeightRem={hourHeightForTimeline}
      />
    </div>
  {/if}
  
  <div class="infinite-horizontal-calendar" bind:this={container} on:scroll={handleScroll}>
    {#if isLoadingPrev}
      <div class="loading-indicator left">...</div>
    {/if}
    
    {#each periods as period, index (period.id)}
      <div class="period-container" bind:this={periodElements[index]}>
        {#if useTimelineView}
          <!-- Timeline view for day/week bars mode -->
          <!-- v3.0.1: Always use 0-24 for full scrollable timeline -->
          <TimelineView
            days={period.dates}
            {processedGroupedRecords}
            {dataVersion}
            startHour={0}
            endHour={24}
            {timeFormat}
            {timezone}
            showCurrentTimeLine={true}
            fixedAllDayHeight={allDayHeight}
            {onRecordClick}
            {onRecordAdd}
            {onDayTap}
            {isMobile}
            {now}
            hideTimeAxis={true}
            on:navigate={handleTimelineNavigate}
          />
        {:else}
        <!-- Legacy grid view for headers mode or week/2weeks -->
        <div class="period-header">
          <WeekHeader>
            {#each period.weekDays as weekDay}
              <Weekday
                width={100 / period.weekDays.length}
                weekend={weekDay.day() === 0 || weekDay.day() === 6}
              >
                <span class="weekday-name">
                  {$i18n.t("views.calendar.weekday", {
                    value: weekDay.toDate(),
                    formatParams: {
                      value: { weekday: "short" },
                    },
                  })}
                </span>
                <span class="weekday-date">
                  {weekDay.format('D')}
                </span>
              </Weekday>
            {/each}
          </WeekHeader>
        </div>
        
        <div class="period-content" class:two-weeks={interval === '2weeks'}>
          {#each period.weeks as week}
            <!-- HeaderStripsSection for multi-day and all-day events -->
            {#if interval === '2weeks'}
              <HeaderStripsSection
                weekDates={week}
                {processedData}
                {firstDayOfWeek}
                {onRecordClick}
              />
            {/if}
            <Week heightRem={8} useFixedHeight={true}>
              {#each week as date}
                <Day
                  width={100 / week.length}
                  {date}
                  {checkField}
                  records={groupedRecords[date.format("YYYY-MM-DD")] || []}
                  processedRecords={processedGroupedRecords[date.format("YYYY-MM-DD")] || []}
                  {onRecordClick}
                  {onRecordChange}
                  onRecordCheck={onRecordCheck}
                  onRecordAdd={() => onRecordAdd?.(date)}
                  {onDayTap}
                  {isMobile}
                  {dateFieldName}
                  endDateFieldName={endDateFieldName}
                  {timezone}
                  startHourConfig={startHour}
                  endHourConfig={endHour}
                />
              {/each}
            </Week>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
  
  {#if isLoadingNext}
    <div class="loading-indicator right">
      <span class="loading-dot"></span>
    </div>
  {/if}
  </div>
</div>

<style>
  .infinite-horizontal-calendar-wrapper {
    display: flex;
    flex-direction: row;
    height: 100%;
    width: 100%;
    position: relative;
    /* v6.2: Single vertical scroll container for entire view */
    overflow-y: auto;
    overflow-x: hidden;
  }
  
  .infinite-horizontal-calendar-wrapper.with-timeline {
    /* When timeline is shown, axis is sticky on left */
    display: flex;
  }
  
  .sticky-time-axis {
    position: sticky;
    left: 0;
    z-index: 20;
    background: var(--background-primary);
    border-right: 2px solid var(--background-modifier-border);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    /* Ensure it scrolls with content but stays sticky horizontally */
    height: fit-content; 
    min-height: 100%;
  }
  
  .sticky-time-axis-header {
    flex-shrink: 0;
    border-bottom: 1px solid var(--background-modifier-border);
    /* v6.5: NOT sticky - scrolls with day headers to avoid empty corner */
    background: var(--background-primary);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  
  /* v6.5: Month label in header cell */
  .axis-month-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  /* v6.5: AllDay row - scrolls with timeline, not sticky */
  .sticky-allday-row {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 2px solid var(--background-modifier-border);
    background: var(--background-primary);
  }
  
  /* v3.0.2: AllDay label in axis */
  .sticky-allday-label {
    font-size: 0.625rem;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    text-align: center;
    padding: 0.25rem 0.5rem;
  }
  
  .infinite-horizontal-calendar {
    display: flex;
    flex-direction: row;
    /* v6.2: Horizontal scroll only, vertical handled by wrapper */
    overflow-x: auto;
    overflow-y: visible;
    flex: 1 1 auto;
    height: fit-content;
    min-height: 100%;
    scrollbar-width: thin;
    /* v6.5: Remove scroll-behavior: smooth to prevent "bounce back" on fast scroll */
    /* Smooth scrolling is applied programmatically via scrollTo({behavior: 'smooth'}) */
    /* v6.5: Allow overscroll - no invisible boundary */
    overscroll-behavior-x: auto;
    /* Allow touch actions but keep horizontal scroll */
    touch-action: pan-y pan-x pinch-zoom;
  }

  .period-container {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    min-width: 100%;
    /* v6.2: Full height content */
    height: fit-content;
    min-height: 100%;
    border-right: 1px solid var(--background-modifier-border);
    animation: periodSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes periodSlideIn {
    from {
      opacity: 0;
      transform: translateX(1.25rem);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .period-container:last-child {
    border-right: none;
  }

  .period-header {
    flex-shrink: 0;
    /* v6.2: Sticky period header */
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--background-primary);
  }

  .period-content {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
    /* v6.2: Allow content to expand */
    height: fit-content;
  }
  
  .period-content.two-weeks {
    /* 2weeks: use fixed rem heights, allow scroll if needed */
    height: auto;
    min-height: 12rem; /* 2 weeks * 6rem each */
  }

  /* Ensure weeks fill available height */
  .period-content :global(.calendar-week) {
    flex: 1 1 auto;
    min-height: 6.25rem;
  }
  
  .period-content.two-weeks :global(.calendar-week) {
    flex: 0 0 auto; /* Don't stretch in 2weeks mode */
  }

  .weekday-name {
    display: block;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .weekday-date {
    display: block;
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--text-normal);
    margin-top: 0.125rem;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    flex-shrink: 0;
  }

  .loading-indicator.left {
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

  /* Apple-style scrollbar */
  .infinite-horizontal-calendar::-webkit-scrollbar {
    height: 0.5rem;
  }

  .infinite-horizontal-calendar::-webkit-scrollbar-track {
    background: transparent;
  }

  .infinite-horizontal-calendar::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb-bg);
    border-radius: 0.25rem;
  }

  .infinite-horizontal-calendar::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-active-thumb-bg);
  }

  /* Hide scrollbar until hover (Apple style) */
  .infinite-horizontal-calendar {
    scrollbar-color: transparent transparent;
  }

  .infinite-horizontal-calendar:hover {
    scrollbar-color: var(--scrollbar-thumb-bg) transparent;
  }
  
  /* v6.2: Wrapper vertical scrollbar styling */
  .infinite-horizontal-calendar-wrapper::-webkit-scrollbar {
    width: 0.5rem;
  }

  .infinite-horizontal-calendar-wrapper::-webkit-scrollbar-track {
    background: transparent;
  }

  .infinite-horizontal-calendar-wrapper::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb-bg);
    border-radius: 0.25rem;
  }
  
  /* ========================================
   * MOBILE ADAPTATION (v3.0.3)
   * ======================================== */
  
  @media (max-width: 48rem), (pointer: coarse) { /* 768px at 16px base, or touch devices */
    .infinite-horizontal-calendar-wrapper {
      /* Mobile: slightly smaller base size */
      font-size: 0.9375rem;
    }
    
    .period-container {
      /* Mobile: narrower period for better touch targets */
      min-width: 100%;
    }
    
    .weekday-name {
      font-size: 0.625rem;
    }
    
    .weekday-date {
      font-size: 1rem;
    }
    
    /* Time axis more compact on mobile */
    .sticky-time-axis {
      flex-shrink: 0;
    }
    
    .axis-month-label {
      font-size: 0.6875rem;
    }
    
    .sticky-allday-label {
      font-size: 0.5625rem;
      padding: 0.125rem 0.25rem;
    }
    
    /* Touch-friendly scrollbars */
    .infinite-horizontal-calendar::-webkit-scrollbar {
      height: 0.25rem;
    }
    
    .infinite-horizontal-calendar-wrapper::-webkit-scrollbar {
      width: 0.25rem;
    }
  }
  
  /* Very small screens */
  @media (max-width: 30rem) { /* 480px at 16px base */
    .infinite-horizontal-calendar-wrapper {
      font-size: 0.875rem;
    }
    
    .weekday-name {
      font-size: 0.5625rem;
      letter-spacing: 0.01em;
    }
    
    .weekday-date {
      font-size: 0.9375rem;
    }
    
    .axis-month-label {
      font-size: 0.625rem;
    }
  }
  
  /* Reduced motion for accessibility */
  @media (prefers-reduced-motion: reduce) {
    .period-container {
      animation: none;
    }
    
    .infinite-horizontal-calendar {
      scroll-behavior: auto;
    }
  }
</style>
