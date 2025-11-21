<script lang="ts">
import dayjs from "dayjs";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import { i18n } from "src/lib/stores/i18n";
import { get } from "svelte/store";
import { settings } from "src/lib/stores/settings";
import { getFirstDayOfWeek, startOfWeek } from "../../calendar";
import DayCell from "./DayCell.svelte";

export let weekIndex: number;
export let month: dayjs.Dayjs;
export let recordsByDate: Record<string, DataRecord[]>;
export let checkField: string | undefined;
export let onRecordClick: (record: DataRecord) => void;
export let onRecordCheck: (record: DataRecord, checked: boolean) => void;
export let onRecordAdd: (date: dayjs.Dayjs) => void;

// Get locale-aware first day of week
$: firstDayOfWeek = getFirstDayOfWeek($settings.preferences.locale.firstDayOfWeek);

// Calculate the dates for this week row using locale-aware week calculation
$: monthStart = month.startOf('month');
$: weekStart = startOfWeek(monthStart.add(weekIndex, 'week'), firstDayOfWeek);
$: weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));

// Check if day is in current month
function isDayInMonth(day: dayjs.Dayjs): boolean {
  return day.month() === month.month();
}

// Get records for each day
function getRecordsForDay(day: dayjs.Dayjs): DataRecord[] {
  return recordsByDate[day.format('YYYY-MM-DD')] || [];
}
</script>

<div class="week-row">
  {#each weekDays as day (day.format('YYYY-MM-DD'))}
    <DayCell
      {day}
      month={month}
      records={getRecordsForDay(day)}
      checkField={checkField}
      isInCurrentMonth={isDayInMonth(day)}
      {onRecordClick}
      {onRecordCheck}
      {onRecordAdd}
    />
  {/each}
</div>

<style>
  .week-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    height: 120px; /* Fixed height to match DayCell */
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .week-row:last-child {
    border-bottom: none;
  }

  @media (max-width: 768px) {
    .week-row {
      height: 100px; /* Fixed height for mobile to match DayCell */
    }
  }
</style>