import type { LatestProjectsPluginSettings, ProjectDefinition } from "src/settings/settings";
import { parseBaseRef } from "src/lib/relations/baseRef";
import { checkProject, jsonObject, MAX_PROJECT_DOCUMENT_BYTES, projectFileError } from "./document";
import { createPackageIdentityPlan, type PackageIdentityKind, type PackageIdentityPlan } from "./packageIdentities";
import { PACKAGE_LIMITS } from "./packagePolicy";

type ObjectValue = Record<string, unknown>;
type Location = readonly (string | number)[];
export interface PackageRemapIssue {
  readonly code: "invalid-shape" | "unresolved-reference" | "unsupported-config" | "unsupported-context";
  /** Original project identity and structured location; no ambiguous string concatenation. */
  readonly projectId: string;
  readonly location: Location;
}
export interface PackageReferencePreview {
  readonly stage: "reference-preview";
  readonly projects: readonly ProjectDefinition[];
  readonly plan: PackageIdentityPlan;
  /** Every issue blocks later activation. An empty list is NOT permission to install. */
  readonly issues: readonly PackageRemapIssue[];
}

const WIDGETS = new Set(["data-table", "chart", "stats", "comparison", "checklist", "view-port", "filter-tabs", "summary-row", "data-list", "sub-base-canvas", "yaml-visualizer", "database-call", "timeline", "cover-banner", "text", "divider"]);
const VIEWS = new Set(["table", "board", "calendar", "gallery", "database", "dashboard"]);
const TABS = new Set(["table", "board", "calendar", "gallery", "list", "timeline", "chart", "stats"]);
const SOURCES = new Set(["folder", "tag", "dataview", "native-query", "derived"]);
const STEPS = new Set(["unnest", "unpivot", "compute", "filter", "group-by", "aggregate", "pivot", "join"]);

/**
 * Pure preview of known identity references, not a schema validator, path mapper or installation.
 * Opaque data survives a JSON capture without recursive string substitution or expression execution.
 * Future activation must validate schemas/unknown configs, paths/links, current state and persistence.
 */
