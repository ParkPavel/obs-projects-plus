/**
 * R2.5 — Notion-style Rollup mode taxonomy
 *
 * Per Revision 3 §5.5, the existing 12 `RollupFunction` kernels in
 * `Database/engine/rollup.ts` are correct as primitives but the user
 * surface should match Notion's grouped UI:
 *
 *   ┌─────────────────────────────────┐
 *   │ Show original                   │  → identity / list
 *   │ Show unique values              │  → unique
 *   │ Count                       ▶   │  → all / values / unique / empty / not-empty
 *   │ Percent                     ▶   │  → empty / not-empty / per-value
 *   │ More options                ▶   │  → sum, avg, min, max, median, range, earliest, latest
 *   └─────────────────────────────────┘
 *
 * This module defines that taxonomy as a pure model so the future
 * Rollup configuration UI (lands in R2.1 TableWidget rewrite) can
 * render the menu directly from data.
 *
 * Two responsibilities only:
 *  1. The mode → engine `RollupFunction` mapping (so the kernel is
 *     unchanged; we only re-shape the picker).
 *  2. Type-aware availability — e.g. `Sum` is irrelevant for a
 *     `string` target field.
 */

import type { RollupFunction } from "src/lib/engine/aggregate";

/** Stable identifier for a Notion-style rollup mode. */
export type RollupModeId =
  | "show_original"
  | "show_unique"
  | "count_all"
  | "count_values"
  | "count_unique"
  | "count_empty"
  | "count_not_empty"
  | "percent_empty"
  | "percent_not_empty"
  | "percent_per_group"
  | "sum"
  | "average"
  | "min"
  | "max"
  | "median"
  | "range"
  | "earliest"
  | "latest";

/** Top-level grouping in the picker UI. */
export type RollupModeGroup = "show" | "count" | "percent" | "more";

/**
 * Coarse target-field classification. The model only needs to know
 * "is this numeric / temporal / categorical" — the schema's actual
 * `DataFieldType` is mapped down to one of these buckets via
 * `classifyRollupTarget`.
 */
export type RollupTargetKind = "any" | "numeric" | "temporal" | "boolean" | "text";

export interface RollupModeDescriptor {
  readonly id: RollupModeId;
  readonly group: RollupModeGroup;
  /** i18n key under `database.rollup.modes.*`; UI passes through `t(...)`. */
  readonly i18nKey: string;
  /**
   * Underlying engine kernel. `null` means the mode is purely
   * presentational (e.g. `show_original` returns the raw target list)
   * — handled by the renderer, not the aggregator.
   */
  readonly fn: RollupFunction | null;
  /**
   * Target kinds for which this mode makes sense. Always includes
   * `"any"` for universally applicable modes.
   */
  readonly applicableTo: readonly RollupTargetKind[];
}

/**
 * Master list, in the canonical UI order. Adding a new mode means
 * either pointing it at an existing kernel or adding a new
 * `RollupFunction` first; never widen this list silently.
 */
export const ROLLUP_MODES: readonly RollupModeDescriptor[] = [
  // ── Show ─────────────────────────────────────────────
  {
    id: "show_original",
    group: "show",
    i18nKey: "database.rollup.modes.show-original",
    fn: null,
    applicableTo: ["any"],
  },
  {
    id: "show_unique",
    group: "show",
    i18nKey: "database.rollup.modes.show-unique",
    fn: "concat_unique",
    applicableTo: ["any"],
  },
  // ── Count ────────────────────────────────────────────
  {
    id: "count_all",
    group: "count",
    i18nKey: "database.rollup.modes.count-all",
    fn: "count",
    applicableTo: ["any"],
  },
  {
    id: "count_values",
    group: "count",
    i18nKey: "database.rollup.modes.count-values",
    fn: "count_values",
    applicableTo: ["any"],
  },
  {
    id: "count_unique",
    group: "count",
    i18nKey: "database.rollup.modes.count-unique",
    fn: "count_unique",
    applicableTo: ["any"],
  },
  {
    id: "count_empty",
    group: "count",
    i18nKey: "database.rollup.modes.count-empty",
    // No dedicated kernel; renderer derives via (count_all - count_values).
    fn: null,
    applicableTo: ["any"],
  },
  {
    id: "count_not_empty",
    group: "count",
    i18nKey: "database.rollup.modes.count-not-empty",
    fn: "count_values",
    applicableTo: ["any"],
  },
  // ── Percent ──────────────────────────────────────────
  {
    id: "percent_empty",
    group: "percent",
    i18nKey: "database.rollup.modes.percent-empty",
    fn: null,
    applicableTo: ["any"],
  },
  {
    id: "percent_not_empty",
    group: "percent",
    i18nKey: "database.rollup.modes.percent-not-empty",
    fn: null,
    applicableTo: ["any"],
  },
  {
    id: "percent_per_group",
    group: "percent",
    // Active for boolean (true / false split) and small categorical.
    i18nKey: "database.rollup.modes.percent-per-group",
    fn: "percent_true",
    applicableTo: ["boolean"],
  },
  // ── More (numeric / temporal) ────────────────────────
  {
    id: "sum",
    group: "more",
    i18nKey: "database.rollup.modes.sum",
    fn: "sum",
    applicableTo: ["numeric"],
  },
  {
    id: "average",
    group: "more",
    i18nKey: "database.rollup.modes.average",
    fn: "avg",
    applicableTo: ["numeric"],
  },
  {
    id: "min",
    group: "more",
    i18nKey: "database.rollup.modes.min",
    fn: "min",
    applicableTo: ["numeric", "temporal"],
  },
  {
    id: "max",
    group: "more",
    i18nKey: "database.rollup.modes.max",
    fn: "max",
    applicableTo: ["numeric", "temporal"],
  },
  {
    id: "median",
    group: "more",
    i18nKey: "database.rollup.modes.median",
    fn: "median",
    applicableTo: ["numeric"],
  },
  {
    id: "range",
    group: "more",
    i18nKey: "database.rollup.modes.range",
    fn: "range",
    applicableTo: ["numeric", "temporal"],
  },
  {
    id: "earliest",
    group: "more",
    i18nKey: "database.rollup.modes.earliest",
    // Reuse `min` over ISO-date strings (lexicographic order matches
    // chronological for `YYYY-MM-DD…`); renderer formats as a date.
    fn: "min",
    applicableTo: ["temporal"],
  },
  {
    id: "latest",
    group: "more",
    i18nKey: "database.rollup.modes.latest",
    fn: "max",
    applicableTo: ["temporal"],
  },
];

