/**
 * comboOptions — the option list a ComboField (and any listbox) works on.
 *
 * Filtering and the active-option arithmetic are plain functions so the same
 * rules serve the combo popup, `PopoverList` and the relation picker, and so
 * they are testable without a DOM.
 */

import { createSuggestionIndex, searchSuggestions } from "src/lib/suggestions/suggestionSearch";
import type { SearchText } from "src/lib/suggestions/searchText";

/** One selectable option. `id` is stable and names the option in the DOM. */
export interface ComboOption extends SearchText {
  id: string;
  label: string;
  icon?: string;
}

/** Ranked first page from this caller's immutable, permitted option revision. */
export function filterOptions<T extends SearchText>(options: readonly T[], query: string): T[] {
  return searchSuggestions(options, query);
}

/** Call update on reactive source changes; typing uses the same projections. */
export function createOptionSearch<T extends SearchText & { id?: string }>() {
  const index = createSuggestionIndex<T>();
  return {
    update(options: readonly T[]): (query: string) => T[] {
      index.replace(options, (option, position) => option.id === undefined ? `position:${position}` : `id:${option.id}`);
      return query => index.search(query).items;
    },
  };
}

/**
 * The next active index after an arrow key, wrapping at both ends. From no
 * active option (-1) ArrowDown lands on the first and ArrowUp on the last.
 * Returns -1 for an empty list.
 */
export function stepActive(current: number, delta: 1 | -1, length: number): number {
  if (length <= 0) return -1;
  if (current < 0) return delta === 1 ? 0 : length - 1;
  return (current + delta + length) % length;
}

/**
 * The active index kept inside a list that may have shrunk or not loaded yet:
 * the first option for a negative index, the last for one past the end, -1 for
 * an empty list.
 */
export function clampActive(active: number, length: number): number {
  return length === 0 ? -1 : Math.min(Math.max(active, 0), length - 1);
}

/**
 * Svelte action: keep the active row of a scrolling list in view. Pass whether
 * the row is the active one; `scrollIntoView` is missing in some test hosts.
 */
export function reveal(node: HTMLElement, active: boolean): { update(next: boolean): void } {
  const run = (on: boolean): void => {
    if (on && typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "nearest" });
  };
  run(active);
  return { update: run };
}

/**
 * Options for a list of plain names (field names, aggregation codes): the name
 * is both id and label, and a repeated name is offered once.
 */
export function namesToOptions(names: readonly string[]): ComboOption[] {
  return [...new Set(names)].map((name) => ({ id: name, label: name }));
}

/**
 * Whether an Escape belongs to a combobox that is open: a host that closes on
 * Escape in the capture phase (the settings panel) must leave this one to the
 * field, whose first Escape only closes its list.
 */
export function comboOwnsEscape(target: EventTarget | null): boolean {
  const el = target as Element | null;
  if (!el || typeof el.closest !== "function") return false;
  // An open list, or typed text not yet committed: the field's Escape closes
  // the list or restores the text first; a container closes on the next one.
  return el.closest('[role="combobox"][aria-expanded="true"], [role="combobox"][data-ppp-dirty="true"]') !== null;
}

/** The DOM id of an option:the list's id and the option's own, made safe for an id attribute. */
export function optionDomId(listId: string, optionId: string): string {
  const encoded = Array.from(optionId, char => char.codePointAt(0)!.toString(16)).join("-");
  return `${listId}-opt-${encoded}`;
}
