/**
 * Performance utilities for UI optimization
 * 
 * Provides throttle and debounce functions for event handlers,
 * requestAnimationFrame-based updates, and other performance helpers.
 */

/**
 * Creates a throttled function that only invokes the provided function
 * at most once per specified interval.
 * 
 * @param fn - The function to throttle
 * @param limit - Minimum time between invocations (ms)
 * @returns Throttled function
 * 
 * @example
 * const handleScroll = throttle((e) => {
 *   console.log('Scrolled!', e);
 * }, 100);
 * 
 * window.addEventListener('scroll', handleScroll);
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let lastArgs: Parameters<T> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return function (this: unknown, ...args: Parameters<T>): void {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;
    
    if (timeSinceLastCall >= limit) {
      lastCall = now;
      fn.apply(this, args);
    } else {
      // Store latest args for trailing call
      lastArgs = args;
      
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          if (lastArgs) {
            lastCall = Date.now();
            fn.apply(this, lastArgs);
            lastArgs = null;
          }
          timeoutId = null;
        }, limit - timeSinceLastCall);
      }
    }
  };
}

/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified wait time has elapsed since the last invocation.
 * 
 * @param fn - The function to debounce
 * @param wait - Delay time (ms)
 * @param immediate - If true, trigger on leading edge instead of trailing
 * @returns Debounced function with cancel method
 * 
 * @example
 * const handleResize = debounce(() => {
 *   console.log('Resized!');
 * }, 200);
 * 
 * window.addEventListener('resize', handleResize);
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
  immediate = false
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const debounced = function (this: unknown, ...args: Parameters<T>): void {
    const callNow = immediate && !timeoutId;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (!immediate) {
        fn.apply(this, args);
      }
    }, wait);
    
    if (callNow) {
      fn.apply(this, args);
    }
  };
  
  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return debounced;
}

/**
 * Creates a function that uses requestAnimationFrame for smooth updates.
 * Ensures the callback runs at most once per animation frame.
 * 
 * @param fn - The function to wrap
 * @returns RAF-wrapped function with cancel method
 * 
 * @example
 * const updatePosition = rafThrottle((x, y) => {
 *   element.style.transform = `translate(${x}px, ${y}px)`;
 * });
 * 
 * document.addEventListener('mousemove', (e) => {
 *   updatePosition(e.clientX, e.clientY);
 * });
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  fn: T
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  
  const rafThrottled = function (this: unknown, ...args: Parameters<T>): void {
    lastArgs = args;
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          fn.apply(this, lastArgs);
          lastArgs = null;
        }
        rafId = null;
      });
    }
  };
  
  rafThrottled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      lastArgs = null;
    }
  };
  
  return rafThrottled;
}

/**
 * Creates an idle callback function that runs when the browser is idle.
 * Falls back to setTimeout if requestIdleCallback is not available.
 * 
 * @param fn - The function to run during idle time
 * @param timeout - Maximum time to wait before forcing execution (ms)
 * @returns Function with cancel method
 */
export function idleCallback<T extends (...args: any[]) => any>(
  fn: T,
  timeout = 1000
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let idleId: number | null = null;
  
  const hasIdleCallback = typeof requestIdleCallback !== 'undefined';
  
  const idleWrapped = function (this: unknown, ...args: Parameters<T>): void {
    if (idleId !== null) {
      return;
    }
    
    if (hasIdleCallback) {
      idleId = requestIdleCallback(
        () => {
          fn.apply(this, args);
          idleId = null;
        },
        { timeout }
      );
    } else {
      // Fallback for browsers without requestIdleCallback
      idleId = setTimeout(() => {
        fn.apply(this, args);
        idleId = null;
      }, 1) as unknown as number;
    }
  };
  
  idleWrapped.cancel = () => {
    if (idleId !== null) {
      if (hasIdleCallback) {
        cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId);
      }
      idleId = null;
    }
  };
  
  return idleWrapped;
}

/**
 * Measures the execution time of a function.
 * Useful for performance profiling during development.
 * 
 * @param label - Label for the performance measurement
 * @param fn - Function to measure
 * @returns The result of the function
 */
export function measureTime<T>(label: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  if (process.env['NODE_ENV'] !== 'production') {
    console.debug(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
  }
  
  return result;
}

/**
 * Async version of measureTime for async functions.
 */
export async function measureTimeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  
  if (process.env['NODE_ENV'] !== 'production') {
    console.debug(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
  }
  
  return result;
}
