<script lang="ts">
  import dayjs from "dayjs";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { generateMonthGrid } from "../../calendar";
  import Day from "./Day.svelte";
  import Week from "./Week.svelte";
  import WeekHeader from "./WeekHeader.svelte";
  import Weekday from "./Weekday.svelte";
  
  export let month: dayjs.Dayjs;
  export let firstDayOfWeek: number;
  export let groupedRecords: Record<string, DataRecord[]>;
  export let checkField: string | undefined;
  export let onRecordClick: ((record: DataRecord) => void) | undefined;
  export let onRecordChange: ((date: dayjs.Dayjs, record: DataRecord) => void) | undefined;
  export let onRecordCheck: ((record: DataRecord, checked: boolean) => void) | undefined;
  export let onRecordAdd: ((date: dayjs.Dayjs) => void) | undefined;
  export let onDayTap: ((date: dayjs.Dayjs, records: DataRecord[]) => void) | undefined;
  
  $: grid = generateMonthGrid(month, firstDayOfWeek);
  $: monthTitle = month.format('MMMM YYYY');
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
      <Week height={16.67}>
        {#each week as cell}
          <Day 
            date={cell.date}
            isOutsideMonth={cell.isOutsideMonth}
            width={14.28}
            records={!cell.isOutsideMonth ? (groupedRecords[cell.date.format("YYYY-MM-DD")] || []) : []}
            checkField={checkField}
            onRecordClick={onRecordClick}
            {onRecordChange}
            onRecordCheck={onRecordCheck}
            onRecordAdd={!cell.isOutsideMonth ? onRecordAdd : undefined}
            {onDayTap}
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
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .month-title {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 16px 8px;
    font-size: 15px;
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