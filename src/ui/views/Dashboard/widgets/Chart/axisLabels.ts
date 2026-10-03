// src/ui/views/Dashboard/widgets/Chart/axisLabels.ts
// #096.2 — Shared density-based axis-label layout for Bar/Line charts.
//
// Pure, Chart-local helper (NOT engine): given the labels and the plot
// width, decide which labels to render, whether to rotate them, and how to
// truncate. Both BarChart and LineChart consume this so skip/rotate logic
// lives in one place instead of per-component magic numbers.
//
// All geometry here is in unitless SVG user-space units (the chart viewBox
// coordinate system), not CSS pixels — so this has no PX-budget impact.

/** Approximate width of one character at the given font size, in SVG units. */
const CHAR_WIDTH_RATIO = 0.6;

/** Minimum gap between two horizontal labels before we must skip/rotate. */
const MIN_LABEL_GAP = 4;

/**
 * ios-m1 — the label font the layout assumes on a coarse pointer. There the
 * Bar and Line charts draw axis text at `--ppp-text-floor` (a CSS rule), which
 * resolves to the larger of the plugin floor and --font-ui-smaller: 11 units at the floor,
 * 12 or 13 at Obsidian's usual small UI font (the viewBox is pinned to the
 * measured width, so one unit is one CSS pixel). The layout cannot read the
 * resolved CSS value, so it assumes the top of that range plus one: guessing
 * high only thins or rotates the labels sooner, guessing low overlaps them.
 */
export const COARSE_LABEL_FONT = 14;

/** sin(30°): the rotated labels are turned by -30°. */
const ROTATED_SIN = 0.5;

/**
 * The font size to lay axis labels out with. A fine pointer keeps the chart's
 * own size, so desktop layout is unchanged; a coarse one never assumes less
 * than `COARSE_LABEL_FONT`.
 */
export function axisLabelFont(base: number, coarse: boolean): number {
  return coarse ? Math.max(base, COARSE_LABEL_FONT) : base;
}

export interface AxisLabelOptions {
  /** Number of labels on the axis. */
  readonly count: number;
  /** Available horizontal space for the whole axis, in SVG units. */
  readonly plotWidth: number;
  /** Font size used to render labels, in SVG units. Default 10. */
  readonly fontSize?: number;
  /** Longest label text length (chars). Used to estimate label box width. */
  readonly maxLabelChars: number;
  /** Hard cap on rendered characters before truncation. Default 12. */
  readonly truncateAt?: number;
  /**
   * ios-m1 — the labels are drawn for a coarse pointer, at the phone text
   * floor. The layout then assumes `axisLabelFont(fontSize, true)` and spaces
   * rotated labels by their real geometry (see `rotatedSlotNeed`). Default
   * false: the fine-pointer layout is exactly what it was.
   */
  readonly coarse?: boolean;
}

export interface AxisLabelLayout {
  /**
   * Render every `skipInterval`-th label. 1 = render all. The last label is
   * always rendered regardless of the interval so the axis reads to its end.
   */
  readonly skipInterval: number;
  /** Whether labels should be rotated to avoid horizontal overlap. */
  readonly rotate: boolean;
  /** Rotation angle in degrees when `rotate` is true (negative = counter-cw). */
  readonly rotationDeg: number;
  /** Character budget after which a label is truncated with an ellipsis. */
  readonly truncateAt: number;
  /**
   * Extra vertical space the axis needs below the plot for the (possibly
   * rotated) labels, in SVG units. Callers reconcile bottom padding with this.
   */
  readonly bottomPadding: number;
}

/**
 * Decide whether a label index should be rendered given a skip interval.
 * Always renders index 0, every `skipInterval`-th, and the final label.
 */
export function shouldRenderLabel(
  index: number,
  count: number,
  skipInterval: number
): boolean {
  if (skipInterval <= 1) return true;
  return index % skipInterval === 0 || index === count - 1;
}

/** Truncate a label to `max` chars, appending an ellipsis when cut. */
export function truncateLabel(label: string, max: number): string {
  if (label.length <= max) return label;
  return label.slice(0, Math.max(0, max - 1)) + "…";
}

/**
 * SVG `text-anchor` for the label at `index`. The first and last labels sit
 * exactly at the plot's edges (BarChart/LineChart both place them there), so
 * centering them (`middle`) lets half their width overflow past the plot's
 * padding — that half was what a wide right-most date label was losing to
 * the SVG's own clip. Anchoring the edge labels to the edge they sit on
 * keeps the whole label inside the plot instead. A rotated label already
 * leans away from its anchor point via the transform, so it keeps `middle`.
 */
export function labelAnchor(
  index: number,
  count: number,
  _rotate: boolean
): "start" | "middle" | "end" {
  // Rotation does not save an edge label: text turned about its own midpoint
  // still has half of itself on the far side of the anchor, and at the plot's
  // edge that half is outside. So the edge labels anchor to their edge
  // whether or not they are rotated.
  if (index === 0) return "start";
  if (index === count - 1) return "end";
  return "middle";
}

/**
 * Compute a density-based label layout. The estimated label box width drives
 * three escalating responses to crowding:
 *  1. labels fit horizontally   → render all, no rotation
 *  2. labels overlap a little   → rotate (-30°), render all
 *  3. labels overlap a lot      → rotate AND skip every Nth label
 */
export function computeAxisLabelLayout(opts: AxisLabelOptions): AxisLabelLayout {
  const coarse = opts.coarse === true;
  const fontSize = axisLabelFont(opts.fontSize ?? 10, coarse);
  const truncateAt = opts.truncateAt ?? 12;
  const count = Math.max(opts.count, 1);

  const renderedChars = Math.min(opts.maxLabelChars, truncateAt);
  const labelBoxWidth = renderedChars * fontSize * CHAR_WIDTH_RATIO;
  const slotWidth = opts.plotWidth / count;

  // How wide a horizontal label is relative to its slot.
  const horizontalFits = labelBoxWidth + MIN_LABEL_GAP <= slotWidth;

  if (horizontalFits) {
    return {
      skipInterval: 1,
      rotate: false,
      rotationDeg: 0,
      truncateAt,
      bottomPadding: fontSize + 6,
    };
  }

  // Rotated labels occupy ~fontSize of horizontal width each. If even that
  // does not fit, skip enough labels so the rendered ones clear each other.
  // ios-m1: on a coarse pointer the spacing follows the geometry instead.
  // Two parallel labels at -30° whose anchors are `d` apart have baselines
  // d·sin(30°) = d/2 apart, so clearing one line of text plus the gap takes
  // twice that. The fine-pointer estimate is kept as it was (desktop layout
  // is out of scope for ios-m1).
  const rotatedSlotNeed = coarse
    ? (fontSize + MIN_LABEL_GAP) / ROTATED_SIN
    : fontSize + MIN_LABEL_GAP;
  const skipInterval =
    rotatedSlotNeed > slotWidth
      ? Math.max(1, Math.ceil(rotatedSlotNeed / slotWidth))
      : 1;

  // A -30° label of width w extends ~w*sin(30°) below the axis ≈ w*0.5.
  const rotatedHeight = labelBoxWidth * 0.5 + fontSize;

  return {
    skipInterval,
    rotate: true,
    rotationDeg: -30,
    truncateAt,
    bottomPadding: Math.round(rotatedHeight + 6),
  };
}
