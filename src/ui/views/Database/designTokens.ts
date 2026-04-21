/**
 * CSS Design Tokens for Database View.
 *
 * Injected as CSS custom properties on the database view container.
 * Uses rem/% only (px only for borders).
 * Container Queries (Матрёшка pattern) — @container, not @media.
 */

/** Space scale (rem) */
export const SPACE = {
  xxs: "0.125rem",
  xs: "0.25rem",
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.5rem",
  "3xl": "2rem",
} as const;

/** Container breakpoints (rem) — for @container queries */
export const BREAKPOINTS = {
  compact: "20rem",   // 320px — phone portrait
  narrow: "30rem",    // 480px — phone landscape
  medium: "45rem",    // 720px — tablet
  wide: "60rem",      // 960px — desktop
  full: "70rem",      // 1120px — wide desktop
} as const;

/** Touch-target minimum sizes */
export const TOUCH = {
  coarse: "2.75rem",  // 44px — for touch screens
  fine: "2rem",       // 32px — for pointer devices
} as const;

/** Row density heights */
export const ROW_HEIGHT = {
  compact: "1.75rem",   // 28px
  default: "2.25rem",   // 36px
  expanded: "3rem",     // 48px
} as const;

/** Border radius tokens */
export const RADIUS = {
  xs: "0.125rem",
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  pill: "62.5rem",
} as const;

/**
 * Generate CSS custom property declarations for injection.
 */
export function getDesignTokenCSS(): string {
  const lines: string[] = [];

  // Space scale
  for (const [key, value] of Object.entries(SPACE)) {
    lines.push(`--ppp-space-${key}: ${value};`);
  }

  // Breakpoints (used in @container queries, exposed for JS access)
  for (const [key, value] of Object.entries(BREAKPOINTS)) {
    lines.push(`--ppp-bp-${key}: ${value};`);
  }

  // Touch targets
  lines.push(`--ppp-touch-coarse: ${TOUCH.coarse};`);
  lines.push(`--ppp-touch-fine: ${TOUCH.fine};`);

  // Row heights
  for (const [key, value] of Object.entries(ROW_HEIGHT)) {
    lines.push(`--ppp-row-${key}: ${value};`);
  }

  // Radius
  for (const [key, value] of Object.entries(RADIUS)) {
    lines.push(`--ppp-radius-${key}: ${value};`);
  }

  return lines.join("\n");
}

/**
 * Container query CSS block generator.
 *
 * Usage in Svelte <style>:
 *   .ppp-db-canvas { container-type: inline-size; container-name: canvas; }
 *
 *   @container canvas (min-width: 45rem) {
 *     .ppp-db-canvas { ... }
 *   }
 */
export const CONTAINER_NAMES = {
  canvas: "canvas",
  widget: "widget",
  table: "table",
  chart: "chart",
} as const;
