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
  import type { TimelineDragManager } from '../../dnd/TimelineDragManager';
  import type { ProcessedRecord } from '../../types';
  import type { DragMode } from '../../dnd/types';

  /** Название события */
  export let title: string;
  
  /** Цвет полосы */
  export let color: string = 'var(--text-accent)';
  
  /** ID записи для обработки клика */
  export let recordId: string;
  
  /** Индекс строки в стеке (для вертикального размещения нескольких событий) */
  export let rowIndex: number = 0;
  
  /** Обработчик клика по полосе — v3.0.8: unified navigation with openMode */
  export let onClick: ((id: string, openMode?: false | 'tab' | 'window') => void) | undefined = undefined;
  
  /** Иконка события (опционально) */
  export let icon: string | undefined = undefined;
  
  /** Отображать в компактном виде (только индикатор) */
  export let compact: boolean = false;

  /** Mobile layout flag */
  export let isMobile: boolean = false;

  /** v3.2.0 Iteration 5: DnD support */
  export let dragManager: TimelineDragManager | undefined = undefined;
  export let processedRecord: ProcessedRecord | undefined = undefined;
  export let isDragging: boolean = false;
  /** v4.0.4: Hide resize handles when resize is impossible (e.g. day view) */
  export let canResize: boolean = true;
  
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
      // v3.0.8: Unified navigation — Shift → window, Ctrl → tab, else → default
      const me = e as MouseEvent;
      const openMode: false | 'tab' | 'window' = me.shiftKey ? 'window' : (me.ctrlKey || me.metaKey) ? 'tab' : false;
      onClick(recordId, openMode);
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e);
    }
  }

  let stripElement: HTMLElement;

  /** v3.2.0 Iteration 5: Initiate strip drag on mousedown */
  function handleMouseDown(event: MouseEvent) {
    if (event.button !== 0) return;
    if (!dragManager || !processedRecord) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;

    // v4.0.3: Allow extending single-day events via resize-handle-end
    const target = event.target as HTMLElement;
    let mode: DragMode = 'strip-move';
    if (target.classList.contains('resize-handle-end')) {
      mode = 'strip-resize-end';
    }

    event.preventDefault();
    dragManager.initiate(processedRecord.record, processedRecord, event, mode, stripElement);
  }

  /** v3.2.0 Iteration 5: Initiate strip drag on touch */
  function handleTouchStart(event: TouchEvent) {
    if (!dragManager || !processedRecord) return;
    if (!event.touches[0]) return;

    // v4.0.3: Allow extending single-day events via resize-handle-end
    const target = event.target as HTMLElement;
    let mode: DragMode = 'strip-move';
    if (target.classList.contains('resize-handle-end')) {
      mode = 'strip-resize-end';
    }

    dragManager.initiate(processedRecord.record, processedRecord, event, mode, stripElement);
  }
</script>

<div
  class="all-day-event-strip"
  class:compact
  class:clickable={!!onClick}
  class:mobile={isMobile}
  class:dnd-dragging={isDragging}
  class:dnd-grab={!!dragManager}
  style:--strip-color={color}
  style:--strip-height="{STRIP_HEIGHT_REM}rem"
  style:top="{topPosition}rem"
  style:line-height="{STRIP_HEIGHT_REM}rem"
  on:click={handleClick}
  on:keydown={handleKeydown}
  on:mousedown={handleMouseDown}
  on:touchstart|passive={handleTouchStart}
  bind:this={stripElement}
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
    <!-- v4.0.3: Resize handle for extending single-day events -->
    {#if dragManager && canResize}
      <div class="resize-handle-end" aria-hidden="true"></div>
    {/if}
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
    background: color-mix(in srgb, var(--strip-color) 15%, var(--background-primary));
    border-left: var(--ppp-border-width-thick, 2px) solid var(--strip-color);
    border-radius: var(--ppp-radius-md, 0.25rem);
    color: var(--text-normal);
    font-size: var(--ppp-font-size-xs, 0.6875rem);
    padding: 0 0.375rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: var(--ppp-space-2, 0.25rem);
    z-index: 1;
    transition: 
      background var(--ppp-duration-fast, 0.1s) var(--ppp-ease-out, ease),
      box-shadow var(--ppp-duration-fast, 0.1s) var(--ppp-ease-out, ease);
    box-sizing: border-box;
  }
  
  .all-day-event-strip.clickable {
    cursor: pointer;
  }

  .all-day-event-strip.clickable:focus {
    outline: none;
  }
  .all-day-event-strip.clickable:focus-visible {
    outline: 2px solid var(--strip-color);
    outline-offset: 1px;
    z-index: 3;
  }
  
  .all-day-event-strip.clickable:hover {
    background: color-mix(in srgb, var(--strip-color) 25%, var(--background-primary));
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    z-index: 2;
  }
  
  .all-day-event-strip.clickable:active {
    background: color-mix(in srgb, var(--strip-color) 35%, var(--background-primary));
    box-shadow: none;
  }

  /* v3.2.0 Iteration 5: DnD states */
  .all-day-event-strip.dnd-grab {
    cursor: grab;
  }
  .all-day-event-strip.dnd-dragging {
    opacity: 0.4;
    pointer-events: none;
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
    transform: translateX(-50%) scale(1.1);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }
  
  .all-day-dot {
    display: none;
  }
  
  .all-day-icon {
    flex-shrink: 0;
    font-size: var(--ppp-font-size-xs, 0.6875rem);
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

  /* v4.0.3: Resize handle at right edge for extending single-day events */
  .resize-handle-end {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    width: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: col-resize;
    opacity: 0;
    transition: opacity var(--ppp-duration-fast, 0.1s) var(--ppp-ease-out, ease);
    z-index: 2;
  }

  .resize-handle-end::after {
    content: '';
    display: block;
    width: 0;
    height: 0;
    border: 0.1875rem solid transparent;
    border-left-color: var(--strip-color);
    border-left-width: 0.25rem;
  }

  .all-day-event-strip:hover .resize-handle-end {
    opacity: 1;
  }

  @container view-content (max-width: 30rem) {
    .resize-handle-end {
      opacity: 1;
      width: 0.75rem;
      min-width: 2.75rem;
      margin-right: -1rem;
    }
  }
  @media (max-height: 30rem) and (orientation: landscape) {
    .resize-handle-end {
      opacity: 1;
      width: 0.75rem;
      min-width: 2.75rem;
      margin-right: -1rem;
    }
  }
</style>
