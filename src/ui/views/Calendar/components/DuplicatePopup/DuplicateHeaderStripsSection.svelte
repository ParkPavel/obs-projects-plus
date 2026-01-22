<script lang="ts">
  import dayjs from "dayjs";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { EventRenderType, type ProcessedCalendarData } from "../../types";
  import { getDisplayName } from "src/ui/views/Board/components/Board/boardHelpers";
  import { isPhantomRecord } from "src/lib/duplicate/phantomRecord";
  
  export let weekDates: dayjs.Dayjs[];
  export let processedData: ProcessedCalendarData | null = null;
  export const firstDayOfWeek: number = 1;
  
  interface MultiDaySegment {
    record: DataRecord;
    lane: number;
    isStart: boolean;
    isEnd: boolean;
    color: string | null;
    label: string;
    isPhantom: boolean;
  }
  
  interface LaneData {
    lane: number;
    segments: Map<string, MultiDaySegment>;
  }
  
  function getEventsForWeek(
    dates: dayjs.Dayjs[],
    data: ProcessedCalendarData | null
  ): { multiDayByLane: LaneData[] } {
    const multiDayByLane: LaneData[] = [];
    
    if (!data || !data.processed || dates.length === 0) {
      return { multiDayByLane };
    }
    
    const weekStart = dates[0];
    const weekEnd = dates[dates.length - 1];
    const laneMap = new Map<number, Map<string, MultiDaySegment>>();
    const processedEvents = new Set<string>();
    
    for (const pr of data.processed) {
      if (pr.renderType !== EventRenderType.MULTI_DAY_ALLDAY &&
          pr.renderType !== EventRenderType.MULTI_DAY_TIMED &&
          pr.renderType !== EventRenderType.ALL_DAY) {
        continue;
      }
      
      if (processedEvents.has(pr.record.id)) continue;
      
      const eventStart = pr.spanInfo?.startDate || pr.startDate;
      const eventEnd = pr.spanInfo?.endDate || pr.endDate;
      
      if (!eventStart) continue;
      
      const effectiveEnd = eventEnd || eventStart;
      const intersects = 
        (eventStart.isSame(weekEnd, 'day') || eventStart.isBefore(weekEnd, 'day')) &&
        (effectiveEnd.isSame(weekStart, 'day') || effectiveEnd.isAfter(weekStart, 'day'));
      
      if (!intersects) continue;
      
      processedEvents.add(pr.record.id);
      const lane = pr.lane ?? 0;
      
      if (!laneMap.has(lane)) {
        laneMap.set(lane, new Map());
      }
      
      const laneSegments = laneMap.get(lane)!;
      
      for (const date of dates) {
        const dateKey = date.format("YYYY-MM-DD");
        const isInSpan = 
          (date.isSame(eventStart, 'day') || date.isAfter(eventStart, 'day')) &&
          (date.isSame(effectiveEnd, 'day') || date.isBefore(effectiveEnd, 'day'));
        
        if (isInSpan) {
          laneSegments.set(dateKey, {
            record: pr.record,
            lane,
            isStart: date.isSame(eventStart, 'day'),
            isEnd: date.isSame(effectiveEnd, 'day'),
            color: pr.color,
            label: getDisplayName(pr.record.id) ?? pr.record.id,
            isPhantom: isPhantomRecord(pr),
          });
        }
      }
    }
    
    laneMap.forEach((segments, lane) => {
      multiDayByLane.push({ lane, segments });
    });
    
    multiDayByLane.sort((a, b) => a.lane - b.lane);
    
    return { multiDayByLane };
  }
  
  $: ({ multiDayByLane } = getEventsForWeek(weekDates, processedData));
  
  function getSegmentStyle(segment: MultiDaySegment, dateIndex: number): string {
    const left = dateIndex * 14.28;
    let width = 14.28;
    let extend = 0;
    
    if (!segment.isEnd) {
      const remainingDays = 7 - dateIndex;
      width = 14.28 * remainingDays;
      extend = 1;
    }
    
    return `left: ${left}%; width: calc(${width}% + ${extend}px);`;
  }
</script>

{#if multiDayByLane.length > 0}
  <div class="duplicate-header-strips-section">
    {#each multiDayByLane as { segments }}
      <div class="duplicate-header-strip-lane">
        {#each weekDates as date, i}
          {@const dateKey = date.format("YYYY-MM-DD")}
          {@const segment = segments.get(dateKey)}
          
          {#if segment && segment.isStart}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div 
              class="duplicate-header-strip-segment"
              class:duplicate-header-strip-segment-phantom={segment.isPhantom}
              style="{getSegmentStyle(segment, i)} background-color: {segment.color || 'var(--interactive-accent)'};"
              title={segment.label}
            >
              <span class="duplicate-header-strip-label">{segment.label}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/each}
  </div>
{/if}

<style>
  .duplicate-header-strips-section {
    display: flex;
    flex-direction: column;
    position: relative;
    width: 100%;
    min-height: 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border-hover);
    background: var(--background-secondary-alt);
  }
  
  .duplicate-header-strip-lane {
    position: relative;
    height: 1.5rem;
    width: 100%;
  }
  
  .duplicate-header-strip-segment {
    position: absolute;
    top: 0.125rem;
    height: 1.25rem;
    border-radius: 3px;
    padding: 0 0.375rem;
    display: flex;
    align-items: center;
    color: white;
    font-size: 0.75rem;
    font-weight: 500;
    overflow: hidden;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }
  
  .duplicate-header-strip-segment:hover {
    opacity: 0.9;
  }
  
  .duplicate-header-strip-segment-phantom {
    opacity: 0.75;
    border: 2px dashed rgba(255, 255, 255, 0.9);
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 3px,
      rgba(255, 255, 255, 0.1) 3px,
      rgba(255, 255, 255, 0.1) 6px
    ) !important;
  }
  
  .duplicate-header-strip-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
