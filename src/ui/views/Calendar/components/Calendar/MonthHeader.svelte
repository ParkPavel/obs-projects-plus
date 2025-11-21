<script lang="ts">
  import dayjs from "dayjs";
  import 'dayjs/locale/ru'; // Import Russian locale

  export let month: dayjs.Dayjs;

  // Set locale to Russian for month names
  $: monthWithLocale = month.locale('ru');
  
  // Format month name as "Месяц YY" (Month Year in Russian)
  $: monthName = monthWithLocale.format('MMMM YYYY');
</script>

<div class="month-header">
  <h3 class="month-title">
    {monthName}
  </h3>
  <div class="weekday-header">
    {#each Array.from({ length: 7 }) as _, dayIndex}
      {@const day = monthWithLocale.startOf("week").add(dayIndex, "day")}
      <div class="weekday" class:weekend={day.day() === 0 || day.day() === 6}>
        {day.format('ddd')}
      </div>
    {/each}
  </div>
</div>

<style>
  .month-header {
    padding: 1rem 0 0.5rem 0;
  }

  .month-title {
    margin: 0 0 0.5rem 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-normal);
    text-align: center;
  }

  .weekday-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background: var(--background-modifier-border);
    border-radius: var(--input-radius);
    overflow: hidden;
    margin-bottom: 1px;
  }

  .weekday {
    background: var(--background-primary);
    padding: 0.5rem 0.25rem;
    text-align: center;
    font-size: var(--font-ui-small);
    font-weight: 500;
    color: var(--text-muted);
  }

  .weekend {
    color: var(--text-accent);
  }

  @media (max-width: 768px) {
    .month-title {
      font-size: 1rem;
    }
    
    .weekday {
      font-size: var(--font-ui-smaller);
      padding: 0.25rem 0.125rem;
    }
  }
</style>