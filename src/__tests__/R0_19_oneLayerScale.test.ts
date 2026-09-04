/**
 * R0.19 — one scale for the layers (#169, `SPEC` §5's last item).
 *
 * The audit that opened #169 found "слои используют разные шкалы z-index", and
 * the count is the argument: `z-index: 2` appears seventeen times, `10` eleven,
 * `100` eight, `50` four, and a handful of tokens sit beside them —
 * `--ppp-z-*`, `--ppp-db-z-*`, `--layer-*`, `--agenda-z-*`. A raw number cannot
 * be reasoned about: whether a popover covers a sticky header is decided by
 * whichever file was edited last.
 *
 * ## Why a budget and not a ban
 *
 * There are dozens of raw values, and rewriting them all in one change is a
 * stacking change across the whole tree with no way to check it but by looking
 * at every surface. That is the shape #182 just punished: a sweeping edit whose
 * justification nobody measured. So this ratchets the count the way R0.3
 * ratchets `px` — measured, may only fall, fixed by moving a value onto the
 * scale rather than by raising the number.
 *
 * ## What it DOES forbid outright
 *
 * A token used with a fallback that contradicts the token's own value. That is
 * not a matter of degree: `var(--ppp-z-overlay, 49)` and
 * `var(--ppp-z-overlay, 1200)` stood in two components for the same layer, and
 * a fallback only fires when the token is missing — the one case where the two
 * would then disagree by 1151. Both now say 30, which is what the scale says.
 */

import * as fs from "fs";
import * as path from "path";

import { collectStyled, SRC_ROOT } from "./support/cssScan";

/**
 * Raw `z-index` values still in the tree.
 *
 * MEASURED, not chosen. It may only fall, and it falls by moving a value onto
 * the `--ppp-z-*` scale — never by editing this number.
 *
 * Bumps log:
 *   71 — initial measurement, #169, 2026-09-03.
 *   69 — #190 put `.ppp-slide-in-panel` (was `50`) and `.ppp-slide-in-backdrop`
 *     (was `40`) on the scale, and added `--ppp-z-base` / `--ppp-z-overlay`
 *     without adding a raw value. RE-MEASURED, not decremented by two: #165
 *     merged between the two dates and 71 - 2 would have carried whatever it
 *     did to the count into this constant disguised as a fact. The procedure
 *     was to set the budget to 0, run this suite and read `Received: 69`.
 */
const RAW_Z_BUDGET = 69;

const RAW_Z = /z-index:\s*-?\d+\s*;/g;
const TOKEN_WITH_FALLBACK = /z-index:\s*var\(\s*(--[a-z0-9-]+)\s*,\s*([^)]*)\)/gi;

/** The declared scale: token → value. */
export function declaredScale(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/(--ppp-z-[a-z-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1] as string, (m[2] as string).trim());
  }
  return out;
}

/** Raw numeric `z-index` declarations in `css`. */
export function rawLayers(css: string): string[] {
  return [...css.matchAll(RAW_Z)].map((m) => m[0]);
}

describe("R0.19 — the scan itself (synthetic, proves BOTH states)", () => {
  it("counts a raw value and ignores one that comes from the scale", () => {
    expect(rawLayers("a{z-index: 3;}")).toHaveLength(1);
    expect(rawLayers("a{z-index: var(--ppp-z-sticky);}")).toHaveLength(0);
  });

  it("reads the declared scale", () => {
    const scale = declaredScale(":root{--ppp-z-overlay: 30;--ppp-z-modal: 40;}");
    expect(scale.get("--ppp-z-overlay")).toBe("30");
  });
});

describe("R0.19 — the tree", () => {
  const styled = collectStyled(SRC_ROOT);
  const scale = declaredScale(fs.readFileSync(path.join(SRC_ROOT, "ui/tokens/tokens.css"), "utf8"));

  it("the scale exists and names the layers a UI actually has", () => {
    for (const token of [
      "--ppp-z-base",
      "--ppp-z-dropdown",
      "--ppp-z-sticky",
      "--ppp-z-overlay",
      "--ppp-z-modal",
      "--ppp-z-popover",
    ]) {
      expect({ token, declared: scale.has(token) }).toEqual({ token, declared: true });
    }
  });

  it("no fallback contradicts the token it falls back from", () => {
    // The defect this closes: two components wrote the same layer as
    // `var(--ppp-z-overlay, 49)` and `var(--ppp-z-overlay, 1200)`. A fallback
    // fires only when the token is missing — precisely when the disagreement
    // would be live.
    const offenders: string[] = [];
    for (const { file, css } of styled) {
      for (const m of css.matchAll(TOKEN_WITH_FALLBACK)) {
        const token = m[1] as string;
        const fallback = (m[2] as string).trim();
        const declared = scale.get(token);
        if (declared !== undefined && /^-?\d+$/.test(fallback) && fallback !== declared) {
          offenders.push(`${file}: ${token} declared ${declared}, written as fallback ${fallback}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("raw layer values stay within the budget, which may only fall", () => {
    const total = styled.reduce((n, { css }) => n + rawLayers(css).length, 0);
    const worst = [...styled]
      .map(({ file, css }) => [file, rawLayers(css).length] as const)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([f, n]) => `${f}: ${n}`);
    expect({ total, worst }).toEqual({ total: expect.any(Number), worst });
    expect(total).toBeLessThanOrEqual(RAW_Z_BUDGET);
  });

  it("one added raw value breaks the budget — the ceiling is pinned to the tree", () => {
    // R0.3's own defect, avoided: a budget set above the tree drifts silently
    // until it is meaningless.
    const total = styled.reduce((n, { css }) => n + rawLayers(css).length, 0);
    expect(total + 1).toBeGreaterThan(RAW_Z_BUDGET);
  });
});
