import type { CardFrameConfig } from "src/ui/components/SharedCard/cardFrames";

/**
 * cards-g5: `cardFrame` (view-wide) and `cardFramesByRecord` (per card) come
 * from CardFrameConfig and are read through `normalizeCardFrames`. A board
 * card's frame sets its height only; the column governs its width.
 */
export interface BoardConfig extends CardFrameConfig {
  readonly groupByField?: string;
  readonly checkField?: string;
  readonly headerField?: string;
  /** NPLAN-D2 — page-level icon field (emoji or lucide icon name). */
  readonly iconField?: string;
  readonly orderSyncField?: string;
  readonly columnWidth?: number;
  readonly columns?: ColumnSettings;
  readonly includeFields?: string[];
  readonly freezeAll?: boolean;
  readonly persistedStatuses?: string[];
  readonly boardZoom?: number;
  /**
   * NPLAN-C1 — When `"semantic"`, Board columns are grouped by the
   * `statusGroups` buckets (todo / inProgress / complete) defined on
   * the grouping field's `FieldConfig`. Default `"values"` preserves
   * existing behaviour (columns = unique field values).
   */
  readonly groupMode?: "values" | "semantic";
  /**
   * cards-g4 — where a card shows its cover image: `top` (a cover above the
   * header), `left` (a small square beside it) or `none` (default, the card
   * as it always was). Read through `normalizeThumbnailLayout`.
   */
  readonly thumbnailLayout?: BoardThumbnailLayout;
  /** cards-g4 — the field holding the cover image (same as the gallery's). */
  readonly coverField?: string;
}

export const BOARD_THUMBNAIL_LAYOUTS = ["none", "top", "left"] as const;
export type BoardThumbnailLayout = (typeof BOARD_THUMBNAIL_LAYOUTS)[number];

/**
 * release-370 — whether every column is pinned. `freezeAll` is the current key;
 * older views saved only `freezeColumns`, which the settings and the navigation
 * bar already read, so the board reads it too (it rendered such views unpinned).
 */
export function isBoardFrozen(config: { readonly freezeAll?: boolean; readonly freezeColumns?: boolean } | undefined): boolean {
  return (config?.freezeAll ?? config?.freezeColumns) === true;
}

/** cards-g4 — a saved value as a layout; absent or unknown is `none`. */
export function normalizeThumbnailLayout(value: unknown): BoardThumbnailLayout {
  return value === "top" || value === "left" ? value : "none";
}

export interface ColumnSettings {
  [name: string]: {
    readonly weight?: number;
    readonly records?: string[];
    readonly collapse?: boolean;
  };
}
