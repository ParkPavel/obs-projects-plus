/**
 * Canonical color-space math (REFACTOR-401).
 *
 * Single source of truth for HSV ↔ HEX conversions used by ColorPicker,
 * RecordItem palette popover, and any future color-aware UI. Pure
 * functions only — no DOM, no Svelte, no I/O.
 *
 * Channel ranges:
 *   - hue        : 0…360  (degrees, integer)
 *   - saturation : 0…100  (percent, integer)
 *   - value      : 0…100  (percent, integer)
 *   - hex        : "#rgb" | "#rrggbb" | "#rrggbbaa" (alpha is ignored)
 *
 * @since 4.0 (REFACTOR-401)
 */

export interface HSV {
  /** Hue, degrees in [0, 360]. */
  h: number;
  /** Saturation, percent in [0, 100]. */
  s: number;
  /** Value/brightness, percent in [0, 100]. */
  v: number;
}

const HEX_3 = /^#?[0-9a-f]{3}$/i;
const HEX_6_OR_8 = /^#?[0-9a-f]{6}([0-9a-f]{2})?$/i;

/**
 * Parse a hex color string into HSV. Returns `null` if the input is
 * not a recognised 3-, 6-, or 8-digit hex literal.
 *
 * Alpha (when present in 8-digit form) is silently dropped because the
 * picker UI does not surface alpha selection — preserving compatibility
 * with the legacy two-component implementations replaced by this kernel.
 */
export function hexToHsv(input: string): HSV | null {
  if (typeof input !== "string") return null;
  const raw = input.trim().replace(/^#/, "");

  let normalised: string;
  if (HEX_3.test("#" + raw)) {
    normalised =
      raw.charAt(0) + raw.charAt(0) +
      raw.charAt(1) + raw.charAt(1) +
      raw.charAt(2) + raw.charAt(2);
  } else if (HEX_6_OR_8.test("#" + raw)) {
    normalised = raw.slice(0, 6);
  } else {
    return null;
  }

  const r = parseInt(normalised.slice(0, 2), 16) / 255;
  const g = parseInt(normalised.slice(2, 4), 16) / 255;
  const b = parseInt(normalised.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === r) {
      hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      hue = ((b - r) / delta + 2) / 6;
    } else {
      hue = ((r - g) / delta + 4) / 6;
    }
  }

  return {
    h: Math.round(hue * 360),
    s: max === 0 ? 0 : Math.round((delta / max) * 100),
    v: Math.round(max * 100),
  };
}

/**
 * Convert HSV channels to a `#rrggbb` hex string. Inputs are clamped
 * defensively so callers can pass slider values without pre-validation.
 */
export function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((Number.isFinite(h) ? h : 0) % 360 + 360) % 360;
  const sat = clamp01(Number.isFinite(s) ? s / 100 : 0);
  const val = clamp01(Number.isFinite(v) ? v / 100 : 0);

  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c; g = x;
  } else if (hue < 120) {
    r = x; g = c;
  } else if (hue < 180) {
    g = c; b = x;
  } else if (hue < 240) {
    g = x; b = c;
  } else if (hue < 300) {
    r = x; b = c;
  } else {
    r = c; b = x;
  }

  return `#${toHexByte(r + m)}${toHexByte(g + m)}${toHexByte(b + m)}`;
}

/**
 * Round-trip helper: hex → HSV → hex. Useful for canonicalising user
 * input (e.g. shorthand `#abc` → `#aabbcc`). Returns `null` on invalid
 * input so the caller can keep the original string verbatim.
 */
export function normaliseHex(input: string): string | null {
  const hsv = hexToHsv(input);
  if (!hsv) return null;
  return hsvToHex(hsv.h, hsv.s, hsv.v);
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function toHexByte(channel01: number): string {
  const byte = Math.round(clamp01(channel01) * 255);
  return byte.toString(16).padStart(2, "0");
}
