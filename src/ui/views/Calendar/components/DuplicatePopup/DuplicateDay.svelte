<script lang="ts">
  import dayjs from "dayjs";
  import type { ProcessedRecord } from "../../types";
  import { EventRenderType } from "../../types";
  import { getDisplayName } from "src/ui/views/Board/components/Board/boardHelpers";
  import DateDisplay from "../Calendar/Date.svelte";
  import { isPhantomRecord } from "src/lib/duplicate/phantomRecord";
  
  export let date: dayjs.Dayjs;
  export let isOutsideMonth: boolean = false;
  export let processedRecords: ProcessedRecord[] = [];
  export let displayMode: 'list' | 'bars' = 'bars';
  export let startHourConfig: number = 7;
  export let endHourConfig: number = 21;
  export let isSelected: boolean = false;
  export let onClick: () => void;
  
  $: START_HOUR = startHourConfig;
  $: END_HOUR = endHourConfig;
  $: HOUR_RANGE = END_HOUR - START_HOUR;
  
  $: weekend = date.day() === 0 || date.day() === 6;
  $: today = date.startOf("day").isSame(dayjs().startOf("day"));
  
  // Only show timed events (multi-day/all-day in header strips)
  $: timedRecords = processedRecords.filter(pr => pr.renderType === EventRenderType.TIMED && pr.timeInfo);
  
  interface TimedBar {
    record: ProcessedRecord;
    color: string | null;
    label: string;
    topPercent: number;
    heightPercent: number;
    startTime: string;
    endTime: string;
    isPhantom: boolean;
  }
  
  $: timedBars = timedRecords.map(pr => {
    const { startTime, endTime } = pr.timeInfo!;
    
    const startHourVal = startTime.hour() + startTime.minute() / 60;
    const endHourVal = endTime.hour() + endTime.minute() / 60;
    
    const clampedStart = Math.max(startHourVal, START_HOUR);
    const clampedEnd = Math.min(endHourVal, END_HOUR);
    
    const topPercent = ((clampedStart - START_HOUR) / HOUR_RANGE) * 100;
    const MIN_HEIGHT_PERCENT = 5;
    const actualHeightPercent = ((clampedEnd - clampedStart) / HOUR_RANGE) * 100;
    const heightPercent = Math.max(MIN_HEIGHT_PERCENT, actualHeightPercent);
    
    return {
      record: pr,
      color: pr.color,
      label: getDisplayName(pr.record.id) ?? pr.record.id,
      topPercent,
      heightPercent,
      startTime: startTime.format('HH:mm'),
      endTime: endTime.format('HH:mm'),
      isPhantom: isPhantomRecord(pr),
    };
  }) as TimedBar[];
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div 
  class="duplicate-day" 
  class:duplicate-day-outside-month={isOutsideMonth}
  class:duplicate-day-selected={isSelected && !isOutsideMonth}
  class:duplicate-day-weekend={weekend}
  class:duplicate-day-today={today}
  data-date={date.format('YYYY-MM-DD')}
  on:click={isOutsideMonth ? undefined : onClick}
>
  {#if !isOutsideMonth}
    <div class="duplicate-day-header">
      <DateDisplay today={today} outsideMonth={isOutsideMonth}>
        {date.format('D')}
      </DateDisplay>
    </div>
    
    {#if displayMode === 'bars' && timedBars.length > 0}
      <div class="duplicate-day-bars">
        {#each timedBars as bar}
          <div 
            class="duplicate-day-bar"
            class:duplicate-day-bar-phantom={bar.isPhantom}
            style:top="{bar.topPercent}%"
            style:height="{bar.heightPercent}%"
            style:background-color={bar.color || 'var(--interactive-accent)'}
            title="{bar.label}\n{bar.startTime} - {bar.endTime}"
          >
            <span class="duplicate-day-bar-label">{bar.label}</span>
          </div>
        {/each}
      </div>
    {/if}
    
    {#if isSelected}
      <div class="duplicate-day-selection-overlay">
        <svg class="duplicate-day-checkmark" viewBox="0 0 24 24">
          <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </div>
    {/if}
  {/if}
</div>

<style>
  .duplicate-day {
    position: relative;
    flex: 1 1 14.28%;
    min-height: 8rem;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    cursor: pointer;
    overflow: visible;
    transition: background-color 0.15s ease;
  }
  
  .duplicate-day:hover:not(.duplicate-day-outside-month) {
    background: var(--background-primary-alt);
  }
  
  .duplicate-day-outside-month {
    opacity: 0.3;
    pointer-events: none;
    cursor: default;
  }
  
  /* Selected day - minimal indicator, no overlay */
  .duplicate-day-selected {
    /* No background change - just border, handled by parent */
    opacity: 1;
  }
  
  .duplicate-day-weekend {
    background: var(--background-secondary);
  }
  
  /* Today - green border only */
  .duplicate-day-today {
    border: 2px solid var(--interactive-accent);
  }
  
  /* Selected + Today - today takes priority */
  .duplicate-day-today.duplicate-day-selected {
    border: 2px solid var(--interactive-accent);
  }
  
  .duplicate-day-header {
    padding: 0.25rem 0.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .duplicate-day-bars {
    position: absolute;
    top: 1.75rem;
    left: 0.25rem;
    right: 0.25rem;
    bottom: 0.25rem;
  }
  
  .duplicate-day-bar {
    position: absolute;
    left: 0;
    right: 0;
    padding: 0.125rem 0.25rem;
    border-radius: 2px;
    font-size: 0.75rem;
    color: white;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: opacity 0.2s ease;
    z-index: 1;
  }
  
  .duplicate-day-bar-phantom {
    opacity: 0.7;
    border: 2px dashed rgba(255, 255, 255, 0.9);
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 4px,
      rgba(255, 255, 255, 0.1) 4px,
      rgba(255, 255, 255, 0.1) 8px
    );
  }
  
  .duplicate-day-bar-label {
    font-weight: 500;
  }
  
  .duplicate-day-selection-overlay {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    width: 1.25rem;
    height: 1.25rem;
    background: var(--interactive-accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 10;
  }
  
  .duplicate-day-checkmark {
    width: 0.875rem;
    height: 0.875rem;
    color: var(--text-on-accent);
  }
</style>
