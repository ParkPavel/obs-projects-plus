<script lang="ts">
  export let weekend: boolean = false;
  export let width: number;
</script>

<div
  class:weekend
  style:width={width + "%"}
  role="columnheader"
  aria-sort="none"
  class="calendar-weekday"
>
  <slot />
</div>

<style>
  .calendar-weekday {
    width: calc(100% / 7);
    border-right: 1px solid var(--background-modifier-border);
    padding: 4px;
    padding-bottom: 0;
    text-align: center;
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-muted);
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--background-secondary);
  }

  .weekend {
    background-color: var(--background-primary-alt);
  }
</style>
