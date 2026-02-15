<script lang="ts">
  import dayjs from 'dayjs';
  import timezone from 'dayjs/plugin/timezone';
  import utc from 'dayjs/plugin/utc';
  import { onMount, onDestroy } from 'svelte';
  
  dayjs.extend(utc);
  dayjs.extend(timezone);
  
  /**
   * CurrentTimeLine - Red indicator line for current time
   * v3.1.0 "Matryoshka" principle: uses rem-based positioning
   */
  
  export let startHour: number = 0;
  export let endHour: number = 24;
  export let userTimezone: string = 'UTC';
  export let hourHeightRem: number = 3; // Height per hour in rem
  
  let currentTimeRem: number = 0;
  let isVisible: boolean = false;
  let updateInterval: ReturnType<typeof setInterval> | null = null;
  
  function updateCurrentTime() {
    let now: dayjs.Dayjs;
    try {
      // Safely handle timezone - fallback to local if invalid
      if (userTimezone && userTimezone !== 'local') {
        now = dayjs().tz(userTimezone);
      } else {
        now = dayjs();
      }
    } catch {
      now = dayjs();
    }
    
    const currentHour = now.hour();
    const currentMinute = now.minute();
    
    // Check if current time is within visible range
    if (currentHour >= startHour && currentHour < endHour) {
      // Calculate position in rem (Matryoshka principle)
      const minuteHeightRem = hourHeightRem / 60;
      const currentMinutesFromStart = (currentHour - startHour) * 60 + currentMinute;
      currentTimeRem = currentMinutesFromStart * minuteHeightRem;
      isVisible = true;
    } else {
      isVisible = false;
    }
  }
  
  onMount(() => {
    updateCurrentTime();
    // Update every minute
    updateInterval = setInterval(updateCurrentTime, 60000);
  });
  
  onDestroy(() => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });
</script>

{#if isVisible}
  <div class="projects-calendar-current-time-line" style="top: {currentTimeRem}rem">
    <div class="projects-calendar-time-indicator"></div>
    <div class="projects-calendar-time-line"></div>
  </div>
{/if}

<style>
  .projects-calendar-current-time-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    z-index: 100;
    pointer-events: none;
  }
  
  .projects-calendar-time-indicator {
    position: absolute;
    left: 0;
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
    background: var(--text-error);
    transform: translate(-50%, -50%);
    box-shadow: 0 0 4px rgba(var(--color-red-rgb, 255, 0, 0), 0.5);
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.2);
      opacity: 0.8;
    }
  }
  
  .projects-calendar-time-line {
    position: absolute;
    left: 0.5rem;
    right: 0;
    height: var(--ppp-border-width-thick, 0.125rem);
    background: var(--text-error);
    opacity: 0.8;
    box-shadow: 0 1px 2px rgba(var(--color-red-rgb, 255, 0, 0), 0.3);
  }
  
  /* Mobile adaptivity */
  @media (max-width: 48rem) {
    .projects-calendar-time-indicator {
      width: 0.5rem;
      height: 0.5rem;
    }
    
    .projects-calendar-time-line {
      height: 1.5px;
    }
  }
</style>
