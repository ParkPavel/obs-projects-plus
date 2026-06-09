import type { DataviewApi } from "obsidian-dataview";
import type {
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import type { DataField, DataFrame } from "../dataframe/dataframe";
import type { IFile, IFileSystem } from "../filesystem/filesystem";

/**
 * DataSource reads data frames from a project.
 */
export abstract class DataSource {
  constructor(
    readonly project: ProjectDefinition,
    readonly preferences: ProjectsPluginPreferences
  ) {}

  /**
   * Returns a DataFrame with all records in the project.
   */
  abstract queryAll(): Promise<DataFrame>;

  /**
   * Returns a DataFrame with a single record for the given file.
   *
   * @param fields - The existing fields to allow parsing file into the existing schema
   * @returns A dataframe containing a single record
   */
  abstract queryOne(file: IFile, fields: DataField[]): Promise<DataFrame>;

  /**
   * Returns whether a path belongs to the current project.
   */
  abstract includes(path: string): boolean;

  /**
   * Returns whether the data source is read-only.
   *
   * Read-only data sources are typically derived records where the data
   * source can't determine the original names of the fields.
   */
  readonly(): boolean {
    return false;
  }

  /**
   * Optional explicit refresh — implementations that maintain an internal
   * cache (e.g. Dataview-backed sources whose results depend on an external
   * engine) override this to re-query their backend on vault events.
   *
   * Sources that read directly from the vault on every `queryOne()` do not
   * need to implement this hook.
   */
  refresh?(): Promise<DataFrame>;
}

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
 * Implementations are loaded lazily via `require` to avoid a static import
 * cycle between this module and the concrete sources that re-export
 * {@link DataSource}.
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DataviewDataSource } = require("./dataview/datasource");
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
    case "tag": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { TagDataSource } = require("./tag/datasource");
      return {
        kind: "ok",
        source: new TagDataSource(deps.fileSystem, project, deps.preferences),
      };
    }
    case "folder":
    default: {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { FolderDataSource } = require("./folder/datasource");
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
