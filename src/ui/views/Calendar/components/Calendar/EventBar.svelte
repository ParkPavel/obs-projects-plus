<script lang="ts">
  import type { DataRecord } from '../../../../../lib/dataframe/dataframe';
  import { getDisplayName, cleanWikiLink } from "src/ui/views/Board/components/Board/boardHelpers";
  import dayjs from 'dayjs';
  
  /**
   * EventBar - Positioned event bar for timeline views
   * Displays event as colored bar with time-based positioning
   * 
   * v3.1.0 "Matryoshka" principle:
   * - Uses rem-based positioning for predictable scrolling
   * - hourHeightRem defines height per hour (default 3rem = 48px)
   * - Position calculated as hours * hourHeightRem (in rem)
   */
  
  export let record: DataRecord;
  export let startDate: dayjs.Dayjs;
  export let endDate: dayjs.Dayjs | null;
  export let startHour: number = 0;
  /** Reserved - event bars use visual clipping instead of endHour clamp */
  export const endHour: number = 24;
  export let color: string = 'var(--text-accent)';
  export let column: number = 0;
  export let totalColumns: number = 1;
  export let hourHeightRem: number = 3; // Height per hour in rem
  export let onClick: ((event: MouseEvent) => void) | undefined = undefined;
  
  /** Color filter indicators (ROADMAP §2.5) */
  export let colorFilters: string[] = [];
  
  // Calculate position and height in REM (Matryoshka principle)
  $: {
    const startMinutes = startDate.hour() * 60 + startDate.minute();
    const startFromBeginning = startMinutes - (startHour * 60);
    
    // If no end date, default to 1 hour duration
    const effectiveEndDate = endDate || startDate.add(1, 'hour');
    const endMinutes = effectiveEndDate.hour() * 60 + effectiveEndDate.minute();
    const endFromBeginning = endMinutes - (startHour * 60);
    
    // Convert minutes to rem (hourHeightRem per 60 minutes)
    const minuteHeightRem = hourHeightRem / 60;
    topRem = Math.max(0, startFromBeginning * minuteHeightRem);
    // v8.2: Min visual height = 20 minutes (hourHeightRem * 20/60 = hourHeightRem/3)
    // This MUST match MIN_VISUAL_DURATION_MINUTES in EventBarContainer for collision sync
    const MIN_VISUAL_MINUTES = 20;
    heightRem = Math.max(hourHeightRem * MIN_VISUAL_MINUTES / 60, (endFromBeginning - startFromBeginning) * minuteHeightRem);
    
    // Column positioning for overlapping events (guard against division by zero)
    const safeTotalColumns = totalColumns > 0 ? totalColumns : 1;
    leftPercent = (column / safeTotalColumns) * 100;
    widthPercent = (1 / safeTotalColumns) * 100;
  }
  
  let topRem: number;
  let heightRem: number;
  let leftPercent: number;
  let widthPercent: number;
  
  // Get display title - use name/title fields, fallback to getDisplayName
  // cleanWikiLink handles [[path|name]] and [[path]] formats
  $: title = (() => {
    // Check for name field
    const name = record.values['name'];
    if (name && typeof name === 'string' && name.trim()) {
      return cleanWikiLink(name);
    }
    
    // Check for title field
    const titleVal = record.values['title'];
    if (titleVal && typeof titleVal === 'string' && titleVal.trim()) {
      return cleanWikiLink(titleVal);
    }
    
    // Check for file object with name
    const fileValue = record.values['file'];
    if (fileValue && typeof fileValue === 'object' && 'name' in fileValue) {
      return (fileValue as { name: string }).name;
    }
    
    // Fallback: extract display name from record ID
    return getDisplayName(record.id) || 'Untitled';
  })();
  
  function handleClick(event: MouseEvent) {
    if (onClick) {
      onClick(event);
    }
  }
</script>

{#if onClick}
  <button 
    class="projects-calendar-event-bar projects-calendar-event-bar-clickable"
    type="button"
    style="
      top: {topRem}rem; 
      height: {heightRem}rem; 
      --left-percent: {leftPercent}%;
      --width-percent: {widthPercent}%;
      --event-color: {color};
    "
    on:click={handleClick}
    title={title}
  >
    <div class="projects-calendar-event-bar-content">
      <div class="projects-calendar-event-title">{title}</div>
      {#if colorFilters.length > 0}
        <div class="color-indicators">
          {#each colorFilters as filterColor}
            <span class="indicator" style="background: {filterColor}"></span>
          {/each}
        </div>
      {/if}
    </div>
  </button>
{:else}
  <div 
    class="projects-calendar-event-bar"
    style="
      top: {topRem}rem; 
      height: {heightRem}rem; 
      --left-percent: {leftPercent}%;
      --width-percent: {widthPercent}%;
      --event-color: {color};
    "
    title={title}
  >
    <div class="projects-calendar-event-bar-content">
      <div class="projects-calendar-event-title">{title}</div>
      {#if colorFilters.length > 0}
        <div class="color-indicators">
          {#each colorFilters as filterColor}
            <span class="indicator" style="background: {filterColor}"></span>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .projects-calendar-event-bar {
    position: absolute;
    border-left: 3px solid var(--event-color);
    background: color-mix(in srgb, var(--event-color) 15%, transparent);
    border-radius: 0.25rem;
    padding: 0.125rem 0.375rem;
    /* v8.1: Remove vertical margin to prevent visual overlap between adjacent events */
    /* v8.2: Use calc to subtract gap from width instead of margin */
    /* Margin adds to width and causes overflow - use internal padding instead */
    margin: 0;
    /* Add small inset to prevent touching column edges */
    left: calc(var(--left-percent, 0) + 0.0625rem);
    width: calc(var(--width-percent, 100%) - 0.125rem);
    overflow: hidden;
    transition: all 0.1s ease;
    border: none;
    text-align: left;
    font-family: inherit;
    font-size: inherit;
    /* v8.1: Ensure padding/border included in height calculation */
    box-sizing: border-box;
    /* Mobile touch optimization */
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  
  button.projects-calendar-event-bar {
    cursor: pointer;
  }
  
  button.projects-calendar-event-bar:hover {
    background: color-mix(in srgb, var(--event-color) 25%, transparent);
    transform: translateX(0.125rem);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 10;
  }
  
  button.projects-calendar-event-bar:active {
    background: color-mix(in srgb, var(--event-color) 35%, transparent);
    transform: scale(0.98);
  }
  
  button.projects-calendar-event-bar:focus {
    outline: 2px solid var(--event-color);
    outline-offset: 0.125rem;
    z-index: 10;
  }
  
  .projects-calendar-event-bar-content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    height: 100%;
    overflow: hidden;
    pointer-events: none; /* Let clicks pass through to button */
  }
  
  .projects-calendar-event-title {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  /* Color filter indicators (ROADMAP §2.5) */
  .color-indicators {
    display: flex;
    gap: 0.125rem;
    margin-top: 0.125rem;
    flex-wrap: wrap;
  }
  
  .indicator {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }
  
  /* Mobile responsive */
  @media (max-width: 48rem) {
    .projects-calendar-event-bar {
      padding: 0.1875rem 0.25rem;
      /* v8.2: No margin - width is already calculated with gaps */
      margin: 0;
      border-left-width: var(--ppp-border-width-thick, 0.125rem);
    }
    
    .projects-calendar-event-title {
      font-size: 0.6875rem;
    }
    
    button.projects-calendar-event-bar:active {
      background: color-mix(in srgb, var(--event-color) 40%, transparent);
    }
  }
</style>
