/**
 * S7 — View-local keyboard shortcut action.
 *
 * Attach to a container element with `use:viewShortcuts={handlers}`.
 * Fires when focus is inside the container; each handler receives the
 * original KeyboardEvent so callers can call preventDefault().
 *
 * Shortcut map (Ctrl/Cmd-agnostic, works on Mac and Windows):
 *   Ctrl+N / ⌘N   → new-record
 *   Ctrl+F / ⌘F   → focus-filter
 *   Ctrl+E / ⌘E   → edit-record
 *   Ctrl+Shift+E  → export
 *   Escape         → dismiss (only when no native element captures it)
 *
 * Handlers are optional — pass only the ones the view supports.
 */

export interface ViewShortcutHandlers {
  "new-record"?: (e: KeyboardEvent) => void;
  "focus-filter"?: (e: KeyboardEvent) => void;
  "edit-record"?: (e: KeyboardEvent) => void;
  "export"?: (e: KeyboardEvent) => void;
  "dismiss"?: (e: KeyboardEvent) => void;
}

export function viewShortcuts(
  node: HTMLElement,
  handlers: ViewShortcutHandlers
) {
  let current = handlers;

  function onKeydown(e: KeyboardEvent) {
    const meta = e.ctrlKey || e.metaKey;

    if (meta && !e.shiftKey && e.key.toLowerCase() === "n") {
      current["new-record"]?.(e);
    } else if (meta && !e.shiftKey && e.key.toLowerCase() === "f") {
      current["focus-filter"]?.(e);
    } else if (meta && !e.shiftKey && e.key.toLowerCase() === "e") {
      current["edit-record"]?.(e);
    } else if (meta && e.shiftKey && e.key.toLowerCase() === "e") {
      current["export"]?.(e);
    } else if (e.key === "Escape" && !meta) {
      current["dismiss"]?.(e);
    }
  }

  node.addEventListener("keydown", onKeydown);

  return {
    update(newHandlers: ViewShortcutHandlers) {
      current = newHandlers;
    },
    destroy() {
      node.removeEventListener("keydown", onKeydown);
    },
  };
}
