/**
 * GestureManager - Gesture priority queue for mobile touch handling
 * 
 * Solves the conflict between:
 * - Obsidian sidebar swipe (from edge)
 * - Calendar navigation swipes
 * - Timeline scroll
 * - Event drag & drop
 * 
 * Uses threshold detection and priority queue to determine
 * which gesture handler should handle each touch sequence.
 */

export interface GestureConfig {
  // Threshold for tap vs swipe distinction
  tapMaxDistance: number;     // px
  tapMaxDuration: number;     // ms
  
  // Threshold for calendar swipe vs obsidian swipe
  calendarSwipeMinDistance: number;   // px horizontal
  calendarSwipeMaxVertical: number;   // px vertical deviation
  edgeSwipeZone: number;              // px from screen edge for obsidian
  
  // Long press
  longPressMinDuration: number;       // ms
  
  // Pinch-to-zoom
  pinchMinScale: number;              // scale change to trigger zoom
}

export type GestureType = 
  | 'tap'
  | 'long-press'
  | 'horizontal-swipe'
  | 'vertical-scroll'
  | 'pinch-zoom'
  | 'edge-swipe'
  | 'drag';

export interface GestureEvent {
  type: GestureType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  deltaX: number;
  deltaY: number;
  duration: number;
  velocity: number;
  scale: number | undefined;
  target: EventTarget | null;
}

export interface GestureHandlers {
  onTap?: (event: GestureEvent) => void;
  onLongPress?: (event: GestureEvent) => void;
  onHorizontalSwipe?: (event: GestureEvent, direction: 'left' | 'right') => void;
  onVerticalScroll?: (event: GestureEvent, direction: 'up' | 'down') => void;
  onPinchZoom?: (event: GestureEvent, direction: 'in' | 'out') => void;
  onDragStart?: (event: GestureEvent) => void;
  onDragMove?: (event: GestureEvent) => void;
  onDragEnd?: (event: GestureEvent) => void;
}

const DEFAULT_CONFIG: GestureConfig = {
  tapMaxDistance: 10,
  tapMaxDuration: 200,
  calendarSwipeMinDistance: 50,
  calendarSwipeMaxVertical: 30,
  edgeSwipeZone: 20,
  longPressMinDuration: 500,
  pinchMinScale: 0.3,
};

export class GestureManager {
  private config: GestureConfig;
  private handlers: GestureHandlers;
  private element: HTMLElement;
  
  // Touch tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private initialDistance = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private isDragging = false;
  private isMultiTouch = false;
  
  // Debounce state for touch events (v7.0)
  private touchMoveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTouchMoveTime = 0;
  private readonly TOUCH_DEBOUNCE_MS = 16; // ~60fps
  
  // Bound handlers for cleanup
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private boundTouchCancel: () => void;
  
  constructor(
    element: HTMLElement, 
    handlers: GestureHandlers, 
    config: Partial<GestureConfig> = {}
  ) {
    this.element = element;
    this.handlers = handlers;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundTouchMove = this.handleTouchMove.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);
    this.boundTouchCancel = this.cancelGesture.bind(this);
    
