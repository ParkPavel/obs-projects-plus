// w4-p01b — a base's computed columns, in dependency order.
//
// The formulas no rollup feeds run first, then the rollups — which may read
// those formulas (a client's "paid" sums its visits' `IF(paid, price, 0)`) —
// then the formulas that read a rollup, directly or through another formula.
// Before, every formula ran after the rollups, so a rollup over a formula of
// its own project read an empty column, and the demo kept such values as fixed
// numbers in the notes instead (acceptance 26.10, N4).
//
// The view (View.svelte) and a project read as another's target
// (externalFrameResolver.ts) both compute through here, so the order is the
// same wherever a frame is enriched.

import type { DataFrame } from "src/lib/dataframe/dataframe";
import { applyFormulaFields, referencedNames } from "src/lib/dashboard-engine/applyFormulaFields";
import { resolveFieldName } from "src/lib/formula/formulaErrors";
import { formulaPropertiesOf, type DeclaredRelations } from "./declaredFieldTypes";
import type { FieldConfigRelationMap } from "./relationTargets";
import { applyRollupColumns } from "./rollupColumns";

/**
 * The formulas to compute after the rollups: those that read a rollup, or a
 * formula that does. Everything else is computed before them. Stored order is
 * kept within each part; `applyFormulaFields` orders by dependency itself.
 */
export function splitFormulasAroundRollups<T extends { name: string; expression: string; formulaVersion?: string }>(
  defs: readonly T[],
  rollupNames: ReadonlySet<string>
): { before: T[]; after: T[] } {
  const names = [...defs.map((d) => d.name), ...rollupNames];
  const refs = new Map(defs.map((d) => [d.name, referencedNames(d.expression, d.formulaVersion)]));
  const late = new Set<string>(rollupNames);
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of defs) {
      if (late.has(d.name)) continue;
      const readsLate = (refs.get(d.name) ?? []).some((ref) => {
        const target = resolveFieldName(ref, names);
        return target !== undefined && target !== d.name && late.has(target);
      });
      if (readsLate) {
        late.add(d.name);
        grew = true;
      }
    }
  }
  return { before: defs.filter((d) => !late.has(d.name)), after: defs.filter((d) => late.has(d.name)) };
}

/** The base's formula and rollup columns folded into `frame`. */
export function applyComputedColumns(
  frame: DataFrame,
  fieldConfig: (FieldConfigRelationMap & DeclaredRelations) | undefined,
  projectId: string,
  externalFrames: ReadonlyMap<string, DataFrame>
): DataFrame {
  const formulas = formulaPropertiesOf(fieldConfig);
  const rollups = new Set(
    Object.entries(fieldConfig ?? {})
      .filter(([, cfg]) => !!(cfg as { rollup?: unknown } | undefined)?.rollup)
      .map(([name]) => name)
  );
  const { before, after } = splitFormulasAroundRollups(formulas, rollups);
  return applyFormulaFields(
    applyRollupColumns(applyFormulaFields(frame, before), fieldConfig, projectId, externalFrames),
    after
  );
}
