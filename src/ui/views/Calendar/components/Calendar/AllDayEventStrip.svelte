<!--
  AllDayEventStrip.svelte
  
  Горизонтальная полоса для событий "весь день" в шапке календаря.
  Размещается в header row, занимает полную ширину дня.
  
  ROADMAP §2.8 — Event strips in header
  
  Отличие от MultiDayEventStrip:
  - AllDayEventStrip: события без конкретного времени (флаг allDay)
  - MultiDayEventStrip: события с временем, но длящиеся несколько дней
  
  v8.0: Unified height system - MUST match TimelineView/HeaderStripsSection
-->
<script lang="ts">
  /** Название события */
  export let title: string;
  
  /** Цвет полосы */
  export let color: string = 'var(--text-accent)';
  
  /** ID записи для обработки клика */
  export let recordId: string;
  
  /** Индекс строки в стеке (для вертикального размещения нескольких событий) */
  export let rowIndex: number = 0;
  
  /** Обработчик клика по полосе - теперь принимает id и флаг newLeaf */
  export let onClick: ((id: string, newLeaf?: boolean) => void) | undefined = undefined;
  
  /** Иконка события (опционально) */
  export let icon: string | undefined = undefined;
  
  /** Отображать в компактном виде (только индикатор) */
  export let compact: boolean = false;

  /** Mobile layout flag */
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
  
  function handleClick(e: MouseEvent | KeyboardEvent) {
    e.stopPropagation();
    if (onClick) {
      const newLeaf = (e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey || false;
      onClick(recordId, newLeaf);
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e);
    }
  }
</script>

<div
  class="all-day-event-strip"
  class:compact
  class:clickable={!!onClick}
  class:mobile={isMobile}
  style:--strip-color={color}
  style:--strip-height="{STRIP_HEIGHT_REM}rem"
  style:top="{topPosition}rem"
  style:line-height="{STRIP_HEIGHT_REM}rem"
  on:click={handleClick}
  on:keydown={handleKeydown}
  role="button"
  tabindex="0"
  title={title}
>
  {#if compact}
    <span class="all-day-dot" />
  {:else}
    {#if icon}
      <span class="all-day-icon">{icon}</span>
    {/if}
    <span class="all-day-title">{title}</span>
  {/if}
</div>

<style>
  .all-day-event-strip {
    position: absolute;
    left: 0;
    right: 0;
    /* v8.0: Height from CSS variable - ensures sync with container */
    height: var(--strip-height, 1.25rem);
    max-height: var(--strip-height, 1.25rem);
    /* v8.3.1: Explicit line-height matches height to prevent text overflow */
    line-height: var(--strip-height, 1.25rem);
    /* v8.1: Semi-transparent background with left border accent like EventBar */
    background: color-mix(in srgb, var(--strip-color) 20%, var(--background-primary));
    border-left: 3px solid var(--strip-color);
    border-radius: 0 0.1875rem 0.1875rem 0;
    color: var(--text-normal);
    font-size: 0.6875rem;
    padding: 0 0.375rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    z-index: 1;
    transition: 
      background 0.15s ease,
      transform 0.1s ease;
    box-sizing: border-box;
  }
  
  .all-day-event-strip.clickable {
    cursor: pointer;
  }
  
  .all-day-event-strip.clickable:hover {
    background: color-mix(in srgb, var(--strip-color) 30%, var(--background-primary));
    transform: translateY(-1px);
  }
  
  .all-day-event-strip.clickable:active {
    transform: translateY(0);
  }
  
  .all-day-event-strip.compact {
    width: 0.5rem;
    height: 0.5rem;
    padding: 0;
    border-radius: 50%;
    left: 50%;
    transform: translateX(-50%);
  }
  
  .all-day-event-strip.compact.clickable:hover {
    transform: translateX(-50%) scale(1.2);
  }
  
  .all-day-dot {
    display: none;
  }
  
  .all-day-icon {
    flex-shrink: 0;
    font-size: 0.625rem;
  }
  
  .all-day-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
    /* v8.3.3: Force line-height to prevent inheritance */
    line-height: 1;
  }
  
  /* v8.0: Mobile styles - height controlled via CSS variable */
  .all-day-event-strip.mobile {
    font-size: 0.5625rem;
    padding: 0 0.25rem;
  }
  
  .all-day-event-strip.mobile .all-day-title {
    font-size: 0.5625rem;
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    .all-day-event-strip {
      border: 1px solid var(--text-on-accent);
    }
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .all-day-event-strip {
      transition: none;
    }
    
    .all-day-event-strip.compact.clickable:hover {
      transform: translateX(-50%);
    }
  }
</style>
