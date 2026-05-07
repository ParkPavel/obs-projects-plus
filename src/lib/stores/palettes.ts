/**
 * Centralized favorites/palette store (R5-005).
 *
 * Single source of truth for color favorites and default color constants.
 * Both ColorPicker.svelte and RecordItem.svelte subscribe to this store
 * instead of each managing their own localStorage copy.
 *
 * Persistence: Obsidian's plugin localStorage (app.loadLocalStorage /
 * saveLocalStorage), same key as before so existing favorites survive.
 */

import { writable } from "svelte/store";
import { get } from "svelte/store";
import { app } from "src/lib/stores/obsidian";

/** Default color for new color pickers. */
export const DEFAULT_COLOR = "#3b82f6";

/** Default color for new color filter rules. */
export const COLOR_RULE_DEFAULT = "#8ab4f8";

/** LocalStorage key shared between ColorPicker and RecordItem. */
export const FAVORITES_KEY = "obsidian-projects-calendar-favorites";

export interface Favorite {
  color: string;
  name: string;
}

function getAppInstance(): any {
  return (typeof window !== "undefined" && (window as any).app) ?? get(app);
}

function loadFromStorage(): Favorite[] {
  try {
    const stored = getAppInstance()?.loadLocalStorage(FAVORITES_KEY);
    if (stored) return JSON.parse(stored) as Favorite[];
  } catch {
    // ignore
  }
  return [];
}

function persistToStorage(favorites: Favorite[]): void {
  try {
    getAppInstance()?.saveLocalStorage(FAVORITES_KEY, JSON.stringify(favorites));
  } catch {
    // ignore
  }
}

function createFavoritesStore() {
  const { subscribe, set, update } = writable<Favorite[]>([]);
  let initialized = false;

  function ensureInit() {
    if (initialized) return;
    initialized = true;
    set(loadFromStorage());
  }

  return {
    subscribe: (run: Parameters<typeof subscribe>[0], invalidate?: Parameters<typeof subscribe>[1]) => {
      ensureInit();
      return subscribe(run, invalidate);
    },

    add(color: string, name = "Custom") {
      ensureInit();
      update((favs) => {
        if (favs.find((f) => f.color.toLowerCase() === color.toLowerCase())) return favs;
        const next = [...favs, { color, name }];
        persistToStorage(next);
        return next;
      });
    },

    remove(color: string) {
      ensureInit();
      update((favs) => {
        const next = favs.filter((f) => f.color.toLowerCase() !== color.toLowerCase());
        persistToStorage(next);
        return next;
      });
    },

    /** Force re-read from localStorage (e.g. after another tab writes). */
    reload() {
      set(loadFromStorage());
    },
  };
}

export const favoritesStore = createFavoritesStore();
