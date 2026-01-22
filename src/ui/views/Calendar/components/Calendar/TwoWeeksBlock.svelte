<script lang="ts">
  import dayjs from "dayjs";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import type { ProcessedCalendarData } from "../../types";
  import Day from "./Day.svelte";
  import Week from "./Week.svelte";
  import WeekHeader from "./WeekHeader.svelte";
  import Weekday from "./Weekday.svelte";
  import HeaderStripsSection from "./HeaderStripsSection.svelte";
  
  /**
   * TwoWeeksBlock - Two-week grid for calendar view
   * Similar to MonthBlock but shows exactly 2 weeks centered around a date
   */
  
  /** Start date of the 2-week period (first day of first week) */
  export let startDate: dayjs.Dayjs;
  export let firstDayOfWeek: number;
  export let groupedRecords: Record<string, DataRecord[]>;
  export let processedData: ProcessedCalendarData | null = null;
  export let checkField: string | undefined;
  export let onRecordClick: ((record: DataRecord) => void) | undefined;
  export let onRecordChange: ((date: dayjs.Dayjs, record: DataRecord) => void) | undefined;
  export let onRecordCheck: ((record: DataRecord, checked: boolean) => void) | undefined;
  export let onRecordAdd: ((date: dayjs.Dayjs) => void) | undefined;
  export let onDayTap: ((date: dayjs.Dayjs, records: DataRecord[], event?: MouseEvent | TouchEvent) => void) | undefined;
  export let isMobile: boolean = false;
  export let dateFieldName: string | undefined;
  export let endDateFieldName: string | undefined;
  export let timezone: string = "local";
  /** Display mode for events: 'list' (default) or 'bars' (relative time bars) */
  export let displayMode: 'list' | 'bars' = 'list';
  /** Start hour for time bars (0-23), default 7 */
  export let startHour: number = 7;
  /** End hour for time bars (0-23), default 21 */
  export let endHour: number = 21;
  /** Week row height in rem - larger to fit 2 weeks in viewport */
  export let weekHeightRem: number = 14;
  
  /**
   * Generate 2-week grid from startDate
   */
  function generate2WeeksGrid(start: dayjs.Dayjs, fdow: number): { date: dayjs.Dayjs }[][] {
    const weeks: { date: dayjs.Dayjs }[][] = [];
    
    // Align to first day of week
    let weekStart = start.startOf('day');
    const weekday = weekStart.day();
    const diff = (weekday - fdow + 7) % 7;
    weekStart = weekStart.subtract(diff, 'day');
    
    // Generate 2 weeks (14 days)
    for (let w = 0; w < 2; w++) {
      const week: { date: dayjs.Dayjs }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = weekStart.add(w * 7 + d, 'day');
        week.push({ date });
      }
      weeks.push(week);
    }
    
    return weeks;
  }
  
  $: grid = generate2WeeksGrid(startDate, firstDayOfWeek);
  
  // Title shows the date range
  $: titleStart = grid[0]?.[0]?.date;
  $: titleEnd = grid[1]?.[6]?.date;
  $: blockTitle = titleStart && titleEnd 
    ? `${titleStart.format('MMM D')} — ${titleEnd.format('MMM D, YYYY')}`
    : '';
  
  /**
   * Extract dates array from week cells for HeaderStripsSection
   */
  function getWeekDates(week: { date: dayjs.Dayjs }[]): dayjs.Dayjs[] {
    return week.map(cell => cell.date);
  }
</script>

<div class="two-weeks-block">
  <div class="two-weeks-sticky-header">
    <div class="two-weeks-title">
      {blockTitle}
    </div>
    <WeekHeader>
      {#each Array(7) as _, i}
        <Weekday weekend={(i + firstDayOfWeek) % 7 === 0 || (i + firstDayOfWeek) % 7 === 6} width={14.28}>
          {dayjs().day((i + firstDayOfWeek) % 7).format('dd').toUpperCase()}
        </Weekday>
      {/each}
    </WeekHeader>
  </div>
  
  <div class="two-weeks-grid">
    {#each grid as week}
      <!-- HeaderStripsSection: Multi-day and All-day events FOR this week row -->
      <HeaderStripsSection
        weekDates={getWeekDates(week)}
        {processedData}
        {firstDayOfWeek}
        {onRecordClick}
      />
      
      <!-- Week row: Day cells -->
      <Week heightRem={weekHeightRem} useFixedHeight={true}>
        {#each week as cell}
          <Day 
            date={cell.date}
            isOutsideMonth={false}
            width={14.28}
            records={groupedRecords[cell.date.format("YYYY-MM-DD")] || []}
            processedRecords={processedData?.grouped[cell.date.format("YYYY-MM-DD")] || []}
            checkField={checkField}
            onRecordClick={onRecordClick}
            {onRecordChange}
            onRecordCheck={onRecordCheck}
            onRecordAdd={onRecordAdd}
            {onDayTap}
            {isMobile}
            {dateFieldName}
            endDateFieldName={endDateFieldName}
            {timezone}
            {displayMode}
            startHourConfig={startHour}
            endHourConfig={endHour}
          />
        {/each}
      </Week>
    {/each}
  </div>
</div>

<style>
  .two-weeks-block {
    display: flex;
    flex-direction: column;
  }

  .two-weeks-sticky-header {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    backdrop-filter: blur(0.75rem);
    -webkit-backdrop-filter: blur(0.75rem);
  }

  .two-weeks-title {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1rem 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text-normal);
    -webkit-user-select: none;
    user-select: none;
  }

  .two-weeks-grid {
    display: flex;
    flex-direction: column;
  }
</style>
