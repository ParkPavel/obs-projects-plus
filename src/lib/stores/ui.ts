import { writable } from "svelte/store";

/**
 * UI state stores for cross-component communication
 */

// Helper to create persistent store
function createPersistentStore<T>(key: string, initialValue: T) {
  // Get stored value
  let storedValue = initialValue;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(`obs-projects-plus-${key}`);
      if (stored !== null) {
        storedValue = JSON.parse(stored);
      }
    } catch (e) {
      console.warn(`Failed to load ${key} from localStorage`, e);
    }
  }
  
  const store = writable<T>(storedValue);
  
  // Subscribe to changes and persist
  store.subscribe((value) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(`obs-projects-plus-${key}`, JSON.stringify(value));
      } catch (e) {
        console.warn(`Failed to save ${key} to localStorage`, e);
      }
    }
  });
  
  return store;
}

/**
 * Whether the main toolbar is collapsed (persisted)
 */
export const toolbarCollapsed = createPersistentStore<boolean>('toolbarCollapsed', false);

/**
 * Whether mobile mode is detected
 */
export const isMobileDevice = writable<boolean>(false);

// Initialize mobile detection
if (typeof window !== 'undefined') {
  const checkMobile = () => {
    const mobile = window.innerWidth <= 768 || 
      'ontouchstart' in window || 
      navigator.maxTouchPoints > 0;
    isMobileDevice.set(mobile);
  };
  
  // Check on load
  checkMobile();
  
  // Re-check on resize
  window.addEventListener('resize', checkMobile);
}
