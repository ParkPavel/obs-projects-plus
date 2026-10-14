import type { DataRecord } from "src/lib/dataframe/dataframe";
import { toNumber } from "src/lib/engine/numeric";

const int = (s: string | undefined): number => toNumber(s ?? "") ?? NaN;

/**
 * 3.7.2 B3 — the table's search language, one predicate for every path.
 *
 * Plain words match any value or the note name; all words must match.
 * `field:value` matches inside one field (`"Due date":…` for a name with
 * spaces); `field:` matches an empty field and `field:*` a filled one.
 * A token that names no known field stays plain text, so `10:30` still works.
 *
 * What used to fail, and is covered by tests: `ё`/`е`, case, a Date value
 * (searched as «Wed Oct 14…»), a number typed with a comma, a date typed as
 * 14.10.2026 against a stored 2026-10-14, and the `.md` of every id matching «md».
 */

export interface SearchTerm {
  /** Actual field name, when the token targets one. */
  readonly field?: string;
  readonly kind: "contains" | "empty" | "filled";
  /** Normalized text to find. */
  readonly text: string;
  /** YYYY-MM-DD when the text reads as a date. */
  readonly day?: string;
}

export interface ParsedSearch {
  readonly terms: readonly SearchTerm[];
}

export function normalizeSearchText(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

const TOKEN = /(?:"([^"]*)"|([^\s":]+)):(?:"([^"]*)"|(\S*))|"([^"]*)"|(\S+)/g;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** A typed date in the forms people use: 2026-10-14, 14.10.2026, 14/10/2026, 14.10.26. */
export function searchDay(text: string): string | undefined {
  const t = text.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return valid(int(m[1]), int(m[2]), int(m[3]));
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/.exec(t);
  if (m) {
    const y = m[3]?.length === 2 ? 2000 + int(m[3]) : int(m[3]);
    return valid(y, int(m[2]), int(m[1]));
  }
  return undefined;
}

function valid(y: number, mo: number, d: number): string | undefined {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function valueDay(v: unknown): string | undefined {
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  if (typeof v === "string") {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(v.trim());
    return m ? m[1] : searchDay(v);
  }
  return undefined;
}

/** Every normalized text a value can be found by. */
export function valueTexts(v: unknown): string[] {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) return v.flatMap((item) => valueTexts(item));
  if (v instanceof Date) {
    const day = valueDay(v);
    if (!day) return [];
    const [y, mo, d] = day.split("-");
    return [day, `${d}.${mo}.${y}`];
  }
  if (typeof v === "number") {
    const s = String(v);
    return s.includes(".") ? [s, s.replace(".", ",")] : [s];
  }
  const s = normalizeSearchText(typeof v === "string" ? v : typeof v === "boolean" ? (v ? "true" : "false") : JSON.stringify(v) ?? "");
  const day = typeof v === "string" ? valueDay(v) : undefined;
  if (day && /^\d{4}-/.test(s)) {
    const [y, mo, d] = day.split("-");
    return [s, `${d}.${mo}.${y}`];
  }
  return [s];
}

function isEmptyValue(v: unknown): boolean {
  return v == null || v === "" || (Array.isArray(v) && v.every(isEmptyValue));
}

function resolveField(name: string, fieldNames: readonly string[]): string | undefined {
  const n = normalizeSearchText(name);
  return fieldNames.find((f) => normalizeSearchText(f) === n);
}

function plain(text: string): SearchTerm {
  const normalized = normalizeSearchText(text);
  const day = searchDay(normalized);
  return day ? { kind: "contains", text: normalized, day } : { kind: "contains", text: normalized };
}

/** Parse once per query; `fieldNames` decides which `x:` prefixes are fields. */
export function parseSearchQuery(query: string, fieldNames: readonly string[] = []): ParsedSearch {
  const terms: SearchTerm[] = [];
  TOKEN.lastIndex = 0;
  for (let m = TOKEN.exec(query); m; m = TOKEN.exec(query)) {
    const rawField = m[1] ?? m[2];
    if (rawField !== undefined) {
      const value = m[3] ?? m[4] ?? "";
      const field = resolveField(rawField, fieldNames);
      if (field) {
        if (value === "" && m[3] === undefined) terms.push({ field, kind: "empty", text: "" });
        else if (value === "*") terms.push({ field, kind: "filled", text: "" });
        else terms.push({ ...plain(value), field });
        continue;
      }
      const whole = m[0].replace(/"/g, "");
      if (whole.trim()) terms.push(plain(whole));
      continue;
    }
    const text = m[5] ?? m[6] ?? "";
    if (text.trim()) terms.push(plain(text));
  }
  return { terms };
}

function idText(id: string): string {
  return normalizeSearchText((id.split("/").pop() ?? id).replace(/\.md$/i, ""));
}

function valueMatches(v: unknown, term: SearchTerm): boolean {
  if (term.day) {
    const items = Array.isArray(v) ? v : [v];
    if (items.some((item) => valueDay(item) === term.day)) return true;
  }
  return valueTexts(v).some((t) => t.includes(term.text));
}

function termMatches(record: DataRecord, term: SearchTerm): boolean {
  if (term.field !== undefined) {
    const v = record.values[term.field];
    if (term.kind === "empty") return isEmptyValue(v);
    if (term.kind === "filled") return !isEmptyValue(v);
    return valueMatches(v, term);
  }
  if (idText(record.id).includes(term.text)) return true;
  for (const key in record.values) {
    if (valueMatches(record.values[key], term)) return true;
  }
  return false;
}

export function matchesParsed(record: DataRecord, parsed: ParsedSearch): boolean {
  return parsed.terms.every((term) => termMatches(record, term));
}

/** Field names a record set carries, for callers without a field list. */
function namesOf(records: readonly DataRecord[]): string[] {
  const names = new Set<string>();
  for (const r of records.slice(0, 50)) for (const k in r.values) names.add(k);
  return [...names];
}

/** The shared predicate for a raw query (kept for callers that search one record). */
export function matchesSearch(record: DataRecord, query: string, fieldNames?: readonly string[]): boolean {
  return matchesParsed(record, parseSearchQuery(query, fieldNames ?? Object.keys(record.values)));
}

export function applySearch(records: readonly DataRecord[], query: string, fieldNames?: readonly string[]): DataRecord[] {
  const parsed = parseSearchQuery(query, fieldNames ?? namesOf(records));
  return parsed.terms.length ? records.filter((r) => matchesParsed(r, parsed)) : [...records];
}

// ── Highlight ────────────────────────────────────────────────

export interface HighlightPart {
  readonly text: string;
  readonly hit: boolean;
}

/** Split `text` into hit / non-hit runs for the query's text terms (optionally of one field). */
export function highlightParts(text: string, parsed: ParsedSearch, field?: string): HighlightPart[] {
  const needles = parsed.terms
    .filter((t) => t.kind === "contains" && t.text && (t.field === undefined || t.field === field))
    .map((t) => t.text);
  const hay = normalizeSearchText(text);
  if (!needles.length || hay.length !== text.length) return [{ text, hit: false }];
  const marks = new Array<boolean>(text.length).fill(false);
  for (const n of needles) {
    for (let i = hay.indexOf(n); i >= 0; i = hay.indexOf(n, i + 1)) marks.fill(true, i, i + n.length);
  }
  const parts: HighlightPart[] = [];
  for (let i = 0; i < text.length;) {
    let j = i;
    while (j < text.length && marks[j] === marks[i]) j++;
    parts.push({ text: text.slice(i, j), hit: marks[i] === true });
    i = j;
  }
  return parts.length ? parts : [{ text, hit: false }];
}

// ── Suggestions ──────────────────────────────────────────────

export interface SearchSuggestion {
  /** What the list shows. */
  readonly label: string;
  /** The whole query after choosing it. */
  readonly query: string;
}

function quote(s: string): string {
  return /[\s":]/.test(s) ? `"${s.replace(/"/g, "")}"` : s;
}

/** The last token being typed, and everything before it. */
function splitLast(query: string): { head: string; last: string } {
  let inQuote = false;
  let cut = 0;
  for (let i = 0; i < query.length; i++) {
    const c = query[i];
    if (c === '"') inQuote = !inQuote;
    else if (!inQuote && /\s/.test(c ?? "")) cut = i + 1;
  }
  return { head: query.slice(0, cut), last: query.slice(cut) };
}

/**
 * Completions for the token under the cursor (the end): a field name gets
 * `Field:`, a `Field:pre` gets that field's known values. At most `limit`.
 */
export function searchSuggestions(
  query: string,
  fieldNames: readonly string[],
  records: readonly DataRecord[],
  limit = 8,
): SearchSuggestion[] {
  const { head, last } = splitLast(query);
  const colon = /^(?:"([^"]*)"|([^\s":]+)):(?:"?)(.*)$/.exec(last);
  if (colon) {
    const field = resolveField(colon[1] ?? colon[2] ?? "", fieldNames);
    if (!field) return [];
    const prefix = normalizeSearchText((colon[3] ?? "").replace(/"$/, ""));
    const seen = new Set<string>();
    const out: SearchSuggestion[] = [];
    for (const r of records) {
      const v = r.values[field];
      const items = Array.isArray(v) ? v : [v];
      for (const item of items) {
        if (item == null || item === "") continue;
        const shown = item instanceof Date ? valueTexts(item)[0] ?? "" : String(item);
        const key = normalizeSearchText(shown);
        if (!shown || seen.has(key) || (prefix && !key.includes(prefix))) continue;
        seen.add(key);
        out.push({ label: `${field}: ${shown}`, query: `${head}${quote(field)}:${quote(shown)} ` });
        if (out.length >= limit) return out;
      }
    }
    return out;
  }
  const typed = normalizeSearchText(last.replace(/"/g, ""));
  if (!typed) return [];
  return fieldNames
    .filter((f) => normalizeSearchText(f).startsWith(typed))
    .slice(0, limit)
    .map((f) => ({ label: `${f}:`, query: `${head}${quote(f)}:` }));
}

/** Arrow/Enter/Tab/Escape over the hint list: the next active index, or what to do. */
export function hintKey(key: string, count: number, active: number): { active: number; choose?: number; close?: boolean } | null {
  if (count && (key === "ArrowDown" || key === "ArrowUp")) {
    return { active: key === "ArrowDown" ? (active + 1) % count : (active - 1 + count) % count };
  }
  if (count && active >= 0 && (key === "Enter" || key === "Tab")) return { active: -1, choose: active };
  if (key === "Escape") return active >= 0 ? { active: -1 } : { active: -1, close: true };
  return null;
}
