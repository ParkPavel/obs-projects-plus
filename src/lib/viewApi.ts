import { Notice } from "obsidian";
import { get } from "svelte/store";

import type {
  DataField,
  DataRecord,
  DataValue,
  Optional,
} from "./dataframe/dataframe";
import { DataFieldType } from "./dataframe/dataframe";
import type { DataFrame } from "./dataframe/dataframe";
import type { BulkFieldWriteOutcome, DataApi } from "./dataApi";
import { dataFrame } from "./stores/dataframe";
import type { DataSource } from "./datasources";
import { app } from "./stores/obsidian";
import { i18n } from "./stores/i18n";
import { writeInverseRelations } from "./relations/relationsWriter";
import { adaptRelationFieldConfig } from "./relations/relationContract";
import type { RelationFieldConfig } from "src/settings/base/settings";

const EMPTY_BULK_WRITE: BulkFieldWriteOutcome = { written: 0, failed: [], missing: [] };

/**
 * #144 — tells the user when a schema write did not reach every note. Silent on
 * success: a Notice per successful field write would be noise, and the column
 * appearing is already the confirmation.
 */
function reportBulkFieldWrite(outcome: BulkFieldWriteOutcome, fieldName: string): void {
  const unwritten = outcome.failed.length + outcome.missing.length;
  if (unwritten === 0) return;

  new Notice(
    get(i18n).t("errors.fieldWritePartial", {
      defaultValue:
        "'{{field}}' was written to {{written}} notes; {{unwritten}} could not be updated. See the console for the list.",
      field: fieldName,
      written: outcome.written,
      unwritten,
    })
  );
  console.error(
    `[obs-projects-plus] field '${fieldName}': ${outcome.failed.length} write(s) failed, ` +
      `${outcome.missing.length} path(s) not found`,
    { failed: outcome.failed, missing: outcome.missing }
  );
}

/**
 * ViewApi provides an write API for views.
 */
export class ViewApi {
  constructor(
    readonly dataSource: DataSource,
    readonly dataApi: DataApi,
    /**
     * Optional resolver for sibling-project DataFrames. Used by Pillar 5
     * correlation widgets (JoinStep, ScatterConfig.correlation). Returns
     * `null` if the requested source cannot be loaded.
     */
    readonly resolveExternalFrame?: (projectId: string) => Promise<DataFrame | null>
  ) {}

  addRecord(record: DataRecord, fields: DataField[], templatePath: string) {
    if (this.dataSource.includes(record.id)) {
      dataFrame.addRecord(record);
    }
    void this.dataApi.createNote(record, fields ?? [], templatePath);
  }

  /**
   * Returns false when the change did not reach the file — the write threw or
   * the note is gone. #161: callers that keep their own copy of the frame must
   * not mirror a value that was rolled back here.
   */
  async updateRecord(record: DataRecord, fields: DataField[]): Promise<boolean> {
    const oldRecord = get(dataFrame).records.find((candidate) => candidate.id === record.id);
    const optimistic = this.dataSource.includes(record.id);
    if (optimistic) {
      dataFrame.updateRecord(record);
    }
    try {
      const written = await this.dataApi.updateRecord(fields, record);
      if (!written) {
        // The note is gone. Silently keeping the optimistic value would show a
        // number that exists nowhere on disk.
        this.revertOptimistic(optimistic, record, oldRecord);
        new Notice(
          get(i18n).t("errors.recordFileMissing", {
            defaultValue: "{{path}} no longer exists; the change was not saved.",
            path: record.id,
          })
        );
        return false;
      }
    } catch (error) {
      // #144 — the store was updated before the file was written, so a failed
      // write left every view showing a value that is not in the Markdown.
      // Put the record back and say so. Not rethrown on purpose: several call
      // sites do not await this, and an unhandled rejection would replace a
      // visible message with a console entry.
      this.revertOptimistic(optimistic, record, oldRecord);
      new Notice(
        get(i18n).t("errors.recordWriteFailed", {
          defaultValue: "Could not save changes to {{path}}; the previous value was restored.",
          path: record.id,
        })
      );
      console.error("[obs-projects-plus] record write failed:", record.id, error);
      return false;
    }

    const obsApp = get(app);
    if (obsApp && oldRecord) {
      await fireInverseRelations(oldRecord, record, fields, obsApp);
    }
    return true;
  }

  /**
   * Puts `oldRecord` back, but only while the store still holds the value this
   * call wrote. If something newer landed in between — another edit, an
   * external Markdown change picked up by the watcher — reverting would undo
   * that instead, which is worse than leaving the failed value visible next to
   * its Notice.
   */
  private revertOptimistic(
    optimistic: boolean,
    attempted: DataRecord,
    oldRecord: DataRecord | undefined
  ): void {
    if (!optimistic || !oldRecord) return;
    const current = get(dataFrame).records.find((r) => r.id === attempted.id);
    if (current !== attempted) return;
    dataFrame.updateRecord(oldRecord);
  }

