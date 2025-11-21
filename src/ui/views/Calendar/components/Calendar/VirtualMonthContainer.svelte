<script lang="ts">
  import { onMount, afterUpdate } from "svelte";
  import dayjs from "dayjs";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import MonthHeader from "./MonthHeader.svelte";
  import WeekRow from "./WeekRow.svelte";

  export let visibleMonths: dayjs.Dayjs[];
  export let records: DataRecord[];
  export let dateField: string;
  export let checkField: string | undefined;
  export let onRecordClick: (record: DataRecord) => void;
  export let onRecordCheck: (record: DataRecord, checked: boolean) => void;
  export let onRecordAdd: (date: dayjs.Dayjs) => void;

  let containerElement: HTMLElement;
  let isInView = false;
  let observer: IntersectionObserver;

  // Group records by date for efficient lookup
  $: recordsByDate = (() => {
    const grouped: Record<string, DataRecord[]> = {};
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
    return grouped;
  })();

  onMount(() => {
    // Setup intersection observer for performance
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isInView = true;
            // Could trigger data loading for this month if needed
          }
        });
      },
      {
        root: null,
        rootMargin: '100px', // Start loading 100px before element comes into view
        threshold: 0.1
      }
    );

    if (containerElement) {
      observer.observe(containerElement);
    }
  });

  afterUpdate(() => {
    if (observer && containerElement) {
      observer.observe(containerElement);
    }
  });

  // Helper function to get records for a specific date
  function getRecordsForDate(date: dayjs.Dayjs): DataRecord[] {
    return recordsByDate[date.format('YYYY-MM-DD')] || [];
  }
</script>

<div 
  bind:this={containerElement}
  class="virtual-month-container"
  class:in-view={isInView}
>
  <MonthHeader month={visibleMonths[0]} />
  <div class="weeks-container">
    {#each Array.from({ length: 6 }) as _, weekIndex}
      <WeekRow
        weekIndex={weekIndex}
        month={visibleMonths[0]}
        recordsByDate={recordsByDate}
        {checkField}
        {onRecordClick}
        {onRecordCheck}
        {onRecordAdd}
      />
    {/each}
  </div>
</div>

<style>
  .virtual-month-container {
    margin-bottom: 2rem;
    padding: 0 1rem;
    opacity: 0.95;
    transform: translateZ(0);
    will-change: transform;
    transition: opacity 0.3s ease;
  }

  .virtual-month-container.in-view {
    opacity: 1;
  }

  .weeks-container {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--input-radius);
    overflow: hidden;
    background: var(--background-primary);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  @media (max-width: 768px) {
    .virtual-month-container {
      padding: 0 0.5rem;
      margin-bottom: 1rem;
    }
  }
</style>