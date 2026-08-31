/**
 * accessibility.ts — ARIA prop builders and keyboard navigation for widgets.
 *
 * The builders exist so that the ARIA contract of a grid is written once and
 * spread onto an element, instead of each widget hand-rolling `role` /
 * `aria-*` attributes that then drift apart. Every function is pure and
 * DOM-free except `focusGridCell` and `announceChange`, which is what makes
 * the navigation logic testable without a renderer.
 *
 * **Know this before extending it: most of this module has no caller.** Only
 * `ariaWidget` is used in the product (`WidgetShell.svelte`, which spreads it
 * onto every widget frame). `ariaGrid`, `ariaGridCell`, `navigateGrid`,
 * `navigateList`, `focusGridCell` and `announceChange` are reached only from
 * `ui/views/Dashboard/__tests__/accessibility.test.ts`. Calendar's `Day.svelte`
 * has a local function that is also called `navigateGrid`; it is a different
 * implementation and does not import this one. So the grid half is a designed
 * and tested surface waiting for a consumer, not a description of how the
 * dashboard currently behaves - do not read a passing suite here as evidence
 * that a widget is keyboard-navigable.
 *
 * Two couplings a maintainer must not break:
 *
 * - **`ariaGridCell` and `focusGridCell` share one addressing scheme.** The
 *   first writes `aria-rowindex` / `aria-colindex`; the second finds the cell
 *   by a selector built from exactly those attributes. Renaming or reindexing
 *   in one place silently makes the other find nothing - `focus()` is called
 *   through an optional chain, so the failure is a no-op, not an error.
 * - **Roving tabindex.** `ariaGridCell` gives the active cell `tabindex 0` and
 *   every other cell `-1`, so Tab enters the grid once and the arrow keys move
 *   within it. Exactly one cell per grid may be passed `active: true`; marking
 *   several puts every one of them back in the tab order and defeats the
 *   pattern.
 */

// ── ARIA helpers ────────────────────────────────────────

/** Attributes for the grid container itself; spread onto the element. */
export interface AriaGridProps {
  role: "grid";
  "aria-rowcount": number;
  "aria-colcount": number;
  "aria-label": string;
}

/**
 * Container attributes for a grid of `rowCount` x `colCount`, labelled for
 * screen readers. The counts are the FULL dimensions, which is the point of
 * `aria-rowcount`: with virtualised rendering they stay the totals, not the
 * number of elements currently in the DOM.
 */
export function ariaGrid(
  label: string,
  rowCount: number,
  colCount: number
): AriaGridProps {
  return {
    role: "grid",
    "aria-rowcount": rowCount,
    "aria-colcount": colCount,
    "aria-label": label,
  };
}

/**
 * Attributes for one cell. `aria-rowindex` / `aria-colindex` double as the
 * address `focusGridCell` looks a cell up by.
 */
export interface AriaGridCellProps {
  role: "gridcell";
  "aria-rowindex": number;
  "aria-colindex": number;
  tabindex: number;
}

/**
 * Cell attributes, with the roving tabindex: `active` gives this cell
 * `tabindex 0`, everything else gets `-1`. Exactly one cell in a grid may be
 * active - see the module header.
 */
export function ariaGridCell(
  rowIndex: number,
  colIndex: number,
  active: boolean
): AriaGridCellProps {
  return {
    role: "gridcell",
    "aria-rowindex": rowIndex,
    "aria-colindex": colIndex,
    tabindex: active ? 0 : -1,
  };
}

/** Attributes for a widget frame: a labelled, focusable landmark region. */
export interface AriaWidgetProps {
  role: "region";
  "aria-label": string;
  tabindex: number;
}

/**
 * The one builder with a production caller: `WidgetShell.svelte` spreads this
 * onto every widget frame. `role="region"` makes each widget a landmark a
 * screen reader can jump between, and `tabindex 0` makes the frame itself
 * reachable - so the label must be the widget's user-visible title, or the
 * landmark list becomes a row of identical entries.
 */
export function ariaWidget(label: string): AriaWidgetProps {
  return {
    role: "region",
    "aria-label": label,
    tabindex: 0,
  };
}

// ── Keyboard navigation ─────────────────────────────────

/** A cell address in the same row/column space `navigateGrid` moves through. */
export interface GridPosition {
  row: number;
  col: number;
}

/**
 * Arrow-key navigation within a grid. Returns the new position, or `null` for
 * both "this key means nothing here" and "that move leaves the grid".
 *
 * `null` rather than a clamped position is deliberate: the caller keeps the
 * current cell and, because the key was not consumed, can let the event bubble
 * so the surrounding view still handles it. Home and End move within the
 * current row only - they do not jump to the first or last cell of the grid.
 */
export function navigateGrid(
  current: GridPosition,
  key: string,
  maxRow: number,
  maxCol: number
): GridPosition | null {
  let { row, col } = current;

  switch (key) {
    case "ArrowUp":
      row--;
      break;
    case "ArrowDown":
      row++;
      break;
    case "ArrowLeft":
      col--;
      break;
    case "ArrowRight":
      col++;
      break;
    case "Home":
      col = 0;
      break;
    case "End":
      col = maxCol - 1;
      break;
    default:
      return null;
  }

  if (row < 0 || row >= maxRow || col < 0 || col >= maxCol) {
    return null;
  }

  return { row, col };
}

/**
 * Up/down navigation for a flat list. Returns the new index, or `null` when
 * the move would leave the list - the same "not consumed" signal
 * `navigateGrid` uses. Unlike the arrows, Home and End always return an index,
 * so they are consumed even when the list is already at that end.
 */
export function navigateList(
  currentIndex: number,
  key: string,
  itemCount: number
): number | null {
  switch (key) {
    case "ArrowUp":
      return currentIndex > 0 ? currentIndex - 1 : null;
    case "ArrowDown":
      return currentIndex < itemCount - 1 ? currentIndex + 1 : null;
    case "Home":
      return 0;
    case "End":
      return itemCount - 1;
    default:
      return null;
  }
}

/**
 * Move focus to a cell, addressed by the `aria-rowindex` / `aria-colindex`
 * that `ariaGridCell` wrote. If no cell matches, this is a silent no-op: the
 * lookup can fail and the optional call swallows it, so a mismatch between the
 * two functions produces dead arrow keys rather than an error.
 */
export function focusGridCell(
  container: HTMLElement,
  row: number,
  col: number
): void {
  const selector = `[aria-rowindex="${row}"][aria-colindex="${col}"]`;
  const cell = container.querySelector<HTMLElement>(selector);
  cell?.focus();
}

/**
 * Announce `message` to screen readers. (It writes; it does not return the
 * text - the previous comment said "get", which it never did.)
 *
 * There is one shared `#ppp-sr-announce` live region per document, created on
 * first use and reused after: `aria-live="polite"` announces on text change,
 * so a second region would compete with the first and a fresh region per call
 * would often be announced before it is even in the tree. The region is
 * visually hidden by inline styles rather than a class, so it works even where
 * the plugin stylesheet has not loaded.
 *
 * `activeDocument` is Obsidian's global for the document of the focused
 * window. Using plain `document` here would put the region in the main window
 * while the user is in a popped-out leaf, where it announces to nobody.
 */
export function announceChange(message: string): void {
  const doc = activeDocument ?? document;
  let region = doc.getElementById("ppp-sr-announce");
  if (!region) {
    region = doc.createElement("div");
    region.id = "ppp-sr-announce";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.className = "sr-only";
    region.style.cssText =
      "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";
    doc.body.appendChild(region);
  }
  region.textContent = message;
}
