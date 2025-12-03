import { writable } from "svelte/store";

/**
 * UI state stores for cross-component communication
 */

/**
 * Whether the main toolbar is collapsed
 */
export const toolbarCollapsed = writable<boolean>(false);
