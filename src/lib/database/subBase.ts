/**
 * R2.3 — Sub-base type model (pure)
 *
 * Per Revision 3 §5.3 a single Database view holds *one or more*
 * sub-bases. Each sub-base is a named slice of the view's data:
 * an additional `FilterDefinition` applied on top of the view's
 * outer filter, optionally inheriting columns from the parent view.
 *
 * Example (user's "Бюджеты ↔ Траты" scenario):
 *   View: "Project ABC"
 *     SubBase #1: "Budgets"  filter: type="budget"
 *     SubBase #2: "Expenses" filter: type="expense"
 *   Two-way relations between Budgets and Expenses are stored as
 *   normal `[[wikilinks]]` in frontmatter; the inverse direction is
 *   derived at runtime via `lib/relations/inverseIndex` (R2.4).
 *
 * This module provides ONLY the type, default factory, and pure
 * helpers. UI wiring (multi-table renderer, sub-base picker) lands
 * in R2.2.
 */

import type { FilterDefinition, SortDefinition } from "src/settings/base/settings";

/** Unique identifier for a sub-base within a Database view. */
export type SubBaseId = string;

export interface SubBaseDefinition {
  /** Stable id; assigned at creation, never reused after deletion. */
  readonly id: SubBaseId;
  /** Human-readable label, displayed in tabs / multi-table headers. */
  readonly name: string;
  /**
   * Filter applied AFTER the parent view's filter. The parent view's
   * filter is the "view stream"; the sub-base narrows that stream.
   * Empty `conditions` array means "include everything from the view
   * stream".
   */
  readonly filter: FilterDefinition;
  /**
   * Sort applied to this sub-base only. When omitted, the sub-base
   * inherits the parent view's sort.
   */
  readonly sort?: SortDefinition;
  /**
   * When true, the sub-base reuses the parent view's column set.
   * When false, it carries its own column subset (stored separately
   * in the view config). Defaults to true at creation.
   */
  readonly inheritColumns: boolean;
  /**
   * Optional per-sub-base column ordering / hiding. Only consulted
   * when `inheritColumns` is false.
   */
  readonly columnIds?: readonly string[];
}

export const EMPTY_FILTER: FilterDefinition = {
  conjunction: "and",
  conditions: [],
};

/**
 * Construct a fresh sub-base. Caller provides the id; we don't import
 * `crypto` here to keep the module pure for tests in jsdom.
 */
export function createSubBase(
  id: SubBaseId,
  name: string,
  overrides: Partial<Omit<SubBaseDefinition, "id">> = {},
): SubBaseDefinition {
  return {
    id,
    name,
    filter: overrides.filter ?? EMPTY_FILTER,
    inheritColumns: overrides.inheritColumns ?? true,
    ...(overrides.sort !== undefined ? { sort: overrides.sort } : {}),
    ...(overrides.columnIds !== undefined ? { columnIds: overrides.columnIds } : {}),
  };
}

/**
 * Validate the structural shape of a sub-base. Returns the input
 * unchanged on success; throws with a precise message on failure so
 * callers can surface user-facing errors at the settings boundary.
 */
export function validateSubBase(input: unknown): SubBaseDefinition {
  if (!input || typeof input !== "object") {
    throw new Error("SubBase must be an object");
  }
  const sb = input as Record<string, unknown>;
  if (typeof sb["id"] !== "string" || sb["id"].length === 0) {
    throw new Error("SubBase.id must be a non-empty string");
  }
  if (typeof sb["name"] !== "string") {
    throw new Error("SubBase.name must be a string");
  }
  if (!sb["filter"] || typeof sb["filter"] !== "object") {
    throw new Error("SubBase.filter must be a FilterDefinition object");
  }
  const filter = sb["filter"] as Record<string, unknown>;
  if (!Array.isArray(filter["conditions"])) {
    throw new Error("SubBase.filter.conditions must be an array");
  }
  if (typeof sb["inheritColumns"] !== "boolean") {
    throw new Error("SubBase.inheritColumns must be a boolean");
  }
  return sb as unknown as SubBaseDefinition;
}

/**
 * Rename guard — keeps id stable but updates the user-visible label.
 * Trims whitespace; rejects empty string.
 */
export function renameSubBase(
  base: SubBaseDefinition,
  newName: string,
): SubBaseDefinition {
  const trimmed = newName.trim();
  if (trimmed.length === 0) {
    throw new Error("SubBase name cannot be empty");
  }
  return { ...base, name: trimmed };
}

/**
 * Locate a sub-base by id within a list. Returns `null` (not
 * `undefined`) so callers can disambiguate "missing" from
 * "found-but-empty" in TypeScript strict mode.
 */
export function findSubBase(
  bases: readonly SubBaseDefinition[],
  id: SubBaseId,
): SubBaseDefinition | null {
  for (const base of bases) {
    if (base.id === id) return base;
  }
  return null;
}
