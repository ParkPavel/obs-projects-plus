/**
 * FolderDataSource.includes — path-filtering logic (R5-014).
 *
 * Tests the non-recursive and recursive folder matching plus exclusion rules.
 * Uses a stub IFileSystem since `includes()` is pure (no async I/O).
 */

import { describe, expect, it } from "@jest/globals";
import { InMemFileSystem } from "src/lib/filesystem/inmem/filesystem";
import type {
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import { FolderDataSource } from "./datasource";

const defaultPrefs: ProjectsPluginPreferences = {
  projectSizeLimit: 1000,
  frontmatter: { quoteStrings: "PLAIN" },
  locale: { firstDayOfWeek: "monday" },
  commands: [],
  linkBehavior: "open-editor",
  mobileCalendarView: "month",
  showViewTitles: true,
  animationBehavior: "smooth",
  disableHapticFeedback: false,
};

function makeProject(
  path: string,
  recursive: boolean,
  excludedNotes: string[] = [],
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
    dataSource: { kind: "folder", config: { path, recursive } },
  };
}

function makeSource(
  path: string,
  recursive: boolean,
  excludedNotes: string[] = [],
): FolderDataSource {
  const fs = new InMemFileSystem({});
  return new FolderDataSource(fs, makeProject(path, recursive, excludedNotes), defaultPrefs);
}

describe("FolderDataSource.includes", () => {
  describe("non-recursive", () => {
    it("includes file directly in folder", () => {
      const src = makeSource("Work", false);
      expect(src.includes("Work/Note.md")).toBe(true);
    });

    it("excludes file in sub-folder", () => {
      const src = makeSource("Work", false);
      expect(src.includes("Work/Meetings/Note.md")).toBe(false);
    });

    it("excludes file outside folder", () => {
      const src = makeSource("Work", false);
      expect(src.includes("Personal/Note.md")).toBe(false);
    });

    it("includes file in root when path is /", () => {
      const src = makeSource("/", false);
      expect(src.includes("Note.md")).toBe(true);
    });

    it("excludes sub-folder file when path is / and non-recursive", () => {
      const src = makeSource("/", false);
      expect(src.includes("Work/Note.md")).toBe(false);
    });
  });

  describe("recursive", () => {
    it("includes file directly in folder", () => {
      const src = makeSource("Work", true);
      expect(src.includes("Work/Note.md")).toBe(true);
    });

    it("includes file in sub-folder", () => {
      const src = makeSource("Work", true);
      expect(src.includes("Work/Meetings/2024/Note.md")).toBe(true);
    });

    it("excludes file outside folder", () => {
      const src = makeSource("Work", true);
      expect(src.includes("Personal/Note.md")).toBe(false);
    });

    it("includes file at any depth under root /", () => {
      const src = makeSource("/", true);
      expect(src.includes("Work/Meetings/Note.md")).toBe(true);
    });
  });

  describe("excluded notes", () => {
    it("excludes note by exact path", () => {
      const src = makeSource("Work", false, ["Work/Secret.md"]);
      expect(src.includes("Work/Secret.md")).toBe(false);
    });

    it("includes non-excluded notes in same folder", () => {
      const src = makeSource("Work", false, ["Work/Secret.md"]);
      expect(src.includes("Work/Public.md")).toBe(true);
    });

    it("exclusion takes precedence over recursive match", () => {
      const src = makeSource("Work", true, ["Work/Sub/Hidden.md"]);
      expect(src.includes("Work/Sub/Hidden.md")).toBe(false);
      expect(src.includes("Work/Sub/Visible.md")).toBe(true);
    });
  });

  describe("path prefix collision guard", () => {
    it("does not include WorkExtra/Note.md for Work folder", () => {
      const src = makeSource("Work", false);
      expect(src.includes("WorkExtra/Note.md")).toBe(false);
    });

    it("does not include WorkExtra/Note.md for Work folder (recursive)", () => {
      const src = makeSource("Work", true);
      expect(src.includes("WorkExtra/Sub/Note.md")).toBe(false);
    });
  });
});
