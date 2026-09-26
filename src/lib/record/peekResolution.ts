/**
 * peekResolution — #158 (L2/L3): look the peeked record up by identity on
 * every tick, instead of carrying a copy that a re-render could hand back to
 * the editor as if it were fresh (N1).
 *
 * Pure by construction: `View.svelte` supplies the frames this already has
 * (its own `sortedFrame`, and whatever `api.resolveExternalFrame` has settled
 * for the target's `projectId`), and this module only looks the id up in the
 * right one and decides whether the result may be written back.
 */

import type { DataField, DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import type { PeekTarget } from "src/lib/stores/recordPeek";

export type PeekResolution =
  | { readonly kind: "loading" }
  | { readonly kind: "absent" }
  | {
      readonly kind: "ready";
      readonly record: DataRecord;
      readonly fields: DataField[];
      readonly writable: boolean;
    };

export interface PeekResolutionContext {
  /** Whether the hosting view itself is read-only. */
  readonly viewReadonly: boolean;
  /** This view's own, current frame — `sortedFrame`, not the raw one. */
  readonly ownFrame: DataFrame;
  /** `ViewApi.dataSource.includes` — D-3, enforced here even if a future caller forgets the flag. */
  readonly dataSourceIncludes: (id: string) => boolean;
  /**
   * The state of `target.projectId`'s frame, when the target names one.
   * `undefined` — not resolved yet (the fetch is in flight or has not
   * started) — resolves to `loading`. `null` — the resolver could not
   * produce a frame at all — resolves to `absent`, same as a frame that
   * simply does not contain the id.
   */
  readonly externalFrame?: DataFrame | null | undefined;
}

export function resolvePeek(
  target: PeekTarget,
  ctx: PeekResolutionContext
): PeekResolution {
  if (target.projectId !== undefined) {
    if (ctx.externalFrame === undefined) return { kind: "loading" };
    if (ctx.externalFrame === null) return { kind: "absent" };
    const record = ctx.externalFrame.records.find((r) => r.id === target.id);
    if (!record) return { kind: "absent" };
    // D-3: an external-source record is read-only in the peek, full stop —
    // not merely defaulted, so a caller that forgets `target.readonly`
    // cannot accidentally make one writable.
    return { kind: "ready", record, fields: ctx.externalFrame.fields, writable: false };
  }

  const record = ctx.ownFrame.records.find((r) => r.id === target.id);
  if (!record) return { kind: "absent" };
  const writable =
    !ctx.viewReadonly && !target.readonly && ctx.dataSourceIncludes(target.id);
  return { kind: "ready", record, fields: ctx.ownFrame.fields, writable };
}

/**
 * Who may save through the peek. Held across the close, so the save EditNote
 * flushes while it is destroyed still lands: closing within the autosave
 * debounce lost the edit when the view dropped `onSave` first (Codex review
 * of e9a4329, P1). Only for the record it was granted for, and an open
 * read-only record revokes it.
 */
export interface PeekSaveAuthority {
  readonly id: string;
  readonly fields: DataField[];
}

export function nextSaveAuthority(
  prev: PeekSaveAuthority | null,
  peekedId: string | null,
  writable: boolean,
  fields: DataField[]
): PeekSaveAuthority | null {
  if (peekedId === null) return prev; // closing: the flush may still come
  return writable ? { id: peekedId, fields } : null;
}

export function mayPeekSave(
  authority: PeekSaveAuthority | null,
  recordId: string
): authority is PeekSaveAuthority {
  return authority !== null && authority.id === recordId;
}
