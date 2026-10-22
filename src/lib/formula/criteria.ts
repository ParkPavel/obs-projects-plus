// i3-final: the criteria language of SUMIF / COUNTIF / AVERAGEIF and the *IFS
// family, as Excel and Google Sheets read it.
//
//   5, "5", "=5"   the number 5 (a cell holding the text "5" is 5 too)
//   ">10" "<=5"    a comparison; numbers with numbers, dates with dates
//                  (ISO "2026-01-31"), text with text (alphabetical, any case)
//   "done" "=done" the text, case-insensitive; `*` is any run, `?` one
//                  character, `~*` / `~?` / `~~` the literal character
//   "<>x"          everything that is not x, blanks included
//   "" / "="       blank cells; "<>" the non-blank ones
//   TRUE / "TRUE"  the logical value
//
// A cell holding a list (a multi-value property) matches when any of its items
// does, so "<>x" reads «does not contain x». A wikilink matches by the text it
// shows. Numbers go through the project's one rule (`toNumber`, R0.15).

import dayjs from "dayjs";
import { toNumber } from "src/lib/engine/numeric";

export type CellMatcher = (cell: unknown) => boolean;

/** Longest first: `>=` must not be read as `>` followed by "=…". */
const OPERATORS = [">=", "<=", "<>", "=", ">", "<"] as const;
type Operator = (typeof OPERATORS)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const WIKILINK = /^\[\[([^\]]+)\]\]$/;
const collator = new Intl.Collator(undefined, { sensitivity: "base" });

function isBlank(cell: unknown): boolean {
  return cell == null || cell === "" || (Array.isArray(cell) && cell.length === 0);
}

/** A list cell matches when one of its items does; a scalar is a list of one. */
function anyItem(test: CellMatcher): CellMatcher {
  return (cell) => (Array.isArray(cell) ? cell.some((item) => test(item)) : test(cell));
}

/** The text a cell shows: a wikilink by its alias or target, a date by its day. */
function cellText(cell: unknown): string | null {
  if (typeof cell === "string") {
    const m = WIKILINK.exec(cell);
    if (!m?.[1]) return cell;
    const pipe = m[1].indexOf("|");
    return pipe >= 0 ? m[1].slice(pipe + 1) : m[1];
  }
  if (typeof cell === "number" || typeof cell === "boolean") return String(cell);
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? null : dayjs(cell).format("YYYY-MM-DD");
  return null;
}

function timeOf(cell: unknown, dayOnly: boolean): number | null {
  let d: dayjs.Dayjs | null = null;
  if (cell instanceof Date) d = dayjs(cell);
  else if (typeof cell === "string" && ISO_DATE.test(cell.trim())) d = dayjs(cell.trim());
  if (!d || !d.isValid()) return null;
  return (dayOnly ? d.startOf("day") : d).valueOf();
}

function logicalOf(cell: unknown): boolean | null {
  if (typeof cell === "boolean") return cell;
  if (typeof cell === "string") {
    const upper = cell.trim().toUpperCase();
    if (upper === "TRUE") return true;
    if (upper === "FALSE") return false;
  }
  return null;
}

function compare(op: Operator, diff: number): boolean {
  switch (op) {
    case ">": return diff > 0;
    case ">=": return diff >= 0;
    case "<": return diff < 0;
    case "<=": return diff <= 0;
    default: return diff === 0;
  }
}

type GlobToken = { any: true } | { any: false; ch: string | null };

/** `*` → any run, `?` → one character, `~` escapes the next one. Null when there is no wildcard. */
function globTokens(pattern: string): GlobToken[] | null {
  const tokens: GlobToken[] = [];
  let wild = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i] as string;
    if (ch === "~" && i + 1 < pattern.length) {
      tokens.push({ any: false, ch: pattern[++i] as string });
    } else if (ch === "*") {
      wild = true;
      if (!tokens.length || !tokens[tokens.length - 1]!.any) tokens.push({ any: true });
    } else if (ch === "?") {
      wild = true;
      tokens.push({ any: false, ch: null });
    } else {
      tokens.push({ any: false, ch });
    }
  }
  return wild ? tokens : null;
}

