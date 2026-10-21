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

/**
 * i3-props: a rename is a new name with the same rules as "+ Property"; the
 * unchanged name is "empty" (nothing to do), not "exists".
 */
export function validateRename(
  from: string,
  raw: string,
  frontmatter: Record<string, unknown> | null | undefined,
): NewPropertyName {
  if (raw.trim() === from) return { ok: false, reason: "empty" };
  return validateNewPropertyName(raw, frontmatter);
}

/**
 * i3-props: a value the block cannot round-trip — an object, or a list that
 * holds one. Writing its JSON text back would turn YAML structure into a
 * string, so such a value is shown and never edited here.
 */
export function isNestedValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((x) => x !== null && typeof x === "object");
  return value !== null && typeof value === "object";
}

export type ListType = "list" | "tags" | "relation";

/**
 * i3-props: one typed chip as a stored item. A relation is a wikilink; a tag
 * has no `#`. The text is never split — a comma inside a chip stays in it.
 */
export function chipItem(raw: string, type: ListType): string | null {
  const text = raw.trim();
  if (text === "") return null;
  if (type === "tags") return text.replace(/^#+/, "") || null;
  if (type === "relation" && !/^\[\[.*\]\]$/.test(text)) return `[[${text}]]`;
  return text;
}

/** i3-props: the items of a list value as text, one chip each. */
export function listItems(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x) => x !== null && x !== undefined).map((x) => String(x));
  if (value === null || value === undefined || value === "") return [];
  return [typeof value === "object" ? JSON.stringify(value) : String(value)];
}

/**
 * i3-props: what a chip edit writes. The array goes to the parser as an
 * array, so no item is re-split on commas; an unchanged list writes nothing.
 */
export function planListWrite(current: unknown, next: readonly string[], type: ListType): ValueWritePlan {
  const parsed = parseCellInput(next, type);
  if (!parsed.ok) return { kind: "invalid", i18nKey: parsed.error.i18nKey };
  const before = parseCellInput(listItems(current), type);
  if (before.ok && JSON.stringify(before.value) === JSON.stringify(parsed.value)) return { kind: "skip" };
  return { kind: "write", value: parsed.value };
}

/** i3-props: the folder whose notes count as "this project's notes" for a file. */
export interface NoteScope {
  folder: string;
  recursive: boolean;
}

function trimSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}

function parentOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(0, slash) : "";
}

export function inScope(path: string, scope: NoteScope): boolean {
  const dir = parentOf(path);
  if (scope.folder === "") return scope.recursive || dir === "";
  return scope.recursive ? dir === scope.folder || dir.startsWith(`${scope.folder}/`) : dir === scope.folder;
}

/**
 * i3-props: the deepest folder project (or folder-backed query) that holds
 * `path`; the note's own folder when no project does. Settings are read
 * loosely — this only needs a folder, and an unknown source kind is skipped.
 */
export function noteScopeFor(path: string, projects: readonly unknown[]): NoteScope {
  let best: NoteScope | null = null;
  for (const p of projects) {
    const source = (p as { dataSource?: { kind?: unknown; config?: Record<string, unknown> } }).dataSource;
    const excluded = (p as { excludedNotes?: unknown }).excludedNotes;
    if (Array.isArray(excluded) && excluded.includes(path)) continue;
    const config = source?.config ?? {};
    const folderPath = config["path"];
    const from = config["from"] as { kind?: unknown; path?: unknown } | undefined;
    let scope: NoteScope | null = null;
    if (source?.kind === "folder" && typeof folderPath === "string") {
      scope = { folder: trimSlashes(folderPath), recursive: config["recursive"] === true };
    } else if (source?.kind === "native-query" && from?.kind === "folder" && typeof from.path === "string") {
      scope = { folder: trimSlashes(from.path), recursive: true };
    }
    if (!scope || !inScope(path, scope)) continue;
    if (!best || scope.folder.length > best.folder.length) best = scope;
  }
  return best ?? { folder: parentOf(path), recursive: false };
}

/**
 * i3-props: the distinct values `key` holds across `frontmatters` — scalars
 * and list items, as text, in first-seen order. Objects are skipped.
 */
export function valuesForKey(
  frontmatters: Iterable<Record<string, unknown> | null | undefined>,
  key: string,
  limit = 200,
): string[] {
  const seen = new Set<string>();
  const add = (v: unknown): void => {
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") return;
    const text = String(v).trim();
    if (text !== "") seen.add(text);
  };
  for (const fm of frontmatters) {
    if (seen.size >= limit) break;
    const v = fm?.[key];
    if (Array.isArray(v)) v.forEach(add);
    else add(v);
  }
  return [...seen].slice(0, limit);
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
