<script lang="ts">
  /**
   * Week row container for month grid
   * v3.1.0 "Matryoshka" principle: Fixed height in rem
   */
  export let height: number = 0; // Legacy percentage support
  export let heightRem: number = 8; // Fixed height in rem (default: 8rem = ~128px)
  export let useFixedHeight: boolean = true; // Switch to rem-based height
</script>

<div
  style:height={useFixedHeight ? `${heightRem}rem` : undefined}
  style:flex={!useFixedHeight && height > 0 ? `${height} 1 0%` : (useFixedHeight ? 'none' : '1 1 auto')}
  role="row"
  class="calendar-week"
  class:fixed-height={useFixedHeight}
>
  <slot />
</div>

<style>
  .calendar-week {
    display: flex;
    border-bottom: 1px solid var(--background-modifier-border);
    min-height: 6.25rem;
    transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .calendar-week.fixed-height {
    min-height: unset;
    /* Height is set via inline style */
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
