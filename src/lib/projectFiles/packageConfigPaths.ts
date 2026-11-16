import type { ProjectDefinition } from "src/settings/settings";
import type { PackageManifest } from "./package";
import { checkProject, jsonObject, MAX_PROJECT_DOCUMENT_BYTES, projectFileError } from "./document";
import { planPackageFiles, type PackageFilePlan, type VaultPathEntry } from "./packageFilePlan";
import { packageNameKey } from "./packageManifest";
import { PACKAGE_LIMITS } from "./packagePolicy";
import { captureConfigPathChoices, createConfigPathBindings, type ConfigPathChoice, type ConfigBindingTarget } from "./packagePathBindings";

type ObjectValue = Record<string, unknown>;
type Location = readonly (string | number)[];
const KNOWN_WIDGETS = new Set(["data-table", "chart", "stats", "comparison", "checklist", "view-port", "filter-tabs", "summary-row", "data-list", "sub-base-canvas", "yaml-visualizer", "database-call", "timeline", "cover-banner", "text", "divider"]);
export interface ConfigPathIssue {
  readonly projectId: string;
  readonly location: Location;
  readonly code: "invalid-shape" | "unbound-file" | "unbound-folder" | "scope-choice-required" | "creation-folder-choice-required" | "unsupported-config" | "invalid-binding" | "stale-binding" | "invalid-scope-choice" | "stale-scope-choice" | "schema-invalid" | "schema-unsupported";
  readonly source?: string;
}
export interface ConfigPathChange {
  readonly projectId: string;
  readonly location: Location;
  readonly source: string;
  readonly destination: string;
}
export interface ConfigPathScope {
  readonly projectId: string;
  readonly location: Location;
  readonly kind: "folder" | "tag" | "query";
  readonly value: string;
  /** Upper bound from existing Markdown paths only, before filters/exclusions; null means not calculated. */
  readonly existingCandidates: number | null;
  readonly context: string;
  readonly recursive?: boolean;
  readonly hierarchy?: boolean;
}
export interface PackageConfigPathPreview {
  readonly stage: "configuration-path-preview";
  readonly files: PackageFilePlan;
  readonly projects: readonly { readonly project: ProjectDefinition; readonly archived: boolean }[];
  readonly changes: readonly ConfigPathChange[];
  readonly issues: readonly ConfigPathIssue[];
  readonly scopes: readonly ConfigPathScope[];
  readonly bindings: readonly ConfigPathBindingOption[];
  readonly targets: readonly ConfigBindingTarget[];
  readonly choices: readonly ConfigPathChoice[];
}
export interface ConfigPathBindingOption {
  readonly projectId: string;
  readonly location: Location;
  readonly source: string;
  readonly kind: "file" | "folder";
  readonly purpose: "template" | "excluded-note" | "source-folder" | "creation-folder" | "cover" | "record";
  readonly context: string;
  readonly mode: "selected" | "inherited" | "missing" | "explicit" | "invalid";
  readonly defaultMode: "selected" | "inherited" | "missing";
  readonly defaultTarget?: string;
  readonly target?: string;
  readonly origin?: "existing" | "planned";
}

/**
 * Proposed known path bindings in private JSON copies. Never executes queries or applies settings.
 * Scope decisions remain explicit even with no existing candidate notes. Empty issues is NOT schema,
 * note-link, identity-remap or installation approval. Metadata/bytes must be verified again on apply.
 */
