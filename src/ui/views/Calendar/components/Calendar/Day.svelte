<script lang="ts">
  import dayjs from "dayjs";
  import { Menu } from "obsidian";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import Date from "./Date.svelte";
  import EventList from "./EventList.svelte";
  import { menuOnContextMenu } from "src/ui/views/helpers";

  /**
   * Specifies the date of the day.
   */
  export let date: dayjs.Dayjs;

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
  export let onRecordClick: (record: DataRecord) => void;

  /**
   * onRecordCheck runs when the user Checks / Unchecks a calendar event.
   */
  export let onRecordCheck: (record: DataRecord, checked: boolean) => void;

  /**
   * onRecordChange runs when the user changes the checked state.
   */
  export let onRecordChange: (record: DataRecord) => void;

  /**
   * onRecordAdd runs when the user creates a new calendar event on this day.
   */
  export let onRecordAdd: () => void;

  $: weekend = date.day() === 0 || date.day() === 6;
  $: today = date.startOf("day").isSame(dayjs().startOf("day"));

  function handleDblClick(event: MouseEvent) {
    onRecordAdd();
  }

  function handleMouseDown(event: MouseEvent) {
    if (event.button === 2) {
      const menu = new Menu().addItem((item) => {
        item
          .setTitle($i18n.t("views.calendar.new-note"))
          .setIcon("file-plus")
          .onClick(() => onRecordAdd());
      });
      menuOnContextMenu(event, menu);
    }
  }
</script>

<div
  class:weekend
  on:dblclick={handleDblClick}
  on:mousedown={handleMouseDown}
  style:width={width + "%"}
  role="gridcell"
  aria-label="День {date.date()} {date.format('MMMM YYYY')}"
  aria-selected="false"
  tabindex="0"
  on:keydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDblClick(new MouseEvent('dblclick', { bubbles: true }));
    }
  }}
>
  <Date {today}>{date.date()}</Date>
  <EventList
    {checkField}
    {records}
    {onRecordClick}
    {onRecordCheck}
    {onRecordChange}
  />
</div>

<style>
  div {
    border-right: 1px solid var(--background-modifier-border);
    padding: 4px;
    font-size: var(--font-ui-small);
    display: flex;
    flex-direction: column;
    gap: 4px;
    outline: none;
    transition: all 0.2s ease;
    min-height: 80px; /* Reduced height for mobile */
  }

  div:focus {
    box-shadow: inset 0 0 0 2px var(--interactive-accent);
  }

  div:last-child {
    border-right: 0;
  }

  .weekend {
    background-color: var(--background-primary-alt);
  }


  /* Mobile responsive styles */
  @media (max-width: 768px) {
    div {
      padding: 3px;
      min-height: 70px;
      font-size: var(--font-ui-smaller);
    }
  }

  @media (max-width: 480px) {
    div {
      padding: 2px;
      min-height: 60px;
      font-size: var(--font-ui-smallest);
    }
  }
</style>