const MODE_BY_ID = new Map(ROLLUP_MODES.map((m) => [m.id, m]));

/**
 * Resolve a mode descriptor by id. Returns `null` (not throw) so the
 * settings boundary can recover from corrupted user data.
 */
export function getRollupMode(id: string): RollupModeDescriptor | null {
  return MODE_BY_ID.get(id as RollupModeId) ?? null;
}

/**
 * Filter the mode list to those applicable for a given target kind.
 * `"any"` modes are always included.
 */
export function modesForTarget(
  kind: RollupTargetKind,
): RollupModeDescriptor[] {
  return ROLLUP_MODES.filter(
    (m) => m.applicableTo.includes("any") || m.applicableTo.includes(kind),
  );
}

/**
 * Group modes for the picker (preserves canonical order within each
 * group). The empty group is omitted from the result.
 */
export function groupModes(
  modes: readonly RollupModeDescriptor[],
): Record<RollupModeGroup, RollupModeDescriptor[]> {
  const out: Record<RollupModeGroup, RollupModeDescriptor[]> = {
    show: [],
    count: [],
    percent: [],
    more: [],
  };
  for (const m of modes) {
    out[m.group].push(m);
  }
  return out;
}

/**
 * Map a coarse target-field type tag to a `RollupTargetKind`. The
 * caller has already extracted the schema field's type (string,
 * number, boolean, date, datetime, list, tags, select, status,
 * relation, formula, rollup, color).
 */
export function classifyRollupTarget(
  fieldType: string,
): RollupTargetKind {
  switch (fieldType) {
    case "number":
      return "numeric";
    case "date":
    case "datetime":
      return "temporal";
    case "boolean":
      return "boolean";
    case "string":
    case "select":
    case "status":
    case "list":
    case "tags":
    case "relation":
    case "color":
    case "formula":
    case "rollup":
      return "text";
    default:
      return "any";
  }
}

// ─────────────────────────────────────────────────────────────────
// REFACTOR-201 — R2.1b runtime invariant + fn↔mode bridge
// ─────────────────────────────────────────────────────────────────

/**
 * Default mode for a given engine `RollupFunction`. Used by the
 * settings v3 migrator to populate `RollupFieldConfig.mode` on legacy
 * saves that only persisted `function`. The picker UI is free to set
 * a more specific mode (e.g. `earliest`/`latest` reuse the `min`/`max`
 * kernels); the migrator picks the first canonical match in
 * `ROLLUP_MODES` order so behaviour is deterministic.
 *
 * Returns `null` when no mode targets the given fn (should never
 * happen for valid kernels — present as a safety net for forward-compat
 * with hypothetical future kernels added before the picker catches up).
 *
 * @since 3.4.2 (REFACTOR-201)
 */
export function defaultModeForFunction(fn: RollupFunction): RollupModeId | null {
  for (const mode of ROLLUP_MODES) {
    if (mode.fn === fn) return mode.id;
  }
  return null;
}

/**
 * R2.1b runtime invariant: `mode.fn === function` for any
 * `RollupFieldConfig` that carries both. Returns `true` when the
 * config is consistent (or when only one side is set, which is also
 * legal). Returns `false` when `mode` resolves to a different kernel
 * than the explicit `function` field, which indicates a corrupted
 * save or a buggy writer that updated one side without the other.
 *
 * Designed as a non-throwing predicate so callers can choose between
 * silent repair (writers) and hard error (tests / dev mode).
 *
 * @since 3.4.2 (REFACTOR-201)
 */
export function isRollupInvariantValid(config: {
  readonly function?: RollupFunction;
  readonly mode?: RollupModeId;
}): boolean {
  if (!config.mode || !config.function) return true;
  const desc = MODE_BY_ID.get(config.mode);
  if (!desc) return false; // unknown mode id
  if (desc.fn === null) {
    // Presentational mode (e.g. show_original). The persisted
    // `function` may be any kernel — the renderer ignores it.
    return true;
  }
  return desc.fn === config.function;
}

/**
 * Hard assertion variant used by tests and dev-mode runtime checks.
 * Throws `Error` with a descriptive message; production writers
 * should call `isRollupInvariantValid` and silently repair instead.
 *
 * @since 3.4.2 (REFACTOR-201)
 */
export function assertRollupInvariant(config: {
  readonly function?: RollupFunction;
  readonly mode?: RollupModeId;
}): void {
  if (!isRollupInvariantValid(config)) {
    throw new Error(
      `R2.1b violation: rollup mode=${String(config.mode)} ` +
        `does not match function=${String(config.function)}`,
    );
  }
}

