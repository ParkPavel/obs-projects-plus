import type { LatestProjectsPluginSettings, ProjectDefinition } from "src/settings/settings";
import { parseBaseRef } from "src/lib/relations/baseRef";
import { blockRefId, parseBlockRef } from "src/lib/relations/blockRefs";
import { checkProject, jsonObject, projectFileError } from "./document";
import { PACKAGE_LIMITS } from "./packagePolicy";

export type PackageIdentityKind = "project" | "source" | "view" | "widget" | "tab";
export interface PackageIdentity {
  readonly kind: PackageIdentityKind;
  /** Original containing identities; tuple scopes avoid delimiter collisions. */
  readonly scope: readonly string[];
  readonly original: string;
  readonly replacement: string;
}

export interface PackageIdentityPlan {
  readonly identities: readonly PackageIdentity[];
  projectId(project: string): string;
  sourceId(project: string, source: string): string;
  viewId(project: string, view: string): string;
  widgetId(project: string, view: string, widget: string): string;
  tabId(project: string, view: string, widget: string, tab: string): string;
  derivedFrom(project: string, from: string): string;
  /** Only enclosed project/source/database-call references can resolve. Never binds to the destination vault. */
  baseReference(reference: string): string;
}

const MAX_IDENTITIES = 16384;
const MAX_ATTEMPTS = 32;
type Identity = Omit<PackageIdentity, "replacement">;
const keyOf = (kind: PackageIdentityKind, scope: readonly string[], id: string) => JSON.stringify([kind, ...scope, id]);

function validId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value || value.length > 512) throw projectFileError("invalid import identity");
}

/** Identity inventory only: this is NOT a project schema validator or a config/link rewriter. */
function inventory(projects: readonly ProjectDefinition[]): { identities: Identity[]; blocks: Set<string> } {
  const identities: Identity[] = [], keys = new Set<string>(), blocks = new Set<string>();
  const add = (kind: PackageIdentityKind, scope: string[], id: unknown) => {
    validId(id);
    const key = keyOf(kind, scope, id);
    if (keys.has(key)) throw projectFileError("duplicate import identity");
    keys.add(key);
    identities.push({ kind, scope, original: id });
    if (identities.length > MAX_IDENTITIES) throw projectFileError("too many import identities");
  };
  for (const project of projects) {
    checkProject(project);
    // These names cannot be represented unambiguously by the runtime BaseRef grammar.
    if (project.id.includes("::")) throw projectFileError("ambiguous project identity");
    add("project", [], project.id);
    if (project.additionalSources !== undefined && !Array.isArray(project.additionalSources)) throw projectFileError("invalid source identities");
    for (const source of [project.dataSource, ...(project.additionalSources ?? [])]) {
      if (!jsonObject(source)) throw projectFileError("invalid source identities");
      if (source['id'] !== undefined) {
        validId(source['id']);
        if (source['id'] === "project" || source['id'].startsWith("block:")) throw projectFileError("ambiguous source identity");
        add("source", [project.id], source['id']);
      }
    }
    for (const view of project.views) {
      add("view", [project.id], view.id);
      const config: unknown = view.config;
      if (!jsonObject(config) || config['widgets'] === undefined) continue;
      if (!Array.isArray(config['widgets'])) throw projectFileError("invalid widget identities");
      for (const widget of config['widgets'] as unknown[]) {
        if (!jsonObject(widget)) throw projectFileError("invalid widget identities");
        const id = widget['id'];
        validId(id);
        if (id.includes(":")) throw projectFileError("ambiguous widget identity");
        add("widget", [project.id, view.id], id);
        if (widget['type'] === "database-call") blocks.add(keyOf("widget", [project.id, view.id], id));
        const widgetConfig = widget['config'];
        // Only database-call owns viewTabs. A custom widget may use that key for opaque data.
        if (widget['type'] !== "database-call" || !jsonObject(widgetConfig) || widgetConfig['viewTabs'] === undefined) continue;
        if (!Array.isArray(widgetConfig['viewTabs'])) throw projectFileError("invalid tab identities");
        for (const tab of widgetConfig['viewTabs'] as unknown[]) {
          if (!jsonObject(tab)) throw projectFileError("invalid tab identities");
          add("tab", [project.id, view.id, id], tab['id']);
        }
      }
    }
  }
  return { identities, blocks };
}

/**
 * Plan one future clone without touching projects, settings or files. The caller supplies a fresh-ID
 * allocator and the active/archived destination collections. A separate plan is required
 * for each clone; restore with preserved IDs is a different operation. Unknown references fail closed.
 * Full schema validation, typed config traversal, paths and commit checks are still required to apply.
 */
export function createPackageIdentityPlan(
  imported: readonly ProjectDefinition[],
  destination: Pick<LatestProjectsPluginSettings, "projects" | "archives">,
  allocate: (kind: PackageIdentityKind) => string,
): PackageIdentityPlan {
  if (!imported.length || imported.length > PACKAGE_LIMITS.projects) throw projectFileError("invalid import project count");
  const input = inventory(imported), existing = inventory([...destination.projects, ...destination.archives]);
  const occupied = new Set([...input.identities, ...existing.identities].map(identity => identity.original));
  const replacements = new Map<string, string>();
  const identities = input.identities.map(identity => {
    let replacement: string | undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = allocate(identity.kind);
      // Generated names work in every identity position, including block references.
      if (typeof candidate !== "string" || candidate === "project" || !/^[A-Za-z0-9_-]{1,128}$/.test(candidate)) throw projectFileError("invalid allocated identity");
      if (!occupied.has(candidate)) { replacement = candidate; break; }
    }
    if (!replacement) throw projectFileError("import identity allocation exhausted");
    occupied.add(replacement);
    replacements.set(keyOf(identity.kind, identity.scope, identity.original), replacement);
    return Object.freeze({ ...identity, scope: Object.freeze([...identity.scope]), replacement });
  });
  const lookup = (kind: PackageIdentityKind, scope: readonly string[], id: string) => {
    const replacement = replacements.get(keyOf(kind, scope, id));
    if (!replacement) throw projectFileError("unresolved import identity");
    return replacement;
  };
  const projectId = (project: string) => lookup("project", [], project);
  const sourceId = (project: string, source: string) => lookup("source", [project], source);
  const viewId = (project: string, view: string) => lookup("view", [project], view);
  const widgetId = (project: string, view: string, widget: string) => lookup("widget", [project, view], widget);
  return Object.freeze({
    identities: Object.freeze(identities), projectId, sourceId, viewId, widgetId,
    tabId: (project: string, view: string, widget: string, tab: string) => lookup("tab", [project, view, widget], tab),
    derivedFrom: (project: string, from: string) => {
      projectId(project);
      return from === "project" ? "project" : sourceId(project, from);
    },
    baseReference: (reference: string) => {
      if (typeof reference !== "string" || !reference || reference.length > 2048) throw projectFileError("invalid import reference");
      const ref = parseBaseRef(reference), block = parseBlockRef(reference);
      const project = projectId(ref.projectId);
      if (block) {
        if (!input.blocks.has(keyOf("widget", [block.projectId, block.viewId], block.widgetId))) throw projectFileError("unresolved import block");
        return blockRefId(project, viewId(block.projectId, block.viewId), widgetId(block.projectId, block.viewId, block.widgetId));
      }
      if (ref.sourceId !== undefined) {
        if (!ref.sourceId || ref.sourceId.startsWith("block:")) throw projectFileError("invalid import reference");
        return `${project}::${sourceId(ref.projectId, ref.sourceId)}`;
      }
      return project;
    },
  });
}
