// src/lib/externalFrameResolver.ts
// Pillar 5 (Phase 5 UI): resolve DataFrame for a sibling project by id.
// Used by DatabaseViewCanvas to preload right-hand frames for JoinStep /
// ScatterConfig.correlation without every widget owning a DataSource.

import type { App } from "obsidian";
import type { DataviewApi } from "src/lib/datasources/dataview/api";
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { enrichWithBacklinks } from "src/lib/dashboard-engine/relationResolver";
import type { ProjectDefinition, ProjectsPluginPreferences } from "src/settings/settings";
import type { FilterDefinition } from "src/settings/base/settings";
import type { IFileSystem } from "src/lib/filesystem/filesystem";
import { createDataSource } from "src/lib/datasources";
import { applyDeclaredFieldTypes } from "src/lib/relations/declaredFieldTypes";
import { applyComputedColumns } from "src/lib/relations/computedColumns";
import { extractRelationTargetIds, type FieldConfigRelationMap } from "src/lib/relations/relationTargets";
import { baseRefId, parseBaseRef } from "src/lib/relations/baseRef";
import { BLOCK_SOURCE_PREFIX, MAX_BLOCK_CHAIN, blockAt } from "src/lib/relations/blockRefs";
import { isAcquirable, resolveDerived } from "src/lib/datasources/derivedSource";
import { applyFilter } from "src/lib/engine/filterEvaluator";
import { applyFormulaFields } from "src/lib/dashboard-engine/applyFormulaFields";
import { executeTransform } from "src/lib/dashboard-engine/transformExecutor";
import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";
import type { DerivedDataSource } from "src/settings/v3/settings";
import type { FormulaFieldDef } from "src/ui/views/Dashboard/types";
import { mergeDataFrames } from "src/lib/datasources/mergeFrames";

export interface ResolverDeps {
  readonly fileSystem: IFileSystem;
  readonly preferences: ProjectsPluginPreferences;
  readonly projects: ReadonlyArray<ProjectDefinition>;
  readonly dataviewApi?: DataviewApi | undefined;
  /** Reserved for future use (e.g. vault event subscriptions). */
  readonly app?: App | undefined;
}

/**
 * i3-data: how many projects deep a rollup may read rollups (a rollup of a
 * rollup of a rollup). Past it, and on a loop, a target is read without its
 * own rollups — the chain ends instead of recursing.
 */
export const MAX_ROLLUP_DEPTH = 3;

/**
 * i3-data: one top-level resolution. `trail` is the chain of refs being
 * resolved, outermost first (rollup depth and block loops are read from it);
 * `acquired` keeps each project's queried frame for the whole call, so a
 * multi-level rollup queries a project once, not once per path to it.
 */
export interface ResolveContext {
  readonly trail: readonly string[];
  readonly acquired: Map<string, Promise<DataFrame | null>>;
}

function newContext(): ResolveContext {
  return { trail: [], acquired: new Map() };
}

/** i3-data: a block chain that reads itself. A state for the user, not a hang. */
export class SourceCycleError extends Error {
  constructor(ref: string) {
    super(`Circular source: this block reads itself through another block (${ref})`);
    this.name = "SourceCycleError";
  }
}

// Throttle repeat warnings for the same project id so a cascade of reactive
// invalidations (e.g. after a sibling-project file rename) does not flood the
// console. The window is intentionally short — just enough to collapse the
// synchronous burst from vault events.
const WARN_THROTTLE_MS = 5_000;
const recentWarnings = new Map<string, number>();

function warnThrottled(projectId: string, err: unknown): void {
  const now = Date.now();
  const last = recentWarnings.get(projectId) ?? 0;
  if (now - last < WARN_THROTTLE_MS) return;
  recentWarnings.set(projectId, now);
  console.warn(`[Projects+] resolveExternalFrame(${projectId}) failed`, err);
}

/** Non-derived Relation fields, the ones backlink enrichment is defined over. */
function relationFieldNames(frame: DataFrame): string[] {
  return frame.fields
    .filter((f) => f.type === DataFieldType.Relation && !f.derived)
    .map((f) => f.name);
}

/**
 * Resolve a DataFrame for the given project id. Returns `null` when the
 * project is not found or when its DataSource cannot be constructed (e.g.
 * Dataview not installed but requested). Errors are captured and throttled
 * so correlation widgets degrade gracefully without spamming the console.
 *
 * i3-data: the third argument is internal (nested resolution); callers omit it.
 */
