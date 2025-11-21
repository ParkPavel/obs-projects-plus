<script lang="ts">
  import dayjs from "dayjs";
  import { Notice } from "obsidian";
  import { Select, Typography } from "obsidian-svelte";
  import { createDataRecord } from "src/lib/dataApi";
  import {
    DataFieldType,
    type DataFrame,
    type DataRecord,
  } from "src/lib/dataframe/dataframe";
  import { updateRecordValues } from "src/lib/datasources/helpers";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { settings } from "src/lib/stores/settings";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import { Field } from "src/ui/components/Field";
  import {
    ViewContent,
    ViewHeader,
    ViewLayout,
    ViewToolbar,
  } from "src/ui/components/Layout";
  import { CreateNoteModal } from "src/ui/modals/createNoteModal";
  import { EditNoteModal } from "src/ui/modals/editNoteModal";
  import {
    fieldToSelectableValue,
    getRecordColorContext,
  } from "src/ui/views/helpers";
  import { get } from "svelte/store";
  import {
    addInterval,
    chunkDates,
    computeDateInterval,
    generateDates,
    generateTitle,
    getFirstDayOfWeek,
    groupRecordsByField,
    isCalendarInterval,
    subtractInterval,
    // Zoom functionality
    getZoomLevelFromWheel,
    getDateFromMousePosition,
    shouldApplyZoom,
    validateZoomParams,
    getZoomLevelInfo,
  } from "./calendar";
  import Calendar from "./components/Calendar/Calendar.svelte";
  import Day from "./components/Calendar/Day.svelte";
  import Week from "./components/Calendar/Week.svelte";
  import WeekHeader from "./components/Calendar/WeekHeader.svelte";
  import Weekday from "./components/Calendar/Weekday.svelte";
  import Navigation from "./components/Navigation/Navigation.svelte";
  import type { CalendarConfig } from "./types";

  export let project: ProjectDefinition;
  export let frame: DataFrame;
  export let readonly: boolean;
  export let api: ViewApi;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let config: CalendarConfig | undefined;
  export let onConfigChange: (cfg: CalendarConfig) => void;

  function saveConfig(cfg: CalendarConfig) {
    config = cfg;
    onConfigChange(cfg);
  }

  $: ({ fields, records } = frame);

  let anchorDate: dayjs.Dayjs = dayjs();

  // Zoom functionality state
  let lastZoomTime = 0;
  let showZoomIndicatorFlag = false;
  let zoomIndicatorText = '';

  // Touch gesture state
  let touchStartDistance = 0;
  let touchStartInterval = interval;

  $: dateFields = fields
    .filter((field) => !field.repeated)
    .filter((field) => field.type === DataFieldType.Date);
  $: dateField =
    dateFields.find((field) => config?.dateField === field.name) ??
    dateFields[0];

  $: booleanFields = fields
    .filter((field) => !field.repeated)
    .filter((field) => field.type === DataFieldType.Boolean);
  $: booleanField = fields.find((field) => config?.checkField === field.name);

  $: interval = config?.interval ?? "week";

  $: firstDayOfWeek = getFirstDayOfWeek(
    $settings.preferences.locale.firstDayOfWeek
  );

  $: dateInterval = computeDateInterval(anchorDate, interval, firstDayOfWeek);

  $: groupedRecords = dateField
    ? groupRecordsByField(records, dateField.name)
    : {};
  $: title = dateInterval ? generateTitle(dateInterval) : "";
  $: dates = dateInterval ? generateDates(dateInterval) : [];

  $: numColumns = Math.min(dates.length, 7);
  $: weeks = chunkDates(dates, numColumns);
  $: weekDays = dates.slice(0, numColumns);

  function handleIntervalChange(interval: string) {
    if (isCalendarInterval(interval)) {
      saveConfig({ ...config, interval });
    }
  }
  function handleDateFieldChange(dateField: string) {
    saveConfig({ ...config, dateField });
  }
  function handleCheckFieldChange(checkField: string) {
    saveConfig({ ...config, checkField });
  }

  function handleRecordChange(date: dayjs.Dayjs, record: DataRecord) {
    if (dateField) {
      if (dateField.type === DataFieldType.Date) {
        const newDatetime = dayjs(record.values[dateField.name] as string)
          .set("year", date.year())
          .set("month", date.month())
          .set("date", date.date());
        api.updateRecord(
          updateRecordValues(record, {
            [dateField.name]: newDatetime.format(
              dateField.typeConfig?.time ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD"
            ),
          }),
          fields
        );
      }
    }
  }

  function handleRecordCheck(record: DataRecord, checked: boolean) {
    if (booleanField) {
      api.updateRecord(
        updateRecordValues(record, {
          [booleanField.name]: checked,
        }),
        fields
      );
    }
  }

  function handleRecordClick(entry: DataRecord) {
    if (entry) {
      new EditNoteModal(
        get(app),
        fields,
        (record) => {
          api.updateRecord(record, fields);
        },
        entry
      ).open();
    }
  }

  function handleRecordAdd(date: dayjs.Dayjs) {
    if (!dateField) {
      new Notice("Select a Date field to create calendar events.");
      return;
    }

    if (readonly) {
      new Notice("Can't create calendar events in read-only projects.");
      return;
    }

    new CreateNoteModal($app, project, (name, templatePath) => {
      if (dateField) {
        api.addRecord(
          createDataRecord(name, project, {
            [dateField.name]: date.toDate(),
          }),
          fields,
          templatePath
        );
      }
    }).open();
  }

  // Show zoom indicator with animation
  function showZoomIndicator(zoomInfo: any) {
    zoomIndicatorText = zoomInfo.name || `Уровень: ${zoomInfo.level}`;
    showZoomIndicatorFlag = true;
    
    // Hide after 2 seconds
    setTimeout(() => {
      showZoomIndicatorFlag = false;
    }, 2000);
  }

  // Handle mouse wheel zoom
  function handleWheelZoom(event: WheelEvent) {
    const now = Date.now();
    
    // Throttle zoom events to prevent rapid zooming
    if (now - lastZoomTime < 150) {
      return;
    }
    
    // Only apply zoom when Ctrl is pressed and we're not over interactive elements
    if (!shouldApplyZoom(event, event.target as HTMLElement)) {
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    const newInterval = getZoomLevelFromWheel(interval, event.deltaY);
    
    if (newInterval !== interval) {
      // Get date from cursor position with error handling
      const targetDate = getDateFromMousePosition(
        event.clientX,
        event.clientY,
        anchorDate,
        interval,
        firstDayOfWeek
      );
      
      // Validate zoom parameters
      const validation = validateZoomParams(interval, newInterval, targetDate);
      
      if (!validation.isValid) {
        console.warn('Zoom validation failed:', validation.error);
        return;
      }
      
      // Update interval and anchor date
      saveConfig({ ...config, interval: newInterval });
      anchorDate = targetDate;
      
      // Show zoom indicator
      const zoomInfo = getZoomLevelInfo(newInterval);
      showZoomIndicator(zoomInfo);
      
      lastZoomTime = now;
    }
  }

  // Handle keyboard zoom
  function handleKeyboardZoom(event: KeyboardEvent) {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    
    const target = event.target as HTMLElement;
    
    // Don't zoom when typing in inputs or clicking buttons
    if (target.closest('input, textarea, select, button')) {
      return;
    }
    
    let direction = 0;
    
    switch (event.key) {
      case '+':
      case '=':
        direction = -1; // Zoom in (negative for increasing detail)
        break;
      case '-':
      case '_':
        direction = 1; // Zoom out (positive for decreasing detail)
        break;
      default:
        return;
    }
    
    event.preventDefault();
    
    const newInterval = getZoomLevelFromWheel(interval, direction);
    
    if (newInterval !== interval) {
      // Validate zoom parameters
      const validation = validateZoomParams(interval, newInterval, anchorDate);
      
      if (!validation.isValid) {
        console.warn('Zoom validation failed:', validation.error);
        return;
      }
      
      // Update interval
      saveConfig({ ...config, interval: newInterval });
      
      // Show zoom indicator
      const zoomInfo = getZoomLevelInfo(newInterval);
      showZoomIndicator(zoomInfo);
    }
  }

  // Touch gesture handlers
  function handleTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      touchStartDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      touchStartInterval = interval;
    }
  }
  
  function handleTouchMove(event: TouchEvent) {
    if (event.touches.length === 2 && touchStartDistance > 0) {
      event.preventDefault();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      // Calculate zoom based on pinch distance
      const zoomThreshold = 50;
      if (Math.abs(currentDistance - touchStartDistance) > zoomThreshold) {
        const isZoomingIn = currentDistance > touchStartDistance;
        const newInterval = getZoomLevelFromWheel(
          touchStartInterval,
          isZoomingIn ? -1 : 1
        );
        
        if (newInterval !== touchStartInterval) {
          saveConfig({ ...config, interval: newInterval });
          touchStartDistance = currentDistance;
          touchStartInterval = newInterval;
        }
      }
    }
  }
  
  function handleTouchEnd() {
    touchStartDistance = 0;
  }

  getRecordColorContext.set(getRecordColor);
