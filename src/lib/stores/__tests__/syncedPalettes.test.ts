import { get } from "svelte/store";
import { settings } from "../settings";
import { DEFAULT_SETTINGS, DEFAULT_PROJECT } from "src/settings/settings";
import { favoritesStore, migrateLegacyFavorites, normalizeFavorites } from "../palettes";
import { loadAppLocal } from "src/lib/appStorage";

jest.mock("src/lib/appStorage", () => ({ loadAppLocal: jest.fn(), saveAppLocal: jest.fn() }));
const mockLoad = loadAppLocal as jest.Mock;
const red = { color: "#ff0000", name: "Red" };
const blue = { color: "#0000ff", name: "Blue" };
beforeEach(() => {
  settings.set({ ...DEFAULT_SETTINGS, preferences: { ...DEFAULT_SETTINGS.preferences },
    projects: ["a", "b"].map((id) => ({ ...DEFAULT_PROJECT, id, name: id, views: [] })) });
  mockLoad.mockReset();
});

test("imports the old palette to shared settings once and leaves a synced palette alone", () => {
  mockLoad.mockReturnValue(JSON.stringify([red, { color: "#F00", name: "Duplicate" }, { color: "bad" }]));
  migrateLegacyFavorites(true);
  expect(get(settings).preferences.colorFavorites).toEqual([red]);
  mockLoad.mockReturnValue(JSON.stringify([blue]));
  migrateLegacyFavorites(true);
  expect(mockLoad).toHaveBeenCalledTimes(1);
  expect(get(settings).preferences.colorFavorites).toEqual([red]);
});
test("a failed settings load cannot start a palette write over the unreadable file", () => {
  settings.set({ ...DEFAULT_SETTINGS, preferences: { ...DEFAULT_SETTINGS.preferences } });
  const before = get(settings);
  mockLoad.mockReturnValue(JSON.stringify([red]));
  const seen: unknown[] = [];
  const unsubscribe = settings.subscribe(value => seen.push(value));
  migrateLegacyFavorites(false);
  expect(get(settings)).toBe(before);
  expect(seen).toHaveLength(1);
  expect(mockLoad).not.toHaveBeenCalled();
  unsubscribe();
});
test("the unified picker merges legacy project colors and removes a favorite from every list", () => {
  settings.set({
    ...get(settings),
    preferences: { ...get(settings).preferences, colorFavorites: [red] },
    projects: get(settings).projects.map((project, index) => ({
      ...project,
      colorFavorites: index === 0 ? [blue] : [{ color: "#0000FF", name: "Duplicate blue" }],
    })),
  });
  const first: string[][] = [], second: string[][] = [];
  const unsubscribeFirst = favoritesStore.subscribe((items) => first.push(items.map((item) => item.color)));
  const unsubscribeSecond = favoritesStore.subscribe((items) => second.push(items.map((item) => item.color)));
  try {
    expect(get(favoritesStore)).toEqual([red, blue]);
    favoritesStore.add("#00ff00", "Green");
    expect(get(settings).preferences.colorFavorites).toEqual([red, { color: "#00ff00", name: "Green" }]);
    expect(first.at(-1)).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
    expect(second.at(-1)).toEqual(first.at(-1));

    favoritesStore.remove(blue.color);
    expect(get(settings).projects.every((project) => project.colorFavorites?.every((item) => normalizeFavorites([item])[0]?.color !== blue.color))).toBe(true);
    expect(get(favoritesStore).map((item) => item.color)).toEqual(["#ff0000", "#00ff00"]);
    expect(first.at(-1)).toEqual(second.at(-1));
  } finally {
    unsubscribeFirst();
    unsubscribeSecond();
  }
});
test("open pickers update together when shared settings are adopted", () => {
  const first: string[][] = [], second: string[][] = [];
  const unsubscribeFirst = favoritesStore.subscribe((items) => first.push(items.map((item) => item.color)));
  const unsubscribeSecond = favoritesStore.subscribe((items) => second.push(items.map((item) => item.color)));
  try {
    settings.updatePreferences({ ...get(settings).preferences, colorFavorites: [red] });
    expect(first.at(-1)).toEqual([red.color]);
    expect(second.at(-1)).toEqual(first.at(-1));
  } finally {
    unsubscribeFirst();
    unsubscribeSecond();
  }
});
test("invalid legacy JSON cannot replace settings or crash startup", () => {
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  mockLoad.mockReturnValue("{");
  const before = get(settings);
  migrateLegacyFavorites(true);
  expect(get(settings)).toBe(before);
  expect(warning).toHaveBeenCalled();
  warning.mockRestore();
  expect(normalizeFavorites([null, false, { color: "#ABC" }, { color: "#aabbcc" }])).toEqual([{ color: "#aabbcc", name: "#aabbcc" }]);
});
