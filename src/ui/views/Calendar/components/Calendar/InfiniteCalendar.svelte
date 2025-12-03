<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import dayjs from 'dayjs';
  import type { DataRecord } from 'src/lib/dataframe/dataframe';
  import MonthBlock from './MonthBlock.svelte';

  export let groupedRecords: Record<string, DataRecord[]>;
  export let firstDayOfWeek: number;
  export let checkField: string | undefined;
  export let onRecordClick: ((record: DataRecord) => void) | undefined;
  export let onRecordChange: ((date: dayjs.Dayjs, record: DataRecord) => void) | undefined;
  export let onRecordCheck: ((record: DataRecord, checked: boolean) => void) | undefined;
  export let onRecordAdd: ((date: dayjs.Dayjs) => void) | undefined;
  export let onDayTap: ((date: dayjs.Dayjs, records: DataRecord[]) => void) | undefined;
  export let onScrollToCurrent: ((callback: () => void) => void) | undefined;
  export let onScrollToDate: ((callback: (date: dayjs.Dayjs) => void) => void) | undefined;
  export let targetDate: dayjs.Dayjs | null = null;

  let container: HTMLDivElement | null = null;
  let scrollableParent: HTMLElement | null = null;

  const INITIAL_BUFFER = 12; // months before and after
  const LOAD_THRESHOLD = 3; // months from edge to trigger load
  const LOAD_BATCH = 6; // months to add at once
  
  let months: dayjs.Dayjs[] = [];
  let monthElements: (HTMLElement | null)[] = [];
  let isLoadingPrev = false;
  let isLoadingNext = false;
  let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  function initializeMonths() {
    const now = dayjs().startOf('month');
    months = [];
    
    // Start from INITIAL_BUFFER months BEFORE current month
    const startMonth = now.subtract(INITIAL_BUFFER, 'month');
    
    for (let i = 0; i < INITIAL_BUFFER * 2 + 1; i++) {
      months.push(startMonth.add(i, 'month').startOf('month'));
    }
  }

  function findScrollableParent(): HTMLElement | null {
    let el = container?.parentElement;
    while (el) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function getMonthBlockHeight(monthIndex: number): number {
    const element = monthElements[monthIndex];
    return element?.offsetHeight ?? 600;
  }

  function calculateScrollTop(targetMonthIndex: number): number {
    let scrollTop = 0;
    for (let i = 0; i < targetMonthIndex; i++) {
      scrollTop += getMonthBlockHeight(i);
    }
    return scrollTop;
  }

  function getCurrentMonthIndex(): number {
    if (!scrollableParent) return -1;
    
    const scrollTop = scrollableParent.scrollTop;
    let accumulatedHeight = 0;
    
    for (let i = 0; i < months.length; i++) {
      const height = getMonthBlockHeight(i);
      if (accumulatedHeight + height > scrollTop + scrollableParent.clientHeight / 2) {
        return i;
      }
      accumulatedHeight += height;
    }
    return months.length - 1;
  }

  function prependMonths() {
    if (isLoadingPrev || !months[0]) return;
    isLoadingPrev = true;
    
    const oldScrollHeight = scrollableParent?.scrollHeight ?? 0;
    const oldScrollTop = scrollableParent?.scrollTop ?? 0;
    
    const newMonths: dayjs.Dayjs[] = [];
    let current = months[0];
    
    for (let i = 0; i < LOAD_BATCH; i++) {
      current = current.subtract(1, 'month').startOf('month');
      newMonths.unshift(current);
    }
    
    months = [...newMonths, ...months];
    
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

  function appendMonths() {
    if (isLoadingNext || !months[months.length - 1]) return;
    isLoadingNext = true;
    
    const newMonths: dayjs.Dayjs[] = [];
    let current: dayjs.Dayjs | undefined = months[months.length - 1];
    
    for (let i = 0; i < LOAD_BATCH; i++) {
      if (current) {
        current = current.add(1, 'month').startOf('month');
        newMonths.push(current);
      }
    }
    
    months = [...months, ...newMonths];
    
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
    if (!scrollableParent) return;
    
    const currentIndex = getCurrentMonthIndex();
    
    // Check if near the top - load earlier months
    if (currentIndex <= LOAD_THRESHOLD && !isLoadingPrev) {
      prependMonths();
    }
    
    // Check if near the bottom - load later months
    if (currentIndex >= months.length - LOAD_THRESHOLD - 1 && !isLoadingNext) {
      appendMonths();
    }
  }

  function scrollToCurrent() {
    scrollToDate(dayjs());
  }
  
  function scrollToDate(date: dayjs.Dayjs) {
    const targetMonth = date.startOf('month');
    
    if (!scrollableParent || !container) {
      // Retry after mount
      setTimeout(() => scrollToDate(date), 100);
      return;
    }
    
    // Find the index of the target month
    const targetMonthIndex = months.findIndex(m => m.isSame(targetMonth, 'month'));
    
    if (targetMonthIndex === -1) {
      // Target month not in range - reinitialize around target
      initializeMonthsAroundDate(date);
      requestAnimationFrame(() => scrollToDate(date));
      return;
    }
    
    requestAnimationFrame(() => {
      const scrollTop = calculateScrollTop(targetMonthIndex);
      
      if (scrollableParent?.scrollTo) {
        scrollableParent.scrollTo({
          top: scrollTop,
          behavior: 'smooth'
        });
      } else if (scrollableParent) {
        scrollableParent.scrollTop = scrollTop;
      }
    });
  }
  
  function initializeMonthsAroundDate(date: dayjs.Dayjs) {
    const targetMonth = date.startOf('month');
    months = [];
    
    // Start from INITIAL_BUFFER months BEFORE target month
    const startMonth = targetMonth.subtract(INITIAL_BUFFER, 'month');
    
    for (let i = 0; i < INITIAL_BUFFER * 2 + 1; i++) {
      months.push(startMonth.add(i, 'month').startOf('month'));
    }
  }

  onMount(() => {
    // If targetDate is provided, initialize around it; otherwise use today
    if (targetDate) {
      initializeMonthsAroundDate(targetDate);
    } else {
      initializeMonths();
    }
    
    // Find and attach to scrollable parent
    scrollableParent = findScrollableParent();
    
    if (scrollableParent) {
      scrollableParent.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    // Auto-scroll to target date or current date after mount
    setTimeout(() => {
      if (targetDate) {
        scrollToDate(targetDate);
      } else {
        scrollToCurrent();
      }
    }, 50);
    
    // Register the scroll callback with parent
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
    if (scrollableParent) {
      scrollableParent.removeEventListener('scroll', handleScroll);
    }
    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer);
    }
  });
</script>

<div class="infinite-calendar" bind:this={container}>
  {#each months as month, index (month.format('YYYY-MM'))}
    <div bind:this={monthElements[index]} class="month-wrapper">
      <MonthBlock
        {month}
        {firstDayOfWeek}
        {groupedRecords}
        {checkField}
        {onRecordClick}
        {onRecordChange}
        {onRecordCheck}
        {onRecordAdd}
        {onDayTap}
      />
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

  .month-wrapper {
    flex-shrink: 0;
    animation: monthFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes monthFadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
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
    padding: 16px;
  }

  .loading-indicator.top {
    order: -1;
  }

  .loading-dot {
    width: 8px;
    height: 8px;
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