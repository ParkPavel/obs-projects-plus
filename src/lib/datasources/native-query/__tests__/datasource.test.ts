/**
 * Tests for NativeQueryDataSource (#048) — the persisted datasource adapter
 * over the pure native-query layer (#045.2).
 *
 * Covers:
 *   - queryAll: FROM folder/tag + WHERE (canonical filterEvaluator) + LIMIT
 *   - includes: delegation to the inner folder source (recursion,
 *     excludedNotes)
 *   - queryOne: full re-query semantics (mirrors DataviewDataSource)
 *   - createDataSource factory resolution for kind "native-query"
 */

import { describe, it, expect } from "@jest/globals";
import { InMemFileSystem } from "src/lib/filesystem/inmem/filesystem";
import type {
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import type { NativeQueryDataSource as NativeQueryDataSourceConfig } from "src/settings/v3/settings";

import { createDataSource } from "../..";
import { NativeQueryDataSource } from "../datasource";

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
  replaceObsidianProperties: false,
};

function makeProject(
  dataSource: NativeQueryDataSourceConfig,
  excludedNotes: string[] = []
): ProjectDefinition {
  return {
    name: "nq-test",
    id: "nq-test",
    fieldConfig: {},
    views: [],
    defaultName: "",
    templates: [],
    excludedNotes,
    isDefault: false,
    dataSource,
    newNotesFolder: "",
  };
}

async function makeFs(
  files: Record<string, string>
): Promise<InMemFileSystem> {
  const fs = new InMemFileSystem({});
  for (const [path, content] of Object.entries(files)) {
    await fs.create(path, content);
  }
  return fs;
}

function fm(values: Record<string, string | number | boolean>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(values)) {
    lines.push(`${k}: ${typeof v === "string" ? v : String(v)}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

describe("NativeQueryDataSource — queryAll", () => {
  it("applies WHERE over a folder source", async () => {
    const fs = await makeFs({
      "Work/a.md": fm({ status: "done" }),
      "Work/b.md": fm({ status: "open" }),
      "Work/c.md": fm({ status: "done" }),
    });
    const project = makeProject({
      kind: "native-query",
      config: {
        from: { kind: "folder", path: "Work", recursive: false },
        where: {
          conjunction: "and",
          conditions: [
            { field: "status", operator: "is", value: "done", enabled: true },
          ],
        },
      },
    });
    const source = new NativeQueryDataSource(fs, project, defaultPrefs);
    const frame = await source.queryAll();
    const paths = frame.records.map((r) => r.id).sort();
    expect(paths).toEqual(["Work/a.md", "Work/c.md"]);
  });

  it("applies LIMIT after WHERE", async () => {
    const fs = await makeFs({
      "Work/a.md": fm({ n: 1 }),
      "Work/b.md": fm({ n: 2 }),
      "Work/c.md": fm({ n: 3 }),
    });
    const project = makeProject({
      kind: "native-query",
      config: {
        from: { kind: "folder", path: "Work", recursive: false },
        limit: 2,
      },
    });
    const source = new NativeQueryDataSource(fs, project, defaultPrefs);
    const frame = await source.queryAll();
    expect(frame.records.length).toBe(2);
  });

  it("reads from a tag source", async () => {
    const fs = await makeFs({
      "a.md": "---\ntags: daily\n---\n",
      "b.md": "---\ntags: project\n---\n",
    });
    const project = makeProject({
      kind: "native-query",
      config: {
        from: { kind: "tag", tag: "#daily", hierarchy: false },
      },
    });
    const source = new NativeQueryDataSource(fs, project, defaultPrefs);
    const frame = await source.queryAll();
    expect(frame.records.map((r) => r.id)).toEqual(["a.md"]);
  });

  it("honours excludedNotes from the project", async () => {
    const fs = await makeFs({
      "Work/a.md": fm({ n: 1 }),
      "Work/b.md": fm({ n: 2 }),
    });
    const project = makeProject(
      {
        kind: "native-query",
        config: {
          from: { kind: "folder", path: "Work", recursive: false },
        },
      },
      ["Work/b.md"]
    );
    const source = new NativeQueryDataSource(fs, project, defaultPrefs);
    const frame = await source.queryAll();
    expect(frame.records.map((r) => r.id)).toEqual(["Work/a.md"]);
  });
});

describe("NativeQueryDataSource — includes", () => {
  it("delegates folder membership to the inner source", async () => {
    const fs = await makeFs({});
    const project = makeProject(
      {
        kind: "native-query",
        config: {
          from: { kind: "folder", path: "Work", recursive: false },
        },
      },
      ["Work/excluded.md"]
    );
    const source = new NativeQueryDataSource(fs, project, defaultPrefs);
    expect(source.includes("Work/a.md")).toBe(true);
    expect(source.includes("Work/Sub/a.md")).toBe(false);
    expect(source.includes("Other/a.md")).toBe(false);
    expect(source.includes("Work/excluded.md")).toBe(false);
  });

  it("respects recursive folder membership", async () => {
    const fs = await makeFs({});
    const project = makeProject({
      kind: "native-query",
      config: {
        from: { kind: "folder", path: "Work", recursive: true },
      },
    });
    const source = new NativeQueryDataSource(fs, project, defaultPrefs);
    expect(source.includes("Work/Sub/Deep/a.md")).toBe(true);
    expect(source.includes("Other/a.md")).toBe(false);
  });
});

describe("NativeQueryDataSource — queryOne", () => {
  it("re-runs the full query so WHERE membership stays correct", async () => {
    const fs = await makeFs({
      "Work/a.md": fm({ status: "done" }),
      "Work/b.md": fm({ status: "open" }),
    });
    const project = makeProject({
      kind: "native-query",
      config: {
        from: { kind: "folder", path: "Work", recursive: false },
        where: {
          conjunction: "and",
          conditions: [
            { field: "status", operator: "is", value: "done", enabled: true },
          ],
        },
      },
    });
    const source = new NativeQueryDataSource(fs, project, defaultPrefs);
    const file = fs.getFile("Work/b.md");
    expect(file).toBeTruthy();
    if (!file) return;
    const frame = await source.queryOne(file, []);
    expect(frame.records.map((r) => r.id)).toEqual(["Work/a.md"]);
  });
});

describe("createDataSource factory — native-query", () => {
  it("resolves kind native-query to NativeQueryDataSource without Dataview", async () => {
    const fs = await makeFs({});
    const project = makeProject({
      kind: "native-query",
      config: {
        from: { kind: "folder", path: "Work", recursive: false },
      },
    });
    const resolution = createDataSource(project, {
      fileSystem: fs,
      preferences: defaultPrefs,
      dataviewApi: undefined,
    });
    expect(resolution.kind).toBe("ok");
    if (resolution.kind === "ok") {
      expect(resolution.source).toBeInstanceOf(NativeQueryDataSource);
    }
  });
});
