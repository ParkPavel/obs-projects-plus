<script lang="ts">
  import dayjs from "dayjs";
  import { Notice } from "obsidian";
  import { createDataRecord } from "src/lib/dataApi";
  import {
    DataFieldType,
    type DataFrame,
    type DataRecord,
  } from "src/lib/dataframe/dataframe";
  import { updateRecordValues } from "src/lib/datasources/helpers";
  import { formatDateForProject } from "src/lib/helpers";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { settings } from "src/lib/stores/settings";
  import { isMobileDevice } from "src/lib/stores/ui";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import {
    ViewContent,
    ViewLayout,
  } from "src/ui/components/Layout";
  import { CreateNoteModal } from "src/ui/modals/createNoteModal";
  import { EditNoteModal } from "src/ui/modals/editNoteModal";
  import {
    getRecordColorContext,
  } from "src/ui/views/helpers";
  import { get } from "svelte/store";
  import { onMount } from "svelte";
  import {
    getFirstDayOfWeek,
    groupRecordsByRange,
    parseDateInTimezone,
    extractDateWithPriority,
  } from "./calendar";
  import InfiniteCalendar from "./components/Calendar/InfiniteCalendar.svelte";
  import InfiniteHorizontalCalendar from "./components/Calendar/InfiniteHorizontalCalendar.svelte";
  import YearHeatmap from "./components/Calendar/YearHeatmap.svelte";
  import { ErrorBoundary } from "src/ui/components/ErrorBoundary";
  import AgendaSidebar from "./components/Timeline/AgendaSidebar.svelte";
  import { DayPopup } from "./components/DayPopup";
  import type { CalendarConfig, ProcessedCalendarData } from "./types";
  import type { CalendarInterval } from "./calendar";
  import { processCalendarData } from "./processor";
  import { calendarLogger } from "./logger";
  import { ZOOM_LEVELS, TIMING } from "./constants";
  
  // Navigation & Animation Controllers (v3.0.0)
  import { NavigationController, type NavigableCalendar } from "./navigation/NavigationController";
  import { ViewportStateManager } from "./viewport/ViewportStateManager";
  import { AnimationController } from "./animation/AnimationController";
  import { gestureCoordinator as gestureAction } from "./gestures/GestureCoordinator";

  export let project: ProjectDefinition;
  export let frame: DataFrame;
  export let readonly: boolean;
  export let api: ViewApi;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let config: CalendarConfig | undefined;
  export let onConfigChange: (cfg: CalendarConfig) => void;
  // Data version counter - incremented on each data update to force Svelte reactivity
  export let dataVersion: number = 0;

  // Navigation & Animation Controllers (v3.0.0)
  const animationController = new AnimationController();
  const navigationController = new NavigationController(animationController);
  const viewportStateManager = new ViewportStateManager();
  
  // ============================================================
  // PERSISTENT STATE - localStorage per-project storage
  // ============================================================
  
  const STORAGE_KEY_PREFIX = 'obsidian-projects-calendar-state';
  
  function getStorageKey(): string {
    return `${STORAGE_KEY_PREFIX}-${project.id}`;
  }
  
  interface PersistedViewState {
    date: string;           // ISO date string
    interval: CalendarInterval;
    scrollOffset: number;
    timestamp: number;
    version: number;        // For future migrations
  }
  
  /**
   * Save current view state to localStorage
   */
  function saveViewState(): void {
    try {
      const state: PersistedViewState = {
        date: (focusedDate || dayjs()).format('YYYY-MM-DD'),
        interval: getCurrentInterval(),
        scrollOffset: 0, // TODO: capture actual scroll offset
        timestamp: Date.now(),
        version: 1
      };
      
      const appInstance = (window as any).app || $app;
      appInstance?.saveLocalStorage(getStorageKey(), JSON.stringify(state));
      calendarLogger.debug('View state saved', { component: 'CalendarView', data: state as unknown as Record<string, unknown> });
    } catch (error) {
      calendarLogger.warn('Failed to save view state', { component: 'CalendarView', data: { error } });
    }
  }
  
  /**
   * Load view state from localStorage
   */
  function loadViewState(): PersistedViewState | null {
    try {
      const appInstance = (window as any).app || $app;
      const stored = appInstance?.loadLocalStorage(getStorageKey());
      if (!stored) return null;
      
      const state = JSON.parse(stored) as PersistedViewState;
      
      // Validate state
      if (!state.date || !state.interval) return null;
      
      // Check if state is too old (7 days)
      const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - state.timestamp > MAX_AGE_MS) {
        localStorage.removeItem(getStorageKey());
        return null;
      }
      
      calendarLogger.debug('View state loaded', { component: 'CalendarView', data: state as unknown as Record<string, unknown> });
      return state;
    } catch (error) {
      calendarLogger.warn('Failed to load view state', { component: 'CalendarView', data: { error } });
      return null;
    }
  }
  
  /**
   * Restore view from persisted state
   */
  function restoreFromPersistedState(): boolean {
    const state = loadViewState();
    if (!state) return false;
    
    const parsedDate = dayjs(state.date);
    if (!parsedDate.isValid()) return false;
    
    // Set focusedDate to restored date
    focusedDate = parsedDate;
    
    // Restore interval if different from current
    if (state.interval !== getCurrentInterval()) {
      saveConfig({ ...config, interval: state.interval });
    }
    
    return true;
  }
  
  // Component references for navigation
  let verticalCalendarComponent: InfiniteCalendar; 
  let horizontalCalendarComponent: InfiniteHorizontalCalendar;
  
  // Sync components with controller
  $: navigationController.setVerticalCalendar(verticalCalendarComponent as unknown as NavigableCalendar);
  $: navigationController.setHorizontalCalendar(horizontalCalendarComponent as unknown as NavigableCalendar);

  function saveConfig(cfg: CalendarConfig) {
    config = cfg;
    onConfigChange(cfg);
  }

  // Reactive frame data - dataVersion forces re-evaluation on every data update
  $: fields = dataVersion >= 0 ? frame.fields : frame.fields;
  $: records = dataVersion >= 0 ? frame.records : frame.records;

  let anchorDate: dayjs.Dayjs = dayjs();
  let scrollToCurrentCallback: (() => void) | null = null;
  let horizontalScrollToCurrentCallback: (() => void) | null = null;
  let now = dayjs();
  let nowTimer: ReturnType<typeof setInterval> | null = null;
  
  let isLoading = false;
  let errorMessage: string | null = null;

  let groupedRecords: Record<string, DataRecord[]> = {};

  function computeNow(tz: string) {
    return tz && tz !== "local" ? dayjs().tz(tz) : dayjs();
  }

  let timezoneValue = config?.timezone ?? "local";
  let timeFormatValue = config?.timeFormat ?? "24h";

  $: timezoneValue = config?.timezone ?? "local";
  $: timeFormatValue = config?.timeFormat ?? "24h";
  $: now = computeNow(timezoneValue);

  // ZOOM_LEVELS imported from constants.ts
  
  // Current focused date for zoom centering (null = use today)
  let focusedDate: dayjs.Dayjs | null = null;
  
  // Scroll position for navigation ('start' | 'center' | 'end')
  let focusedScrollPosition: 'start' | 'center' | 'end' = 'center';
  
  // Debounce timer for zoom
  let zoomDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  
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
    }, TIMING.ZOOM_INDICATOR_DURATION);
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
    
    // Determine the date to use for zoom - preserve current view
    const zoomDate = centerDate || focusedDate || anchorDate || dayjs();
    
    // Save current state before zooming
    viewportStateManager.pushState({
      date: zoomDate,
      interval: currentInterval,
      scrollOffset: 0 // Simplified for now
    });
    
    let newInterval: CalendarInterval | undefined;
    
    if (direction === 'in' && currentIndex >= 0 && currentIndex < ZOOM_LEVELS.length - 1) {
      newInterval = ZOOM_LEVELS[currentIndex + 1];
    } else if (direction === 'out' && currentIndex > 0) {
      newInterval = ZOOM_LEVELS[currentIndex - 1];
    }
    
    if (newInterval && newInterval !== currentInterval) {
      // Use the pre-calculated zoom date to ensure consistency
      focusedDate = zoomDate;
      showZoomLevel(newInterval);
      
      // Directly update config - simple and synchronous
      saveConfig({ ...config, interval: newInterval });
      
      // Save view state after zoom
      saveViewState();
    }
  }
  
  function zoomIn(centerDate?: dayjs.Dayjs) {
    // Debounce rapid zoom calls
    if (zoomDebounceTimer) return;
    
    zoomDebounceTimer = setTimeout(() => {
      zoomDebounceTimer = null;
    }, TIMING.ZOOM_DEBOUNCE);
    
    doZoom('in', centerDate);
  }
  
  function zoomOut(centerDate?: dayjs.Dayjs) {
    // Debounce rapid zoom calls
    if (zoomDebounceTimer) return;
    
    zoomDebounceTimer = setTimeout(() => {
      zoomDebounceTimer = null;
    }, TIMING.ZOOM_DEBOUNCE);
    
    doZoom('out', centerDate);
  }
  
  function getIntervalLabel(int: string): string {
    const labels: Record<string, string> = {
      'year': $i18n.t("views.calendar.intervals.year", { count: 1 }),
      'month': $i18n.t("views.calendar.intervals.month", { count: 1 }),
      '2weeks': $i18n.t("views.calendar.intervals.2weeks"),
      'week': $i18n.t("views.calendar.intervals.week", { count: 1 }),
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
    
    // Try week element (for week view)
    const weekEl = target.closest('[data-week-start]');
    if (weekEl) {
      const weekStr = weekEl.getAttribute('data-week-start');
      if (weekStr) {
        const parsed = dayjs(weekStr);
        if (parsed.isValid()) {
          return parsed;
        }
      }
    }
    
    // Try month block (for month/2weeks view)
    const monthBlock = target.closest('[data-month]');
    if (monthBlock) {
      const monthStr = monthBlock.getAttribute('data-month');
      if (monthStr) {
        const parsed = dayjs(monthStr + '-01');
        if (parsed.isValid()) {
          return parsed;
        }
      }
    }
    
    // Fallback to current focused date or anchor date, NOT today
    return focusedDate || anchorDate || dayjs();
  }
  
  /**
   * Get date from screen coordinates (for pinch gesture center)
   */
  function getDateFromCoordinates(x: number, y: number): dayjs.Dayjs {
    // Find element at the given coordinates
    const elementAtPoint = document.elementFromPoint(x, y);
    
    if (elementAtPoint) {
      // Try to find day cell (most specific - for month/2weeks/year views)
      const dayCell = elementAtPoint.closest('.day-cell');
      if (dayCell) {
        const dateStr = dayCell.getAttribute('data-date');
        if (dateStr) {
          const parsed = dayjs(dateStr);
          if (parsed.isValid()) {
            return parsed;
          }
        }
      }
      
      // Try to find week element (for week view)
      const weekEl = elementAtPoint.closest('[data-week-start]');
      if (weekEl) {
        const weekStr = weekEl.getAttribute('data-week-start');
        if (weekStr) {
          const parsed = dayjs(weekStr);
          if (parsed.isValid()) {
            return parsed;
          }
        }
      }
      
      // Try to find month block (for year view or month headers)
      const monthBlock = elementAtPoint.closest('[data-month]');
      if (monthBlock) {
        const monthStr = monthBlock.getAttribute('data-month');
        if (monthStr) {
          const parsed = dayjs(monthStr + '-01');
          if (parsed.isValid()) {
            return parsed;
          }
        }
      }
      
      // Try to find record with date (for event cards)
      const recordEl = elementAtPoint.closest('[data-record-date]');
      if (recordEl) {
        const dateStr = recordEl.getAttribute('data-record-date');
        if (dateStr) {
          const parsed = dayjs(dateStr);
          if (parsed.isValid()) {
            return parsed;
          }
        }
      }
    }
    
    // Fallback to current focused date or anchor date, NOT today
    return focusedDate || anchorDate || dayjs();
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
  
  // ============================================================
  // GESTURE HANDLERS (via GestureCoordinator)
  // ============================================================
  
  /**
   * Handle horizontal swipe for date navigation
   * Left swipe -> next period, Right swipe -> previous period
   */
  function handleHorizontalSwipe(direction: 'left' | 'right') {
    // Left swipe = move forward in time (next)
    // Right swipe = move backward in time (previous)
    if (direction === 'left') {
      navigateToDate('next');
    } else {
      navigateToDate('previous');
    }
  }
  
  /**
   * Handle keyboard shortcuts for navigation
   */
  function handleKeyDown(event: KeyboardEvent) {
    // Ignore if user is typing in an input
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    switch (event.key) {
      case 'ArrowLeft':
        if (event.ctrlKey || event.metaKey) {
          // Ctrl+Left: zoom out
          event.preventDefault();
          zoomOut();
        } else {
          // Left: previous period
          event.preventDefault();
          navigateToDate('previous');
        }
        break;
      case 'ArrowRight':
        if (event.ctrlKey || event.metaKey) {
          // Ctrl+Right: zoom in
          event.preventDefault();
          zoomIn();
        } else {
          // Right: next period
          event.preventDefault();
          navigateToDate('next');
        }
        break;
      case 't':
      case 'T':
        // T: go to today
        event.preventDefault();
        navigateToDate('today');
        break;
      case '+':
      case '=':
        // +: zoom in
        event.preventDefault();
        zoomIn();
        break;
      case '-':
      case '_':
        // -: zoom out
        event.preventDefault();
        zoomOut();
        break;
      case 'Escape':
        // Escape: close any open popup
        if (showDayPopup) {
          showDayPopup = false;
        }
        break;
      case 'Backspace':
        // Backspace: go back in navigation history
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          const prevState = viewportStateManager.goBack();
          if (prevState) {
            // Restore previous viewport state
            focusedDate = prevState.date;
            if (prevState.interval !== interval) {
              saveConfig({ ...config, interval: prevState.interval } as CalendarConfig);
            }
          }
        }
        break;
    }
  }

  onMount(() => {
    nowTimer = setInterval(() => {
      now = computeNow(timezoneValue);
    }, 60_000);
    
    // Try to restore from persisted state first
    const restored = restoreFromPersistedState();
    
    // If no persisted state or restoration failed, go to today
    setTimeout(() => {
      if (!restored || !focusedDate) {
        navigateToDate('today');
      }
      // If restored, focusedDate is already set and will be picked up by calendars
    }, 300);
    
    // Save state periodically (every 30 seconds while active)
    const autoSaveInterval = setInterval(() => {
      saveViewState();
    }, 30_000);
    
    // Save state when window/tab loses focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveViewState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Save state before page unload
    const handleBeforeUnload = () => {
      saveViewState();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      if (nowTimer) {
        clearInterval(nowTimer);
      }
      clearInterval(autoSaveInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Final save on unmount
      saveViewState();
    };
  });

  function navigateToDate(direction: 'next' | 'previous' | 'today') {
    try {
      // Get current interval value from reactive variable
      const currentInterval = interval;
      
      // Save current state before navigation
      if (direction !== 'today') {
        viewportStateManager.pushState({
          date: focusedDate || anchorDate,
          interval: currentInterval,
          scrollOffset: 0
        });
      }
      
      if (direction === 'today') {
        if (currentInterval === 'month' || currentInterval === '2weeks') {
          // For month and 2weeks views, use the InfiniteCalendar's scroll method
          // Try multiple times with increasing delay to ensure callback is registered
          const tryScroll = (attempts: number = 0) => {
            if (scrollToCurrentCallback) {
              scrollToCurrentCallback();
            } else if (attempts < 5) {
              setTimeout(() => tryScroll(attempts + 1), 100 * (attempts + 1));
            } else {
              calendarLogger.warn('scrollToCurrentCallback not registered after 5 attempts', { component: 'CalendarView' });
            }
          };
          tryScroll();
        } else if (currentInterval === 'year') {
          // For year view, navigate to current year
          anchorDate = dayjs();
        } else {
          // For other views (day, week), use horizontal calendar's scroll method
          const tryHorizontalScroll = (attempts: number = 0) => {
            if (horizontalScrollToCurrentCallback) {
              horizontalScrollToCurrentCallback();
            } else if (attempts < 5) {
              setTimeout(() => tryHorizontalScroll(attempts + 1), 100 * (attempts + 1));
            } else {
              calendarLogger.warn('horizontalScrollToCurrentCallback not registered after 5 attempts', { component: 'CalendarView' });
            }
          };
          tryHorizontalScroll();
        }
        return;
      }
      
      // For infinite views, navigation buttons are not needed (just for legacy support)
      // The views scroll infinitely
      let newAnchorDate: dayjs.Dayjs;
      
      switch (direction) {
        case 'next':
          switch (currentInterval as CalendarInterval) {
            case 'year':
              newAnchorDate = anchorDate.add(1, 'year');
              break;
            case 'month':
              newAnchorDate = anchorDate.add(1, 'month');
              break;
            case '2weeks':
              newAnchorDate = anchorDate.add(2, 'week');
              break;
            case 'week':
              newAnchorDate = anchorDate.add(1, 'week');
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
            case 'year':
              newAnchorDate = anchorDate.subtract(1, 'year');
              break;
            case 'month':
              newAnchorDate = anchorDate.subtract(1, 'month');
              break;
            case '2weeks':
              newAnchorDate = anchorDate.subtract(2, 'week');
              break;
            case 'week':
              newAnchorDate = anchorDate.subtract(1, 'week');
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

  $: if (config?.["centerOn"] === "today") {
    navigateToDate('today');
    saveConfig({ ...config, centerOn: null });
  }
  
  // Track interval changes - but DON'T auto-center if focusedDate is set
  // focusedDate is set during zoom operations and should take priority
  let lastIntervalForCentering: string | null = null;
  $: if (interval && interval !== lastIntervalForCentering) {
    lastIntervalForCentering = interval;
    // Only auto-center to today if NO focusedDate is set (e.g., initial load or manual interval change)
    // When zooming, focusedDate is already set and components will use it
    if (!focusedDate) {
      setTimeout(() => {
        navigateToDate('today');
      }, 200);
    }
  }

  $: dateFields = fields
    .filter((field) => !field.repeated)
    .filter((field) => field.type === DataFieldType.Date);
  
  // v3.0.0 Priority logic (ROADMAP_V3.0.0.md):
  // 1. Try startDateField from config
  // 2. Try common date field names: startDate, date, deadline, dueDate
  // 3. Fall back to first date field
  $: startDateField = 
    dateFields.find((field) => config?.startDateField === field.name) ??
    dateFields.find((field) => field.name === "startDate") ??
    dateFields.find((field) => field.name === "date") ??
    dateFields.find((field) => field.name === "deadline") ??
    dateFields.find((field) => field.name === "dueDate");
  
  $: legacyDateField =
    dateFields.find((field) => config?.dateField === field.name) ??
    dateFields[0]; // Fallback to any date field
  
  // Final dateField: prioritize startDateField over legacy
  $: dateField = startDateField ?? legacyDateField;
  
  $: endDateField =
    dateFields.find((field) => config?.endDateField === field.name) ??
    dateFields.find((field) => field.name === "endDate");

  $: booleanField = fields.find((field) => config?.checkField === field.name);

  // Use global mobile detection store
  $: isMobile = $isMobileDevice;
  
  // Get mobile calendar preference
  $: mobileCalendarView = $settings.preferences.mobileCalendarView || 'month';
  
  // Apply mobile preference if on mobile and no config yet
  $: defaultInterval = isMobile ? mobileCalendarView : "week";
  $: interval = config?.interval ?? defaultInterval;
  
  // Display mode: 
  // - 'bars' (timeline) is default for day/week views
  // - 'headers' (list) is default for month/2weeks views
  // Month view (InfiniteCalendar) uses 'list' | 'bars', InfiniteHorizontalCalendar uses 'headers' | 'bars'
  $: effectiveDisplayMode = (() => {
    if (config?.displayMode) return config.displayMode;
    // Default to 'bars' for day and week views (shows timeline)
    if (interval === 'day' || interval === 'week') return 'bars';
    // Default to 'headers' for 2weeks and month views (shows list)
    return 'headers';
  })();
  // Map 'headers' to 'list' for InfiniteCalendar (month view)
  $: monthDisplayMode = effectiveDisplayMode === 'headers' ? 'list' : 'bars' as 'list' | 'bars';
  
  // Day popup state - works on both mobile and desktop
  let showDayPopup = false;
  let dayPopupDate: dayjs.Dayjs = dayjs();
  let dayPopupRecords: DataRecord[] = [];
  let dayPopupAnchorX: number | undefined = undefined;
  let dayPopupAnchorY: number | undefined = undefined;
  
  /**
   * Handle day tap/click - opens popup with day's events
   * v6.0: Works on both mobile AND desktop
   * @param date - The date that was tapped/clicked
   * @param records - Records for that date
   * @param event - Optional mouse/touch event for positioning
   */
  function handleDayTap(date: dayjs.Dayjs, records: DataRecord[], event?: MouseEvent | TouchEvent) {
    dayPopupDate = date;
    dayPopupRecords = records;
    
    // Extract click position for desktop popup positioning
    if (event) {
      if ('clientX' in event) {
        dayPopupAnchorX = event.clientX;
        dayPopupAnchorY = event.clientY;
      } else if (event.changedTouches?.[0]) {
        dayPopupAnchorX = event.changedTouches[0].clientX;
        dayPopupAnchorY = event.changedTouches[0].clientY;
      }
    } else {
      // No event - use center of screen
      dayPopupAnchorX = undefined;
      dayPopupAnchorY = undefined;
    }
    
    showDayPopup = true;
  }
  
  function handleDayPopupRecordClick(record: DataRecord) {
    showDayPopup = false;
    // Open the note
    const app_instance = get(app);
    app_instance.workspace.openLinkText(record.id, record.id, false);
  }
  
  /**
   * v4.0.0: Open record in new tab (Ctrl+Click / Double tap)
   * On mobile: opens in new TAB (not window - 'window' not supported on mobile)
   * On desktop: opens in new WINDOW
   */
  function handleDayPopupRecordOpenInNewWindow(record: DataRecord) {
    showDayPopup = false;
    const app_instance = get(app);
    // On mobile use 'tab' (true), on desktop use 'window'
    // 'window' causes "desktop only" error on mobile Obsidian
    const openMode = isMobile ? true : 'window';
    app_instance.workspace.openLinkText(record.id, record.id, openMode);
  }
  
  function handleDayPopupRecordSettings(record: DataRecord) {
    showDayPopup = false;
    const app_instance = get(app);
    new EditNoteModal(
      app_instance, 
      fields, 
      async (updatedRecord) => {
        try {
          await api.updateRecord(updatedRecord, fields);
          // Force local update to trigger calendar re-render
          frame = {
            ...frame,
            records: frame.records.map(r => r.id === updatedRecord.id ? updatedRecord : r)
          };
        } catch (e) {
          calendarLogger.error('Failed to update record from modal', e);
          new Notice('Failed to update record');
        }
      },
      record,
      records,
      // v3.0.1: Open note callback
      () => {
        app_instance.workspace.openLinkText(record.id, record.id, false);
      },
      // v3.0.1: Rename note callback
      async (newName: string) => {
        try {
          const file = app_instance.vault.getAbstractFileByPath(record.id);
          if (file && 'parent' in file) {
            const newPath = file.parent?.path 
              ? `${file.parent.path}/${newName}.md`
              : `${newName}.md`;
            await app_instance.fileManager.renameFile(file as any, newPath);
            new Notice(`Заметка переименована: ${newName}`);
          }
        } catch (e) {
          calendarLogger.error('Failed to rename note', e);
          new Notice('Ошибка при переименовании');
        }
      }
    ).open();
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
      calendarLogger.error('Error deleting record', error, { component: 'CalendarView', action: 'deleteRecord' });
      new Notice('Ошибка при удалении заметки');
    }
  }
  
  async function handleDayPopupRecordDuplicate(event: { 
    record: DataRecord; 
    targetDates: dayjs.Dayjs[];
    customTime?: { startTime: dayjs.Dayjs; endTime: dayjs.Dayjs } | null;
  }) {
    const { record, targetDates, customTime } = event;
    if (!dateField) return;
    
    try {
      const startFieldName = dateField.name;
      const endFieldName = endDateField?.name;
      const startDate = parseDateInTimezone(record.values[startFieldName], timezoneValue);
      const endDate = endFieldName
        ? parseDateInTimezone(record.values[endFieldName], timezoneValue)
        : null;

      const spanDays = startDate && endDate
        ? Math.max(0, endDate.startOf('day').diff(startDate.startOf('day'), 'day'))
        : 0;

      for (const targetDate of targetDates) {
        // Create a new record with the same content but different date
        const baseName = record.id.split('/').pop()?.replace('.md', '') || 'note';
        
        // Build new date value - use customTime if provided, otherwise use targetDate
        let newStartValue: string;
        if (customTime) {
          // Apply custom time to target date
          const newStart = targetDate
            .hour(customTime.startTime.hour())
            .minute(customTime.startTime.minute());
          newStartValue = newStart.format('YYYY-MM-DD HH:mm');
        } else {
          newStartValue = formatDateForProject(targetDate, project) ?? targetDate.format('YYYY-MM-DD');
        }
        
        const newValues: Record<string, unknown> = {
          ...record.values,
          [startFieldName]: newStartValue,
        };
        
        // Handle end date
        if (endFieldName && spanDays > 0) {
          if (customTime) {
            const newEnd = targetDate
              .add(spanDays, 'day')
              .hour(customTime.endTime.hour())
              .minute(customTime.endTime.minute());
            newValues[endFieldName] = newEnd.format('YYYY-MM-DD HH:mm');
          } else {
            newValues[endFieldName] = formatDateForProject(targetDate.add(spanDays, 'day'), project) ?? targetDate.add(spanDays, 'day').format('YYYY-MM-DD');
          }
        }
        
        const newRecord = createDataRecord(
          baseName + '_copy_' + (formatDateForProject(targetDate, project) ?? targetDate.format('YYYY-MM-DD')),
          project,
          newValues as Record<string, import('src/lib/dataframe/dataframe').Optional<import('src/lib/dataframe/dataframe').DataValue>>
        );
        await api.addRecord(newRecord, fields, "");
      }
      new Notice(`Заметка продублирована на ${targetDates.length} дат`);
    } catch (error) {
      calendarLogger.error('Error duplicating record', error, { component: 'CalendarView', action: 'duplicateRecord' });
      new Notice('Ошибка при дублировании заметки');
    }
  }
  
  async function handleDayPopupRecordCheck(record: DataRecord, checked: boolean) {
    if (!booleanField) return;
    
    try {
      await api.updateRecord(
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
      calendarLogger.error('Error updating record check', error, { component: 'CalendarView', action: 'checkRecord' });
      new Notice('Ошибка при изменении статуса');
    }
  }
  
  /**
   * v3.0.2: Handle color change from popup
   * Saves to frontmatter using eventColorField
   */
  async function handleDayPopupRecordColorChange(record: DataRecord, color: string) {
    const colorFieldName = config?.eventColorField;
    if (!colorFieldName) {
      new Notice('Поле цвета не настроено в конфигурации проекта');
      return;
    }
    
    calendarLogger.debug('Color change requested', { 
      component: 'CalendarView',
      action: 'colorChange',
      data: { recordId: record.id, color, colorFieldName }
    });
    
    // v4.0.3: Save to file first, then update UI
    try {
      const updatedRecord = updateRecordValues(record, {
        [colorFieldName]: color,
      });
      
      await api.updateRecord(updatedRecord, fields);
      
      // After successful save, update local state for immediate UI feedback
      // Use .map() to create new arrays (records are readonly)
      
      // Update popup records
      dayPopupRecords = dayPopupRecords.map(r => 
        r.id === record.id 
          ? { ...r, values: { ...r.values, [colorFieldName]: color } }
          : r
      );
      
      // Update main records array  
      records = records.map(r => 
        r.id === record.id
          ? { ...r, values: { ...r.values, [colorFieldName]: color } }
          : r
      );
      
      // Force cache invalidation
      colorUpdateVersion++;
      lastGroupedKey = '';
      lastSortKey = '';
      lastConfigStr = '';
      
      calendarLogger.debug('Color change completed successfully', { component: 'CalendarView', action: 'colorChange' });
      
    } catch (error) {
      calendarLogger.error('Error updating record color', error, { component: 'CalendarView', action: 'colorChange' });
      new Notice('Ошибка при изменении цвета: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  function handleDayPopupCreateNote(date: dayjs.Dayjs) {
    showDayPopup = false;
    handleRecordAdd(date);
  }

  $: firstDayOfWeek = getFirstDayOfWeek(
    $settings.preferences.locale.firstDayOfWeek
  );

  // Memoized computation: only regroup when records/fields/timezone change
  // Note: interval is NOT included in the key because grouping is the same for all intervals
  let colorUpdateVersion = 0; // Used to force cache invalidation on color changes
  let lastGroupedKey = '';
  let cachedGroupedRecords: Record<string, DataRecord[]> = {};
  
  // Full hash for change detection in grouping - must check ALL record values
  // v9.0: Include ALL values for proper reactivity on any field change
  function generateGroupingHash(recs: DataRecord[], field?: string): string {
    if (!field || recs.length === 0) return 'empty';
    // Hash ALL records with ALL their values to detect any change
    const hash = recs.map(r => {
      // Stringify all values to detect any change
      const valuesHash = JSON.stringify(r.values);
      return `${r.id}:${valuesHash}`;
    }).join('|');
    return `${recs.length}-${hash}`;
  }
  
  $: {
    const startField = dateField?.name;
    const endFieldName = endDateField?.name;
    const tz = timezoneValue;
    // v9.0: Content-aware hash includes ALL record values for full reactivity
    // v9.1: Include colorUpdateVersion to force refresh on color changes
    const recordsKey = `${generateGroupingHash(records, startField)}-${endFieldName}-${tz}-v${colorUpdateVersion}`;
    
    if (startField && recordsKey !== lastGroupedKey) {
      lastGroupedKey = recordsKey;
      
      // Always use full range for grouping - let infinite scroll handle visibility
      cachedGroupedRecords = groupRecordsByRange(records, startField, endFieldName, tz);
    } else if (!startField) {
      cachedGroupedRecords = {};
      lastGroupedKey = '';
    }
  }
  
  $: groupedRecords = cachedGroupedRecords;

  function parseDateValue(record: DataRecord, fieldName?: string) {
    if (!fieldName) return null;
    const value = record.values[fieldName];
    if (!value) return null;
    return parseDateInTimezone(value, timezoneValue);
  }

  function sortGroupedRecords(
    grouped: Record<string, DataRecord[]>,
    fieldName?: string
  ): Record<string, DataRecord[]> {
    if (!fieldName) return grouped;
    const sorted: Record<string, DataRecord[]> = {};
    for (const key of Object.keys(grouped)) {
      const items = [...(grouped[key] ?? [])];
      items.sort((a, b) => {
        const aDate = parseDateValue(a, fieldName);
        const bDate = parseDateValue(b, fieldName);
        if (aDate && bDate) {
          return aDate.valueOf() - bDate.valueOf();
        }
        if (aDate) return -1;
        if (bDate) return 1;
        return a.id.localeCompare(b.id);
      });
      sorted[key] = items;
    }
    return sorted;
  }

  // Memoized sort: only re-sort when grouping changes
  let lastSortKey = '';
  let cachedSortedRecords: Record<string, DataRecord[]> = {};
  
  $: {
    const fieldName = dateField?.name;
    // v9.0: Use lastGroupedKey to detect grouping changes properly
    const sortKey = `${lastGroupedKey}-${fieldName}`;
    
    if (sortKey !== lastSortKey) {
      lastSortKey = sortKey;
      cachedSortedRecords = sortGroupedRecords(groupedRecords, fieldName);
    }
  }
  
  $: sortedGroupedRecords = cachedSortedRecords;

  // ProcessedCalendarData: one-time processing for all views
  // This replaces complex per-render calculations with pre-computed data
  let cachedProcessedData: ProcessedCalendarData | null = null;
  let lastRecordsFingerprint = '';
  let lastConfigStr = '';
  
  /**
   * v7.2: Create fingerprint from records content to detect any changes
   * This ensures reactivity even when frame reference doesn't change
   * v9.1: Include color field for proper color change detection
   */
  function createRecordsFingerprint(recs: DataRecord[], cfg: CalendarConfig | undefined): string {
    if (!recs || !cfg) return '';
    const startField = cfg.startDateField;
    const endField = cfg.endDateField;
    const startTimeField = cfg.startTimeField;
    const endTimeField = cfg.endTimeField;
    const colorField = cfg.eventColorField;
    
    // DEBUG: Log field configuration
    let fp = recs.length + ':';
    for (const r of recs) {
      fp += r.id + '|';
      // Include ALL relevant values for change detection
      const startVal = startField ? r.values[startField] : undefined;
      const endVal = endField ? r.values[endField] : undefined;
      const startTimeVal = startTimeField ? r.values[startTimeField] : undefined;
      const endTimeVal = endTimeField ? r.values[endTimeField] : undefined;
      // v9.1: Include color value
      const colorVal = colorField ? r.values[colorField] : (r.values['color'] || r.values['eventColor']);
      
      // Convert values to string representation that captures actual content
      fp += JSON.stringify(startVal) + '|';
      if (endField) fp += JSON.stringify(endVal) + '|';
      if (startTimeField) fp += JSON.stringify(startTimeVal) + '|';
      if (endTimeField) fp += JSON.stringify(endTimeVal) + '|';
      // v9.1: Add color to fingerprint
      fp += JSON.stringify(colorVal) + '|';
    }
    return fp;
  }
  
  // Reactive processing: automatically recalculates when records content or config changes
  // dataVersion is included to force re-evaluation when data is updated via $set
  $: {
    // Include dataVersion in reactive dependencies to force re-run on every data update
    const _version = dataVersion;
    const startField = dateField?.name;
    
    if (startField && config && records && _version >= 0) {
      const configStr = JSON.stringify({
        startDateField: config.startDateField,
        endDateField: config.endDateField,
        startTimeField: config.startTimeField,
        endTimeField: config.endTimeField,
        eventColorField: config.eventColorField,
        timezone: config.timezone,
        startHour: config.startHour,
        endHour: config.endHour,
      });
      
      // v7.2: Check if records CONTENT changed (not just reference)
      const recordsFingerprint = createRecordsFingerprint(records, config);
      const needsUpdate = lastRecordsFingerprint !== recordsFingerprint || lastConfigStr !== configStr;
      
      if (needsUpdate) {
        lastRecordsFingerprint = recordsFingerprint;
        lastConfigStr = configStr;
        
        // Process data - this will run whenever records content or config changes
        cachedProcessedData = processCalendarData(frame, config, getRecordColor);
      }
    } else if (!startField) {
      cachedProcessedData = null;
      lastRecordsFingerprint = '';
      lastConfigStr = '';
    }
  }
  
  $: processedData = cachedProcessedData;

  /**
   * Validates and sanitizes date field values before update
   */
  function validateDateUpdate(
    originalDate: dayjs.Dayjs | null,
    targetDate: dayjs.Dayjs,
    hasTime: boolean,
    tz: string
  ): { isValid: boolean; error?: string } {
    if (!targetDate.isValid()) {
      return { isValid: false, error: 'Invalid target date' };
    }
    
    // Prevent dates too far in past/future (data corruption guard)
    const minDate = dayjs().subtract(100, 'year');
    const maxDate = dayjs().add(100, 'year');
    
    if (targetDate.isBefore(minDate) || targetDate.isAfter(maxDate)) {
      return { isValid: false, error: 'Date out of reasonable range (±100 years)' };
    }
    
    return { isValid: true };
  }

  /**
   * Validates record has required fields for calendar display
   */
  function validateRecordIntegrity(record: DataRecord): { isValid: boolean; error?: string } {
    if (!record) {
      return { isValid: false, error: 'Record is null or undefined' };
    }
    if (!record.id || typeof record.id !== 'string') {
      return { isValid: false, error: 'Record has invalid ID' };
    }
    if (!record.values || typeof record.values !== 'object') {
      return { isValid: false, error: 'Record has invalid values object' };
    }
    return { isValid: true };
  }

  /**
   * Deep drag handler with time preservation, timezone awareness, and validation
   */
  function handleRecordChange(date: dayjs.Dayjs, record: DataRecord) {
    // Validate record integrity first
    const recordValidation = validateRecordIntegrity(record);
    if (!recordValidation.isValid) {
      calendarLogger.error('Record validation failed', undefined, { component: 'CalendarView', action: 'recordChange', data: { error: recordValidation.error } });
      new Notice('Invalid record: ' + (recordValidation.error ?? 'Unknown error'));
      return;
    }
    
    if (!dateField) {
      calendarLogger.warn('No date field configured for record change', { component: 'CalendarView', action: 'recordChange' });
      new Notice('Необходимо выбрать поле даты');
      return;
    }
  
    if (dateField.type !== DataFieldType.Date) {
      calendarLogger.warn('Field is not a date type', { component: 'CalendarView', action: 'recordChange' });
      return;
    }

    try {
      const originalStart = extractDateWithPriority(
        record,
        startDateField?.name,
        legacyDateField?.name,
        endDateField?.name,
        timezoneValue
      );
      const targetDate = date.startOf('day');
      const hasTimeInStart = dateField.typeConfig?.time ?? false;

      // Validate target date
      const validation = validateDateUpdate(originalStart, targetDate, hasTimeInStart, timezoneValue);
      if (!validation.isValid) {
        calendarLogger.error('Date validation failed', undefined, { component: 'CalendarView', action: 'recordChange', data: { error: validation.error } });
        new Notice(validation.error ?? 'Invalid date');
        return;
      }

      // Preserve time component when moving date
      let newStartDate: dayjs.Dayjs;
      if (hasTimeInStart && originalStart) {
        // Keep hours/minutes/seconds from original, only change date
        newStartDate = targetDate
          .hour(originalStart.hour())
          .minute(originalStart.minute())
          .second(originalStart.second());
      } else {
        newStartDate = targetDate;
      }

      // Build updates object
      const updates: Record<string, string> = {
        [dateField.name]: newStartDate.format(
          hasTimeInStart ? "YYYY-MM-DDTHH:mm:ss" : "YYYY-MM-DD"
        ),
      };

      // Handle end date with delta shift and time preservation
      if (endDateField?.name) {
        const endRaw = record.values[endDateField.name];
        const originalEnd = parseDateInTimezone(endRaw, timezoneValue);
        
        if (originalStart && originalEnd) {
          // Calculate day delta (how many days we moved)
          const deltaDays = targetDate.diff(originalStart.startOf('day'), 'day');
          
          if (deltaDays !== 0) {
            const hasTimeInEnd = endDateField.typeConfig?.time ?? false;
            
            // Shift end date by same delta, preserving time if present
            let newEndDate = originalEnd.add(deltaDays, 'day');
            
            // Validate end date
            const endValidation = validateDateUpdate(originalEnd, newEndDate, hasTimeInEnd, timezoneValue);
            if (!endValidation.isValid) {
              calendarLogger.warn('End date validation failed, skipping end date update', { component: 'CalendarView', data: { error: endValidation.error } });
            } else {
              // Ensure end is not before start (data integrity)
              if (newEndDate.isBefore(newStartDate)) {
                calendarLogger.warn('End date would be before start date, adjusting to match start', { component: 'CalendarView' });
                newEndDate = newStartDate;
              }
              
              updates[endDateField.name] = newEndDate.format(
                hasTimeInEnd ? "YYYY-MM-DDTHH:mm:ss" : "YYYY-MM-DD"
              );
            }
          }
        }
      }

      // Apply update with validated data
      api.updateRecord(
        updateRecordValues(record, updates),
        fields
      );
    } catch (error) {
      calendarLogger.error('Error updating record date', error, { component: 'CalendarView', action: 'updateDate' });
      new Notice('Ошибка при обновлении даты записи');
    }
  }

  function onRecordCheckWrapper(record: any, checked: boolean) {
    handleRecordCheck(record as DataRecord, checked);
  }

  function handleRecordCheck(record: DataRecord, checked: boolean) {
    if (!booleanField) {
      calendarLogger.warn('No boolean field configured for check operations', { component: 'CalendarView' });
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
      calendarLogger.error('Error updating record check state', error, { component: 'CalendarView', action: 'checkState' });
      new Notice('Ошибка при обновлении состояния записи');
    }
  }

  function handleRecordClick(entry: DataRecord) {
    if (!entry) {
      calendarLogger.warn('No entry provided for record click', { component: 'CalendarView' });
      return;
    }
  
    try {
      const app_instance = get(app);
      new EditNoteModal(
        app_instance,
        fields,
        async (record) => {
          try {
            await api.updateRecord(record, fields);
            // Force local update to trigger calendar re-render
            frame = {
              ...frame,
              records: frame.records.map(r => r.id === record.id ? record : r)
            };
          } catch (error) {
            calendarLogger.error('Error updating record in modal', error, { component: 'CalendarView', action: 'modalUpdate' });
            new Notice('Ошибка при сохранении изменений');
          }
        },
        entry,
        records,
        // v3.0.1: Open note callback
        () => {
          app_instance.workspace.openLinkText(entry.id, entry.id, false);
        },
        // v3.0.1: Rename note callback
        async (newName: string) => {
          try {
            const file = app_instance.vault.getAbstractFileByPath(entry.id);
            if (file && 'parent' in file) {
              const newPath = file.parent?.path 
                ? `${file.parent.path}/${newName}.md`
                : `${newName}.md`;
              await app_instance.fileManager.renameFile(file as any, newPath);
              new Notice(`Заметка переименована: ${newName}`);
            }
          } catch (e) {
            calendarLogger.error('Failed to rename note', e);
            new Notice('Ошибка при переименовании');
          }
        }
      ).open();
    } catch (error) {
      calendarLogger.error('Error opening edit modal', error, { component: 'CalendarView', action: 'openModal' });
    }
  }

  /**
   * Handle adding a new record from calendar
   * Auto-fills date and optionally time from click context
   * 
   * @param date - The date to create the record on
   * @param startTime - Optional start time (HH:mm format or dayjs with time)
   */
  function handleRecordAdd(date: dayjs.Dayjs, startTime?: string) {
    if (!dateField) {
      new Notice(get(i18n).t("views.calendar.errors.date-required"));
      return;
    }
  
    if (readonly) {
      new Notice(get(i18n).t("views.calendar.errors.create-readonly"));
      return;
    }
  
    try {
      // Build context for template interpolation
      const context: { date: dayjs.Dayjs; time?: string } = {
        date: date,
      };
      // Only include time if provided (exactOptionalPropertyTypes compatibility)
      if (startTime) {
        context.time = startTime;
      }
      
      new CreateNoteModal(get(app), project, (name, templatePath) => {
        try {
          if (dateField) {
            // Build frontmatter values with auto-filled date/time
            const frontmatterValues: Record<string, Date | string> = {
              [dateField.name]: date.toDate(),
            };
            
            // Auto-fill startTime if field is configured and time is provided
            const timeFieldName = config?.startTimeField || 'startTime';
            if (startTime) {
              frontmatterValues[timeFieldName] = startTime;
            }
            
            // Auto-fill endTime (1 hour after startTime) if both fields configured
            const endTimeFieldName = config?.endTimeField || 'endTime';
            if (startTime && endTimeFieldName) {
              // Parse startTime and add 1 hour
              const timeParts = startTime.split(':').map(Number);
              const hours = timeParts[0] ?? 0;
              const minutes = timeParts[1] ?? 0;
              const endHours = (hours + 1) % 24;
              frontmatterValues[endTimeFieldName] = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }
            
            api.addRecord(
              createDataRecord(name, project, frontmatterValues),
              fields,
              templatePath
            );
          }
        } catch (error) {
          calendarLogger.error('Error adding new record', error, { component: 'CalendarView', action: 'addRecord' });
        }
      }, context).open();
    } catch (error) {
      calendarLogger.error('Error opening create modal', error, { component: 'CalendarView', action: 'createModal' });
    }
  }

  // Agenda Logic
  $: agendaDate = focusedDate ?? dayjs();
  // Desktop uses local visibility state, mobile uses config
  let desktopAgendaVisible = true;
  // Sync agendaVisible with config for mobile in day scale
  // On mobile day scale, agendaOpen controls visibility directly
  $: agendaVisible = isMobile 
    ? (config?.agendaOpen ?? true)  // Mobile: use config
    : desktopAgendaVisible;  // Desktop: use local state

  function handleAgendaRecordClick(id: string) {
    const record = records.find((r: DataRecord) => r.id === id);
    if (record) {
      handleRecordClick(record);
    }
  }
  
  /**
   * v3.0.1: Open record in new window from AgendaSidebar (Ctrl+Click)
   */
  function handleAgendaOpenInNewWindow(event: CustomEvent<{id: string}>) {
    const { id } = event.detail;
    const app_instance = get(app);
    // On mobile use 'tab' (true), on desktop use 'window'
    const openMode = isMobile ? true : 'window';
    app_instance.workspace.openLinkText(id, id, openMode);
  }
  
  function handleAgendaToggle() {
    // Desktop: toggle local state
    desktopAgendaVisible = !desktopAgendaVisible;
  }
  
  getRecordColorContext.set(getRecordColor);
</script>

<ErrorBoundary componentName="CalendarView">
<ViewLayout>

  <div 
    class="calendar-zoom-container"
    use:gestureAction={{
      handlers: {
        onPinchZoom: (e) => {
          // Calculate center point of pinch gesture
          const centerX = (e.startX + e.endX) / 2;
          const centerY = (e.startY + e.endY) / 2;
          const centerDate = getDateFromCoordinates(centerX, centerY);
          
          // Map pinch gestures to zoom actions
          // spread (scale > 1) -> zoom IN (more detail)
          // pinch (scale < 1) -> zoom OUT (less detail)
          if (e.scale && e.scale > 1) doZoom('in', centerDate);
          else if (e.scale && e.scale < 1) doZoom('out', centerDate);
        },
        onHorizontalSwipe: (e, direction) => {
          // Only handle swipes in center zone (edge zones reserved for Obsidian)
          if (e.zone === 'center') {
            // Prevent accidental swipes: check minimum distance and velocity
            const minDistance = 50; // Minimum 50px swipe
            const minVelocity = 0.3; // Minimum velocity (px/ms)
            
            const distance = Math.abs(e.deltaX);
            const velocity = e.velocity || 0;
            
            // Only trigger if swipe is intentional (distance OR velocity threshold met)
            if (distance >= minDistance || velocity >= minVelocity) {
              handleHorizontalSwipe(direction);
            }
          }
        }
      }
    }}
    on:wheel={handleZoomWheel}
    on:keydown={handleKeyDown}
    role="application"
    aria-label="Calendar navigation"
    tabindex="-1"
  >
    <ViewContent noScroll={interval !== 'month' && interval !== '2weeks' && interval !== 'year'}>
        <!-- View coexistence: all views exist simultaneously, CSS controls visibility -->
        <!-- This prevents component destruction/recreation on interval change -->
        
        <!-- Year view (heatmap) -->
        <div 
          class="view-layer view-layer--year"
          class:view-layer--active={interval === 'year'}
          class:view-layer--hidden={interval !== 'year'}
        >
          <YearHeatmap
            {project}
            year={anchorDate.year()}
            groupedRecords={sortedGroupedRecords}
            {processedData}
            {now}
            {isMobile}
            {firstDayOfWeek}
            onDayClick={(date, records) => {
              handleDayTap(date, records);
            }}
            onMonthClick={(month, position) => {
              // Navigate to month view centered on clicked month
              focusedDate = month;
              // position is always 'center' from YearHeatmap
              focusedScrollPosition = 'center';
              saveConfig({ ...config, interval: 'month' });
            }}
            onYearChange={(newYear) => {
              // Navigate to different year
              anchorDate = anchorDate.year(newYear);
            }}
          />
        </div>
        
        <!-- Month and 2weeks views (vertical infinite scroll) -->
        <div 
          class="view-layer view-layer--month"
          class:view-layer--active={interval === 'month' || interval === '2weeks'}
          class:view-layer--hidden={interval !== 'month' && interval !== '2weeks'}
        >
          <InfiniteCalendar
            bind:this={verticalCalendarComponent}
            groupedRecords={sortedGroupedRecords}
            {processedData}
            firstDayOfWeek={firstDayOfWeek}
            checkField={booleanField?.name}
            targetDate={focusedDate}
            scrollPosition={focusedScrollPosition}
            isActive={interval === 'month' || interval === '2weeks'}
            onRecordClick={handleRecordClick}
            onRecordChange={handleRecordChange}
            onRecordCheck={handleRecordCheck}
            onRecordAdd={handleRecordAdd}
            onDayTap={handleDayTap}
            {isMobile}
            dateFieldName={dateField?.name}
            endDateFieldName={endDateField?.name}
            timezone={timezoneValue}
            displayMode={monthDisplayMode}
            startHour={config?.startHour ?? 7}
            endHour={config?.endHour ?? 21}
            {interval}
            onScrollToCurrent={(callback) => {
              scrollToCurrentCallback = callback;
            }}
            onScrollToDate={undefined}
          />
        </div>
        
        <!-- Horizontal views (week, day) -->
        <div 
          class="view-layer view-layer--horizontal"
          class:view-layer--active={interval !== 'month' && interval !== '2weeks' && interval !== 'year'}
          class:view-layer--hidden={interval === 'month' || interval === '2weeks' || interval === 'year'}
        >
          <div class="horizontal-calendar-wrapper">
            <InfiniteHorizontalCalendar
              bind:this={horizontalCalendarComponent}
              groupedRecords={sortedGroupedRecords}
              {processedData}
              {dataVersion}
              firstDayOfWeek={firstDayOfWeek}
              interval={interval}
              checkField={booleanField?.name}
              targetDate={focusedDate}
              isActive={interval === 'week' || interval === 'day'}
              onRecordClick={handleRecordClick}
              onRecordChange={handleRecordChange}
              onRecordCheck={onRecordCheckWrapper}
              onRecordAdd={handleRecordAdd}
              onDayTap={handleDayTap}
              {isMobile}
              {now}
              timeFormat={timeFormatValue}
              dateFieldName={dateField?.name}
              endDateFieldName={endDateField?.name}
              timezone={timezoneValue}
              displayMode={effectiveDisplayMode}
              startHour={config?.startHour ?? 6}
              endHour={config?.endHour ?? 22}
              onScrollToCurrent={(callback) => {
                horizontalScrollToCurrentCallback = callback;
              }}
              onScrollToDate={undefined}
            />
          </div>
        </div>
    </ViewContent>

    <!-- Agenda sidebar: Available on ALL devices (matryoshka principle) -->
    <!-- Desktop: Side panel with collapse, Mobile: Full drawer show/hide -->
    {#if interval === 'day' || config?.agendaOpen}
      <AgendaSidebar 
        project={project}
        records={records}
        currentDate={agendaDate}
        dateField={dateField?.name}
        timeField={config?.startTimeField}
        colorField={config?.eventColorField}
        checkField={booleanField?.name}
        timezone={timezoneValue}
        onRecordClick={handleAgendaRecordClick}
        onCreateRecord={(date) => handleRecordAdd(date)}
        visible={agendaVisible}
        collapsed={!isMobile && config?.agendaOpen === false}
        on:toggle={handleAgendaToggle}
        on:openInNewWindow={handleAgendaOpenInNewWindow}
      />
    {/if}
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
  
  <!-- Day popup for both mobile and desktop -->
  <!-- v6.0: Removed isMobile restriction - popup works everywhere -->
  <DayPopup
    {project}
    {config}
    date={dayPopupDate}
    records={dayPopupRecords}
    checkField={booleanField?.name}
    {getRecordColor}
    eventColorField={config?.eventColorField}
    processedData={processedData}
    {firstDayOfWeek}
    visible={showDayPopup}
    anchorX={dayPopupAnchorX}
    anchorY={dayPopupAnchorY}
    on:close={() => showDayPopup = false}
    on:recordClick={({ detail }) => handleDayPopupRecordClick(detail)}
    on:recordOpenInNewWindow={({ detail }) => handleDayPopupRecordOpenInNewWindow(detail)}
    on:recordSettings={({ detail }) => handleDayPopupRecordSettings(detail)}
    on:recordDelete={({ detail }) => handleDayPopupRecordDelete(detail)}
    on:recordDuplicate={({ detail }) => handleDayPopupRecordDuplicate(detail)}
    on:recordCheck={({ detail }) => handleDayPopupRecordCheck(detail.record, detail.checked)}
    on:recordColorChange={({ detail }) => handleDayPopupRecordColorChange(detail.record, detail.color)}
    on:createNote={({ detail }) => handleDayPopupCreateNote(detail)}
  />
</ViewLayout>
</ErrorBoundary>


<style>
  .calendar-zoom-container {
    display: flex;
    flex-direction: row;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    touch-action: pan-x pan-y;
    /* CRITICAL: Position context for AgendaSidebar.mobile (absolute positioning) */
    position: relative;
  }

  /* View coexistence: CSS-based visibility control */
  /* Both views exist in DOM simultaneously, preventing recreation on interval change */
  /* Smooth transitions between view layers for professional feel */
  .view-layer {
    width: 100%;
    height: 100%;
    position: relative;
    opacity: 0;
    transform: scale(0.98);
    transition: 
      opacity 200ms ease-out,
      transform 200ms ease-out;
    pointer-events: none;
    /* Use visibility instead of display for smoother transitions */
    visibility: hidden;
    /* When hidden, collapse to zero height to allow sibling to take space */
    max-height: 0;
    overflow: hidden;
  }
  
  .view-layer--hidden {
    opacity: 0;
    transform: scale(0.98);
    pointer-events: none;
    visibility: hidden;
    max-height: 0;
    overflow: hidden;
  }
  
  .view-layer--active {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
    visibility: visible;
    max-height: none;
    overflow: visible;
  }

  /* Specific fix for vertical infinite scrolling behavior */
  /* Month/Year views need height:auto to allow ViewContent to scroll */
  .view-layer--month.view-layer--active,
  .view-layer--year.view-layer--active {
    height: auto;
    min-height: 100%;
    /* v7.5: Keep overflow visible for proper content flow to parent scroll container */
    overflow: visible;
  }

  /* Horizontal/Timeline views need height:100% to handle their own internal scrolling */
  /* Setting height:auto here breaks the virtual container */
  .view-layer--horizontal.view-layer--active {
    height: 100%;
    overflow: hidden;
  }
  
  /* Year view - scroll is handled by ViewContent parent, not here */
  .view-layer--year.view-layer--active {
    overflow: visible;
    /* Ensure content fills available space */
    height: auto;
    min-height: 100%;
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
    backdrop-filter: blur(0.5rem);
    -webkit-backdrop-filter: blur(0.5rem);
  }

  .loading-spinner {
    background: var(--background-primary);
    padding: 1rem 1.5rem;
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    box-shadow: 0 0.25rem 1.5rem rgba(0, 0, 0, 0.12);
  }

  .spinner {
    width: 1.75rem;
    height: 1.75rem;
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
    font-size: 0.8125rem;
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .error-message {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    max-width: 25rem;
    background: var(--background-modifier-error);
    color: var(--text-on-accent);
    padding: 0.75rem 1rem;
    border-radius: 0.625rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 1001;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  


  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-0.625rem);
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
    width: 1.5rem;
    height: 1.5rem;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 50%;
    color: inherit;
    font-size: 1rem;
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
    gap: 0.5rem;
    background: var(--background-primary);
    padding: 1rem 1.5rem;
    border-radius: 1rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    border: 1px solid var(--background-modifier-border);
    backdrop-filter: blur(0.75rem);
    -webkit-backdrop-filter: blur(0.75rem);
  }

  .zoom-icon {
    color: var(--interactive-accent);
  }

  .zoom-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-normal);
    letter-spacing: -0.01em;
  }

  .zoom-level-dots {
    display: flex;
    gap: 0.375rem;
    margin-top: 0.25rem;
  }

  .zoom-dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background: var(--background-modifier-border);
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .zoom-dot.active {
    background: var(--interactive-accent);
    transform: scale(1.3);
  }

  @media (max-width: 48rem) {
    .error-message {
      left: 1rem;
      right: 1rem;
      transform: none;
      max-width: none;
    }

    .zoom-indicator {
      bottom: 0.75rem;
      right: 0.75rem;
      padding: 0.5rem 0.75rem;
    }

    .zoom-label {
      font-size: 0.8125rem;
    }

    .zoom-dot {
      width: var(--ppp-spacing-xs, 0.3125rem);
      height: 0.3125rem;
    }
  }

  @media (max-width: 30rem) {
    .zoom-indicator {
      bottom: 0.5rem;
      right: 0.5rem;
      padding: 0.375rem 0.625rem;
    }

    .zoom-label {
      font-size: 0.75rem;
    }

    .zoom-level-dots {
      gap: 0.25rem;
    }

    .zoom-dot {
      width: 0.25rem;
      height: 0.25rem;
    }
  }

  /* Ultra-narrow (320px) optimizations */
  @media (max-width: 22.5rem) {
    /* Zoom indicator ultra-compact */
    .zoom-indicator {
      padding: 0.25rem 0.5rem;
    }
  }

  /* Touch device optimizations */
  @media (pointer: coarse) {
    .zoom-indicator {
      padding: 0.625rem 0.875rem;
    }
  }
</style>
