<script lang="ts">
  export let weekend: boolean = false;
  export let width: number;
</script>

<div
  class="calendar-weekday"
  class:weekend
  style:width={width + "%"}
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
    padding: 8px 4px;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    background: transparent;
    -webkit-user-select: none;
    user-select: none;
  }

  .calendar-weekday:last-child {
    border-right: 0;
  }

  .weekend {
    color: var(--text-faint);
  }
</style>
