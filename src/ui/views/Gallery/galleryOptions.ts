/**
 * cards-g3 — the one reading of a saved gallery config.
 *
 * A gallery config may come from any version of the plugin, from the
 * dashboard's database-call block, or from a hand-edited data.json. Every
 * place that renders or edits a gallery reads it through
 * `normalizeGalleryConfig`, so "absent", "legacy" and "nonsense" each have one
 * answer, and a config with none of the cards-g3 keys renders as it did before
 * them: grid, 16/10 media, cover, field labels shown, 300 wide.
 *
 * Pure: no DOM, no stores. The numeric width goes through the project's one
 * coercion module (R0.15).
 */

import { toNumber } from "src/lib/engine/numeric";
import type {
  GalleryConfig,
  GalleryCoverAspectRatio,
  GalleryFitStyle,
  GalleryLayout,
  GalleryOptions,
} from "./types";

export const GALLERY_LAYOUTS: readonly GalleryLayout[] = ["grid", "masonry", "list"];

/** The closed set the settings offer; `none` means no media area at all. */
export const GALLERY_ASPECT_RATIOS: readonly GalleryCoverAspectRatio[] = [
  "16/10",
  "4/3",
  "1/1",
  "3/4",
  "2/3",
  "none",
];

/**
 * Object-fit values a config may carry. The settings write cover and contain;
 * fill was never offered but is a valid object-fit, so a config holding it
 * keeps it rather than silently changing on the next open.
 */
export const GALLERY_FIT_STYLES: readonly GalleryFitStyle[] = ["cover", "contain", "fill"];

/** Card size presets; each writes the existing numeric `cardWidth`. */
export const GALLERY_SIZE_PRESETS = { s: 200, m: 300, l: 400 } as const;
export type GallerySizePreset = keyof typeof GALLERY_SIZE_PRESETS;

export const GALLERY_DEFAULTS = {
  layout: "grid",
  coverAspectRatio: "16/10",
  fitStyle: "cover",
  showFieldLabels: true,
  cardWidth: GALLERY_SIZE_PRESETS.m,
} as const;

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** A finite positive width, or the default. */
function cardWidthOf(value: unknown): number {
  const width = toNumber(value);
  return width !== null && width > 0 ? width : GALLERY_DEFAULTS.cardWidth;
}

function fieldName(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Every option of a saved gallery config, populated. Accepts the typed config
 * the view receives and the raw `view.config` record the settings tab holds.
 */
export function normalizeGalleryConfig(
  config: GalleryConfig | Readonly<Record<string, unknown>> | null | undefined
): GalleryOptions {
  const c: Partial<Record<keyof GalleryConfig, unknown>> = config ?? {};
  const include = Array.isArray(c.includeFields)
    ? c.includeFields.filter((name): name is string => typeof name === "string")
    : [];
  return {
    coverField: fieldName(c.coverField),
    iconField: fieldName(c.iconField),
    fitStyle: oneOf(c.fitStyle, GALLERY_FIT_STYLES, GALLERY_DEFAULTS.fitStyle),
    cardWidth: cardWidthOf(c.cardWidth),
    includeFields: include,
    layout: oneOf(c.layout, GALLERY_LAYOUTS, GALLERY_DEFAULTS.layout),
    coverAspectRatio: oneOf(c.coverAspectRatio, GALLERY_ASPECT_RATIOS, GALLERY_DEFAULTS.coverAspectRatio),
    showFieldLabels: typeof c.showFieldLabels === "boolean" ? c.showFieldLabels : GALLERY_DEFAULTS.showFieldLabels,
  };
}

/** The CSS `aspect-ratio` of a token, or null for `none`. */
export function aspectRatioCss(token: GalleryCoverAspectRatio): string | null {
  if (token === "none") return null;
  const [w, h] = token.split("/");
  return `${w} / ${h}`;
}

/** The preset a width equals, or null for a custom width. */
export function sizePresetOf(width: number): GallerySizePreset | null {
  const entry = (Object.entries(GALLERY_SIZE_PRESETS) as [GallerySizePreset, number][]).find(
    ([, px]) => px === width
  );
  return entry ? entry[0] : null;
}
