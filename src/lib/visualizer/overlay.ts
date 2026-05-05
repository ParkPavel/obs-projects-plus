/**
 * R1.2 — Per-note Visualizer overlay
 *
 * The overlay is stored under the reserved frontmatter key `pp_overlay`
 * (see Revision 3 §7 decision). It must never collide with user data:
 *  - The key is namespaced (`pp_*`).
 *  - Unknown / extra fields in `pp_overlay` are preserved on round-trip.
 *  - All operations are pure; persistence happens in `overlayWriter.ts`.
 *
 * Shape:
 *   pp_overlay:
 *     hidden:  string[]   # property keys hidden from the pane
 *     pinned:  string[]   # property keys floated to the top, in order
 *     order:   string[]   # explicit ordering for the remaining keys
 *
 * Any of the three lists may be absent / empty.
 */

export const OVERLAY_KEY = "pp_overlay";

export interface NoteOverlay {
  hidden: string[];
  pinned: string[];
  order: string[];
}

export interface OverlayedEntry {
  key: string;
  value: unknown;
  pinned: boolean;
  hidden: boolean;
}

const EMPTY: NoteOverlay = Object.freeze({
  hidden: [],
  pinned: [],
  order: [],
}) as NoteOverlay;

/** Sanitize an unknown value into a `string[]`, dropping non-strings. */
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string" && item.length > 0) out.push(item);
  }
  return out;
}

/**
 * Read an overlay from a frontmatter blob. Tolerates malformed input —
 * unknown shapes degrade to the empty overlay rather than throwing.
 */
export function readOverlay(
  frontmatter: Record<string, unknown> | null | undefined,
): NoteOverlay {
  if (!frontmatter) return { ...EMPTY };
  const raw = frontmatter[OVERLAY_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY };
  const obj = raw as Record<string, unknown>;
  return {
    hidden: asStringArray(obj["hidden"]),
    pinned: asStringArray(obj["pinned"]),
    order: asStringArray(obj["order"]),
  };
}

/**
 * Apply an overlay to the live frontmatter entries.
 *
 * Resolution rules:
 *  1. Drop `pp_overlay` itself and any other reserved `$*` / `pp_*` system
 *     keys.
 *  2. Pinned keys come first, in the order listed in `overlay.pinned`,
 *     ignoring any pinned key that is also hidden or absent from data.
 *  3. Remaining keys honour `overlay.order`, then preserve original
 *     frontmatter insertion order for keys not in `order`.
 *  4. `showHidden = false` (default) drops keys listed in `overlay.hidden`.
 *     When `showHidden = true` they are appended at the end with
 *     `hidden: true` flag (so the UI can render them dimmed).
 */
export function applyOverlay(
  frontmatter: Record<string, unknown> | null | undefined,
  overlay: NoteOverlay,
  options: { showHidden?: boolean } = {},
): OverlayedEntry[] {
  if (!frontmatter) return [];
  const showHidden = options.showHidden ?? false;

  const allKeys = Object.keys(frontmatter).filter(
    (k) => k !== OVERLAY_KEY && !k.startsWith("$"),
  );
  const present = new Set(allKeys);
  const hiddenSet = new Set(overlay.hidden);
  const pinnedSet = new Set(overlay.pinned);

  const result: OverlayedEntry[] = [];

  // 1. Pinned (in declared order; skip hidden / missing).
  for (const key of overlay.pinned) {
    if (!present.has(key)) continue;
    if (hiddenSet.has(key)) continue;
    result.push({
      key,
      value: frontmatter[key],
      pinned: true,
      hidden: false,
    });
  }

  // 2. Ordered non-pinned, non-hidden, present.
  const seen = new Set(result.map((e) => e.key));
  for (const key of overlay.order) {
    if (seen.has(key)) continue;
    if (!present.has(key)) continue;
    if (pinnedSet.has(key)) continue;
    if (hiddenSet.has(key)) continue;
    result.push({
      key,
      value: frontmatter[key],
      pinned: false,
      hidden: false,
    });
    seen.add(key);
  }

  // 3. Remaining keys in original insertion order.
  for (const key of allKeys) {
    if (seen.has(key)) continue;
    if (hiddenSet.has(key)) continue;
    result.push({
      key,
      value: frontmatter[key],
      pinned: pinnedSet.has(key),
      hidden: false,
    });
    seen.add(key);
  }

  // 4. Hidden keys appended last (only if `showHidden`).
  if (showHidden) {
    for (const key of allKeys) {
      if (seen.has(key)) continue;
      // remaining = hidden ones
      result.push({
        key,
        value: frontmatter[key],
        pinned: false,
        hidden: true,
      });
      seen.add(key);
    }
  }

  return result;
}

