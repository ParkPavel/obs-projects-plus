/**
 * Tests for the native-query lightweight ad-hoc layer (#045.2).
 *
 * Validates the four-stage pipeline:
 *   1. FROM   — folder & tag sources via existing datasource classes
 *   2. WHERE  — canonical `applyFilter` integration
 *   3. SORT   — multi-criterion, enabled-only, empty-values-last semantics
 *   4. LIMIT  — head-slice with sane edge-case behaviour
 *
 * Plus a few composability and purity assertions.
 */

import { describe, it, expect } from "@jest/globals";
import { InMemFileSystem } from "src/lib/filesystem/inmem/filesystem";
import type { ProjectsPluginPreferences } from "src/settings/settings";
import type {
  FilterDefinition,
  SortDefinition,
} from "src/settings/base/settings";

import {
  applyLimit,
  applySort,
  executeNativeQuery,
  type NativeQuery,
} from "../nativeQuery";
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";

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

// ─── FROM ──────────────────────────────────────────────────────────────

describe("executeNativeQuery — FROM folder", () => {
  it("reads files from a non-recursive folder", async () => {
    const fs = await makeFs({
      "Work/a.md": fm({ title: "A" }),
      "Work/b.md": fm({ title: "B" }),
      "Work/Sub/c.md": fm({ title: "C" }),
      "Other/d.md": fm({ title: "D" }),
    });
    const frame = await executeNativeQuery(
      { from: { kind: "folder", path: "Work", recursive: false } },
      { fileSystem: fs, preferences: defaultPrefs }
    );
    const paths = frame.records.map((r) => r.id).sort();
    expect(paths).toEqual(["Work/a.md", "Work/b.md"]);
  });

  it("reads files recursively when recursive=true", async () => {
    const fs = await makeFs({
      "Work/a.md": fm({ title: "A" }),
      "Work/Sub/b.md": fm({ title: "B" }),
      "Work/Sub/Deep/c.md": fm({ title: "C" }),
      "Other/d.md": fm({ title: "D" }),
    });
    const frame = await executeNativeQuery(
      { from: { kind: "folder", path: "Work", recursive: true } },
      { fileSystem: fs, preferences: defaultPrefs }
    );
    const paths = frame.records.map((r) => r.id).sort();
    expect(paths).toEqual(["Work/Sub/Deep/c.md", "Work/Sub/b.md", "Work/a.md"]);
  });

  it("honours excludedNotes from deps", async () => {
    const fs = await makeFs({
      "Work/a.md": fm({ title: "A" }),
      "Work/b.md": fm({ title: "B" }),
    });
    const frame = await executeNativeQuery(
      { from: { kind: "folder", path: "Work", recursive: false } },
      {
        fileSystem: fs,
        preferences: defaultPrefs,
        excludedNotes: ["Work/b.md"],
      }
    );
    const paths = frame.records.map((r) => r.id);
    expect(paths).toEqual(["Work/a.md"]);
  });
});

describe("executeNativeQuery — FROM tag", () => {
  it("reads files matching an exact tag", async () => {
    const fs = await makeFs({
      "a.md": "---\ntags: daily\n---\n",
      "b.md": "---\ntags: project\n---\n",
      "c.md": "---\ntags: daily\n---\n",
    });
    const frame = await executeNativeQuery(
      { from: { kind: "tag", tag: "#daily" } },
      { fileSystem: fs, preferences: defaultPrefs }
    );
    const paths = frame.records.map((r) => r.id).sort();
    expect(paths).toEqual(["a.md", "c.md"]);
  });

  it("respects hierarchy=true for nested tags", async () => {
    const fs = await makeFs({
      "a.md": "---\ntags: project/frontend\n---\n",
      "b.md": "---\ntags: project/backend\n---\n",
      "c.md": "---\ntags: other\n---\n",
    });
    const frame = await executeNativeQuery(
      { from: { kind: "tag", tag: "#project", hierarchy: true } },
      { fileSystem: fs, preferences: defaultPrefs }
    );
    const paths = frame.records.map((r) => r.id).sort();
    expect(paths).toEqual(["a.md", "b.md"]);
  });
});

// ─── WHERE ─────────────────────────────────────────────────────────────

