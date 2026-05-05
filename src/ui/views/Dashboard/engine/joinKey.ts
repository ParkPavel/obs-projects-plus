// src/ui/views/Dashboard/engine/joinKey.ts
// Shared equality-key normaliser for JoinStep (Pillar 5 — cross-type correlation)
// and scatter correlation.
//
// Contract:
//  - `null`/`undefined` → sentinel so that "absent" never matches a real value.
//  - `Date` → local-timezone day-granularity key `D:yyyy-MM-dd` produced via
//    `getFullYear/getMonth/getDate`. This matches how Obsidian parses
//    frontmatter dates (`2026-04-01` → local midnight) and how user-authored
//    `new Date(y, m, d)` constructors behave. Callers that mix UTC-qualified
//    ISO strings with local-midnight `Date` objects should pre-normalise via
//    a `FORMAT_DATE` compute step before joining.
//  - ISO-like date strings (`yyyy-MM-dd` optionally followed by `T...`) are
//    normalised to the same `D:yyyy-MM-dd` key by lexical prefix extraction,
//    i.e. day-granularity only — sub-day precision is intentionally dropped.
//  - Arrays → JSON. Other scalars → `typeof:value`.

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

export function joinKey(v: unknown): string {
  if (v == null) return "\0";
  if (v instanceof Date) {
    // Local-TZ day key: matches how Obsidian YAML dates (`2026-04-01`) are
    // parsed (local midnight) and how `new Date(y,m,d)` constructors behave.
    // For fully-qualified UTC ISO strings, pre-normalise via FORMAT_DATE
    // compute step if your data mixes conventions.
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `D:${y}-${m}-${d}`;
  }
  if (typeof v === "string") {
    const m = ISO_DATE_PREFIX.exec(v);
    if (m) return `D:${m[1]}-${m[2]}-${m[3]}`;
    return `string:${v}`;
  }
  if (Array.isArray(v)) return JSON.stringify(v);
  return `${typeof v}:${String(v)}`;
}
