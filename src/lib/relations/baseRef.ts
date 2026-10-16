/**
 * i2-data (D19): «Кроме общей базы проекта суб-проекты настроенных таблиц не
 * доступны к выбору как источники данных.» A relation or rollup could name
 * only a whole project. A target may now be one of a project's own sources —
 * an additional source or a saved selection (derived source) — written as
 * `projectId::sourceId` in the same `targetProjectId` field (no new format;
 * old configs are plain project ids and read as before).
 */
import type { ProjectDefinition } from "src/settings/settings";
import { sourceLabel } from "src/lib/datasources/sourceSelection";

const SEP = "::";

export interface BaseRef {
  readonly projectId: string;
  readonly sourceId?: string;
}

export function parseBaseRef(id: string): BaseRef {
  const at = id.indexOf(SEP);
  return at < 0 ? { projectId: id } : { projectId: id.slice(0, at), sourceId: id.slice(at + SEP.length) };
}

export function baseRefId(ref: BaseRef): string {
  return ref.sourceId ? `${ref.projectId}${SEP}${ref.sourceId}` : ref.projectId;
}

export interface BaseRefOption {
  readonly value: string;
  readonly label: string;
  readonly projectId: string;
}

/**
 * Every base a relation or rollup can read: each project, then each of its
 * addressable sources other than the primary one, labelled «Проект · Источник».
 */
export function baseRefOptions(projects: readonly ProjectDefinition[]): BaseRefOption[] {
  const out: BaseRefOption[] = [];
  for (const p of projects) {
    out.push({ value: p.id, label: p.name, projectId: p.id });
    for (const s of p.additionalSources ?? []) {
      const id = (s as { id?: string }).id;
      if (typeof id !== "string") continue;
      out.push({ value: baseRefId({ projectId: p.id, sourceId: id }), label: `${p.name} · ${sourceLabel(s)}`, projectId: p.id });
    }
  }
  return out;
}
