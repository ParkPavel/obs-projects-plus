import { get, writable } from "svelte/store";
import { settings } from "../settings";
import { DEFAULT_SETTINGS, DEFAULT_PROJECT, migrateSettings } from "src/settings/settings";
import { createFavoritesStore, migrateLegacyFavorites, normalizeFavorites } from "../palettes";
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
test("one project's edit forks the shared fallback and cannot affect another project", () => {
  settings.updatePreferences({ ...get(settings).preferences, colorFavorites: [red] });
  const a = createFavoritesStore(writable("a"));
  const b = createFavoritesStore(writable("b"));
  a.add(blue.color, blue.name);
  expect(get(a)).toEqual([red, blue]);
  expect(get(b)).toEqual([red]);
  expect(get(settings).preferences.colorFavorites).toEqual([red]);
  a.remove(red.color);
  a.remove(blue.color);
  expect(get(a)).toEqual([]);
  expect(get(b)).toEqual([red]);
});
test("a settings adoption updates open pickers; each leaf keeps its own project", () => {
  const project = writable<string | undefined>("a");
  const picker = createFavoritesStore(project);
  const shown: string[][] = [];
  const unsubscribe = picker.subscribe((items) => shown.push(items.map((item) => item.color)));
  settings.updateProject({ ...get(settings).projects[0]!, colorFavorites: [blue] });
  expect(shown.at(-1)).toEqual([blue.color]);
  project.set("b");
  expect(shown.at(-1)).toEqual([]);
  settings.updatePreferences({ ...get(settings).preferences, colorFavorites: [red] });
  expect(shown.at(-1)).toEqual([red.color]);
  const serialized = JSON.parse(JSON.stringify(get(settings)));
  const resolved = migrateSettings(serialized);
  expect(resolved._tag).toBe("Right");
  if (resolved._tag === "Right") {
    settings.set(resolved.right);
    project.set("a");
    expect(get(picker)).toEqual([blue]);
  }
  unsubscribe();
});
test("a stale picker cannot write to the fallback after its project is deleted", () => {
  const picker = createFavoritesStore(writable("gone"));
  const before = get(settings);
  picker.add(blue.color);
  expect(get(settings)).toBe(before);
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
