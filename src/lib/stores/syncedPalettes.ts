/** Shared and per-project palettes use data.json and its verified settings writer. */
import { derived, get } from "svelte/store";
import { loadAppLocal } from "src/lib/appStorage";
import { normalizeHexColor } from "src/lib/colors/recordColor";
import { settings } from "./settings";
import type { ColorFavorite, LatestProjectsPluginSettings } from "src/settings/settings";

export const DEFAULT_COLOR = "#3b82f6";
export const COLOR_RULE_DEFAULT = "#8ab4f8";
export const FAVORITES_KEY = "obsidian-projects-calendar-favorites";
export type Favorite = ColorFavorite;

export function normalizeFavorites(value: unknown): Favorite[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const { color, name } = item as Record<string, unknown>;
    const normalized = normalizeHexColor(color);
    if (!normalized || seen.has(normalized)) return [];
    seen.add(normalized);
    return [{ color: normalized, name: typeof name === "string" ? name : normalized }];
  });
}

/** Keep the old local copy as a recovery source; never overwrite a synced palette. */
export function migrateLegacyFavorites(loadedSuccessfully: boolean): void {
  if (!loadedSuccessfully) return;
  const current = get(settings);
  if (current.preferences.colorFavorites !== undefined) return;
  try {
    const raw = loadAppLocal(FAVORITES_KEY);
    if (raw === null) return;
    const colors = normalizeFavorites(JSON.parse(raw));
    settings.updatePreferences({ ...current.preferences, colorFavorites: colors });
  } catch (error) {
    console.warn("[Projects+] could not import the local colour palette", error);
  }
}

/** Read legacy project favorites while writing all new changes to shared settings. */
function allFavorites(state: LatestProjectsPluginSettings): Favorite[] {
  return normalizeFavorites([
    ...normalizeFavorites(state.preferences.colorFavorites),
    ...state.projects.flatMap((project) => normalizeFavorites(project.colorFavorites)),
  ]);
}

function createUnifiedFavoritesStore() {
  const store = derived(settings, allFavorites);
  return {
    subscribe: store.subscribe,
    add(color: string, name?: string): void {
      const normalized = normalizeHexColor(color);
      if (!normalized) return;
      const state = get(settings);
      if (allFavorites(state).some((item) => item.color === normalized)) return;
      settings.updatePreferences({
        ...state.preferences,
        colorFavorites: normalizeFavorites([
          ...(state.preferences.colorFavorites ?? []),
          { color: normalized, name: name ?? normalized },
        ]),
      });
    },
    remove(color: string): void {
      const normalized = normalizeHexColor(color);
      if (!normalized) return;
      const state = get(settings);
      const shared = state.preferences.colorFavorites ?? [];
      const nextShared = shared.filter((item) => normalizeHexColor(item.color) !== normalized);
      if (nextShared.length !== shared.length) {
        settings.updatePreferences({ ...state.preferences, colorFavorites: nextShared });
      }
      for (const project of state.projects) {
        const colors = project.colorFavorites;
        if (!colors) continue;
        const next = colors.filter((item) => normalizeHexColor(item.color) !== normalized);
        if (next.length !== colors.length) settings.updateProject({ ...project, colorFavorites: next });
      }
    },
    // Settings adoption is reactive; it never re-imports device-local state.
    reload(): void {},
  };
}

/** Every picker reads and edits one deduplicated favorite set. */
export const favoritesStore = createUnifiedFavoritesStore();
