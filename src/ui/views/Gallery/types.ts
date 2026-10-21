import type { CardFrameConfig } from "src/ui/components/SharedCard/cardFrames";

/**
 * The gallery view's saved configuration, as it is stored. Every key is
 * optional and loosely typed on purpose: a config read from disk may predate a
 * key or carry a value no version of the settings ever wrote. The one reading
 * of these values is `normalizeGalleryConfig` (galleryOptions.ts).
 *
 * cards-g5: `cardFrame` (view-wide) and `cardFramesByRecord` (per card) come
 * from CardFrameConfig and are read through `normalizeCardFrames`.
 */
export interface GalleryConfig extends CardFrameConfig {
  readonly coverField?: string;
  /** NPLAN-D2 — page-level icon field (emoji or lucide icon name). */
  readonly iconField?: string;
  /** cover | contain; legacy fill is kept; anything else reads as cover. */
  readonly fitStyle?: string;
  /** Card width in CSS pixels, written back as rem by the grid. */
  readonly cardWidth?: number;
  readonly includeFields?: string[];
  /** cards-g3: grid | masonry | list; absent or unknown reads as grid. */
  readonly layout?: string;
  /** cards-g3: a token of GALLERY_ASPECT_RATIOS; absent or unknown reads as 16/10. */
  readonly coverAspectRatio?: string;
  /** cards-g3: field names above their values; absent reads as shown. */
  readonly showFieldLabels?: boolean;
  /** i3-gallery: a field whose values split the cards into sections. */
  readonly groupByField?: string;
  /** i3-gallery: the keys of the sections shown folded. */
  readonly collapsedGroups?: string[];
  /** i3-gallery: what the media shows; absent or unknown reads as cover. */
  readonly cardPreview?: string;
  /** i3-gallery: title-only cards (no media, no properties). */
  readonly compact?: boolean;
}

export type GalleryLayout = "grid" | "masonry" | "list";
/**
 * i3-gallery — the card preview (Notion's "Card preview"):
 * - `cover`: the cover property, else the first image embedded in the note;
 * - `property`: the cover property only (Bases' image property);
 * - `content`: the cover property, else the first image, else the note's
 *   first paragraph as text.
 */
export type GalleryCardPreview = "cover" | "property" | "content";
export type GalleryCoverAspectRatio = "16/10" | "4/3" | "1/1" | "3/4" | "2/3" | "none";
export type GalleryFitStyle = "cover" | "contain" | "fill";

/** The fully populated options a gallery renders from. */
export interface GalleryOptions {
  readonly coverField: string | undefined;
  readonly iconField: string | undefined;
  readonly fitStyle: GalleryFitStyle;
  readonly cardWidth: number;
  readonly includeFields: string[];
  readonly layout: GalleryLayout;
  readonly coverAspectRatio: GalleryCoverAspectRatio;
  readonly showFieldLabels: boolean;
  readonly groupByField: string | undefined;
  readonly collapsedGroups: string[];
  readonly cardPreview: GalleryCardPreview;
  readonly compact: boolean;
}
