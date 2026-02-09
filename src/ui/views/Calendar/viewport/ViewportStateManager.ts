/**
 * ViewportStateManager - История viewport состояний (v3.1.0)
 * 
 * Управляет:
 * 1. Историей viewport состояний (back/forward navigation)
 * 2. Восстановлением scroll позиций при возврате
 * 3. Zoom уровней и центра viewport
 * 4. Memory для плавных переходов между датами
 * 
 * Использование:
 * ```typescript
 * const manager = new ViewportStateManager();
 * 
 * // Сохранить текущее состояние
 * manager.pushState({
 *   date: dayjs('2024-03-15'),
 *   interval: 'month',
 *   scrollOffset: 500,
 * });
 * 
 * // Вернуться назад
 * const prevState = manager.goBack();
 * if (prevState) {
 *   calendar.scrollToDate(prevState.date);
 * }
 * ```
 */

import dayjs from 'dayjs';
import type { CalendarInterval } from '../calendar';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Viewport state snapshot
 */
export interface ViewportState {
  /** Current date/anchor date */
  date: dayjs.Dayjs;
  
  /** Current zoom interval */
  interval: CalendarInterval;
  
  /** Scroll offset (px) - для восстановления позиции */
  scrollOffset: number;
  
  /** Scroll position ('start' | 'center' | 'end') */
  scrollPosition?: 'start' | 'center' | 'end';
  
  /** Timestamp when state was created */
  timestamp: number;
  
  /** Optional: scroll container element for restoration */
  containerElement?: HTMLElement;
}

/**
 * Configuration
 */
export interface ViewportStateConfig {
  /** Maximum history size */
  maxHistorySize: number;
  
  /** Minimum time (ms) between state saves to avoid spam */
  minTimeBetweenSaves: number;
  
  /** Enable debug logging */
  debug: boolean;
}

const DEFAULT_CONFIG: ViewportStateConfig = {
  maxHistorySize: 50,
  minTimeBetweenSaves: 500, // 500ms debounce
  debug: false,
};

// ============================================================
// VIEWPORT STATE MANAGER
// ============================================================

export class ViewportStateManager {
  private config: ViewportStateConfig;
  
  // History stacks
  private history: ViewportState[] = [];
  private currentIndex = -1;
  
  // Last save timestamp for debouncing
  private lastSaveTime = 0;
  
  // Current state (not yet saved to history)
  private currentState: ViewportState | null = null;
  
  constructor(config: Partial<ViewportStateConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // ============================================================
  // PUBLIC API - STATE MANAGEMENT
  // ============================================================
  
  /**
   * Save current state to history
   * 
   * @param state - Viewport state to save
   * @param force - Skip debouncing, force immediate save
   */
  public pushState(state: Omit<ViewportState, 'timestamp'>, force = false): void {
    const now = Date.now();
    
    // Debounce: skip if too soon after last save
    if (!force && now - this.lastSaveTime < this.config.minTimeBetweenSaves) {
      // Update current state but don't save to history yet
      this.currentState = {
        ...state,
        timestamp: now,
      };
      return;
    }
    
    this.lastSaveTime = now;
    
    const newState: ViewportState = {
      ...state,
      timestamp: now,
    };
    
    // If we're not at the end of history, truncate forward history
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }
    
    // Add new state
    this.history.push(newState);
    this.currentIndex = this.history.length - 1;
    
    // Limit history size
    if (this.history.length > this.config.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
    
    this.currentState = newState;
    
    if (this.config.debug) {
      console.debug('[ViewportStateManager] State pushed:', newState, 'History size:', this.history.length);
    }
  }
  
  /**
   * Navigate back in history
   * 
   * @returns Previous state or null if at beginning
   */
  public goBack(): ViewportState | null {
    if (!this.canGoBack()) {
      return null;
    }
    
    this.currentIndex--;
    const state = this.history[this.currentIndex];
    
    if (this.config.debug) {
      console.debug('[ViewportStateManager] Go back to:', state);
    }
    
    return state ?? null;
  }
  
  /**
   * Navigate forward in history
   * 
   * @returns Next state or null if at end
   */
  public goForward(): ViewportState | null {
    if (!this.canGoForward()) {
      return null;
    }
    
    this.currentIndex++;
    const state = this.history[this.currentIndex];
    
    if (this.config.debug) {
      console.debug('[ViewportStateManager] Go forward to:', state);
    }
    
    return state ?? null;
  }
  
  /**
   * Check if can navigate back
   */
  public canGoBack(): boolean {
    return this.currentIndex > 0;
  }
  
  /**
   * Check if can navigate forward
   */
  public canGoForward(): boolean {
    return this.currentIndex < this.history.length - 1;
  }
  
  /**
   * Get current state
   */
  public getCurrentState(): ViewportState | null {
    return this.currentState;
  }
  
  /**
   * Get state at specific index
   */
  public getStateAt(index: number): ViewportState | null {
    return this.history[index] ?? null;
  }
  
  /**
   * Get entire history
   */
  public getHistory(): ViewportState[] {
    return [...this.history];
  }
  
  /**
   * Get current index in history
   */
  public getCurrentIndex(): number {
    return this.currentIndex;
  }
  
  /**
   * Clear all history
   */
  public clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.currentState = null;
    this.lastSaveTime = 0;
    
    if (this.config.debug) {
      console.debug('[ViewportStateManager] History cleared');
    }
  }
  
