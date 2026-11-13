/**
 * i2-data (D19): «Кроме общей базы проекта суб-проекты настроенных таблиц не
 * доступны к выбору как источники данных.» A relation or rollup could name
 * only a whole project. A target may now be one of a project's own sources —
 * an additional source or a saved selection (derived source) — written as
 * `projectId::sourceId` in the same `targetProjectId` field (no new format;
 * old configs are plain project ids and read as before).
 *
 * i3-data: and a database-call block of a dashboard — a configured, filtered
 * table — as `projectId::block:<viewId>:<widgetId>` (blockRefs.ts). Every
 * picker that offers a base reads {@link sourceCatalogue}, the one list.
 */
import type { ProjectDefinition } from "src/settings/settings";
import { sourceLabel } from "src/lib/datasources/sourceSelection";
import { blockReadCycle, blockRefId, blocksOf, dashboardsOf } from "./blockRefs";

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

/** i3-data: what an entry of the catalogue is. */
export type SourceKind = "project" | "source" | "block";

export interface BaseRefOption {
  readonly value: string;
  readonly label: string;
  readonly projectId: string;
  readonly kind: SourceKind;
}

export interface SourceCatalogueOptions {
  /** How a block reads in a picker; English when absent (the UI passes its locale). */
  readonly blockLabel?: (title: string) => string;
  /** The ref of the widget that will read the pick: it, and every block that reads it, are left out — no loop can be picked. */
  readonly reader?: string;
  /** Leave this project and its stored sources out (a dashboard offers them through its own source field). Its blocks stay. */
  readonly omitProjectSources?: string;
  /** Offer blocks of this project only (all projects when absent). */
  readonly blocksOfProject?: string;
}

const defaultBlockLabel = (title: string) => `Block «${title}» (filtered)`;

/**
 * i3-data — the single source catalogue. Every base a block, a chart series, a
 * relation or a rollup can read: each project, its additional sources and
 * saved selections, and each database-call block of its dashboards as a
 * filtered source. Labelled «Проект · Источник», a block «Проект · Block «…»».
 */
export function sourceCatalogue(
  projects: readonly ProjectDefinition[],
  opts: SourceCatalogueOptions = {}
): BaseRefOption[] {
  const blockLabel = opts.blockLabel ?? defaultBlockLabel;
  const out: BaseRefOption[] = [];
  for (const p of projects) {
    if (p.id !== opts.omitProjectSources) {
      out.push({ value: p.id, label: p.name, projectId: p.id, kind: "project" });
      for (const s of p.additionalSources ?? []) {
        const id = (s as { id?: string }).id;
        if (typeof id !== "string") continue;
        out.push({ value: baseRefId({ projectId: p.id, sourceId: id }), label: `${p.name} · ${sourceLabel(s)}`, projectId: p.id, kind: "source" });
      }
    }
    if (opts.blocksOfProject !== undefined && opts.blocksOfProject !== p.id) continue;
    const dashboards = dashboardsOf(p);
    for (const d of dashboards) {
      const where = dashboards.length > 1 ? `${p.name} · ${d.viewName}` : p.name;
      for (const b of blocksOf(d)) {
        const value = blockRefId(p.id, d.viewId, b.id);
        if (opts.reader !== undefined && blockReadCycle(projects, opts.reader, value)) continue;
        out.push({ value, label: `${where} · ${blockLabel(b.title || b.id)}`, projectId: p.id, kind: "block" });
      }
    }
  }
  return out;
}

/** D19 name for the catalogue; kept so existing readers need no change. */
export function baseRefOptions(projects: readonly ProjectDefinition[]): BaseRefOption[] {
  return sourceCatalogue(projects);
}
