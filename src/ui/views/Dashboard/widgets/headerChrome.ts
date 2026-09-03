// headerChrome.ts — #169.
//
// Which chrome a widget type's header shows: the transform-pipeline button, and
// the block's own primary action.
//
// Split out of `widgetComponentRegistry` so it can be reasoned about — and
// tested — on its own. The registry maps a type to a COMPONENT, so importing it
// pulls the whole widget graph (and, through BoardView, a modal that cannot be
// constructed in a unit test). These are answers about a string, and they
// should cost a string's worth of imports.

import type { WidgetType } from "../types";

/** Types whose header shows the transform-pipeline button. */
export function hasPipelineButton(type: WidgetType): boolean {
  return type !== "data-table" && type !== "text" && type !== "divider";
}

/** The label of a widget type's own primary action, or `null` if it has none. */
export interface PrimaryAction {
  readonly labelKey: string;
  readonly labelDefault: string;
}

/**
 * #169 — the block's own action, at header weight.
 *
 * The rule, from the design spec: a widget has a primary action only if it
 * CREATES OR APPENDS the thing the user reads that block for. Filtering,
 * sorting, display config and navigation never qualify. So `chart` and `stats`
 * returning `null` is the answer and not a gap — their contents are computed
 * from other records, never authored in place, and giving them an "add"
 * button would promise a record they cannot hold.
 *
 * The host resolves the LABEL here and dispatches a signal; it must never run
 * the action itself. Both table-shaped types already ship a creation
 * interaction the user reaches — the inline «+ New» row, and the modal on an
 * empty block — and calling `createNamedRecord` from the header would add a
 * second one that behaves differently from the first. One block, one way in.
 */
export function primaryActionFor(type: WidgetType): PrimaryAction | null {
  if (type === "data-table" || type === "database-call") {
    return {
      labelKey: "views.dashboard.widget.primary.add-record",
      labelDefault: "Add record",
    };
  }
  // `checklist` appends items and so qualifies by the rule above, but its add
  // path was not read in the pass that wrote this, and wiring a button to an
  // interaction nobody has opened is how a header promises what it cannot do.
  // It is one commit away, not a design question.
  return null;
}
