// #045.3 — Pure parser for relation field values.
//
// Normalises the various shapes that relation values can take in a
// DataRecord into a flat list of bare link bodies (no `[[ ]]` wrapping):
//
//   - `["A", "B"]`        → `["A", "B"]`
//   - `"[[A]] [[B]]"`     → `["A", "B"]`
//   - `"A, B"`            → `["A", "B"]`
//   - `null`/`undefined`/`""` → `[]`
//   - `123` (rare)        → `["123"]`
//
// Shared by `GridRelationCell.svelte` and the new Dashboard widget wiring
// (DataList / SubBaseCanvas) so all consumers go through one canonical
// derivation. Pure function — no I/O, safe in tests.

import type { DataValue, Optional } from "src/lib/dataframe/dataframe";

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/**
 * Parse a raw relation cell value into a list of link bodies.
 *
 * Order of rules (matches `GridRelationCell.parseLinks` semantics):
 *  1. `null`/`undefined` → `[]`.
 *  2. Array → map each item to `String` (preserves order; empty strings
 *     filtered out).
 *  3. String containing `[[...]]` tokens → extract the body of every
 *     wikilink (alias-aware: trims `|alias` suffix).
 *  4. Plain string → split by comma, trim, drop empties.
 *  5. Other primitives → `[String(value)]` when non-empty, else `[]`.
 */
export function parseRelationLinks(value: Optional<DataValue>): string[] {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value
      .map((v) => (v == null ? "" : String(v)))
      .map((s) => stripWikilink(s).trim())
      .filter((s) => s.length > 0);
  }

  if (typeof value === "string") {
    if (value.length === 0) return [];
    const matches = value.match(WIKILINK_RE);
    if (matches) {
      return matches
        .map((m) => stripWikilink(m))
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  const s = String(value).trim();
  return s.length > 0 ? [s] : [];
}

/**
 * Strip `[[ ]]` wrapping and `|alias` suffix if present, returning the
 * canonical link body. Leaves non-wikilink strings untouched.
 */
function stripWikilink(s: string): string {
  const m = s.match(/^\[\[(.+?)(?:\|.+?)?\]\]$/);
  return m && m[1] !== undefined ? m[1] : s;
}
