import { filterOperatorTypes } from "src/settings/base/settings";
import { PROPERTY_TYPES } from "src/lib/visualizer/propertyTypes";
import { ROLLUP_MODES } from "src/lib/database/rollupMode";
import type { RollupFunction } from "src/lib/engine/aggregate";
import { LEGACY_AGENDA_OPERATORS } from "src/lib/filters/agendaFilterModel";
import { inspectStandaloneViewConfig } from "./projectViewCheck";
import { createDashboardConfigInspector } from "./projectDashboardCheck";
import { MAX_PROJECT_DOCUMENT_BYTES, projectFileError } from "./document";

type Location = readonly (string | number)[];
type ObjectValue = Record<string, unknown>;
export interface ProjectCoreIssue {
  readonly location: Location;
  readonly code: "invalid-type" | "missing-field" | "unknown-field" | "unknown-kind" | "duplicate-id" | "invalid-reference" | "section-unchecked";
}
export interface ProjectCoreCheck {
  readonly stage: "project-core-check";
  readonly coverage: "root-fields-agenda-sources-and-supported-view-configs";
  /** Never an application/schema-completeness token, including when issues is empty. */
  readonly complete: false;
  readonly issues: readonly ProjectCoreIssue[];
}
const operators = new Set(Object.keys(filterOperatorTypes));
const agendaOperators = new Set([...operators, ...Object.keys(LEGACY_AGENDA_OPERATORS)]);
const viewKinds = new Set(["dashboard", "database", "table", "board", "calendar", "gallery"]);
const propertyKinds = new Set<string>([...PROPERTY_TYPES, "autotime", "unique_id"]);
// Record keeps this vocabulary exhaustive when the aggregation kernel adds a function.
const rollupVocabulary: Record<RollupFunction, true> = {
  count: true, count_total: true, count_values: true, count_unique: true, count_empty: true,
  percent_empty: true, percent_not_empty: true, sum: true, avg: true, min: true, max: true,
  median: true, range: true, percent_true: true, concat: true, concat_unique: true,
  show_original: true, show_unique: true, first_value: true, last_value: true,
};
const rollupFunctions = new Set(Object.keys(rollupVocabulary));
const rollupModes = new Set<string>(ROLLUP_MODES.map(mode => mode.id));
const rollupModeFunctions = new Map<string, RollupFunction | null>(ROLLUP_MODES.map(mode => [mode.id, mode.fn]));

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
  const stringList = (value: unknown, at: Location) => list(value, at)?.forEach((entry, i) => scalar(entry, [...at, i], "string"));
  const field = (value: unknown, at: Location) => {
    const cfg = object(value, at, ["options", "richText", "fileLinks", "time", "relation", "rollup", "type", "statusGroups", "autoTime", "uniqueIdPrefix", "formulaVersion", "formula"]);
    if (!cfg) return;
    for (const key of ["richText", "fileLinks", "time"]) optional(cfg, key, at, "boolean");
    for (const key of ["uniqueIdPrefix", "formula"]) optional(cfg, key, at, "string");
    if (cfg['type'] !== undefined) enumeration(cfg['type'], [...at, "type"], propertyKinds);
    if (cfg['autoTime'] !== undefined) enumeration(cfg['autoTime'], [...at, "autoTime"], new Set(["created", "modified"]));
    if (cfg['formulaVersion'] !== undefined) enumeration(cfg['formulaVersion'], [...at, "formulaVersion"], new Set(["unified-v1"]));
    if (cfg['options'] !== undefined) stringList(cfg['options'], [...at, "options"]);
    if (cfg['statusGroups'] !== undefined) {
      const sa = [...at, "statusGroups"], groups = object(cfg['statusGroups'], sa, ["todo", "inProgress", "complete"]);
      if (groups) for (const key of ["todo", "inProgress", "complete"]) if (groups[key] !== undefined) stringList(groups[key], [...sa, key]);
    }
    if (cfg['relation'] !== undefined) {
      const ra = [...at, "relation"], relation = object(cfg['relation'], ra, ["targetProjectId", "displayField", "targetSubBaseFilter", "inverseFieldName", "inverseDisplayField"]);
      if (relation) {
        required(relation, "targetProjectId", ra, "string");
        for (const key of ["displayField", "inverseFieldName", "inverseDisplayField"]) optional(relation, key, ra, "string");
        if (relation['targetSubBaseFilter'] !== undefined) filter(relation['targetSubBaseFilter'], [...ra, "targetSubBaseFilter"]);
      }
    }
    if (cfg['rollup'] !== undefined) {
      const ra = [...at, "rollup"], rollup = object(cfg['rollup'], ra, ["relationField", "targetProjectId", "targetField", "function", "separator", "mode", "backlink", "orderBy"]);
      if (rollup) {
        required(rollup, "relationField", ra, "string"); required(rollup, "targetField", ra, "string");
        if (!Object.prototype.hasOwnProperty.call(rollup, "function")) issue([...ra, "function"], "missing-field");
        else enumeration(rollup['function'], [...ra, "function"], rollupFunctions);
        for (const key of ["targetProjectId", "separator", "orderBy"]) optional(rollup, key, ra, "string");
        if (rollup['mode'] !== undefined) enumeration(rollup['mode'], [...ra, "mode"], rollupModes);
        if (typeof rollup['mode'] === "string" && rollupModes.has(rollup['mode']) && typeof rollup['function'] === "string" && rollupFunctions.has(rollup['function'])) {
          const expected = rollupModeFunctions.get(rollup['mode']);
          if (expected !== null && expected !== rollup['function']) issue([...ra, "function"], "invalid-reference");
        }
        if (rollup['backlink'] !== undefined) {
          const ba = [...ra, "backlink"], backlink = object(rollup['backlink'], ba, ["projectId", "relationField"]);
          if (backlink) { required(backlink, "projectId", ba, "string"); required(backlink, "relationField", ba, "string"); }
        }
      }
    }
  };
  const agenda = (value: unknown, at: Location) => {
    const cfg = object(value, at, ["mode", "standard", "custom"]); if (!cfg) return;
    if (!Object.prototype.hasOwnProperty.call(cfg, "mode")) issue([...at, "mode"], "missing-field");
    else enumeration(cfg['mode'], [...at, "mode"], new Set(["standard", "custom"]));
    if (cfg['standard'] !== undefined) {
      const sa = [...at, "standard"], standard = object(cfg['standard'], sa, ["inheritCalendarFilters"]);
      if (standard) required(standard, "inheritCalendarFilters", sa, "boolean");
    }
    const condition = (value: unknown, at: Location, legacy = false) => {
      const row = object(value, at, ["id", "field", "operator", "value", "enabled"]); if (!row) return;
      if (legacy) optional(row, "id", at, "string", true); else required(row, "id", at, "string", true);
      required(row, "field", at, "string"); optional(row, "enabled", at, "boolean");
      enumeration(row['operator'], [...at, "operator"], agendaOperators);
      const item = row['value'];
      if (!Object.prototype.hasOwnProperty.call(row, "value")) { if (!legacy) issue([...at, "value"], "missing-field"); }
      else if (Array.isArray(item)) stringList(item, [...at, "value"]);
      else if (item !== null && typeof item !== "string" && typeof item !== "boolean" && typeof item !== "number") issue([...at, "value"], "invalid-type");
    };
    const group = (value: unknown, at: Location): void => {
      const row = object(value, at, ["id", "conjunction", "filters", "groups"]); if (!row) return;
      required(row, "id", at, "string", true); enumeration(row['conjunction'], [...at, "conjunction"], new Set(["AND", "OR"]));
      list(row['filters'], [...at, "filters"])?.forEach((item, i) => condition(item, [...at, "filters", i]));
      list(row['groups'], [...at, "groups"])?.forEach((item, i) => group(item, [...at, "groups", i]));
    };
    if (cfg['custom'] !== undefined) {
      const ca = [...at, "custom"], custom = object(cfg['custom'], ca, ["lists"]); if (!custom) return;
      const ids = new Set<string>();
      list(custom['lists'], [...ca, "lists"])?.forEach((value, i) => {
        const la = [...ca, "lists", i], row = object(value, la, ["id", "name", "icon", "filterMode", "filterGroup", "filterFormula", "formulaVersion", "order", "collapsed", "color", "filters"]); if (!row) return;
        if (required(row, "id", la, "string", true)) { const id = row['id'] as string; if (ids.has(id)) issue([...la, "id"], "duplicate-id"); ids.add(id); }
        required(row, "name", la, "string"); required(row, "order", la, "number"); optional(row, "collapsed", la, "boolean");
        for (const key of ["color", "filterFormula"]) optional(row, key, la, "string");
        if (row['formulaVersion'] !== undefined) enumeration(row['formulaVersion'], [...la, "formulaVersion"], new Set(["unified-v1"]));
        const ia = [...la, "icon"], icon = object(row['icon'], ia, ["type", "value"]);
        if (icon) { enumeration(icon['type'], [...ia, "type"], new Set(["lucide", "emoji", "obsidian-icon"])); required(icon, "value", ia, "string"); }
        // The runtime still reads old flat lists with no filterMode; preserve their
        // original shape and aliases instead of silently migrating them here.
        if (row['filterMode'] !== undefined) enumeration(row['filterMode'], [...la, "filterMode"], new Set(["visual", "advanced"]));
        else if (row['filters'] === undefined) issue([...la, "filterMode"], "missing-field");
        if (row['filterGroup'] !== undefined) group(row['filterGroup'], [...la, "filterGroup"]);
        if (row['filters'] !== undefined) list(row['filters'], [...la, "filters"])?.forEach((item, j) => condition(item, [...la, "filters", j], true));
      });
    }
  };
  const localAgenda = (value: unknown, at: Location) => {
    if (value && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, "localAgenda")) agenda((value as ObjectValue)['localAgenda'], [...at, "localAgenda"]);
  };
  const identities = new Map<string, Location>(), derived: { from: string; id?: string; at: Location }[] = [];
  const source = (value: unknown, at: Location) => {
    const cfg = object(value, at, ["kind", "config", "id", "name"]); if (!cfg) return;
    const validId = optional(cfg, "id", at, "string", true); optional(cfg, "name", at, "string");
    if (validId) {
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
      if (required(data, "from", ca, "string", true)) derived.push({ from: data['from'] as string, ...(validId ? { id: cfg['id'] as string } : {}), at: [...ca, "from"] });
      filter(data['where'], [...ca, "where"]);
    } else issue([...at, "kind"], "unknown-kind");
  };
  const plainView = (kind: string, value: unknown, at: Location) => {
    const handled = inspectStandaloneViewConfig(kind, value, at, { issue, object, optional, scalar, list, enumeration });
    if (handled && kind === "calendar") localAgenda(value, at);
    return handled;
  };
  const dashboardView = createDashboardConfigInspector({ issue, object, optional, scalar, list, enumeration, filter, plainView });
  const root = object(input, [], ["id", "name", "fieldConfig", "views", "defaultName", "templates", "excludedNotes", "isDefault", "dataSource", "additionalSources", "newNotesFolder", "dateFormat", "autosave", "agenda", "uniqueIdCounter", "colorFavorites"]);
  if (root) {
    required(root, "id", [], "string", true); required(root, "name", [], "string"); required(root, "defaultName", [], "string");
    required(root, "isDefault", [], "boolean"); required(root, "newNotesFolder", [], "string"); optional(root, "autosave", [], "boolean"); optional(root, "uniqueIdCounter", [], "integer");
    for (const key of ["templates", "excludedNotes"]) list(root[key], [key])?.forEach((value, i) => scalar(value, [key, i], "string"));
    source(root['dataSource'], ["dataSource"]);
    if (root['additionalSources'] !== undefined) list(root['additionalSources'], ["additionalSources"])?.forEach((item, i) => source(item, ["additionalSources", i]));
    const fields = root['fieldConfig'];
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) issue(["fieldConfig"], "invalid-type");
    else for (const [key, value] of Object.entries(fields)) field(value, ["fieldConfig", key]);
    const ids = new Set<string>();
    list(root['views'], ["views"])?.forEach((value, index) => {
      const at = ["views", index], view = object(value, at, ["id", "name", "type", "config", "filter", "colors", "sort"]); if (!view) return;
      if (required(view, "id", at, "string", true)) { const id = view['id'] as string; if (ids.has(id)) issue([...at, "id"], "duplicate-id"); ids.add(id); }
      required(view, "name", at, "string"); enumeration(view['type'], [...at, "type"], viewKinds);
      const config = view['config'];
      if (!config || typeof config !== "object" || Array.isArray(config)) issue([...at, "config"], "invalid-type");
      else {
        const type = view['type'], location = [...at, "config"];
        if (typeof type !== "string" || (!plainView(type, config, location) && !dashboardView(type, config, location))) issue(location, "section-unchecked");
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
    if (root['agenda'] !== undefined) agenda(root['agenda'], ["agenda"]);
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
  return Object.freeze({ stage: "project-core-check", coverage: "root-fields-agenda-sources-and-supported-view-configs", complete: false, issues: Object.freeze(issues) });
}
