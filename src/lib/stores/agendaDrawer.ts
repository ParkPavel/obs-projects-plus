/**
 * Phone agenda drawer: one session-only source of truth.
 *
 * The navbar toggle (App.svelte), the navbar icon/label and CalendarView all read
 * and write this store on a phone, so the three can never disagree. It is NOT
 * persisted: `config.agendaOpen` stays the desktop side-panel flag, and the drawer
 * always starts closed in a new session.
 *
 * The key is whatever id both sides can compute for the calendar they share
 * (the project id today: CalendarView does not receive the view id).
 */
import { derived, get, writable, type Readable } from "svelte/store";

const openByKey = writable<Record<string, boolean>>({});

/** Readable that is true while the drawer of `key` is open. Default: closed. */
export function isOpen(key: string | undefined): Readable<boolean> {
  return derived(openByKey, (map) => (key ? map[key] === true : false));
}

/** Current value without subscribing. */
export function isOpenNow(key: string | undefined): boolean {
  return key ? get(openByKey)[key] === true : false;
}

/** Flip the drawer of `key`. Returns the new state. */
export function toggle(key: string | undefined): boolean {
  if (!key) return false;
  const next = !isOpenNow(key);
  openByKey.update((map) => ({ ...map, [key]: next }));
  return next;
}

/** Close the drawer of `key` (no-op when already closed). */
export function close(key: string | undefined): void {
  if (!key || !isOpenNow(key)) return;
  openByKey.update((map) => ({ ...map, [key]: false }));
}

/** Raw map, for tests and for components that prefer a single subscription. */
export const agendaDrawer: Readable<Record<string, boolean>> = {
  subscribe: openByKey.subscribe,
};