/** Iterative glob match with one backtrack point: linear-ish, no regex, no catastrophic case. */
function globMatch(text: string, tokens: readonly GlobToken[]): boolean {
  let t = 0, p = 0, star = -1, mark = 0;
  while (t < text.length) {
    const tok = tokens[p];
    if (tok && !tok.any && (tok.ch === null || tok.ch === text[t])) { t++; p++; }
    else if (tok?.any) { star = p++; mark = t; }
    else if (star !== -1) { p = star + 1; t = ++mark; }
    else return false;
  }
  while (tokens[p]?.any) p++;
  return p === tokens.length;
}

/** `~*` → `*`: the text a pattern without wildcards stands for. */
function unescapeTilde(pattern: string): string {
  return pattern.replace(/~([\s\S])/g, "$1");
}

function equalsMatcher(operand: string): CellMatcher {
  if (operand === "") return isBlank;
  const n = toNumber(operand);
  if (n !== null) return anyItem((cell) => toNumber(cell) === n);
  const upper = operand.toUpperCase();
  if (upper === "TRUE" || upper === "FALSE") {
    const want = upper === "TRUE";
    return anyItem((cell) => logicalOf(cell) === want);
  }
  if (ISO_DATE.test(operand)) {
    const dayOnly = operand.length === 10;
    const want = timeOf(operand, dayOnly);
    if (want !== null) return anyItem((cell) => timeOf(cell, dayOnly) === want);
  }
  const lower = operand.toLowerCase();
  const tokens = globTokens(lower);
  if (tokens) {
    // Wildcards read text only: "*" does not count a number, as in Excel.
    return anyItem((cell) => {
      const text = typeof cell === "string" ? cellText(cell) : null;
      return text !== null && globMatch(text.toLowerCase(), tokens);
    });
  }
  const literal = unescapeTilde(lower);
  return anyItem((cell) => cellText(cell)?.toLowerCase() === literal);
}

function compareMatcher(op: Operator, operand: string): CellMatcher {
  const n = toNumber(operand);
  if (n !== null) {
    return anyItem((cell) => {
      const v = toNumber(cell);
      return v !== null && compare(op, v - n);
    });
  }
  if (ISO_DATE.test(operand)) {
    const dayOnly = operand.length === 10;
    const want = timeOf(operand, dayOnly);
    if (want !== null) {
      return anyItem((cell) => {
        const t = timeOf(cell, dayOnly);
        return t !== null && compare(op, t - want);
      });
    }
  }
  // Text against text only: a number or a logical value is never «after "b"».
  return anyItem((cell) => {
    if (typeof cell !== "string" && !(cell instanceof Date)) return false;
    const text = cellText(cell);
    return text !== null && text !== "" && toNumber(text) === null && compare(op, collator.compare(text, operand));
  });
}

/** Turns one criteria argument into a test for a cell. */
export function compileCriterion(criteria: unknown): CellMatcher {
  if (Array.isArray(criteria)) {
    const each = criteria.map((c) => compileCriterion(c));
    return (cell) => each.some((m) => m(cell));
  }
  if (criteria == null) return isBlank;
  if (typeof criteria === "number") {
    return Number.isFinite(criteria) ? anyItem((cell) => toNumber(cell) === criteria) : () => false;
  }
  if (typeof criteria === "boolean") return anyItem((cell) => logicalOf(cell) === criteria);
  // A criterion is a value a formula produced: text, a date, or (rarely) an
  // object such as a styled value, which matches nothing.
  if (typeof criteria !== "string" && !(criteria instanceof Date)) return () => false;
  const raw = typeof criteria === "string" ? criteria : (cellText(criteria) ?? "");
  const op = OPERATORS.find((o) => raw.startsWith(o));
  const operand = op ? raw.slice(op.length) : raw;
  if (!op || op === "=") return equalsMatcher(operand);
  if (op === "<>") {
    const eq = equalsMatcher(operand);
    return (cell) => !eq(cell);
  }
  return compareMatcher(op, operand);
}

