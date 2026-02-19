import { describe, expect, it } from "@jest/globals";
import { InMemFileSystem } from "src/lib/filesystem/inmem/filesystem";
import type {
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import { TagDataSource } from "./datasource";

/**
 * Helper to build a minimal ProjectDefinition for tag-based projects.
 */
function makeTagProject(
  tag: string,
  hierarchy = false,
  excludedNotes: string[] = []
): ProjectDefinition {
  return {
    name: "Test",
    id: "test-id",
    fieldConfig: {},
    views: [],
    defaultName: "",
    templates: [],
    excludedNotes,
    isDefault: false,
    newNotesFolder: "",
    dataSource: {
      kind: "tag",
      config: { tag, hierarchy },
    },
  };
}

const defaultPrefs: ProjectsPluginPreferences = {
  projectSizeLimit: 1000,
  frontmatter: { quoteStrings: "PLAIN" },
  locale: { firstDayOfWeek: "monday" },
  commands: [],
  linkBehavior: "open-editor",
  mobileCalendarView: "month",
  showViewTitles: true,
  animationBehavior: "smooth",
};

/**
 * Helper: uses actual InMemFileSystem.create() so readTags() works correctly.
 */
async function createFSWithFiles(
  files: Record<string, string>
): Promise<InMemFileSystem> {
  const fs = new InMemFileSystem({});
  for (const [path, content] of Object.entries(files)) {
    await fs.create(path, content);
  }
  return fs;
}

describe("TagDataSource.includes", () => {
  // ─────────────────────────────────────────────────────────────
  // Problem 1: Config tag without #
  // ─────────────────────────────────────────────────────────────
  it("matches when config tag has no # prefix", async () => {
    const fs = await createFSWithFiles({
      "note.md": "---\ntags: daily\n---\nContent",
    });
    const project = makeTagProject("daily");
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(true);
  });

  it("matches when config tag has # prefix", async () => {
    const fs = await createFSWithFiles({
      "note.md": "---\ntags: daily\n---\nContent",
    });
    const project = makeTagProject("#daily");
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // Problem 2: Double ## in frontmatter
  // ─────────────────────────────────────────────────────────────
  it("matches file with YAML tags: [\"#daily\"] (the double-# bug)", async () => {
    const fs = await createFSWithFiles({
      "note.md": '---\ntags: "#daily"\n---\nContent',
    });
    const project = makeTagProject("#daily");
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(true);
  });

  it("matches file with YAML tags: [\"#daily\"] when config has no #", async () => {
    const fs = await createFSWithFiles({
      "note.md": '---\ntags: "#daily"\n---\nContent',
    });
    const project = makeTagProject("daily");
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // YAML array format
  // ─────────────────────────────────────────────────────────────
  it("matches YAML array tags", async () => {
    const fs = await createFSWithFiles({
      "note.md": "---\ntags:\n  - project\n  - daily\n---\nContent",
    });
    const project = makeTagProject("#daily");
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(true);
  });

  it("does not match when tag is absent", async () => {
    const fs = await createFSWithFiles({
      "note.md": "---\ntags: weekly\n---\nContent",
    });
    const project = makeTagProject("#daily");
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // Inline tags
  // ─────────────────────────────────────────────────────────────
  it("matches inline tags in body", async () => {
    const fs = await createFSWithFiles({
      "note.md": "Some text #daily and more",
    });
    const project = makeTagProject("#daily");
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // Hierarchy mode
  // ─────────────────────────────────────────────────────────────
  it("matches parent tag in hierarchy mode", async () => {
    const fs = await createFSWithFiles({
      "note.md": "---\ntags: project/backend\n---\nContent",
    });
    const project = makeTagProject("#project", true);
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(true);
  });

  it("does not match parent tag when hierarchy is off", async () => {
    const fs = await createFSWithFiles({
      "note.md": "---\ntags: project/backend\n---\nContent",
    });
    const project = makeTagProject("#project", false);
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(false);
  });

  it("matches exact tag in hierarchy mode", async () => {
    const fs = await createFSWithFiles({
      "note.md": "---\ntags: project\n---\nContent",
    });
    const project = makeTagProject("#project", true);
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // Excluded notes
  // ─────────────────────────────────────────────────────────────
  it("excludes notes in excludedNotes list", async () => {
    const fs = await createFSWithFiles({
      "note.md": "---\ntags: daily\n---\nContent",
    });
    const project = makeTagProject("#daily", false, ["note.md"]);
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────────────────────────
  it("returns false for non-tag datasource kind", async () => {
    const fs = await createFSWithFiles({
      "note.md": "---\ntags: daily\n---\nContent",
    });
    const project = makeTagProject("#daily");
    (project as any).dataSource = { kind: "folder", config: { path: "/", recursive: true } };
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(false);
  });

  it("returns false for non-existent file", async () => {
    const fs = await createFSWithFiles({});
    const project = makeTagProject("#daily");
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("nonexistent.md")).toBe(false);
  });

  it("returns false when config tag is empty", async () => {
    const fs = await createFSWithFiles({
      "note.md": "---\ntags: daily\n---\nContent",
    });
    const project = makeTagProject("");
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(false);
  });

  it("returns false when config tag is only #", async () => {
    const fs = await createFSWithFiles({
      "note.md": "---\ntags: daily\n---\nContent",
    });
    const project = makeTagProject("#");
    const ds = new TagDataSource(fs, project, defaultPrefs);

    expect(ds.includes("note.md")).toBe(false);
  });
});