export async function resolveExternalFrame(
  projectId: string,
  deps: ResolverDeps,
  ctx: ResolveContext = newContext()
): Promise<DataFrame | null> {
  // D19: `projectId::sourceId` names one of a project's own sources.
  const ref = parseBaseRef(projectId);
  if (ref.sourceId?.startsWith(BLOCK_SOURCE_PREFIX)) return resolveBlockFrame(projectId, deps, ctx);
  if (ref.sourceId) return resolveSourceFrame(ref.projectId, ref.sourceId, deps, ctx);
  const base = await acquireProjectFrame(projectId, deps, ctx);
  const project = deps.projects.find((p) => p.id === projectId);
  const fieldConfig = project?.fieldConfig as FieldConfigRelationMap | undefined;
  if (!base || !fieldConfig) return base;
  // 3.6.0: the project's rollup columns, as its own view folds them in.
  // i3-data: a target is read WITH its own rollups and formulas, so a rollup
  // of a rollup computes — down to MAX_ROLLUP_DEPTH projects. A target already
  // on the chain (A rolls up B, B rolls up A) or past the depth is read
  // without its rollups: the recursion ends there.
  const trail = [...ctx.trail, projectId];
  const cut = trail.length >= MAX_ROLLUP_DEPTH;
  const targets = new Map<string, DataFrame>();
  for (const id of extractRelationTargetIds(projectId, fieldConfig)) {
    const plain = !parseBaseRef(id).sourceId;
    const frame = cut || trail.includes(id)
      ? (plain ? await acquireProjectFrame(id, deps, ctx) : null)
      : await resolveExternalFrame(id, deps, { ...ctx, trail }).catch(() => null);
    if (frame) targets.set(id, frame);
  }
  // i2-data (R3) / i3-data / w4-p01b: the base's formulas and rollups in
  // dependency order — as View.svelte computes them for the host frame.
  return applyComputedColumns(base, fieldConfig, projectId, targets);
}

/** Match the host project's union, enriching backlinks only after all parts are present. */
async function acquireProjectFrame(projectId: string, deps: ResolverDeps, ctx: ResolveContext): Promise<DataFrame | null> {
  const project = deps.projects.find(project => project.id === projectId);
  const primary = await acquire(projectId, deps, ctx);
  if (!project || !primary) return null;
  const extras = await Promise.all((project.additionalSources ?? []).filter(isAcquirable).map(source => {
    const override = { ...project, dataSource: source } as ProjectDefinition;
    // Legacy unnamed sources cannot share the primary source's cache key.
    return source.id ? acquire(baseRefId({ projectId, sourceId: source.id }), deps, ctx, override)
      : resolveDeclaredFrame(projectId, deps, override);
  }));
  const merged = mergeDataFrames([primary, ...extras.filter((frame): frame is DataFrame => frame !== null)]);
  return enrichWithBacklinks(merged, relationFieldNames(merged));
}

/**
 * D19 — one source of a project as a base: an additional source is queried
 * on its own; a saved selection (derived source) narrows the project's frame,
 * or the part it reads, by its filter.
 */
async function resolveSourceFrame(projectId: string, sourceId: string, deps: ResolverDeps, ctx: ResolveContext): Promise<DataFrame | null> {
  const project = deps.projects.find((p) => p.id === projectId);
  const source = project?.additionalSources?.find((s) => (s as { id?: string }).id === sourceId);
  if (!project || !source) return null;
  const asProject = (src: typeof source) => ({ ...project, dataSource: src }) as ProjectDefinition;
  if (isAcquirable(source)) {
    const frame = await acquire(baseRefId({ projectId, sourceId }), deps, ctx, asProject(source));
    return frame ? enrichWithBacklinks(frame, relationFieldNames(frame)) : null;
  }
  const derived = source as DerivedDataSource;
  const enriched = await resolveExternalFrame(projectId, deps, ctx);
  if (!enriched) return null;
  const from = derived.config.from;
  const partSource = from === "project" ? undefined : [project.dataSource, ...(project.additionalSources ?? [])].find((s) => (s as { id?: string }).id === from);
  const partFrame = partSource && isAcquirable(partSource) ? await acquire(baseRefId({ projectId, sourceId: from }), deps, ctx, asProject(partSource)) : null;
  const result = resolveDerived(derived, { enriched, parts: partFrame ? [{ id: from, frame: partFrame }] : [] });
  return result.kind === "ok" || result.kind === "empty" ? result.frame : null;
}

