// ============================================================
// The part of the Dataview plugin API that Projects Plus calls.
//
// Dataview's own declarations import their modules by bare paths
// ("api/plugin-api", "data-model/value"), which do not resolve from this
// project, so its `DataviewApi` reaches TypeScript as `any` and every query
// result was untyped. This file describes only what the plugin relies on;
// values Dataview returns are `unknown` until the plugin reads them.
// ============================================================

/** A link to a note, as Dataview returns it for the id column. */
export interface DataviewLink {
  readonly path: string;
  readonly display?: string;
  toString(): string;
}

/** One task from a TASK query: the known fields plus inline annotations. */
export interface DataviewTaskItem {
  readonly path: string;
  readonly text?: string;
  readonly link?: DataviewLink;
  readonly tags?: readonly string[];
  readonly annotated?: boolean;
  readonly status?: string;
  readonly checked?: boolean;
  readonly completed?: boolean;
  readonly [field: string]: unknown;
}

/** TASK results come flat or grouped by file. */
export interface DataviewTaskGroup {
  readonly key: unknown;
  readonly rows: readonly (DataviewTaskItem | DataviewTaskGroup)[];
}

export interface DataviewTableResult {
  readonly type: "table";
  readonly headers: string[];
  readonly values: readonly (readonly unknown[])[];
}

export interface DataviewListResult {
  readonly type: "list";
  readonly values: readonly unknown[];
}

export interface DataviewTaskResult {
  readonly type: "task";
  readonly values: readonly (DataviewTaskItem | DataviewTaskGroup)[];
}

export type DataviewQueryResult =
  | DataviewTableResult
  | DataviewListResult
  | DataviewTaskResult
  | { readonly type: "calendar" };

export type DataviewResult<T> =
  | { readonly successful: true; readonly value: T }
  | { readonly successful: false; readonly error: string };

export interface DataviewApi {
  readonly settings: { readonly tableIdColumnName: string };
  query(
    source: string,
    originFile?: string,
    settings?: { readonly forceId?: boolean }
  ): Promise<DataviewResult<DataviewQueryResult>>;
}

/** A Dataview link: an object with a string `path`. */
export function isDataviewLink(value: unknown): value is DataviewLink {
  return typeof value === "object" && value !== null && typeof (value as { path?: unknown }).path === "string";
}
