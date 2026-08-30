import dayjs from "dayjs";
import { produce } from "immer";


import { get } from "svelte/store";
import { v4 as uuidv4 } from "uuid";

import {
  isDate,
  DataFieldType,
  type DataField,
  type DataRecord,
  type DataValue,
  type Optional,
} from "./dataframe/dataframe";
import { nextUniqueProjectName, getNameFromPath, stripTagHash } from "./helpers";
import { decodeFrontMatter, encodeFrontMatter } from "./metadata";
import { i18n } from "./stores/i18n";
import { settings } from "./stores/settings";
import { interpolateTemplate } from "./templates/interpolate";

import { function as F, task as T, either as E, taskEither as TE } from "fp-ts";
import {
  DEFAULT_PROJECT,
  DEFAULT_VIEW,
  type ProjectDefinition,
} from "src/settings/settings";
import type { IFile, IFileSystem } from "./filesystem/filesystem";
import { normalizePath } from "obsidian";

/**
 * Result of a schema write that spans every note in a project (#144).
 * `written` counts notes actually rewritten; `failed` names the ones whose
 * write threw, with the error; `missing` names paths the file system could not
 * resolve at all.
 */
export type BulkFieldWriteOutcome = {
  readonly written: number;
  readonly failed: ReadonlyArray<{ readonly path: string; readonly error: Error }>;
  readonly missing: ReadonlyArray<string>;
};

/**
 * DataApi writes records to file.
 */
export class DataApi {
  constructor(readonly fileSystem: IFileSystem) {}

  /**
   * Returns false when the note the record points at no longer exists. #144
   * originally treated that as success — the caller kept an optimistic value in
   * the store for a file that could not receive it. Found by cross-model review.
   */
  async updateRecord(fields: DataField[], record: DataRecord): Promise<boolean> {
    const file = this.fileSystem.getFile(record.id);
    if (!file) return false;
    // Phase 3 / F6: prefer Obsidian's processFrontMatter (body-safe,
    // lock-protected) over the legacy read-modify-write path.
    const processed = await file.processFrontMatter((fm) =>
      applyRecordToFrontmatter(fm, fields, record),
    );
    if (processed) return true;
    await this.updateFile(file, (data) =>
      doUpdateRecord(data, fields, record),
    )();
    return true;
  }

  async updateRecords(
    fields: DataField[],
    records: DataRecord[]
  ): Promise<void> {
    await Promise.all(
      records.map(async (record) => {
        const file = this.fileSystem.getFile(record.id);
        if (!file) return;
        const processed = await file.processFrontMatter((fm) =>
          applyRecordToFrontmatter(fm, fields, record),
        );
        if (processed) return;
        await this.updateFile(file, (data) =>
          doUpdateRecord(data, fields, record),
        )();
      }),
    );
  }

  /**
   * #144 — a schema write touches every note in the project, and `Promise.all`
   * rejects on the first failure while the rest keep running. The caller could
   * neither tell how many notes were changed nor which ones were not, so a
   * partial write was indistinguishable from a complete one. Every file is now
   * settled independently and the outcome is returned.
   */
  private async writeAcrossFiles(
    paths: string[],
    mutate: (data: string) => E.Either<Error, string>
  ): Promise<BulkFieldWriteOutcome> {
    const targets: IFile[] = [];
    const missing: string[] = [];
    for (const path of paths) {
      const file = this.fileSystem.getFile(path);
      if (file) targets.push(file);
      else missing.push(path);
    }

    const settled = await Promise.allSettled(
      targets.map((file) => this.updateFile(file, mutate)())
    );

    const failed = settled.flatMap((result, index) =>
      result.status === "rejected"
        ? [
            {
              path: targets[index]!.path,
              error: E.toError(result.reason),
            },
          ]
        : []
    );

    return { written: settled.length - failed.length, failed, missing };
  }

  async addField(
    paths: string[],
    field: DataField,
    value: Optional<DataValue>
  ): Promise<BulkFieldWriteOutcome> {
    return this.writeAcrossFiles(paths, (data) => doAddField(data, field, value));
  }

  async renameField(
    paths: string[],
    from: string,
    to: string
  ): Promise<BulkFieldWriteOutcome> {
    return this.writeAcrossFiles(paths, (data) => doRenameField(data, from, to));
  }

  async deleteField(paths: string[], name: string): Promise<BulkFieldWriteOutcome> {
    return this.writeAcrossFiles(paths, (data) => doDeleteField(data, name));
  }

  async createNote(
    record: DataRecord,
    fields: DataField[],
    templatePath: string
  ): Promise<void> {
    let content = "";

    if (templatePath) {
      const file = this.fileSystem.getFile(templatePath);
      if (file) {
        content = await file.read();
        content = interpolateTemplate(content, {
          title: () => getNameFromPath(record.id),
          date: (format) => dayjs().format(format || "YYYY-MM-DD"),
          time: (format) => dayjs().format(format || "HH:mm"),

        });
        if (record.values["tags"]) {
          const templateTags = F.pipe(
            content,
            decodeFrontMatter,
            E.map((frontmatter) => frontmatter["tags"]),
            E.fold(
              () => [],
              (right) => right ?? [] // handle `null`
            )
          );
          const tagSet: Set<string> = new Set(
            templateTags.concat((record.values["tags"] ?? []) as string[])
          );
          record.values["tags"] = [...tagSet];
        }
      }
    }

    const file = await this.fileSystem.create(record.id, content);

    await this.updateFile(file, (data) =>
      doUpdateRecord(data, fields, record)
    )();
  }

