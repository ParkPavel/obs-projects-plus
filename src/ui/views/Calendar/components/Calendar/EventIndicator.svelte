<script lang="ts">
  /**
   * EventIndicator - Triangle indicator for events outside visible hours
   * Shows ▲ for events before startHour, ▼ for events after endHour
   * Per ROADMAP_V3.0.0 §2.3 - Временная относительность в ячейках
   */
  
  export let position: 'top' | 'bottom';
  export let color: string = 'var(--text-accent)';
  export let count: number = 1;
  export let onClick: (() => void) | undefined = undefined;
</script>

{#if onClick}
  <button
    class="projects-calendar-event-indicator"
    class:top={position === 'top'}
    class:bottom={position === 'bottom'}
    style="--indicator-color: {color}"
    on:click={onClick}
    title={position === 'top' 
      ? `${count} event(s) before visible hours` 
      : `${count} event(s) after visible hours`}
    type="button"
  >
    <span class="indicator-triangle">
      {position === 'top' ? '▲' : '▼'}
    </span>
    {#if count > 1}
      <span class="indicator-count">{count}</span>
    {/if}
  </button>
{:else}
  <div
    class="projects-calendar-event-indicator"
    class:top={position === 'top'}
    class:bottom={position === 'bottom'}
    style="--indicator-color: {color}"
    title={position === 'top' 
      ? `${count} event(s) before visible hours` 
      : `${count} event(s) after visible hours`}
  >
    <span class="indicator-triangle">
      {position === 'top' ? '▲' : '▼'}
    </span>
    {#if count > 1}
      <span class="indicator-count">{count}</span>
    {/if}
  </div>
{/if}

<style>
  .projects-calendar-event-indicator {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background: color-mix(in srgb, var(--indicator-color) 20%, transparent);
    border: 1px solid var(--indicator-color);
    z-index: 5;
    cursor: default;
    transition: all 0.15s ease;
  }
  
  .projects-calendar-event-indicator.top {
    top: 0.125rem;
  }
  
  .projects-calendar-event-indicator.bottom {
    bottom: 0.125rem;
  }
  
  button.projects-calendar-event-indicator {
    cursor: pointer;
    border: none;
    font-family: inherit;
  }
  
  button.projects-calendar-event-indicator:hover {
    background: color-mix(in srgb, var(--indicator-color) 35%, transparent);
    transform: translateX(-50%) scale(1.05);
  }
  
  button.projects-calendar-event-indicator:active {
    transform: translateX(-50%) scale(0.98);
  }
  
  .indicator-triangle {
    font-size: 0.625rem;
    line-height: 1;
    color: var(--indicator-color);
  }
  
  .indicator-count {
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--indicator-color);
  }
  
  /* Mobile adaptivity */
  @media (max-width: 48rem) {
    .projects-calendar-event-indicator {
      padding: 0.0625rem 0.25rem;
    }
    
    .indicator-triangle {
      font-size: 0.5rem;
    }
    
    .indicator-count {
      font-size: 0.5625rem;
    }
  }
</style>
