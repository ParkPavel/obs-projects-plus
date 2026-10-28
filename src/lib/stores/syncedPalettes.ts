/** Shared and per-project palettes use data.json and its verified settings writer. */
import { derived, get, readable, type Readable } from "svelte/store";
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

function palette(state: LatestProjectsPluginSettings, projectId: string | undefined): Favorite[] {
  const project = projectId ? state.projects.find((item) => item.id === projectId) : undefined;
  return normalizeFavorites(project?.colorFavorites ?? state.preferences.colorFavorites);
}

export function createFavoritesStore(projectId: Readable<string | undefined> = readable(undefined)) {
  const store = derived([settings, projectId], ([state, id]) => palette(state, id));
  function change(edit: (current: Favorite[]) => Favorite[]): void {
    const state = get(settings);
    const id = get(projectId);
    const current = palette(state, id);
    const next = edit(current);
    if (next === current) return;
    if (id !== undefined) {
      const project = state.projects.find((item) => item.id === id);
      if (!project) return;
      settings.updateProject({ ...project, colorFavorites: next });
    } else {
      settings.updatePreferences({ ...state.preferences, colorFavorites: next });
    }
  }
  return {
    subscribe: store.subscribe,
    add(color: string, name?: string): void {
      const normalized = normalizeHexColor(color);
      if (!normalized) return;
      change((current) => current.some((item) => item.color === normalized)
        ? current : [...current, { color: normalized, name: name ?? normalized }]);
    },
    remove(color: string): void {
      const normalized = normalizeHexColor(color);
      change((current) => current.filter((item) => item.color !== normalized));
    },
    // Settings adoption is reactive; it never re-imports device-local state.
    reload(): void {},
  };
}

/** Callers without a project use the shared fallback. */
export const favoritesStore = createFavoritesStore();