  updateFile(
    file: IFile,
    cb: (data: string) => E.Either<Error, string>
  ): T.Task<void> {
    return F.pipe(
      TE.tryCatch((): Promise<string> => file.read(), E.toError),
      TE.map(cb),
      TE.chain(TE.fromEither),
      TE.chain((result) => TE.tryCatch(() => file.write(result), E.toError)),
      T.map(
        E.fold(
          (err) => {
            throw err;
          },
          () => {
            // new Notice("Updated file");
          }
        )
      )
    );
  }

  async deleteRecord(path: string) {
    const file = this.fileSystem.getFile(path);

    if (file) {
      await file.delete();
    }
  }
}

export function doUpdateRecord(
  data: string,
  fields: DataField[],
  record: DataRecord
): E.Either<Error, string> {
  return F.pipe(
    data,
    decodeFrontMatter,
    E.map((frontmatter) => {
      return Object.fromEntries(
        Object.entries({ ...frontmatter, ...record.values })
          .map((entry) => {
            if (isDate(entry[1])) {
              const isDatetime = fields.find(
                (field) =>
                  field.name === entry[0] &&
                  field.type === DataFieldType.Date &&
                  (field.typeConfig?.time ||
                    entry[1].getHours() ||
                    entry[1].getMinutes() ||
                    entry[1].getSeconds() ||
                    entry[1].getMilliseconds())
              );

              return produce(entry, (draft) => {
                draft[1] = dayjs(entry[1]).format(
                  isDatetime ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD"
                );
              });
            }
            return entry;
          })
          .filter(
            (entry) =>
              !fields.find((field) => field.name === entry[0] && field.derived)
          )
      );
    }),
    E.chain((updated) =>
      encodeFrontMatter(data, updated, getDefaultStringType())
    )
  );
}

/**
 * Mutate an Obsidian-frontmatter object in place so it reflects the given
 * record's values, using the same field-level rules as `doUpdateRecord`
 * (date formatting, derived-field exclusion). Intended for use inside
 * `app.fileManager.processFrontMatter` callbacks — closes F6.
 */
export function applyRecordToFrontmatter(
  frontmatter: Record<string, unknown>,
  fields: DataField[],
  record: DataRecord,
): void {
  for (const [key, value] of Object.entries(record.values)) {
    const field = fields.find((f) => f.name === key);
    if (field?.derived) continue;

    if (isDate(value)) {
      const isDatetime =
        field?.type === DataFieldType.Date &&
        (field.typeConfig?.["time"] ||
          value.getHours() ||
          value.getMinutes() ||
          value.getSeconds() ||
          value.getMilliseconds());
      frontmatter[key] = dayjs(value).format(
        isDatetime ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD",
      );
    } else {
      frontmatter[key] = value as unknown;
    }
  }
}

export function doAddField(
  data: string,
  field: DataField,
  value: Optional<DataValue>
): E.Either<Error, string> {
  return F.pipe(
    data,
    decodeFrontMatter,
    E.map((frontmatter) => ({
      ...frontmatter,
      [field.name]: value,
    })),
    E.chain((frontmatter) =>
      encodeFrontMatter(data, frontmatter, getDefaultStringType())
    )
  );
}

export function doDeleteField(data: string, field: string) {
  return F.pipe(
    data,
    decodeFrontMatter,
    E.map((frontmatter) => ({
      ...frontmatter,
      [field]: undefined,
    })),
    E.chain((frontmatter) =>
      encodeFrontMatter(data, frontmatter, getDefaultStringType())
    )
  );
}

export function doRenameField(
  data: string,
  from: string,
  to: string
): E.Either<Error, string> {
  return F.pipe(
    data,
    decodeFrontMatter,
    E.map((frontmatter) => ({
      ...frontmatter,
      [to]: frontmatter[from],
      [from]: undefined,
    })),
    E.chain((frontmatter) =>
      encodeFrontMatter(data, frontmatter, getDefaultStringType())
    )
  );
}

export function createProject(): ProjectDefinition {
  return Object.assign({}, DEFAULT_PROJECT, {
    id: uuidv4(),
    name: nextUniqueProjectName(
      get(settings).projects,
      get(i18n).t("modals.project.create.untitled")
    ),
    views: [
      Object.assign({}, DEFAULT_VIEW, {
        id: uuidv4(),
        name: get(i18n).t("views.dashboard.name"),
        type: "dashboard",
      }),
    ],
  });
}

export function createDataRecord(
  name: string,
  project: ProjectDefinition,
  values?: Record<string, Optional<DataValue>>
): DataRecord {
  let path = "";

  if (project.dataSource.kind === "folder") {
    path = project.dataSource.config.path;
  }

  if (
    project.dataSource.kind === "native-query" &&
    project.dataSource.config.from.kind === "folder"
  ) {
    path = project.dataSource.config.from.path;
  }

  if (project.newNotesFolder) {
    path = project.newNotesFolder;
  }

  if (project.dataSource.kind == "tag") {
    values = {
      ...values,
      tags: [stripTagHash(project.dataSource.config.tag)],
    };
  }

  if (
    project.dataSource.kind === "native-query" &&
    project.dataSource.config.from.kind === "tag"
  ) {
    values = {
      ...values,
      tags: [stripTagHash(project.dataSource.config.from.tag)],
    };
  }

  return {
    id: normalizePath(path + "/" + name + ".md"),
    values: values ?? {},
  };
}

function getDefaultStringType() {
  return get(settings).preferences?.frontmatter?.quoteStrings ?? "PLAIN";
}
