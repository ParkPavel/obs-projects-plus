// src/lib/datasources/__tests__/createDataSource.test.ts
// Unit tests for createDataSource — the single construction site for
// DataSource instances (#045.1). Verifies dispatch per `kind` and graceful
// degradation when the Dataview API is absent.

// Mock the three DataSource implementations so the factory can be tested in
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
/* eslint-disable @typescript-eslint/no-var-requires */
const { FolderDataSource } = require("src/lib/datasources/folder/datasource");
const { TagDataSource } = require("src/lib/datasources/tag/datasource");
const { DataviewDataSource } = require("src/lib/datasources/dataview/datasource");
const { createDataSource } = require("src/lib/datasources");
/* eslint-enable @typescript-eslint/no-var-requires */

function makeProject(
  kind: "folder" | "tag" | "dataview"
): any {
  const base: any = {
    id: `p-${kind}`,
    name: `project-${kind}`,
    isDefault: false,
    excludedNotes: [],
    views: [],
    fieldConfig: {},
    defaultName: "",
    templates: [],
    newNotesFolder: "",
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

function makeDeps(dataviewApi: unknown = undefined): any {
  return {
    fileSystem: {},
    preferences: {},
    dataviewApi,
  };
}

describe("createDataSource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("constructs FolderDataSource for kind 'folder'", () => {
    (FolderDataSource as jest.Mock).mockImplementation(() => ({ tag: "folder" }));
    const result = createDataSource(makeProject("folder"), makeDeps());
    expect(result.kind).toBe("ok");
    expect(FolderDataSource).toHaveBeenCalledTimes(1);
    expect(TagDataSource).not.toHaveBeenCalled();
    expect(DataviewDataSource).not.toHaveBeenCalled();
  });

  it("constructs TagDataSource for kind 'tag'", () => {
    (TagDataSource as jest.Mock).mockImplementation(() => ({ tag: "tag" }));
    const result = createDataSource(makeProject("tag"), makeDeps());
    expect(result.kind).toBe("ok");
    expect(TagDataSource).toHaveBeenCalledTimes(1);
    expect(FolderDataSource).not.toHaveBeenCalled();
    expect(DataviewDataSource).not.toHaveBeenCalled();
  });

  it("constructs DataviewDataSource for kind 'dataview' when api is present", () => {
    (DataviewDataSource as jest.Mock).mockImplementation(() => ({ tag: "dv" }));
    const result = createDataSource(
      makeProject("dataview"),
      makeDeps({ stub: true })
    );
    expect(result.kind).toBe("ok");
    expect(DataviewDataSource).toHaveBeenCalledTimes(1);
    expect(FolderDataSource).not.toHaveBeenCalled();
    expect(TagDataSource).not.toHaveBeenCalled();
  });

  it("returns 'unavailable' for kind 'dataview' when api is undefined", () => {
    const result = createDataSource(makeProject("dataview"), makeDeps(undefined));
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expect(result.reason).toBe("dataview-unavailable");
    }
    expect(DataviewDataSource).not.toHaveBeenCalled();
  });

  it("does not call any other source constructor when degrading", () => {
    createDataSource(makeProject("dataview"), makeDeps(undefined));
    expect(FolderDataSource).not.toHaveBeenCalled();
    expect(TagDataSource).not.toHaveBeenCalled();
  });

  it("passes fileSystem, project, and preferences to the constructor", () => {
    (FolderDataSource as jest.Mock).mockImplementation(() => ({}));
    const fs = { marker: "fs" };
    const prefs = { marker: "prefs" };
    const project = makeProject("folder");
    createDataSource(project, {
      fileSystem: fs,
      preferences: prefs,
      dataviewApi: undefined,
    });
    expect(FolderDataSource).toHaveBeenCalledWith(fs, project, prefs);
  });

  it("passes dataviewApi as the 4th arg to DataviewDataSource", () => {
    (DataviewDataSource as jest.Mock).mockImplementation(() => ({}));
    const fs = { marker: "fs" };
    const prefs = { marker: "prefs" };
    const api = { marker: "dvApi" };
    const project = makeProject("dataview");
    createDataSource(project, {
      fileSystem: fs,
      preferences: prefs,
      dataviewApi: api as any,
    });
    expect(DataviewDataSource).toHaveBeenCalledWith(fs, project, prefs, api);
  });

  it("falls back to FolderDataSource for unknown source kind via default branch", () => {
    (FolderDataSource as jest.Mock).mockImplementation(() => ({}));
    const project: any = makeProject("folder");
    project.dataSource = { kind: "unknown-future-kind" as any, config: {} };
    const result = createDataSource(project, makeDeps());
    expect(result.kind).toBe("ok");
    expect(FolderDataSource).toHaveBeenCalledTimes(1);
  });
});
