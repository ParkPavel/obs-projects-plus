<script lang="ts">
  import { loadAppLocal, saveAppLocal } from "src/lib/appStorage";
  import { isAgendaCollapsed, isAgendaExpanded, shouldMountAgenda } from "./agenda/agendaVisibility";
  import dayjs from "dayjs";
  import { Notice, TFile } from "obsidian";
  import { createDataRecord } from "src/lib/dataApi";
  import { buildDuplicateValues, extractNoteBody } from "src/lib/duplicate/duplicateValues";
  import {
    DataFieldType,
    type DataField,
    type DataFrame,
    type DataRecord,
  } from "src/lib/dataframe/dataframe";
  import { updateRecordValues } from "src/lib/datasources/helpers";
  import { formatDateForProject, getFilterValuesFromConditions } from "src/lib/helpers";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { activateRecord, openRecord, modeFromNewLeaf, PLAIN_MODE } from "src/lib/record/openRecord";
  import { settings } from "src/lib/stores/settings";
  import { isMobileDevice } from "src/lib/stores/ui";
  import { agendaDrawer, close as closeAgendaDrawer } from "src/lib/stores/agendaDrawer";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { AgendaCustomList } from "src/settings/v3/settings";
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
  import { onMount, tick } from "svelte";
  import {
    getFirstDayOfWeek,
    parseDateInTimezone,
    extractDateWithPriority,
  } from "./calendar";
  import InfiniteCalendar from "./components/Calendar/InfiniteCalendar.svelte";
  import InfiniteHorizontalCalendar from "./components/Calendar/InfiniteHorizontalCalendar.svelte";
  import YearHeatmap from "./components/Calendar/YearHeatmap.svelte";
  import { ErrorBoundary } from "src/ui/components/ErrorBoundary";
  import AgendaSidebar from "./components/Timeline/AgendaSidebar.svelte";
  import { DayPopup } from "./components/DayPopup";
  import { DuplicatePopup } from "./components/DuplicatePopup";
  import type { CalendarConfig, ProcessedCalendarData, ProcessedRecord } from "./types";
  import type { CalendarInterval } from "./calendar";
  import { processCalendarData } from "./processor";
  import { calendarLogger } from "./logger";
  import { ZOOM_LEVELS, TIMING } from "./constants";
  import type { RecordChangeOptions } from "./dnd/types";
  import { buildRecordChangeUpdates, detectTimeModel } from "./dnd/recordChangeUpdates";
  import { setHapticEnabled } from "./dnd/HapticManager";
  
  // Navigation & Animation Controllers (v3.0.0)
  import { NavigationController, type NavigableCalendar } from "./navigation/NavigationController";
  import { ViewportStateManager } from "./viewport/ViewportStateManager";
  import { AnimationController } from "./animation/AnimationController";
  import { gestureCoordinator as gestureAction } from "./gestures/GestureCoordinator";
  import { ignoreHostSwipe } from "src/ui/actions/ignoreHostSwipe";
  import { noticeFor } from "src/lib/errors/errorText";

  /**
   * #202 — the codes this view raises. Sixteen of the messages below were
   * hardcoded Russian shown to every locale; the words now come from the
   * registry and the Russian lives in ru.json where it belongs.
   */
  const RENAME_FAILED = "PPP-301";
  const EDITOR_SAVE_FAILED = "PPP-302";
  const DELETE_FAILED = "PPP-303";
  const DUPLICATE_FAILED = "PPP-304";
  const CHECK_FAILED = "PPP-305";
  const CHECK_FIELD_REQUIRED = "PPP-306";
  const DATE_CHANGE_FAILED = "PPP-307";
  const DATE_REQUIRED = "PPP-308";
  const DATE_INVALID = "PPP-309";
  const RECORD_INVALID = "PPP-310";
  const COLOR_FAILED = "PPP-311";
  const COLOR_FIELD_REQUIRED = "PPP-312";
  const NAVIGATION_FAILED = "PPP-313";
  const CREATE_READONLY = "PPP-314";

  export let project: ProjectDefinition;
  export let frame: DataFrame;
  export let readonly: boolean;
  /**
   * #C4 — set only by DatabaseCallBlock for a block reading an EXTERNAL
   * project (`dataReadOnly={sourceReadOnly}`). Separate from `readonly`,
   * which historically only hid "create" (:1609) — the click-to-edit modal,
   * checkbox and drag-to-move handlers never checked it, so folding the
   * block's data-write ban into `readonly` (#139) would have changed what
   * `readonly` means for every standalone Calendar.
   */
  export let dataReadOnly: boolean = false;
  export let api: ViewApi;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let config: CalendarConfig | undefined;
  export let onConfigChange: (cfg: CalendarConfig) => void;
  // Data version counter - incremented on each data update to force Svelte reactivity
  export let dataVersion: number = 0;
  export let filterConditions: import("src/settings/settings").FilterCondition[] = [];

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
        scrollOffset: 0,
        timestamp: Date.now(),
        version: 1
      };
      
      saveAppLocal(getStorageKey(), JSON.stringify(state));
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
      const stored = loadAppLocal(getStorageKey());
      if (!stored) return null;
      
      const state = JSON.parse(stored) as PersistedViewState;
      
      // Validate state
      if (!state.date || !state.interval) return null;
      
      // Check if state is too old (7 days)
      const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - state.timestamp > MAX_AGE_MS) {
        // Remove stale state using App API
        saveAppLocal(getStorageKey(), null);
        return null;
      }
      
      calendarLogger.debug('View state loaded', { component: 'CalendarView', data: state as unknown as Record<string, unknown> });
      return state;
    } catch (error) {
      calendarLogger.warn('Failed to load view state', { component: 'CalendarView', data: { error } });
      return null;
    }
  }
  
  // Component references for navigation
  let verticalCalendarComponent: InfiniteCalendar; 
  let horizontalCalendarComponent: InfiniteHorizontalCalendar;
  
  // Sync components with controller
  $: navigationController.setVerticalCalendar(verticalCalendarComponent as unknown as NavigableCalendar);
  $: navigationController.setHorizontalCalendar(horizontalCalendarComponent as unknown as NavigableCalendar);

  /**
   * Read the latest project from the settings store.
   * CalendarView's local `project` prop has stale `views[].config` because
   * view config changes (interval, agendaOpen, etc.) go through
   * settings.updateViewConfig → store, but never back into CalendarView's
   * local `project` prop. Using the stale local copy in settings.updateProject()
   * reverts view configs, causing the calendar to jump to today.
   */
  function getLatestProject(): ProjectDefinition {
    return get(settings).projects.find(p => p.id === project.id) ?? project;
  }

  // Deferred config save — breaks synchronous cascade:
  // saveConfig → settings store → App re-derive → View $set → CalendarView reactive blocks
  // Without deferral, this chain runs WITHIN the same call stack, causing 3+ waves of reactive
  // evaluation that can freeze the UI.
  let _saveConfigTimer: ReturnType<typeof setTimeout> | null = null;
  function saveConfig(cfg: CalendarConfig) {
    config = cfg;
    // Defer parent notification to next microtask — prevents synchronous cascade
    // through settings store → App.svelte → View.svelte → useView → $set → reactive blocks
    if (_saveConfigTimer) clearTimeout(_saveConfigTimer);
    _saveConfigTimer = setTimeout(() => {
      _saveConfigTimer = null;
      onConfigChange(cfg);
    }, 0);
  }

  // Reactive frame data - dataVersion forces re-evaluation on every data update
  $: fields = dataVersion >= 0 ? frame.fields : frame.fields;
  $: records = dataVersion >= 0 ? frame.records : frame.records;
  
  // Agenda records filtering (v3.0.4)
  // Standard mode: use all records (AgendaSidebar handles its own date filtering)
  // Custom mode: use all records (filterEngine handles filtering)
  // The agenda has its own date-based categorization, independent of calendar filters
  $: agendaRecords = records;
  
  // Filter agendaRecords to only DataRecord types (for AgendaSidebar compatibility)
  $: agendaSidebarRecords = agendaRecords.filter(
    (r): r is DataRecord => 'id' in r && 'values' in r
  );

  let anchorDate: dayjs.Dayjs = dayjs();
  let scrollToCurrentCallback: (() => void) | null = null;
  let horizontalScrollToCurrentCallback: (() => void) | null = null;
  let now = dayjs();
  let nowTimer: ReturnType<typeof setInterval> | null = null;

  // v3.1.0: Instant mode — suppress CSS transitions on view switching
  $: isInstantMode = $settings.preferences.animationBehavior === 'instant';

  // v4.0.3: Sync haptic feedback enable/disable from settings
  $: setHapticEnabled(!$settings.preferences.disableHapticFeedback);
  
  let isLoading = true;
  
  // v10.2: Defer heavy calendar body by 1 frame so the browser can paint the shell immediately.
  // Without this, the entire component tree (IHC → TimelineView → 35 DayColumns) renders synchronously
  // before the first paint, causing a perceived freeze during tab switch.
  let calendarReady = false;
  let errorMessage: string | null = null;

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
  
  // Guard to skip reactive blocks during initial mount (prevents startup cascade)
  let mounted = false;
  
  // Deferred view mounting: only create a view layer after it's been activated
  // This prevents mounting ALL 3 calendar views (year + month + horizontal) on startup
  let yearActivated = false;
  let monthActivated = false;
  let horizontalActivated = false;
  
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
      scrollOffset: 0,
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
    const elementAtPoint = activeDocument.elementFromPoint(x, y);
    
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
    
    // Batch startup config writes into a single saveConfig call
    // to avoid multiple settings → App → View → onData cascades
    const startupConfig: Record<string, unknown> = {};
    
    // Restore interval from persisted state (but NOT the date — always start on today)
    const state = loadViewState();
    if (state && state.interval !== getCurrentInterval()) {
      startupConfig['interval'] = state.interval;
    }
    
    // Clear centerOn if it was left as "today" from previous session
    if (config?.["centerOn"] === "today") {
      startupConfig['centerOn'] = null;
    }
    
    // Apply all startup config changes in one write
    if (Object.keys(startupConfig).length > 0) {
      saveConfig({ ...config, ...startupConfig } as CalendarConfig);
    }
    
    // Always navigate to today on fresh load
    setTimeout(() => {
      navigateToDate('today');
    }, isInstantMode ? 0 : 300);
    
    // Save state periodically (every 30 seconds while active)
    const autoSaveInterval = setInterval(() => {
      saveViewState();
    }, 30_000);
    
    // Save state when window/tab loses focus
    const handleVisibilityChange = () => {
      if (activeDocument.visibilityState === 'hidden') {
        saveViewState();
      }
    };
    activeDocument.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Save state before page unload
    const handleBeforeUnload = () => {
      saveViewState();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Mark as mounted so reactive blocks (centerOn etc.) can fire normally
    mounted = true;

    // v10.2: Defer heavy view rendering to next frame — browser paints the shell first
    requestAnimationFrame(() => {
      calendarReady = true;
      isLoading = false;
    });
    
    return () => {
      if (nowTimer) {
        clearInterval(nowTimer);
      }
      clearInterval(autoSaveInterval);
      activeDocument.removeEventListener('visibilitychange', handleVisibilityChange);
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
      new Notice(noticeFor(NAVIGATION_FAILED));
    }
  }

  // Handle centerOn="today" from toolbar button (App.svelte sets config.centerOn = "today").
  // Safe now because saveConfig defers onConfigChange via setTimeout, breaking the
  // synchronous cascade: saveConfig → settings → App → View → $set → reactive re-fire.
  $: if (mounted && config?.["centerOn"] === "today") {
    navigateToDate('today');
    saveConfig({ ...config, centerOn: null });
  }
  
  // Track interval changes - but DON'T auto-center if focusedDate is set
  // focusedDate is set during zoom operations and should take priority
  let lastIntervalForCentering: string | null = null;
  // v3.3.5: Guard flag — suppress navigateToDate('today') during agenda operations
  let _agendaGuard = false;
  // BUG-A2 fix: detect rapid cascade — two interval changes within 150ms means
  // a settings cascade fired (e.g. agenda reorder → config write → props update),
  // not a genuine user-initiated interval switch. Skip auto-centering in that case.
  let _lastIntervalChangeTime = 0;
  $: if (mounted && interval && interval !== lastIntervalForCentering) {
    const _now = Date.now();
    const _isRapidChange = _now - _lastIntervalChangeTime < 150;
    _lastIntervalChangeTime = _now;
    lastIntervalForCentering = interval;
    // Only auto-center to today if NO focusedDate is set (e.g., initial load or manual interval change)
    // When zooming, focusedDate is already set and components will use it
    if (!focusedDate && !_agendaGuard && !_isRapidChange) {
      const delay = isInstantMode ? 0 : 200;
      setTimeout(() => {
        navigateToDate('today');
      }, delay);
    }
  }

  $: dateFields = fields
    .filter((field) => !field.repeated)
    .filter((field) => field.type === DataFieldType.Date);
  
  /**
   * Cache for synthetic DataField objects.
   * Prevents creating new object references on every reactive tick,
   * which would cascade re-renders through Svelte's reference equality checks.
   */
  const syntheticFieldCache = new Map<string, DataField>();
  
  /**
   * Helper: find a field by name in a list, or create a cached synthetic DataField
   * if the config has a name set but the field doesn't exist yet in detected fields.
   * This allows users to type new field names in settings that will be created on first use.
   */
  function resolveFieldByName(
    fieldList: DataField[],
    configName: string | undefined,
    fallbackType: DataFieldType = DataFieldType.Date
  ): DataField | undefined {
    if (!configName) return undefined;
    const found = fieldList.find((f) => f.name === configName);
    if (found) return found;
    // Return cached synthetic field to keep stable reference
    const cacheKey = `${configName}:${fallbackType}`;
    let cached = syntheticFieldCache.get(cacheKey);
    if (!cached) {
      cached = { name: configName, type: fallbackType, repeated: false, identifier: false, derived: false };
      syntheticFieldCache.set(cacheKey, cached);
    }
    return cached;
  }

  // v3.0.0 Priority logic:
  // 1. Try startDateField from config (trust user input, create synthetic if needed)
  // 2. Try common date field names: startDate, date, deadline, dueDate
  // 3. Fall back to first date field
  $: startDateField = 
    resolveFieldByName(dateFields, config?.startDateField) ??
    dateFields.find((field) => field.name === "startDate") ??
    dateFields.find((field) => field.name === "date") ??
    dateFields.find((field) => field.name === "deadline") ??
    dateFields.find((field) => field.name === "dueDate") ??
    dateFields[0]; // Fallback to any date field
  
  // Creation date field (separate from event start date)
  // Auto-filled when creating new notes, not used for event start detection
  $: creationDateField =
    resolveFieldByName(dateFields, config?.dateField);
  
  // Final dateField: only startDateField (creation date is independent)
  $: dateField = startDateField;
  
  $: endDateField =
    resolveFieldByName(dateFields, config?.endDateField) ??
    dateFields.find((field) => field.name === "endDate");

  $: booleanField = resolveFieldByName(fields, config?.checkField, DataFieldType.Boolean) ??
    fields.find((field) => config?.checkField === field.name);
  
  // Title field for agenda - try 'name', 'title', or first string field
  $: titleField = (() => {
    // Try common name fields
    const nameField = fields.find((field) => field.name === "name");
    if (nameField) return nameField;
    
    const titleFieldCandidate = fields.find((field) => field.name === "title");
    if (titleFieldCandidate) return titleFieldCandidate;
    
    // Fall back to first string field
    return fields.find((field) => field.type === DataFieldType.String);
  })();

  // Use global mobile detection store
  $: isMobile = $isMobileDevice;
  
  // Get mobile calendar preference
  $: mobileCalendarView = $settings.preferences.mobileCalendarView || 'month';
  
  // Apply mobile preference if on mobile and no config yet
  $: defaultInterval = isMobile ? mobileCalendarView : "week";
  $: interval = config?.interval ?? defaultInterval;
  
  // Activate view layers on first use (deferred mounting)
  $: if (interval === 'year') yearActivated = true;
  $: if (interval === 'month' || interval === '2weeks') monthActivated = true;
  $: if (interval === 'week' || interval === 'day') horizontalActivated = true;
  
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
  // The element the day was tapped on: where focus goes back to when the
  // duplicate window opened from that day's popup closes.
  let dayTapOrigin: HTMLElement | null = null;

  // Duplicate window state. It lives HERE, not in DayPopup: the day popup
  // closes the moment the window opens, and a window owned by it would be
  // destroyed with it.
  type DuplicateRequest = {
    record: DataRecord;
    processed: ProcessedRecord;
    // The data as it was when the window opened: the window re-reads its
    // source on every change of this, and a note created meanwhile must not
    // reset the selection.
    existing: ProcessedCalendarData;
  };
  let duplicateRequest: DuplicateRequest | null = null;

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
    // Duck-typed: in a popout window the target is not an instance of THIS
    // bundle's HTMLElement.
    const tapTarget = event?.target;
    dayTapOrigin = tapTarget && "closest" in tapTarget ? (tapTarget as HTMLElement) : null;

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
    // B10: the day window's "Open" opens the peek, like every other surface.
    handleRecordClick(record);
  }
  
  /**
   * v3.0.8: Unified note navigation from popup
   * Ctrl+click → new tab, Shift+click → new window
   */
  function handleDayPopupRecordOpenInNewWindow(record: DataRecord) {
    showDayPopup = false;
    const app_instance = get(app);
    // On mobile use 'tab' (window not supported), on desktop use 'window'
    const openMode = isMobile ? 'tab' : 'window';
    void openRecord({ id: record.id }, modeFromNewLeaf(openMode), { app: app_instance });
  }
  
  function handleDayPopupRecordSettings(record: DataRecord) {
    showDayPopup = false;
    const app_instance = get(app);
    if (dataReadOnly) {
      void openRecord({ id: record.id }, PLAIN_MODE, { app: app_instance });
      return;
    }
    new EditNoteModal(
      app_instance, 
      fields, 
      async (updatedRecord) => {
        try {
          // #161 — mirror the change locally only if it actually reached the
          // file. `updateRecord` rolls its own store back and tells the user on
          // failure; copying the value in here anyway would put it straight
          // back on screen.
          const saved = await api.updateRecord(updatedRecord, fields);
          if (saved) {
            // Force local update to trigger calendar re-render
            frame = {
              ...frame,
              records: frame.records.map(r => r.id === updatedRecord.id ? updatedRecord : r)
            };
          }
        } catch (e) {
          calendarLogger.error('Failed to update record from modal', e);
          new Notice(noticeFor(EDITOR_SAVE_FAILED));
        }
      },
      record,
      records,
      // v3.0.8: Unified note open with modifier-based navigation
      (openMode) => {
        void openRecord({ id: record.id }, modeFromNewLeaf(openMode), { app: app_instance });
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
            new Notice(get(i18n).t("views.calendar.notices.renamed", { defaultValue: "Note renamed: {{name}}", name: newName }));
          }
        } catch (e) {
          calendarLogger.error('Failed to rename note', e);
          new Notice(noticeFor(RENAME_FAILED));
        }
      },
      // v3.0.4: Autosave setting from project
      project.autosave ?? true
    ).open();
  }
  
  async function handleDayPopupRecordDelete(record: DataRecord) {
    if (dataReadOnly) return;
    try {
      await api.deleteRecord(record.id);
      // Remove from popup records
      dayPopupRecords = dayPopupRecords.filter(r => r.id !== record.id);
      if (dayPopupRecords.length === 0) {
        showDayPopup = false;
      }
    } catch (error) {
      calendarLogger.error('Error deleting record', error, { component: 'CalendarView', action: 'deleteRecord' });
      new Notice(noticeFor(DELETE_FAILED));
    }
  }
  
  async function handleDayPopupRecordDuplicate(event: { 
    record: DataRecord; 
    targetDates: dayjs.Dayjs[];
    customTime?: { startTime: dayjs.Dayjs; endTime: dayjs.Dayjs } | null;
  }) {
    if (dataReadOnly) return;
    const { record, targetDates, customTime } = event;
    if (!dateField) return;

    try {
      const startFieldName = dateField.name;
      const endFieldName = endDateField?.name;
      const sourceStart = parseDateInTimezone(record.values[startFieldName], timezoneValue, project.dateFormat?.writeFormat);
      const sourceEnd = endFieldName
        ? parseDateInTimezone(record.values[endFieldName], timezoneValue, project.dateFormat?.writeFormat)
        : null;
      // The copy keeps the note's text. Read before anything is created, so a
      // note that cannot be read fails the whole duplicate instead of leaving
      // copies without their body.
      const body = await readSourceBody(record);

      for (const targetDate of targetDates) {
        // Create a new record with the same content but different date
        const baseName = record.id.split('/').pop()?.replace('.md', '') || 'note';

        // The values of the copy: stored ones only, the chosen time in the
        // note's own time model, the date in the source's shape, the span kept.
        const newValues = buildDuplicateValues({
          values: record.values,
          fields,
          dateFieldName: startFieldName,
          endDateFieldName: endFieldName,
          startTimeFieldName: config?.startTimeField || 'startTime',
          endTimeFieldName: config?.endTimeField || 'endTime',
          sourceStart,
          sourceEnd,
          targetDate,
          customTime: customTime ?? null,
          dateFormat: project.dateFormat?.writeFormat,
        });

        // When dateField is "name", the date goes into the filename, not frontmatter
        let effectiveName: string;
        if (dateField.name === "name") {
          const datePrefix = targetDate.format("YYYY-MM-DD");
          // Strip existing date prefix from baseName for clean copy name
          const nameWithoutDate = baseName.replace(/^\d{4}-\d{2}-\d{2}\s*/, '');
          effectiveName = nameWithoutDate
            ? `${datePrefix} ${nameWithoutDate}_copy`
            : `${datePrefix}_copy`;
        } else {
          effectiveName = baseName + '_copy_' + (formatDateForProject(targetDate, project) ?? targetDate.format('YYYY-MM-DD'));
        }

        const newRecord = createDataRecord(
          effectiveName,
          project,
          newValues as Record<string, import('src/lib/dataframe/dataframe').Optional<import('src/lib/dataframe/dataframe').DataValue>>
        );
        await api.addRecord(newRecord, fields, "", body);
      }
      new Notice(get(i18n).t("views.calendar.notices.duplicated", { defaultValue: "Note duplicated to {{count}} date(s)", count: targetDates.length }));
    } catch (error) {
      calendarLogger.error('Error duplicating record', error, { component: 'CalendarView', action: 'duplicateRecord' });
      new Notice(noticeFor(DUPLICATE_FAILED));
    }
  }
  
  /**
   * The text of the source note under its frontmatter. Empty when the record is
   * not a note in the vault, so a virtual record still duplicates.
   */
  async function readSourceBody(record: DataRecord): Promise<string> {
    const app_instance = get(app);
    const file = app_instance.vault.getAbstractFileByPath(record.id);
    if (!(file instanceof TFile)) return "";
    return extractNoteBody(await app_instance.vault.read(file));
  }

  /**
   * The day popup asked for the duplicate window. The popup closes and the
   * window opens as a layer of its own: it is owned by this view, so closing
   * the popup cannot take it down.
   */
  function handleDayPopupRecordDuplicateRequest(record: DataRecord) {
    if (dataReadOnly || !processedData) return;
    const processed = processedData.processed.find((pr) => pr.record.id === record.id);
    if (!processed) return;
    duplicateRequest = { record, processed, existing: processedData };
    showDayPopup = false;
  }

  function handleDuplicateConfirm(detail: {
    targetDates: dayjs.Dayjs[];
    customTime: { startTime: dayjs.Dayjs; endTime: dayjs.Dayjs } | null;
  }) {
    if (!duplicateRequest) return;
    void handleDayPopupRecordDuplicate({
      record: duplicateRequest.record,
      targetDates: detail.targetDates,
      customTime: detail.customTime,
    });
  }

  /**
   * The window closed, by confirm, cancel, Escape or backdrop. Focus goes back
   * to the control the day was opened from: the popup it would have returned to
   * is gone, and the trap only restores focus to a control that still exists.
   */
  function handleDuplicateClose() {
    duplicateRequest = null;
    const origin = dayTapOrigin?.closest<HTMLElement>("button, a[href], input, select, textarea, [tabindex]") ?? null;
    dayTapOrigin = null;
    void tick().then(() => {
      if (origin?.isConnected) origin.focus({ preventScroll: true });
    });
  }

  async function handleDayPopupRecordCheck(record: DataRecord, checked: boolean) {
    if (dataReadOnly) return;
    if (!booleanField) return;
    
    try {
      // #161 — a failed write must not leave the checkbox ticked.
      const saved = await api.updateRecord(
        updateRecordValues(record, {
          [booleanField.name]: checked,
        }),
        fields
      );
      if (!saved) return;
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
      new Notice(noticeFor(CHECK_FAILED));
    }
  }
  
  /**
   * v3.0.2: Handle color change from popup
   * Saves to frontmatter using eventColorField
   */
  async function handleDayPopupRecordColorChange(record: DataRecord, color: string) {
    if (dataReadOnly) return;
    const colorFieldName = config?.eventColorField;
    if (!colorFieldName) {
      new Notice(noticeFor(COLOR_FIELD_REQUIRED));
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
      
      // #161 — only mirror what actually reached the file.
      const saved = await api.updateRecord(updatedRecord, fields);
      if (!saved) return;
      
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
      
      // Force cache invalidation — reset version so $: block re-fires
      lastProcessedVersion = -1;
      
      calendarLogger.debug('Color change completed successfully', { component: 'CalendarView', action: 'colorChange' });
      
    } catch (error) {
      calendarLogger.error('Error updating record color', error, { component: 'CalendarView', action: 'colorChange' });
      new Notice(noticeFor(COLOR_FAILED));
    }
  }
  
  function handleDayPopupCreateNote(date: dayjs.Dayjs) {
    showDayPopup = false;
    handleRecordAdd(date);
  }

  $: firstDayOfWeek = getFirstDayOfWeek(
    $settings.preferences.locale.firstDayOfWeek
  );

  // v10.0: Single-pass data processing — eliminates double O(N×D) grouping
  // Previously: groupRecordsByRange O(N×D) + processCalendarData→groupByDate O(N×D) = 2× freeze
  // Now: processCalendarData runs ONCE; sortedGroupedRecords derived from result (zero extra grouping)
  
  let cachedProcessedData: ProcessedCalendarData | null = null;
  let lastProcessedVersion = -1;
  let lastProcessedConfigKey = '';
  
  // CRITICAL: Use function-call pattern to break Svelte's self-referential dependency tracking.
  // A $: block that reads lastProcessedVersion/lastProcessedConfigKey as dependencies AND
  // writes them (via $$invalidate) creates an infinite flush() loop in Svelte 3:
  //   → $: block runs → writes -1/'' (even same values) → $$invalidate → component dirty
  //   → flush() sees dirty[0] === -1 (reset before fragment.p runs) → pushes back → re-runs → ∞
  // Function body is NOT analyzed for $: dependencies — only the explicit arguments are tracked.
  $: updateProcessedData(dateField, config, records, dataVersion, frame, getRecordColor, project.dateFormat?.writeFormat);
  function updateProcessedData(
    df: typeof dateField,
    cfg: typeof config,
    recs: typeof records,
    dv: typeof dataVersion,
    fr: typeof frame,
    getColor: typeof getRecordColor,
    writeFormat?: string
  ): void {
    const startField = df?.name;
    
    if (startField && cfg && recs && recs.length > 0) {
      // Cheap change detection: dataVersion increments on every data update,
      // configKey only includes fields that affect processing
      const configKey = `${cfg.startDateField}|${cfg.endDateField}|${cfg.startTimeField}|${cfg.endTimeField}|${cfg.eventColorField}|${cfg.timezone}|${cfg.startHour}|${cfg.endHour}|${writeFormat}`;
      
      if (dv !== lastProcessedVersion || configKey !== lastProcessedConfigKey) {
        lastProcessedVersion = dv;
        lastProcessedConfigKey = configKey;
        cachedProcessedData = processCalendarData(fr, cfg, getColor, writeFormat);
        calendarLogger.debug('[Perf] processCalendarData called', { data: { dataVersion: dv, records: recs.length } });
      }
    } else {
      cachedProcessedData = null;
      lastProcessedVersion = -1;
      lastProcessedConfigKey = '';
    }
  }
  
  $: processedData = cachedProcessedData;
  
  // Derive sortedGroupedRecords from processedData.grouped
  // Uses pre-parsed startDate from ProcessedRecord (no re-parsing!)
  $: sortedGroupedRecords = (() => {
    if (!processedData?.grouped) return {} as Record<string, DataRecord[]>;
    const result: Record<string, DataRecord[]> = {};
    for (const key in processedData.grouped) {
      const prs = processedData.grouped[key];
      if (!prs) continue;
      // Sort using ALREADY PARSED startDate timestamps — zero dayjs overhead
      const sorted = [...prs].sort((a, b) => {
        const aTs = a.startDate?.valueOf() ?? 0;
        const bTs = b.startDate?.valueOf() ?? 0;
        if (aTs !== bTs) return aTs - bTs;
        return a.record.id.localeCompare(b.record.id);
      });
      result[key] = sorted.map(pr => pr.record);
    }
    return result;
  })();

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
  async function handleRecordChange(date: dayjs.Dayjs, record: DataRecord, options?: RecordChangeOptions) {
    if (dataReadOnly) return;
    // Validate record integrity first
    const recordValidation = validateRecordIntegrity(record);
    if (!recordValidation.isValid) {
      calendarLogger.error('Record validation failed', undefined, { component: 'CalendarView', action: 'recordChange', data: { error: recordValidation.error } });
      new Notice(noticeFor(RECORD_INVALID));
      return;
    }
    
    if (!dateField) {
      calendarLogger.warn('No date field configured for record change', { component: 'CalendarView', action: 'recordChange' });
      new Notice(noticeFor(DATE_REQUIRED));
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
        undefined, // creation date field is not used for event start
        endDateField?.name,
        timezoneValue,
        project.dateFormat?.writeFormat
      );
      const targetDate = date.startOf('day');

      // v3.2.2: Detect the time model — "separate fields" vs "embedded time".
      // This MUST mirror the processor's extractTimeInfo() logic:
      //   - If date field has embedded time (e.g. "2026-03-12T14:30:00") → embedded model
      //   - If date field has NO embedded time but startTime/endTime fields exist → separate model
      // Writing to the wrong model corrupts the data permanently.
      // v3.3.6: Embedded time is detected ONLY from the raw value format, not typeConfig
      // (detectTimeModel in dnd/recordChangeUpdates.ts).
      const startTimeFieldName = config?.startTimeField || 'startTime';
      const endTimeFieldName = config?.endTimeField || 'endTime';
      const { startHasEmbeddedTime, hasSeparateStartTime } = detectTimeModel(
        record.values,
        dateField.name,
        startTimeFieldName
      );

      // Validate target date
      const hasAnyTime = startHasEmbeddedTime || hasSeparateStartTime || !!options?.startTime;
      const validation = validateDateUpdate(originalStart, targetDate, hasAnyTime, timezoneValue);
      if (!validation.isValid) {
        calendarLogger.error('Date validation failed', undefined, { component: 'CalendarView', action: 'recordChange', data: { error: validation.error } });
        new Notice(noticeFor(DATE_INVALID));
        return;
      }

      // Which fields change and to what is decided by the pure builder
      // (dnd/recordChangeUpdates.ts): it respects the time model, keeps the
      // duration on a move and writes the end time with or without an end-date field.
      const endRawValue = endDateField?.name ? record.values[endDateField.name] : undefined;
      const built = buildRecordChangeUpdates({
        values: record.values,
        dateFieldName: dateField.name,
        endDateFieldName: endDateField?.name,
        startTimeFieldName,
        endTimeFieldName,
        targetDate,
        options,
        originalStart,
        originalEnd: endDateField?.name ? parseDateInTimezone(endRawValue, timezoneValue, project.dateFormat?.writeFormat) : null,
        validateEndShift: (orig, next, hasTime) => validateDateUpdate(orig, next, hasTime, timezoneValue),
      });
      const newStartDate = built.newStartDate;
      for (const warning of built.warnings) {
        calendarLogger.warn(warning, { component: 'CalendarView' });
      }

      // When dateField is "name", the date is stored in the filename — rename the file
      if (dateField.name === "name") {
        const app_instance = get(app);
        const file = app_instance.vault.getAbstractFileByPath(record.id);
        if (file && 'parent' in file) {
          const oldBasename = record.id.substring(record.id.lastIndexOf('/') + 1).replace(/\.md$/i, '');
          const newDateStr = newStartDate.format("YYYY-MM-DD");
          
          const datePattern = /^\d{4}-\d{2}-\d{2}/;
          let newBasename: string;
          if (datePattern.test(oldBasename)) {
            newBasename = oldBasename.replace(datePattern, newDateStr);
          } else {
            newBasename = `${newDateStr} ${oldBasename}`;
          }
          
          const dir = record.id.substring(0, record.id.lastIndexOf('/'));
          const newPath = dir ? `${dir}/${newBasename}.md` : `${newBasename}.md`;
          await app_instance.fileManager.renameFile(file as any, newPath);
        }
        return;
      }

      // Start/end writes (end date delta shift, time preservation, end time with or
      // without an end-date field) come from buildRecordChangeUpdates above.
      const updates = built.updates;

      // Apply update with validated data
      const updatedRecord = updateRecordValues(record, updates);
      api.updateRecord(updatedRecord, fields);

      // v3.2.1: Optimistic local update — bypass the long reactive chain
      // (dataFrame store → DataFrameProvider → App → View → useView → onData → $set)
      // by directly patching frame and bumping dataVersion so reactive blocks fire immediately.
      frame = {
        ...frame,
        records: frame.records.map(r => r.id === updatedRecord.id ? updatedRecord : r),
      };
      dataVersion++;

      // v3.2.2: Auto-navigate to target date if it moved outside current visible period.
      // Uses the component ref to scroll — avoids date going off-screen after cross-week DnD.
      if (horizontalCalendarComponent && (interval === 'week' || interval === 'day')) {
        const targetDay = targetDate.startOf('day');
        const currentPeriodStart = focusedDate?.startOf('day') ?? dayjs().startOf('day');
        const isSamePeriod = targetDay.isSame(currentPeriodStart, 'week');
        if (!isSamePeriod) {
          focusedDate = targetDay;
          requestAnimationFrame(() => {
            horizontalCalendarComponent?.scrollToDate?.(targetDay);
          });
        }
      }
    } catch (error) {
      calendarLogger.error('Error updating record date', error, { component: 'CalendarView', action: 'updateDate' });
      new Notice(noticeFor(DATE_CHANGE_FAILED));
    }
  }

  function onRecordCheckWrapper(record: any, checked: boolean) {
    handleRecordCheck(record as DataRecord, checked);
  }

  function handleRecordCheck(record: DataRecord, checked: boolean) {
    if (dataReadOnly) return;
    if (!booleanField) {
      calendarLogger.warn('No boolean field configured for check operations', { component: 'CalendarView' });
      new Notice(noticeFor(CHECK_FIELD_REQUIRED));
      return;
    }
  
    try {
      const updatedRecord = updateRecordValues(record, {
        [booleanField.name]: checked,
      });
      api.updateRecord(updatedRecord, fields);

      // v3.2.1: Optimistic local update for immediate checkbox feedback
      frame = {
        ...frame,
        records: frame.records.map(r => r.id === updatedRecord.id ? updatedRecord : r),
      };
      dataVersion++;
    } catch (error) {
      calendarLogger.error('Error updating record check state', error, { component: 'CalendarView', action: 'checkState' });
      new Notice(noticeFor(CHECK_FAILED));
    }
  }

  /**
   * B10 — every plain activation of a record in the calendar (an event in any
   * scale, an agenda row, the day window's "Open") opens the peek, like the
   * table and the gallery (decision 2026-10-14 in `openRecord.ts`). The leaves
   * resolve Shift/Ctrl themselves; the agenda hands its event up. A read-only
   * source opens a read-only peek. The editor stays in the day window's
   * settings entry (`handleDayPopupRecordSettings`).
   */
  function handleRecordClick(entry: DataRecord, event?: MouseEvent) {
    if (!entry) return;
    void activateRecord({ id: entry.id, readonly: dataReadOnly || readonly }, event, { app: get(app) });
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
      new Notice(noticeFor(DATE_REQUIRED));
      return;
    }
  
    if (readonly) {
      new Notice(noticeFor(CREATE_READONLY));
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
              ...getFilterValuesFromConditions(filterConditions),
            };
            
            // Determine the effective note name:
            // If dateField is "name", incorporate the date into the filename
            // instead of writing it as a frontmatter property
            let effectiveName = name;
            if (dateField.name === "name") {
              const datePrefix = date.format("YYYY-MM-DD");
              // If user already typed a name, prepend date; otherwise use date as name
              if (name && name !== get(i18n).t("modals.note.create.untitled")) {
                // Avoid double-prefixing if name already starts with the date
                if (!name.startsWith(datePrefix)) {
                  effectiveName = `${datePrefix} ${name}`;
                }
              } else {
                effectiveName = datePrefix;
              }
            } else {
              // Normal frontmatter field — write date as field value
              frontmatterValues[dateField.name] = date.toDate();
            }
            
            // Auto-fill creation date if configured (separate from event start date)
            if (creationDateField && creationDateField.name !== dateField?.name && creationDateField.name !== "name") {
              frontmatterValues[creationDateField.name] = date.toDate();
            }
            
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
              createDataRecord(effectiveName, project, frontmatterValues),
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
  // Sync agendaVisible with config for mobile in day scale
  // On mobile day scale, agendaOpen controls visibility directly
  // Mobile drawer is local state that always starts closed on mount: persisted
  // config.agendaOpen is the desktop panel / toggle intent and (e.g. the cabinet demo
  // stores true) must not cover the grid on entry.
  // Mobile drawer: session store shared with the navbar toggle (App.svelte), keyed by the
  // project id (the same key App uses). Never persisted; default closed.
  $: drawerKey = project?.id;
  $: drawerOpen = drawerKey ? $agendaDrawer[drawerKey] === true : false;
  $: agendaVisible = isMobile
    ? drawerOpen  // Mobile: session store
    : true;  // Desktop: always mounted; collapsed via config.agendaOpen

  function handleAgendaRecordClick(id: string, event?: MouseEvent) {
    const record = records.find((r: DataRecord) => r.id === id);
    if (record) void activateRecord({ id: record.id, readonly: dataReadOnly || readonly }, event, { app: get(app) });
  }
  
  /**
   * v3.0.4: Handle saving custom agenda list
   */
  function handleAgendaSaveList(event: CustomEvent<{ list: AgendaCustomList }>) {
    const { list } = event.detail;
    
    // v4.0.6: Read latest project from settings store — local `project` has stale views[].config
    const latest = getLatestProject();
    const currentLists = latest.agenda?.custom?.lists ?? [];
    const existingIndex = currentLists.findIndex(l => l.id === list.id);
    
    let updatedLists: AgendaCustomList[];
    if (existingIndex >= 0) {
      // Update existing
      updatedLists = [...currentLists];
      updatedLists[existingIndex] = list;
    } else {
      // Add new
      updatedLists = [...currentLists, list];
    }
    
    // Update project with new lists
    const updatedProject: ProjectDefinition = {
      ...latest,
      agenda: {
        ...latest.agenda,
        mode: latest.agenda?.mode ?? 'custom',
        standard: {
          inheritCalendarFilters: latest.agenda?.standard?.inheritCalendarFilters ?? true,
        },
        custom: {
          ...(latest.agenda?.custom ?? {}),
          lists: updatedLists,
        },
      },
    };
    
    // Persist to settings store — the store → App.svelte → CalendarView
    // propagation updates children in the same Svelte flush.
    settings.updateProject(updatedProject);
  }
  
  /**
   * v3.0.4: Handle deleting custom agenda list
   */
  function handleAgendaDeleteList(event: CustomEvent<{ listId: string }>) {
    const { listId } = event.detail;
    
    // v4.0.6: Read latest project from settings store — local `project` has stale views[].config
    const latest = getLatestProject();
    const currentLists = latest.agenda?.custom?.lists ?? [];
    const updatedLists = currentLists.filter(l => l.id !== listId);
    
    const updatedProject: ProjectDefinition = {
      ...latest,
      agenda: {
        ...latest.agenda,
        mode: latest.agenda?.mode ?? 'custom',
        standard: {
          inheritCalendarFilters: latest.agenda?.standard?.inheritCalendarFilters ?? true,
        },
        custom: {
          ...(latest.agenda?.custom ?? {}),
          lists: updatedLists,
        },
      },
    };
    
    // v3.3.5: Guard + deferred pattern — prevents view cascade and interval centering
    _agendaGuard = true;
    project = updatedProject;
    setTimeout(() => {
      settings.updateProject(updatedProject);
      setTimeout(() => { _agendaGuard = false; }, 100);
    }, 0);
  }
  
  /**
   * v3.1.0: Handle reordering custom agenda lists (drag-and-drop)
   * v3.3.4: Update local project first for immediate UI feedback, then
   * defer settings.updateProject() to next microtask so the synchronous
   * settings → App → View → CalendarView reactive cascade doesn't
   * destroy/recreate the IHC component (which resets navigation to today).
   */
  function handleAgendaReorderLists(event: CustomEvent<{ lists: AgendaCustomList[] }>) {
    const { lists } = event.detail;
    
    // v4.0.6: Read latest project from settings store — local `project` has stale views[].config.
    // Using the stale local copy would revert interval/agendaOpen/etc., causing the
    // calendar to navigate back to today on the resulting settings cascade.
    const latest = getLatestProject();
    const updatedProject: ProjectDefinition = {
      ...latest,
      agenda: {
        ...latest.agenda,
        mode: latest.agenda?.mode ?? 'custom',
        standard: {
          inheritCalendarFilters: latest.agenda?.standard?.inheritCalendarFilters ?? true,
        },
        custom: {
          ...(latest.agenda?.custom ?? {}),
          lists,
        },
      },
    };
    
    // v3.3.5: Guard + deferred pattern — prevents view cascade and interval centering
    _agendaGuard = true;
    project = updatedProject;
    
    // Defer persistence to break the synchronous reactive chain
    setTimeout(() => {
      settings.updateProject(updatedProject);
      setTimeout(() => { _agendaGuard = false; }, 100);
    }, 0);
  }
  
  function handleAgendaToggle() {
    // Mobile (scrim / close button): close the session drawer, config is untouched
    if (isMobile) {
      closeAgendaDrawer(drawerKey);
      return;
    }
    // Desktop: collapse/expand the panel, persisted through the view config
    if (config) saveConfig({ ...config, agendaOpen: !isAgendaExpanded(config.agendaOpen) });
  }
  
  getRecordColorContext.set(getRecordColor);
  
  // Stable gesture handler references — prevents GestureCoordinator from being
  // destroyed and recreated on every CalendarView re-render (which would add a new
  // non-passive touchmove listener each time, causing performance degradation).
  // Handlers call current closure variables via the outer scope at call time.
  const _gestureHandlers = {
    onPinchZoom: (e: import('./gestures/GestureCoordinator').GestureEvent) => {
      const centerX = (e.startX + e.endX) / 2;
      const centerY = (e.startY + e.endY) / 2;
      const centerDate = getDateFromCoordinates(centerX, centerY);
      if (e.scale && e.scale > 1) doZoom('in', centerDate);
      else if (e.scale && e.scale < 1) doZoom('out', centerDate);
    },
    onHorizontalSwipe: (e: import('./gestures/GestureCoordinator').GestureEvent, direction: 'left' | 'right') => {
      if (e.zone === 'center') {
        const minDistance = 50;
        const minVelocity = 0.3;
        const distance = Math.abs(e.deltaX);
        const velocity = e.velocity || 0;
        if (distance >= minDistance || velocity >= minVelocity) {
          handleHorizontalSwipe(direction);
        }
      }
    }
  };
