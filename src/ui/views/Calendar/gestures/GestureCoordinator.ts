/**
 * GestureCoordinator - State machine-based gesture coordinator (v3.1.0)
 * 
 * Улучшения над GestureManager:
 * 1. State machine для predictable transitions
 * 2. Conflict resolution с Obsidian (edge zones)
 * 3. Gesture zones для изоляции pinch/swipe/scroll
 * 4. Debouncing для zoom операций
 * 5. Proper cleanup и memory leak prevention
 * 
 * State flow: Idle → Detecting → Active → Completing → Idle
 */

import { GESTURE_ZONES, GESTURE_THRESHOLDS } from '../constants';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Состояния state machine
 */
export type GestureState = 
  | 'idle'       // Ничего не происходит
  | 'detecting'  // Touch начался, определяем тип жеста
  | 'active'     // Жест определён и выполняется
  | 'completing' // Touch закончился, завершаем жест
  | 'cancelled'; // Жест отменён (конфликт или ошибка)

/**
 * Типы жестов
 */
export type GestureType = 
  | 'tap'
  | 'long-press'
  | 'horizontal-swipe'
  | 'vertical-scroll'
  | 'pinch-zoom'
  | 'edge-swipe'  // Для Obsidian sidebar
  | 'drag'
  | 'unknown';

/**
 * Зоны экрана для conflict resolution
 */
export type GestureZone = 
  | 'edge-left'   // Obsidian left sidebar
  | 'edge-right'  // Obsidian right sidebar
  | 'edge-top'    // Obsidian top menu (mobile)
  | 'center';     // Основная область календаря

/**
 * Touch state tracking
 */
interface TouchState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
  touchCount: number;
  initialDistance: number; // Для pinch
  zone: GestureZone;
}

/**
 * Gesture event data
 */
export interface GestureEvent {
  type: GestureType;
  state: GestureState;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  deltaX: number;
  deltaY: number;
  duration: number;
  velocity: number;
  scale: number | undefined;
  zone: GestureZone;
  target: EventTarget | null;
}

/**
 * Gesture handlers
 */
export interface GestureHandlers {
  onTap?: (event: GestureEvent) => void;
  onLongPress?: (event: GestureEvent) => void;
  onHorizontalSwipe?: (event: GestureEvent, direction: 'left' | 'right') => void;
  onVerticalScroll?: (event: GestureEvent, direction: 'up' | 'down') => void;
  onPinchZoom?: (event: GestureEvent, direction: 'in' | 'out') => void;
  onDragStart?: (event: GestureEvent) => void;
  onDragMove?: (event: GestureEvent) => void;
  onDragEnd?: (event: GestureEvent) => void;
  onStateChange?: (oldState: GestureState, newState: GestureState) => void;
}

/**
 * Configuration
 */
export interface GestureConfig {
  enabled: boolean;
  tapMaxDistance: number;
  tapMaxDuration: number;
  longPressMinDuration: number;
  swipeMinDistance: number;
  swipeMaxVertical: number;
  pinchMinScale: number;
  debounceMs: number;
}

const DEFAULT_CONFIG: GestureConfig = {
  enabled: true,
  tapMaxDistance: GESTURE_THRESHOLDS.TAP.MAX_MOVE_PX,
  tapMaxDuration: GESTURE_THRESHOLDS.TAP.MAX_DURATION_MS,
  longPressMinDuration: 500,
  swipeMinDistance: GESTURE_THRESHOLDS.SWIPE.MIN_DISTANCE_PX,
  swipeMaxVertical: 50,
  pinchMinScale: GESTURE_THRESHOLDS.PINCH.MIN_SCALE_DELTA,
  debounceMs: GESTURE_THRESHOLDS.PINCH.DEBOUNCE_MS,
};

// ============================================================
// GESTURE COORDINATOR
// ============================================================

export class GestureCoordinator {
  private config: GestureConfig;
  private handlers: GestureHandlers;
  private element: HTMLElement;
  
  // State machine
  private state: GestureState = 'idle';
  private currentGestureType: GestureType = 'unknown';
  
