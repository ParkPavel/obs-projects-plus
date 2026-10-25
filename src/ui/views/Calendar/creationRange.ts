// w4-p07 (decision 24.10 #14, audit F08) — the time range of an event created
// on the time grid. A drag sets its own start and end; a tap or click takes
// the view's creation length (15/30/60/90/120 minutes, default one hour).
// The calendar and its creation preview read the length from here, so the
// draft shown and the note written agree.

import { toNumber } from "src/lib/engine/numeric";
import type { CalendarConfig } from "./types";

export const CREATION_DURATIONS = [15, 30, 60, 90, 120] as const;
export const DEFAULT_CREATION_DURATION = 60;

/** The view's creation length; anything not offered reads as the default. */
export function creationDurationOf(config: CalendarConfig | undefined): number {
  const value = config?.creationDuration;
  return (CREATION_DURATIONS as readonly number[]).includes(value ?? NaN) ? (value as number) : DEFAULT_CREATION_DURATION;
}

/** `HH:mm` `minutes` after `start`, on a 24-hour clock (past midnight wraps). */
export function timeAfter(start: string, minutes: number): string {
  const [h = 0, m = 0] = start.split(":").map((part) => toNumber(part) ?? 0);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * The end to write for a new event: the one chosen on the grid when there is
 * one (a drag, a confirmed preview), otherwise the start plus the view's
 * creation length. No start, no end.
 */
export function creationEnd(start: string | undefined, end: string | undefined, config: CalendarConfig | undefined): string | undefined {
  if (!start) return undefined;
  return end ?? timeAfter(start, creationDurationOf(config));
}
