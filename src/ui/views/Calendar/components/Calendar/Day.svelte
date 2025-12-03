<script lang="ts">
  import dayjs from "dayjs";
  import { Menu } from "obsidian";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { createEventDispatcher } from "svelte";
  import DateDisplay from "./Date.svelte";
  import EventList from "./EventList.svelte";
  import { menuOnContextMenu } from "src/ui/views/helpers";

  /**
   * Specifies the date of the day.
   */
  export let date: dayjs.Dayjs;

  /**
   * Whether this day is outside the current month (for grid alignment).
   */
  export let isOutsideMonth: boolean = false;

  /**
   * Specifies the width of the day div.
   */
  export let width: number;

  /**
   * Specifies the records representing the calendar events.
   */
  export let records: DataRecord[];

  /**
   * Specifies the field to use for determining checkbox state.
   */
  export let checkField: string | undefined;

  /**
   * onRecordClick runs when the user clicks a calendar event.
   */
  export let onRecordClick: ((record: DataRecord) => void) | undefined;

  /**
   * onRecordCheck runs when the user Checks / Unchecks a calendar event.
   */
  export let onRecordCheck: ((record: DataRecord, checked: boolean) => void) | undefined;

  /**
   * onRecordChange runs when the user changes the record (e.g. date).
   */
  export let onRecordChange: ((date: dayjs.Dayjs, record: DataRecord) => void) | undefined;

  /**
   * onRecordAdd runs when the user creates a new calendar event on this day.
   */
  export let onRecordAdd: ((date: dayjs.Dayjs) => void) | undefined;
  
  /**
   * Whether mobile mode is enabled (disables drag, enables tap interactions)
   */
  export let isMobile: boolean = false;
  
  /**
   * Callback when day is tapped on mobile (opens popup)
   */
  export let onDayTap: ((date: dayjs.Dayjs, records: DataRecord[]) => void) | undefined;

  const dispatch = createEventDispatcher<{
    dayTap: { date: dayjs.Dayjs; records: DataRecord[] };
  }>();

  let eventListOnRecordChange: ((record: DataRecord) => void) | undefined = undefined;

  $: eventListOnRecordChange = date && onRecordChange && !isOutsideMonth && !isMobile 
    ? (r => onRecordChange!(date, r)) 
    : undefined;

  $: weekend = date.day() === 0 || date.day() === 6;
  $: today = date.startOf("day").isSame(dayjs().startOf("day"));

  // Mobile tap handling
  let tapTimeout: ReturnType<typeof setTimeout> | null = null;
  let tapCount = 0;
  let touchStartTime = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  const TAP_THRESHOLD = 10; // Max movement for a tap
  const DOUBLE_TAP_DELAY = 300;

  function handleTouchStart(event: TouchEvent) {
    if (isOutsideMonth) return;
    if (!isMobile) return;
    
    const touch = event.touches[0];
    if (touch) {
      touchStartTime = Date.now();
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    if (isOutsideMonth) return;
    if (!isMobile) return;
    
    const touch = event.changedTouches[0];
    if (!touch) return;
    
    // Check if it was a tap (not a scroll/swipe)
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);
    const touchDuration = Date.now() - touchStartTime;
    
    if (deltaX > TAP_THRESHOLD || deltaY > TAP_THRESHOLD || touchDuration > 500) {
      // This was a scroll/swipe, ignore
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    tapCount++;
    
    if (tapTimeout) {
      clearTimeout(tapTimeout);
    }
    
    tapTimeout = setTimeout(() => {
      if (tapCount === 1) {
        // Single tap - open day popup
        onDayTap?.(date, records);
        dispatch('dayTap', { date, records });
      } else if (tapCount >= 2) {
        // Double tap - create new note
        onRecordAdd?.(date);
      }
      tapCount = 0;
    }, DOUBLE_TAP_DELAY);
  }

  function handleDblClick(event: MouseEvent) {
    if (isOutsideMonth) return;
    if (isMobile) return; // Handled by tap
    onRecordAdd?.(date);
  }

  function handleMouseDown(event: MouseEvent) {
    if (isOutsideMonth) return;
    if (isMobile) return;
    if (event.button === 2) {
      const menu = new Menu().addItem((item) => {
        item
          .setTitle($i18n.t("views.calendar.new-note"))
          .setIcon("file-plus")
          .onClick(() => onRecordAdd?.(date!));
      });
      menuOnContextMenu(event, menu);
    }
  }
</script>

<div
  class="day-cell"
  class:weekend
  class:today
  class:outside-month={isOutsideMonth}
  class:mobile={isMobile}
  data-date={date.format('YYYY-MM-DD')}
  on:dblclick={handleDblClick}
  on:mousedown={handleMouseDown}
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
  style:width={width + "%"}
  role="gridcell"
  aria-selected={today}
  aria-disabled={isOutsideMonth}
  tabindex={isOutsideMonth ? -1 : 0}
  on:keydown={(e) => {
    if (isOutsideMonth) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isMobile) {
        onDayTap?.(date, records);
      } else {
        handleDblClick(new MouseEvent('dblclick', { bubbles: true }));
      }
    }
  }}
