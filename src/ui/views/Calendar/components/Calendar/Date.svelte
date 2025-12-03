<script lang="ts">
  export let today: boolean = false;
  export let outsideMonth: boolean = false;
</script>

<span 
  class="calendar-date" 
  class:today 
  class:outside-month={outsideMonth}
>
  <slot />
</span>

<style>
  .calendar-date {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 4px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: var(--text-muted);
    border-radius: 6px;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-user-select: none;
    user-select: none;
  }

  .today {
    color: var(--interactive-accent);
    font-weight: 700;
  }

  .outside-month {
    color: var(--text-faint);
    font-weight: 400;
    opacity: 0.7;
  }
</style>
