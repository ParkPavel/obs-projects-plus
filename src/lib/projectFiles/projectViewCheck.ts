import type { ProjectCoreIssue } from "./projectCoreCheck";
import { BOARD_THUMBNAIL_LAYOUTS } from "src/ui/views/Board/types";
import { GALLERY_LAYOUTS, GALLERY_ASPECT_RATIOS, GALLERY_FIT_STYLES, GALLERY_CARD_PREVIEWS } from "src/ui/views/Gallery/galleryOptions";

type Location = readonly (string | number)[];
type ObjectValue = Record<string, unknown>;
/** All callbacks share the caller's whole-JSON and diagnostic budgets. */
export interface ViewInspectionTools {
  readonly issue: (at: Location, code: ProjectCoreIssue["code"]) => void;
  readonly object: (value: unknown, at: Location, allowed: readonly string[]) => ObjectValue | undefined;
  readonly optional: (value: ObjectValue, key: string, at: Location, kind: "string" | "boolean" | "number") => boolean;
  readonly scalar: (value: unknown, at: Location, kind: "string" | "boolean" | "number") => boolean;
  readonly list: (value: unknown, at: Location) => unknown[] | undefined;
  readonly enumeration: (value: unknown, at: Location, allowed: ReadonlySet<string>) => void;
}

/** Structural inspection only: no normalizer, defaults, path rewriting or render side effects. */
export function inspectStandaloneViewConfig(kind: string, value: unknown, at: Location, tools: ViewInspectionTools): boolean {
  if (kind !== "board" && kind !== "gallery" && kind !== "calendar") return false;
  const { object, optional, scalar, list, issue, enumeration } = tools;
  const strings = (cfg: ObjectValue, keys: readonly string[], where = at) => { for (const key of keys) optional(cfg, key, where, "string"); };
  const booleans = (cfg: ObjectValue, keys: readonly string[], where = at) => { for (const key of keys) optional(cfg, key, where, "boolean"); };
  const numbers = (cfg: ObjectValue, keys: readonly string[], where = at) => { for (const key of keys) optional(cfg, key, where, "number"); };
  const stringList = (value: unknown, where: Location) => list(value, where)?.forEach((entry, i) => scalar(entry, [...where, i], "string"));
  const arrays = (cfg: ObjectValue, keys: readonly string[], where = at) => { for (const key of keys) if (cfg[key] !== undefined) stringList(cfg[key], [...where, key]); };
  const enums = (cfg: ObjectValue, key: string, allowed: readonly string[]) => { if (cfg[key] !== undefined) enumeration(cfg[key], [...at, key], new Set(allowed)); };
  const dictionary = (value: unknown, where: Location, visit: (entry: unknown, location: Location) => void) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) { issue(where, "invalid-type"); return; }
    for (const [key, entry] of Object.entries(value)) visit(entry, [...where, key]);
  };
  const frame = (value: unknown, where: Location) => {
    const cfg = object(value, where, ["heightRem", "gridSpan"]); if (cfg) numbers(cfg, ["heightRem", "gridSpan"], where);
  };
  const cardKeys = ["cardFrame", "cardFramesByRecord"];
  const frames = (cfg: ObjectValue) => {
    if (cfg['cardFrame'] !== undefined) frame(cfg['cardFrame'], [...at, "cardFrame"]);
    if (cfg['cardFramesByRecord'] !== undefined) dictionary(cfg['cardFramesByRecord'], [...at, "cardFramesByRecord"], frame);
  };
  if (kind === "board") {
    const cfg = object(value, at, [...cardKeys, "groupByField", "checkField", "headerField", "iconField", "orderSyncField", "columnWidth", "columns", "includeFields", "freezeAll", "freezeColumns", "persistedStatuses", "boardZoom", "groupMode", "thumbnailLayout", "coverField"]);
    if (!cfg) return true;
    strings(cfg, ["groupByField", "checkField", "headerField", "iconField", "orderSyncField", "coverField"]);
    booleans(cfg, ["freezeAll", "freezeColumns"]); numbers(cfg, ["columnWidth", "boardZoom"]);
    arrays(cfg, ["includeFields", "persistedStatuses"]);
    enums(cfg, "groupMode", ["values", "semantic"]); enums(cfg, "thumbnailLayout", BOARD_THUMBNAIL_LAYOUTS);
    if (cfg['columns'] !== undefined) dictionary(cfg['columns'], [...at, "columns"], (value, where) => {
      const column = object(value, where, ["weight", "records", "collapse", "pinned"]); if (!column) return;
      numbers(column, ["weight"], where); booleans(column, ["collapse", "pinned"], where); arrays(column, ["records"], where);
    });
    frames(cfg);
  } else if (kind === "gallery") {
    const cfg = object(value, at, [...cardKeys, "coverField", "iconField", "fitStyle", "cardWidth", "includeFields", "layout", "coverAspectRatio", "showFieldLabels", "groupByField", "collapsedGroups", "cardPreview", "compact"]);
    if (!cfg) return true;
    // null explicitly disables the cover property; absence inherits it.
    if (cfg['coverField'] !== null) optional(cfg, "coverField", at, "string");
    strings(cfg, ["iconField", "groupByField"]); numbers(cfg, ["cardWidth"]);
    booleans(cfg, ["showFieldLabels", "compact"]); arrays(cfg, ["includeFields", "collapsedGroups"]);
    enums(cfg, "layout", GALLERY_LAYOUTS); enums(cfg, "coverAspectRatio", GALLERY_ASPECT_RATIOS);
    enums(cfg, "fitStyle", GALLERY_FIT_STYLES); enums(cfg, "cardPreview", GALLERY_CARD_PREVIEWS);
    frames(cfg);
  } else {
    const cfg = object(value, at, ["interval", "displayMode", "startDateField", "endDateField", "startTimeField", "endTimeField", "eventColorField", "creationDuration", "startHour", "endHour", "dateField", "checkField", "statusField", "iconField", "centerOn", "agendaOpen", "localAgenda", "timezone", "timeFormat"]);
    if (!cfg) return true;
    strings(cfg, ["startDateField", "endDateField", "startTimeField", "endTimeField", "eventColorField", "dateField", "checkField", "statusField", "iconField", "timezone", "timeFormat"]);
    if (cfg['centerOn'] !== null) optional(cfg, "centerOn", at, "string");
    numbers(cfg, ["creationDuration", "startHour", "endHour"]); booleans(cfg, ["agendaOpen"]);
    enums(cfg, "interval", ["year", "month", "2weeks", "week", "day"]); enums(cfg, "displayMode", ["headers", "bars"]);
    // localAgenda is visited by the outer typed Agenda visitor, including inside
    // database-call tabs. Do not guess another payload's context from its keys.
  }
  return true;
}