</script>

<ViewLayout
  on:wheel={handleWheelZoom}
  on:keydown={handleKeyboardZoom}
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
  tabindex="0"
  role="application"
  aria-label="Календарное представление. Используйте Ctrl + колесо мыши для изменения масштаба."
>
  <ViewHeader>
    <ViewToolbar variant="secondary">
      <Navigation
        slot="left"
        onNext={() => (anchorDate = addInterval(anchorDate, interval))}
        onPrevious={() => (anchorDate = subtractInterval(anchorDate, interval))}
        onToday={() => (anchorDate = dayjs())}
      />
      <Typography slot="middle" variant="h2" nomargin>{title}</Typography>
      <svelte:fragment slot="right">
        <Field name={$i18n.t("views.calendar.fields.date")}>
          <Select
            value={dateField?.name ?? ""}
            options={dateFields.map(fieldToSelectableValue)}
            placeholder={$i18n.t("views.calendar.fields.none") ?? ""}
            on:change={({ detail }) => handleDateFieldChange(detail)}
          />
        </Field>
        <Field name={$i18n.t("views.calendar.fields.check")}>
          <Select
            allowEmpty
            value={booleanField?.name ?? ""}
            options={booleanFields.map(fieldToSelectableValue)}
            placeholder={$i18n.t("views.calendar.fields.none") ?? ""}
            on:change={({ detail }) => handleCheckFieldChange(detail)}
          />
        </Field>
        <Select
          value={config?.interval ?? "week"}
          options={[
            {
              label: $i18n.t("views.calendar.intervals.month", {
                count: 1,
              }),
              value: "month",
            },
            {
              label: $i18n.t("views.calendar.intervals.weekWithCount", {
                count: 2,
              }),
              value: "2weeks",
            },
            {
              label: $i18n.t("views.calendar.intervals.week", {
                count: 1,
              }),
              value: "week",
            },
            {
              label: $i18n.t("views.calendar.intervals.dayWithCount", {
                count: 3,
              }),
              value: "3days",
            },
            {
              label: $i18n.t("views.calendar.intervals.day", {
                count: 1,
              }),
              value: "day",
            },
          ]}
          on:change={({ detail }) => handleIntervalChange(detail)}
        />
        <!-- Current zoom level indicator -->
        <div
          class="zoom-level-indicator"
          title="Текущий уровень зума. Используйте Ctrl + колесо мыши для изменения."
        >
          🔍 {interval === 'month' ? 'Месяц' :
             interval === '2weeks' ? '2 недели' :
             interval === 'week' ? 'Неделя' :
             interval === '3days' ? '3 дня' : 'День'}
        </div>
      </svelte:fragment>
    </ViewToolbar>
  </ViewHeader>
  <ViewContent>
    <Calendar>
      <WeekHeader>
        {#each weekDays as weekDay}
          <Weekday
            width={100 / weekDays.length}
            weekend={weekDay.day() === 0 || weekDay.day() === 6}
          >
            {$i18n.t("views.calendar.weekday", {
              value: weekDay.toDate(),
              formatParams: {
                value: { weekday: "short" },
              },
            })}
          </Weekday>
        {/each}
      </WeekHeader>
      {#each weeks as week}
        <Week height={100 / weeks.length}>
          {#each week as date}
            <Day
              width={100 / week.length}
              {date}
              checkField={booleanField?.name}
              records={groupedRecords[date.format("YYYY-MM-DD")] || []}
              onRecordClick={handleRecordClick}
              onRecordChange={(record) => {
                handleRecordChange(date, record);
              }}
              onRecordCheck={(record, checked) => {
                handleRecordCheck(record, checked);
              }}
              onRecordAdd={() => {
                handleRecordAdd(date);
              }}
            />
          {/each}
        </Week>
      {/each}
    </Calendar>
  </ViewContent>
</ViewLayout>

<!-- Zoom indicator -->
<div
  class="zoom-indicator {showZoomIndicatorFlag ? 'visible' : ''}"
  role="status"
  aria-live="polite"
>
  {zoomIndicatorText}
</div>

<style>
  /* Zoom indicator */
  .zoom-indicator {
    position: fixed;
    top: 10px;
    right: 10px;
    background: var(--background-primary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--button-radius);
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
    z-index: 1000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .zoom-indicator.visible {
    opacity: 1;
  }

  /* Current zoom level indicator */
  .zoom-level-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    color: var(--text-muted);
    background: var(--background-modifier-hover);
    border-radius: var(--button-radius);
    border: 1px solid var(--background-modifier-border);
    white-space: nowrap;
    margin-left: 0.5rem;
  }

  .zoom-level-indicator:hover {
    color: var(--text-normal);
    background: var(--background-modifier-active);
  }
</style>
