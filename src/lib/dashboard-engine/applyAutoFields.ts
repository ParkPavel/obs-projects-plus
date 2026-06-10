// NPLAN-A1 — Fill AutoTime field values from file stat.
//
// `applyFormulaFields` → `applyAutoFields` → display
//
// For every DataField with type === AutoTime the function looks up the
// file stat via the injected `getFileStat` callback and writes the
// timestamp into any record that doesn't already have a value for that
// field (e.g. pp_created_time / pp_last_edited_time, already populated
// by the frontmatter datasource, are skipped so datasource wins).
//
// The callback decouples the pure pipeline step from Obsidian's vault API,
// making the function fully unit-testable without mocking global state.

import {
  DataFieldType,
  type DataField,
  type DataFrame,
} from "src/lib/dataframe/dataframe";

export interface FileStat {
  readonly ctime: number;
  readonly mtime: number;
}

/**
 * Return the file stat for a given record ID (= vault path), or null when
 * the file is not accessible (deleted, outside vault root, etc.).
 */
export type GetFileStat = (recordId: string) => FileStat | null;

/**
 * Inject AutoTime field values derived from `TFile.stat` into a DataFrame.
 *
 * Pure: returns the original reference when nothing changes.
 */
export function applyAutoFields(
  frame: DataFrame,
  getFileStat: GetFileStat
): DataFrame {
  const autoFields = frame.fields.filter(
    (f): f is DataField => f.type === DataFieldType.AutoTime
  );
  if (autoFields.length === 0) return frame;

  let changed = false;
  const newRecords = frame.records.map((record) => {
    const newValues = { ...record.values };
    let recordChanged = false;

    for (const field of autoFields) {
      // Datasource-filled values win — skip if already present.
      if (newValues[field.name] != null) continue;

      const source =
        (field.typeConfig as { autoTime?: "created" | "modified" } | undefined)
          ?.autoTime ?? "modified";
      const stat = getFileStat(record.id);
      if (!stat) continue;

      const ms = source === "created" ? stat.ctime : stat.mtime;
      if (ms > 0) {
        newValues[field.name] = new Date(ms);
        recordChanged = true;
      }
    }

    if (!recordChanged) return record;
    changed = true;
    return { ...record, values: newValues };
  });

  return changed ? { ...frame, records: newRecords } : frame;
}
