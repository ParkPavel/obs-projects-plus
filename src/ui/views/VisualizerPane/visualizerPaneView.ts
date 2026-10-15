import { ItemView, WorkspaceLeaf, TFile, type FrontMatterCache } from "obsidian";

/**
 * 3.7.2 B2 — the YAML Visualizer side pane is retired: the note's properties
 * live in the note header (src/ui/properties). The view type stays registered
 * only so a workspace saved with the pane open restores cleanly: the leaf
 * closes itself on open instead of showing an unknown-view placeholder.
 */

export const VIEW_TYPE_VISUALIZER_PANE = "obs-projects-plus-visualizer";

export class RetiredVisualizerPaneView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.navigation = false;
  }

  getViewType(): string {
    return VIEW_TYPE_VISUALIZER_PANE;
  }

  getDisplayText(): string {
    return "YAML visualizer";
  }

  override async onOpen(): Promise<void> {
    // Detach after the workspace finished restoring, never during it.
    window.setTimeout(() => this.leaf.detach(), 0);
  }
}

/**
 * Read the frontmatter of a TFile via Obsidian's metadata cache. Returns
 * `null` when no cache entry exists yet (e.g. brand-new file).
 */
export function readFrontmatter(
  file: TFile,
  metadataCache: { getFileCache: (f: TFile) => { frontmatter?: FrontMatterCache } | null },
): FrontMatterCache | null {
  const cache = metadataCache.getFileCache(file);
  return cache?.frontmatter ?? null;
}