  // ============================================================
  // PUBLIC API - SCROLL RESTORATION
  // ============================================================
  
  /**
   * Restore viewport from state
   * 
   * @param state - State to restore
   * @param animate - Use smooth animation
   */
  public async restoreViewport(
    state: ViewportState,
    animate = true
  ): Promise<void> {
    if (!state.containerElement) {
      console.warn('[ViewportStateManager] Cannot restore: no container element');
      return;
    }
    
    const container = state.containerElement;
    
    if (animate) {
      // Smooth scroll to saved position
      container.scrollTo({
        top: state.scrollOffset,
        behavior: 'smooth',
      });
      
      // Wait for animation
      await this.waitForScrollAnimation(container);
    } else {
      // Instant scroll
      container.scrollTop = state.scrollOffset;
    }
    
    if (this.config.debug) {
      console.debug('[ViewportStateManager] Viewport restored:', state);
    }
  }
  
  /**
   * Capture current scroll offset from element
   */
  public captureScrollOffset(element: HTMLElement | null): number {
    return element?.scrollTop ?? 0;
  }
  
  // ============================================================
  // PUBLIC API - STATE QUERIES
  // ============================================================
  
  /**
   * Find most recent state for specific date
   */
  public findStateForDate(date: dayjs.Dayjs): ViewportState | null {
    // Search from most recent backwards
    for (let i = this.history.length - 1; i >= 0; i--) {
      const state = this.history[i];
      if (state && state.date.isSame(date, 'day')) {
        return state;
      }
    }
    return null;
  }
  
  /**
   * Find most recent state for specific interval
   */
  public findStateForInterval(interval: CalendarInterval): ViewportState | null {
    for (let i = this.history.length - 1; i >= 0; i--) {
      const state = this.history[i];
      if (state && state.interval === interval) {
        return state;
      }
    }
    return null;
  }
  
  /**
   * Check if date exists in history
   */
  public hasStateForDate(date: dayjs.Dayjs): boolean {
    return this.findStateForDate(date) !== null;
  }
  
  // ============================================================
  // PUBLIC API - UTILITIES
  // ============================================================
  
  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ViewportStateConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current configuration
   */
  public getConfig(): ViewportStateConfig {
    return { ...this.config };
  }
  
  /**
   * Export history for persistence (e.g., localStorage)
   */
  public exportHistory(): string {
    return JSON.stringify({
      history: this.history.map(state => ({
        date: state.date.toISOString(),
        interval: state.interval,
        scrollOffset: state.scrollOffset,
        scrollPosition: state.scrollPosition,
        timestamp: state.timestamp,
      })),
      currentIndex: this.currentIndex,
    });
  }
  
  /**
   * Import history from persistence
   */
  public importHistory(data: string): void {
    try {
      const parsed = JSON.parse(data);
      
      // /skip @typescript-eslint/no-explicit-any - JSON parsing returns unknown structure
      this.history = parsed.history.map((state: any) => ({
        date: dayjs(state.date),
        interval: state.interval,
        scrollOffset: state.scrollOffset,
        scrollPosition: state.scrollPosition,
        timestamp: state.timestamp,
      }));
      
      this.currentIndex = parsed.currentIndex;
      this.currentState = this.history[this.currentIndex] ?? null;
      
      if (this.config.debug) {
        console.debug('[ViewportStateManager] History imported:', this.history.length, 'states');
      }
    } catch (error) {
      console.error('[ViewportStateManager] Failed to import history:', error);
    }
  }
  
  // ============================================================
  // PRIVATE UTILITIES
  // ============================================================
  
  private waitForScrollAnimation(element: HTMLElement): Promise<void> {
    return new Promise(resolve => {
      let lastScrollTop = element.scrollTop;
      let stableCount = 0;
      
      const checkScroll = () => {
        if (Math.abs(element.scrollTop - lastScrollTop) < 1) {
          stableCount++;
          if (stableCount > 3) {
            resolve();
            return;
          }
        } else {
          stableCount = 0;
        }
        
        lastScrollTop = element.scrollTop;
        requestAnimationFrame(checkScroll);
      };
      
      requestAnimationFrame(checkScroll);
    });
  }
}
