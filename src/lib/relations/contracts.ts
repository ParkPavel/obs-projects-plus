/**
 * Canonical type contracts for the relations layer (v4.0 / Layer 0).
 *
 * NORMATIVE source of truth for cross-record / cross-SubBase relation
 * resolution and inverse indexing.
 *
 * Per ARCHITECTURE_V4 §3.2 and PHASE_3_TICKETS REFACTOR-006:
 *   - Types ONLY. Zero runtime code. Zero side effects.
 *   - No circular imports.
 *   - Consumer migrations land in REFACTOR-204 (cross-SubBase resolver),
 *     REFACTOR-105 (wiki-link unify), REFACTOR-107 (coverage gap fill).
 *
 * @since 4.0
 * @see docs/ARCHITECTURE_V4.md §3
 * @see docs/PHASE_3_TICKETS.md REFACTOR-006
 */

import type { ProjectId, RecordId } from "src/lib/engine/contracts";

export type { ProjectId, RecordId };

/**
 * Discriminator for the kind of relation being expressed.
 *
 * `"row"` is the only kind in v4.0; `"property"` is reserved for a future
 * property↔property relation (e.g. computed-from-formula references).
 */
export type RelationKind = "row" | "property";

/**
 * One directed edge in the relation graph.
 *
 * The semantics of a `RelationRef` are:
 *   "the field `sourceField` on record (`sourceProjectId`,
 *    `sourceRecordId`) points at record (`target.projectId`,
 *    `target.recordId`)."
 *
 * The relation index keyed on `target.recordId` yields the **inverse**
 * (back-reference) view: every place a given record is referenced from.
 */
export interface RelationRef {
  readonly type: RelationKind;
  readonly sourceProjectId: ProjectId;
  readonly sourceRecordId: RecordId;
  readonly sourceField: string;
  readonly target: {
    readonly projectId: ProjectId;
    readonly recordId: RecordId;
  };
}

/**
 * Minimal record shape consumed by the index for `rebuild()`.
 * Concrete records (`DataRecord`) satisfy this shape structurally.
 */
export interface RelationIndexableRecord {
  readonly id: RecordId;
  readonly values: Readonly<Record<string, unknown>>;
}

/**
 * Vault-scoped relation index.
 *
 * Implementations must guarantee:
 *   - `forward(id, field)` is O(1) average lookup.
 *   - `inverse(id)` is O(1) average lookup over the back-reference set.
 *   - `rebuild(records)` is at most O(n × avg-relation-fields-per-record).
 *   - `invalidate(id)` removes both forward and inverse entries for the
 *     given source record id (NOT the target side).
 */
export interface RelationIndex {
  /** Outgoing relations from a single source record/field. */
  forward(sourceRecordId: RecordId, field: string): readonly RelationRef[];

  /** All incoming relations pointing AT a target record. */
  inverse(targetRecordId: RecordId): readonly RelationRef[];

  /** Full rebuild from scratch; idempotent. */
  rebuild(records: readonly RelationIndexableRecord[]): void;

  /** Drop forward entries originating from this record id. */
  invalidate(recordId: RecordId): void;
}
