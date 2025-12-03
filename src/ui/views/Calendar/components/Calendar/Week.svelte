<script lang="ts">
  export let height: number;
</script>

<div
  style:flex={height > 0 ? `${height} 1 0%` : '1 1 auto'}
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
    transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .calendar-week:last-child {
    border-bottom: 0;
  }

  /* Subtle animation on load */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .calendar-week {
    animation: fadeIn 0.2s ease-out;
  }
</style>
