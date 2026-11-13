import { get } from "svelte/store";
import { dataFrame, dataSource } from "src/lib/stores/dataframe";
import type { IFile, IFileSystemWatcher } from "./lib/filesystem/filesystem";
import {
  DataFieldType,
  type DataField,
  type DataFrame,
} from "./lib/dataframe/dataframe";
import { createChangeBatcher } from "./lib/stores/changeBatcher";
import type { DataSource } from "./lib/datasources";

/**
 * registerFileEvents keeps the file index up-to-date while plugin is running.
 */
export function registerFileEvents(watcher: IFileSystemWatcher) {
  watcher.onCreate(async (file) => {
    await withDataSource(async (source) => {
      if (source.includes(file.path)) {
        dataFrame.merge(await source.queryOne(file, get(dataFrame).fields));
      }
    });
  });
  watcher.onRename(async (file, oldPath) => {
    await withDataSource(async (source) => {
      if (source.includes(file.path)) {
        dataFrame.deleteRecord(oldPath);
        dataFrame.merge(await source.queryOne(file, get(dataFrame).fields));
      } else if (source.includes(oldPath)) {
        dataFrame.deleteRecord(oldPath);
      }
    });
  });

  watcher.onDelete(async (file): Promise<void> => {
    await withDataSource((source) => {
      const recordExists = !!get(dataFrame).records.find(
        (record) => record.id === file.path
      );

      if (recordExists) {
        dataFrame.deleteRecord(file.path);
      }
    });
  });

  // i2-perf (C3): changes are applied in one merge per burst, not one each.
  const changes = createChangeBatcher<IFile>(async (files) => {
    try {
      await withDataSource(async (source) => {
        const frame = get(dataFrame);
        const known = new Set(frame.records.map((record) => record.id));
        const inside = files.filter((file) => source.includes(file.path));
        for (const file of files) {
          if (!source.includes(file.path) && known.has(file.path))
            dataFrame.deleteRecord(file.path);
        }
        if (inside.length === 0) return;
        if (typeof source.refresh === "function") {
          const refreshed = await source.refresh();
          if (get(dataSource) === source) dataFrame.merge(refreshed);
          return;
        }
        const results = await Promise.allSettled(
          inside.map(async (file) => source.queryOne(file, frame.fields))
        );
        if (get(dataSource) !== source) return;
        const parts: DataFrame[] = [];
        results.forEach((result, index) => {
          if (result.status === "fulfilled") parts.push(result.value);
          else
            console.error(
              "[Projects+] Failed to refresh note",
              inside[index]?.path,
              result.reason
            );
        });
        if (parts.length) dataFrame.merge(combineFrames(parts));
      });
    } catch (error) {
      console.error("[Projects+] Failed to refresh changed notes", error);
    }
  });
  watcher.onChange(async (file) => {
    changes.push(file.path, file);
  });
}

/**
 * withDataSource is a helper function to access the current data source.
 */
function withDataSource(
  callback: (source: DataSource) => Promise<void> | void
) {
  const source = get(dataSource);
  if (!source) {
    return;
  }

  return callback(source);
}

/** Several one-note frames as one: records together, each field once. */
function combineFrames(parts: DataFrame[]): DataFrame {
  const fields = new Map<string, DataField>();
  for (const part of parts)
    for (const field of part.fields) {
      const existing = fields.get(field.name);
      if (!existing) fields.set(field.name, field);
      else if (existing.type !== field.type)
        fields.set(field.name, { ...field, type: DataFieldType.String });
    }
  return {
    fields: [...fields.values()],
    records: parts.flatMap((part) => part.records),
    errors: parts.flatMap((part) => part.errors ?? []),
  };
}
