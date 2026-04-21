/**
 * Accessibility utilities for Database View widgets.
 *
 * Provides ARIA attribute helpers and keyboard navigation handlers
 * for grid-like widget layouts, lists, and interactive elements.
 */

// ── ARIA helpers ────────────────────────────────────────

export interface AriaGridProps {
  role: "grid";
  "aria-rowcount": number;
  "aria-colcount": number;
  "aria-label": string;
}

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

export interface AriaGridCellProps {
  role: "gridcell";
  "aria-rowindex": number;
  "aria-colindex": number;
  tabindex: number;
}

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

export interface AriaWidgetProps {
  role: "region";
  "aria-label": string;
  tabindex: number;
}

export function ariaWidget(label: string): AriaWidgetProps {
  return {
    role: "region",
    "aria-label": label,
    tabindex: 0,
  };
}

// ── Keyboard navigation ─────────────────────────────────

export interface GridPosition {
  row: number;
  col: number;
}

/**
 * Handle arrow-key navigation within a grid.
 * Returns new position or null if navigation is out of bounds.
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
 * Handle list navigation (up/down only).
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
 * Focus a cell element within a grid container.
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
 * Get live region announcement text for screen readers.
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
