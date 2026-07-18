import { get } from "svelte/store";

import type {
  DataField,
  DataRecord,
  DataValue,
  Optional,
} from "./dataframe/dataframe";
import { DataFieldType } from "./dataframe/dataframe";
import type { DataFrame } from "./dataframe/dataframe";
import type { DataApi } from "./dataApi";
import { dataFrame } from "./stores/dataframe";
import type { DataSource } from "./datasources";
import { app } from "./stores/obsidian";
import { writeInverseRelations } from "./relations/relationsWriter";
import { adaptRelationFieldConfig } from "./relations/relationContract";
import type { RelationFieldConfig } from "src/settings/base/settings";

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

  async updateRecord(record: DataRecord, fields: DataField[]): Promise<void> {
    const oldRecord = get(dataFrame).records.find((candidate) => candidate.id === record.id);
    if (this.dataSource.includes(record.id)) {
      dataFrame.updateRecord(record);
    }
    await this.dataApi.updateRecord(fields, record);

    const obsApp = get(app);
    if (obsApp && oldRecord) {
      await fireInverseRelations(oldRecord, record, fields, obsApp);
    }
  }

  async updateRecords(records: DataRecord[], fields: DataField[]) {
    const rs = records.filter((r) => this.dataSource.includes(r.id));
    if (rs) dataFrame.updateRecords(rs);
    await this.dataApi.updateRecords(fields, records);
  }

  deleteRecord(recordId: string) {
    if (this.dataSource.includes(recordId)) {
      dataFrame.deleteRecord(recordId);
    }
    void this.dataApi.deleteRecord(recordId);
  }

  addField(field: DataField, value: Optional<DataValue>, position?: number) {
    dataFrame.addField(field, position);

    void this.dataApi.addField(
      get(dataFrame).records.map((record) => record.id),
      field,
      value
    );
  }

  updateField(field: DataField, oldName?: string) {
    dataFrame.updateField(field, oldName);

    if (oldName) {
      void this.dataApi.renameField(
        get(dataFrame).records.map((record) => record.id),
        oldName,
        field.name
      );
    }
  }

  deleteField(field: string) {
    dataFrame.deleteField(field);
    void this.dataApi.deleteField(
      get(dataFrame).records.map((record) => record.id),
      field
    );
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

  await Promise.all(
    relFields.map((f) => {
      const cfg = (f.typeConfig as { relation?: RelationFieldConfig }).relation!;
      return writeInverseRelations({
        sourceRecordId: oldRecord.id,
        fieldName: f.name,
        fieldConfig: cfg,
        newValue: newRecord.values[f.name] as string | string[] | null | undefined,
        oldValue: oldRecord.values[f.name] as string | string[] | null | undefined,
        createIfMissing: adaptRelationFieldConfig("", f.name, cfg).inverse?.createIfMissing ?? false,
        app: obsApp,
      });
    })
  );
}
