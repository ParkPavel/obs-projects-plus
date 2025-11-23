<div
  role="row"
  aria-rowindex="1"
  class="calendar-week-header"
>
  <slot />
</div>

<style>
  .calendar-week-header {
    display: flex;
    background: var(--background-secondary);
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-muted);
  }
</style>
