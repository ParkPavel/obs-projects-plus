import { get } from 'svelte/store';
import { settings } from 'src/lib/stores/settings';

/**
 * ios-m1: whether the system asks for reduced motion. Guarded because jsdom
 * (and any host without `matchMedia`) has no such function; there the plugin
 * setting alone decides, as it always did.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Returns the appropriate ScrollBehavior based on user's animation preference.
 * Maps 'instant' → 'auto', 'smooth' → 'smooth'. Reduced motion → 'auto'.
 */
export function getScrollBehavior(): ScrollBehavior {
  if (prefersReducedMotion()) return 'auto';
  return get(settings).preferences.animationBehavior === 'instant'
    ? 'auto'
    : 'smooth';
}

/**
 * Returns the appropriate animation duration in ms.
 * Returns 0 for 'instant' mode or under reduced motion (immediate jump).
 * @param defaultDuration - Duration to use in 'smooth' mode (default: 300ms).
 */
export function getAnimationDuration(defaultDuration: number = 300): number {
  if (prefersReducedMotion()) return 0;
  return get(settings).preferences.animationBehavior === 'instant'
    ? 0
    : defaultDuration;
}
