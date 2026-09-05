// dataScope.ts — #194.
//
// The WRITE side of the data scope, and the notice the host shows when the
// scope cannot be resolved. Both are pure functions of values the host already
// has, which is what lets them be asserted without mounting anything: the
// reader (`resolveNamedSource`) has been unit-tested since #170 and the writer
// existed only as an inline expression inside one Svelte panel.

import type { WidgetSourceConfig, WidgetType } from "../types";
import type { NamedSourceView } from "src/lib/datasources/namedSource";
import { namedSourceNotice, type NamedSourceNotice } from "./DatabaseCall/namedSourceNotice";
import { hasDataScope } from "./headerChrome";

/**
 * The next `sourceConfig` after the user picks a scope. `""` means "all".
 *
 * An empty scope REMOVES the key — it does not store `""`, and it does not
 * store a present-but-undefined property. Two reasons, and the second is the
 * one that constrains the shape of this function:
 *
 *  - An absent `sourceId` is what every config written before #170 has, and
 *    `resolveNamedSource` guarantees such a config gets the merge frame BY
 *    REFERENCE. "Never narrowed" and "narrowed and then un-narrowed" have to be
 *    the same state, in the file as well as in the resolver.
 *  - `exactOptionalPropertyTypes` refuses `{ sourceId: undefined }` outright,
 *    and suppressing a type error is forbidden by invariant 1 — which the
 *    `check-ts-ignore` hook enforces by scanning for the literal, so even this
 *    sentence must not spell it. The key is deleted off the next object rather
 *    than assigned away — the shape `DatabaseCallSettings` has used since #184.
 *
 * A widget that never carried a `sourceConfig` gains one, with an inert
 * `projectId: ""`. That is harmless — `resolveDbCallView` honours `projectId`
 * only for `database-call` — and it is the already-shipped spelling of "this
 * view's data". Recorded here rather than discovered in a data file later.
 */
export function applyDataScope(
  current: WidgetSourceConfig | undefined,
  sourceId: string
): WidgetSourceConfig {
  const next: { projectId: string; sourceId?: string } = { ...(current ?? { projectId: "" }) };
  if (sourceId) next.sourceId = sourceId;
  else delete next.sourceId;
  return next;
}

/**
 * What the HOST must say about a scope it could not resolve, or `null`.
 *
 * The defect this closes was worse than the one the ticket was filed for.
 * `hostFrames` falls back to the whole project when a named source is
 * `broken`, and the notice explaining that reached exactly two registry
 * entries — `data-table` and `database-call`, both of which render through
 * `DatabaseCallBlock`, which calls `namedSourceNotice` itself. For a chart,
 * "the source was deleted" was therefore indistinguishable from "no source was
 * ever named": it silently drew the whole project's numbers, which are
 * plausible and wrong. Plausible and wrong is worse than empty.
 *
 * Two exclusions, both of which mean something:
 *
 *  - The two blocks above get `null`, because they already show it INSIDE their
 *    own chrome. A second copy above them would be the same sentence twice.
 *  - Only `screen` notices come back. `empty` is a real answer and its
 *    placement is `hint` — it belongs under a block's own empty state, not
 *    instead of the block. That distinction is the reason `placement` exists.
 */
export function hostSourceNotice(
  type: WidgetType,
  view: NamedSourceView
): NamedSourceNotice | null {
  if (!hasDataScope(type)) return null;
  if (type === "data-table" || type === "database-call") return null;
  const notice = namedSourceNotice(view);
  return notice && notice.placement === "screen" ? notice : null;
}
