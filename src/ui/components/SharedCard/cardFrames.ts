/**
 * cards-g5 — saved card frames, the one reading of them.
 *
 * A gallery or board view config may carry a view-wide frame (`cardFrame`)
 * and per-card overrides (`cardFramesByRecord`, keyed by record id, which is
 * the note's path). Both live only in the view config: no frontmatter is
 * written, and nothing here prunes the map against the records a view shows —
 * a view receives filtered records, so pruning there would erase the frames of
 * the cards a filter hides.
 *
 * Every place that renders, edits or resets a frame reads it through
 * `normalizeCardFrames`, so "absent", "legacy" and "nonsense" have one answer:
 * a non-numeric or non-finite value is dropped, a number is clamped to its
 * bounds, an empty frame is omitted. A config without the keys normalises to
 * empty frames, and an empty frame renders the card exactly as before.
 *
 * Pure: no DOM, no stores. Numeric coercion goes through the project's one
 * coercion module (R0.15). Lengths are in rem; the pointer math that turns a
 * measured drag into rem happens in the handle, through cssLength.ts.
 */

import { toNumber } from "src/lib/engine/numeric";

/** One frame. Each dimension is optional; a missing one inherits. */
export interface CardFrame {
  /** Media height (or minimum card height without media), in rem. */
  readonly heightRem?: number;
  /** Columns a gallery grid card spans; ignored by every other layout. */
  readonly gridSpan?: number;
}

/** Per-card overrides, keyed by record id (the note path). */
export type CardFramesByRecord = Readonly<Record<string, CardFrame>>;

/**
 * The two keys a gallery or board view config may carry. An explicit
 * `undefined` is how an update clears one (it does not survive serialising).
 */
export interface CardFrameConfig {
  readonly cardFrame?: CardFrame | undefined;
  readonly cardFramesByRecord?: CardFramesByRecord | undefined;
}

/** Both levels, normalised: never undefined, empty entries omitted. */
export interface NormalizedCardFrames {
  readonly view: CardFrame;
  readonly byRecord: CardFramesByRecord;
}

export const CARD_FRAME_BOUNDS = {
  heightRem: { min: 6, max: 40 },
  gridSpan: { min: 1, max: 4 },
} as const;

/** Per-card overrides a config may hold; a further NEW override is refused. */
export const CARD_FRAME_OVERRIDE_CAP = 500;

/** One height step, in rem. */
export const HEIGHT_STEP_REM = 1;

/** Steps a Shift+Arrow takes at once. */
export const LARGE_STEP = 4;

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** A saved height as a bounded rem value, or undefined when it is not a number. */
export function normalizeHeightRem(value: unknown): number | undefined {
  const n = toNumber(value);
  if (n === null) return undefined;
  return clamp(n, CARD_FRAME_BOUNDS.heightRem.min, CARD_FRAME_BOUNDS.heightRem.max);
}

/** A saved span as a bounded whole number of columns, or undefined. */
export function normalizeGridSpan(value: unknown): number | undefined {
  const n = toNumber(value);
  if (n === null) return undefined;
  return clamp(Math.round(n), CARD_FRAME_BOUNDS.gridSpan.min, CARD_FRAME_BOUNDS.gridSpan.max);
}

/** One frame from anything, or undefined when nothing valid is left in it. */
export function normalizeCardFrame(raw: unknown): CardFrame | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const heightRem = normalizeHeightRem(r["heightRem"]);
  const gridSpan = normalizeGridSpan(r["gridSpan"]);
  if (heightRem === undefined && gridSpan === undefined) return undefined;
  return {
    ...(heightRem !== undefined ? { heightRem } : {}),
    ...(gridSpan !== undefined ? { gridSpan } : {}),
  };
}

/** Both levels of a saved config (typed or the raw record the settings hold). */
export function normalizeCardFrames(config: unknown): NormalizedCardFrames {
  const c = config !== null && typeof config === "object" ? (config as Record<string, unknown>) : {};
  const view = normalizeCardFrame(c["cardFrame"]) ?? {};
  const raw = c["cardFramesByRecord"];
  const entries: [string, CardFrame][] = [];
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
      if (id === "") continue;
      const frame = normalizeCardFrame(entry);
      if (frame) entries.push([id, frame]);
    }
  }
  // Own data properties only, whatever a key is called (a note path is free text).
  return { view, byRecord: Object.fromEntries(entries) };
}

