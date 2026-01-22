<script>
  import Week from "./Week.svelte";
</script>

<div class="calendar-container">
  <slot />
</div>

<style>
  .calendar-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-x: auto;
  }

  /* Mobile optimizations */
  @media (max-width: 48rem) {
    .calendar-container {
      font-size: 0.9rem;
    }
  }

  @media (max-width: 30rem) {
    .calendar-container {
      font-size: 0.8rem;
    }
  }
</style>
