import type { ProjectDefinition } from "src/settings/settings";
import { blockReadCycle, blockRefId, blockRefsReadBy, dashboardsOf } from "src/lib/relations/blockRefs";
import { checkProjectCoreJson, type ProjectCoreCheck } from "./projectCoreCheck";
import { previewPackageReferences, type PackageRemapIssue } from "./packageRemap";
import { MAX_PROJECT_DOCUMENT_BYTES, projectFileError } from "./document";
import { PACKAGE_LIMITS } from "./packagePolicy";

export interface PackageGraphCheck {
  readonly stage: "package-graph-check";
  /** Structure/reference inspection is not installation or expression validation. */
  readonly complete: false;
  readonly coreChecks: readonly { readonly projectId: string; readonly name: string; readonly check: ProjectCoreCheck }[];
  readonly referencesChecked: boolean;
  readonly issues: readonly (PackageRemapIssue | { readonly projectId: string; readonly location: readonly (string | number)[]; readonly code: "block-read-cycle" })[];
}

/** Closed package only: never consults recipient projects, notes, queries or expressions. */
export function checkPackageGraph(input: readonly ProjectDefinition[]): PackageGraphCheck {
  if (!input.length || input.length > PACKAGE_LIMITS.projects) throw projectFileError("invalid graph project count");
  let bytes = 0, diagnostics = 0;
  const projects = input.map(project => {
    const text = JSON.stringify(project, (_key, value: unknown) => {
      if (typeof value === "number" && !Number.isFinite(value)) throw projectFileError("non-finite graph value");
      return value;
    });
    const size = new TextEncoder().encode(text).length; bytes += size;
    if (size > MAX_PROJECT_DOCUMENT_BYTES || bytes > PACKAGE_LIMITS.totalBytes) throw projectFileError("graph input too large");
    return { text, project: JSON.parse(text) as ProjectDefinition };
  });
  const coreChecks = Object.freeze(projects.map(({ text, project }) => {
    const check = checkProjectCoreJson(text);
    diagnostics += check.issues.length;
    if (diagnostics > PACKAGE_LIMITS.dependencies) throw projectFileError("too many core schema diagnostics");
    return Object.freeze({ projectId: project.id, name: project.name, check });
  }));
  // Identity traversal assumes typed envelopes. Never traverse malformed or
  // future structures just because an integrity-checked ZIP enclosed them.
  if (coreChecks.some(item => item.check.issues.length)) return Object.freeze({ stage: "package-graph-check", complete: false, coreChecks, referencesChecked: false, issues: Object.freeze([]) });
  const captured = projects.map(item => item.project);
  let nextId = 0;
  const preview = previewPackageReferences(captured, { projects: [], archives: [] }, () => `graph-${++nextId}`);
  const issues: PackageGraphCheck['issues'][number][] = [...preview.issues];
  let reads = 0;
  for (const project of captured) for (const dashboard of dashboardsOf(project)) {
    const vi = project.views.findIndex(view => view.id === dashboard.viewId);
    for (const [wi, widget] of dashboard.widgets.entries()) {
      for (const reference of blockRefsReadBy(widget)) {
        if (++reads > PACKAGE_LIMITS.dependencies) throw projectFileError("too many block graph reads");
        const self = widget.type === "database-call" ? blockRefId(project.id, dashboard.viewId, widget.id) : undefined;
        if (blockReadCycle(captured, self, reference)) {
          if (issues.length >= PACKAGE_LIMITS.dependencies) throw projectFileError("too many graph diagnostics");
          issues.push(Object.freeze({ projectId: project.id, location: Object.freeze(["views", vi, "config", "widgets", wi]), code: "block-read-cycle" }));
          break;
        }
      }
    }
  }
  return Object.freeze({ stage: "package-graph-check", complete: false, coreChecks, referencesChecked: true, issues: Object.freeze(issues) });
}
