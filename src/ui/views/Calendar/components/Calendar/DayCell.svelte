<script lang="ts">
  import dayjs from "dayjs";
  import { Menu } from "obsidian";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { menuOnContextMenu } from "src/ui/views/helpers";
  import { getRecordColorContext } from "src/ui/views/helpers";
  import { get } from "svelte/store";

  export let day: dayjs.Dayjs;
  export let month: dayjs.Dayjs;
  export let records: DataRecord[];
  export let checkField: string | undefined;
  export let isInCurrentMonth: boolean = true;
  export let onRecordClick: (record: DataRecord) => void;
  export let onRecordCheck: (record: DataRecord, checked: boolean) => void;
  export let onRecordAdd: (date: dayjs.Dayjs) => void;

  $: weekend = day.day() === 0 || day.day() === 6;
  $: today = day.startOf("day").isSame(dayjs().startOf("day"));
  $: isCurrentMonth = isInCurrentMonth && day.month() === month.month();
  $: getRecordColor = getRecordColorContext.get();

  // Color bar visualization for events
  $: eventBars = records.map((record, index) => {
    const color = getRecordColor?.(record) || getDefaultEventColor(record, index);
    return {
      record,
      color
    };
  });

  function getDefaultEventColor(record: DataRecord, index: number): string {
    // Generate consistent colors based on record properties
    const colors = [
      'var(--interactive-accent)',
      'var(--text-accent)',
      'var(--background-secondary)',
      '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'
    ];
    return colors[index % colors.length];
  }

  function handleDblClick(event: MouseEvent) {
    if (isCurrentMonth) {
      onRecordAdd(day);
    }
  }

  function handleMouseDown(event: MouseEvent) {
    if (event.button === 2 && isCurrentMonth) {
      const menu = new Menu().addItem((item) => {
        item
          .setTitle($i18n.t("views.calendar.new-note"))
          .setIcon("file-plus")
          .onClick(() => onRecordAdd(day));
      });
      menuOnContextMenu(event, menu);
    }
  }

  function handleEventClick(event: DataRecord) {
    onRecordClick(event);
  }

  function handleEventCheck(event: DataRecord, checked: boolean) {
    if (checkField) {
      onRecordCheck(event, checked);
    }
  }
</script>

<div
  class="day-cell"
  class:weekend
  class:today
  class:other-month={!isCurrentMonth}
  data-date={day.format('YYYY-MM-DD')}
  on:dblclick={handleDblClick}
  on:mousedown={handleMouseDown}
>
  <div class="day-number">
    {day.date()}
  </div>
  
  <div class="events-container">
    {#each eventBars as { record, color } (record.id)}
      <div
        class="event-bar"
        style="background-color: {color};"
        on:click={() => handleEventClick(record)}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && handleEventClick(record)}
        title={record.values.name || record.values.title || 'Untitled'}
      >
        {#if checkField && record.values[checkField]}
          <input
            type="checkbox"
            class="event-check"
            checked={record.values[checkField]}
            on:click|stopPropagation={(e) => {
              e.stopPropagation();
              handleEventCheck(record, e.currentTarget.checked);
            }}
          />
        {/if}
      </div>
    {/each}
    
    <!-- Empty space for additional events if too many -->
    {#if records.length > 5}
      <div class="more-events">
        +{records.length - 5} more
      </div>
    {/if}
  </div>
</div>

<style>
  .day-cell {
    border-right: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    display: flex;
    flex-direction: column;
    height: 120px; /* Fixed height instead of min-height */
    position: relative;
    cursor: pointer;
  }

  .day-cell:last-child {
    border-right: none;
  }

  .other-month {
    background: var(--background-secondary);
    opacity: 0.5;
    cursor: default;
  }

  .weekend {
    background: var(--background-primary-alt);
  }

  .today {
    background: var(--background-modifier-hover);
    box-shadow: inset 0 0 0 2px var(--interactive-accent);
  }

  .day-number {
    padding: 0.25rem 0.5rem 0.125rem 0.5rem;
    font-size: var(--font-ui-small);
    font-weight: 500;
    color: var(--text-muted);
    text-align: right;
    line-height: 1;
    min-height: 1.2rem;
  }

  .today .day-number {
    color: var(--interactive-accent);
    font-weight: 700;
  }

  .other-month .day-number {
    color: var(--text-faint);
  }

  .events-container {
    flex: 1;
    padding: 0.125rem 0.25rem 0.25rem 0.25rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }

  .event-bar {
    border-radius: 1px;
    cursor: pointer;
    position: relative;
    height: 4px; /* Fixed small height for color strips */
    transition: all 0.2s ease;
    opacity: 0.8;
  }

  .event-bar:hover {
    height: 6px; /* Slightly taller on hover */
    opacity: 1;
    transform: translateY(-1px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    z-index: 1;
  }

  .event-check {
    position: absolute;
    right: 2px;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 12px;
    cursor: pointer;
    z-index: 1;
    opacity: 0.9;
  }

  .event-check:hover {
    opacity: 1;
    transform: translateY(-50%) scale(1.1);
  }

  .more-events {
    font-size: 0.6rem;
    color: var(--text-muted);
    text-align: center;
    padding: 0.125rem;
    font-style: italic;
    opacity: 0.7;
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .day-cell {
      height: 100px; /* Fixed height for mobile */
    }

    .day-number {
      padding: 0.125rem 0.25rem 0.0625rem 0.25rem;
      font-size: var(--font-ui-smaller);
    }

    .events-container {
      padding: 0.0625rem 0.125rem 0.125rem 0.125rem;
      gap: 1px;
    }

    .event-bar {
      height: 3px; /* Smaller color strips on mobile */
    }

    .event-bar:hover {
      height: 5px;
    }
  }
</style>