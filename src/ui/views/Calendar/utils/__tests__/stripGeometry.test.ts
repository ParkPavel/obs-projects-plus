/**
 * ios-p1 — one strip geometry for the timeline all-day section.
 *
 * Measured before: on a phone the timeline all-day strips were 18 CSS units
 * tall, because four components each carried the fine-pointer constants. The
 * strips, the all-day section of `TimelineView` and the sticky all-day row of
 * `InfiniteHorizontalCalendar` now read `stripGeometry`; these cases pin the
 * numbers they read and the row formula they share, so a coarse pointer gets a
 * touch-sized strip and a fine pointer keeps exactly the density it had.
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  STRIP_GAP_REM,
  STRIP_HEIGHT_COARSE_REM,
  allDaySectionHeightRem,
  stripGeometry,
  stripTopRem,
} from "../stripGeometry";

const fineDesktop = stripGeometry({ coarse: false, isMobile: false });
const fineNarrow = stripGeometry({ coarse: false, isMobile: true });
const coarseDesktop = stripGeometry({ coarse: true, isMobile: false });
const coarseNarrow = stripGeometry({ coarse: true, isMobile: true });

/** `--ppp-touch-target-min` as `tokens.css` declares it, in rem. */
function touchTargetMinRem(): number {
  const css = readFileSync(join(__dirname, "../../../../tokens/tokens.css"), "utf8");
  const m = /--ppp-touch-target-min:\s*([\d.]+)rem/.exec(css);
  if (!m?.[1]) throw new Error("--ppp-touch-target-min not found in tokens.css");
  return Number(m[1]);
}

describe("stripGeometry — fine pointer keeps its density (ios-p1)", () => {
  it("desktop layout: 1.25rem strips, 0.125rem gap, as before", () => {
    expect(fineDesktop).toEqual({ heightRem: 1.25, gapRem: 0.125 });
  });

  it("narrow layout: 1.125rem strips, 0.125rem gap, as before", () => {
    expect(fineNarrow).toEqual({ heightRem: 1.125, gapRem: 0.125 });
  });
});

describe("stripGeometry — coarse pointer gets a touch target (ios-p1)", () => {
  it("is 2.75rem tall in both layouts, with the same gap", () => {
    expect(coarseDesktop).toEqual({ heightRem: 2.75, gapRem: 0.125 });
    expect(coarseNarrow).toEqual({ heightRem: 2.75, gapRem: 0.125 });
  });

  it("is never shorter than --ppp-touch-target-min (44 at the default root)", () => {
    const min = touchTargetMinRem();
    expect(min).toBe(2.75);
    expect(STRIP_HEIGHT_COARSE_REM).toBe(min);
    for (const g of [coarseDesktop, coarseNarrow]) {
      expect(g.heightRem).toBeGreaterThanOrEqual(min);
      expect(g.heightRem * 16).toBeGreaterThanOrEqual(44);
    }
  });

  it("the pointer decides the height, not the layout: a fine narrow pane stays dense", () => {
    expect(fineNarrow.heightRem).toBeLessThan(coarseNarrow.heightRem);
    expect(fineDesktop.heightRem).toBeLessThan(coarseDesktop.heightRem);
  });

  it("the gap does not change with the pointer", () => {
    for (const g of [fineDesktop, fineNarrow, coarseDesktop, coarseNarrow]) {
      expect(g.gapRem).toBe(STRIP_GAP_REM);
    }
  });
});

describe("allDaySectionHeightRem — (maxLane + 1) strips and maxLane gaps", () => {
  it("no lane is an empty section", () => {
    expect(allDaySectionHeightRem(-1, fineDesktop)).toBe(0);
    expect(allDaySectionHeightRem(-1, coarseNarrow)).toBe(0);
  });

  it("one lane is one strip and no gap", () => {
    expect(allDaySectionHeightRem(0, fineDesktop)).toBe(1.25);
    expect(allDaySectionHeightRem(0, fineNarrow)).toBe(1.125);
    expect(allDaySectionHeightRem(0, coarseNarrow)).toBe(2.75);
  });

  it("three lanes are three strips and two gaps", () => {
    expect(allDaySectionHeightRem(2, fineDesktop)).toBeCloseTo(3 * 1.25 + 2 * 0.125, 10);
    expect(allDaySectionHeightRem(2, fineNarrow)).toBeCloseTo(3 * 1.125 + 2 * 0.125, 10);
    expect(allDaySectionHeightRem(2, coarseNarrow)).toBeCloseTo(3 * 2.75 + 2 * 0.125, 10);
  });

  it("matches the formula the components carried before, on a fine pointer", () => {
    // The old inline expression in TimelineView and InfiniteHorizontalCalendar.
    const before = (maxLane: number, h: number): number =>
      maxLane >= 0 ? (maxLane + 1) * h + maxLane * 0.125 : 0;
    for (let lane = -1; lane <= 6; lane++) {
      expect(allDaySectionHeightRem(lane, fineDesktop)).toBe(before(lane, 1.25));
      expect(allDaySectionHeightRem(lane, fineNarrow)).toBe(before(lane, 1.125));
    }
  });

  it("every coarse lane fits a whole touch-target strip", () => {
    for (let lane = 0; lane <= 4; lane++) {
      expect(allDaySectionHeightRem(lane, coarseDesktop) / (lane + 1)).toBeGreaterThanOrEqual(2.75);
    }
  });
});

describe("stripTopRem — strips stack inside the section it measures", () => {
  it("lane n starts n strips and n gaps down", () => {
    expect(stripTopRem(0, coarseNarrow)).toBe(0);
    expect(stripTopRem(1, fineDesktop)).toBe(1.375);
    expect(stripTopRem(1, fineNarrow)).toBe(1.25);
    expect(stripTopRem(2, coarseNarrow)).toBe(5.75);
  });

  it("the deepest strip ends exactly at the section's bottom, for every geometry", () => {
    // The sticky all-day row and the day columns are sized by the section
    // height; the strips are placed by their top. Both from one geometry, the
    // last strip's bottom is the section's bottom: nothing overhangs or gaps.
    for (const g of [fineDesktop, fineNarrow, coarseDesktop, coarseNarrow]) {
      for (let maxLane = 0; maxLane <= 5; maxLane++) {
        expect(stripTopRem(maxLane, g) + g.heightRem).toBeCloseTo(allDaySectionHeightRem(maxLane, g), 10);
      }
    }
  });
});