    this.attach();
  }
  
  private attach(): void {
    // v7.0: Use passive listeners where possible for better scroll performance
    // Only touchstart needs to be non-passive for preventDefault on edge swipes
    this.element.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    this.element.addEventListener('touchmove', this.boundTouchMove, { passive: true });
    this.element.addEventListener('touchend', this.boundTouchEnd, { passive: true });
    this.element.addEventListener('touchcancel', this.boundTouchCancel, { passive: true });
  }
  
  public destroy(): void {
    this.cancelGesture();
    this.element.removeEventListener('touchstart', this.boundTouchStart);
    this.element.removeEventListener('touchmove', this.boundTouchMove);
    this.element.removeEventListener('touchend', this.boundTouchEnd);
    this.element.removeEventListener('touchcancel', this.boundTouchCancel);
  }
  
  private cancelGesture(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.touchMoveDebounceTimer) {
      clearTimeout(this.touchMoveDebounceTimer);
      this.touchMoveDebounceTimer = null;
    }
    this.isDragging = false;
    this.isMultiTouch = false;
  }
  
  private getDistance(touches: TouchList): number {
    if (touches.length < 2) return 0;
    const t1 = touches[0]!;
    const t2 = touches[1]!;
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }
  
  private isFromEdge(x: number): boolean {
    return x < this.config.edgeSwipeZone || 
           x > window.innerWidth - this.config.edgeSwipeZone;
  }
  
  private handleTouchStart(e: TouchEvent): void {
    this.cancelGesture();
    
    const touch = e.touches[0];
    if (!touch) return;
    
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
    
    // Multi-touch detection
    if (e.touches.length > 1) {
      this.isMultiTouch = true;
      this.initialDistance = this.getDistance(e.touches);
      return;
    }
    
    // Edge swipe - let Obsidian handle it
    if (this.isFromEdge(touch.clientX)) {
      return; // Don't prevent default, let obsidian handle
    }
    
    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      if (!this.isDragging) {
        const event = this.createGestureEvent(touch.clientX, touch.clientY, e.target);
        this.handlers.onLongPress?.(event);
      }
    }, this.config.longPressMinDuration);
  }
  
  private handleTouchMove(e: TouchEvent): void {
    // v7.0: Debounce touch move events for performance (~60fps)
    const now = Date.now();
    if (now - this.lastTouchMoveTime < this.TOUCH_DEBOUNCE_MS) {
      return; // Skip this event to maintain 60fps
    }
    this.lastTouchMoveTime = now;
    
    const touch = e.touches[0];
    if (!touch) return;
    
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const distance = Math.hypot(deltaX, deltaY);
    
    // Cancel long press if moved too much
    if (distance > this.config.tapMaxDistance && this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    
    // Multi-touch: pinch detection
    if (this.isMultiTouch && e.touches.length > 1) {
      const currentDistance = this.getDistance(e.touches);
      const scale = currentDistance / this.initialDistance;
      
      if (Math.abs(scale - 1) > this.config.pinchMinScale) {
        e.preventDefault();
        const event = this.createGestureEvent(touch.clientX, touch.clientY, e.target, scale);
        this.handlers.onPinchZoom?.(event, scale > 1 ? 'out' : 'in');
      }
      return;
    }
    
    // Determine gesture type based on direction
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
    
    if (isHorizontal && Math.abs(deltaX) > this.config.calendarSwipeMinDistance) {
      // Horizontal swipe - prevent default to stop Obsidian interference
      if (Math.abs(deltaY) < this.config.calendarSwipeMaxVertical) {
        e.preventDefault();
        if (!this.isDragging) {
          this.isDragging = true;
          const event = this.createGestureEvent(touch.clientX, touch.clientY, e.target);
          this.handlers.onDragStart?.(event);
        }
        const event = this.createGestureEvent(touch.clientX, touch.clientY, e.target);
        this.handlers.onDragMove?.(event);
      }
    }
  }
  
  private handleTouchEnd(e: TouchEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    
    const touch = e.changedTouches[0];
    if (!touch) {
      this.cancelGesture();
      return;
    }
    
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const duration = Date.now() - this.touchStartTime;
    const distance = Math.hypot(deltaX, deltaY);
    
    const event = this.createGestureEvent(touch.clientX, touch.clientY, e.target);
    
    // TAP detection
    if (distance < this.config.tapMaxDistance && duration < this.config.tapMaxDuration) {
      this.handlers.onTap?.(event);
      this.cancelGesture();
      return;
    }
    
    // HORIZONTAL SWIPE detection
    if (Math.abs(deltaX) > this.config.calendarSwipeMinDistance &&
        Math.abs(deltaY) < this.config.calendarSwipeMaxVertical) {
      e.preventDefault();
      e.stopPropagation();
      const direction = deltaX > 0 ? 'right' : 'left';
      this.handlers.onHorizontalSwipe?.(event, direction);
      this.cancelGesture();
      return;
    }
    
    // VERTICAL SCROLL detection
    if (Math.abs(deltaY) > this.config.calendarSwipeMinDistance) {
      const direction = deltaY > 0 ? 'down' : 'up';
      this.handlers.onVerticalScroll?.(event, direction);
      this.cancelGesture();
      return;
    }
    
    // Drag end
    if (this.isDragging) {
      this.handlers.onDragEnd?.(event);
    }
    
    this.cancelGesture();
  }
  
  private createGestureEvent(
    endX: number, 
    endY: number, 
    target: EventTarget | null,
    scale?: number
  ): GestureEvent {
    const deltaX = endX - this.touchStartX;
    const deltaY = endY - this.touchStartY;
    const duration = Date.now() - this.touchStartTime;
    const distance = Math.hypot(deltaX, deltaY);
    const velocity = duration > 0 ? distance / duration : 0;
    
    return {
      type: this.determineGestureType(deltaX, deltaY, duration, scale),
      startX: this.touchStartX,
      startY: this.touchStartY,
      endX,
      endY,
      deltaX,
      deltaY,
      duration,
      velocity,
      scale,
      target,
    };
  }
  
  private determineGestureType(
    deltaX: number, 
    deltaY: number, 
    duration: number,
    scale?: number
  ): GestureType {
    const distance = Math.hypot(deltaX, deltaY);
    
    if (scale !== undefined && Math.abs(scale - 1) > this.config.pinchMinScale) {
      return 'pinch-zoom';
    }
    
    if (distance < this.config.tapMaxDistance && duration < this.config.tapMaxDuration) {
      return 'tap';
    }
    
    if (duration >= this.config.longPressMinDuration && distance < this.config.tapMaxDistance) {
      return 'long-press';
    }
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (this.isFromEdge(this.touchStartX)) {
        return 'edge-swipe';
      }
      return 'horizontal-swipe';
    }
    
    return 'vertical-scroll';
  }
  
  /**
   * Update configuration dynamically
   */
  public updateConfig(config: Partial<GestureConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Svelte action for gesture handling
 * Usage: <div use:gestures={{onHorizontalSwipe: handleSwipe}}>
 */
export function gestures(
  node: HTMLElement, 
  params: { handlers: GestureHandlers; config?: Partial<GestureConfig> }
) {
  let manager = new GestureManager(node, params.handlers, params.config);
  
  return {
    update(newParams: { handlers: GestureHandlers; config?: Partial<GestureConfig> }) {
      manager.destroy();
      manager = new GestureManager(node, newParams.handlers, newParams.config);
    },
    destroy() {
      manager.destroy();
    }
  };
}

export default GestureManager;
