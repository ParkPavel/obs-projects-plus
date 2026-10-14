<script lang="ts">
  /**
   * DayPopup — the calendar's day window (B10).
   *
   * It runs on the shared popup engine, FloatingPopup, anchored at the day that
   * was tapped. It used to build its own `position: fixed` layer with its own
   * Escape, focus, scroll lock and swipe handling (~1100 lines); every one of
   * those is now the engine's contract, the same as every other popup:
   *   - the layer lives in the anchor's own document (#192 popout windows);
   *   - desktop: anchored, flipped and clamped inside the visible viewport;
   *   - mobile: a bottom sheet fitted above the on-screen keyboard;
   *   - Escape closes the top layer only; focus returns to the day.
   * The record list opens the peek through the view (`recordClick`); the
   * editor stays behind each row's settings entry (`recordSettings`).
   */
  import dayjs from "dayjs";
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import type { ProjectDefinition } from "src/settings/settings";
  import { formatDateForDisplay } from "src/lib/helpers";
  import { i18n } from "src/lib/stores/i18n";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import RecordItem from "./RecordItem.svelte";

  export let project: ProjectDefinition;
  export let date: dayjs.Dayjs;
  export let records: DataRecord[];
  export let checkField: string | undefined;
  export let visible: boolean = false;
  /** The tapped day: where the window anchors and where focus goes back to. */
  export let anchorEl: HTMLElement | null = null;
  export let getRecordColor: ((record: DataRecord) => string | null) | undefined = undefined;
  // v4.0.3: eventColorField for direct color reading from record.values
  export let eventColorField: string | undefined = undefined;
  // v8.1.0: config for timezone and other calendar config
  export let config: import('../../types').CalendarConfig | undefined = undefined;

  const dispatch = createEventDispatcher<{
    close: void;
    recordClick: DataRecord;
    recordOpenInNewWindow: DataRecord;
    recordSettings: DataRecord;
    recordDelete: DataRecord;
    // The duplicate window is not this popup's: it is opened by the view, and
    // this popup closes. Only the record to copy is handed over.
    recordDuplicateRequest: DataRecord;
    recordTimeChange: { record: DataRecord; newTime: string };
    recordCheck: { record: DataRecord; checked: boolean };
    recordColorChange: { record: DataRecord; color: string };
    createNote: dayjs.Dayjs;
  }>();

  // v4.0.3: Get color from record.values (eventColorField) with fallbacks
  function getColorForRecord(record: DataRecord): string | null {
    for (const key of [eventColorField, "eventColor", "color"]) {
      const value = key ? record.values[key] : undefined;
      if (typeof value === "string" && value) return value;
    }
    return getRecordColor?.(record) ?? null;
  }

  $: formattedDate = formatDateForDisplay(date, project) ?? date.format('D MMMM YYYY');
  $: dayOfWeek = date.format('dddd');
  $: isToday = date.isSame(
    (config?.timezone && config.timezone !== "local" ? dayjs().tz(config.timezone) : dayjs()), 'day'
  );

  /** Every close path ends here: the close button, Escape, an outside press. */
  function close() {
    visible = false;
    dispatch('close');
  }

  // The view closes the window for the actions that leave it (open, settings,
  // duplicate); the engine then hands focus back to the day.
</script>

<FloatingPopup
  triggerEl={anchorEl}
  open={visible}
  placement="right-start"
  role="dialog"
  ariaLabel={formattedDate}
  on:close={close}
>
  <div class="ppp-day-popup">
    <header class="ppp-day-popup-header">
      <div class="ppp-day-popup-date">
        <h2 class="ppp-day-popup-title">{formattedDate}</h2>
        <div class="ppp-day-popup-subtitle">
          <span class="ppp-day-popup-weekday">{dayOfWeek}</span>
          {#if isToday}
            <span class="ppp-day-popup-badge">{$i18n.t('views.calendar.popup.today')}</span>
          {/if}
        </div>
      </div>
      <button class="ppp-day-popup-close clickable-icon" type="button" on:click={close} aria-label={$i18n.t('common.close')}>
        <Icon name="x" size="sm" />
      </button>
    </header>

    <button class="ppp-day-popup-create mod-cta" type="button" on:click={() => dispatch('createNote', date)}>
      <Icon name="plus" size="sm" />
      <span>{$i18n.t("views.calendar.new-note")}</span>
    </button>

    {#if records.length === 0}
      <div class="ppp-day-popup-empty">
        <p class="ppp-day-popup-empty-text">{$i18n.t("views.calendar.no-events")}</p>
        <p class="ppp-day-popup-empty-hint">{$i18n.t("views.calendar.popup.empty-hint")}</p>
      </div>
    {:else}
      <div class="ppp-day-popup-records">
        {#each records as record (record.id)}
          <RecordItem
            {record}
            {checkField}
            currentColor={getColorForRecord(record) ?? undefined}
            onColorChange={(color) => dispatch('recordColorChange', { record, color })}
            on:openNote={() => dispatch('recordClick', record)}
            on:openInNewWindow={() => dispatch('recordOpenInNewWindow', record)}
            on:settings={() => dispatch('recordSettings', record)}
            on:delete={() => dispatch('recordDelete', record)}
            on:duplicate={() => dispatch('recordDuplicateRequest', record)}
            on:timeChange={({ detail }) => dispatch('recordTimeChange', { record, newTime: detail })}
            on:check={({ detail }) => dispatch('recordCheck', { record, checked: detail })}
            on:colorChange={({ detail }) => dispatch('recordColorChange', { record, color: detail })}
          />
        {/each}
      </div>
    {/if}
  </div>
</FloatingPopup>

<style>
  .ppp-day-popup {
    display: flex;
    flex-direction: column;
    gap: var(--ppp-space-4, 0.5rem);
    width: 20rem;
    max-width: 100%;
  }

  .ppp-day-popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ppp-space-4, 0.5rem);
    padding: 0.25rem 0.25rem 0.5rem 0.5rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }

  .ppp-day-popup-date {
    flex: 1;
    min-width: 0;
  }

  .ppp-day-popup-title {
    margin: 0;
    font-size: var(--font-ui-large, 1.125rem);
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-normal);
  }

  .ppp-day-popup-subtitle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ppp-day-popup-weekday {
    font-size: var(--font-ui-small, 0.875rem);
    color: var(--text-muted);
    text-transform: capitalize;
  }

  .ppp-day-popup-badge {
    padding: 0.0625rem 0.5rem;
    border-radius: var(--ppp-radius-md, 0.375rem);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: var(--font-ui-smaller, 0.75rem);
    font-weight: 600;
  }

  .ppp-day-popup-close {
    flex-shrink: 0;
    min-width: 2.75rem;
    min-height: 2.75rem;
  }

  .ppp-day-popup-create {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    min-height: 2.75rem;
  }

  .ppp-day-popup-empty {
    padding: 1.5rem 1rem;
    text-align: center;
  }

  .ppp-day-popup-empty-text {
    margin: 0 0 0.25rem;
    color: var(--text-muted);
  }

  .ppp-day-popup-empty-hint {
    margin: 0;
    font-size: var(--font-ui-small, 0.875rem);
    color: var(--text-faint);
  }

  .ppp-day-popup-records {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  /* On a phone the engine shows a bottom sheet; the window takes its width. */
  :global(.ppp-popup--bottom-sheet) .ppp-day-popup {
    width: 100%;
  }
</style>
