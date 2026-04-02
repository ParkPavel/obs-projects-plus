<script lang="ts">
  export let weekend: boolean = false;
  /** @deprecated Width is now controlled via flex. Kept for backward compatibility. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export const width: number = 14.28;
</script>

<div
  class="calendar-weekday"
  class:weekend
  role="columnheader"
  aria-sort="none"
>
  <slot />
</div>

<style>
  .calendar-weekday {
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid var(--background-modifier-border);
    padding: 0.5rem 0.25rem;
    text-align: center;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    background: transparent;
    -webkit-user-select: none;
    user-select: none;
    /* v9.3: flex: 1 1 0 removed — parent .calendar-week-header is now CSS Grid. */
    min-width: 0;
    box-sizing: border-box;
  }

  .calendar-weekday:last-child {
    border-right: 0;
  }

  .weekend {
    color: var(--text-faint);
  }
</style>