  // Touch tracking
  private touchState: TouchState | null = null;
  
  // Timers
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Bound handlers for cleanup
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private boundTouchCancel: (e: TouchEvent) => void;
  
  // Last zoom time for debouncing
  private lastZoomTime = 0;
  
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
    this.boundTouchCancel = this.handleTouchCancel.bind(this);
    
    if (this.config.enabled) {
      this.attach();
    }
  }
  
  // ============================================================
  // PUBLIC API
  // ============================================================
  
  /**
   * Enable gesture handling
   */
  public enable(): void {
    if (!this.config.enabled) {
      this.config.enabled = true;
      this.attach();
    }
  }
  
  /**
   * Disable gesture handling
   */
  public disable(): void {
    if (this.config.enabled) {
      this.config.enabled = false;
      this.detach();
      this.reset();
    }
  }
  
  /**
   * Update configuration
   */
  public updateConfig(config: Partial<GestureConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Cleanup
   */
  public destroy(): void {
    this.detach();
    this.reset();
  }
  
  /**
   * Get current state (для debugging)
   */
  public getState(): GestureState {
    return this.state;
  }
  
  // ============================================================
  // PRIVATE: EVENT HANDLERS
  // ============================================================
  
  private attach(): void {
    // Passive listeners для scroll performance
    this.element.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    this.element.addEventListener('touchmove', this.boundTouchMove, { passive: false }); // Non-passive для preventDefault
    this.element.addEventListener('touchend', this.boundTouchEnd, { passive: true });
    this.element.addEventListener('touchcancel', this.boundTouchCancel, { passive: true });
  }
  
  private detach(): void {
    this.element.removeEventListener('touchstart', this.boundTouchStart);
    this.element.removeEventListener('touchmove', this.boundTouchMove);
    this.element.removeEventListener('touchend', this.boundTouchEnd);
    this.element.removeEventListener('touchcancel', this.boundTouchCancel);
  }
  
  private handleTouchStart(e: TouchEvent): void {
    if (!this.config.enabled) return;
    
    const touch = e.touches[0];
    if (!touch) return;
    
    // Transition: Idle → Detecting
    this.transitionState('detecting');
    
    // Initialize touch state
    const zone = this.determineZone(touch.clientX, touch.clientY);
    this.touchState = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      startTime: Date.now(),
      touchCount: e.touches.length,
      initialDistance: e.touches.length > 1 ? this.getDistance(e.touches) : 0,
      zone,
    };
    
    // Edge zone → delegate to Obsidian, cancel gesture
    if (zone !== 'center') {
      this.transitionState('cancelled');
      this.reset();
      return;
    }
    
    // Start long press timer для center zone
    this.longPressTimer = setTimeout(() => {
      if (this.state === 'detecting' && this.touchState) {
        const distance = this.getDistanceFromStart();
        if (distance < this.config.tapMaxDistance) {
          this.currentGestureType = 'long-press';
          this.transitionState('active');
          const event = this.createGestureEvent(e.target);
          this.handlers.onLongPress?.(event);
        }
      }
    }, this.config.longPressMinDuration);
  }
  
  private handleTouchMove(e: TouchEvent): void {
    if (!this.config.enabled || !this.touchState) return;
    
    const touch = e.touches[0];
    if (!touch) return;
    
    this.touchState.currentX = touch.clientX;
    this.touchState.currentY = touch.clientY;
    this.touchState.touchCount = e.touches.length;
    
    // Cancel long press if moved too far
    if (this.longPressTimer && this.getDistanceFromStart() > this.config.tapMaxDistance) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    
    // Pinch detection (multi-touch)
    if (e.touches.length > 1) {
      this.handlePinchGesture(e);
      return;
    }
    
    // Single touch: determine gesture type if still detecting
    if (this.state === 'detecting') {
      const gestureType = this.detectGestureType();
      
      if (gestureType !== 'unknown') {
        this.currentGestureType = gestureType;
        this.transitionState('active');
        
        // Fire start event для drag
        if (gestureType === 'drag') {
          const event = this.createGestureEvent(e.target);
          this.handlers.onDragStart?.(event);
        }
      }
    }
    
    // Active gesture: fire move events
    if (this.state === 'active') {
      if (this.currentGestureType === 'drag') {
        const event = this.createGestureEvent(e.target);
        this.handlers.onDragMove?.(event);
      }
      
      // Prevent default для horizontal swipes в center zone
      if (this.currentGestureType === 'horizontal-swipe' && this.touchState.zone === 'center') {
        e.preventDefault();
      }
    }
  }
  
  private handleTouchEnd(e: TouchEvent): void {
    if (!this.config.enabled || !this.touchState) return;
    
    const touch = e.changedTouches[0];
    if (!touch) {
      this.reset();
      return;
    }
    
    this.touchState.currentX = touch.clientX;
    this.touchState.currentY = touch.clientY;
    
    // Transition: Active/Detecting → Completing
    if (this.state === 'active' || this.state === 'detecting') {
      this.transitionState('completing');
      
      // Finalize gesture
      const event = this.createGestureEvent(e.target);
      this.finalizeGesture(event);
    }
    
    // Transition: Completing → Idle
    this.transitionState('idle');
    this.reset();
  }
  
  private handleTouchCancel(e: TouchEvent): void {
    this.transitionState('cancelled');
    this.reset();
  }
  
  // ============================================================
  // PRIVATE: STATE MACHINE
  // ============================================================
  
  private transitionState(newState: GestureState): void {
    const oldState = this.state;
    
    // Validate transition
    if (!this.isValidTransition(oldState, newState)) {
      console.warn(`[GestureCoordinator] Invalid transition: ${oldState} → ${newState}`);
      return;
    }
    
    this.state = newState;
    this.handlers.onStateChange?.(oldState, newState);
  }
  
  private isValidTransition(from: GestureState, to: GestureState): boolean {
    const validTransitions: Record<GestureState, GestureState[]> = {
      'idle': ['detecting'],
      'detecting': ['active', 'completing', 'cancelled', 'idle'],
      'active': ['completing', 'cancelled'],
      'completing': ['idle'],
      'cancelled': ['idle'],
    };
    
    return validTransitions[from]?.includes(to) ?? false;
  }
  
  // ============================================================
  // PRIVATE: GESTURE DETECTION
  // ============================================================
  
  private detectGestureType(): GestureType {
    if (!this.touchState) return 'unknown';
    
    const deltaX = Math.abs(this.touchState.currentX - this.touchState.startX);
    const deltaY = Math.abs(this.touchState.currentY - this.touchState.startY);
    const distance = this.getDistanceFromStart();
    
    // No significant movement yet
    if (distance < GESTURE_ZONES.SCROLL_ZONE.MIN_MOVE_PX) {
      return 'unknown';
    }
    
    // Horizontal swipe
    if (deltaX > deltaY && deltaX > this.config.swipeMinDistance) {
      if (deltaY < this.config.swipeMaxVertical) {
        return 'horizontal-swipe';
      }
    }
    
    // Vertical scroll
    if (deltaY > deltaX && deltaY > this.config.swipeMinDistance) {
      return 'vertical-scroll';
    }
    
    // Drag (significant movement but no clear direction)
    if (distance > this.config.swipeMinDistance) {
      return 'drag';
    }
    
    return 'unknown';
  }
  
  private handlePinchGesture(e: TouchEvent): void {
    if (!this.touchState || e.touches.length < 2) return;
    
    // Debounce zoom operations
    const now = Date.now();
    if (now - this.lastZoomTime < this.config.debounceMs) {
      return;
    }
    
    const currentDistance = this.getDistance(e.touches);
    const scale = currentDistance / this.touchState.initialDistance;
    
    if (Math.abs(scale - 1) > this.config.pinchMinScale) {
      this.lastZoomTime = now;
      
      if (this.state === 'detecting') {
        this.currentGestureType = 'pinch-zoom';
        this.transitionState('active');
      }
      
      if (this.state === 'active') {
        e.preventDefault();
        const event = this.createGestureEvent(e.target, scale);
        // scale > 1 = fingers spreading = zoom IN (more detail)
        // scale < 1 = fingers pinching = zoom OUT (less detail)
        this.handlers.onPinchZoom?.(event, scale > 1 ? 'in' : 'out');
      }
    }
  }
  
  private finalizeGesture(event: GestureEvent): void {
    // Detect gesture type if still unknown
    if (this.currentGestureType === 'unknown' && this.touchState) {
      const distance = this.getDistanceFromStart();
      const duration = Date.now() - this.touchState.startTime;
      
      // Tap
      if (distance < this.config.tapMaxDistance && duration < this.config.tapMaxDuration) {
        this.currentGestureType = 'tap';
        this.handlers.onTap?.(event);
        return;
      }
      
      // Try detect swipe
      this.currentGestureType = this.detectGestureType();
    }
    
    // Fire appropriate handler
    switch (this.currentGestureType) {
      case 'horizontal-swipe': {
        const direction = event.deltaX > 0 ? 'right' : 'left';
        this.handlers.onHorizontalSwipe?.(event, direction);
        break;
      }
      case 'vertical-scroll': {
        const direction = event.deltaY > 0 ? 'down' : 'up';
        this.handlers.onVerticalScroll?.(event, direction);
        break;
      }
      case 'drag':
        this.handlers.onDragEnd?.(event);
        break;
    }
  }
  
  // ============================================================
  // PRIVATE: UTILITIES
  // ============================================================
  
  private determineZone(x: number, y: number): GestureZone {
    // Top edge for Obsidian menu (highest priority)
    if (y < GESTURE_ZONES.EDGE_ZONE.TOP_PX) {
      return 'edge-top';
    }
    
    // Left/right edges
    if (x < GESTURE_ZONES.EDGE_ZONE.LEFT_PX) {
      return 'edge-left';
    }
    if (x > window.innerWidth - GESTURE_ZONES.EDGE_ZONE.RIGHT_PX) {
      return 'edge-right';
    }
    
    return 'center';
  }
  
  private getDistance(touches: TouchList): number {
    if (touches.length < 2) return 0;
    const t1 = touches[0]!;
    const t2 = touches[1]!;
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }
  
  private getDistanceFromStart(): number {
    if (!this.touchState) return 0;
    return Math.hypot(
      this.touchState.currentX - this.touchState.startX,
      this.touchState.currentY - this.touchState.startY
    );
  }
  
  private createGestureEvent(target: EventTarget | null, scale?: number): GestureEvent {
    if (!this.touchState) {
      throw new Error('[GestureCoordinator] Cannot create event without touch state');
    }
    
    const deltaX = this.touchState.currentX - this.touchState.startX;
    const deltaY = this.touchState.currentY - this.touchState.startY;
    const duration = Date.now() - this.touchState.startTime;
    const distance = this.getDistanceFromStart();
    const velocity = duration > 0 ? distance / duration : 0;
    
    return {
      type: this.currentGestureType,
      state: this.state,
      startX: this.touchState.startX,
      startY: this.touchState.startY,
      endX: this.touchState.currentX,
      endY: this.touchState.currentY,
      deltaX,
      deltaY,
      duration,
      velocity,
      scale,
      zone: this.touchState.zone,
      target,
    };
  }
  
  private reset(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.touchState = null;
    this.currentGestureType = 'unknown';
  }
}

/**
 * Svelte action для GestureCoordinator
 * Usage: <div use:gestureCoordinator={{onTap: handleTap}}>
 */
export function gestureCoordinator(
  node: HTMLElement,
  params: { handlers: GestureHandlers; config?: Partial<GestureConfig> }
) {
  let coordinator = new GestureCoordinator(node, params.handlers, params.config);
  
  return {
    update(newParams: { handlers: GestureHandlers; config?: Partial<GestureConfig> }) {
      coordinator.destroy();
      coordinator = new GestureCoordinator(node, newParams.handlers, newParams.config);
    },
    destroy() {
      coordinator.destroy();
    },
  };
}