export function previewPackageConfigPaths(
  imported: readonly ProjectDefinition[], manifest: PackageManifest, destination: string,
  existing: readonly VaultPathEntry[], configDir: string, copyRoots: readonly string[],
  inputChoices: readonly ConfigPathChoice[] = [],
): PackageConfigPathPreview {
  const choices = captureConfigPathChoices(inputChoices);
  const files = planPackageFiles(manifest, destination, existing, configDir, copyRoots);
  const explicit = createConfigPathBindings(files, existing, configDir, copyRoots, choices);
  if (imported.length !== manifest.projects.length) throw projectFileError("configuration project coverage mismatch");
  let inputBytes = 0, outputBytes = 0, work = 0, records = 0, comparisons = 0;
  const copies = new Map<string, ProjectDefinition>();
  for (const input of imported) {
    const text = JSON.stringify(input), bytes = new TextEncoder().encode(text).length;
    inputBytes += bytes;
    if (bytes > MAX_PROJECT_DOCUMENT_BYTES || inputBytes > PACKAGE_LIMITS.totalBytes) throw projectFileError("configuration path preview too large");
    const copy: unknown = JSON.parse(text); checkProject(copy);
    const meta = manifest.projects.find(item => item.id === copy.id);
    if (!meta || meta.name !== copy.name || copies.has(copy.id)) throw projectFileError("configuration project coverage mismatch");
    copies.set(copy.id, copy);
  }
  const notes = [...new Set(existing.filter(item => item.kind === "file" && /\.md$/i.test(item.path)).map(item => item.path))].map(path => packageNameKey(path));
  const candidateCounts = new Map<string, number | null>();
  const countCandidates = (folder: string, recursive: boolean): number | null => {
    const key = packageNameKey(folder), cacheKey = JSON.stringify([key, recursive]);
    if (candidateCounts.has(cacheKey)) return candidateCounts.get(cacheKey)!;
    if (comparisons + notes.length > 1000000) { candidateCounts.set(cacheKey, null); return null; }
    comparisons += notes.length;
    const prefix = key + "/";
    let count = 0;
    for (const path of notes) if (path.startsWith(prefix) && (recursive || !path.slice(prefix.length).includes("/"))) count++;
    candidateCounts.set(cacheKey, count); return count;
  };
  const visit = () => { if (++work > 16384) throw projectFileError("configuration path preview too complex"); };
  const record = () => { if (++records > PACKAGE_LIMITS.dependencies) throw projectFileError("too many configuration path decisions"); };
  const changes: ConfigPathChange[] = [], issues: ConfigPathIssue[] = [], scopes: ConfigPathScope[] = [];
  const bindings: ConfigPathBindingOption[] = [];
  const issue = (id: string, location: Location, code: ConfigPathIssue["code"], source?: string) => {
    record(); issues.push(Object.freeze({ projectId: id, location: Object.freeze([...location]), code, ...(source !== undefined ? { source } : {}) }));
  };
  const mapPath = (value: unknown, id: string, location: Location, kind: "file" | "folder", purpose: ConfigPathBindingOption["purpose"], context = "", emptyFallback?: boolean) => {
    visit();
    if (typeof value !== "string" || value.length > 240 || (kind === "file" && !value)) { issue(id, location, "invalid-shape"); return; }
    let defaultTarget: string | undefined;
    if (emptyFallback === undefined) {
      try { defaultTarget = kind === "file" ? files.fileDestination(value) : files.folderDestination(value === "/" ? "" : value); }
      catch { /* A missing automatic binding remains an explicit user choice. */ }
    }
    const defaultMode = defaultTarget !== undefined ? "selected" : emptyFallback ? "inherited" : "missing";
    const selected = explicit.resolve(id, location, value, kind);
    const target = selected.status === "chosen" ? selected.target.path : selected.status === "invalid" ? undefined : defaultTarget;
    const mode = selected.status === "chosen" ? "explicit" : selected.status === "invalid" ? "invalid" : defaultMode;
    if (bindings.length >= PACKAGE_LIMITS.dependencies) throw projectFileError("too many configuration path decisions");
    bindings.push(Object.freeze({ projectId: id, location: Object.freeze([...location]), source: value, kind, purpose, context: context.slice(0, 160), mode, defaultMode,
      ...(defaultTarget !== undefined ? { defaultTarget } : {}), ...(target !== undefined ? { target, origin: selected.status === "chosen" ? selected.target.origin : "planned" as const } : {}) }));
    if (selected.status === "invalid") { issue(id, location, "invalid-binding", value); return; }
    if (target === undefined) {
      if (emptyFallback === undefined) issue(id, location, kind === "file" ? "unbound-file" : "unbound-folder", value);
      return;
    }
    if (target !== value) { record(); changes.push(Object.freeze({ projectId: id, location: Object.freeze([...location]), source: value, destination: target })); }
    return target;
  };
  const bind = (object: ObjectValue, key: string, id: string, at: Location, kind: "file" | "folder", purpose: ConfigPathBindingOption["purpose"], context = "") => {
    const target = mapPath(object[key], id, [...at, key], kind, purpose, context);
    if (target !== undefined) object[key] = target;
    return target;
  };
  const scope = (id: string, at: Location, kind: ConfigPathScope["kind"], value: string, candidates: number | null, context: string, flags: { recursive?: boolean; hierarchy?: boolean } = {}) => {
    record(); scopes.push(Object.freeze({ projectId: id, location: Object.freeze([...at]), kind, value, existingCandidates: candidates, context: context.slice(0, 160), ...flags }));
    issue(id, at, "scope-choice-required", value);
  };
  const source = (value: unknown, id: string, at: Location, owner = ""): boolean => {
    visit();
    if (!jsonObject(value) || !jsonObject(value['config'])) { issue(id, at, "invalid-shape"); return false; }
    const config = value['config'], kind = value['kind'];
    const context = [owner, typeof value['name'] === "string" ? value['name'] : ""].filter(Boolean).join(" · ");
    const folder = (cfg: ObjectValue, location: Location) => {
      const target = bind(cfg, "path", id, location, "folder", "source-folder", context);
      if (typeof cfg['recursive'] !== "boolean") issue(id, [...location, "recursive"], "invalid-shape");
      if (typeof cfg['path'] === "string") {
        // Count only when the path was successfully bound; do not guess in the recipient's vault.
        scope(id, location, "folder", cfg['path'], target !== undefined && typeof cfg['recursive'] === "boolean" ? countCandidates(target, cfg['recursive']) : null, context, typeof cfg['recursive'] === "boolean" ? { recursive: cfg['recursive'] } : {});
      }
      return true; // Primary folder source supplies the empty creation-folder fallback.
    };
    const tag = (cfg: ObjectValue, location: Location) => {
      if (typeof cfg['tag'] !== "string" || typeof cfg['hierarchy'] !== "boolean") issue(id, location, "invalid-shape");
      if (typeof cfg['tag'] === "string") scope(id, location, "tag", cfg['tag'], null, context, typeof cfg['hierarchy'] === "boolean" ? { hierarchy: cfg['hierarchy'] } : {});
      return false;
    };
    if (kind === "folder") return folder(config, [...at, "config"]);
    if (kind === "tag") return tag(config, [...at, "config"]);
    if (kind === "native-query") {
      const from = config['from'];
      if (!jsonObject(from)) { issue(id, [...at, "config", "from"], "invalid-shape"); return false; }
      if (from['kind'] === "folder") return folder(from, [...at, "config", "from"]);
      if (from['kind'] === "tag") return tag(from, [...at, "config", "from"]);
      issue(id, [...at, "config", "from"], "unsupported-config"); return false;
    }
    if (kind === "dataview") {
      if (typeof config['query'] !== "string") issue(id, [...at, "config", "query"], "invalid-shape");
      else scope(id, [...at, "config"], "query", config['query'], null, context);
      return false;
    }
    if (kind !== "derived") issue(id, at, "unsupported-config");
    return false;
  };
  const projects = manifest.projects.map(meta => {
    const project = copies.get(meta.id)!, id = project.id, value = project as unknown as ObjectValue;
    for (const key of ["templates", "excludedNotes"]) {
      const list = value[key];
      if (!Array.isArray(list)) { issue(id, [key], "invalid-shape"); continue; }
      list.forEach((path: unknown, index: number) => {
        const target = mapPath(path, id, [key, index], "file", key === "templates" ? "template" : "excluded-note"); if (target !== undefined) list[index] = target;
      });
    }
    const folderFallback = source(project.dataSource, id, ["dataSource"]);
    if (project.additionalSources !== undefined) {
      if (!Array.isArray(project.additionalSources)) issue(id, ["additionalSources"], "invalid-shape");
      else project.additionalSources.forEach((item, index) => source(item, id, ["additionalSources", index]));
    }
    if (typeof value['newNotesFolder'] !== "string") issue(id, ["newNotesFolder"], "invalid-shape");
    else if (value['newNotesFolder']) bind(value, "newNotesFolder", id, [], "folder", "creation-folder");
    else {
      const target = mapPath("", id, ["newNotesFolder"], "folder", "creation-folder", "", folderFallback);
      if (target !== undefined) value['newNotesFolder'] = target;
      else if (!folderFallback) issue(id, ["newNotesFolder"], "creation-folder-choice-required", "");
    }
    project.views.forEach((view, vi) => {
      visit(); const at: Location = ["views", vi];
      if (view.type !== "dashboard" && view.type !== "database") {
        if (!["table", "board", "calendar", "gallery"].includes(view.type)) issue(id, at, "unsupported-config");
        return;
      }
      const config: unknown = view.config;
      if (!jsonObject(config)) { issue(id, [...at, "config"], "invalid-shape"); return; }
      const widgets = config['widgets'];
      if (widgets === undefined) return;
      if (!Array.isArray(widgets)) { issue(id, [...at, "config", "widgets"], "invalid-shape"); return; }
      widgets.forEach((widget: unknown, wi: number) => {
        visit(); const wa = [...at, "config", "widgets", wi];
        if (!jsonObject(widget) || !jsonObject(widget['config'])) { issue(id, wa, "invalid-shape"); return; }
        if (typeof widget['type'] !== "string" || !KNOWN_WIDGETS.has(widget['type'])) { issue(id, wa, "unsupported-config"); return; }
        const cfg = widget['config'];
        if (widget['type'] === "cover-banner") {
          const src = cfg['src'];
          if (typeof src !== "string") issue(id, [...wa, "config", "src"], "invalid-shape");
          else if (src && !/^https?:\/\//i.test(src)) bind(cfg, "src", id, [...wa, "config"], "file", "cover", typeof widget['title'] === "string" ? widget['title'] : "");
        } else if (widget['type'] === "sub-base-canvas" && cfg['inverseTargetId'] !== undefined && cfg['inverseTargetId'] !== "") bind(cfg, "inverseTargetId", id, [...wa, "config"], "file", "record", typeof widget['title'] === "string" ? widget['title'] : "");
        // Database-call config.sourceConfig is historical, not acquired. Leave
        // its JSON intact instead of rewriting dormant paths or asking scope.
      });
    });
    const bytes = new TextEncoder().encode(JSON.stringify(project)).length; outputBytes += bytes;
    if (bytes > MAX_PROJECT_DOCUMENT_BYTES || outputBytes > PACKAGE_LIMITS.totalBytes) throw projectFileError("configuration path preview too large");
    return Object.freeze({ project, archived: meta.archived });
  });
  for (const unused of explicit.unused()) issue(unused.projectId, unused.location, "stale-binding", unused.source);
  return Object.freeze({ stage: "configuration-path-preview", files, projects: Object.freeze(projects), changes: Object.freeze(changes), issues: Object.freeze(issues), scopes: Object.freeze(scopes), bindings: Object.freeze(bindings), targets: explicit.targets, choices });
}
