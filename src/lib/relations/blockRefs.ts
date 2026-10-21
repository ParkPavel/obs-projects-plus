/**
 * i3-data: a database-call block of a dashboard, addressed as a data source.
 *
 * «Связи между отфильтрованными таблицами одного проекта не создаются —
 * только потоки целых проектов.» A block is a configured, filtered table; it
 * becomes a source other blocks, charts, relations and rollups can read.
 *
 * The ref is the D19 BaseRef shape (`projectId::sourceId`, baseRef.ts) with a
 * source id that names a block instead of a stored source:
 *
 *     projectId::block:<viewId>:<widgetId>
 *
 * so every place that already stores a base — `relation.targetProjectId`,
 * `sourceConfig.projectId`, `dataProjectId`, a series' `dataProjectId`, a
 * join's `rightSourceId` — carries it without a new field or a migration.
 *
 * Pure: reads the stored project definitions only (lib must not import ui, so
 * the widget shape is described structurally here).
 */
import type { ProjectDefinition } from "src/settings/settings";
import type { FilterDefinition } from "src/settings/base/settings";

const SEP = "::";
export const BLOCK_SOURCE_PREFIX = "block:";
/** i3-data: how many blocks a chain may pass through before it is refused. */
export const MAX_BLOCK_CHAIN = 8;

export interface BlockRef {
  readonly projectId: string;
  readonly viewId: string;
  readonly widgetId: string;
}

export function blockRefId(projectId: string, viewId: string, widgetId: string): string {
  return `${projectId}${SEP}${BLOCK_SOURCE_PREFIX}${viewId}:${widgetId}`;
}

/** The block a ref names, or null for a project / stored-source ref. */
export function parseBlockRef(ref: string | undefined): BlockRef | null {
  if (!ref) return null;
  const at = ref.indexOf(SEP);
  if (at <= 0) return null;
  const rest = ref.slice(at + SEP.length);
  if (!rest.startsWith(BLOCK_SOURCE_PREFIX)) return null;
  const body = rest.slice(BLOCK_SOURCE_PREFIX.length);
  // Widget ids carry no colon (`w-1a2b3c4d`); a view id might, so split at the last.
  const colon = body.lastIndexOf(":");
  if (colon <= 0 || colon === body.length - 1) return null;
  return { projectId: ref.slice(0, at), viewId: body.slice(0, colon), widgetId: body.slice(colon + 1) };
}

export function isBlockRef(ref: string | undefined): boolean {
  return parseBlockRef(ref) !== null;
}

/** The stored widget, as much of it as data flow needs. */
export interface StoredWidget {
  readonly id: string;
  readonly type: string;
  readonly title?: string;
  readonly config?: Record<string, unknown>;
  readonly sourceConfig?: { readonly projectId?: string; readonly sourceId?: string };
  readonly transform?: { readonly steps: ReadonlyArray<{ readonly type: string; readonly rightSourceId?: string }> };
}

export interface StoredDashboard {
  readonly viewId: string;
  readonly viewName: string;
  readonly filter: FilterDefinition | undefined;
  readonly config: Record<string, unknown>;
  readonly widgets: readonly StoredWidget[];
}

/** Every view of a project that holds widgets (a dashboard), in view order. */
export function dashboardsOf(project: ProjectDefinition): StoredDashboard[] {
  const out: StoredDashboard[] = [];
  // Hand-made or partial definitions (tests, imports) may lack `views`.
  for (const view of (project.views as ProjectDefinition["views"] | undefined) ?? []) {
    const config = view.config as Record<string, unknown> | undefined;
    const widgets = config?.["widgets"];
    if (!config || !Array.isArray(widgets)) continue;
    out.push({
      viewId: view.id,
      viewName: view.name,
      filter: view.filter as FilterDefinition | undefined,
      config,
      widgets: widgets.filter((w): w is StoredWidget => !!w && typeof (w as StoredWidget).id === "string"),
    });
  }
  return out;
}

/** The database-call blocks of a dashboard — the widgets that publish a filtered frame. */
export function blocksOf(dashboard: StoredDashboard): StoredWidget[] {
  return dashboard.widgets.filter((w) => w.type === "database-call");
}

