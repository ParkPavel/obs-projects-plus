<script lang="ts">
  /**
   * MultiDayEventStrip - Horizontal strip for multi-day events in day header
   * Per ROADMAP_V3.0.0 §2.8 - Многодневные события в шапке
   * 
   * Each day renders its own segment of the multi-day event strip.
   * The strip spans across multiple day columns in the header area.
   * 
   * v8.0: Unified height system - STRIP_HEIGHT + STRIP_GAP must match TimelineView/HeaderStripsSection
   */
  
  export let title: string;
  export let color: string = 'var(--text-accent)';
  export let rowIndex: number = 0;       // Vertical position in header (for stacking)
  export let isFirstDay: boolean = false; // First day of the event
  export let isLastDay: boolean = false;  // Last day of the event
  export let onClick: ((newLeaf?: boolean) => void) | undefined = undefined;
  export let isMobile: boolean = false;
  
  // v8.0: Unified constants - MUST match TimelineView.svelte
  const STRIP_HEIGHT_DESKTOP = 1.25;  // rem
  const STRIP_HEIGHT_MOBILE = 1.125;  // rem  
  const STRIP_GAP_REM = 0.125;        // gap between strips
  
  // Reactive height based on device
  $: STRIP_HEIGHT_REM = isMobile ? STRIP_HEIGHT_MOBILE : STRIP_HEIGHT_DESKTOP;
  // Row height = strip height + gap
  $: ROW_HEIGHT_REM = STRIP_HEIGHT_REM + STRIP_GAP_REM;
  // Top position for this strip
  $: topPosition = rowIndex * ROW_HEIGHT_REM;
  
  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    if (onClick) {
      const newLeaf = e.ctrlKey || e.metaKey;
      onClick(newLeaf);
    }
  }
</script>

{#if onClick}
  <button
    class="projects-calendar-multiday-strip"
    class:first={isFirstDay}
    class:last={isLastDay}
    class:mobile={isMobile}
    style="
      --strip-color: {color};
      --strip-height: {STRIP_HEIGHT_REM}rem;
      height: {STRIP_HEIGHT_REM}rem;
      top: {topPosition}rem;
      line-height: {STRIP_HEIGHT_REM}rem;
    "
    on:click={handleClick}
    title={title}
    type="button"
  >
    {#if isFirstDay}
      <span class="strip-title">{title}</span>
    {/if}
  </button>
{:else}
  <div
    class="projects-calendar-multiday-strip"
    class:first={isFirstDay}
    class:last={isLastDay}
    class:mobile={isMobile}
    style="
      --strip-color: {color};
      --strip-height: {STRIP_HEIGHT_REM}rem;
      height: {STRIP_HEIGHT_REM}rem;
      top: {topPosition}rem;
      line-height: {STRIP_HEIGHT_REM}rem;
    "
    title={title}
  >
    {#if isFirstDay}
      <span class="strip-title">{title}</span>
    {/if}
  </div>
{/if}

<style>
  .projects-calendar-multiday-strip {
    position: absolute;
    left: 0;
    right: 0;
    /* v8.0: Height from CSS variable - ensures sync with container */
    height: var(--strip-height, 1.25rem);
    max-height: var(--strip-height, 1.25rem);
    /* v8.3.1: Explicit line-height to prevent inheritance from parent */
    line-height: var(--strip-height, 1.25rem);
    /* v9.1: Top border accent for multi-day events */
    background: color-mix(in srgb, var(--strip-color) 20%, var(--background-primary));
    border-top: 3px solid var(--strip-color);
    border-radius: 0;
    color: var(--text-normal);
    font-size: 0.6875rem;
    padding: 0 0.375rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    overflow: hidden;
    cursor: default;
    transition: 
      background 0.15s ease,
      transform 0.1s ease;
    z-index: 2;
    /* v9.0: Ensure strip stays within bounds */
    box-sizing: border-box;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  
  /* v9.0: First/last day styling - subtle visual indication */
  .projects-calendar-multiday-strip.first {
    left: 0;
  }
  
  .projects-calendar-multiday-strip.last {
    right: 0;
  }
  
  button.projects-calendar-multiday-strip {
    cursor: pointer;
    border: none;
    border-top: 3px solid var(--strip-color);
    font-family: inherit;
    /* v9.1: Ensure button respects height - browsers may override */
    height: var(--strip-height, 1.25rem) !important;
    max-height: var(--strip-height, 1.25rem) !important;
    min-height: 0 !important;
    padding-top: 0;
    padding-bottom: 0;
  }
  
  button.projects-calendar-multiday-strip:hover {
    background: color-mix(in srgb, var(--strip-color) 30%, var(--background-primary));
    transform: translateY(-1px);
  }
  
  button.projects-calendar-multiday-strip:active {
    transform: translateY(0);
  }
  
  .strip-title {
    flex: 1;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--text-normal);
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  /* Mobile styles */
  .projects-calendar-multiday-strip.mobile {
    font-size: 0.5625rem;
    padding: 0 0.25rem;
  }
  
  .projects-calendar-multiday-strip.mobile .strip-title {
    font-size: 0.5625rem;
  }
</style>
