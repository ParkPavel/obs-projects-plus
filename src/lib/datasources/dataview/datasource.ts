import { produce } from "immer";
import {
  isDataviewLink,
  type DataviewApi,
  type DataviewListResult,
  type DataviewTableResult,
  type DataviewTaskGroup,
  type DataviewTaskItem,
  type DataviewTaskResult,
} from "./api";
import {
  emptyDataFrame,
  type DataField,
  type DataFrame,
  type DataRecord,
} from "src/lib/dataframe/dataframe";
import { applyFilter } from "src/lib/engine/filterEvaluator";
import type { IFileSystem } from "src/lib/filesystem/filesystem";
import { i18n } from "src/lib/stores/i18n";
import type {
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import { get } from "svelte/store";
import { DataSource } from "../dataSource";
import { parseRecords } from "../helpers";
import { detectSchema } from "./schema";
import { standardizeValues } from "./standardize";

export class UnsupportedCapability extends Error {
  constructor(message: string) {
    super(message);
    this.name = get(i18n).t("errors.missingDataview.title");
  }
}

/**
 * DataviewDataSource returns a collection of notes using Dataview queries.
 */
export class DataviewDataSource extends DataSource {
  constructor(
    readonly fileSystem: IFileSystem,
    project: ProjectDefinition,
    preferences: ProjectsPluginPreferences,
    readonly api: DataviewApi
  ) {
    super(project, preferences);
  }

  /**
   * Явное обновление данных: пере-запросить текущий Dataview.
   * Не меняет API DataSource для остальных источников.
   */
  async refresh(): Promise<DataFrame> {
    return this.queryAll();
  }

  async queryOne(): Promise<DataFrame> {
    return this.queryAll();
  }

  async queryAll(): Promise<DataFrame> {
    if (this.project.dataSource.kind !== "dataview") {
      return emptyDataFrame;
    }

    const result = await this.api.query(
      this.project.dataSource.config.query ?? "",
      undefined,
      {
        forceId: true,
      }
    );

    if (!result?.successful) {
      throw new Error("dataview query failed");
    }

    const value = result.value;
    const idColumn = this.api.settings.tableIdColumnName;

    let rows: Array<Record<string, unknown>>;
    let sortHeaders: string[];

    if (value.type === "table") {
      rows = parseTableResult(value);
      sortHeaders = value.headers;
    } else if (value.type === "list") {
      rows = parseListResult(value, idColumn);
      sortHeaders = [idColumn];
    } else if (value.type === "task") {
      rows = parseTaskResult(value, idColumn);
      sortHeaders = [idColumn, "text", "status", "checked", "completed", "tags"];
    } else {
      throw new Error(`Unsupported Dataview query type: ${value.type}`);
    }
    const standardizedRecords = this.standardizeRecords(rows);

    let fields = this.sortFields(
      detectSchema(standardizedRecords),
      sortHeaders
    );

    for (const f in this.project.fieldConfig) {
      fields = fields.map<DataField>((field) =>
        field.name !== f
          ? field
          : {
              ...field,
              typeConfig: {
                ...this.project.fieldConfig?.[f],
                ...field.typeConfig,
              },
            }
      );
    }

    const records = parseRecords(standardizedRecords, fields);

    const baseFrame: DataFrame = { fields, records };

    // ── #045.5 — Unified DV filter semantics ─────────────────────────────
    // Apply optional canonical filter from `config.filter` through the
    // single source-of-truth `filterEvaluator`. DQL native WHERE still ran
    // inside the Dataview plugin during `api.query()`; this stage adds
    // unified semantic parity with folder/tag sources for predicates the
    // user wants enforced independently of (or in addition to) DQL.
    // No-op when `filter` is undefined or has zero conditions, so existing
    // projects without an explicit `config.filter` see no behavioural
    // change. (M-DATAVIEW-BRIDGE Gap 6.)
    const filterCfg = this.project.dataSource.config.filter;
    const hasConditions =
      !!filterCfg &&
      ((filterCfg.conditions?.length ?? 0) > 0 ||
        (filterCfg.groups?.length ?? 0) > 0);
    return hasConditions && filterCfg
      ? applyFilter(baseFrame, filterCfg)
      : baseFrame;
  }

  sortFields(fields: DataField[], headers: string[]): DataField[] {
    return produce(fields, (draft) => {
      draft.sort((a, b) => {
        const aval = headers.indexOf(a.name);
        const bval = headers.indexOf(b.name);

        const distance = aval - bval;

        if (distance !== 0) {
          return distance;
        }

        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
    });
  }

  includes(path: string): boolean {
    return !this.project.excludedNotes?.includes(path);
  }

  readonly(): boolean {
    return true;
  }


  standardizeRecords(rows: Array<Record<string, unknown>>): DataRecord[] {
    const records: DataRecord[] = [];

    const columnName = this.api.settings.tableIdColumnName;

    rows.forEach((row, index) => {
      const idRaw = row[columnName];
      // ID can be a Link object (TABLE/LIST) or a string (TASK)
      const id = isDataviewLink(idRaw)
        ? idRaw.path
        : typeof idRaw === "string" || typeof idRaw === "number"
          ? String(idRaw)
          : `row-${index}`;
      records.push({ id, values: standardizeValues(row) });
    });

    return records;
  }
}

 
function parseTableResult(value: DataviewTableResult): Array<Record<string, unknown>> {
  return value.values.map((row) => {
    const values: Record<string, unknown> = {};
    value.headers.forEach((header, index) => {
      values[header] = row[index];
    });
    return values;
  });
}

/**
 * Convert LIST query result to row format.
 * Each value becomes a record with the id column pointing to the source file.
 */
function parseListResult(value: DataviewListResult, idColumnName: string): Array<Record<string, unknown>> {
  return value.values.map((item) =>
    // A link names the file; a primitive gets a "Value" field and a synthetic id.
    isDataviewLink(item) ? { [idColumnName]: item } : { [idColumnName]: item, Value: item }
  );
}

/** Task fields that are Dataview's own structure, not annotations. */
const TASK_STRUCTURE = new Set([
  "symbol", "link", "section", "line", "lineCount", "position", "list", "blockId", "parent",
  "children", "outlinks", "visual", "annotated", "subtasks", "real", "header", "task",
]);

function isTaskGroup(item: DataviewTaskItem | DataviewTaskGroup): item is DataviewTaskGroup {
  return "rows" in item && Array.isArray(item.rows);
}

/**
 * Flatten TASK query result (flat or grouped by file) to row format.
 */
function parseTaskResult(value: DataviewTaskResult, idColumnName: string): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];

  function flattenItems(items: readonly (DataviewTaskItem | DataviewTaskGroup)[]): void {
    for (const item of items) {
      if (isTaskGroup(item)) {
        flattenItems(item.rows);
        continue;
      }
      const task = item;
      const row: Record<string, unknown> = {
        [idColumnName]: task.link ?? { path: task.path, display: task.path },
        text: task.text ?? "",
        status: task.status ?? "",
        checked: task.checked ?? false,
        completed: task.completed ?? false,
        tags: task.tags ?? [],
        path: task.path ?? "",
      };
      // Copy annotation fields (custom frontmatter-like fields on tasks)
      if (task.annotated) {
        for (const key of Object.keys(task)) {
          if (!(key in row) && !TASK_STRUCTURE.has(key)) row[key] = task[key];
        }
      }
      rows.push(row);
    }
  }

  flattenItems(value.values);
  return rows;
}

/**
 * Resolution returned by {@link createDataviewSource}. The `unavailable`
 * variant lets callers render a graceful fallback (e.g. a Callout asking the
 * user to enable Dataview) without catching a thrown error.
 */
export type DataviewSourceResolution =
  | { readonly kind: "ok"; readonly source: DataviewDataSource }
  | { readonly kind: "unavailable"; readonly reason: "dataview-unavailable" };

/**
 * Adaptive factory for {@link DataviewDataSource}. Returns
 * `{ kind: "unavailable" }` when the Dataview API is absent instead of
 * throwing — keeping the rest of the dashboard chrome usable when the
 * Dataview plugin is disabled.
 *
 * Part of the M-DATAVIEW-BRIDGE absorption plan (#045.1): centralises
 * graceful degradation for the Dataview backend so individual UI consumers
 * no longer probe `getPlugin("dataview")` themselves.
 */
export function createDataviewSource(
  fileSystem: IFileSystem,
  project: ProjectDefinition,
  preferences: ProjectsPluginPreferences,
  dataviewApi: DataviewApi | undefined
): DataviewSourceResolution {
  if (!dataviewApi) {
    return { kind: "unavailable", reason: "dataview-unavailable" };
  }
  return {
    kind: "ok",
    source: new DataviewDataSource(fileSystem, project, preferences, dataviewApi),
  };
}