>
  <DateDisplay {today} outsideMonth={isOutsideMonth}>{date.date()}</DateDisplay>
  {#if !isOutsideMonth}
    <EventList
      {checkField}
      {records}
      {onRecordClick}
      {onRecordCheck}
      onRecordChange={eventListOnRecordChange}
      disableDrag={isMobile}
    />
  {/if}
</div>

<style>
  .day-cell {
    position: relative;
    border-right: 1px solid var(--background-modifier-border);
    padding: 6px;
    font-size: var(--font-ui-small);
    display: flex;
    flex-direction: column;
    gap: 4px;
    outline: none;
    min-height: 105px;
    height: 100%;
    overflow: visible;
    transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    background: var(--background-primary);
    border-radius: 0;
  }

  .day-cell:not(.outside-month):hover {
    background: var(--background-secondary);
  }

  .day-cell:not(.outside-month):focus {
    box-shadow: inset 0 0 0 2px var(--interactive-accent);
    z-index: 1;
  }

  .day-cell:last-child {
    border-right: 0;
  }

  /* Today highlight - border instead of ellipse */
  .day-cell.today {
    background: hsla(var(--interactive-accent-hsl), 0.08);
    box-shadow: inset 0 0 0 2px var(--interactive-accent);
    border-radius: 8px;
  }

  .day-cell.today:hover {
    background: hsla(var(--interactive-accent-hsl), 0.12);
  }

  /* Weekend styling */
  .day-cell.weekend:not(.outside-month):not(.today) {
    background: var(--background-primary-alt);
  }

  .day-cell.weekend:not(.outside-month):not(.today):hover {
    background: var(--background-modifier-hover);
  }

  /* Outside month (inactive days) */
  .day-cell.outside-month {
    background: var(--background-secondary);
    opacity: 0.5;
    cursor: default;
    pointer-events: none;
  }

  .day-cell.outside-month:hover {
    background: var(--background-secondary);
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .day-cell {
      padding: 4px;
      min-height: 90px;
      gap: 3px;
    }
  }

  @media (max-width: 480px) {
    .day-cell {
      padding: 4px;
      min-height: 140px; /* 2x height for mobile */
      gap: 3px;
      font-size: 12px;
    }
  }

  /* Mobile mode specific */
  .day-cell.mobile {
    min-height: 140px;
    cursor: pointer;
  }

  .day-cell.mobile:active {
    background: var(--background-modifier-hover);
    transform: scale(0.98);
  }

  /* Touch device optimizations */
  @media (pointer: coarse) {
    .day-cell {
      min-height: 140px; /* 2x height for touch devices */
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    .day-cell:active:not(.outside-month) {
      background: var(--background-modifier-hover);
    }
  }
</style>