export interface FoundBlock {
  readonly project: ProjectDefinition;
  readonly dashboard: StoredDashboard;
  readonly block: StoredWidget;
}

/** The stored block a ref names, or null when it is gone (or not a block). */
export function blockAt(projects: readonly ProjectDefinition[], ref: string | BlockRef): FoundBlock | null {
  const parsed = typeof ref === "string" ? parseBlockRef(ref) : ref;
  if (!parsed) return null;
  const project = projects.find((p) => p.id === parsed.projectId);
  if (!project) return null;
  const dashboard = dashboardsOf(project).find((d) => d.viewId === parsed.viewId);
  const block = dashboard ? blocksOf(dashboard).find((w) => w.id === parsed.widgetId) : undefined;
  return dashboard && block ? { project, dashboard, block } : null;
}

/** The view a widget lives in, among a project's dashboards. */
export function viewIdOfWidget(project: ProjectDefinition | undefined, widgetId: string): string | undefined {
  if (!project) return undefined;
  return dashboardsOf(project).find((d) => d.widgets.some((w) => w.id === widgetId))?.viewId;
}

/**
 * Every base a widget reads besides its host frame: its own source, a chart's
 * or stats block's other project, extra series, a correlation, joins.
 */
export function refsReadBy(widget: StoredWidget): string[] {
  const out = new Set<string>();
  const add = (v: unknown) => { if (typeof v === "string" && v) out.add(v); };
  add(widget.sourceConfig?.projectId);
  const cfg = widget.config ?? {};
  add(cfg["dataProjectId"]);
  add((cfg["correlation"] as { rightSourceId?: unknown } | undefined)?.rightSourceId);
  const series = cfg["series"];
  if (Array.isArray(series)) for (const s of series) add((s as { dataProjectId?: unknown } | undefined)?.dataProjectId);
  for (const step of widget.transform?.steps ?? []) if (step.type === "join") add(step.rightSourceId);
  return [...out];
}

/** The block refs a widget reads, normalised. */
export function blockRefsReadBy(widget: StoredWidget): string[] {
  return refsReadBy(widget).filter(isBlockRef);
}

/**
 * i3-data: true when `targetRef` cannot be read without a loop — it is
 * `selfRef`, it reads `selfRef` through any chain of blocks, it sits in a loop
 * of its own, or the chain is longer than {@link MAX_BLOCK_CHAIN}. Bounded by a
 * visited set and the chain limit, so a malformed config cannot hang it.
 */
export function blockReadCycle(
  projects: readonly ProjectDefinition[],
  selfRef: string | undefined,
  targetRef: string
): boolean {
  const done = new Set<string>();
  const walk = (ref: string, path: readonly string[]): boolean => {
    const parsed = parseBlockRef(ref);
    if (!parsed) return false; // a project or stored source reads no block
    const key = blockRefId(parsed.projectId, parsed.viewId, parsed.widgetId);
    if (selfRef !== undefined && key === selfRef) return true;
    if (path.includes(key)) return true;
    if (path.length >= MAX_BLOCK_CHAIN) return true;
    if (done.has(key)) return false;
    const found = blockAt(projects, parsed);
    const next = found ? blockRefsReadBy(found.block) : [];
    for (const r of next) if (walk(r, [...path, key])) return true;
    done.add(key);
    return false;
  };
  return walk(targetRef, []);
}

/**
 * i3-data: the project whose notes a block ref's records are, when the chain
 * stays inside one project — then a write through that project's api lands on
 * the right note. Undefined when the chain leaves the project, loops or ends
 * in a missing block.
 */
export function blockRecordsProject(projects: readonly ProjectDefinition[], ref: string): string | undefined {
  let current = ref;
  for (let i = 0; i < MAX_BLOCK_CHAIN; i++) {
    const found = blockAt(projects, current);
    if (!found) return undefined;
    const source = found.block.sourceConfig?.projectId;
    if (!source || source === found.project.id) return found.project.id;
    if (!isBlockRef(source) || parseBlockRef(source)?.projectId !== found.project.id) return undefined;
    current = source;
  }
  return undefined;
}
