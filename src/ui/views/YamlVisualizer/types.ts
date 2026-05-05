/**
 * YAML Визуализатор — config types.
 *
 * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.7 (M2 anchor).
 * @since 3.4.2 (Stage A / M2)
 */

export type VisualizerLayout = "compact" | "comfortable" | "grid";

export interface YamlVisualizerConfig {
  /** Field names to hide from the panel. */
  readonly hiddenFields?: string[];
  /** Sort key (field name) and direction. */
  readonly sortField?: string;
  readonly sortAsc?: boolean;
  /** Layout mode for the property list. */
  readonly layout?: VisualizerLayout;
}
