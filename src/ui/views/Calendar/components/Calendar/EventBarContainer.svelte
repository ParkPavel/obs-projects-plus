<script lang="ts">
  import type { DataRecord } from 'src/lib/dataframe/dataframe';
  import dayjs from 'dayjs';
  import { readable } from 'svelte/store';
  import EventBar from './EventBar.svelte';
  import type { ProcessedRecord } from '../../types';
  import { barDragView, type TimelineDragManager } from '../../dnd/TimelineDragManager';
  import { app } from 'src/lib/stores/obsidian';
  import { openRecord } from "src/lib/record/openRecord";
  import { layoutOverlapClusters, MIN_EVENT_VISUAL_MINUTES } from '../../utils/eventLayout';
  
  /**
   * EventBarContainer - Manages overlapping event bars with collision detection
   * 
   * Algorithm: Column-based layout (layoutTimelineEvents from ARCHITECTURE.md)
   * - Sort by start time
   * - Greedy column assignment: place event in first column where it fits
   * - "Fits" = event starts after the last event in that column ends
   * - Track max concurrent events for width calculation
   */
  
  type EventInput = {
    record: DataRecord;
    startDate: dayjs.Dayjs;
    endDate: dayjs.Dayjs | null;
    color: string;
  };
  
  export let events: EventInput[] = [];
  export let startHour: number = 0;
  export let endHour: number = 24;
  export let hourHeightRem: number = 3; // Height per hour in rem
  export let onEventClick: ((record: DataRecord) => void) | undefined = undefined;

  /** v3.2.0 DnD: ProcessedRecords for matching drag context */
  export let processedRecords: ProcessedRecord[] = [];
  /** v3.2.0 DnD: TimelineDragManager instance */
  export let dragManager: TimelineDragManager | undefined = undefined;
  /** v3.2.0 DnD: Record ID currently being dragged */
  export let draggingRecordId: string | null = null;

  // ios-c1: `draggingRecordId` follows the manager's `dragRecordId`, set on the
  // PRESS and kept for the re-grab window. EventBar dims with
  // `pointer-events: none` from `isDragging`, which took a bar out of
  // hit-testing between press and release, so a click landed beneath it.
  // ios-p1: dimming and the handles are two states (`barDragView`). The bar
  // dims only while its drag runs; while a touch long press is armed, the
  // re-grab window after a touch drag included, it shows its handles at full
  // opacity and stays hit-testable. A mouse never sets `longPressActive`.
  const noDrag = readable<string | null>(null);
  const noLongPress = readable(false);
  $: draggedRecordId = dragManager?.draggedRecordId ?? noDrag;
  $: longPressActive = dragManager?.longPressActive ?? noLongPress;

  // Map record IDs to ProcessedRecords for quick lookup
  $: processedRecordMap = new Map<string, ProcessedRecord>(
    processedRecords.map(pr => [pr.record.id, pr])
  );
  
  interface EventWithColumn {
    record: DataRecord;
    startDate: dayjs.Dayjs;
    endDate: dayjs.Dayjs | null;
    color: string;
    column: number;
    totalColumns: number;
  }
  
  /**
   * layoutTimelineEvents - cluster-of-overlaps → columns (shared with month bars).
   * Width is per overlap cluster; short events collide by the minimum visual
   * height EventBar draws them at (one shared MIN_EVENT_VISUAL_MINUTES).
   */
  const MIN_VISUAL_MS = MIN_EVENT_VISUAL_MINUTES * 60 * 1000;
  function layoutTimelineEvents(inputEvents: EventInput[]): EventWithColumn[] {
    const slots = layoutOverlapClusters(
      inputEvents.map((e) => ({
        start: e.startDate.valueOf(),
        end: (e.endDate ?? e.startDate.add(1, 'hour')).valueOf(),
      })),
      MIN_VISUAL_MS,
    );
    return inputEvents.map((e, i) => ({ ...e, ...(slots[i] ?? { column: 0, totalColumns: 1 }) }));
  }

  // v7.1: Data fingerprint for reactivity - changes when events content changes
  $: eventsFingerprint = events.length + 
    events.map(e => e.record.id + e.startDate.valueOf() + (e.endDate?.valueOf() ?? 0) + e.color).join('|');
  
  // Force re-evaluation when fingerprint changes
  $: eventsWithColumns = (() => {
    eventsFingerprint; // Explicit dependency
    return layoutTimelineEvents(events);
  })();
  
  /**
   * Handle event click with modifier key support for navigation
   * v3.0.8: Shift → new window, Ctrl → new tab, else → modal
   */
  function handleEventClick(event: MouseEvent, record: DataRecord) {
    if (!onEventClick) return;
    
    if (event.shiftKey) {
      // Shift+click: open in new window
      void openRecord({ id: record.id }, "window", { app: $app });
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl+click: open in new tab
      void openRecord({ id: record.id }, "tab", { app: $app });
    } else {
      // Normal click → modal
      onEventClick(record);
    }
  }
</script>

<div class="projects-calendar-event-bar-container">
  {#each eventsWithColumns as event (event.record.id + event.startDate.valueOf())}
    {@const drag = barDragView(event.record.id, draggingRecordId, $draggedRecordId, $longPressActive)}
    <EventBar
      record={event.record}
      startDate={event.startDate}
      endDate={event.endDate}
      startHour={startHour}
      endHour={endHour}
      color={event.color}
      column={event.column}
      totalColumns={event.totalColumns}
      {hourHeightRem}
      onClick={onEventClick ? (e) => handleEventClick(e, event.record) : undefined}
      processedRecord={processedRecordMap.get(event.record.id)}
      {dragManager}
      isDragging={drag.dimmed}
      showHandles={drag.handlesVisible}
    />
  {/each}
</div>

<style>
  .projects-calendar-event-bar-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    /* v3.3.4: Allow clicks to pass through to DayColumn for creation DnD */
    pointer-events: none;
    /* Absolute positioning inside rem-sized DayColumn parent */
  }
</style>
