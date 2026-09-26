// src/lib/__tests__/externalFrameResolver.test.ts
// Unit tests for resolveExternalFrame — sibling-project DataFrame lookup used
// by Pillar 5 cross-source correlation (Join / Scatter).

import { resolveExternalFrame } from "../externalFrameResolver";

// Mock the three DataSource implementations so the resolver can be tested in
// isolation without touching Obsidian runtime or the vault.
jest.mock("src/lib/datasources/folder/datasource", () => ({
  FolderDataSource: jest.fn(),
}));
jest.mock("src/lib/datasources/tag/datasource", () => ({
  TagDataSource: jest.fn(),
}));
jest.mock("src/lib/datasources/dataview/datasource", () => ({
  DataviewDataSource: jest.fn(),
}));

// Retrieve the mocked constructors after jest.mock rewrites them.
const { FolderDataSource } = require("src/lib/datasources/folder/datasource");
const { TagDataSource } = require("src/lib/datasources/tag/datasource");
const { DataviewDataSource } = require("src/lib/datasources/dataview/datasource");

const EMPTY_FRAME = { fields: [], records: [] } as const;

function makeProject(
  id: string,
  kind: "folder" | "tag" | "dataview"
): any {
  const base: any = {
    id,
    name: `project-${id}`,
    isDefault: false,
    excludedNotes: [],
    views: [],
  };
  if (kind === "folder") {
    base.dataSource = {
      kind: "folder",
      config: { path: "Projects", recursive: true },
    };
  } else if (kind === "tag") {
    base.dataSource = {
      kind: "tag",
      config: { tag: "#project" },
    };
  } else {
    base.dataSource = {
      kind: "dataview",
      config: { query: "FROM #project" },
    };
  }
  return base;
}

function makeDeps(overrides: any = {}): any {
  return {
    fileSystem: {},
    preferences: {},
    projects: [],
    dataviewApi: undefined,
    app: undefined,
    ...overrides,
  };
}

describe("resolveExternalFrame", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when the project id is not found", async () => {
    const result = await resolveExternalFrame("missing-id", makeDeps());
    expect(result).toBeNull();
    expect(FolderDataSource).not.toHaveBeenCalled();
    expect(TagDataSource).not.toHaveBeenCalled();
    expect(DataviewDataSource).not.toHaveBeenCalled();
  });

  it("resolves a folder-kind project via FolderDataSource.queryAll()", async () => {
    const queryAll = jest.fn().mockResolvedValue(EMPTY_FRAME);
    (FolderDataSource as jest.Mock).mockImplementation(() => ({ queryAll }));
    const project = makeProject("p1", "folder");
    const result = await resolveExternalFrame(
      "p1",
      makeDeps({ projects: [project] })
    );
    expect(FolderDataSource).toHaveBeenCalledTimes(1);
    expect(queryAll).toHaveBeenCalledTimes(1);
    expect(result).toBe(EMPTY_FRAME);
  });

  it("resolves a tag-kind project via TagDataSource.queryAll()", async () => {
    const queryAll = jest.fn().mockResolvedValue(EMPTY_FRAME);
    (TagDataSource as jest.Mock).mockImplementation(() => ({ queryAll }));
    const project = makeProject("p2", "tag");
    const result = await resolveExternalFrame(
      "p2",
      makeDeps({ projects: [project] })
    );
    expect(TagDataSource).toHaveBeenCalledTimes(1);
    expect(queryAll).toHaveBeenCalledTimes(1);
    expect(result).toBe(EMPTY_FRAME);
  });

  it("returns null for a dataview-kind project when dataviewApi is absent", async () => {
    const project = makeProject("p3", "dataview");
    const result = await resolveExternalFrame(
      "p3",
      makeDeps({ projects: [project], dataviewApi: undefined })
    );
    expect(result).toBeNull();
    expect(DataviewDataSource).not.toHaveBeenCalled();
  });

  it("resolves a dataview-kind project when dataviewApi is provided", async () => {
    const queryAll = jest.fn().mockResolvedValue(EMPTY_FRAME);
    (DataviewDataSource as jest.Mock).mockImplementation(() => ({ queryAll }));
    const project = makeProject("p4", "dataview");
    const result = await resolveExternalFrame(
      "p4",
      makeDeps({ projects: [project], dataviewApi: {} as any })
    );
    expect(DataviewDataSource).toHaveBeenCalledTimes(1);
    expect(queryAll).toHaveBeenCalledTimes(1);
    expect(result).toBe(EMPTY_FRAME);
  });

  it("returns null and does not throw when the DataSource rejects", async () => {
    const queryAll = jest.fn().mockRejectedValue(new Error("boom"));
    (FolderDataSource as jest.Mock).mockImplementation(() => ({ queryAll }));
    const project = makeProject("p5", "folder");
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const result = await resolveExternalFrame(
      "p5",
      makeDeps({ projects: [project] })
    );
    expect(result).toBeNull();
    // console.warn is throttled per-projectId; ensure at least one call landed.
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// M2-C6 (architect-F1-F3-2026-09-17): the host frame gets its project's
// declared field types (View → applyDeclaredFieldTypes); an external frame did
// not, so a single `[[…]]` stayed a String there — linked-selection validation
// failed and the settings picker could not list the field.
describe("an external frame carries its project's declared relation types", () => {
  it("a declared single-link relation is a Relation with its backlinks", async () => {
    const frame = {
      fields: [
        { name: "name", type: "string", repeated: false, identifier: true, derived: false },
        { name: "client", type: "string", repeated: false, identifier: false, derived: false },
      ],
      records: [
        { id: "Sessions/S1.md", values: { name: "S1", client: "[[Alice]]" } },
        { id: "Alice.md", values: { name: "Alice" } },
      ],
    };
    const queryAll = jest.fn().mockResolvedValue(frame);
    (FolderDataSource as jest.Mock).mockImplementation(() => ({ queryAll }));
    const project = { ...makeProject("s", "folder"), fieldConfig: { client: { relation: { targetProjectId: "s" } } } };
    const result = await resolveExternalFrame("s", makeDeps({ projects: [project] }));
    expect(result?.fields.find((f) => f.name === "client")?.type).toBe("relation");
    expect(result?.fields.some((f) => f.name === "client_backlinks")).toBe(true);
  });

  it("a project without declared relations is returned as it came", async () => {
    const frame = { fields: [{ name: "name", type: "string", repeated: false, identifier: true, derived: false }], records: [] };
    const queryAll = jest.fn().mockResolvedValue(frame);
    (FolderDataSource as jest.Mock).mockImplementation(() => ({ queryAll }));
    const result = await resolveExternalFrame("p", makeDeps({ projects: [makeProject("p", "folder")] }));
    expect(result).toBe(frame);
  });
});
