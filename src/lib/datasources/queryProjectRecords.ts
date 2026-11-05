import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { ProjectDefinition } from "src/settings/settings";
import { createDataSource, type DataSourceFactoryDeps } from ".";
import { isAcquirable } from "./derivedSource";
import { decodeFrontMatter } from "src/lib/metadata";
import { either as E } from "fp-ts";

/** Fresh acquisition for writes: never use a filtered or cached display frame. */
export async function queryProjectRecords(project: ProjectDefinition, deps: DataSourceFactoryDeps): Promise<DataRecord[]> {
  const records = new Map<string, DataRecord>();
  const sources = [project.dataSource, ...(project.additionalSources ?? []).filter(isAcquirable)];
  for (const config of sources) {
    const resolution = createDataSource({ ...project, dataSource: config }, deps);
    // An incomplete read cannot establish uniqueness. Refuse the write rather
    // than treating an unavailable additional backend as an empty source.
    if (resolution.kind === "unavailable") throw new Error(`Cannot check automatic IDs: ${resolution.reason}`);
    const frame = await resolution.source.queryAll();
    if (frame.errors?.length) throw new Error("Cannot check automatic IDs: project source contains unreadable notes");
    for (const record of frame.records) {
      if (!records.has(record.id)) records.set(record.id, record);
    }
  }
  const keys = Object.entries(project.fieldConfig ?? {}).filter(([, config]) => config?.type === "unique_id").map(([key]) => key);
  const result: DataRecord[] = [];
  for (const record of records.values()) {
    const file = deps.fileSystem.getFile(record.id);
    if (!file) { result.push(record); continue; }
    // A DQL projection can rename or calculate the ID column. Membership
    // comes from the source, but an automatic ID belongs to the stored note.
    const raw = decodeFrontMatter(await file.read());
    if (E.isLeft(raw)) throw raw.left;
    const values = { ...record.values };
    for (const key of keys) {
      const value = raw.right[key];
      if (typeof value === "string" || typeof value === "number") values[key] = value;
      else delete values[key];
    }
    result.push({ ...record, values });
  }
  return result;
}
