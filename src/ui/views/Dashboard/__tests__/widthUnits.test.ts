/**
 * widthUnits tests (Phase 3 / F5).
 *
 * Covers:
 *  - `pxToRem` / `remToPx` round-trip at the standard 16 px root.
 *  - `resolveColumnWidthPx` precedence: `widthRem` > `width` > fallback.
 *  - Backward-compat guarantee: legacy `width` still resolves without
 *    migration.
 */
import {
  pxToRem,
  remToPx,
  resolveColumnWidthPx,
} from "../widgets/DataTable/widthUnits";

describe("widthUnits", () => {
  beforeAll(() => {
    // jsdom's default computed font-size is 16px; pin it explicitly so
    // the rounding math is deterministic even if the env changes.
    document.documentElement.style.fontSize = "16px";
  });

  test("pxToRem converts at 16px root", () => {
    expect(pxToRem(160)).toBe(10);
    expect(pxToRem(8)).toBe(0.5);
  });

  test("remToPx converts at 16px root", () => {
    expect(remToPx(10)).toBe(160);
    expect(remToPx(0.5)).toBe(8);
  });

  test("round-trip is lossless within rounding tolerance", () => {
    for (const px of [80, 120, 180, 240, 360]) {
      expect(remToPx(pxToRem(px))).toBe(px);
    }
  });

  test("resolveColumnWidthPx prefers widthRem over legacy width", () => {
    expect(resolveColumnWidthPx({ widthRem: 10, width: 999 }, 100)).toBe(160);
  });

  test("resolveColumnWidthPx falls back to legacy width when widthRem absent", () => {
    expect(resolveColumnWidthPx({ width: 220 }, 100)).toBe(220);
  });

  test("resolveColumnWidthPx returns fallback when neither is set", () => {
    expect(resolveColumnWidthPx(undefined, 180)).toBe(180);
    expect(resolveColumnWidthPx({}, 180)).toBe(180);
  });
});
