/**
 * NativeQueryDataSource — persisted datasource adapter over the pure
 * native-query layer (#045.2).
 *
 * Ticket: #048 (M-UX) — gives `executeNativeQuery` a UI entry point by
 * registering `kind: "native-query"` as a real `ProjectDefinition`
 * datasource. The adapter stays thin:
 *
 *   - `queryAll()` delegates to `executeNativeQuery` (FROM → WHERE →
 *     LIMIT through the canonical `filterEvaluator`).
 *   - `includes()` delegates to an inner folder/tag source built from a
 *     synthesized project, so membership semantics (recursion, hierarchy,
 *     excludedNotes) stay identical to the underlying source.
 *   - `queryOne()` re-runs the full query, mirroring `DataviewDataSource`:
 *     a single-record merge cannot express a record entering or leaving
 *     the WHERE-narrowed set.
 */

import type { DataField, DataFrame } from "src/lib/dataframe/dataframe";
import type { IFile, IFileSystem } from "src/lib/filesystem/filesystem";
import type {
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";

import { DataSource } from "..";
import { FolderDataSource } from "../folder/datasource";
import { TagDataSource } from "../tag/datasource";
import { executeNativeQuery, type NativeQuery } from "./nativeQuery";

export class NativeQueryDataSource extends DataSource {
  private readonly inner: FolderDataSource | TagDataSource;

  constructor(
    readonly fileSystem: IFileSystem,
    project: ProjectDefinition,
    preferences: ProjectsPluginPreferences
  ) {
    super(project, preferences);
    this.inner = buildInnerSource(fileSystem, project, preferences);
  }

  async queryAll(): Promise<DataFrame> {
    const query = this.toNativeQuery();
    return executeNativeQuery(query, {
      fileSystem: this.fileSystem,
      preferences: this.preferences,
      excludedNotes: this.project.excludedNotes,
    });
  }

  async queryOne(_file: IFile, _fields: DataField[]): Promise<DataFrame> {
    return this.queryAll();
  }

  includes(path: string): boolean {
    return this.inner.includes(path);
  }

  private toNativeQuery(): NativeQuery {
    if (this.project.dataSource.kind !== "native-query") {
      throw new Error("NativeQueryDataSource requires a native-query project");
    }
    const { from, where, limit } = this.project.dataSource.config;
    const query: NativeQuery = {
      from:
        from.kind === "folder"
          ? { kind: "folder", path: from.path, recursive: from.recursive }
          : { kind: "tag", tag: from.tag, hierarchy: from.hierarchy },
      ...(where ? { where } : {}),
      ...(typeof limit === "number" && limit > 0 ? { limit } : {}),
    };
    return query;
  }
}

/**
 * Build the inner folder/tag source carrying the same project identity and
 * `excludedNotes`, but with the datasource swapped to the `from` clause.
 * The concrete sources guard on `dataSource.kind`, so the swap is required
 * for their `includes()` to engage.
 */
function buildInnerSource(
  fileSystem: IFileSystem,
  project: ProjectDefinition,
  preferences: ProjectsPluginPreferences
): FolderDataSource | TagDataSource {
  if (project.dataSource.kind !== "native-query") {
    throw new Error("NativeQueryDataSource requires a native-query project");
  }
  const from = project.dataSource.config.from;
  if (from.kind === "folder") {
    const innerProject: ProjectDefinition = {
      ...project,
      dataSource: {
        kind: "folder",
        config: { path: from.path, recursive: from.recursive },
      },
    };
    return new FolderDataSource(fileSystem, innerProject, preferences);
  }
  const innerProject: ProjectDefinition = {
    ...project,
    dataSource: {
      kind: "tag",
      config: { tag: from.tag, hierarchy: from.hierarchy },
    },
  };
  return new TagDataSource(fileSystem, innerProject, preferences);
}
