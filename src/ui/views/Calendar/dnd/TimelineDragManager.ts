/**
 * TimelineDragManager v4.0 — Clean mobile/desktop drag-and-drop
 *
 * Coordinates drag/resize operations on EventBars and MultiDay strips
 * in the calendar timeline. Exposes Svelte stores for reactive UI updates.
 *
 * State machine:  idle → pending → dragging → committing → idle
 *
 * Touch flow:
 *   touchstart → pending → (long-press fires, handles visible) →
 *   (finger moves past threshold, mode evaluated once) → dragging → commit → idle
 *
 * Mouse flow:
 *   mousedown → pending → (threshold crossed) → dragging → commit → idle
 *
 * Key design decisions:
 * - All per-drag state grouped in DragSession (cleanup = null session)
 * - Mode evaluated ONCE at threshold crossing (no continuous re-evaluation)
 * - Time-based auto-scroll acceleration (no frame-count hacks)
 * - Strip ghost helpers split into focused methods
 *
 * @module dnd/TimelineDragManager
 */

import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type dayjs from 'dayjs';
import dayjsFactory from 'dayjs';
import type { DataRecord } from '../../../../lib/dataframe/dataframe';
import type { ProcessedRecord } from '../types';
import {
  DND_CONSTANTS,
  type DragState,
  type DragMode,
  type GhostPosition,
  type StripGhostPosition,
  type RecordChangeOptions,
} from './types';
import {
  minutesToTime,
  minutesToRem,
  yPositionToMinutes,
} from './SnapEngine';
import { hapticDragStart, hapticSnap, hapticDrop, hapticCancel, hapticResizeLimit } from './HapticManager';
import { pauseGestures, resumeGestures } from '../gestures/GestureCoordinator';

// ─── Record title extraction ─────────────────────────────────────────────────

function cleanDisplayTitle(text: string): string {
  const trimmed = text.trim();
  const wikiDisplay = /^\[\[([^\]|]+)\|([^\]]+)\]\]$/.exec(trimmed);
  if (wikiDisplay?.[2]) return wikiDisplay[2].trim();
  const wikiSimple = /^\[\[([^\]]+)\]\]$/.exec(trimmed);
  if (wikiSimple?.[1]) {
    const p = wikiSimple[1];
    const s = p.lastIndexOf('/');
    return (s >= 0 ? p.slice(s + 1) : p).replace(/\.md$/i, '').trim() || 'Untitled';
  }
  const mdLink = /^\[([^\]]+)\]\([^)]+\)$/.exec(trimmed);
  if (mdLink?.[1]) return mdLink[1].trim();
  return trimmed;
}

function getRecordTitle(record: DataRecord): string {
  const name = record.values['name'];
  if (name && typeof name === 'string' && name.trim()) return cleanDisplayTitle(name);
  const title = record.values['title'];
  if (title && typeof title === 'string' && title.trim()) return cleanDisplayTitle(title);
  const fileValue = record.values['file'];
  if (fileValue && typeof fileValue === 'object' && 'name' in fileValue) {
    return (fileValue as { name: string }).name;
  }
  const lastSlash = record.id.lastIndexOf('/');
  const basename = lastSlash >= 0 ? record.id.slice(lastSlash + 1) : record.id;
  return basename.replace(/\.md$/, '') || 'Untitled';
}

// ─── Public types ────────────────────────────────────────────────────────────

export type OnDragCommit = (
  date: dayjs.Dayjs,
  record: DataRecord,
  options?: RecordChangeOptions
) => void;

export interface TimelineConfig {
  startHour: number;
  endHour: number;
  hourHeightRem: number;
  /** Pixels per rem (usually 16) */
  remPx?: number;
  /** Snap interval in minutes */
  snapInterval?: number;
  /** Whether the device is mobile (enables haptic feedback) */
  isMobile?: boolean;
}

export interface DayColumnRef {
  day: dayjs.Dayjs;
  element: HTMLElement;
}

// ─── Internal drag session ───────────────────────────────────────────────────

interface DragSession {
  record: DataRecord;
  processedRecord: ProcessedRecord;
  mode: DragMode;
  barElement: HTMLElement;
  listenerDoc: Document;
  isTouchDrag: boolean;

  // Pointer coordinates
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;

  // Original record geometry
  originalStartMinutes: number;
  originalEndMinutes: number;
  originalDayIndex: number;
  currentDayIndex: number;

  // Strip-specific
  originalSpanDays: number;
  stripLaneIndex: number;

  // State flags
  thresholdCrossed: boolean;
  longPressConfirmed: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | null;

  // Haptic tracking
  lastSnappedMinutes: number;
  lastSnappedDayIndex: number;
  lastHapticTime: number;

  // Vertical auto-scroll
  verticalScrollRAF: number | null;
  verticalScrollDir: 'up' | 'down' | null;
  verticalScrollStartTime: number;

  // Horizontal auto-scroll
  horizontalScrollRAF: number | null;
  horizontalScrollDir: 'left' | 'right' | null;
  horizontalScrollStartTime: number;
  lastDndCheckLoadTime: number;
}

// ─── Manager class ───────────────────────────────────────────────────────────

export class TimelineDragManager {
  // ── Svelte stores (consumed by DragOverlay, DayColumn, EventBar etc.) ──
  readonly state: Writable<DragState> = writable('idle');
  readonly ghostPosition: Writable<GhostPosition | null> = writable(null);
  readonly snapTimeLabel: Writable<string | null> = writable(null);
  readonly activeMode: Writable<DragMode | null> = writable(null);
  readonly dragRecordId: Writable<string | null> = writable(null);
  readonly targetDayIndex: Writable<number> = writable(-1);
  readonly stripGhostPosition: Writable<StripGhostPosition | null> = writable(null);
  readonly longPressActive: Writable<boolean> = writable(false);
  readonly edgeDateLabel: Writable<string | null> = writable(null);

  // ── Configuration (set via public API, survive across drags) ──
  private config: TimelineConfig | null = null;
  private onCommit: OnDragCommit | null = null;
  private dayColumns: DayColumnRef[] = [];
  private scrollContainer: HTMLElement | null = null;
  private horizontalScrollContainer: HTMLElement | null = null;

  // v4.0.2: After a successful drag, remember the record so the next touch
  // on the same bar skips the long-press delay (quick re-grab).
  private lastActivatedRecordId: string | null = null;
  private lastActivatedTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Per-drag session (created in initiate, cleared in cleanup) ──
  private session: DragSession | null = null;

  // ── Bound handlers (stable references for add/removeEventListener) ──
  private readonly handlePointerMoveBound = this.handlePointerMove.bind(this);
  private readonly handlePointerUpBound = this.handlePointerUp.bind(this);
  private readonly handleKeyDownBound = this.handleKeyDown.bind(this);
  private readonly handleOrientationChangeBound = this.handleOrientationChange.bind(this);

