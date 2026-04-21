import { produce } from "immer";
import type { DataviewApi, Link } from "obsidian-dataview";
import type { TableResult, ListResult, TaskResult } from "obsidian-dataview/lib/api/plugin-api";
import type { SListItem } from "obsidian-dataview/lib/data-model/serialized/markdown";
import {
  emptyDataFrame,
  type DataField,
  type DataFrame,
  type DataRecord,
} from "src/lib/dataframe/dataframe";
import type { IFileSystem } from "src/lib/filesystem/filesystem";
import { i18n } from "src/lib/stores/i18n";
import type {
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import { get } from "svelte/store";
import { DataSource } from "..";
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

    const resultType = result.value.type;

    let rows: Array<Record<string, unknown>>;
    let sortHeaders: string[];

    if (resultType === "table") {
      rows = parseTableResult(result.value as TableResult);
      sortHeaders = (result.value as TableResult).headers;
    } else if (resultType === "list") {
      rows = parseListResult(result.value as ListResult, this.api.settings.tableIdColumnName);
      sortHeaders = [this.api.settings.tableIdColumnName];
    } else if (resultType === "task") {
      rows = parseTaskResult(result.value as TaskResult, this.api.settings.tableIdColumnName);
      sortHeaders = [this.api.settings.tableIdColumnName, "text", "status", "checked", "completed", "tags"];
    } else {
      throw new Error(`Unsupported Dataview query type: ${resultType}`);
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

    return { fields, records };
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dataview API returns dynamically typed rows
  standardizeRecords(rows: Array<Record<string, any>>): DataRecord[] {
    const records: DataRecord[] = [];

    const columnName = this.api.settings.tableIdColumnName;

    rows.forEach((row, index) => {
      const idRaw = row[columnName];
      // ID can be a Link object (TABLE/LIST) or a string (TASK)
      const id = typeof idRaw === "object" && idRaw && "path" in idRaw
        ? (idRaw as Link).path
        : String(idRaw ?? `row-${index}`);
      records.push({ id, values: standardizeValues(row) });
    });

    return records;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dataview API returns dynamically typed table rows
function parseTableResult(value: TableResult): Array<Record<string, any>> {
  const headers: string[] = value.headers;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dataview row values are dynamically typed
  const rows: Array<Record<string, any>> = [];

  value.values.forEach((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dataview cell values are dynamically typed
    const values: Record<string, any> = {};

    headers.forEach((header, index) => {
      const value = row[index];
      values[header] = value;
    });

    rows.push(values);
  });

  return rows;
}

/**
 * Convert LIST query result to row format.
 * Each value becomes a record with the id column pointing to the source file.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dataview LIST values are dynamic
function parseListResult(value: ListResult, idColumnName: string): Array<Record<string, any>> {
  return value.values.map((item) => {
    if (typeof item === "object" && item !== null && "path" in item) {
      // Link object — use as file identifier
      return { [idColumnName]: item };
    }
    // Primitive value — wrap in a "Value" field with synthetic id
    return { [idColumnName]: item, Value: item };
  });
}

/**
 * Flatten TASK query result (Grouping<SListItem>) to row format.
 * Supports both flat array and grouped (by file) formats.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dataview TASK items are dynamic
function parseTaskResult(value: TaskResult, idColumnName: string): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [];

  function flattenItems(items: SListItem[] | Array<{ key: unknown; rows: SListItem[] }>): void {
    for (const item of items) {
      if ("rows" in item && Array.isArray((item as { rows: unknown }).rows)) {
        // Grouped format: { key: Link, rows: SListItem[] }
        flattenItems((item as { key: unknown; rows: SListItem[] }).rows);
      } else {
        const task = item as SListItem;
        const row: Record<string, any> = {
          [idColumnName]: task.link ?? { path: task.path, display: task.path },
          text: task.text ?? "",
          status: "status" in task ? task.status : "",
          checked: "checked" in task ? task.checked : false,
          completed: "completed" in task ? (task as { completed: boolean }).completed : false,
          tags: task.tags ?? [],
          path: task.path ?? "",
        };
        // Copy annotation fields (custom frontmatter-like fields on tasks)
        if (task.annotated) {
          for (const key of Object.keys(task)) {
            if (!(key in row) && !["symbol", "link", "section", "line", "lineCount", "position", "list", "blockId", "parent", "children", "outlinks", "visual", "annotated", "subtasks", "real", "header", "task"].includes(key)) {
              row[key] = task[key];
            }
          }
        }
        rows.push(row);
      }
    }
  }

  flattenItems(value.values);
  return rows;
}
