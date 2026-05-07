import { Menu, type App } from "obsidian";

/**
 * R0.2 — Portal-anchored Context Menu helper
 *
 * Thin typed wrapper around Obsidian's native `Menu` so callers describe a
 * menu declaratively (array of items) and the helper handles anchoring,
 * sectioning, submenus, danger styling, and i18n-friendly callbacks.
 *
 * Why this exists (Revision 3 §3.1): the legacy `DataGrid` widgets each
 * built menus by hand, with anchoring derived from raw `MouseEvent`
 * coordinates that drift when the host scroll-container moves under the
 * pointer. The helper unifies the construction and anchoring contract so
 * R2 (Database canvas reborn) can reuse it without re-deriving anchor logic.
 *
 * The helper itself does NOT create DOM portals manually — Obsidian's `Menu`
 * already attaches to `document.body`, which is the correct portal layer.
 * What we add: a single contract for anchor sources (mouse/touch/element)
 * with deterministic positioning that survives scroll, resize, and rotation.
 *
 * Subscribers must keep individual items small and side-effect-free at
 * construction time; effects belong inside `onClick`.
 */

export type ContextMenuAnchor =
  | MouseEvent
  | TouchEvent
  | { x: number; y: number }
  | HTMLElement
  | null;

export interface ContextMenuItem {
  /** Already-translated label. */
  title: string;
  /** Obsidian icon id (e.g. "trash", "link"). */
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  /** Apply Obsidian's `mod-warning` styling. */
  danger?: boolean;
  /** Group separator above this item. */
  section?: string;
  /** Adds a chevron submenu (Obsidian-native). */
  submenu?: ContextMenuEntry[];
  /** Optional checkbox-style state, rendered via icon swap. */
  checked?: boolean;
}

/** A bare separator. Place between items to insert a divider. */
export interface ContextMenuSeparator {
  separator: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

/** Type guard — discriminates separators from real items. */
function isSeparator(entry: ContextMenuEntry): entry is ContextMenuSeparator {
  return (entry as ContextMenuSeparator).separator === true;
}

function fillItem(
  obsidianItem: {
    setTitle: (title: string) => unknown;
    setIcon: (icon: string) => unknown;
    setDisabled?: (disabled: boolean) => unknown;
    setSection?: (section: string) => unknown;
    setWarning?: (danger: boolean) => unknown;
    onClick: (cb: () => void) => unknown;
  },
  entry: ContextMenuItem,
): void {
  obsidianItem.setTitle(entry.title);
  if (entry.icon) {
    obsidianItem.setIcon(entry.icon);
  } else if (entry.checked === true) {
    obsidianItem.setIcon("check");
  } else if (entry.checked === false) {
    obsidianItem.setIcon("");
  }
  if (entry.disabled && obsidianItem.setDisabled) {
    obsidianItem.setDisabled(true);
  }
  if (entry.section && obsidianItem.setSection) {
    obsidianItem.setSection(entry.section);
  }
  if (entry.danger && obsidianItem.setWarning) {
    obsidianItem.setWarning(true);
  }
  obsidianItem.onClick(() => {
    if (!entry.disabled) entry.onClick();
  });
}

function appendEntries(menu: Menu, entries: ContextMenuEntry[]): void {
  for (const entry of entries) {
    if (isSeparator(entry)) {
      menu.addSeparator();
      continue;
    }
    if (entry.submenu && entry.submenu.length > 0) {
      // Obsidian's typed surface for `setSubmenu` is patchy across versions;
      // we feature-detect at runtime to stay forward-compatible.
      menu.addItem((mi) => {
        fillItem(mi as never, entry);
        const maybeSub = (mi as unknown as {
          setSubmenu?: () => Menu;
        }).setSubmenu;
        if (typeof maybeSub === "function") {
          const sub = maybeSub.call(mi);
          appendEntries(sub, entry.submenu ?? []);
        }
      });
    } else {
      menu.addItem((mi) => fillItem(mi as never, entry));
    }
  }
}

/**
 * Open a portal-anchored context menu.
 *
 * Anchor resolution rules (in order):
 * 1. `MouseEvent` → `showAtMouseEvent`
 * 2. `TouchEvent` → first `changedTouches` then `touches`, fallback to
 *    `(window.innerWidth/2, window.innerHeight/2)`
 * 3. `HTMLElement` → bottom-left of `getBoundingClientRect`
 * 4. `{ x, y }` → as-is
 * 5. `null`/missing → window center
 */
export function openContextMenu(
  entries: ContextMenuEntry[],
  anchor: ContextMenuAnchor,
  _app?: App,
): Menu {
  const menu = new Menu();
  appendEntries(menu, entries);

  if (anchor instanceof MouseEvent) {
    menu.showAtMouseEvent(anchor);
    return menu;
  }
  if (typeof TouchEvent !== "undefined" && anchor instanceof TouchEvent) {
    const touch = anchor.changedTouches?.[0] ?? anchor.touches?.[0];
    if (touch) {
      menu.showAtPosition({ x: touch.clientX, y: touch.clientY });
      return menu;
    }
  }
  if (anchor instanceof HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom });
    return menu;
  }
  if (anchor && typeof (anchor as { x?: number }).x === "number") {
    const point = anchor as { x: number; y: number };
    menu.showAtPosition({ x: point.x, y: point.y });
    return menu;
  }
  menu.showAtPosition({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
  });
  return menu;
}

/**
 * Append declarative entries to an already-existing Obsidian `Menu`.
 *
 * R2.1b — used by legacy menu-builders that still construct a native
 * `Menu` directly (`DataGrid.createColumnMenu`) but want to splice in
 * extra Database-specific entries (property-type override, rollup
 * mode picker) without re-implementing submenu/section logic.
 */
export function appendContextMenuEntries(
  menu: Menu,
  entries: ContextMenuEntry[],
): void {
  appendEntries(menu, entries);
}

/**
 * Show a context menu on the NEXT contextmenu event (deferred pattern).
 *
 * Obsidian intercepts right-click and fires its own contextmenu sequence.
 * For cases where the menu must be shown on `contextmenu` rather than on
 * `mousedown`, register the menu once and let the browser's next
 * contextmenu event deliver it.
 *
 * Replaces the legacy `menuOnContextMenu(event, menu)` pattern in
 * src/ui/views/helpers.ts so that `new Menu()` never escapes this file.
 */
export function openContextMenuDeferred(
  entries: ContextMenuEntry[],
  _triggerEvent: MouseEvent,
): void {
  const menu = new Menu();
  appendEntries(menu, entries);
  const handler = (e: MouseEvent) => {
    window.removeEventListener("contextmenu", handler);
    e.preventDefault();
    e.stopPropagation();
    menu.showAtMouseEvent(e);
  };
  window.addEventListener("contextmenu", handler, false);
}
