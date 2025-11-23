<script lang="ts">
  export let height: number;
</script>

<div
  style:height={height + "%"}
  role="row"
  class="calendar-week"
>
  <slot />
</div>

<style>
  .calendar-week {
    display: flex;
    border-bottom: 1px solid var(--background-modifier-border);
    min-height: 100px;
    transition: all 0.2s ease;
  }

  .calendar-week:last-child {
    border-bottom: 0;
  }
</style>
