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
    chunkDates,
    computeDateInterval,
    generateDates,
    generateTitle,
    getFirstDayOfWeek,
    groupRecordsByField,
    isCalendarInterval,
  } from "./calendar";
  import Calendar from "./components/Calendar/Calendar.svelte";
  import Day from "./components/Calendar/Day.svelte";
  import Week from "./components/Calendar/Week.svelte";
  import WeekHeader from "./components/Calendar/WeekHeader.svelte";
  import Weekday from "./components/Calendar/Weekday.svelte";
  import Navigation from "./components/Navigation/Navigation.svelte";
  import type { CalendarConfig } from "./types";
  import type { CalendarInterval } from "./calendar";

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
  
  let isLoading = false;
  let errorMessage: string | null = null;


  function navigateToDate(direction: 'next' | 'previous' | 'today') {
    try {
      let newAnchorDate: dayjs.Dayjs;
      
      switch (direction) {
        case 'today':
          newAnchorDate = dayjs();
          break;
        case 'next':
          switch (interval as CalendarInterval) {
            case 'month':
              newAnchorDate = anchorDate.add(1, 'month');
              break;
            case '2weeks':
              newAnchorDate = anchorDate.add(2, 'week');
              break;
            case 'week':
              newAnchorDate = anchorDate.add(1, 'week');
              break;
            case '3days':
              newAnchorDate = anchorDate.add(3, 'day');
              break;
            case 'day':
              newAnchorDate = anchorDate.add(1, 'day');
              break;
            default:
              newAnchorDate = anchorDate.add(1, 'week');
          }
          break;
        case 'previous':
          switch (interval as CalendarInterval) {
            case 'month':
              newAnchorDate = anchorDate.subtract(1, 'month');
              break;
            case '2weeks':
              newAnchorDate = anchorDate.subtract(2, 'week');
              break;
            case 'week':
              newAnchorDate = anchorDate.subtract(1, 'week');
              break;
            case '3days':
              newAnchorDate = anchorDate.subtract(3, 'day');
              break;
            case 'day':
              newAnchorDate = anchorDate.subtract(1, 'day');
              break;
            default:
              newAnchorDate = anchorDate.subtract(1, 'week');
          }
          break;
        default:
          return;
      }
      
      anchorDate = newAnchorDate;
    } catch (error) {
      console.error('Error navigating date:', error);
      new Notice('Ошибка при навигации по дате');
    }
  }

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

  async function handleIntervalChange(newInterval: string) {
    if (isCalendarInterval(newInterval)) {
      isLoading = true;
      errorMessage = null;
      try {
        saveConfig({ ...config, interval: newInterval as CalendarInterval });
      } catch (error) {
        console.error('Error changing interval:', error);
        errorMessage = 'Ошибка при изменении интервала. Пожалуйста, попробуйте снова.';
        new Notice('Ошибка при изменении интервала');
      } finally {
        await new Promise(resolve => setTimeout(resolve, 100));
        isLoading = false;
      }
    }
  }
  
  async function handleDateFieldChange(dateField: string) {
    isLoading = true;
    errorMessage = null;
    try {
      saveConfig({ ...config, dateField });
    } catch (error) {
      console.error('Error changing date field:', error);
      errorMessage = 'Ошибка при изменении поля даты. Пожалуйста, выберите другое поле.';
      new Notice('Ошибка при изменении поля даты');
    } finally {
      await new Promise(resolve => setTimeout(resolve, 100));
      isLoading = false;
    }
  }
  
  async function handleCheckFieldChange(checkField: string) {
    isLoading = true;
    errorMessage = null;
    try {
      saveConfig({ ...config, checkField });
    } catch (error) {
      console.error('Error changing check field:', error);
      errorMessage = 'Ошибка при изменении поля для отметок. Пожалуйста, выберите другое поле.';
      new Notice('Ошибка при изменении поля для отметок');
    } finally {
      await new Promise(resolve => setTimeout(resolve, 100));
      isLoading = false;
    }
  }

  function handleRecordChange(date: dayjs.Dayjs, record: DataRecord) {
    if (!dateField) {
      console.warn('No date field configured for record change');
      new Notice('Необходимо выбрать поле даты');
      return;
    }
  
    try {
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
    } catch (error) {
      console.error('Error updating record date:', error);
      new Notice('Ошибка при обновлении даты записи');
    }
  }

  function handleRecordCheck(record: DataRecord, checked: boolean) {
    if (!booleanField) {
      console.warn('No boolean field configured for check operations');
      new Notice('Необходимо выбрать поле для отметок');
      return;
    }
  
    try {
      api.updateRecord(
        updateRecordValues(record, {
          [booleanField.name]: checked,
        }),
        fields
      );
    } catch (error) {
      console.error('Error updating record check state:', error);
      new Notice('Ошибка при обновлении состояния записи');
    }
  }

  function handleRecordClick(entry: DataRecord) {
    if (!entry) {
      console.warn('No entry provided for record click');
      return;
    }
  
    try {
      new EditNoteModal(
        get(app),
        fields,
        (record) => {
          try {
            api.updateRecord(record, fields);
          } catch (error) {
            console.error('Error updating record in modal:', error);
            new Notice('Ошибка при сохранении изменений');
          }
        },
        entry
      ).open();
    } catch (error) {
      console.error('Error opening edit modal:', error);
      new Notice('Ошибка при открытии окна редактирования');
    }
  }

  function handleRecordAdd(date: dayjs.Dayjs) {
    if (!dateField) {
      new Notice("Для создания событий необходимо выбрать поле даты.");
      return;
    }
  
    if (readonly) {
      new Notice("Нельзя создавать события в проектах только для чтения.");
      return;
    }
  
    try {
      new CreateNoteModal(get(app), project, (name, templatePath) => {
        try {
          if (dateField) {
            api.addRecord(
              createDataRecord(name, project, {
                [dateField.name]: date.toDate(),
              }),
              fields,
              templatePath
            );
          }
        } catch (error) {
          console.error('Error adding new record:', error);
          new Notice('Ошибка при создании новой записи');
        }
      }).open();
    } catch (error) {
      console.error('Error opening create modal:', error);
      new Notice('Ошибка при открытии окна создания');
    }
  }

  getRecordColorContext.set(getRecordColor);
