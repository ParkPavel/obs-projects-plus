/**
 * R1.4 — Color value detection
 *
 * Pure helpers for recognising "this string looks like a color" and
 * normalising it to a value safe to drop into `style="background:…"`.
 *
 * We accept the four widely-used CSS notations:
 *   - `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA` (hex)
 *   - `rgb(...)`, `rgba(...)`
 *   - `hsl(...)`, `hsla(...)`
 *   - common CSS named colors (the Level 4 set, but limited to a
 *     curated whitelist to avoid accidental false-positives on words
 *     like "tomato" sitting in plain text fields).
 *
 * Anything else — even if technically a CSS color — falls through:
 *   we'd rather miss a swatch than paint a random YAML value.
 */

const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FUNC_RE = /^(?:rgb|rgba|hsl|hsla)\(\s*[^)]+\)$/i;

/** Curated list of named colors that are unambiguously color tokens. */
const NAMED_COLORS = new Set<string>([
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "pink",
  "cyan",
  "magenta",
  "gray",
  "grey",
  "brown",
  "transparent",
]);

export function isColorValue(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (s.length === 0) return false;
  if (HEX_RE.test(s)) return true;
  if (FUNC_RE.test(s)) return true;
  if (NAMED_COLORS.has(s.toLowerCase())) return true;
  return false;
}

/**
 * Return a CSS-safe color string, or `null` when the input is not a
 * recognised color. The result preserves user notation; we do not
 * convert hex→rgb or vice versa.
 */
export function normalizeColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (s.length === 0) return null;
  if (HEX_RE.test(s)) return s.toLowerCase();
  if (FUNC_RE.test(s)) return s;
  const lower = s.toLowerCase();
  if (NAMED_COLORS.has(lower)) return lower;
  return null;
}

/**
 * Best-effort luminance estimation for a hex color (`#rgb` or `#rrggbb`).
 * Returns a value in [0, 1]. Used only by the UI to pick a contrasting
 * outline so the swatch stays visible on both light and dark themes.
 *
 * Returns `0.5` (neutral) when the input cannot be parsed — the caller
 * should treat it as "use the default border".
 */
export function hexLuminance(raw: string): number {
  const m = /^#([0-9a-fA-F]{3,8})$/.exec(raw.trim());
  if (!m) return 0.5;
  const hex = m[1]!;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hex.length === 3 || hex.length === 4) {
    r = parseInt(hex[0]! + hex[0]!, 16);
    g = parseInt(hex[1]! + hex[1]!, 16);
    b = parseInt(hex[2]! + hex[2]!, 16);
  } else if (hex.length === 6 || hex.length === 8) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    return 0.5;
  }
  // Rec. 709 luma approximation, fast and good enough for swatch contrast.
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Regex that extracts hex colors from arbitrary text (preview-mode injection). */
export const HEX_COLOR_TOKEN_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
