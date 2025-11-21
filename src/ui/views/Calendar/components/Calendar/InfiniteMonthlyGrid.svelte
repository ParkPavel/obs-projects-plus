<script lang="ts">
  import dayjs from "dayjs";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import MonthHeader from "./MonthHeader.svelte";
  import WeekRow from "./WeekRow.svelte";
  import VirtualMonthContainer from "./VirtualMonthContainer.svelte";
  import { onMount, onDestroy } from "svelte";
  import { get } from "svelte/store";

  // Props
  export let records: DataRecord[];
  export let dateField: string;
  export let checkField: string | undefined;
  export let key: number | undefined; // Force re-render when this changes
  export let onRecordClick: (record: DataRecord) => void;
  export let onRecordCheck: (record: DataRecord, checked: boolean) => void;
  export let onRecordAdd: (date: dayjs.Dayjs) => void;

  // State
  let container: HTMLElement;
  let scrollContainer: HTMLElement;
  let currentMonth: dayjs.Dayjs = dayjs().startOf('month'); // Always current month
  let visibleMonths: dayjs.Dayjs[] = [];
  let isScrolling = false;
  let scrollTimeout: NodeJS.Timeout;
  let isLoadingMore = false;
  let isInitialized = false;
  let hasInitialScroll = false;

  // Configuration
  const MONTH_BUFFER = 12; // Months to render above/below viewport
  const LOAD_MORE_THRESHOLD = 0.8; // Load more when 80% scrolled

  // Initialize visible months centered on current month
  function initializeVisibleMonths() {
    if (!currentMonth) {
      console.warn('currentMonth is not initialized yet');
      return;
    }
    
    visibleMonths = [];
    const startMonth = currentMonth.subtract(MONTH_BUFFER, 'month');
    const endMonth = currentMonth.add(MONTH_BUFFER, 'month');
    
    let month = startMonth;
    while (month.isBefore(endMonth) || month.isSame(endMonth, 'month')) {
      visibleMonths.push(month);
      month = month.add(1, 'month');
    }
  }

  // Group records by date for efficient lookup
  $: recordsByDate = (() => {
    const grouped: Record<string, DataRecord[]> = {};
    if (records && records.length > 0 && dateField) {
      records.forEach(record => {
        const dateValue = record.values[dateField];
        if (dateValue) {
          const date = dayjs(dateValue);
          if (date.isValid()) {
            const dateKey = date.format('YYYY-MM-DD');
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(record);
          }
        }
      });
    }
    return grouped;
  })();
  
  // Simple reactive updates - only after currentMonth is initialized
  $: if (records && records.length >= 0 && currentMonth) {
    console.log('InfiniteMonthlyGrid: Records updated:', records.length);
    // Just reinitialize months array, don't change currentMonth
    if (visibleMonths.length > 0) {
      initializeVisibleMonths();
    }
  }

  // Simple scroll to current month
  function scrollToCurrentMonth() {
    if (!container || !scrollContainer || !isInitialized || hasInitialScroll || !currentMonth) {
      // Don't scroll again if already scrolled once or currentMonth not ready
      if (!isInitialized) {
        setTimeout(() => scrollToCurrentMonth(), 100);
      }
      return;
    }

    const currentMonthElement = container.querySelector('[data-month="' + currentMonth.format('YYYY-MM') + '"]');
    if (currentMonthElement) {
      console.log('Scrolling to current month:', currentMonth.format('YYYY-MM'));
      // Simple scroll to center the current month
      currentMonthElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
      hasInitialScroll = true; // Mark as scrolled
    } else {
      // If element not found, scroll to top
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        if (!hasInitialScroll) {
          scrollToCurrentMonth();
        }
      }, 200);
    }
  }

  // Center on specific day
  function centerOnDay(date: dayjs.Dayjs) {
    if (!container || !scrollContainer || !isInitialized || !currentMonth) {
      setTimeout(() => centerOnDay(date), 100);
      return;
    }

    const dayElement = container.querySelector('[data-date="' + date.format('YYYY-MM-DD') + '"]');
    if (dayElement) {
      dayElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
    } else {
      scrollToCurrentMonth();
      setTimeout(() => centerOnDay(date), 300);
    }
  }

  // Handle scroll events with infinite loading
  function handleScroll() {
    if (!scrollContainer || isLoadingMore) return;
    
    isScrolling = true;
    clearTimeout(scrollTimeout);
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    const isNearBottom = scrollPercentage > LOAD_MORE_THRESHOLD;
    const isNearTop = scrollTop / scrollHeight < 0.2;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    const isAtTop = scrollTop <= 10;
    
    // Load more months when near bottom (80% scrolled) or at bottom
    if ((isNearBottom || isAtBottom) && visibleMonths.length < 500) {
      loadMoreMonths('forward');
    }
    // Load more months when near top (20% scrolled) or at top
    else if ((isNearTop || isAtTop) && visibleMonths.length < 500) {
      loadMoreMonths('backward');
    }
    
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, 100);
  }
  
  // Load more months in specified direction
  function loadMoreMonths(direction: 'forward' | 'backward') {
    if (isLoadingMore) return;
    isLoadingMore = true;
    
    if (direction === 'forward') {
      // Add months to the end - extend range beyond current last month
      const lastMonth = visibleMonths[visibleMonths.length - 1];
      const newMonths = [];
      for (let i = 1; i <= MONTH_BUFFER; i++) {
        newMonths.push(lastMonth.add(i, 'month'));
      }
      visibleMonths = [...visibleMonths, ...newMonths];
    } else {
      // Add months to the beginning - extend range before current first month
      const firstMonth = visibleMonths[0];
      const newMonths = [];
      for (let i = 1; i <= MONTH_BUFFER; i++) {
        newMonths.unshift(firstMonth.subtract(i, 'month'));
      }
      visibleMonths = [...newMonths, ...visibleMonths];
    }
    
    // Force re-render by setting a timeout to ensure state updates
    setTimeout(() => {
      isLoadingMore = false;
    }, 50);
  }

  // Helper function to get records for a specific date
  function getRecordsForDate(date: dayjs.Dayjs): DataRecord[] {
    return recordsByDate[date.format('YYYY-MM-DD')] || [];
  }

  // Initialize
  onMount(() => {
    console.log('InfiniteMonthlyGrid: Initializing...');
    initializeVisibleMonths();
    
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
    }
    
    // Set initialization flag and do initial scroll
    setTimeout(() => {
      console.log('InfiniteMonthlyGrid: Mount complete, setting initialized');
      isInitialized = true;
      scrollToCurrentMonth();
    }, 100);
  });

  // Only initialize once - remove afterUpdate logic that causes conflicts
  onDestroy(() => {
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', handleScroll);
    }
    clearTimeout(scrollTimeout);
    isInitialized = false;
    hasInitialScroll = false;
  });

  // Export functions for parent component
  export { scrollToCurrentMonth, centerOnDay };
</script>

<div
  bind:this={scrollContainer}
  class="infinite-calendar-container"
  style="height: 100%; overflow: auto;"
  data-update-key={key}
>
  <div bind:this={container} class="infinite-calendar-content">
    {#key key}
      {#each visibleMonths as month (month.format('YYYY-MM'))}
        <div data-month={month.format('YYYY-MM')} class="month-container">
          <MonthHeader month={month} />
          <div class="weeks-container">
            {#each Array.from({ length: 6 }) as _, weekIndex}
              <WeekRow
                weekIndex={weekIndex}
                month={month}
                recordsByDate={recordsByDate}
                {checkField}
                {onRecordClick}
                {onRecordCheck}
                {onRecordAdd}
              />
            {/each}
          </div>
        </div>
      {/each}
    {/key}
  </div>
</div>

<style>
  .infinite-calendar-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: auto;
  }

  .infinite-calendar-content {
    position: relative;
    width: 100%;
    min-height: 100%;
  }

  .month-container {
    margin-bottom: 2rem;
    padding: 0 1rem;
  }

  .weeks-container {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--input-radius);
    overflow: hidden;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .month-container {
      padding: 0 0.5rem;
      margin-bottom: 1rem;
    }
  }
</style>
