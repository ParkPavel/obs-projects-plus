import type { DataviewApi } from "./dataview/api";
import type {
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import type { IFileSystem } from "../filesystem/filesystem";
import type { DataSource } from "./dataSource";
import { DataviewDataSource } from "./dataview/datasource";
import { FolderDataSource } from "./folder/datasource";
import { NativeQueryDataSource } from "./native-query/datasource";
import { TagDataSource } from "./tag/datasource";

export { DataSource } from "./dataSource";

/**
 * Dependencies required to construct a {@link DataSource} from a project.
 * The Dataview API is optional — when absent the factory returns an
 * `unavailable` resolution instead of throwing.
 */
export interface DataSourceFactoryDeps {
  readonly fileSystem: IFileSystem;
  readonly preferences: ProjectsPluginPreferences;
  readonly dataviewApi: DataviewApi | undefined;
}

/**
 * Result of {@link createDataSource}. The discriminated union surfaces the
 * three possible outcomes without throwing:
 *  - `ok`          — source constructed; no degradation
 *  - `degraded`    — source constructed but a non-fatal substitution was made
 *                    (reserved for future folder/tag fallback work — not
 *                    produced in #045.1)
 *  - `unavailable` — required backend is missing; caller must render an
 *                    actionable message instead of a runtime error
 */
export type DataSourceResolution =
  | { readonly kind: "ok"; readonly source: DataSource }
  | {
      readonly kind: "degraded";
      readonly source: DataSource;
      readonly reason: DataSourceUnavailableReason;
    }
  | {
      readonly kind: "unavailable";
      readonly reason: DataSourceUnavailableReason;
    };

export type DataSourceUnavailableReason = "dataview-unavailable";

/**
 * Single construction site for {@link DataSource} instances. Used by
 * `DataFrameProvider` (primary view) and `externalFrameResolver`
 * (cross-project lookups) so degradation semantics stay consistent.
 *
 * The concrete sources extend {@link DataSource} from `./dataSource`, not
 * from this module, so they are imported statically without a cycle.
 */
export function createDataSource(
  project: ProjectDefinition,
  deps: DataSourceFactoryDeps
): DataSourceResolution {
  switch (project.dataSource.kind) {
    case "dataview": {
      if (!deps.dataviewApi) {
        return { kind: "unavailable", reason: "dataview-unavailable" };
      }
      return {
        kind: "ok",
        source: new DataviewDataSource(
          deps.fileSystem,
          project,
          deps.preferences,
          deps.dataviewApi
        ),
      };
    }
    case "native-query": {
      return {
        kind: "ok",
        source: new NativeQueryDataSource(
          deps.fileSystem,
          project,
          deps.preferences
        ),
      };
    }
    case "tag": {
      return {
        kind: "ok",
        source: new TagDataSource(deps.fileSystem, project, deps.preferences),
      };
    }
    case "folder":
    default: {
      return {
        kind: "ok",
        source: new FolderDataSource(
          deps.fileSystem,
          project,
          deps.preferences
        ),
      };
    }
  }
}
