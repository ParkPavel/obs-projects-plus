/**
 * Gesture management module for Calendar views
 * 
 * Provides:
 * - GestureManager class for imperative usage (legacy)
 * - GestureCoordinator class for state machine-based gestures (v3.1.0)
 * - gestures Svelte action for declarative usage
 * - Type definitions for gesture events and configuration
 */

export {
  GestureManager, 
  gestures,
  type GestureConfig,
  type GestureType,
  type GestureEvent,
  type GestureHandlers,
} from './GestureManager';

export {
  GestureCoordinator,
  gestureCoordinator,
  type GestureState,
  type GestureZone,
} from './GestureCoordinator';
