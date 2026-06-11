// recordColor.ts — UT2026-C (#070): the single record-color contract.
//
// Before this module the plugin had three independent color mechanisms:
// project color rules (`getRecordColor`), an explicit per-record hex field
// (`eventColorField` frontmatter), and a field-NAME heuristic duplicated in
// EditNote.svelte and FieldControl.svelte. Readers disagreed on priority and
// on what counts as a valid color: the calendar accepted only strict
// `#RRGGBB`, so a hand-typed `#0fb` / ` #00ffb3 ` from the note-edit modal
// silently resolved to "no color" while the popup's canonical picker output
// worked — the exact asymmetry user testing reported.
//
// Contract (C1): explicit per-record color beats project rule beats nothing.
// A user gesture on a specific record is stronger than a declarative rule.

import type { DataRecord } from "src/lib/dataframe/dataframe";

/**
 * C2 — the ONE list of field-name fragments treated as color-bearing.
 * Used by EditNote / FieldControl to decide when to render a color picker,
 * and by `resolveRecordColor` as the fallback chain when the view config
 * does not pin an explicit `eventColorField`.
 */
export const COLOR_FIELD_NAME_FRAGMENTS = [
  "color",
  "eventcolor",
  "tagcolor",
  "backgroundcolor",
] as const;

/** True when a field name should get color-picker affordances in editors. */
export function isColorFieldName(name: string): boolean {
  const lower = name.toLowerCase();
  return COLOR_FIELD_NAME_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

/**
 * Normalize arbitrary user input into canonical `#rrggbb`, or null.
 * Accepts `#RGB` and `#RRGGBB`, any case, surrounding whitespace.
 * Anything else (named colors, rgb(), garbage) → null: explicit color is a
 * frontmatter contract, and a permissive parser would turn typos into
 * near-black surprises.
 */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const long = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  if (long) return `#${long[1]!.toLowerCase()}`;
  const short = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (short) {
    const [r, g, b] = short[1]!.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

/**
 * Read the explicit per-record color. Field lookup is case-tolerant
 * (frontmatter key `Color` must satisfy a view configured with `color`).
 */
export function explicitRecordColor(
  record: DataRecord,
  eventColorField?: string
): string | null {
  const candidates = eventColorField
    ? [eventColorField, ...COLOR_FIELD_NAME_FRAGMENTS]
    : [...COLOR_FIELD_NAME_FRAGMENTS];
  for (const candidate of candidates) {
    const direct = normalizeHexColor(record.values[candidate]);
    if (direct) return direct;
    const lower = candidate.toLowerCase();
    for (const [key, value] of Object.entries(record.values)) {
      if (key.toLowerCase() === lower) {
        const normalized = normalizeHexColor(value);
        if (normalized) return normalized;
      }
    }
  }
  return null;
}

export interface ResolveRecordColorOptions {
  /** View-configured frontmatter field carrying the explicit color. */
  readonly eventColorField?: string | undefined;
  /** Project color-rules callback (settings → colorFilter conditions). */
  readonly getRecordColor?: ((record: DataRecord) => string | null) | undefined;
}

/**
 * C1 — the single resolution pipeline:
 * explicit per-record hex → project color rule → null (theme default).
 */
export function resolveRecordColor(
  record: DataRecord,
  options: ResolveRecordColorOptions
): string | null {
  const explicit = explicitRecordColor(record, options.eventColorField);
  if (explicit) return explicit;
  return options.getRecordColor?.(record) ?? null;
}
