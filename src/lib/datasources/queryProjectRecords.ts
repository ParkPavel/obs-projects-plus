import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { ProjectDefinition } from "src/settings/settings";
import { createDataSource, type DataSourceFactoryDeps } from ".";
import { isAcquirable } from "./derivedSource";

/** Fresh acquisition for writes: never use a filtered or cached display frame. */
export async function queryProjectRecords(project: ProjectDefinition, deps: DataSourceFactoryDeps): Promise<DataRecord[]> {
  const records = new Map<string, DataRecord>();
  const sources = [project.dataSource, ...(project.additionalSources ?? []).filter(isAcquirable)];
  for (const config of sources) {
    const resolution = createDataSource({ ...project, dataSource: config }, deps);
    // An incomplete read cannot establish uniqueness. Refuse the write rather
    // than treating an unavailable additional backend as an empty source.
    if (resolution.kind === "unavailable") throw new Error(`Cannot check automatic IDs: ${resolution.reason}`);
    for (const record of (await resolution.source.queryAll()).records) {
      if (!records.has(record.id)) records.set(record.id, record);
    }
  }
  return [...records.values()];
}
