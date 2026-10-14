import {
  VIEW_TYPE_VISUALIZER_PANE,
  readFrontmatter,
} from "src/ui/views/VisualizerPane/visualizerPaneView";

/**
 * R1.1 smoke — Visualizer pane registration contract.
 *
 * The pane registers under a stable view type id, exports a frontmatter
 * reader, and the readFrontmatter helper handles missing-cache gracefully.
 */
describe("VIEW_TYPE_VISUALIZER_PANE", () => {
  it("uses a stable, prefixed identifier", () => {
    expect(VIEW_TYPE_VISUALIZER_PANE).toBe("obs-projects-plus-visualizer");
  });
});

describe("readFrontmatter", () => {
  const fakeFile = { path: "Notes/A.md", basename: "A", extension: "md" } as never;

  it("returns the frontmatter when present", () => {
    const cache = {
      getFileCache: () => ({ frontmatter: { foo: "bar", count: 3 } }),
    };
    const result = readFrontmatter(fakeFile, cache as never);
    expect(result).toEqual({ foo: "bar", count: 3 });
  });

  it("returns null when no cache entry exists", () => {
    const cache = { getFileCache: () => null };
    const result = readFrontmatter(fakeFile, cache as never);
    expect(result).toBeNull();
  });

  it("returns null when cache entry has no frontmatter", () => {
    const cache = { getFileCache: () => ({}) };
    const result = readFrontmatter(fakeFile, cache as never);
    expect(result).toBeNull();
  });
});

describe("B2 retired Visualizer pane", () => {
  it("a restored pane leaf closes itself instead of breaking the workspace", async () => {
    jest.useFakeTimers();
    const { RetiredVisualizerPaneView } = require("src/ui/views/VisualizerPane/visualizerPaneView");
    const leaf = { detach: jest.fn() };
    const view = new RetiredVisualizerPaneView(leaf);
    expect(view.getViewType()).toBe("obs-projects-plus-visualizer");
    await view.onOpen();
    expect(leaf.detach).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(leaf.detach).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
