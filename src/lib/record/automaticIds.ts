import { get } from "svelte/store";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { ProjectDefinition } from "src/settings/settings";
import { settings } from "src/lib/stores/settings";

interface Reservation { projectId: string; sequence: number; fields: Array<{ key: string; prefix: string }> }
const reservations = new WeakMap<DataRecord, Reservation>();

/** Creation context stays outside frontmatter and travels only with this new record. */
export function automaticIdProject(record: DataRecord): string | undefined { return reservations.get(record)?.projectId; }

function assigned(record: DataRecord, reservation: Reservation): DataRecord {
  const next = { ...record, values: { ...record.values, ...Object.fromEntries(reservation.fields.map(field => [field.key, `${field.prefix}${reservation.sequence}`])) } };
  reservations.set(next, reservation);
  return next;
}

export function reserveAutomaticIds(record: DataRecord, project: ProjectDefinition): DataRecord {
  const current = get(settings).projects.find(candidate => candidate.id === project.id);
  const fields = Object.entries((current ?? project).fieldConfig ?? {}).filter(([, config]) => config?.type === "unique_id")
    .map(([key, config]) => {
      if (config.uniqueIdPrefix !== undefined && typeof config.uniqueIdPrefix !== "string") throw new Error("The unique ID prefix must be text");
      return { key, prefix: config.uniqueIdPrefix ?? "" };
    });
  if (!fields.length) return record;
  const source = project.dataSource;
  if (fields.some(field => field.key === "tags") && (source.kind === "tag" || source.kind === "native-query" && source.config.from.kind === "tag")) {
    throw new Error("The tags field is required by this project and cannot contain an automatic ID");
  }
  if (!current) throw new Error("Cannot reserve a unique ID for a project that is not saved");
  return assigned(record, { projectId: project.id, sequence: settings.bumpUniqueId(project.id), fields });
}

/** Existing source values also count after retyping/importing a field or restoring an old counter. */
export function reconcileAutomaticIds(record: DataRecord, records: readonly DataRecord[]): DataRecord {
  const reservation = reservations.get(record);
  if (!reservation) return record;
  let floor = 0;
  for (const existing of records) for (const field of reservation.fields) {
    const value = existing.values[field.key];
    if (typeof value !== "string" && typeof value !== "number") continue;
    const text = String(value);
    if (!text.startsWith(field.prefix)) continue;
    const tail = text.slice(field.prefix.length);
    if (!/^\d{1,16}$/.test(tail)) continue;
    const sequence = Number(tail);
    if (Number.isSafeInteger(sequence)) floor = Math.max(floor, sequence);
  }
  if (reservation.sequence > floor) return record;
  return assigned(record, { ...reservation, sequence: settings.bumpUniqueId(reservation.projectId, floor) });
}
