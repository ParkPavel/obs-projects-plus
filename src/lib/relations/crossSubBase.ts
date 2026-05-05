/**
 * Cross-SubBase relation resolver (REFACTOR-204).
 *
 * Per ARCHITECTURE_V4 Phase 2 §3.3 and decision-log D-005:
 *   "cross-SubBase relation lookup = parent index forward + SubBase
 *    predicate filter."
 *
 * SubBases are derivable views over a single parent DataFrame, not
 * separate record stores. A relation that points to a record visible
 * in SubBase X means: (a) resolve the wikilink against the parent
 * frame's index, then (b) keep only those targets that satisfy SubBase
 * X's filter. This avoids the O(N×M) per-SubBase index proliferation
 * that a literal "one frame per SubBase" implementation would need.
 *
 * Three scenarios are first-class:
 *   - same-base       : source and targets in the same SubBase X
 *   - cross-base      : source and targets in different parent projects
 *                       (delegated to `crossProjectResolver`)
 *   - cross-SubBase   : source in SubBase X, targets in SubBase Y of the
 *                       same parent project
 *
 * @since 4.0 (REFACTOR-204)
 */

import type {
  DataFrame,
  DataRecord,
  DataValue,
  Optional,
} from "src/lib/dataframe/dataframe";
import type { SubBaseDefinition, SubBaseId } from "src/lib/database/subBase";
import { applyFilter } from "src/lib/engine/filterEvaluator";
import { stripToPath as kernelStripToPath } from "src/lib/engine/wikilink";

// ── Index ────────────────────────────────────────────────

/** Lowercased lookup index: display key → record. */
export type ParentIndex = Map<string, DataRecord>;

/**
 * Build a single index over the parent frame. SubBase membership is
 * computed lazily by re-running each SubBase's filter against the
 * resolved targets — never by maintaining a per-SubBase shadow index.
 */
export function buildParentIndex(frame: DataFrame): ParentIndex {
  const idx: ParentIndex = new Map();
  for (const r of frame.records) {
    const base = extractBaseName(r.id);
    if (base) idx.set(base.toLowerCase(), r);
    for (const f of ["name", "title", "Name", "Title"]) {
      const v = r.values[f];
      if (typeof v === "string" && v) idx.set(v.toLowerCase(), r);
    }
  }
  return idx;
}

function extractBaseName(path: string): string {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

// ── Resolution ───────────────────────────────────────────

/**
 * Normalise one relation field value into wikilink bodies (path with
 * alias and heading stripped). Returns `[]` for nullish input.
 */
function toLinkBodies(value: Optional<DataValue>): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") {
    const body = kernelStripToPath(value);
    return body ? [body] : [];
  }
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      if (typeof item !== "string") continue;
      const body = kernelStripToPath(item);
      if (body) out.push(body);
    }
    return out;
  }
  return [];
}

/**
 * Resolve a relation value against the parent index.
 * Unresolved wikilinks are silently dropped (caller can compare counts
 * if it needs to surface "missing target" diagnostics).
 */
export function resolveTargets(
  value: Optional<DataValue>,
  index: ParentIndex,
): DataRecord[] {
  const out: DataRecord[] = [];
  for (const body of toLinkBodies(value)) {
    const r = index.get(body.toLowerCase());
    if (r) out.push(r);
  }
  return out;
}

// ── Cross-SubBase partitioning ───────────────────────────

export interface CrossSubBaseResult {
  /** SubBase the targets belong to. */
  readonly subBaseId: SubBaseId;
  /** Targets resolved from the source value AND passing this SubBase's filter. */
  readonly targets: DataRecord[];
}

/**
 * For a single source record's relation value, return the resolved
 * targets partitioned across the supplied SubBases. A single target
 * may appear in multiple result entries when SubBase filters overlap
 * (matches `partitionBySubBases` semantics — see R2.2).
 */
export function resolveAcrossSubBases(
  value: Optional<DataValue>,
  parentFrame: DataFrame,
  subBases: readonly SubBaseDefinition[],
  index?: ParentIndex,
): CrossSubBaseResult[] {
  const idx = index ?? buildParentIndex(parentFrame);
  const targets = resolveTargets(value, idx);
  if (targets.length === 0) {
    return subBases.map((sb) => ({ subBaseId: sb.id, targets: [] }));
  }
  // Wrap targets in a synthetic frame so we can reuse `applyFilter`
  // verbatim — keeps SubBase filter semantics (R2.1c, etc.) in lockstep
  // with the canonical filterEvaluator kernel.
  const candidateFrame: DataFrame = {
    fields: parentFrame.fields,
    records: targets,
  };
  return subBases.map((sb) => ({
    subBaseId: sb.id,
    targets: applyFilter(candidateFrame, sb.filter).records,
  }));
}

/**
 * Convenience wrapper for the same-base case (no SubBase split).
 * Equivalent to `resolveTargets(value, buildParentIndex(parentFrame))`
 * but exported under a name that matches the ticket's three-scenario
 * vocabulary.
 */
export function resolveWithinBase(
  value: Optional<DataValue>,
  parentFrame: DataFrame,
  index?: ParentIndex,
): DataRecord[] {
  return resolveTargets(value, index ?? buildParentIndex(parentFrame));
}
