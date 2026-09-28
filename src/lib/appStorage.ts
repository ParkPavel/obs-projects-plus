import { get } from "svelte/store";
import { app } from "src/lib/stores/obsidian";

/**
 * Obsidian's per-vault local storage (App.loadLocalStorage / saveLocalStorage,
 * `@since 1.8.7`, the manifest's minAppVersion), read through the plugin's own
 * App reference — the app store set from `this.app` in onload — rather than the
 * global `app` object the guidelines reserve for debugging.
 *
 * The installed typings predate these methods, hence the local interface.
 */
interface AppLocalStorage {
  loadLocalStorage?(key: string): string | null;
  saveLocalStorage?(key: string, value: unknown): void;
}

function storage(): AppLocalStorage | undefined {
  return get(app);
}

/** The stored string for `key`, or null when absent or before the plugin has its App. */
export function loadAppLocal(key: string): string | null {
  return storage()?.loadLocalStorage?.(key) ?? null;
}

/** Store `value` under `key` (null clears it); a no-op before the plugin has its App. */
export function saveAppLocal(key: string, value: string | null): void {
  storage()?.saveLocalStorage?.(key, value);
}
