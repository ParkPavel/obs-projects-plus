/**
 * Resolving a saved filter that lives among a project's sources (#170 step 2).
 *
 * ## Where this runs, and why it is not negotiable
 *
 * Every other source acquires records from the vault. This one narrows records
 * the project already has, and it runs at **axis A of the consuming view, over
 * the enriched frame** — after relations are resolved and rollups computed.
 *
 * The alternative was tried on paper and refuted at Gate 0: resolving it in the
 * datasource layer makes it an acquisition filter, and `FILTER_MODEL.md` says
 * plainly that those run before a frame exists. A saved filter whose condition
 * names a rollup — "clients whose last session was more than two weeks ago",
 * the essay's own example — would then match nothing at all, silently. That
 * killed revision 1 of the brief, and `__tests__/derivedSource.test.ts` pins
 * it so it cannot return as an optimisation.
 *
 * ## Three states, not two
 *
 * A filter that matches nothing and a filter that is broken look identical on
 * screen — an empty table — and they need opposite reactions from the user. So
 * they are different values here, and the caller is expected to render them
 * differently. `pending` exists because the enriched frame arrives after the
 * external frames it needs, and an empty table shown during that window would
 * be a third thing wearing the same face.
 */

import type { DataFrame } from "src/lib/dataframe/dataframe";
import { applyFilter } from "src/lib/engine/filterEvaluator";
import type { DerivedDataSource } from "src/settings/v3/settings";

import type { IdentifiedFrame } from "./sourceSelection";

export type DerivedResolution =
  /** Narrowed, with records in it. */
  | { readonly kind: "ok"; readonly frame: DataFrame }
  /** Narrowed correctly, and nothing matched. A real answer, not a failure. */
  | { readonly kind: "empty"; readonly frame: DataFrame }
  /** Cannot be narrowed: what it reads from is gone. */
  | { readonly kind: "broken"; readonly reason: string }
  /** The frame it reads from has not arrived yet. */
  | { readonly kind: "pending" };

export interface DerivedInput {
  /** The project's whole frame, ENRICHED. `undefined` while it loads. */
  readonly enriched: DataFrame | undefined;
  /** Per-source frames, for a derived source that narrows one of them. */
  readonly parts: readonly IdentifiedFrame[];
}

/**
 * Narrow `from` by `where`.
 *
 * `from: "project"` reads the whole enriched frame; anything else names a
 * sibling source by id. A name that resolves to nothing is BROKEN and says
 * which name failed — a saved filter reading a source someone deleted is a
 * configuration the user can fix, and telling them "0 records" instead would
 * send them to look at their data.
 */
export function resolveDerived(
  derived: DerivedDataSource,
  input: DerivedInput
): DerivedResolution {
  const { from, where } = derived.config;

  if (input.enriched === undefined) return { kind: "pending" };

  let base: DataFrame;
  if (from === "project") {
    base = input.enriched;
  } else {
    const part = input.parts.find((p) => p.id === from);
    if (!part) {
      return {
        kind: "broken",
        reason: `reads from a source that no longer exists (${from})`,
      };
    }
    // The part carries acquired records; the enrichment lives on the project
    // frame. Narrowing the part directly would lose the derived columns the
    // filter may name, so the enriched rows are selected by the part's ids —
    // the same records, with everything the pipeline added to them.
    const ids = new Set(part.frame.records.map((r) => r.id));
    base = {
      fields: input.enriched.fields,
      records: input.enriched.records.filter((r) => ids.has(r.id)),
    };
  }

  const frame = applyFilter(base, where);
  return frame.records.length > 0 ? { kind: "ok", frame } : { kind: "empty", frame };
}

/** Every derived source declared on a project, in stored order. */
export function derivedSources(
  sources: readonly { readonly kind: string }[]
): DerivedDataSource[] {
  return sources.filter((s): s is DerivedDataSource => s.kind === "derived");
}

/**
 * Whether a source is one the datasource layer should try to ACQUIRE.
 *
 * A derived source must never reach `createDataSource`: it has no vault query
 * to run, and letting it fall through to "unresolvable" would work by accident
 * rather than by intent — the kind of thing that survives until someone adds a
 * default branch.
 */
export function isAcquirable(source: { readonly kind: string }): boolean {
  return source.kind !== "derived";
}