describe("executeNativeQuery — WHERE", () => {
  it("applies a simple equality filter through filterEvaluator", async () => {
    const fs = await makeFs({
      "Notes/a.md": fm({ status: "done" }),
      "Notes/b.md": fm({ status: "todo" }),
      "Notes/c.md": fm({ status: "done" }),
    });
    const where: FilterDefinition = {
      conjunction: "and",
      conditions: [
        { field: "status", operator: "is", value: "done", enabled: true },
      ],
    };
    const frame = await executeNativeQuery(
      { from: { kind: "folder", path: "Notes", recursive: false }, where },
      { fileSystem: fs, preferences: defaultPrefs }
    );
    expect(frame.records.map((r) => r.id).sort()).toEqual([
      "Notes/a.md",
      "Notes/c.md",
    ]);
  });

  it("treats an empty FilterDefinition as a no-op", async () => {
    const fs = await makeFs({
      "Notes/a.md": fm({ status: "done" }),
      "Notes/b.md": fm({ status: "todo" }),
    });
    const where: FilterDefinition = { conditions: [] };
    const frame = await executeNativeQuery(
      { from: { kind: "folder", path: "Notes", recursive: false }, where },
      { fileSystem: fs, preferences: defaultPrefs }
    );
    expect(frame.records).toHaveLength(2);
  });

  it("supports nested groups via the canonical engine", async () => {
    const fs = await makeFs({
      "Notes/a.md": fm({ status: "done", priority: 1 }),
      "Notes/b.md": fm({ status: "done", priority: 5 }),
      "Notes/c.md": fm({ status: "todo", priority: 1 }),
    });
    const where: FilterDefinition = {
      conjunction: "and",
      conditions: [
        { field: "status", operator: "is", value: "done", enabled: true },
      ],
      groups: [
        {
          conjunction: "or",
          conditions: [
            { field: "priority", operator: "lt", value: "3", enabled: true },
          ],
        },
      ],
    };
    const frame = await executeNativeQuery(
      { from: { kind: "folder", path: "Notes", recursive: false }, where },
      { fileSystem: fs, preferences: defaultPrefs }
    );
    expect(frame.records.map((r) => r.id)).toEqual(["Notes/a.md"]);
  });
});

// ─── SORT ──────────────────────────────────────────────────────────────

describe("applySort", () => {
  const baseFrame: DataFrame = {
    fields: [
      { name: "name", type: DataFieldType.String, identifier: true, derived: true, repeated: false, typeConfig: {} },
      { name: "score", type: DataFieldType.Number, identifier: false, derived: false, repeated: false, typeConfig: {} },
      { name: "created", type: DataFieldType.Date, identifier: false, derived: false, repeated: false, typeConfig: {} },
    ],
    records: [
      { id: "a.md", values: { name: "alpha", score: 2, created: new Date("2024-03-01") } },
      { id: "b.md", values: { name: "beta", score: 1, created: new Date("2024-01-01") } },
      { id: "c.md", values: { name: "gamma", score: 3, created: new Date("2024-02-01") } },
    ],
  };

  it("sorts ascending by number", () => {
    const sort: SortDefinition = {
      criteria: [{ field: "score", order: "asc", enabled: true }],
    };
    const sorted = applySort(baseFrame, sort);
    expect(sorted.records.map((r) => r.id)).toEqual(["b.md", "a.md", "c.md"]);
  });

  it("sorts descending by number", () => {
    const sort: SortDefinition = {
      criteria: [{ field: "score", order: "desc", enabled: true }],
    };
    const sorted = applySort(baseFrame, sort);
    expect(sorted.records.map((r) => r.id)).toEqual(["c.md", "a.md", "b.md"]);
  });

  it("sorts by date ascending", () => {
    const sort: SortDefinition = {
      criteria: [{ field: "created", order: "asc", enabled: true }],
    };
    const sorted = applySort(baseFrame, sort);
    expect(sorted.records.map((r) => r.id)).toEqual(["b.md", "c.md", "a.md"]);
  });

  it("ignores disabled criteria", () => {
    const sort: SortDefinition = {
      criteria: [{ field: "score", order: "desc", enabled: false }],
    };
    const sorted = applySort(baseFrame, sort);
    // No active criteria → original order preserved.
    expect(sorted.records.map((r) => r.id)).toEqual(["a.md", "b.md", "c.md"]);
  });

  it("uses secondary criterion to break ties", () => {
    const tieFrame: DataFrame = {
      fields: baseFrame.fields,
      records: [
        { id: "a.md", values: { name: "alpha", score: 1 } },
        { id: "b.md", values: { name: "beta", score: 1 } },
        { id: "c.md", values: { name: "gamma", score: 2 } },
      ],
    };
    const sort: SortDefinition = {
      criteria: [
        { field: "score", order: "asc", enabled: true },
        { field: "name", order: "desc", enabled: true },
      ],
    };
    const sorted = applySort(tieFrame, sort);
    expect(sorted.records.map((r) => r.id)).toEqual(["b.md", "a.md", "c.md"]);
  });

  it("sorts undefined values to the end regardless of direction", () => {
    const sparseFrame: DataFrame = {
      fields: baseFrame.fields,
      records: [
        { id: "a.md", values: { score: 5 } },
        { id: "b.md", values: {} },
        { id: "c.md", values: { score: 1 } },
      ],
    };
    const ascSort: SortDefinition = {
      criteria: [{ field: "score", order: "asc", enabled: true }],
    };
    const ascSorted = applySort(sparseFrame, ascSort);
    expect(ascSorted.records.map((r) => r.id)).toEqual(["c.md", "a.md", "b.md"]);
    const descSort: SortDefinition = {
      criteria: [{ field: "score", order: "desc", enabled: true }],
    };
    const descSorted = applySort(sparseFrame, descSort);
    expect(descSorted.records.map((r) => r.id)).toEqual(["a.md", "c.md", "b.md"]);
  });

  it("does not mutate the input frame", () => {
    const sort: SortDefinition = {
      criteria: [{ field: "score", order: "desc", enabled: true }],
    };
    const originalOrder = baseFrame.records.map((r) => r.id);
    applySort(baseFrame, sort);
    expect(baseFrame.records.map((r) => r.id)).toEqual(originalOrder);
  });
});