export function previewPackageReferences(
  imported: readonly ProjectDefinition[],
  destination: Pick<LatestProjectsPluginSettings, "projects" | "archives">,
  allocate: (kind: PackageIdentityKind) => string,
): PackageReferencePreview {
  if (!imported.length || imported.length > PACKAGE_LIMITS.projects) throw projectFileError("invalid import project count");
  let total = 0;
  const projects = imported.map(project => {
    const text = JSON.stringify(project), bytes = new TextEncoder().encode(text).length;
    total += bytes;
    if (bytes > MAX_PROJECT_DOCUMENT_BYTES || total > PACKAGE_LIMITS.totalBytes) throw projectFileError("reference preview too large");
    const copy: unknown = JSON.parse(text);
    checkProject(copy);
    return copy;
  });
  // Allocate from the private capture, before any fields in that capture are changed.
  const plan = createPackageIdentityPlan(projects, destination, allocate);
  const reference = (id: string) => plan.baseReference(id);
  const originalViews = new Map(projects.map(project => [project.id, new Map(project.views.map(view => [view.id, view.type]))]));
  const issues: PackageRemapIssue[] = [];
  let referenceCount = 0, outputBytes = 0;
  const issue = (project: string, location: Location, code: PackageRemapIssue["code"]) => {
    if (issues.length >= PACKAGE_LIMITS.dependencies) throw projectFileError("too many reference issues");
    issues.push(Object.freeze({ projectId: project, location: Object.freeze([...location]), code }));
  };
  const map = (object: ObjectValue, key: string, project: string, at: Location, resolve: (id: string) => string, allowEmpty = false) => {
    const value = object[key];
    if (value === undefined) return;
    if (typeof value !== "string" || (!allowEmpty && !value)) { issue(project, [...at, key], "invalid-shape"); return; }
    if (!value && allowEmpty) return;
    if (++referenceCount > PACKAGE_LIMITS.dependencies) throw projectFileError("too many mapped references");
    try { object[key] = resolve(value); }
    catch { issue(project, [...at, key], "unresolved-reference"); }
  };
  const objectAt = (parent: ObjectValue, key: string, project: string, at: Location): ObjectValue | undefined => {
    const value = parent[key];
    if (value === undefined) return;
    if (jsonObject(value)) return value;
    issue(project, [...at, key], "invalid-shape");
    return;
  };
  const selection = (config: ObjectValue, project: string, view: string, at: Location) => {
    const linked = objectAt(config, "linkedSelection", project, at);
    if (linked) {
      if (linked['sourceWidgetId'] === undefined) issue(project, [...at, "linkedSelection", "sourceWidgetId"], "invalid-shape");
      else map(linked, "sourceWidgetId", project, [...at, "linkedSelection"], id => plan.widgetId(project, view, id), true);
    }
  };
  const chart = (config: ObjectValue, project: string, view: string, at: Location) => {
    map(config, "dataProjectId", project, at, reference, true);
    selection(config, project, view, at);
    const correlation = objectAt(config, "correlation", project, at);
    if (correlation) {
      if (correlation['rightSourceId'] === undefined) issue(project, [...at, "correlation", "rightSourceId"], "invalid-shape");
      else map(correlation, "rightSourceId", project, [...at, "correlation"], reference);
    }
    if (config['series'] !== undefined) {
      if (!Array.isArray(config['series'])) issue(project, [...at, "series"], "invalid-shape");
      else config['series'].forEach((series: unknown, index: number) => {
        if (!jsonObject(series)) issue(project, [...at, "series", index], "invalid-shape");
        else map(series, "dataProjectId", project, [...at, "series", index], reference, true);
      });
    }
  };
  const source = (value: ObjectValue, project: string, at: Location) => {
    if (!SOURCES.has(String(value['kind']))) { issue(project, at, "unsupported-config"); return; }
    map(value, "id", project, at, id => plan.sourceId(project, id));
    const config = objectAt(value, "config", project, at);
    if (!config) { if (value['config'] === undefined) issue(project, [...at, "config"], "invalid-shape"); return; }
    if (value['kind'] === "derived") {
      if (config['from'] === undefined) issue(project, [...at, "config", "from"], "invalid-shape");
      else map(config, "from", project, [...at, "config"], id => plan.derivedFrom(project, id));
    }
  };
  for (const project of projects) {
    const id = project.id, p = project as unknown as ObjectValue;
    // This preview doesn't alter the destination's default project during a later clone.
    p['isDefault'] = false;
    for (const [field, config] of Object.entries(project.fieldConfig)) {
      if (!jsonObject(config)) { issue(id, ["fieldConfig", field], "invalid-shape"); continue; }
      const at: Location = ["fieldConfig", field];
      const relation = objectAt(config, "relation", id, at), rollup = objectAt(config, "rollup", id, at);
      if (relation) {
        if (relation['targetProjectId'] === undefined) issue(id, [...at, "relation", "targetProjectId"], "invalid-shape");
        else map(relation, "targetProjectId", id, [...at, "relation"], reference);
      }
      if (rollup) {
        map(rollup, "targetProjectId", id, [...at, "rollup"], reference);
        const backlink = objectAt(rollup, "backlink", id, [...at, "rollup"]);
        if (backlink) {
          if (backlink['projectId'] === undefined) issue(id, [...at, "rollup", "backlink", "projectId"], "invalid-shape");
          else map(backlink, "projectId", id, [...at, "rollup", "backlink"], reference);
        }
      }
    }
    source(project.dataSource, id, ["dataSource"]);
    project.additionalSources?.forEach((item, index) => source(item, id, ["additionalSources", index]));
    project.views.forEach((view, vi) => {
      const at: Location = ["views", vi], value = view as unknown as ObjectValue, viewId = view.id;
      value['id'] = plan.viewId(id, viewId);
      if (!VIEWS.has(view.type)) { issue(id, at, "unsupported-config"); return; }
      if (!jsonObject(view.config)) { issue(id, [...at, "config"], "invalid-shape"); return; }
      if (view.type !== "database" && view.type !== "dashboard") {
        if (view.config['widgets'] !== undefined) issue(id, [...at, "config", "widgets"], "unsupported-config");
        return;
      }
      const widgets = view.config['widgets'];
      if (widgets === undefined) return;
      if (!Array.isArray(widgets)) { issue(id, [...at, "config", "widgets"], "invalid-shape"); return; }
      widgets.forEach((widget: ObjectValue, wi: number) => {
        const wa = [...at, "config", "widgets", wi], widgetId = widget['id'] as string;
        widget['id'] = plan.widgetId(id, viewId, widgetId);
        if (!WIDGETS.has(String(widget['type']))) { issue(id, wa, "unsupported-config"); return; }
        const config = objectAt(widget, "config", id, wa);
        if (!config) { if (widget['config'] === undefined) issue(id, [...wa, "config"], "invalid-shape"); return; }
        const ca = [...wa, "config"], scope = objectAt(widget, "sourceConfig", id, wa);
        let context = id, qualified = false;
        if (scope) {
          const ref = scope['projectId'];
          if (widget['type'] === "database-call" && typeof ref === "string" && ref) {
            const parsed = parseBaseRef(ref);
            context = parsed.projectId; qualified = parsed.sourceId !== undefined;
          }
          // Retained dormant refs are mapped too, but sourceId on non-db widgets uses the host.
          map(scope, "projectId", id, [...wa, "sourceConfig"], reference, true);
          if (qualified && scope['sourceId']) issue(id, [...wa, "sourceConfig", "sourceId"], "unsupported-context");
          else map(scope, "sourceId", id, [...wa, "sourceConfig"], sid => plan.sourceId(context, sid), true);
        }
        if (widget['type'] === "chart") chart(config, id, viewId, ca);
        else { map(config, "dataProjectId", id, ca, reference, true); selection(config, id, viewId, ca); }
        const transform = objectAt(widget, "transform", id, wa);
        if (transform) {
          if (!Array.isArray(transform['steps'])) issue(id, [...wa, "transform", "steps"], "invalid-shape");
          else transform['steps'].forEach((step: unknown, si: number) => {
            const sa = [...wa, "transform", "steps", si];
            if (!jsonObject(step)) issue(id, sa, "invalid-shape");
            else if (!STEPS.has(String(step['type']))) issue(id, sa, "unsupported-config");
            else if (step['type'] === "join") {
              if (step['rightSourceId'] === undefined) issue(id, [...sa, "rightSourceId"], "invalid-shape");
              else map(step, "rightSourceId", id, sa, reference);
            }
          });
        }
        if (widget['type'] !== "database-call") return;
        // An inline source definition needs a separate path/source ownership contract.
        if (config['sourceConfig'] !== undefined) issue(id, [...ca, "sourceConfig"], "unsupported-config");
        const tabs = config['viewTabs'];
        // Validate a known reference even when no tab list exists (including 0/false/null).
        map(config, "activeTabId", id, ca, tid => plan.tabId(id, viewId, widgetId, tid), true);
        if (tabs === undefined) return;
        if (!Array.isArray(tabs)) { issue(id, [...ca, "viewTabs"], "invalid-shape"); return; }
        tabs.forEach((tab: ObjectValue, ti: number) => {
          const ta = [...ca, "viewTabs", ti], type = tab['viewType'];
          tab['id'] = plan.tabId(id, viewId, widgetId, tab['id'] as string);
          if (tab['linkedViewId'] !== undefined && tab['linkedViewId'] !== "") {
            if (qualified) issue(id, [...ta, "linkedViewId"], "unsupported-context");
            else map(tab, "linkedViewId", id, ta, linked => {
              const targetType = originalViews.get(context)?.get(linked);
              if (!targetType || targetType !== type) throw projectFileError("unresolved linked view");
              return plan.viewId(context, linked);
            });
          }
          if (!TABS.has(String(type))) { issue(id, ta, "unsupported-config"); return; }
          const tc = objectAt(tab, "config", id, ta);
          if (!tc) { if (tab['config'] === undefined) issue(id, [...ta, "config"], "invalid-shape"); return; }
          if (type === "chart") chart(tc, id, viewId, [...ta, "config"]);
          else if (type === "stats") { map(tc, "dataProjectId", id, [...ta, "config"], reference, true); selection(tc, id, viewId, [...ta, "config"]); }
        });
      });
    });
    p['id'] = plan.projectId(id);
    // Fresh IDs may be longer than originals; an input bound alone is insufficient.
    const bytes = new TextEncoder().encode(JSON.stringify(project)).length;
    outputBytes += bytes;
    if (bytes > MAX_PROJECT_DOCUMENT_BYTES || outputBytes > PACKAGE_LIMITS.totalBytes) throw projectFileError("reference preview too large");
  }
  return { stage: "reference-preview", projects, plan, issues: Object.freeze(issues) };
}
