<script lang="ts">
  /**
   * EventTimeline - Vertical time axis for day/week views
   * Shows timeline with hour markers based on startHour/endHour
   * 
   * v6.0: Uses rem-based heights for proper scrolling
   * Each hour slot = 3rem (48px at default font) for readable content
   * 
   * ROADMAP §2.6 compliance:
   * - userTimezone for timezone-aware display
   * - Default startHour=0, endHour=24 for full day access via scroll
   */
  
  /** Start hour (full day: 0) */
  export let startHour: number = 0;
  
  /** End hour (full day: 24) */
  export let endHour: number = 24;
  
  /** Time format: 12h or 24h */
  export let timeFormat: '12h' | '24h' = '24h';
  
  /** User timezone for display (ROADMAP §2.6) */
  export let userTimezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  /** Height per hour in rem - consistent with DayColumn */
  export let hourHeightRem: number = 3;
  
  // Calculate total visible hours
  $: totalHours = endHour - startHour;
  $: totalHeightRem = totalHours * hourHeightRem;
  
  // Timezone label for accessibility (consumed by screen readers)
  $: timezoneLabel = userTimezone;
  
  // Generate hour markers
  $: hours = Array.from(
    { length: totalHours }, 
    (_, i) => startHour + i
  );
  
  function formatHour(hour: number): string {
    if (timeFormat === '12h') {
      const h = hour % 12 || 12;
      const period = hour < 12 ? 'AM' : 'PM';
      return `${h} ${period}`;
    }
    return `${hour.toString().padStart(2, '0')}:00`;
  }
</script>

<div 
  class="projects-calendar-timeline" 
  style="--hour-height: {hourHeightRem}rem; --total-height: {totalHeightRem}rem" 
  aria-label="Timeline ({timezoneLabel})"
>
  {#each hours as hour}
    <div class="projects-calendar-timeline-hour">
      <span class="projects-calendar-hour-label">{formatHour(hour)}</span>
      <div class="projects-calendar-hour-line"></div>
    </div>
  {/each}
</div>

<style>
  .projects-calendar-timeline {
    position: relative;
    width: 3.75rem;
    height: var(--total-height, 72rem); /* 24 hours × 3rem */
    min-height: var(--total-height, 72rem);
    flex-shrink: 0;
    background: var(--background-primary);
  }
  
  .projects-calendar-timeline-hour {
    position: relative;
    height: var(--hour-height, 3rem);
    display: flex;
    align-items: flex-start;
    padding-top: 0.125rem;
    box-sizing: border-box;
  }
  
  .projects-calendar-hour-label {
    font-size: 0.6875rem;
    color: var(--text-muted);
    padding: 0 0.5rem;
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
  }
  
  .projects-calendar-hour-line {
    position: absolute;
    top: 0;
    left: 3.75rem;
    right: -100vw; /* Extend across days */
    height: 1px;
    background: var(--background-modifier-border);
    opacity: 0.3;
    pointer-events: none;
  }
  
  .projects-calendar-timeline-hour:nth-child(2n) .projects-calendar-hour-label {
    opacity: 0.7;
  }
  
  /* Mobile adaptivity */
  @media (max-width: 48rem) {
    .projects-calendar-timeline {
      width: 3rem;
    }
    
    .projects-calendar-hour-label {
      font-size: 0.625rem;
      padding: 0 0.25rem;
    }
    
    .projects-calendar-hour-line {
      left: 3rem;
    }
  }
</style>