/**
 * Pure mutators — produce a new overlay reflecting the requested change.
 * Each one is idempotent and never throws.
 */

export function toggleHidden(overlay: NoteOverlay, key: string): NoteOverlay {
  const hidden = new Set(overlay.hidden);
  if (hidden.has(key)) hidden.delete(key);
  else hidden.add(key);
  // Hiding a pinned key un-pins it (UX: hidden keys are not shown anyway).
  const pinned = overlay.pinned.filter((k) => !(hidden.has(k) && k === key));
  return {
    ...overlay,
    hidden: Array.from(hidden),
    pinned,
  };
}

export function togglePinned(overlay: NoteOverlay, key: string): NoteOverlay {
  const pinned = overlay.pinned.includes(key)
    ? overlay.pinned.filter((k) => k !== key)
    : [...overlay.pinned, key];
  // Pinning a hidden key un-hides it.
  const hidden = overlay.hidden.filter((k) => k !== key);
  return { ...overlay, pinned, hidden };
}

/**
 * Move a key one slot up/down within the *current* visible ordering.
 * `currentOrder` is the resolved list of visible keys (pinned first, then
 * the rest), as the user sees them. We only mutate `overlay.order` when
 * the moved key is in the non-pinned region; pinned reorders mutate
 * `overlay.pinned` instead.
 */
export function moveKey(
  overlay: NoteOverlay,
  currentOrder: string[],
  key: string,
  direction: -1 | 1,
): NoteOverlay {
  const idx = currentOrder.indexOf(key);
  if (idx < 0) return overlay;
  const target = idx + direction;
  if (target < 0 || target >= currentOrder.length) return overlay;

  const swapWith = currentOrder[target];
  if (typeof swapWith !== "string") return overlay;

  const pinnedSet = new Set(overlay.pinned);
  const isPinned = pinnedSet.has(key);
  const swapPinned = pinnedSet.has(swapWith);

  // Cross-region swaps are no-ops: pinned and unpinned have separate orderings.
  if (isPinned !== swapPinned) return overlay;

  if (isPinned) {
    const pinned = [...overlay.pinned];
    const a = pinned.indexOf(key);
    const b = pinned.indexOf(swapWith);
    if (a < 0 || b < 0) return overlay;
    [pinned[a], pinned[b]] = [pinned[b]!, pinned[a]!];
    return { ...overlay, pinned };
  }

  // Non-pinned: ensure both keys are represented in `order`, then swap.
  const order = overlay.order.includes(key) || overlay.order.includes(swapWith)
    ? [...overlay.order]
    : [...currentOrder.filter((k) => !pinnedSet.has(k))];

  const a = order.indexOf(key);
  const b = order.indexOf(swapWith);
  if (a < 0) order.push(key);
  if (b < 0) order.push(swapWith);
  const a2 = order.indexOf(key);
  const b2 = order.indexOf(swapWith);
  if (a2 >= 0 && b2 >= 0) {
    [order[a2], order[b2]] = [order[b2]!, order[a2]!];
  }
  return { ...overlay, order };
}

/**
 * Strip empty arrays so we don't write back redundant YAML structure.
 * Returns `null` when the overlay is fully empty (caller should remove
 * the `pp_overlay` key entirely).
 */
export function compactOverlay(
  overlay: NoteOverlay,
): Partial<NoteOverlay> | null {
  const out: Partial<NoteOverlay> = {};
  if (overlay.hidden.length > 0) out.hidden = overlay.hidden;
  if (overlay.pinned.length > 0) out.pinned = overlay.pinned;
  if (overlay.order.length > 0) out.order = overlay.order;
  return Object.keys(out).length === 0 ? null : out;
}

/** True iff the overlay carries no information. */
export function isEmptyOverlay(overlay: NoteOverlay): boolean {
  return (
    overlay.hidden.length === 0 &&
    overlay.pinned.length === 0 &&
    overlay.order.length === 0
  );
}
