// w4-p05 (audit F11, P05) — the values a filter's value box offers.
//
// Three copies built the list three ways: the main filter panel and the colour
// rules read the view's records, the agenda added every markdown file of the
// vault — templates and other projects' notes included — and the agenda's copy
// rescanned the vault whenever a row changed. The policy (CONSOLIDATION §7,
// row 10) is one list for one project: the values the project's records hold
// for the field, after the options its schema declares; template folders and
// template text (`<% %>`, `{{ }}`) never count. The list is kept per set of
// records, and a change to any note gives the view a new set, so a modify,
// delete, rename or source change is seen on the next ask.

import { DataFieldType, type DataRecord } from "src/lib/dataframe/dataframe";

export const SUGGESTION_LIMIT = 200;

const TEMPLATE_TEXT = /<%[\s\S]*?%>|\{\{[\s\S]*?\}\}/;

/** Text a template engine would fill in, not a value a note holds. */
export function isTemplateText(text: string): boolean {
  return TEMPLATE_TEXT.test(text);
}

function trimSlashes(path: string): string {
  return path.trim().replace(/^\/+|\/+$/g, "");
}

/** Whether `path` lies in one of `folders` (vault-relative, any depth). */
export function inTemplateFolder(path: string, folders: readonly string[]): boolean {
  return folders.some((folder) => folder !== "" && (path === folder || path.startsWith(`${folder}/`)));
}

/**
 * The folders the core Templates plugin and Templater read templates from.
 * Settings are read loosely: a plugin that is off or absent adds nothing.
 */
export function templateFoldersOf(app: unknown): string[] {
  const a = app as {
    internalPlugins?: { getPluginById?: (id: string) => { enabled?: boolean; instance?: { options?: { folder?: unknown } } } | null };
    plugins?: { plugins?: Record<string, { settings?: { templates_folder?: unknown } } | undefined> };
  } | null;
  const folders = new Set<string>();
  const core = a?.internalPlugins?.getPluginById?.("templates");
  const coreFolder = core?.enabled === false ? undefined : core?.instance?.options?.folder;
  if (typeof coreFolder === "string" && trimSlashes(coreFolder) !== "") folders.add(trimSlashes(coreFolder));
  const templater = a?.plugins?.plugins?.["templater-obsidian"]?.settings?.templates_folder;
  if (typeof templater === "string" && trimSlashes(templater) !== "") folders.add(trimSlashes(templater));
  return [...folders];
}

/**
 * One stored value as suggestion texts: list items one by one, a wikilink as
 * the text it shows, nothing for empty, object or template values.
 */
export function suggestionTexts(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw.flatMap((item) => (Array.isArray(item) ? [] : suggestionTexts(item)));
  let text: string;
  if (raw instanceof Date) text = raw.toISOString();
  else if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") text = String(raw);
  else return [];
  const link = /^\[\[([^\]]+)\]\]$/.exec(text.trim());
  if (link?.[1]) {
    const pipe = link[1].indexOf("|");
    text = pipe >= 0 ? link[1].slice(pipe + 1) : link[1];
  }
  text = text.trim();
  if (text === "" || text === "undefined" || text === "null" || isTemplateText(text)) return [];
  return [text];
}

/** The part of a field the list reads: its name, type and declared options. */
export interface SuggestionField {
  readonly name: string;
  readonly type: string;
  readonly typeConfig?: { readonly options?: readonly string[] };
}

export interface SuggestionContext {
  /** Folders whose notes are templates (see `templateFoldersOf`). */
  readonly templateFolders?: readonly string[];
}

function collect(records: readonly DataRecord[], field: SuggestionField, folders: readonly string[]): string[] {
  if (field.type === String(DataFieldType.Boolean)) return ["true", "false"];
  const declared: string[] = [];
  for (const option of field.typeConfig?.options ?? []) declared.push(...suggestionTexts(option));
  const used = new Set<string>();
  for (const record of records) {
    if (inTemplateFolder(record.id, folders)) continue;
    for (const text of suggestionTexts(record.values[field.name])) used.add(text);
  }
  const out = new Set(declared);
  for (const text of [...used].sort()) {
    if (out.size >= SUGGESTION_LIMIT) break;
    out.add(text);
  }
  return [...out].slice(0, SUGGESTION_LIMIT);
}

// One memo for every surface: a set of records maps to its lists by field.
const memo = new WeakMap<readonly DataRecord[], Map<string, string[]>>();
let collected = 0;

/** The suggestions of `field` over the project's `records`. */
export function valueSuggestions(
  records: readonly DataRecord[],
  field: SuggestionField | undefined,
  context: SuggestionContext = {},
): string[] {
  if (!field) return [];
  const folders = context.templateFolders ?? [];
  const id = [field.name, field.type, ...(field.typeConfig?.options ?? []), "\u0000", ...folders].join("\u0001");
  let byField = memo.get(records);
  if (!byField) {
    byField = new Map();
    memo.set(records, byField);
  }
  let hit = byField.get(id);
  if (!hit) {
    collected += 1;
    hit = collect(records, field, folders);
    byField.set(id, hit);
  }
  return hit;
}

/** How many lists were built rather than read from the memo (tests). */
export function suggestionBuilds(): number {
  return collected;
}