/**
 * Indices of the rows where every (range, criterion) pair matches. Ranges of
 * different lengths are read up to the longest; a missing cell is blank.
 */
export interface CriterionPair {
  readonly range: readonly unknown[];
  /** The criteria value as written — the key under which a scan is remembered. */
  readonly criteria: unknown;
  readonly test: CellMatcher;
}

// i3-final: `SUMIF(@team, team, @hours)` asks the same few questions of the
// same column from every row. A FROZEN range is a column the evaluator holds
// for one pass and never changes, so the rows a criterion picks in it are
// remembered per (range, criteria): a 2000-row group total scans each column
// once per distinct group instead of once per row. A range that is not frozen
// (a record's own list) is scanned every time — it may change between calls.
const rowCache = new WeakMap<readonly unknown[], Map<string, readonly number[]>>();
const numberCache = new WeakMap<readonly unknown[], ReadonlyArray<readonly number[]>>();

function criteriaKey(criteria: unknown): string | null {
  if (criteria == null) return "blank";
  if (typeof criteria === "string") return `s:${criteria}`;
  if (typeof criteria === "number") return `n:${criteria}`;
  if (typeof criteria === "boolean") return `b:${criteria}`;
  return null;
}

/** Rows of one range whose cell passes the test, ascending. */
export function rowsWhere(range: readonly unknown[], criteria: unknown, test: CellMatcher): readonly number[] {
  const key = Object.isFrozen(range) ? criteriaKey(criteria) : null;
  const known = key === null ? undefined : rowCache.get(range);
  const hit = key === null ? undefined : known?.get(key);
  if (hit) return hit;
  const rows: number[] = [];
  for (let i = 0; i < range.length; i++) if (test(range[i])) rows.push(i);
  if (key !== null) {
    const map = known ?? new Map<string, readonly number[]>();
    map.set(key, rows);
    if (!known) rowCache.set(range, map);
  }
  return rows;
}

/**
 * Indices of the rows where every (range, criterion) pair matches. Ranges of
 * different lengths are read up to the longest; a missing cell is blank.
 */
export function matchingRows(pairs: readonly CriterionPair[]): readonly number[] {
  const first = pairs[0];
  if (!first) return [];
  const length = pairs.reduce((max, p) => Math.max(max, p.range.length), 0);
  if (pairs.length === 1 && first.range.length === length) return rowsWhere(first.range, first.criteria, first.test);
  const hits = new Int32Array(length);
  for (const p of pairs) {
    for (const i of rowsWhere(p.range, p.criteria, p.test)) hits[i] = (hits[i] ?? 0) + 1;
    if (p.range.length < length && p.test(undefined)) {
      for (let i = p.range.length; i < length; i++) hits[i] = (hits[i] ?? 0) + 1;
    }
  }
  const rows: number[] = [];
  for (let i = 0; i < length; i++) if (hits[i] === pairs.length) rows.push(i);
  return rows;
}

/** The numbers each cell holds (a list cell may hold several), remembered for a frozen range. */
export function numbersPerCell(range: readonly unknown[]): ReadonlyArray<readonly number[]> {
  const hit = numberCache.get(range);
  if (hit) return hit;
  const view = range.map((cell) => {
    const items = Array.isArray(cell) ? cell : [cell];
    const out: number[] = [];
    for (const item of items) {
      const n = toNumber(item);
      if (n !== null) out.push(n);
    }
    return out;
  });
  if (Object.isFrozen(range)) numberCache.set(range, view);
  return view;
}