// ─── LIMIT ─────────────────────────────────────────────────────────────

describe("applyLimit", () => {
  const frame: DataFrame = {
    fields: [],
    records: [
      { id: "a", values: {} },
      { id: "b", values: {} },
      { id: "c", values: {} },
      { id: "d", values: {} },
    ],
  };

  it("slices to the requested size", () => {
    const out = applyLimit(frame, 2);
    expect(out.records.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("returns the same frame when limit >= record count", () => {
    const out = applyLimit(frame, 10);
    expect(out.records.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("treats zero or negative as no-op", () => {
    expect(applyLimit(frame, 0).records).toHaveLength(4);
    expect(applyLimit(frame, -5).records).toHaveLength(4);
  });

  it("floors fractional limits", () => {
    const out = applyLimit(frame, 2.9);
    expect(out.records.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

// ─── Composability + purity ────────────────────────────────────────────

describe("executeNativeQuery — composition", () => {
  it("composes WHERE → SORT → LIMIT", async () => {
    const fs = await makeFs({
      "Notes/a.md": fm({ status: "done", score: 3 }),
      "Notes/b.md": fm({ status: "done", score: 1 }),
      "Notes/c.md": fm({ status: "done", score: 2 }),
      "Notes/d.md": fm({ status: "todo", score: 5 }),
    });
    const query: NativeQuery = {
      from: { kind: "folder", path: "Notes", recursive: false },
      where: {
        conjunction: "and",
        conditions: [
          { field: "status", operator: "is", value: "done", enabled: true },
        ],
      },
      sort: {
        criteria: [{ field: "score", order: "desc", enabled: true }],
      },
      limit: 2,
    };
    const frame = await executeNativeQuery(query, {
      fileSystem: fs,
      preferences: defaultPrefs,
    });
    expect(frame.records.map((r) => r.id)).toEqual(["Notes/a.md", "Notes/c.md"]);
  });

  it("treats limit=undefined as unlimited", async () => {
    const fs = await makeFs({
      "Notes/a.md": fm({ title: "A" }),
      "Notes/b.md": fm({ title: "B" }),
      "Notes/c.md": fm({ title: "C" }),
    });
    const frame = await executeNativeQuery(
      { from: { kind: "folder", path: "Notes", recursive: false } },
      { fileSystem: fs, preferences: defaultPrefs }
    );
    expect(frame.records).toHaveLength(3);
  });
});