function narrows(filter: FilterDefinition | undefined): filter is FilterDefinition {
  return !!filter && ((filter.conditions?.length ?? 0) > 0 || (filter.groups?.length ?? 0) > 0);
}

/**
 * i3-data — a database-call block as a base, read from its stored config: its
 * source (another project, a source of this one, another block, or the
 * dashboard's own frame with the dashboard's formulas and view filter), its
 * block filter, and its transform pipeline (a join's right side resolved too).
 * The live frame (canvas selection included) comes from the canvas registry
 * instead; this is the same answer where no canvas is open — relations,
 * rollups, another dashboard, a collapsed block.
 */
async function resolveBlockFrame(ref: string, deps: ResolverDeps, ctx: ResolveContext): Promise<DataFrame | null> {
  if (ctx.trail.includes(ref) || ctx.trail.length >= MAX_BLOCK_CHAIN) throw new SourceCycleError(ref);
  const found = blockAt(deps.projects, ref);
  if (!found) return null;
  const { project, dashboard, block } = found;
  const next: ResolveContext = { ...ctx, trail: [...ctx.trail, ref] };
  const external = block.sourceConfig?.projectId;
  let frame: DataFrame | null;
  if (external) {
    frame = await resolveExternalFrame(external, deps, next);
  } else {
    const sid = block.sourceConfig?.sourceId;
    // A source id that names nothing reads the whole project (sourceSelection.ts).
    frame = (sid ? await resolveExternalFrame(baseRefId({ projectId: project.id, sourceId: sid }), deps, next) : null)
      ?? await resolveExternalFrame(project.id, deps, next);
    if (frame) {
      frame = applyFormulaFields(frame, dashboard.config["formulaFields"] as FormulaFieldDef[] | undefined);
      if (narrows(dashboard.filter)) frame = applyFilter(frame, dashboard.filter);
    }
  }
  if (!frame) return null;
  const subFilter = block.config?.["subFilter"] as FilterDefinition | undefined;
  if (narrows(subFilter)) frame = applyFilter(frame, subFilter);
  const pipeline = block.transform as TransformPipeline | undefined;
  if (pipeline && pipeline.steps.length > 0) {
    // i3-close: a join step's right side is resolved like any other base,
    // through the same trail, so a join back into this block is a cycle.
    const rightFrames = new Map<string, DataFrame>();
    for (const step of pipeline.steps) {
      const right = step.type === "join" ? (step as { rightSourceId?: string }).rightSourceId : undefined;
      if (!right || rightFrames.has(right)) continue;
      const rightFrame = await resolveExternalFrame(right, deps, next);
      if (rightFrame) rightFrames.set(right, rightFrame);
    }
    const result = executeTransform(frame, pipeline, { rightFrames });
    if (result.meta.stopped) return null;
    frame = result.data;
  }
  return frame;
}

/** A project's queried frame, once per top-level resolution (i3-data). */
function acquire(key: string, deps: ResolverDeps, ctx: ResolveContext, override?: ProjectDefinition): Promise<DataFrame | null> {
  const known = ctx.acquired.get(key);
  if (known) return known;
  const pending = resolveDeclaredFrame(parseBaseRef(key).projectId, deps, override);
  ctx.acquired.set(key, pending);
  return pending;
}

/** One acquired source with declared types; project union owns backlink enrichment. */
async function resolveDeclaredFrame(
  projectId: string,
  deps: ResolverDeps,
  override?: ProjectDefinition
): Promise<DataFrame | null> {
  const project = override ?? deps.projects.find((p) => p.id === projectId);
  if (!project) return null;

  try {
    const resolution = createDataSource(project, {
      fileSystem: deps.fileSystem,
      preferences: deps.preferences,
      dataviewApi: deps.dataviewApi,
    });
    if (resolution.kind === "unavailable") {
      return null;
    }
    // M2-C6: the project's declared relation types, as the host frame gets
    // them in View — a single `[[…]]` is a String by inference and a Relation
    // once declared. Before backlink enrichment, which reads the types.
    const frame = applyDeclaredFieldTypes(
      await resolution.source.queryAll(),
      project.fieldConfig
    );

    // Cache declared source data; backlink enrichment happens after the
    // project's parts are merged, so cross-part links can see their targets.
    return frame;
  } catch (err) {
    warnThrottled(projectId, err);
    return null;
  }
}
