<script lang="ts">
  import dayjs from "dayjs";
  import type { ProcessedCalendarData } from "../../types";
  import { generateMonthGrid } from "../../calendar";
  import { duplicateStore } from "src/lib/stores/duplicateStore";
  import DuplicateWeek from "./DuplicateWeek.svelte";
  import DuplicateHeaderStripsSection from "./DuplicateHeaderStripsSection.svelte";
  import Weekday from "../Calendar/Weekday.svelte";
  import WeekHeader from "../Calendar/WeekHeader.svelte";
  
  export let month: dayjs.Dayjs;
  export let firstDayOfWeek: number;
  export let processedData: ProcessedCalendarData | null = null;
  export let displayMode: 'list' | 'bars' = 'bars';
  export let startHour: number = 7;
  export let endHour: number = 21;
  
  $: grid = generateMonthGrid(month, firstDayOfWeek);
  $: monthTitle = month.format('MMMM YYYY');
  
  // Get selection from store
  $: state = $duplicateStore;
  
  function getWeekDates(week: { date: dayjs.Dayjs; isOutsideMonth: boolean }[]): dayjs.Dayjs[] {
    return week.map(cell => cell.date);
  }
  
  function isDaySelected(date: dayjs.Dayjs): boolean {
    const dateKey = date.format("YYYY-MM-DD");
    return state.selectedDates.has(dateKey);
  }
  
  function handleDayClick(date: dayjs.Dayjs) {
    duplicateStore.toggleDate(date);
  }
</script>

<div class="duplicate-month-block" data-month={month.format('YYYY-MM')}>
  <div class="duplicate-month-sticky-header">
    <div class="duplicate-month-title">
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
  
  <div class="duplicate-month-grid">
    {#each grid as week}
      <!-- HeaderStripsSection для multi-day и all-day событий -->
      <DuplicateHeaderStripsSection
        weekDates={getWeekDates(week)}
        {processedData}
        {firstDayOfWeek}
      />
      
      <!-- Week row с timed событиями и selection overlay -->
      <DuplicateWeek
        {week}
        {processedData}
        {displayMode}
        {startHour}
        {endHour}
        {isDaySelected}
        {handleDayClick}
      />
    {/each}
  </div>
</div>

<style>
  .duplicate-month-block {
    display: flex;
    flex-direction: column;
  }

  .duplicate-month-sticky-header {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    backdrop-filter: blur(0.75rem);
  }

  .duplicate-month-title {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1rem 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text-normal);
    text-transform: capitalize;
    user-select: none;
  }

  .duplicate-month-grid {
    display: flex;
    flex-direction: column;
  }

</style>
