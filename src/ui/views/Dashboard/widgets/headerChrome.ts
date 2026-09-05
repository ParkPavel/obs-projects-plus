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

/**
 * #194 — whether a type shows the «Data scope» control.
 *
 * The rule, in the shape #169 established for `primaryActionFor`: a widget has
 * a data scope IF AND ONLY IF it derives what it shows from the frame it was
 * handed. Mechanically checkable against `WIDGET_CONTENT` — the type has an
 * entry and its props builder passes a frame — but written out by hand, for the
 * reason this module exists at all: deriving it from the registry would import
 * the whole widget graph to answer a question about a string.
 *
 * `sourceId` was already honoured for EVERY type by `hostFrames`, ahead of any
 * gate; only `database-call` offered a way to set it. So this predicate decides
 * where the CONTROL appears, never where the value is read, and the six answers
 * below are the types for which the value already does something.
 *
 * `filter-tabs` is a yes, and saying so out loud is the point: it derives the
 * TABS from its frame, so narrowing it decides what the rest of the canvas can
 * then be narrowed by. The rule is mechanical and excluding it would be a
 * special case with no argument behind it.
 *
 * `cover-banner`, `text` and `divider` are a no because no frame reaches them —
 * the registry hands them `config` alone. The retired legacy types render a
 * placeholder, and a picker on a placeholder is chrome on a headstone.
 */
export function hasDataScope(type: WidgetType): boolean {
  return (
    type === "data-table" ||
    type === "database-call" ||
    type === "chart" ||
    type === "stats" ||
    type === "checklist" ||
    type === "filter-tabs"
  );
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
 * the action itself. `data-table` already ships the creation interaction the
 * user reaches — the inline «+ New» row, and the empty block's own modal — and
 * calling `createNamedRecord` from the header would add a second one that
 * behaves differently from the first. One block, one way in.
 *
 * `database-call` is deliberately NOT here, and the reason is the same rule
 * read properly rather than a limitation. It hosts Board, Calendar and Gallery
 * tabs, and each of those creates a record WITH the context of what you are
 * looking at: a board column's value, the day you clicked, the gallery's
 * active filter. A header button stands outside all of that and can supply
 * none of it — on a Calendar tab it would write a record with no date, which
 * then does not appear in the calendar that made it. The view owns creation
 * there, and offering a shortcut that lands somewhere else is worse than
 * offering none. `data-table` has no such question: it is always exactly one
 * table tab (`restoreDataTableConfig`), and the inline row needs no context.
 */
export function primaryActionFor(type: WidgetType): PrimaryAction | null {
  if (type === "data-table") {
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
