/**
 * Column-width unit helpers for DataTable (Phase 3 / F5).
 *
 * Rationale: widths persisted in px bleed the user's current root
 * font-size into settings forever. Storing in `rem` makes column layouts
 * survive theme / zoom / font-scale changes. We still render in px
 * (DataGrid requires numeric px widths), so we translate lazily at the
 * boundary.
 *
 * Backward compat: legacy `width` keys from pre-v3.5.0 settings are
 * accepted as-is (px) and migrated on the next resize.
 */
const ROOT_FONT_SIZE_FALLBACK = 16;

export function getRootFontSize(): number {
  if (typeof document === "undefined") return ROOT_FONT_SIZE_FALLBACK;
  const parsed = parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : ROOT_FONT_SIZE_FALLBACK;
}

export function pxToRem(px: number): number {
  const rem = px / getRootFontSize();
  // Clamp to a reasonable precision; avoids ugly floats in saved JSON.
  return Math.round(rem * 1000) / 1000;
}

export function remToPx(rem: number): number {
  return Math.round(rem * getRootFontSize());
}

/**
 * Resolve an effective column width in px from a config entry that may
 * use either the deprecated `width` (px) or the new `widthRem` key.
 * `widthRem` takes precedence. Returns `fallback` when neither is set.
 */
export function resolveColumnWidthPx(
  cfg:
    | { width?: number; widthRem?: number }
    | undefined,
  fallback: number,
): number {
  if (cfg?.widthRem !== undefined) return remToPx(cfg.widthRem);
  if (cfg?.width !== undefined) return cfg.width;
  return fallback;
}