  /**
   * #163 — the batch sibling of `updateRecord`, and it had the same hole.
   *
   * Board drag-and-drop moves a card by writing several records at once. The
   * store was updated first and the write was then awaited with no catch, so a
   * failed write left the card sitting in its new column with nothing in the
   * Markdown to back it — scene 1 of the Vision ("the same entity seen from
   * another side") showing a side that does not exist.
   *
   * Returns false when the batch did not reach disk. Not rethrown, for the same
   * reason as `updateRecord`: several call sites do not await.
   */
  async updateRecords(records: DataRecord[], fields: DataField[]): Promise<boolean> {
    const rs = records.filter((r) => this.dataSource.includes(r.id));
    const previous = get(dataFrame).records.filter((candidate) =>
      rs.some((r) => r.id === candidate.id)
    );
    if (rs.length > 0) dataFrame.updateRecords(rs);

    try {
      await this.dataApi.updateRecords(fields, records);
      return true;
    } catch (error) {
      // Put back only the records this call actually wrote, and only where the
      // store still holds what we put there — same rule as `revertOptimistic`.
      const current = get(dataFrame).records;
      const untouched = previous.filter((old) => {
        const attempted = rs.find((r) => r.id === old.id);
        return attempted !== undefined && current.includes(attempted);
      });
      if (untouched.length > 0) dataFrame.updateRecords(untouched);
      new Notice(
        get(i18n).t("errors.recordsWriteFailed", {
          defaultValue:
            "Could not save {{count}} record(s); the previous values were restored.",
          count: rs.length,
        })
      );
      console.error("[obs-projects-plus] batch record write failed", error);
      return false;
    }
  }

  deleteRecord(recordId: string) {
    if (this.dataSource.includes(recordId)) {
      dataFrame.deleteRecord(recordId);
    }
    void this.dataApi.deleteRecord(recordId);
  }

  /**
   * #144 — the schema write used to be fire-and-forget: the Promise was voided,
   * so a partial failure was silent and callers could not tell when the notes
   * had actually been written. The outcome is now awaited and returned, and
   * failures are surfaced. The in-memory field is still added first, so the
   * column appears immediately.
   */
  async addField(
    field: DataField,
    value: Optional<DataValue>,
    position?: number
  ): Promise<BulkFieldWriteOutcome> {
    dataFrame.addField(field, position);

    const outcome = await this.dataApi.addField(
      get(dataFrame).records.map((record) => record.id),
      field,
      value
    );
    reportBulkFieldWrite(outcome, field.name);
    return outcome;
  }

  async updateField(field: DataField, oldName?: string): Promise<BulkFieldWriteOutcome> {
    dataFrame.updateField(field, oldName);

    if (!oldName) return EMPTY_BULK_WRITE;

    const outcome = await this.dataApi.renameField(
      get(dataFrame).records.map((record) => record.id),
      oldName,
      field.name
    );
    reportBulkFieldWrite(outcome, field.name);
    return outcome;
  }

  async deleteField(field: string): Promise<BulkFieldWriteOutcome> {
    dataFrame.deleteField(field);
    const outcome = await this.dataApi.deleteField(
      get(dataFrame).records.map((record) => record.id),
      field
    );
    reportBulkFieldWrite(outcome, field);
    return outcome;
  }
}

// ── NPLAN-C2 helper ──────────────────────────────────────────

async function fireInverseRelations(
  oldRecord: DataRecord,
  newRecord: DataRecord,
  fields: DataField[],
  obsApp: import("obsidian").App
): Promise<void> {
  const relFields = fields.filter(
    (f) =>
      f.type === DataFieldType.Relation &&
      (f.typeConfig as { relation?: RelationFieldConfig } | undefined)?.relation?.inverseFieldName
  );
  if (relFields.length === 0) return;

  const outcomes = await Promise.all(
    relFields.map(async (f) => {
      const cfg = (f.typeConfig as { relation?: RelationFieldConfig }).relation!;
      const outcome = await writeInverseRelations({
        sourceRecordId: oldRecord.id,
        fieldName: f.name,
        fieldConfig: cfg,
        newValue: newRecord.values[f.name] as string | string[] | null | undefined,
        oldValue: oldRecord.values[f.name] as string | string[] | null | undefined,
        createIfMissing: adaptRelationFieldConfig("", f.name, cfg).inverse?.createIfMissing ?? false,
        app: obsApp,
      });
      return { field: f.name, outcome };
    })
  );

  // #143 — the writer has always known why an inverse write did not happen and
  // the result was thrown away, so "two-way" silently meant "one-way". Under
  // the decision recorded in VISION_DEVIATIONS D-6 the inverse property is
  // *derived*, so a missing property on the target is normal and stays quiet;
  // a write that actually failed, or a target that cannot be found, is not.
  for (const { field, outcome } of outcomes) {
    const real = outcome.issues.filter((issue) => issue.code !== "inverse-field-missing");
    if (real.length === 0) continue;
    console.error(`[obs-projects-plus] inverse write for '${field}'`, real);
    new Notice(
      get(i18n).t("errors.inverseWriteFailed", {
        defaultValue:
          "The back-link for '{{field}}' could not be written to {{count}} note(s). See the console.",
        field,
        count: real.length,
      })
    );
  }
}
