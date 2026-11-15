import { filterOperatorTypes } from "src/settings/base/settings";
import { MAX_PROJECT_DOCUMENT_BYTES, projectFileError } from "./document";

type Location = readonly (string | number)[];
type ObjectValue = Record<string, unknown>;
export interface ProjectCoreIssue {
  readonly location: Location;
  readonly code: "invalid-type" | "missing-field" | "unknown-field" | "unknown-kind" | "duplicate-id" | "invalid-reference" | "section-unchecked";
}
export interface ProjectCoreCheck {
  readonly stage: "project-core-check";
  readonly coverage: "root-sources-and-view-envelope";
  /** Never an application/schema-completeness token, including when issues is empty. */
  readonly complete: false;
  readonly issues: readonly ProjectCoreIssue[];
}
const operators = new Set(Object.keys(filterOperatorTypes));
const viewKinds = new Set(["dashboard", "database", "table", "board", "calendar", "gallery"]);

/** Strict, bounded JSON inspection. Does not migrate, mutate, resolve references externally or evaluate anything. */
export function checkProjectCoreJson(text: string): ProjectCoreCheck {
  if (typeof text !== "string" || text.length > MAX_PROJECT_DOCUMENT_BYTES || new TextEncoder().encode(text).length > MAX_PROJECT_DOCUMENT_BYTES) throw projectFileError("core schema input too large");
  const input: unknown = JSON.parse(text);
  // Bound the whole JSON, including opaque/unknown sections, before recursive typed visitors.
  let nodes = 0;
  const stack: { value: unknown; depth: number }[] = [{ value: input, depth: 0 }];
  while (stack.length) {
    const item = stack.pop()!;
    if (++nodes > 16384 || item.depth > 32) throw projectFileError("core schema input too complex");
    if (typeof item.value === "number" && !Number.isFinite(item.value)) throw projectFileError("non-finite core schema value");
    if (item.value && typeof item.value === "object") {
      const values = Object.values(item.value);
      if (nodes + stack.length + values.length > 16384) throw projectFileError("core schema input too complex");
      for (const value of values) stack.push({ value, depth: item.depth + 1 });
    }
  }
  const issues: ProjectCoreIssue[] = [];
  const issue = (location: Location, code: ProjectCoreIssue["code"]) => {
    if (issues.length >= 4096) throw projectFileError("too many core schema diagnostics");
    issues.push(Object.freeze({ location: Object.freeze([...location]), code }));
  };
  const object = (value: unknown, at: Location, allowed: readonly string[]): ObjectValue | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) { issue(at, "invalid-type"); return; }
    const result = value as ObjectValue;
    for (const key of Object.keys(result)) if (!allowed.includes(key)) issue([...at, key], "unknown-field");
    return result;
  };
  type ScalarKind = "string" | "boolean" | "integer" | "number";
  const scalar = (value: unknown, at: Location, kind: ScalarKind, nonempty = false): boolean => {
    const valid = kind === "integer" ? typeof value === "number" && Number.isSafeInteger(value) && value >= 0 : kind === "number" ? typeof value === "number" && Number.isFinite(value) : typeof value === kind;
    if (!valid || nonempty && (typeof value !== "string" || !value || value.length > 512)) { issue(at, "invalid-type"); return false; }
    return true;
  };
  const required = (value: ObjectValue, key: string, at: Location, kind: ScalarKind, nonempty = false) => {
    if (!Object.prototype.hasOwnProperty.call(value, key)) { issue([...at, key], "missing-field"); return false; }
    return scalar(value[key], [...at, key], kind, nonempty);
  };
  const optional = (value: ObjectValue, key: string, at: Location, kind: ScalarKind, nonempty = false) => {
    if (Object.prototype.hasOwnProperty.call(value, key)) return scalar(value[key], [...at, key], kind, nonempty);
    return false;
  };
  const list = (value: unknown, at: Location): unknown[] | undefined => {
    if (!Array.isArray(value)) { issue(at, "invalid-type"); return; }
    return value as unknown[];
  };
  const enumeration = (value: unknown, at: Location, allowed: ReadonlySet<string>) => {
    if (typeof value !== "string") issue(at, "invalid-type"); else if (!allowed.has(value)) issue(at, "unknown-kind");
  };
  const filterCondition = (value: unknown, at: Location) => {
    const cfg = object(value, at, ["field", "operator", "value", "enabled"]); if (!cfg) return;
    required(cfg, "field", at, "string"); required(cfg, "enabled", at, "boolean");
    enumeration(cfg['operator'], [...at, "operator"], operators); optional(cfg, "value", at, "string");
  };
  const filter = (value: unknown, at: Location): void => {
    const cfg = object(value, at, ["conjunction", "conditions", "groups"]); if (!cfg) return;
    if (cfg['conjunction'] !== undefined) enumeration(cfg['conjunction'], [...at, "conjunction"], new Set(["and", "or"]));
    list(cfg['conditions'], [...at, "conditions"])?.forEach((condition, i) => filterCondition(condition, [...at, "conditions", i]));
    if (cfg['groups'] !== undefined) list(cfg['groups'], [...at, "groups"])?.forEach((group, i) => filter(group, [...at, "groups", i]));
  };
  const identities = new Map<string, Location>(), derived: { from: string; id?: string; at: Location }[] = [];
  const source = (value: unknown, at: Location, registered: boolean) => {
    const cfg = object(value, at, ["kind", "config", "id", "name"]); if (!cfg) return;
    const validId = optional(cfg, "id", at, "string", true); optional(cfg, "name", at, "string");
    if (validId && registered) {
      const id = cfg['id'] as string;
      if (id === "project") issue([...at, "id"], "invalid-reference");
      if (identities.has(id)) issue([...at, "id"], "duplicate-id"); else identities.set(id, [...at, "id"]);
    }
    const kind = cfg['kind'];
    if (typeof kind !== "string") { issue([...at, "kind"], "invalid-type"); return; }
    const folder = (input: unknown, location: Location, native = false) => {
      const data = object(input, location, native ? ["kind", "path", "recursive"] : ["path", "recursive"]); if (!data) return;
      required(data, "path", location, "string"); required(data, "recursive", location, "boolean");
    };
    const tag = (input: unknown, location: Location, native = false) => {
      const data = object(input, location, native ? ["kind", "tag", "hierarchy"] : ["tag", "hierarchy"]); if (!data) return;
      required(data, "tag", location, "string"); required(data, "hierarchy", location, "boolean");
    };
    const ca = [...at, "config"];
    if (kind === "folder") folder(cfg['config'], ca);
    else if (kind === "tag") tag(cfg['config'], ca);
    else if (kind === "dataview") {
      const data = object(cfg['config'], ca, ["query", "filter"]); if (!data) return;
      required(data, "query", ca, "string"); if (data['filter'] !== undefined) filter(data['filter'], [...ca, "filter"]);
    } else if (kind === "native-query") {
      const data = object(cfg['config'], ca, ["from", "where", "limit"]); if (!data) return;
      const from = data['from'];
      if (!from || typeof from !== "object" || Array.isArray(from)) issue([...ca, "from"], "invalid-type");
      else if ((from as ObjectValue)['kind'] === "folder") folder(from, [...ca, "from"], true);
      else if ((from as ObjectValue)['kind'] === "tag") tag(from, [...ca, "from"], true);
      else enumeration((from as ObjectValue)['kind'], [...ca, "from", "kind"], new Set(["folder", "tag"]));
      if (data['where'] !== undefined) filter(data['where'], [...ca, "where"]);
      optional(data, "limit", ca, "number");
    } else if (kind === "derived") {
      const data = object(cfg['config'], ca, ["from", "where"]); if (!data) return;
      if (required(data, "from", ca, "string", true)) derived.push({ from: data['from'] as string, ...(validId && registered ? { id: cfg['id'] as string } : {}), at: [...ca, "from"] });
      filter(data['where'], [...ca, "where"]);
    } else issue([...at, "kind"], "unknown-kind");
  };
  const root = object(input, [], ["id", "name", "fieldConfig", "views", "defaultName", "templates", "excludedNotes", "isDefault", "dataSource", "additionalSources", "newNotesFolder", "dateFormat", "autosave", "agenda", "uniqueIdCounter", "colorFavorites"]);
  if (root) {
    required(root, "id", [], "string", true); required(root, "name", [], "string"); required(root, "defaultName", [], "string");
    required(root, "isDefault", [], "boolean"); required(root, "newNotesFolder", [], "string"); optional(root, "autosave", [], "boolean"); optional(root, "uniqueIdCounter", [], "integer");
    for (const key of ["templates", "excludedNotes"]) list(root[key], [key])?.forEach((value, i) => scalar(value, [key, i], "string"));
    source(root['dataSource'], ["dataSource"], true);
    if (root['additionalSources'] !== undefined) list(root['additionalSources'], ["additionalSources"])?.forEach((item, i) => source(item, ["additionalSources", i], true));
    const fields = root['fieldConfig'];
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) issue(["fieldConfig"], "invalid-type");
    else for (const [key, value] of Object.entries(fields)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) issue(["fieldConfig", key], "invalid-type");
      else issue(["fieldConfig", key], "section-unchecked");
    }
    const ids = new Set<string>();
    list(root['views'], ["views"])?.forEach((value, index) => {
      const at = ["views", index], view = object(value, at, ["id", "name", "type", "config", "filter", "colors", "sort"]); if (!view) return;
      if (required(view, "id", at, "string", true)) { const id = view['id'] as string; if (ids.has(id)) issue([...at, "id"], "duplicate-id"); ids.add(id); }
      required(view, "name", at, "string"); enumeration(view['type'], [...at, "type"], viewKinds);
      const config = view['config'];
      if (!config || typeof config !== "object" || Array.isArray(config)) issue([...at, "config"], "invalid-type");
      else {
        issue([...at, "config"], "section-unchecked");
        const widgets = (config as ObjectValue)['widgets'];
        if (Array.isArray(widgets)) widgets.forEach((widget: unknown, wi) => {
          if (!widget || typeof widget !== "object" || Array.isArray(widget)) return;
          const data = widget as ObjectValue, cfg = data['config'];
          if (data['type'] === "database-call" && cfg && typeof cfg === "object" && !Array.isArray(cfg) && (cfg as ObjectValue)['sourceConfig'] !== undefined) source((cfg as ObjectValue)['sourceConfig'], [...at, "config", "widgets", wi, "config", "sourceConfig"], false);
        });
      }
      filter(view['filter'], [...at, "filter"]);
      const colors = object(view['colors'], [...at, "colors"], ["conditions"]);
      if (colors) list(colors['conditions'], [...at, "colors", "conditions"])?.forEach((value, i) => {
        const ca = [...at, "colors", "conditions", i], row = object(value, ca, ["color", "condition"]); if (!row) return;
        required(row, "color", ca, "string"); filterCondition(row['condition'], [...ca, "condition"]);
      });
      const sort = object(view['sort'], [...at, "sort"], ["criteria"]);
      if (sort) list(sort['criteria'], [...at, "sort", "criteria"])?.forEach((value, i) => {
        const sa = [...at, "sort", "criteria", i], row = object(value, sa, ["field", "order", "enabled"]); if (!row) return;
        required(row, "field", sa, "string"); required(row, "enabled", sa, "boolean"); enumeration(row['order'], [...sa, "order"], new Set(["asc", "desc"]));
      });
    });
    if (root['dateFormat'] !== undefined) {
      const date = object(root['dateFormat'], ["dateFormat"], ["writeFormat", "displayFormat", "includeTime", "preset"]);
      if (date) {
        required(date, "writeFormat", ["dateFormat"], "string"); optional(date, "displayFormat", ["dateFormat"], "string"); optional(date, "includeTime", ["dateFormat"], "boolean");
        if (date['preset'] !== undefined) enumeration(date['preset'], ["dateFormat", "preset"], new Set(["iso", "us", "eu", "uk", "japan", "custom"]));
      }
    }
    if (root['colorFavorites'] !== undefined) list(root['colorFavorites'], ["colorFavorites"])?.forEach((value, i) => {
      const at = ["colorFavorites", i], color = object(value, at, ["color", "name"]); if (!color) return;
      required(color, "color", at, "string"); required(color, "name", at, "string");
    });
    if (root['agenda'] !== undefined) {
      if (!root['agenda'] || typeof root['agenda'] !== "object" || Array.isArray(root['agenda'])) issue(["agenda"], "invalid-type"); else issue(["agenda"], "section-unchecked");
    }
  }
  // Local source references only: external references and full graph validation are later checks.
  for (const entry of derived) if (entry.from !== "project" && (!identities.has(entry.from) || entry.from === entry.id)) issue(entry.at, "invalid-reference");
  const links = new Map(derived.filter((entry): entry is typeof entry & { id: string } => entry.id !== undefined).map(entry => [entry.id, entry]));
  const completed = new Set<string>();
  for (const start of links.keys()) {
    if (completed.has(start)) continue;
    const path: string[] = [], positions = new Map<string, number>(); let current = start;
    while (links.has(current) && !completed.has(current) && !positions.has(current)) {
      positions.set(current, path.length); path.push(current); current = links.get(current)!.from;
    }
    const cycle = positions.get(current);
    if (cycle !== undefined && path.length - cycle > 1) for (const id of path.slice(cycle)) issue(links.get(id)!.at, "invalid-reference");
    for (const id of path) completed.add(id);
  }
  return Object.freeze({ stage: "project-core-check", coverage: "root-sources-and-view-envelope", complete: false, issues: Object.freeze(issues) });
}
