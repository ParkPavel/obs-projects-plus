import type {
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import type { DataField, DataFrame } from "../dataframe/dataframe";
import type { IFile } from "../filesystem/filesystem";

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
