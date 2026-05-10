export interface GalleryConfig {
  readonly coverField?: string;
  /** NPLAN-D2 — page-level icon field (emoji or lucide icon name). */
  readonly iconField?: string;
  readonly fitStyle?: string;
  readonly cardWidth?: number;
  readonly includeFields?: string[];
}
