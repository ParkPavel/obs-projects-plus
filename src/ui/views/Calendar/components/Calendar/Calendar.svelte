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
    /* Enable smooth scrolling on mobile */
    -webkit-overflow-scrolling: touch;
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .calendar-container {
      font-size: 0.9rem;
    }
  }

  @media (max-width: 480px) {
    .calendar-container {
      font-size: 0.8rem;
    }
  }
</style>
