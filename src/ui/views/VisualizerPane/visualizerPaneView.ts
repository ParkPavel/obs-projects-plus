import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  type FrontMatterCache,
} from "obsidian";
import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";
import type { InverseIndexStore } from "src/lib/relations/inverseIndexStore";
import VisualizerPane from "./VisualizerPane.svelte";

/**
 * R1.1 — Visualizer Pane (sidebar leaf)
 *
 * Per Revision 3 §1.7 / §2.2 the Visualizer must be available as a
 * native sidebar pane that follows the active Markdown file. This is
 * the first concrete entry point for Visualizer functionality outside
 * of the project view-tab. Replacement of the native Properties pane
 * is gated by a settings toggle (R1.1b — not yet wired).
 *
 * Lifecycle:
 *  - `onOpen` mounts a Svelte component into `contentEl`.
 *  - The Svelte component subscribes to workspace `active-leaf-change`
 *    so it always reflects the focused note.
 *  - `onClose` destroys the component.
 *
 * Concrete editing surfaces (per-note overlay, manual relations,
 * property type editor) land in R1.2..R1.5.
 */

export const VIEW_TYPE_VISUALIZER_PANE = "obs-projects-plus-visualizer";

export class VisualizerPaneView extends ItemView {
  private component?: VisualizerPane;
  private readonly host: { inverseIndexStore?: InverseIndexStore } | undefined;

  constructor(leaf: WorkspaceLeaf, host?: { inverseIndexStore?: InverseIndexStore }) {
    super(leaf);
    this.navigation = false;
    this.host = host;
  }

  getViewType(): string {
    return VIEW_TYPE_VISUALIZER_PANE;
  }

  getDisplayText(): string {
    return get(i18n).t("views.visualizer.pane.title");
  }

  getIcon(): string {
    return "layout-list";
  }

  override async onOpen(): Promise<void> {
    this.component = new VisualizerPane({
      target: this.contentEl,
      props: {
        app: this.app,
        inverseIndexStore: this.host?.inverseIndexStore,
      },
    });
  }

  override async onClose(): Promise<void> {
    if (this.component) {
      this.component.$destroy();
      delete this.component;
    }
  }
}

/**
 * Helper: read and parse the frontmatter of a TFile via Obsidian's metadata
 * cache. Returns `null` when no cache entry exists yet (e.g. brand-new file).
 *
 * Kept exported so R1.2 (per-note overlay) can reuse the resolution.
 */
export function readFrontmatter(
  file: TFile,
  metadataCache: { getFileCache: (f: TFile) => { frontmatter?: FrontMatterCache } | null },
): FrontMatterCache | null {
  const cache = metadataCache.getFileCache(file);
  return cache?.frontmatter ?? null;
}
