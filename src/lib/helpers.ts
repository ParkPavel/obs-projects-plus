import { normalizePath, TFile } from "obsidian";
import { get } from "svelte/store";

import { app } from "src/lib/stores/obsidian";
import type { FilterCondition, FilterDefinition, ProjectDefinition, ViewDefinition } from "src/settings/settings";
import { getContext, setContext } from "svelte";
import type { DataField } from "./dataframe/dataframe";
import { toNumber } from "./engine/numeric";

// Export date formatting utilities
export {
  formatDateForProject,
  formatDateForDisplay,
  formatDateForInternal,
  parseDate,
} from "./helpers/dateFormatting";

/**
 * Normalizes a tag to always start with exactly one `#`.
 *
 * Handles all common user inputs:
 * - `"project"` → `"#project"`
 * - `"#project"` → `"#project"` (no change)
 * - `"##project"` → `"#project"` (strips extra `#`)
 * - `" #project "` → `"#project"` (trims whitespace)
 *
 * @param raw - The raw tag string from user input, config, or YAML
 * @returns Normalized tag with exactly one leading `#`
 */
export function normalizeTag(raw: string): string {
  const trimmed = raw.toString().trim();
  // Strip all leading # and re-add exactly one
  const stripped = trimmed.replace(/^#+/, "");
  return stripped ? "#" + stripped : "";
}

/**
 * Removes the leading `#` from a normalized tag for YAML frontmatter storage.
 *
 * @param tag - A tag string (with or without `#`)
 * @returns The tag without any leading `#` characters
 */
export function stripTagHash(tag: string): string {
  return tag.trim().replace(/^#+/, "");
}

/**
 * Convenience function for filtering null or undefined values in an array.
 *
 * @param value - The value to check
 * @returns Whether value is null or undefined
 */
export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Convenience function for filtering undefined values in an array.
 *
 * @param value - The value to check
 * @returns Whether value is undefined
 */
export function notUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Returns the given file name with the lowest available sequence number
 * appended to it.
 *
 * @param folderPath - The folder to check against
 * @param name - The name of the note
 * @returns A unique file name prefixed with `name`
 */
export function nextUniqueFileName(folderPath: string, name: string): string {
  return uniquify(name, (name) => {
    return (
      get(app).vault.getAbstractFileByPath(
        normalizePath(folderPath + "/" + name + ".md")
      ) instanceof TFile
    );
  });
}

/**
 * Returns the given project name with the lowest available sequence number
 * appended to it.
 *
 * @param projects - The existing projects to check against
 * @param name - The ideal name for a new project
 * @returns A unique project name prefixed with `name`
 */

export function nextUniqueProjectName(
  projects: ProjectDefinition[],
  name: string
) {
  return uniquify(name, (candidate) => {
    return !!projects.find((project) => project.name === candidate);
  });
}

/**
 * Returns the given view name with the lowest available sequence number
 * appended to it.
 *
 * @param views - The existing views to check against
 * @param name - The ideal name for a new view
 * @returns A unique view name prefixed with `name`
 */
export function nextUniqueViewName(views: ViewDefinition[], name: string) {
  return uniquify(name, (candidate) => {
    return !!views.find((view) => view.name === candidate);
  });
}

/**
 * Returns the given field name with the lowest available sequence number
 * appended to it.
 *
 * @param fields - The existing fields to check against
 * @param name - The ideal name for a new field
 * @returns A unique field name prefixed with `name`
 */
export function nextUniqueFieldName(fields: DataField[], name: string) {
  return uniquify(name, (candidate) => {
    return !!fields.find((field) => field.name === candidate);
  });
}

/**
 * Appends a sequence number to a string, where the number is the lowest
 * available according to a callback function.
 *
 * @param name - The preferred name
 * @param exists - A predicate for whether a candidate string is already taken
 * @returns A unique string
 */
function uniquify(name: string, exists: (name: string) => boolean): string {
  if (!exists(name)) {
    return name;
  }

  let num = 1;
  while (exists(name + " " + num)) {
    num++;
  }

  return name + " " + num;
}

/**
 * Returns the name of a note from a path.
 *
 * For example, Daily/2001-01-01.md returns 2001-01-01.
 *
 * @param path - The path to extract name from
 * @returns The name of the note
 */
export function getNameFromPath(path: string): string {
  const start = path.lastIndexOf("/") + 1;
  const end = path.lastIndexOf(".");

  return path.substring(start, end);
}

export type Context<T> = Readonly<{
  get: () => T;
  set: (value: T) => void;
}>;

export function makeContext<T>(): Context<T> {
  const key = Symbol();
  return {
    get: () => getContext(key),
    set: (value: T) => setContext(key, value),
  };
}

/**
 * Frontmatter values a new note takes from the view's filter, so it shows in
 * the view it was created from. Only conditions that name ONE value map to a
 * value: `is` (text), `eq` (number), checked / not checked. Pass the
 * conditions from `prefillConditions`, which leaves out an «or».
 *
 * w4-p03 (acceptance 26.10, N14): a number and a checkbox are written too,
 * as a number and a boolean, not only text equality.
 *
 * @param conditions - Enabled filter conditions from the view
 * @param excludeField - Optional field name to exclude (e.g., Board groupBy field)
 * @returns Record of field→value pairs for note creation
 */
export function getFilterValuesFromConditions(
  conditions: FilterCondition[],
  excludeField?: string
): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  for (const c of conditions) {
    if (c.field === excludeField) continue;
    const n = c.operator === "eq" ? toNumber(c.value) : null;
    if (c.operator === "is" && c.value !== undefined) {
      values[c.field] = c.value;
    } else if (n !== null) {
      values[c.field] = n;
    } else if (c.operator === "is-checked") {
      values[c.field] = true;
    } else if (c.operator === "is-not-checked") {
      values[c.field] = false;
    }
  }
  return values;
}

/**
 * w4-p03 (N14) — the enabled conditions every record of the view must meet:
 * those of an «and», nested groups included. An «or» of two or more parts
 * names no single value to write, so it gives none.
 */
export function prefillConditions(filter: FilterDefinition | undefined): FilterCondition[] {
  if (!filter) return [];
  const own = filter.conditions.filter((c) => c.enabled);
  const groups = filter.groups ?? [];
  if (filter.conjunction === "or" && own.length + groups.length > 1) return [];
  return [...own, ...groups.flatMap(prefillConditions)];
}
