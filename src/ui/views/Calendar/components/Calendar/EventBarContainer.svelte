<script lang="ts">
  import type { DataRecord } from 'src/lib/dataframe/dataframe';
  import dayjs from 'dayjs';
  import EventBar from './EventBar.svelte';
  import type { ProcessedRecord } from '../../types';
  import type { TimelineDragManager } from '../../dnd/TimelineDragManager';
  import { app } from 'src/lib/stores/obsidian';
  
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
   * layoutTimelineEvents - Proper collision detection algorithm
   * 
   * Creates columns where events don't overlap within the same column.
   * Events are placed in the first available column (greedy).
   * Each event knows its column index and total columns for width calculation.
   */
  function layoutTimelineEvents(inputEvents: EventInput[]): EventWithColumn[] {
    if (inputEvents.length === 0) return [];
    
    // Sort by start time, then by duration (longer first for visual consistency)
    const sorted = [...inputEvents].sort((a, b) => {
      const startDiff = a.startDate.valueOf() - b.startDate.valueOf();
      if (startDiff !== 0) return startDiff;
      
      // Longer events first (they anchor the visual layout)
      const aEnd = a.endDate || a.startDate.add(1, 'hour');
      const bEnd = b.endDate || b.startDate.add(1, 'hour');
      const aDuration = aEnd.valueOf() - a.startDate.valueOf();
      const bDuration = bEnd.valueOf() - b.startDate.valueOf();
      return bDuration - aDuration;
    });
    
    // Columns: each column is array of events that don't overlap
    // columns[i] contains events in column i
    // columnEndTimes[i] = end time of last event in column i
    const columns: EventInput[][] = [];
    const columnEndTimes: dayjs.Dayjs[] = [];
    const eventColumnMap = new Map<EventInput, number>();
    
    // Pass 1: Assign columns (greedy)
    for (const event of sorted) {
      const eventStart = event.startDate;
      const eventEndRaw = event.endDate || event.startDate.add(1, 'hour');
      
      // v8.2: Min visual duration = 20 minutes (synced with EventBar.svelte MIN_VISUAL_MINUTES)
      // Short events are rendered with min-height, collision detection MUST use the same value
      const MIN_VISUAL_DURATION_MINUTES = 20;
      const minEnd = eventStart.add(MIN_VISUAL_DURATION_MINUTES, 'minute');
      const eventEnd = eventEndRaw.isBefore(minEnd) ? minEnd : eventEndRaw;
      
      // Find first column where event fits (starts AFTER column's last event ends)
      // v8.3: Use isAfter (not isSameOrAfter) because eventEnd already includes visual min-height
      // If event A visually ends at 09:20 and event B starts at 09:00, they MUST be in different columns
      let assignedColumn = -1;
      for (let i = 0; i < columns.length; i++) {
        // Event fits ONLY if it starts AFTER the visual end of previous event
        if (eventStart.isAfter(columnEndTimes[i])) {
          assignedColumn = i;
          break;
        }
      }
      
      if (assignedColumn === -1) {
        // No available column, create new one
        assignedColumn = columns.length;
        columns.push([]);
        columnEndTimes.push(eventEnd);
      } else {
        // Update column end time
        columnEndTimes[assignedColumn] = eventEnd;
      }
      
      columns[assignedColumn]!.push(event);
      eventColumnMap.set(event, assignedColumn);
    }
    
    // Pass 2: Per-group totalColumns — only actually-overlapping events share width.
    // For each event, find the maximum column index among all events that overlap with
    // it (i.e., share at least one minute of time). totalColumns = max_overlap_col + 1.
    // This prevents non-overlapping events from inheriting a narrow width.
    const MIN_VISUAL_MINUTES = 20;
    const result: EventWithColumn[] = [];
    for (const event of sorted) {
      const column = eventColumnMap.get(event) ?? 0;
      const evStart = event.startDate;
      const evEndRaw = event.endDate || event.startDate.add(1, 'hour');
      const evEnd = evEndRaw.isBefore(evStart.add(MIN_VISUAL_MINUTES, 'minute'))
        ? evStart.add(MIN_VISUAL_MINUTES, 'minute') : evEndRaw;

      let maxCol = column;
      for (const other of sorted) {
        if (other === event) continue;
        const otherStart = other.startDate;
        const otherEndRaw = other.endDate || other.startDate.add(1, 'hour');
        const otherEnd = otherEndRaw.isBefore(otherStart.add(MIN_VISUAL_MINUTES, 'minute'))
          ? otherStart.add(MIN_VISUAL_MINUTES, 'minute') : otherEndRaw;
        // Events overlap when neither ends before the other starts
        if (evStart.isBefore(otherEnd) && evEnd.isAfter(otherStart)) {
          const otherCol = eventColumnMap.get(other) ?? 0;
          if (otherCol > maxCol) maxCol = otherCol;
        }
      }

      result.push({ ...event, column, totalColumns: maxCol + 1 });
    }
    
    return result;
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
      $app.workspace.openLinkText(record.id, record.id, 'window');
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl+click: open in new tab
      $app.workspace.openLinkText(record.id, record.id, 'tab');
    } else {
      // Normal click → modal
      onEventClick(record);
    }
  }
</script>

<div class="projects-calendar-event-bar-container">
  {#each eventsWithColumns as event (event.record.id + event.startDate.valueOf())}
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
      isDragging={draggingRecordId === event.record.id}
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