/** Per dimension: the override wins, a missing one inherits the view value. */
export function resolveCardFrame(view: CardFrame, override: CardFrame | undefined): CardFrame {
  const heightRem = override?.heightRem ?? view.heightRem;
  const gridSpan = override?.gridSpan ?? view.gridSpan;
  return {
    ...(heightRem !== undefined ? { heightRem } : {}),
    ...(gridSpan !== undefined ? { gridSpan } : {}),
  };
}

/** The config partial that removes one card's override. */
export function withoutOverride(config: unknown, recordId: string): Pick<CardFrameConfig, "cardFramesByRecord"> {
  const { byRecord } = normalizeCardFrames(config);
  const rest = Object.fromEntries(Object.entries(byRecord).filter(([id]) => id !== recordId));
  return { cardFramesByRecord: Object.keys(rest).length > 0 ? rest : undefined };
}

/**
 * The config partial that saves one card's override, or `null` when it is
 * refused: the map already holds the cap and `recordId` is not in it. An
 * existing override may always change; an empty frame removes the override.
 */
export function withOverride(
  config: unknown,
  recordId: string,
  frame: CardFrame | undefined
): Pick<CardFrameConfig, "cardFramesByRecord"> | null {
  const next = normalizeCardFrame(frame);
  if (!next) return withoutOverride(config, recordId);
  const { byRecord } = normalizeCardFrames(config);
  const exists = Object.prototype.hasOwnProperty.call(byRecord, recordId);
  if (!exists && Object.keys(byRecord).length >= CARD_FRAME_OVERRIDE_CAP) return null;
  return { cardFramesByRecord: { ...byRecord, [recordId]: next } };
}

/** The config partial that sets the view-wide height; undefined clears it. */
export function withViewHeight(config: unknown, heightRem: number | undefined): Pick<CardFrameConfig, "cardFrame"> {
  const { view } = normalizeCardFrames(config);
  return { cardFrame: normalizeCardFrame({ ...view, heightRem }) };
}

/** The config partial that removes every frame, view-wide and per card. */
export function resetAllFrames(): Required<Record<keyof CardFrameConfig, undefined>> {
  return { cardFrame: undefined, cardFramesByRecord: undefined };
}

/** A height snapped to whole steps and clamped. */
export function snapHeightRem(rem: number): number {
  const snapped = Math.round(rem / HEIGHT_STEP_REM) * HEIGHT_STEP_REM;
  return clamp(snapped, CARD_FRAME_BOUNDS.heightRem.min, CARD_FRAME_BOUNDS.heightRem.max);
}

/** A span clamped to whole columns within bounds. */
export function clampGridSpan(span: number): number {
  return clamp(Math.round(span), CARD_FRAME_BOUNDS.gridSpan.min, CARD_FRAME_BOUNDS.gridSpan.max);
}

/** The height a vertical drag of `dyCss` CSS pixels reaches from `startRem`. */
export function heightAfterDrag(startRem: number, dyCss: number, rootPx: number): number {
  return snapHeightRem(startRem + dyCss / rootPx);
}

/** The span a horizontal drag reaches: one column per `stepCss` of travel. */
export function spanAfterDrag(startSpan: number, dxCss: number, stepCss: number): number {
  if (!(stepCss > 0)) return clampGridSpan(startSpan);
  return clampGridSpan(startSpan + Math.round(dxCss / stepCss));
}

/**
 * Columns an auto-fill grid lays out: `repeat(auto-fill, minmax(min(c, 100%), 1fr))`
 * in a content box `width` wide with column gap `gap` (all CSS pixels).
 */
export function gridColumnCount(width: number, columnMin: number, gap: number): number {
  if (!(width > 0) || !(columnMin > 0)) return 1;
  const track = Math.min(columnMin, width);
  const g = gap > 0 ? gap : 0;
  return Math.max(1, Math.floor((width + g) / (track + g) + 1e-6));
}

/** The saved span as rendered: capped to the columns there are (the value is kept). */
export function effectiveSpan(span: number | undefined, columns: number | undefined): number | undefined {
  if (span === undefined) return undefined;
  return columns === undefined ? span : Math.min(span, Math.max(1, columns));
}

/** Two frames are the same frame. */
export function sameFrame(a: CardFrame | undefined, b: CardFrame | undefined): boolean {
  return a?.heightRem === b?.heightRem && a?.gridSpan === b?.gridSpan;
}
