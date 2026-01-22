<script lang="ts">
  import dayjs from "dayjs";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import type { ProcessedCalendarData } from "../../types";
  import { generateMonthGrid } from "../../calendar";
  import Day from "./Day.svelte";
  import Week from "./Week.svelte";
  import WeekHeader from "./WeekHeader.svelte";
  import Weekday from "./Weekday.svelte";
  import HeaderStripsSection from "./HeaderStripsSection.svelte";
  
  /**
   * MonthBlock - Month grid for calendar view
   * v3.2.0 - HeaderStripsSection above each week row
   * 
   * Architecture (CALENDAR_ARCHITECTURE.md):
   * ┌─────────────────────────────────────────────────────────────────┐
   * │ HeaderStripsSection (multi-day + all-day) for Week N           │
   * └─────────────────────────────────────────────────────────────────┘
   * ┌─────────────────────────────────────────────────────────────────┐
   * │ WeekRow N: Day cells with ONLY timed events                    │
   * └─────────────────────────────────────────────────────────────────┘
   */
  
  export let month: dayjs.Dayjs;
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
  /** Week row height in rem (Matryoshka principle) */
  export let weekHeightRem: number = 8;
  
  $: grid = generateMonthGrid(month, firstDayOfWeek);
  $: monthTitle = month.format('MMMM YYYY');
  
  /**
   * Extract dates array from week cells for HeaderStripsSection
   */
  function getWeekDates(week: { date: dayjs.Dayjs; isOutsideMonth: boolean }[]): dayjs.Dayjs[] {
    return week.map(cell => cell.date);
  }
</script>

<div class="month-block">
  <div class="month-sticky-header">
    <div class="month-title">
      {monthTitle}
    </div>
    <WeekHeader>
      {#each Array(7) as _, i}
        <Weekday weekend={(i + firstDayOfWeek) % 7 === 0 || (i + firstDayOfWeek) % 7 === 6} width={14.28}>
          {dayjs().day((i + firstDayOfWeek) % 7).format('dd').toUpperCase()}
        </Weekday>
      {/each}
    </WeekHeader>
  </div>
  
  <div class="month-grid">
    {#each grid as week}
      <!-- HeaderStripsSection: Multi-day and All-day events FOR this week row -->
      <HeaderStripsSection
        weekDates={getWeekDates(week)}
        {processedData}
        {firstDayOfWeek}
        {onRecordClick}
      />
      
      <!-- Week row: Day cells with ONLY timed events -->
      <Week heightRem={weekHeightRem} useFixedHeight={true}>
        {#each week as cell}
          <Day 
            date={cell.date}
            isOutsideMonth={cell.isOutsideMonth}
            width={14.28}
            records={!cell.isOutsideMonth ? (groupedRecords[cell.date.format("YYYY-MM-DD")] || []) : []}
            processedRecords={!cell.isOutsideMonth ? (processedData?.grouped[cell.date.format("YYYY-MM-DD")] || []) : []}
            checkField={checkField}
            onRecordClick={onRecordClick}
            {onRecordChange}
            onRecordCheck={onRecordCheck}
            onRecordAdd={!cell.isOutsideMonth ? onRecordAdd : undefined}
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
  .month-block {
    display: flex;
    flex-direction: column;
  }

  .month-sticky-header {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    backdrop-filter: blur(0.75rem);
    -webkit-backdrop-filter: blur(0.75rem);
  }

  .month-title {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1rem 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text-normal);
    text-transform: capitalize;
    -webkit-user-select: none;
    user-select: none;
  }

  .month-grid {
    display: flex;
    flex-direction: column;
  }
</style>