</script>

<ViewLayout>
  <ViewHeader>
    <ViewToolbar variant="secondary">
      <Navigation
        slot="left"
        onNext={() => navigateToDate('next')}
        onPrevious={() => navigateToDate('previous')}
        onToday={() => navigateToDate('today')}
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
        <div
          class="zoom-level-indicator"
        >
          {interval === 'month' ? 'Month' :
             interval === '2weeks' ? '2 weeks' :
             interval === 'week' ? 'Week' :
             interval === '3days' ? '3 days' : 'Day'}
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
  
  {#if isLoading}
    <div class="loading-overlay">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Loading...</span>
      </div>
    </div>
  {/if}
  
  {#if errorMessage}
    <div
      class="error-message"
      role="alert"
      aria-live="assertive"
      on:click={() => errorMessage = null}
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          errorMessage = null;
        }
      }}
    >
      {errorMessage}
      <button
        class="error-close"
        aria-label="Close error message"
        on:click|stopPropagation={(e) => {
          e.stopPropagation();
          errorMessage = null;
        }}
      >
        ×
      </button>
    </div>
  {/if}
</ViewLayout>


<style>

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .loading-spinner {
    background: var(--background-primary);
    padding: 1rem 1.5rem;
    border-radius: var(--button-radius);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--background-modifier-border);
    border-top: 2px solid var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .loading-spinner span {
    color: var(--text-normal);
    font-size: 0.9rem;
  }

  @media (max-width: 768px) {

    .zoom-level-indicator {
      font-size: 0.7rem;
      padding: 0.2rem 0.4rem;
      margin-left: 0.25rem;
    }

  }

  @media (max-width: 480px) {
    .zoom-level-indicator {
      font-size: 0.6rem;
      padding: 0.15rem 0.3rem;
      display: none;
    }

    .loading-spinner {
      padding: 0.75rem 1rem;
    }

    .loading-spinner span {
      font-size: 0.8rem;
    }
  }

  .error-message {
    position: fixed;
    top: 60px;
    left: 20px;
    right: 20px;
    background: #d32f2f;
    color: white;
    padding: 1rem;
    border-radius: var(--button-radius);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1001;
    cursor: pointer;
    transition: all 0.3s ease;
    animation: slideDown 0.3s ease-out;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .error-close {
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 50%;
    opacity: 0.8;
    transition: opacity 0.2s ease;
    margin-left: 1rem;
  }

  .error-close:hover {
    opacity: 1;
  }

  @media (max-width: 768px) {
    .error-message {
      top: 50px;
      left: 10px;
      right: 10px;
      font-size: 0.9rem;
      padding: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .error-message {
      top: 40px;
      left: 5px;
      right: 5px;
      font-size: 0.8rem;
      padding: 0.5rem;
    }
  }
</style>
