/**
 * relationFilterAdapter — #106 (Selection Bus Scenario A fix).
 *
 * The canvas Selection Bus composes a linked-selection condition of the shape
 * `{ field: relationField, operator: "is" | "is-any-of", value: <selection> }`
 * (see `canvasSelectionStore.composeLinkedSelectionFilter`). When the master
 * row carries a Relation field, the stored cell value is a wikilink
 * (`"[[Acme Studio]]"`) while the selection value is the bare display name
 * (`"Acme Studio"`). Feeding that straight into the canonical
 * `matchesCondition` compares `"[[Acme Studio]]" == "Acme Studio"` → no match,
 * which is exactly the Scenario A regression reported in
 * `TEST_REPORT_2026-06-26.md` (Дефект 2).
 *
 * This adapter sits ONLY on the linked-selection path. It does not introduce a
 * parallel filter engine (invariant #7): for Relation fields it normalises both
 * sides to the canonical relation key and then delegates the actual decision to
 * `matchesCondition`; for every other field type it is a pure passthrough to
 * `matchesCondition`, preserving the existing case-sensitivity of Select/Status
 * and the Scenario B (chart → stats) parity.
 *
 * Pure — no mutation of `record.values`, no I/O.
 */

import {
  DataFieldType,
  type DataField,
  type DataRecord,
} from "src/lib/dataframe/dataframe";
import type { FilterCondition } from "src/settings/settings";
import { matchesCondition } from "src/lib/engine/filterEvaluator";
import {
  parseRelationLinks,
  canonicalLinkKey,
} from "src/lib/relations/parseRelationLinks";

/**
 * Normalise the condition's right-hand side to canonical relation keys.
 *
 *  - `is-any-of`: `cond.value` is a JSON-encoded `string[]`; canonicalise each
 *    candidate and re-encode.
 *  - everything else (`is`, …): canonicalise the scalar value in place.
 */
function normalizeRelationCondition(cond: FilterCondition): FilterCondition {
  if (cond.operator === "is-any-of") {
    let candidates: string[];
    try {
      candidates = cond.value ? (JSON.parse(cond.value) as string[]) : [];
    } catch {
      candidates = [];
    }
    return {
      ...cond,
      value: JSON.stringify(candidates.map((c) => canonicalLinkKey(String(c)))),
    };
  }
  if (cond.value === undefined) return cond;
  return { ...cond, value: canonicalLinkKey(cond.value) };
}

/**
 * Filter `records` by a single linked-selection condition.
 *
 * Relation field → normalise record cell (via `parseRelationLinks`) and
 * condition (via `canonicalLinkKey`) to canonical keys, then delegate to
 * `matchesCondition`. Any other field → passthrough to `matchesCondition`
 * unchanged.
 */
export function filterByLinkedSelection(
  records: ReadonlyArray<DataRecord>,
  cond: FilterCondition,
  fields: ReadonlyArray<DataField>
): DataRecord[] {
  const field = fields.find((f) => f.name === cond.field);

  if (!field || field.type !== DataFieldType.Relation) {
    return records.filter((r) => matchesCondition(cond, r));
  }

  const normalizedCond = normalizeRelationCondition(cond);

  return records.filter((r) => {
    const normalized = parseRelationLinks(r.values[cond.field]).map((link) =>
      canonicalLinkKey(link)
    );
    const synthetic: DataRecord = {
      ...r,
      values: { ...r.values, [cond.field]: normalized },
    };
    return matchesCondition(normalizedCond, synthetic);
  });
}