</script>

<ErrorBoundary componentName="CalendarView">
<ViewLayout>

  <div 
    class="calendar-zoom-container"
    use:gestureAction={{ handlers: _gestureHandlers }}
    use:ignoreHostSwipe
    on:wheel={handleZoomWheel}
    on:keydown={handleKeyDown}
    role="application"
    aria-label={$i18n.t("views.calendar.navigation.aria-label")}
    tabindex="-1"
  >
    <ViewContent noScroll={interval !== 'month' && interval !== '2weeks' && interval !== 'year'}>
        <!-- Deferred view mounting: only create a view after first activation, keep alive after -->
        <!-- v10.2: calendarReady defers ALL view layers by 1 frame so browser paints shell first -->
        
        <!-- Year view (heatmap) -->
        {#if calendarReady && yearActivated}
        <div 
          class="view-layer view-layer--year"
          class:view-layer--active={interval === 'year'}
          class:view-layer--hidden={interval !== 'year'}
          class:ppp-instant-mode={isInstantMode}
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
        {/if}
        
        <!-- Month and 2weeks views (vertical infinite scroll) -->
        {#if calendarReady && monthActivated}
        <div 
          class="view-layer view-layer--month"
          class:view-layer--active={interval === 'month' || interval === '2weeks'}
          class:view-layer--hidden={interval !== 'month' && interval !== '2weeks'}
          class:ppp-instant-mode={isInstantMode}
        >
          <InfiniteCalendar
            bind:this={verticalCalendarComponent}
            groupedRecords={sortedGroupedRecords}
            {processedData}
            firstDayOfWeek={firstDayOfWeek}
            checkField={booleanField?.name}
            iconField={config?.iconField}
            targetDate={focusedDate}
            scrollPosition={focusedScrollPosition}
            isActive={interval === 'month' || interval === '2weeks'}
            onRecordClick={handleRecordClick}
            onRecordChange={dataReadOnly ? undefined : handleRecordChange}
            onRecordCheck={handleRecordCheck}
            onRecordAdd={dataReadOnly ? undefined : handleRecordAdd}
            onDayTap={handleDayTap}
            {isMobile}
            dateFieldName={dateField?.name}
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
        {/if}
        
        <!-- Horizontal views (week, day) -->
        {#if calendarReady && horizontalActivated}
        <div 
          class="view-layer view-layer--horizontal"
          class:view-layer--active={interval !== 'month' && interval !== '2weeks' && interval !== 'year'}
          class:view-layer--hidden={interval === 'month' || interval === '2weeks' || interval === 'year'}
          class:ppp-instant-mode={isInstantMode}
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
              iconField={config?.iconField}
              targetDate={focusedDate}
              isActive={interval === 'week' || interval === 'day'}
              onRecordClick={handleRecordClick}
              onRecordChange={dataReadOnly ? undefined : handleRecordChange}
              onRecordCheck={onRecordCheckWrapper}
              onRecordAdd={dataReadOnly ? undefined : handleRecordAdd}
              onDayTap={handleDayTap}
              {isMobile}
              {now}
              timeFormat={timeFormatValue}
              dateFieldName={dateField?.name}
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
        {/if}
    </ViewContent>

    <!-- Agenda sidebar: Available on ALL devices (matryoshka principle) -->
    <!-- Desktop: Side panel with collapse, Mobile: Full drawer show/hide -->
    {#if shouldMountAgenda({ isMobile, interval, drawerOpen })}
      <AgendaSidebar 
        project={project}
        records={agendaSidebarRecords}
        fields={fields}
        currentDate={agendaDate}
        titleField={titleField?.name}
        dateField={dateField?.name}
        timeField={config?.startTimeField}
        colorField={config?.eventColorField}
        checkField={booleanField?.name}
        timezone={timezoneValue}
        onRecordClick={handleAgendaRecordClick}
        onCreateRecord={(date) => handleRecordAdd(date)}
        visible={agendaVisible}
        collapsed={isAgendaCollapsed(isMobile, config?.agendaOpen)}
        on:toggle={handleAgendaToggle}
        on:saveList={handleAgendaSaveList}
        on:deleteList={handleAgendaDeleteList}
        on:reorderLists={handleAgendaReorderLists}
      />
    {/if}
  </div>
  
  {#if isLoading}
    <div class="loading-overlay">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>{$i18n.t("common.loading")}</span>
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
        aria-label={$i18n.t("views.calendar.close-error")}
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
    visible={showDayPopup}
    anchorX={dayPopupAnchorX}
    anchorY={dayPopupAnchorY}
    on:close={() => showDayPopup = false}
    on:recordClick={({ detail }) => handleDayPopupRecordClick(detail)}
    on:recordOpenInNewWindow={({ detail }) => handleDayPopupRecordOpenInNewWindow(detail)}
    on:recordSettings={({ detail }) => handleDayPopupRecordSettings(detail)}
    on:recordDelete={({ detail }) => handleDayPopupRecordDelete(detail)}
    on:recordDuplicateRequest={({ detail }) => handleDayPopupRecordDuplicateRequest(detail)}
    on:recordCheck={({ detail }) => handleDayPopupRecordCheck(detail.record, detail.checked)}
    on:recordColorChange={({ detail }) => handleDayPopupRecordColorChange(detail.record, detail.color)}
    on:createNote={({ detail }) => handleDayPopupCreateNote(detail)}
  />

  <!-- Duplicate window: owned by this view so it outlives the day popup, and
       portalled to the body by the component so nothing covers it. -->
  {#if duplicateRequest}
    <DuplicatePopup
      visible={true}
      sourceRecord={duplicateRequest.processed}
      existingData={duplicateRequest.existing}
      {firstDayOfWeek}
      displayMode="bars"
      startHour={7}
      endHour={21}
      timezone={timezoneValue}
      on:confirm={({ detail }) => handleDuplicateConfirm(detail)}
      on:close={handleDuplicateClose}
    />
  {/if}
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
    /* v3.2.8: Explicit width constraint — ensures sidebar is accounted for */
    width: 100%;
    min-width: 0;
  }

  /* v4.0.5: Isolate ViewContent stacking context so timeline z-indices
     (CurrentTimeLine z:10, DragOverlay z:50) don't leak out and overlap
     the sibling AgendaSidebar drawer (z:50 on mobile) */
  .calendar-zoom-container > :global(:first-child) {
    z-index: 0;
    isolation: isolate;
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
    /* v3.2.7: Allow flex shrinking in parent container */
    min-width: 0;
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
    transform: none;
    pointer-events: auto;
    visibility: visible;
    max-height: none;
    overflow: visible;
  }

  /* v3.1.0: Suppress transitions in instant mode */
  .view-layer.ppp-instant-mode {
    transition: none;
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
    box-shadow: var(--shadow-l);
  }

  .spinner {
    width: 1.75rem;
    height: 1.75rem;
    border: 0.15625rem solid var(--background-modifier-border);
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
    box-shadow: var(--shadow-l);
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
    /* The error toast's own text colour (--text-on-accent), thinned. */
    background: color-mix(in srgb, currentColor 20%, transparent);
    border: none;
    border-radius: 50%;
    color: inherit;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .error-close:hover {
    background: color-mix(in srgb, currentColor 30%, transparent);
  }

  .horizontal-calendar-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    /* v3.2.7: Allow flex shrinking when agenda panel is open */
    min-width: 0;
  }

  /* Apple-style transitions. Plugin-prefixed (theme-compat): a generic global
     class name can be claimed by a theme or another plugin. */
  :global(.ppp-calendar-fade-enter) {
    opacity: 0;
  }

  :global(.ppp-calendar-fade-enter-active) {
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
    box-shadow: var(--shadow-l);
    border: var(--ppp-border-width) solid var(--background-modifier-border);
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
    transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
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

  /* Ultra-narrow (320) optimizations */
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
