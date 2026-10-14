/**
 * 3.7.2 B2 — pure rules of the note-header properties block.
 *
 * The block replaces Obsidian's "Properties" in the note header. What it
 * shows comes from the per-note overlay (`pp_overlay`); what it writes goes
 * through the one frontmatter writer, one key per commit, and only when the
 * value actually changed (AD-03/AD-04: storage is untouched, display is not
 * storage). Reserved keys (`pp_*`, `$*`) are never shown as properties.
 */

import {
  applyOverlay,
  type NoteOverlay,
  type OverlayedEntry,
} from "src/lib/visualizer/overlay";
import {
  formatCellValue,
  parseCellInput,
  type CellEditType,
  type CellValue,
} from "src/lib/database/cellEditor";
import { parseTypedDate } from "src/lib/helpers/typedDate";

export function isReservedPropertyKey(key: string): boolean {
  return key.startsWith("pp_") || key.startsWith("$");
}

/** Properties in display order: pinned, ordered, the rest, hidden on request. */
export function visibleProperties(
  frontmatter: Record<string, unknown> | null | undefined,
  overlay: NoteOverlay,
  options: { showHidden?: boolean } = {},
): OverlayedEntry[] {
  return applyOverlay(frontmatter, overlay, options).filter(
    (e) => !isReservedPropertyKey(e.key),
  );
}

export type NewPropertyName =
  | { ok: true; key: string }
  | { ok: false; reason: "empty" | "exists" | "reserved" };

export function validateNewPropertyName(
  raw: string,
  frontmatter: Record<string, unknown> | null | undefined,
): NewPropertyName {
  const key = raw.trim();
  if (key.length === 0) return { ok: false, reason: "empty" };
  if (isReservedPropertyKey(key)) return { ok: false, reason: "reserved" };
  if (frontmatter && Object.prototype.hasOwnProperty.call(frontmatter, key)) {
    return { ok: false, reason: "exists" };
  }
  return { ok: true, key };
}

export type ValueWritePlan =
  | { kind: "skip" }
  | { kind: "write"; value: CellValue }
  | { kind: "invalid"; i18nKey: string };

function asCellValue(value: unknown): CellValue {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map((x) => String(x));
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return JSON.stringify(value);
}

/**
 * Decide what a committed draft writes. An unchanged draft writes nothing, so
 * opening and leaving a field never touches the file.
 */
export function planValueWrite(
  current: unknown,
  draft: string,
  type: CellEditType,
): ValueWritePlan {
  const parsed = parseCellInput(draft, type);
  if (!parsed.ok) return { kind: "invalid", i18nKey: parsed.error.i18nKey };
  const before = asCellValue(current);
  if (formatCellValue(parsed.value, type) === formatCellValue(before, type)) {
    return { kind: "skip" };
  }
  return { kind: "write", value: parsed.value };
}

/** The editor text of a stored value. */
export function draftOf(value: unknown, type: CellEditType): string {
  return formatCellValue(asCellValue(value), type);
}

const STORED_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?/;

/** A stored `YYYY-MM-DD[THH:mm]` read as a local date, or null. */
export function parseStoredDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const m = STORED_DATE.exec(value);
  if (!m) return null;
  // The same reader DateField uses for the platform picker's value.
  const parsed = parseTypedDate(m[0].replace("T", " "));
  return parsed.kind === "date" ? parsed.date : null;
}

/** A local date as the text `parseCellInput` stores for date/datetime. */
export function dateToCellText(date: Date, withTime: boolean): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  return withTime ? `${day}T${p(date.getHours())}:${p(date.getMinutes())}` : day;
}