  /** Whether a drag is actively in progress */
  get isActive(): boolean {
    const s = get(this.state);
    return s === 'pending' || s === 'dragging';
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Configure the manager with timeline parameters and commit callback.
   * Call when TimelineView mounts or when config changes.
   */
  configure(config: TimelineConfig, onCommit: OnDragCommit): void {
    this.config = config;
    this.onCommit = onCommit;
    if (typeof window !== 'undefined') {
      window.removeEventListener('orientationchange', this.handleOrientationChangeBound);
      window.addEventListener('orientationchange', this.handleOrientationChangeBound);
    }
  }

  /** Register day columns for cross-day detection. */
  setDayColumns(columns: DayColumnRef[]): void {
    this.dayColumns = columns;
  }

  /** Set the scroll container for vertical auto-scroll. */
  setScrollContainer(container: HTMLElement | null): void {
    this.scrollContainer = container;
  }

  /** Set the horizontal scroll container for cross-week auto-scroll. */
  setHorizontalScrollContainer(container: HTMLElement | null): void {
    this.horizontalScrollContainer = container;
  }

  /**
   * Auto-detect the nearest scrollable ancestor for vertical auto-scroll.
   * Walks up from the given element looking for overflow-y: auto|scroll
   * with actual scrollable content (scrollHeight > clientHeight).
   */
  autoDetectScrollContainer(element: HTMLElement): void {
    if (this.scrollContainer) return;
    let el: HTMLElement | null = element.parentElement;
    while (el) {
      const style = window.getComputedStyle(el);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll' ||
          style.overflow === 'auto' || style.overflow === 'scroll') &&
          el.scrollHeight > el.clientHeight + 1) {
        this.scrollContainer = el;
        return;
      }
      el = el.parentElement;
    }
  }

  /**
   * Initiate a drag operation from a pointer event on an EventBar or strip.
   *
   * @param record - The data record being dragged
   * @param processedRecord - Full processed record with time/span info
   * @param event - The originating mouse/touch event
   * @param mode - Drag mode (move, resize-top, resize-bottom, strip-*)
   * @param barElement - The EventBar/strip DOM element
   */
  initiate(
    record: DataRecord,
    processedRecord: ProcessedRecord,
    event: MouseEvent | TouchEvent,
    mode: DragMode,
    barElement: HTMLElement
  ): void {
    if (!this.config || get(this.state) !== 'idle') return;

    const isTouchDrag = 'touches' in event;
    const point = this.getPointerPosition(event);

    // Compute original time data
    let originalStartMinutes = 0;
    let originalEndMinutes = 0;
    const timeInfo = processedRecord.timeInfo;
    if (timeInfo) {
      originalStartMinutes = timeInfo.startTime.hour() * 60 + timeInfo.startTime.minute();
      originalEndMinutes = timeInfo.endTime.hour() * 60 + timeInfo.endTime.minute();
    }

    // Strip span info
    let originalSpanDays = 1;
    let stripLaneIndex = 0;
    const isStripMode = mode === 'strip-move' || mode === 'strip-resize-start' || mode === 'strip-resize-end';
    if (isStripMode) {
      const spanInfo = processedRecord.spanInfo;
      if (spanInfo) {
        originalSpanDays = spanInfo.endDate.diff(spanInfo.startDate, 'day') + 1;
      }
      stripLaneIndex = processedRecord.lane ?? 0;
    }

    // Find which day column the bar belongs to
    const barRect = barElement.getBoundingClientRect();
    const originalDayIndex = this.findDayIndex(barRect.left + barRect.width / 2);

    // Auto-detect scroll container if not explicitly set
    if (!this.scrollContainer) {
      this.autoDetectScrollContainer(barElement);
    }

    // v4.0.1: Re-validate scroll container at drag start.
    // CSS spec computes overflow-y:visible as 'auto' when paired with overflow-x:auto,
    // which can fool the walk in TimelineView. At drag time the DOM is fully rendered,
    // so we can check scrollHeight vs clientHeight to find the REAL scroller.
    if (this.scrollContainer && this.scrollContainer.scrollHeight <= this.scrollContainer.clientHeight + 1) {
      let el: HTMLElement | null = this.scrollContainer.parentElement;
      while (el) {
        const style = window.getComputedStyle(el);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight + 1) {
          this.scrollContainer = el;
          break;
        }
        el = el.parentElement;
      }
    }

    const doc = barElement.ownerDocument;

    // Create session — all per-drag state in one place
    this.session = {
      record,
      processedRecord,
      mode,
      barElement,
      listenerDoc: doc,
      isTouchDrag,
      startX: point.clientX,
      startY: point.clientY,
      lastX: point.clientX,
      lastY: point.clientY,
      originalStartMinutes,
      originalEndMinutes,
      originalDayIndex,
      currentDayIndex: originalDayIndex,
      originalSpanDays,
      stripLaneIndex,
      thresholdCrossed: false,
      longPressConfirmed: !isTouchDrag, // Mouse: immediate; Touch: wait for long-press
      longPressTimer: null,
      lastSnappedMinutes: -1,
      lastSnappedDayIndex: -1,
      lastHapticTime: 0,
      verticalScrollRAF: null,
      verticalScrollDir: null,
      verticalScrollStartTime: 0,
      horizontalScrollRAF: null,
      horizontalScrollDir: null,
      horizontalScrollStartTime: 0,
      lastDndCheckLoadTime: 0,
    };

    // Move to pending state
    this.state.set('pending');
    this.activeMode.set(mode);
    this.dragRecordId.set(record.id);

    // Register global listeners (store doc ref in session for cleanup)
    doc.addEventListener('mousemove', this.handlePointerMoveBound);
    doc.addEventListener('mouseup', this.handlePointerUpBound);
    doc.addEventListener('touchmove', this.handlePointerMoveBound, { passive: false });
    doc.addEventListener('touchend', this.handlePointerUpBound);
    doc.addEventListener('touchcancel', this.handlePointerUpBound);
    doc.addEventListener('keydown', this.handleKeyDownBound);

    // Long-press timer for touch
    if (isTouchDrag) {
      // v4.0.2: If this bar was recently dragged (within expiry window),
      // skip the long-press delay — user already knows they're in DnD mode.
      if (this.lastActivatedRecordId === record.id) {
        this.session.longPressConfirmed = true;
        this.longPressActive.set(true);
        if (this.config?.isMobile) hapticDragStart();
        pauseGestures();
      } else {
        this.session.longPressTimer = setTimeout(() => {
          if (!this.session) return;
          this.session.longPressConfirmed = true;
          this.longPressActive.set(true);
          if (this.config?.isMobile) hapticDragStart();
          pauseGestures();
        }, DND_CONSTANTS.LONG_PRESS_MS);
      }
    } else {
      // Mouse: disable gestures immediately
      pauseGestures();
    }
  }

  /** Cancel the current drag operation. */
  cancel(): void {
    if (this.config?.isMobile && get(this.state) !== 'idle') {
      hapticCancel();
    }
    this.cleanup();
  }

  /** Clean up all references. Call when TimelineView unmounts. */
  destroy(): void {
    this.cleanup();
    if (typeof window !== 'undefined') {
      window.removeEventListener('orientationchange', this.handleOrientationChangeBound);
    }
    this.config = null;
    this.onCommit = null;
    this.dayColumns = [];
    this.horizontalScrollContainer = null;
    if (this.lastActivatedTimer) {
      clearTimeout(this.lastActivatedTimer);
      this.lastActivatedTimer = null;
    }
    this.lastActivatedRecordId = null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  EVENT HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  private handleOrientationChange(): void {
    if (this.isActive) this.cancel();
  }

  private handlePointerMove(event: MouseEvent | TouchEvent): void {
    const s = this.session;
    if (!s || !this.config) return;

    const point = this.getPointerPosition(event);
    const deltaX = point.clientX - s.startX;
    const deltaY = point.clientY - s.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // ── Phase 1: Before long-press confirmed (touch only) ──
    // If finger moves significantly before long-press fires, user is scrolling → cancel
    if (!s.longPressConfirmed) {
      const remPx = this.config.remPx ?? 16;
      if (distance > 1.875 * remPx) {
        this.cleanup();
      }
      return;
    }

    // Lock native scrolling once long-press is confirmed
    if (event.cancelable) event.preventDefault();

    // ── Phase 2: Check drag threshold ──
    if (!s.thresholdCrossed) {
      const thresholdPx = DND_CONSTANTS.DRAG_THRESHOLD_REM * (this.config.remPx ?? 16);
      if (distance < thresholdPx) return;

      // Threshold crossed — on mobile, re-evaluate mode from current finger position.
      // Handles are now visible (longPressActive), user may have aimed toward a handle.
      // Use generous thirds of bar height: top third = resize-top, bottom = resize-bottom, middle = move.
      // This is evaluated ONCE — mode is final after this point.
      if (s.isTouchDrag && s.barElement && this.config.isMobile) {
        s.mode = this.evaluateModeFromPosition(point.clientY, s.barElement);
        this.activeMode.set(s.mode);
      }

      s.thresholdCrossed = true;
      this.state.set('dragging');
    }

    // ── Phase 3: Active drag — update ghost and auto-scroll ──
    s.lastX = point.clientX;
    s.lastY = point.clientY;

    this.updateGhostPosition(point.clientX, point.clientY);
    this.updateVerticalAutoScroll(point.clientY);

    // No horizontal auto-scroll during vertical-only resize
    if (s.mode !== 'resize-top' && s.mode !== 'resize-bottom') {
      this.updateHorizontalAutoScroll(point.clientX);
    }
  }

  private handlePointerUp(event: MouseEvent | TouchEvent): void {
    const currentState = get(this.state);

    if (currentState === 'dragging') {
      // Save doc ref before commit (which calls cleanup and nulls session)
      const doc = this.session?.listenerDoc ?? document;
      this.commit();
      this.suppressNextClick(doc);
    } else {
      // Never crossed threshold — treat as click (cleanup, let click handler work)
      this.cleanup();
    }

    if (event.cancelable) event.preventDefault();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODE EVALUATION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Evaluate drag mode from current finger position relative to bar.
   * Uses generous thirds: top third = resize-top, bottom third = resize-bottom, middle = move.
   * Strip modes are never re-evaluated.
   */
  private evaluateModeFromPosition(clientY: number, barElement: HTMLElement): DragMode {
    const s = this.session;
    if (!s) return 'move';

    // Strip modes are set by the initiator and never changed
    if (s.mode === 'strip-move' || s.mode === 'strip-resize-start' || s.mode === 'strip-resize-end') {
      return s.mode;
    }

    // v4.0.2: Use 40% zones from each edge (overlapping in the middle).
    // This gives resize a generous target while keeping a move zone in center.
    const rect = barElement.getBoundingClientRect();
    const relY = clientY - rect.top;
    const barH = rect.height;
    const remPx = this.config?.remPx ?? 16;
    // Zone: 1.25rem or 40% of bar height
    const zone = Math.min(1.25 * remPx, barH * 0.4);

    if (relY <= zone) return 'resize-top';
    if (relY >= barH - zone) return 'resize-bottom';
    return 'move';
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  GHOST POSITION — TIMED EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  private updateGhostPosition(clientX: number, clientY: number): void {
    if (!this.config || !this.session?.processedRecord) return;

    const isStripMode = this.session.mode === 'strip-move' ||
      this.session.mode === 'strip-resize-start' ||
      this.session.mode === 'strip-resize-end';

    if (isStripMode) {
      this.updateStripGhost(clientX, clientY);
    } else {
      this.updateTimedGhost(clientX, clientY);
    }
  }

  private updateTimedGhost(clientX: number, clientY: number): void {
    const s = this.session!;
    const cfg = this.config!;
    const { startHour, endHour, hourHeightRem, remPx = 16, snapInterval = DND_CONSTANTS.SNAP_INTERVAL_DEFAULT } = cfg;
    const isMobile = cfg.isMobile ?? false;

    // Resize modes lock to original day column
    const isResize = s.mode === 'resize-top' || s.mode === 'resize-bottom';
    if (isResize) {
      s.currentDayIndex = s.originalDayIndex;
    } else {
      s.currentDayIndex = this.findDayIndex(clientX);
    }
    const clampedIndex = Math.max(0, Math.min(this.dayColumns.length - 1, s.currentDayIndex));
    this.targetDayIndex.set(clampedIndex);

    // Cross-period column detection (find columns in neighboring periods)
    const externalCol = isResize ? null : this.findColumnFromDOM(clientX);
    const isOutOfBounds = !isResize && (s.currentDayIndex < 0 || s.currentDayIndex >= this.dayColumns.length);

    // Get column element for Y-axis calculations
    const columnRef = externalCol?.element
      ? { day: externalCol.day, element: externalCol.element }
      : this.dayColumns[clampedIndex];
    if (!columnRef) return;

    // Edge date label for cross-week drag
    if (isOutOfBounds && s.processedRecord.startDate) {
      const dayDelta = s.currentDayIndex - s.originalDayIndex;
      const extrapolatedDate = s.processedRecord.startDate.add(dayDelta, 'day');
      this.edgeDateLabel.set(extrapolatedDate.format('dd, D MMM'));
    } else {
      this.edgeDateLabel.set(null);
    }

    // Calculate time from Y position relative to column
    const columnRect = columnRef.element.getBoundingClientRect();
    const relativeY = clientY - columnRect.top;
    const duration = s.originalEndMinutes - s.originalStartMinutes;

    let newStartMinutes: number;
    let newEndMinutes: number;

    switch (s.mode) {
      case 'move': {
        const pointerMinutes = yPositionToMinutes(relativeY, startHour, endHour, hourHeightRem, remPx, snapInterval);
        newStartMinutes = pointerMinutes;
        newEndMinutes = newStartMinutes + duration;
        // Clamp to visible range
        if (newEndMinutes > endHour * 60) {
          newEndMinutes = endHour * 60;
          newStartMinutes = newEndMinutes - duration;
        }
        if (newStartMinutes < startHour * 60) {
          newStartMinutes = startHour * 60;
          newEndMinutes = newStartMinutes + duration;
        }
        break;
      }

      case 'resize-top': {
        const pointerMinutes = yPositionToMinutes(relativeY, startHour, endHour, hourHeightRem, remPx, snapInterval);
        newStartMinutes = Math.min(pointerMinutes, s.originalEndMinutes - DND_CONSTANTS.MIN_DURATION_MINUTES);
        newStartMinutes = Math.max(startHour * 60, newStartMinutes);
        newEndMinutes = s.originalEndMinutes;
        if (isMobile && pointerMinutes >= s.originalEndMinutes - DND_CONSTANTS.MIN_DURATION_MINUTES) {
          hapticResizeLimit();
        }
        break;
      }

      case 'resize-bottom': {
        const pointerMinutes = yPositionToMinutes(relativeY, startHour, endHour, hourHeightRem, remPx, snapInterval);
        newEndMinutes = Math.max(pointerMinutes, s.originalStartMinutes + DND_CONSTANTS.MIN_DURATION_MINUTES);
        newEndMinutes = Math.min(endHour * 60, newEndMinutes);
        newStartMinutes = s.originalStartMinutes;
        if (isMobile && pointerMinutes <= s.originalStartMinutes + DND_CONSTANTS.MIN_DURATION_MINUTES) {
          hapticResizeLimit();
        }
        break;
      }

      default:
        return;
    }

    // Haptic snap feedback (throttled to ~10/sec)
    if (isMobile && s.lastSnappedMinutes !== newStartMinutes) {
      const now = performance.now();
      if (now - s.lastHapticTime > 100) {
        hapticSnap();
        s.lastHapticTime = now;
      }
    }
    s.lastSnappedMinutes = newStartMinutes;

    // Build ghost position
    const ghost: GhostPosition = {
      topRem: minutesToRem(newStartMinutes, startHour, hourHeightRem),
      heightRem: (newEndMinutes - newStartMinutes) * (hourHeightRem / 60),
      dayColumnIndex: clampedIndex,
      time: minutesToTime(newStartMinutes),
      endTime: minutesToTime(newEndMinutes),
      date: columnRef.day,
      title: getRecordTitle(s.record),
    };

    // Cross-period: provide viewport rect for fixed-position rendering
    if (externalCol?.element && isOutOfBounds) {
      const extRect = externalCol.element.getBoundingClientRect();
      const topPx = extRect.top + ghost.topRem * remPx;
      ghost.viewportRect = {
        top: topPx,
        left: extRect.left,
        width: extRect.width,
        height: ghost.heightRem * remPx,
      };
    }

    this.ghostPosition.set(ghost);
    this.snapTimeLabel.set(s.mode === 'resize-bottom' ? ghost.endTime : ghost.time);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  GHOST POSITION — STRIP EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  private updateStripGhost(clientX: number, clientY: number): void {
    const s = this.session!;

    // Find day under pointer (handles vertical week stacking in month/2weeks)
    let pointDay = this.findDayFromPoint(clientX, clientY);

    // If no element found (pointer over scrollbar/edge), probe slightly inward
    if (!pointDay && this.scrollContainer) {
      const sRect = this.scrollContainer.getBoundingClientRect();
      const midX = (sRect.left + sRect.right) / 2;
      const probeX = clientX > midX ? clientX - 30 : clientX + 30;
      pointDay = this.findDayFromPoint(probeX, clientY);
    }

    // Compute day index relative to mode-appropriate reference point
    let newDayIndex: number;
    if (pointDay) {
      const { referenceDate, referenceIndex } = this.getStripReference(s);
      if (referenceDate) {
        const delta = pointDay.date.diff(referenceDate, 'day');
        newDayIndex = referenceIndex + delta;
      } else {
        newDayIndex = this.findDayIndex(clientX);
      }
    } else {
      newDayIndex = this.findDayIndex(clientX);
    }
    s.currentDayIndex = newDayIndex;
    const clampedIdx = Math.max(0, Math.min(this.dayColumns.length - 1, newDayIndex));
    this.targetDayIndex.set(clampedIdx);

    // Edge date label
    const isOutOfBounds = newDayIndex < 0 || newDayIndex >= this.dayColumns.length;
    this.updateStripEdgeLabel(s, newDayIndex, isOutOfBounds);

    // Compute strip span indices
    const { startDayIndex, endDayIndex } = this.computeStripSpan(s, newDayIndex);

    // Haptic on day change (throttled)
    const isMobile = this.config?.isMobile ?? false;
    // v4.0.3: Track the moving edge — endDayIndex for strip-resize-end, startDayIndex otherwise
    const snapTrackIdx = s.mode === 'strip-resize-end' ? endDayIndex : startDayIndex;
    if (isMobile && s.lastSnappedDayIndex !== snapTrackIdx) {
      const now = performance.now();
      if (now - s.lastHapticTime > 100) {
        hapticSnap();
        s.lastHapticTime = now;
      }
    }
    s.lastSnappedDayIndex = snapTrackIdx;

    // Build ghost
    const clampedStartIdx = Math.max(0, Math.min(this.dayColumns.length - 1, startDayIndex));
    const clampedEndIdx = Math.max(0, Math.min(this.dayColumns.length - 1, endDayIndex));
    const targetDay = this.dayColumns[clampedStartIdx]?.day;
    if (!targetDay) return;

    const stripGhost: StripGhostPosition = {
      startDayIndex: clampedStartIdx,
      endDayIndex: clampedEndIdx,
      laneIndex: s.stripLaneIndex,
      targetDate: targetDay,
      title: getRecordTitle(s.record),
    };

    // Compute viewport rect for cross-week ghost rendering
    if (isOutOfBounds) {
      const vr = this.computeStripViewportRect(s, pointDay, startDayIndex, endDayIndex);
      if (vr) {
        stripGhost.viewportRect = vr;
      }
    }

    // Clamp viewport rect to visible scroll area
    if (stripGhost.viewportRect) {
      const clamped = this.clampToVisibleArea(stripGhost.viewportRect);
      if (clamped) {
        stripGhost.viewportRect = clamped;
      } else {
        delete stripGhost.viewportRect;
      }
    }

    this.stripGhostPosition.set(stripGhost);
  }

  // ── Strip ghost helpers ────────────────────────────────────────────────────

  /**
   * Get the reference date and index for strip delta computation.
   * strip-move uses the grab point; resize modes use the respective edge.
   */
  private getStripReference(s: DragSession): {
    referenceDate: dayjs.Dayjs | null;
    referenceIndex: number;
  } {
    const pr = s.processedRecord;
    if (s.mode === 'strip-resize-start') {
      return {
        referenceDate: pr.spanInfo?.startDate ?? pr.startDate,
        referenceIndex: this.getOriginalStripStartIndex(s),
      };
    }
    if (s.mode === 'strip-resize-end') {
      return {
        referenceDate: pr.spanInfo?.endDate ?? pr.startDate,
        referenceIndex: this.getOriginalStripEndIndex(s),
      };
    }
    return {
      referenceDate: pr.startDate,
      referenceIndex: s.originalDayIndex,
    };
  }

  /** Compute strip start/end indices based on mode and current pointer day. */
  private computeStripSpan(s: DragSession, newDayIndex: number): {
    startDayIndex: number;
    endDayIndex: number;
  } {
    switch (s.mode) {
      case 'strip-move': {
        const dayDelta = newDayIndex - s.originalDayIndex;
        const origStartIdx = this.getOriginalStripStartIndex(s);
        const startIdx = origStartIdx + dayDelta;
        return { startDayIndex: startIdx, endDayIndex: startIdx + s.originalSpanDays - 1 };
      }
      case 'strip-resize-start': {
        const origEndIdx = this.getOriginalStripEndIndex(s);
        return { startDayIndex: Math.min(newDayIndex, origEndIdx), endDayIndex: origEndIdx };
      }
      case 'strip-resize-end': {
        const origStartIdx = this.getOriginalStripStartIndex(s);
        return { startDayIndex: origStartIdx, endDayIndex: Math.max(newDayIndex, origStartIdx) };
      }
      default:
        return { startDayIndex: newDayIndex, endDayIndex: newDayIndex };
    }
  }

  /** Update edge date label for strip drag beyond visible week. */
  private updateStripEdgeLabel(s: DragSession, newDayIndex: number, isOutOfBounds: boolean): void {
    if (!isOutOfBounds) {
      this.edgeDateLabel.set(null);
      return;
    }
    let labelDate: dayjs.Dayjs | undefined;
    const pr = s.processedRecord;
    if (s.mode === 'strip-resize-start') {
      const refDate = pr.spanInfo?.startDate ?? pr.startDate;
      if (refDate) labelDate = refDate.add(newDayIndex - this.getOriginalStripStartIndex(s), 'day');
    } else if (s.mode === 'strip-resize-end') {
      const refDate = pr.spanInfo?.endDate ?? pr.startDate;
      if (refDate) labelDate = refDate.add(newDayIndex - this.getOriginalStripEndIndex(s), 'day');
    } else if (pr.startDate) {
      labelDate = pr.startDate.add(newDayIndex - s.originalDayIndex, 'day');
    }
    this.edgeDateLabel.set(labelDate ? labelDate.format('dd, D MMM') : null);
  }

  /** Compute viewport rect for cross-week strip ghost. */
  private computeStripViewportRect(
    s: DragSession,
    pointDay: { date: dayjs.Dayjs; element: HTMLElement } | null,
    startDayIndex: number,
    endDayIndex: number
  ): { top: number; left: number; width: number; height: number } | undefined {
    if (pointDay && this.dayColumns.length > 0) {
      return this.computeStripViewportFromPoint(s, pointDay);
    }
    return this.computeStripViewportFallback(startDayIndex, endDayIndex);
  }

  /** Compute strip viewport rect using the detected point day element. */
  private computeStripViewportFromPoint(
    s: DragSession,
    pointDay: { date: dayjs.Dayjs; element: HTMLElement }
  ): { top: number; left: number; width: number; height: number } | undefined {
    const pointEl = pointDay.element;
    const stripSection = pointEl.closest('.header-strips-section');
    const alldaySection = pointEl.closest('.projects-calendar-allday-section');

    let targetCells: HTMLElement[] = [];
    let refTop: number;
    let refHeight: number;

    if (stripSection) {
      const lane = stripSection.querySelector('.multiday-lane');
      targetCells = lane ? Array.from(lane.querySelectorAll<HTMLElement>('[data-date]')) : [];
      const rect = stripSection.getBoundingClientRect();
      refTop = rect.top;
      refHeight = rect.height;
    } else if (alldaySection) {
      const cols = alldaySection.querySelectorAll<HTMLElement>(
        '.projects-calendar-allday-column[data-date]'
      );
      targetCells = Array.from(cols);
      const rect = alldaySection.getBoundingClientRect();
      refTop = rect.top;
      refHeight = rect.height;
    } else {
      const dayCellEl = pointEl.closest('.day-cell') ?? pointEl;
      const weekRow = dayCellEl.closest('.calendar-week');
      if (!weekRow) return undefined;

      targetCells = Array.from(weekRow.querySelectorAll<HTMLElement>('.day-cell[data-date]'));
      const prevEl = weekRow.previousElementSibling as HTMLElement | null;
      const targetStripSection = prevEl?.classList?.contains('header-strips-section') ? prevEl : null;
      if (targetStripSection) {
        const rect = targetStripSection.getBoundingClientRect();
        refTop = rect.top;
        refHeight = rect.height;
      } else {
        const weekRowRect = weekRow.getBoundingClientRect();
        refTop = weekRowRect.top;
        refHeight = 24;
      }
    }

    if (targetCells.length === 0) return undefined;

    // Find pointer position within target cells
    const pointDateStr = pointDay.date.format('YYYY-MM-DD');
    let pointerIdx = targetCells.findIndex(c => c.getAttribute('data-date') === pointDateStr);
    if (pointerIdx < 0) pointerIdx = 0;

    // Compute strip span in the target row
    const stripOffset = s.originalDayIndex - this.getOriginalStripStartIndex(s);
    let tStartIdx: number;
    let tEndIdx: number;
    switch (s.mode) {
      case 'strip-move':
        tStartIdx = pointerIdx - stripOffset;
        tEndIdx = tStartIdx + s.originalSpanDays - 1;
        break;
      case 'strip-resize-start':
        tStartIdx = Math.min(pointerIdx, this.getOriginalStripEndIndex(s));
        tEndIdx = this.getOriginalStripEndIndex(s);
        break;
      case 'strip-resize-end':
        tStartIdx = this.getOriginalStripStartIndex(s);
        tEndIdx = Math.max(pointerIdx, this.getOriginalStripStartIndex(s));
        break;
      default:
        tStartIdx = pointerIdx;
        tEndIdx = pointerIdx;
    }

    // Clamp to target cells for rendering
    const cStart = Math.max(0, tStartIdx);
    const cEnd = Math.min(targetCells.length - 1, tEndIdx);
    const firstRect = targetCells[cStart]!.getBoundingClientRect();
    const lastRect = targetCells[cEnd]!.getBoundingClientRect();

    return {
      top: refTop,
      left: firstRect.left,
      width: lastRect.right - firstRect.left,
      height: refHeight,
    };
  }

  /** Fallback: extrapolate strip viewport rect from source columns. */
  private computeStripViewportFallback(
    startDayIndex: number,
    endDayIndex: number
  ): { top: number; left: number; width: number; height: number } | undefined {
    const firstCol = this.dayColumns[0]?.element;
    const lastCol = this.dayColumns[this.dayColumns.length - 1]?.element;
    if (!firstCol || !lastCol) return undefined;

    const firstRect = firstCol.getBoundingClientRect();
    const lastRect = lastCol.getBoundingClientRect();
    const avgColWidth = (lastRect.right - firstRect.left) / this.dayColumns.length;
    const ghostLeft = firstRect.left + startDayIndex * avgColWidth;
    const ghostRight = firstRect.left + (endDayIndex + 1) * avgColWidth;

    const sectionEl = firstCol.closest('.header-strips-section')
      ?? firstCol.closest('.projects-calendar-timeline-days')?.querySelector('.projects-calendar-allday-section');
    const sectionRect = sectionEl?.getBoundingClientRect();
    if (!sectionRect) return undefined;

    return {
      top: sectionRect.top,
      left: ghostLeft,
      width: ghostRight - ghostLeft,
      height: sectionRect.height,
    };
  }

  /** Clamp a viewport rect to the visible scroll area. Returns undefined if fully off-screen. */
  private clampToVisibleArea(
    vr: { top: number; left: number; width: number; height: number }
  ): { top: number; left: number; width: number; height: number } | undefined {
    const scrollRect = this.scrollContainer?.getBoundingClientRect();
    const viewTop = scrollRect ? scrollRect.top : 0;
    const viewBottom = scrollRect ? scrollRect.bottom : window.innerHeight;
    const viewLeft = scrollRect ? scrollRect.left : 0;
    const viewRight = scrollRect ? scrollRect.right : window.innerWidth;

    // Fully off-screen — hide
    if (vr.top + vr.height < viewTop || vr.top > viewBottom ||
        vr.left + vr.width < viewLeft || vr.left > viewRight) {
      return undefined;
    }

    return {
      top: Math.max(viewTop, vr.top),
      left: Math.max(viewLeft, vr.left),
      width: Math.max(4, Math.min(viewRight, vr.left + vr.width) - Math.max(viewLeft, vr.left)),
      height: Math.max(4, Math.min(viewBottom, vr.top + vr.height) - Math.max(viewTop, vr.top)),
    };
  }

  /** Get day index of the strip's original start date. */
  private getOriginalStripStartIndex(s: DragSession): number {
    const startDate = s.processedRecord.spanInfo?.startDate ?? s.processedRecord.startDate;
    if (!startDate) return s.originalDayIndex;
    for (let i = 0; i < this.dayColumns.length; i++) {
      if (this.dayColumns[i]?.day.isSame(startDate, 'day')) return i;
    }
    // v4.0.4: Extrapolate index for dates outside visible range (cross-week events).
    // The old fallback (s.originalDayIndex) was semantically wrong — it returned
    // the column the user *grabbed*, not where the event *starts*.
    if (this.dayColumns.length > 0 && this.dayColumns[0]?.day) {
      return startDate.diff(this.dayColumns[0].day, 'day');
    }
    return s.originalDayIndex;
  }

  /** Get day index of the strip's original end date. */
  private getOriginalStripEndIndex(s: DragSession): number {
    const endDate = s.processedRecord.spanInfo?.endDate ?? s.processedRecord.startDate;
    if (!endDate) return s.originalDayIndex;
    for (let i = 0; i < this.dayColumns.length; i++) {
      if (this.dayColumns[i]?.day.isSame(endDate, 'day')) return i;
    }
    // v4.0.4: Extrapolate index for dates outside visible range (cross-week events).
    if (this.dayColumns.length > 0 && this.dayColumns[0]?.day) {
      return endDate.diff(this.dayColumns[0].day, 'day');
    }
    return s.originalDayIndex;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  COMMIT
  // ══════════════════════════════════════════════════════════════════════════

  private commit(): void {
    const s = this.session;
    if (!s || !this.onCommit) {
      this.cleanup();
      return;
    }

    const isStripMode = s.mode === 'strip-move' || s.mode === 'strip-resize-start' || s.mode === 'strip-resize-end';

    if (isStripMode) {
      this.commitStrip(s);
    } else {
      this.commitTimed(s);
    }
  }

  private commitStrip(s: DragSession): void {
    const stripGhost = get(this.stripGhostPosition);
    if (!stripGhost) { this.cleanup(); return; }

    this.state.set('committing');
    if (this.config?.isMobile) hapticDrop();

    const originalStart = s.processedRecord.spanInfo?.startDate ?? s.processedRecord.startDate;
    const originalEnd = s.processedRecord.spanInfo?.endDate ?? originalStart;
    if (!originalStart || !originalEnd) { this.cleanup(); return; }

    // Delta-based date computation — not bounded by visible dayColumns
    let newStart: dayjs.Dayjs;
    let newEnd: dayjs.Dayjs;
    const dayDelta = s.currentDayIndex - s.originalDayIndex;

    switch (s.mode) {
      case 'strip-move':
        newStart = originalStart.add(dayDelta, 'day');
        newEnd = originalEnd.add(dayDelta, 'day');
        break;
      case 'strip-resize-start': {
        const startDelta = s.currentDayIndex - this.getOriginalStripStartIndex(s);
        newStart = originalStart.add(startDelta, 'day');
        newEnd = originalEnd;
        if (newStart.isAfter(newEnd, 'day')) newStart = newEnd;
        break;
      }
      case 'strip-resize-end': {
        const endDelta = s.currentDayIndex - this.getOriginalStripEndIndex(s);
        newStart = originalStart;
        newEnd = originalEnd.add(endDelta, 'day');
        if (newEnd.isBefore(newStart, 'day')) newEnd = newStart;
        break;
      }
      default:
        this.cleanup();
        return;
    }

    this.onCommit!(newStart, s.record, { endDate: newEnd });
    this.cleanup();
  }

  private commitTimed(s: DragSession): void {
    const ghost = get(this.ghostPosition);
    if (!ghost) { this.cleanup(); return; }

    this.state.set('committing');
    if (this.config?.isMobile) hapticDrop();

    // Delta-based date computation for cross-week support
    const timedDayDelta = s.currentDayIndex - s.originalDayIndex;
    const timedTargetDate = s.processedRecord.startDate
      ? s.processedRecord.startDate.add(timedDayDelta, 'day')
      : ghost.date;

    const options: RecordChangeOptions = {};
    switch (s.mode) {
      case 'move': {
        options.startTime = ghost.time;
        options.endTime = ghost.endTime;
        // Preserve multi-day span during timed moves
        const origEnd = s.processedRecord.spanInfo?.endDate ?? s.processedRecord.endDate;
        if (origEnd) options.endDate = origEnd.add(timedDayDelta, 'day');
        break;
      }
      case 'resize-top':
        options.startTime = ghost.time;
        break;
      case 'resize-bottom':
        options.endTime = ghost.endTime;
        break;
    }

    this.onCommit!(timedTargetDate, s.record, options);
    this.cleanup();
  }

  /**
   * After a drag commit, the browser fires a click event on the
   * original mousedown target. Intercept it once to prevent record navigation.
   */
  private suppressNextClick(doc: Document): void {
    const handler = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };
    doc.addEventListener('click', handler, { capture: true, once: true });
    // Safety: remove if click doesn't fire within 200ms (e.g., touch scenario)
    setTimeout(() => {
      doc.removeEventListener('click', handler, { capture: true });
    }, 200);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  AUTO-SCROLL
  // ══════════════════════════════════════════════════════════════════════════

  /** Check vertical edge proximity and activate/deactivate auto-scroll. */
  private updateVerticalAutoScroll(clientY: number): void {
    const s = this.session;
    if (!s || !this.scrollContainer) {
      this.stopVerticalAutoScroll();
      return;
    }

    const rawRect = this.scrollContainer.getBoundingClientRect();
    // v4.0.1: Clamp to viewport bounds — if the scroll container extends beyond
    // the visible area, the zone must still be within the reachable pointer area.
    // v4.0.2: Use visualViewport on mobile — window.innerHeight includes iOS safe area
    // and Obsidian toolbar, making the bottom zone unreachable by touch.
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const top = Math.max(0, rawRect.top);
    const bottom = Math.min(viewportHeight, rawRect.bottom);
    const remPx = this.config?.remPx ?? 16;
    const zone = DND_CONSTANTS.AUTO_SCROLL_ZONE_REM * remPx;

    if (clientY < top + zone && this.scrollContainer.scrollTop > 0) {
      this.startVerticalAutoScroll('up');
    } else if (clientY > bottom - zone &&
      this.scrollContainer.scrollHeight > this.scrollContainer.clientHeight + 1) {
      this.startVerticalAutoScroll('down');
    } else {
      this.stopVerticalAutoScroll();
    }
  }

  private startVerticalAutoScroll(direction: 'up' | 'down'): void {
    const s = this.session;
    if (!s || s.verticalScrollDir === direction) return;
    this.stopVerticalAutoScroll();
    s.verticalScrollDir = direction;
    s.verticalScrollStartTime = performance.now();

    const tick = (): void => {
      if (!s || !this.scrollContainer || !s.verticalScrollDir) return;

      // Time-based acceleration: ramp from 1x to 4x over 2 seconds
      const elapsed = performance.now() - s.verticalScrollStartTime;
      const accel = Math.min(4, 1 + (elapsed / 2000) * 3);
      const remPx = this.config?.remPx ?? 16;
      const speed = DND_CONSTANTS.AUTO_SCROLL_SPEED_REM * remPx * 2 * accel;

      const prevScrollTop = this.scrollContainer.scrollTop;
      this.scrollContainer.scrollTop += s.verticalScrollDir === 'up' ? -speed : speed;

      // Stop if scroll didn't actually move (reached boundary)
      if (this.scrollContainer.scrollTop === prevScrollTop) {
        this.stopVerticalAutoScroll();
        return;
      }

      // Re-evaluate ghost position as content shifts under the pointer
      this.updateGhostPosition(s.lastX, s.lastY);

      s.verticalScrollRAF = requestAnimationFrame(tick);
    };

    s.verticalScrollRAF = requestAnimationFrame(tick);
  }

  private stopVerticalAutoScroll(): void {
    const s = this.session;
    if (!s) return;
    if (s.verticalScrollRAF !== null) {
      cancelAnimationFrame(s.verticalScrollRAF);
      s.verticalScrollRAF = null;
    }
    s.verticalScrollDir = null;
  }

  /** Check horizontal edge proximity and activate/deactivate auto-scroll. */
  private updateHorizontalAutoScroll(clientX: number): void {
    const s = this.session;
    if (!s || !this.horizontalScrollContainer) {
      this.stopHorizontalAutoScroll();
      return;
    }

    const rect = this.horizontalScrollContainer.getBoundingClientRect();
    const remPx = this.config?.remPx ?? 16;
    const zone = DND_CONSTANTS.AUTO_SCROLL_ZONE_REM * remPx * 2; // wider zone for horizontal

    if (clientX < rect.left + zone) {
      this.startHorizontalAutoScroll('left');
    } else if (clientX > rect.right - zone) {
      this.startHorizontalAutoScroll('right');
    } else {
      this.stopHorizontalAutoScroll();
    }
  }

  private startHorizontalAutoScroll(direction: 'left' | 'right'): void {
    const s = this.session;
    if (!s || s.horizontalScrollDir === direction) return;
    this.stopHorizontalAutoScroll();
    s.horizontalScrollDir = direction;
    s.horizontalScrollStartTime = performance.now();
    s.lastDndCheckLoadTime = performance.now();

    // Signal to InfiniteHorizontalCalendar that DnD auto-scroll is active
    this.horizontalScrollContainer?.setAttribute('data-dnd-scrolling', 'true');

    const tick = (): void => {
      if (!s || !this.horizontalScrollContainer || !s.horizontalScrollDir) return;

      // Time-based acceleration: ramp from 1x to 4x over 2 seconds
      const elapsed = performance.now() - s.horizontalScrollStartTime;
      const accel = Math.min(4, 1 + (elapsed / 2000) * 3);
      const remPx = this.config?.remPx ?? 16;
      const speed = DND_CONSTANTS.AUTO_SCROLL_SPEED_REM * remPx * 2 * accel;
      this.horizontalScrollContainer.scrollLeft += s.horizontalScrollDir === 'left' ? -speed : speed;

      // Re-evaluate ghost position
      this.updateGhostPosition(s.lastX, s.lastY);

      // Time-based period loading (~every 250ms)
      const now = performance.now();
      if (now - s.lastDndCheckLoadTime >= 250) {
        this.horizontalScrollContainer.dispatchEvent(new CustomEvent('dnd-check-load'));
        s.lastDndCheckLoadTime = now;
      }

      s.horizontalScrollRAF = requestAnimationFrame(tick);
    };

    s.horizontalScrollRAF = requestAnimationFrame(tick);
  }

  private stopHorizontalAutoScroll(): void {
    this.horizontalScrollContainer?.removeAttribute('data-dnd-scrolling');
    const s = this.session;
    if (!s) return;
    if (s.horizontalScrollRAF !== null) {
      cancelAnimationFrame(s.horizontalScrollRAF);
      s.horizontalScrollRAF = null;
    }
    s.horizontalScrollDir = null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  DOM UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Find which day column index a clientX falls into.
   * Returns negative or beyond-length indices for off-screen positions.
   */
  private findDayIndex(clientX: number): number {
    if (this.dayColumns.length === 0) return 0;

    for (let i = 0; i < this.dayColumns.length; i++) {
      const rect = this.dayColumns[i]?.element.getBoundingClientRect();
      if (rect && clientX >= rect.left && clientX < rect.right) return i;
    }

    // Extrapolate beyond visible columns for cross-week drag
    const firstRect = this.dayColumns[0]?.element.getBoundingClientRect();
    const lastRect = this.dayColumns[this.dayColumns.length - 1]?.element.getBoundingClientRect();
    if (!firstRect || !lastRect) return 0;

    const avgColWidth = (lastRect.right - firstRect.left) / this.dayColumns.length;
    if (avgColWidth <= 0) return 0;

    if (clientX < firstRect.left) {
      return -Math.ceil((firstRect.left - clientX) / avgColWidth);
    }
    return this.dayColumns.length - 1 + Math.ceil((clientX - lastRect.right) / avgColWidth);
  }

  /**
   * Find a day column from ANY visible period by scanning the DOM.
   * Only scans when pointer is outside registered columns.
   */
  private findColumnFromDOM(clientX: number): { day: dayjs.Dayjs; element: HTMLElement } | null {
    // Skip DOM scan if pointer is within registered columns
    if (this.dayColumns.length > 0) {
      const first = this.dayColumns[0]?.element.getBoundingClientRect();
      const last = this.dayColumns[this.dayColumns.length - 1]?.element.getBoundingClientRect();
      if (first && last && clientX >= first.left && clientX < last.right) return null;
    }

    const searchRoot: ParentNode = this.horizontalScrollContainer ?? document;
    const selectors = '.projects-calendar-day-column[data-date], .day-cell[data-date]';
    const allColumns = Array.from(searchRoot.querySelectorAll<HTMLElement>(selectors));

    for (const col of allColumns) {
      const rect = col.getBoundingClientRect();
      if (clientX >= rect.left && clientX < rect.right) {
        const dateStr = col.getAttribute('data-date');
        if (!dateStr) continue;
        const parsed = dayjsFactory(dateStr);
        if (parsed.isValid()) return { day: parsed, element: col };
      }
    }
    return null;
  }

  /**
   * Find the actual day under the pointer using both X and Y coordinates.
   * Uses elementsFromPoint — critical for month/2weeks views where
   * weeks are stacked vertically and X-only detection fails.
   */
  private findDayFromPoint(clientX: number, clientY: number): { date: dayjs.Dayjs; element: HTMLElement } | null {
    // Temporarily hide portal ghosts so they don't intercept elementsFromPoint
    const doc = activeDocument ?? document;
    const portalGhosts = doc.querySelectorAll<HTMLElement>('.ppp-strip-ghost-portal');
    portalGhosts.forEach(g => { g.classList.add('ppp-hit-test-hidden'); });

    // v4.0.3: The dragging element (.dnd-dragging) has pointer-events: none,
    // which causes elementsFromPoint() to skip it. In HeaderStripsSection the
    // strip-segment IS the [data-date] element, so the hit test misses the day.
    // Temporarily restore pointer-events so the element participates in hit testing.
    const dragEl = this.session?.barElement;
    if (dragEl) {
      dragEl.classList.add('ppp-hit-test-active');
    }

    try {
      const elements = doc.elementsFromPoint(clientX, clientY);
      for (const el of elements) {
        if (!(el instanceof HTMLElement)) continue;

        const dateStr = el.getAttribute('data-date');
        if (dateStr) {
          const parsed = dayjsFactory(dateStr);
          if (parsed.isValid()) return { date: parsed, element: el };
        }

        const parent = el.closest<HTMLElement>('[data-date]');
        if (parent) {
          const pDateStr = parent.getAttribute('data-date');
          if (pDateStr) {
            const parsed = dayjsFactory(pDateStr);
            if (parsed.isValid()) return { date: parsed, element: parent };
          }
        }
      }
    } finally {
      if (dragEl) {
        dragEl.classList.remove('ppp-hit-test-active');
      }
      portalGhosts.forEach(g => { g.classList.remove('ppp-hit-test-hidden'); });
    }

    return null;
  }

  /** Extract clientX/clientY from mouse or touch event. */
  private getPointerPosition(event: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
    if ('touches' in event) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      return touch
        ? { clientX: touch.clientX, clientY: touch.clientY }
        : { clientX: 0, clientY: 0 };
    }
    return { clientX: event.clientX, clientY: event.clientY };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CLEANUP
  // ══════════════════════════════════════════════════════════════════════════

  private cleanup(): void {
    const s = this.session;

    if (s) {
      // Clear long-press timer
      if (s.longPressTimer !== null) clearTimeout(s.longPressTimer);

      // Remove global listeners
      s.listenerDoc.removeEventListener('mousemove', this.handlePointerMoveBound);
      s.listenerDoc.removeEventListener('mouseup', this.handlePointerUpBound);
      s.listenerDoc.removeEventListener('touchmove', this.handlePointerMoveBound);
      s.listenerDoc.removeEventListener('touchend', this.handlePointerUpBound);
      s.listenerDoc.removeEventListener('touchcancel', this.handlePointerUpBound);
      s.listenerDoc.removeEventListener('keydown', this.handleKeyDownBound);

      // Stop auto-scroll (must happen before session = null)
      this.stopVerticalAutoScroll();
      this.stopHorizontalAutoScroll();
    }

    // Re-enable gesture coordinator
    resumeGestures();

    // v4.0.2: If this was a successful drag (threshold crossed), remember the
    // record so the next touch on the same bar skips long-press.
    const wasActiveDrag = s?.thresholdCrossed && s?.record;
    const activatedRecordId = wasActiveDrag ? s.record.id : null;

    // Clear session
    this.session = null;

    // Reset all stores
    this.state.set('idle');
    this.ghostPosition.set(null);
    this.stripGhostPosition.set(null);
    this.snapTimeLabel.set(null);
    this.edgeDateLabel.set(null);
    this.activeMode.set(null);
    this.dragRecordId.set(null);
    this.targetDayIndex.set(-1);

    // v4.0.2: Keep handles visible for quick re-grab on the same bar.
    // Expire after 4 seconds so the UI returns to normal if user moves on.
    if (activatedRecordId) {
      this.lastActivatedRecordId = activatedRecordId;
      this.dragRecordId.set(activatedRecordId);
      // longPressActive stays true — handles remain visible
      if (this.lastActivatedTimer) clearTimeout(this.lastActivatedTimer);
      this.lastActivatedTimer = setTimeout(() => {
        this.lastActivatedRecordId = null;
        this.lastActivatedTimer = null;
        this.longPressActive.set(false);
        this.dragRecordId.set(null);
      }, 4000);
    } else {
      this.longPressActive.set(false);
      this.lastActivatedRecordId = null;
      if (this.lastActivatedTimer) {
        clearTimeout(this.lastActivatedTimer);
        this.lastActivatedTimer = null;
      }
    }
  }
}
