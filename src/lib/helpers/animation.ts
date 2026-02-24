import { get } from 'svelte/store';
import { settings } from 'src/lib/stores/settings';

/**
 * Returns the appropriate ScrollBehavior based on user's animation preference.
 * Maps 'instant' → 'auto', 'smooth' → 'smooth'.
 */
export function getScrollBehavior(): ScrollBehavior {
  return get(settings).preferences.animationBehavior === 'instant' 
    ? 'auto' 
    : 'smooth';
}

/**
 * Returns the appropriate animation duration in ms.
 * Returns 0 for 'instant' mode (immediate jump).
 * @param defaultDuration - Duration to use in 'smooth' mode (default: 300ms).
 */
export function getAnimationDuration(defaultDuration: number = 300): number {
  return get(settings).preferences.animationBehavior === 'instant' 
    ? 0 
    : defaultDuration;
}
