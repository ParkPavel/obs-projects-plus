/**
 * comboOptions — the option list a ComboField (and any listbox) works on.
 *
 * Filtering and the active-option arithmetic are plain functions so the same
 * rules serve the combo popup, `PopoverList` and the relation picker, and so
 * they are testable without a DOM.
 */

/** One selectable option. `id` is stable and names the option in the DOM. */
export interface ComboOption {
  id: string;
  label: string;
  icon?: string;
}

/** Options whose label contains the query, case-insensitively; all of them for an empty query. */
export function filterOptions<T extends { label: string }>(options: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [...options];
  return options.filter((o) => o.label.toLowerCase().includes(q));
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

/** The DOM id of an option: the list's id and the option's own, made safe for an id attribute. */
export function optionDomId(listId: string, optionId: string): string {
  return `${listId}-opt-${optionId.replace(/[^\w-]/g, (c) => `_${c.charCodeAt(0).toString(16)}_`)}`;
}
