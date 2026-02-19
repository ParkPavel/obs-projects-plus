import { describe, expect, it } from "@jest/globals";
import { InMemFileSystem } from "./filesystem";

/**
 * Tests for InMemFile.readTags() to verify tag normalization.
 * These tests validate the fixes for:
 *   - Problem 2: Double ## when YAML has tags: ["#daily"]
 *   - Problem 6: InMemFS alignment with ObsidianFS behavior
 */

async function createFile(content: string) {
  const fs = new InMemFileSystem({});
  const file = await fs.create("test.md", content);
  return file;
}

describe("InMemFile.readTags", () => {
  // ─── Front matter: comma-separated ────────────────────────
  it("parses comma-separated tags without #", async () => {
    const file = await createFile("---\ntags: daily, project\n---\n");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#daily", "#project"]));
  });

  it("parses comma-separated tags with #", async () => {
    const file = await createFile("---\ntags: #daily, #project\n---\n");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#daily", "#project"]));
  });

  it("handles double ## in comma-separated (the bug scenario)", async () => {
    const file = await createFile("---\ntags: ##daily\n---\n");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#daily"]));
  });

  // ─── Front matter: YAML list ──────────────────────────────
  it("parses YAML list tags without #", async () => {
    const file = await createFile("---\ntags:\n  - daily\n  - project\n---\n");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#daily", "#project"]));
  });

  it("parses YAML list tags with #", async () => {
    const file = await createFile("---\ntags:\n  - \"#daily\"\n  - \"#project\"\n---\n");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#daily", "#project"]));
  });

  it("strips YAML quotes from tags", async () => {
    const file = await createFile("---\ntags:\n  - 'daily'\n  - \"project\"\n---\n");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#daily", "#project"]));
  });

  it("handles double ## in YAML list (the bug scenario)", async () => {
    const file = await createFile("---\ntags:\n  - \"##daily\"\n---\n");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#daily"]));
  });

  // ─── Front matter: singular 'tag' property ────────────────
  it("parses singular 'tag' property", async () => {
    const file = await createFile("---\ntag: daily\n---\n");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#daily"]));
  });

  // ─── Inline markdown tags ─────────────────────────────────
  it("parses inline #tags from body", async () => {
    const file = await createFile("Some text #daily and #project here");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#daily", "#project"]));
  });

  it("parses inline tags at line start", async () => {
    const file = await createFile("#daily is important");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#daily"]));
  });

  // ─── Hierarchy / nested tags ──────────────────────────────
  it("parses hierarchy tags from frontmatter", async () => {
    const file = await createFile("---\ntags: project/backend\n---\n");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#project/backend"]));
  });

  it("parses hierarchy inline tags", async () => {
    const file = await createFile("Text #project/frontend here");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#project/frontend"]));
  });

  // ─── Mixed: frontmatter + inline ──────────────────────────
  it("combines frontmatter and inline tags", async () => {
    const file = await createFile(
      "---\ntags: daily\n---\nSome text #weekly here"
    );
    const tags = file.readTags();
    expect(tags.has("#daily")).toBe(true);
    expect(tags.has("#weekly")).toBe(true);
  });

  // ─── Edge cases ───────────────────────────────────────────
  it("returns empty set for no tags", async () => {
    const file = await createFile("Just plain text, no tags");
    const tags = file.readTags();
    expect(tags.size).toBe(0);
  });

  it("returns empty set for empty content", async () => {
    const file = await createFile("");
    const tags = file.readTags();
    expect(tags.size).toBe(0);
  });

  it("does not treat header ## as a tag", async () => {
    const file = await createFile("## Heading\nSome text");
    const tags = file.readTags();
    // "## Heading" should not produce a tag
    expect(tags.size).toBe(0);
  });

  // ─── Unicode tags ─────────────────────────────────────────
  it("parses unicode tags from frontmatter", async () => {
    const file = await createFile("---\ntags: проект\n---\n");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#проект"]));
  });

  it("parses unicode inline tags", async () => {
    const file = await createFile("Текст #проект здесь");
    const tags = file.readTags();
    expect(tags).toEqual(new Set(["#проект"]));
  });
});
