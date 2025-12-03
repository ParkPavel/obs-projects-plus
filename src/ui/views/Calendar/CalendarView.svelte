<script lang="ts">
  import dayjs from "dayjs";
  import { Notice } from "obsidian";
  import { Select } from "obsidian-svelte";
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
  import { toolbarCollapsed } from "src/lib/stores/ui";
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
    getFirstDayOfWeek,
    groupRecordsByField,
    isCalendarInterval,
  } from "./calendar";
  import InfiniteCalendar from "./components/Calendar/InfiniteCalendar.svelte";
  import InfiniteHorizontalCalendar from "./components/Calendar/InfiniteHorizontalCalendar.svelte";
  import Navigation from "./components/Navigation/Navigation.svelte";
  import { DayPopup } from "./components/DayPopup";
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
  let scrollToCurrentCallback: (() => void) | null = null;
  let horizontalScrollToCurrentCallback: (() => void) | null = null;
  
  let isLoading = false;
  let errorMessage: string | null = null;

  let groupedRecords: Record<string, DataRecord[]> = {};

  // Zoom levels in order from most zoomed out to most zoomed in
  const ZOOM_LEVELS: CalendarInterval[] = ['month', '2weeks', 'week', '3days', 'day'];
  
  // Current focused date for zoom centering (null = use today)
  let focusedDate: dayjs.Dayjs | null = null;
  
  // Flag to indicate zoom-triggered navigation
  let isZoomNavigation = false;
  
  // Debounce timer for zoom
  let zoomDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Pinch gesture state
  let pinchStartDistance = 0;
  let isPinching = false;
  
  // Zoom indicator state
  let showZoomIndicator = false;
  let zoomIndicatorTimeout: ReturnType<typeof setTimeout> | null = null;
  
  function showZoomLevel(intervalName: CalendarInterval) {
    showZoomIndicator = true;
    
    if (zoomIndicatorTimeout) {
      clearTimeout(zoomIndicatorTimeout);
    }
    
    zoomIndicatorTimeout = setTimeout(() => {
      showZoomIndicator = false;
    }, 1000);
  }
  
  // Get current interval directly from config or default
  function getCurrentInterval(): CalendarInterval {
    return (config?.interval ?? defaultInterval) as CalendarInterval;
  }
  
  function getZoomLevelIndex(int: CalendarInterval): number {
    return ZOOM_LEVELS.indexOf(int);
  }
  
  function doZoom(direction: 'in' | 'out', centerDate?: dayjs.Dayjs) {
    const currentInterval = getCurrentInterval();
    const currentIndex = getZoomLevelIndex(currentInterval);
    
    let newInterval: CalendarInterval | undefined;
    
    if (direction === 'in' && currentIndex >= 0 && currentIndex < ZOOM_LEVELS.length - 1) {
      newInterval = ZOOM_LEVELS[currentIndex + 1];
    } else if (direction === 'out' && currentIndex > 0) {
      newInterval = ZOOM_LEVELS[currentIndex - 1];
    }
    
    if (newInterval && newInterval !== currentInterval) {
      focusedDate = centerDate || dayjs();
      isZoomNavigation = true;
      showZoomLevel(newInterval);
      
      // Directly update config - simple and synchronous
      saveConfig({ ...config, interval: newInterval });
      
      // Reset flags after component has time to update
      setTimeout(() => {
        isZoomNavigation = false;
        focusedDate = null;
      }, 500);
    }
  }
  
  function zoomIn(centerDate?: dayjs.Dayjs) {
    // Debounce rapid zoom calls
    if (zoomDebounceTimer) return;
    
    zoomDebounceTimer = setTimeout(() => {
      zoomDebounceTimer = null;
    }, 400);
    
    doZoom('in', centerDate);
  }
  
  function zoomOut(centerDate?: dayjs.Dayjs) {
    // Debounce rapid zoom calls
    if (zoomDebounceTimer) return;
    
    zoomDebounceTimer = setTimeout(() => {
      zoomDebounceTimer = null;
    }, 400);
    
    doZoom('out', centerDate);
  }
  
  function getIntervalLabel(int: string): string {
    const labels: Record<string, string> = {
      'month': $i18n.t("views.calendar.intervals.month", { count: 1 }),
      '2weeks': $i18n.t("views.calendar.intervals.2weeks"),
      'week': $i18n.t("views.calendar.intervals.week", { count: 1 }),
      '3days': $i18n.t("views.calendar.intervals.3days"),
      'day': $i18n.t("views.calendar.intervals.day", { count: 1 }),
    };
    return labels[int] || int;
  }
  
  function getDateFromMousePosition(event: MouseEvent | WheelEvent): dayjs.Dayjs {
    // Try to find the day cell under the cursor
    const target = event.target as HTMLElement;
    const dayCell = target.closest('.day-cell');
    
    if (dayCell) {
      // Use data-date attribute (most reliable)
      const dateStr = dayCell.getAttribute('data-date');
      if (dateStr) {
        const parsed = dayjs(dateStr);
        if (parsed.isValid()) {
          return parsed;
        }
      }
    }
    
    // Fallback to today
    return dayjs();
  }
  
  function handleZoomWheel(event: WheelEvent) {
    // Only handle Ctrl+wheel for zooming
    if (!event.ctrlKey && !event.metaKey) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const centerDate = getDateFromMousePosition(event);
    
    // Negative deltaY = scroll up = zoom in (more detail)
    // Positive deltaY = scroll down = zoom out (less detail)
    if (event.deltaY < 0) {
      zoomIn(centerDate);
    } else if (event.deltaY > 0) {
      zoomOut(centerDate);
    }
  }
  
  function getTouchDistance(touches: TouchList): number {
    if (touches.length < 2) return 0;
    const touch0 = touches[0];
    const touch1 = touches[1];
    if (!touch0 || !touch1) return 0;
    const dx = touch0.clientX - touch1.clientX;
    const dy = touch0.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  function getTouchCenter(touches: TouchList): { x: number; y: number } {
    if (touches.length < 2) return { x: 0, y: 0 };
    const touch0 = touches[0];
    const touch1 = touches[1];
    if (!touch0 || !touch1) return { x: 0, y: 0 };
    return {
      x: (touch0.clientX + touch1.clientX) / 2,
      y: (touch0.clientY + touch1.clientY) / 2,
    };
  }
  
  function handleTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) {
      isPinching = true;
      pinchStartDistance = getTouchDistance(event.touches);
    }
  }
  
  function handleTouchMove(event: TouchEvent) {
    if (!isPinching || event.touches.length !== 2) return;
    
    const currentDistance = getTouchDistance(event.touches);
    const threshold = 50; // Minimum distance change to trigger zoom
    
    if (Math.abs(currentDistance - pinchStartDistance) > threshold) {
      event.preventDefault();
      
      // Get center point of pinch
      const center = getTouchCenter(event.touches);
      const elementAtCenter = document.elementFromPoint(center.x, center.y);
      
      // Try to find date from element using data-date attribute
      let centerDate = dayjs();
      if (elementAtCenter) {
        const dayCell = elementAtCenter.closest('.day-cell');
        if (dayCell) {
          const dateStr = dayCell.getAttribute('data-date');
          if (dateStr) {
            const parsed = dayjs(dateStr);
            if (parsed.isValid()) {
              centerDate = parsed;
            }
          }
        }
      }
      
      // Pinch out (spread) = zoom in (more detail)
      // Pinch in (squeeze) = zoom out (less detail)
      if (currentDistance > pinchStartDistance) {
        zoomIn(centerDate);
      } else {
        zoomOut(centerDate);
      }
      
      // Reset start distance
      pinchStartDistance = currentDistance;
    }
  }
  
  function handleTouchEnd(event: TouchEvent) {
    if (event.touches.length < 2) {
      isPinching = false;
      pinchStartDistance = 0;
    }
  }

  function navigateToDate(direction: 'next' | 'previous' | 'today') {
    try {
      // Get current interval value from reactive variable
      const currentInterval = interval;
      
      if (direction === 'today') {
        if (currentInterval === 'month') {
          // For month view, use the InfiniteCalendar's scroll method
          if (scrollToCurrentCallback) {
            scrollToCurrentCallback();
          } else {
            setTimeout(() => {
              if (scrollToCurrentCallback) {
                scrollToCurrentCallback();
              }
            }, 100);
          }
        } else {
          // For other views, use horizontal calendar's scroll method
          if (horizontalScrollToCurrentCallback) {
            horizontalScrollToCurrentCallback();
          } else {
            setTimeout(() => {
              if (horizontalScrollToCurrentCallback) {
                horizontalScrollToCurrentCallback();
              }
            }, 100);
          }
        }
        return;
      }
      
      // For infinite views, navigation buttons are not needed (just for legacy support)
      // The views scroll infinitely
      let newAnchorDate: dayjs.Dayjs;
      
      switch (direction) {
        case 'next':
          switch (currentInterval as CalendarInterval) {
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
          switch (currentInterval as CalendarInterval) {
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

  // Detect mobile device
  $: isMobile = typeof window !== 'undefined' && 
    (window.innerWidth <= 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0);
  
  // Get mobile calendar preference
  $: mobileCalendarView = $settings.preferences.mobileCalendarView || 'month';
  
  // Apply mobile preference if on mobile and no config yet
  $: defaultInterval = isMobile ? mobileCalendarView : "week";
  $: interval = config?.interval ?? defaultInterval;
  
  // Day popup state for mobile
  let showDayPopup = false;
  let dayPopupDate: dayjs.Dayjs = dayjs();
  let dayPopupRecords: DataRecord[] = [];
  
  function handleDayTap(date: dayjs.Dayjs, records: DataRecord[]) {
    if (!isMobile) return;
    dayPopupDate = date;
    dayPopupRecords = records;
    showDayPopup = true;
  }
  
  function handleDayPopupRecordClick(record: DataRecord) {
    showDayPopup = false;
    // Open the note
    const app_instance = get(app);
    app_instance.workspace.openLinkText(record.id, record.id, false);
  }
  
  function handleDayPopupRecordSettings(record: DataRecord) {
    showDayPopup = false;
    handleRecordClick(record);
  }
  
  async function handleDayPopupRecordDelete(record: DataRecord) {
    try {
      await api.deleteRecord(record.id);
      // Remove from popup records
      dayPopupRecords = dayPopupRecords.filter(r => r.id !== record.id);
      if (dayPopupRecords.length === 0) {
        showDayPopup = false;
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      new Notice('Ошибка при удалении заметки');
    }
  }
  
  async function handleDayPopupRecordDuplicate(event: { record: DataRecord; targetDates: dayjs.Dayjs[] }) {
    const { record, targetDates } = event;
    if (!dateField) return;
    
    try {
      for (const targetDate of targetDates) {
        // Create a new record with the same content but different date
        const baseName = record.id.split('/').pop()?.replace('.md', '') || 'note';
        const newRecord = createDataRecord(
          baseName + '_copy_' + targetDate.format('YYYY-MM-DD'),
          project,
          {
            ...record.values,
            [dateField.name]: targetDate.format('YYYY-MM-DD'),
          }
        );
        await api.addRecord(newRecord, fields, "");
      }
      new Notice(`Заметка продублирована на ${targetDates.length} дат`);
    } catch (error) {
      console.error('Error duplicating record:', error);
      new Notice('Ошибка при дублировании заметки');
    }
  }
  
  async function handleDayPopupRecordCheck(record: DataRecord, checked: boolean) {
    if (!booleanField) return;
    
    try {
      api.updateRecord(
        updateRecordValues(record, {
          [booleanField.name]: checked,
        }),
        fields
      );
      // Update local state
      const index = dayPopupRecords.findIndex(r => r.id === record.id);
      if (index !== -1 && dayPopupRecords[index]) {
        const currentRecord = dayPopupRecords[index];
        dayPopupRecords[index] = {
          ...currentRecord,
          values: {
            ...currentRecord.values,
            [booleanField.name]: checked
          }
        };
        dayPopupRecords = [...dayPopupRecords];
      }
    } catch (error) {
      console.error('Error updating record check:', error);
      new Notice('Ошибка при изменении статуса');
    }
  }
  
  function handleDayPopupCreateNote(date: dayjs.Dayjs) {
    showDayPopup = false;
    handleRecordAdd(date);
  }

  $: firstDayOfWeek = getFirstDayOfWeek(
    $settings.preferences.locale.firstDayOfWeek
  );

  $: groupedRecords = (() => {
    if (interval === 'month' && dateField?.name) {
      const minDate = dayjs().subtract(24, 'month');
      const maxDate = dayjs().add(24, 'month');
      const limitedRecords = records.filter((r) => {
        const dateValue = r.values[dateField!.name];
        if (!dateValue || (typeof dateValue !== 'string' && !(dateValue instanceof Date))) return false;
        const date = dayjs(dateValue);
        return date.isValid() && date.isAfter(minDate) && date.isBefore(maxDate);
      });
      return groupRecordsByField(limitedRecords, dateField!.name);
    } else if (dateField?.name) {
      return groupRecordsByField(records, dateField.name);
    } else {
      return {};
    }
  })();

  function handleIntervalChange(newInterval: string) {
    // Only change if different from current
    const currentInterval = config?.interval ?? defaultInterval;
    if (newInterval === currentInterval) {
      return;
    }
    
    if (isCalendarInterval(newInterval)) {
      saveConfig({ ...config, interval: newInterval as CalendarInterval });
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

  function onRecordCheckWrapper(record: any, checked: boolean) {
    handleRecordCheck(record as DataRecord, checked);
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
    }
  }

  function handleRecordAdd(date: dayjs.Dayjs) {
    if (!dateField) {
      new Notice(get(i18n).t("views.calendar.errors.date-required"));
      return;
    }
  
    if (readonly) {
      new Notice(get(i18n).t("views.calendar.errors.create-readonly"));
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
        }
      }).open();
    } catch (error) {
      console.error('Error opening create modal:', error);
    }
  }

  getRecordColorContext.set(getRecordColor);
</script>

<ViewLayout>
  <ViewHeader>
    <ViewToolbar variant="secondary">
      <Navigation
        slot="left"
        onToday={() => navigateToDate('today')}
      />
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
          value={config?.interval ?? defaultInterval}
          options={[
            {
              label: $i18n.t("views.calendar.intervals.month", {
                count: 1,
              }),
              value: "month",
            },
            {
              label: $i18n.t("views.calendar.intervals.2weeks"),
              value: "2weeks",
            },
            {
              label: $i18n.t("views.calendar.intervals.week", {
                count: 1,
              }),
              value: "week",
            },
            {
              label: $i18n.t("views.calendar.intervals.3days"),
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
      </svelte:fragment>
    </ViewToolbar>
  </ViewHeader>
  <div 
    class="calendar-zoom-container"
    on:wheel={handleZoomWheel}
    on:touchstart={handleTouchStart}
    on:touchmove={handleTouchMove}
    on:touchend={handleTouchEnd}
  >
    <ViewContent noScroll={interval !== 'month'}>
      {#key interval}
        {#if interval === 'month'}
          <InfiniteCalendar
            {groupedRecords}
            firstDayOfWeek={firstDayOfWeek}
            checkField={booleanField?.name}
            targetDate={isZoomNavigation ? focusedDate : null}
            onRecordClick={handleRecordClick}
            onRecordChange={handleRecordChange}
            onRecordCheck={handleRecordCheck}
            onRecordAdd={handleRecordAdd}
            onDayTap={handleDayTap}
            {isMobile}
            onScrollToCurrent={(callback) => {
              scrollToCurrentCallback = callback;
            }}
            onScrollToDate={undefined}
          />
        {:else}
          <div class="horizontal-calendar-wrapper">
            <InfiniteHorizontalCalendar
              {groupedRecords}
              firstDayOfWeek={firstDayOfWeek}
              interval={interval}
              checkField={booleanField?.name}
              targetDate={isZoomNavigation ? focusedDate : null}
              onRecordClick={handleRecordClick}
              onRecordChange={handleRecordChange}
              onRecordCheck={onRecordCheckWrapper}
              onRecordAdd={handleRecordAdd}
              onDayTap={handleDayTap}
              {isMobile}
              onScrollToCurrent={(callback) => {
                horizontalScrollToCurrentCallback = callback;
              }}
              onScrollToDate={undefined}
            />
          </div>
        {/if}
      {/key}
    </ViewContent>
  </div>
  
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
  
  {#if showZoomIndicator}
    <div class="zoom-indicator" aria-live="polite">
      <div class="zoom-indicator-content">
        <svg class="zoom-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <span class="zoom-label">{getIntervalLabel(interval)}</span>
        <div class="zoom-level-dots">
          {#each ZOOM_LEVELS as level}
            <div 
              class="zoom-dot"
              class:active={level === interval}
              aria-hidden="true"
            ></div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Floating Today button for mobile when toolbar is hidden -->
  {#if isMobile && $toolbarCollapsed}
    <button
      class="floating-today-button"
      on:click={() => navigateToDate('today')}
      aria-label={$i18n.t("views.calendar.today")}
    >
      {$i18n.t("views.calendar.today")}
    </button>
  {/if}
  
  <!-- Day popup for mobile -->
  {#if isMobile}
    <DayPopup
      date={dayPopupDate}
      records={dayPopupRecords}
      checkField={booleanField?.name}
      visible={showDayPopup}
      on:close={() => showDayPopup = false}
      on:recordClick={({ detail }) => handleDayPopupRecordClick(detail)}
      on:recordSettings={({ detail }) => handleDayPopupRecordSettings(detail)}
      on:recordDelete={({ detail }) => handleDayPopupRecordDelete(detail)}
      on:recordDuplicate={({ detail }) => handleDayPopupRecordDuplicate(detail)}
      on:recordCheck={({ detail }) => handleDayPopupRecordCheck(detail.record, detail.checked)}
      on:createNote={({ detail }) => handleDayPopupCreateNote(detail)}
    />
  {/if}
</ViewLayout>


<style>
  .calendar-zoom-container {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    touch-action: pan-x pan-y;
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(var(--background-primary-rgb), 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .loading-spinner {
    background: var(--background-primary);
    padding: 16px 24px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 2.5px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .loading-spinner span {
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .error-message {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    max-width: 400px;
    background: var(--background-modifier-error);
    color: var(--text-on-accent);
    padding: 12px 16px;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 1001;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    font-weight: 500;
    animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .error-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 50%;
    color: inherit;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .error-close:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .horizontal-calendar-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  /* Apple-style transitions */
  :global(.calendar-fade-enter) {
    opacity: 0;
  }

  :global(.calendar-fade-enter-active) {
    opacity: 1;
    transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Zoom indicator styles */
  .zoom-indicator {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1002;
    pointer-events: none;
    animation: zoomIndicatorFadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes zoomIndicatorFadeIn {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  .zoom-indicator-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: var(--background-primary);
    padding: 16px 24px;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    border: 1px solid var(--background-modifier-border);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .zoom-icon {
    color: var(--interactive-accent);
  }

  .zoom-label {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-normal);
    letter-spacing: -0.01em;
  }

  .zoom-level-dots {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .zoom-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--background-modifier-border);
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .zoom-dot.active {
    background: var(--interactive-accent);
    transform: scale(1.3);
  }

  /* Floating Today button for mobile */
  .floating-today-button {
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 90;
    padding: 8px 20px;
    border: none;
    border-radius: 20px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    opacity: 0.7;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
    animation: slideDownFade 0.3s ease-out;
  }

  .floating-today-button:hover {
    opacity: 1;
    transform: translateX(-50%) scale(1.05);
  }

  .floating-today-button:active {
    transform: translateX(-50%) scale(0.95);
  }

  @keyframes slideDownFade {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
    to {
      opacity: 0.7;
      transform: translateX(-50%) translateY(0);
    }
  }

  @media (max-width: 768px) {
    .error-message {
      left: 16px;
      right: 16px;
      transform: none;
      max-width: none;
    }

    .zoom-indicator {
      bottom: 12px;
      right: 12px;
      padding: 8px 12px;
    }

    .zoom-label {
      font-size: 13px;
    }

    .zoom-dot {
      width: 5px;
      height: 5px;
    }
  }

  @media (max-width: 480px) {
    .floating-today-button {
      top: 6px;
      padding: 6px 16px;
      font-size: 13px;
      opacity: 0.6;
    }

    .zoom-indicator {
      bottom: 8px;
      right: 8px;
      padding: 6px 10px;
    }

    .zoom-label {
      font-size: 12px;
    }

    .zoom-level-dots {
      gap: 4px;
    }

    .zoom-dot {
      width: 4px;
      height: 4px;
    }
  }

  /* Touch device optimizations */
  @media (pointer: coarse) {
    .zoom-indicator {
      padding: 10px 14px;
    }

    .floating-today-button {
      padding: 10px 24px;
    }
  }
</style>
