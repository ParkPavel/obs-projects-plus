// dashboardWidgetUndo.ts — the removeWidget() undo affordance.
//
// One click on the header trash icon or the widget menu used to delete a
// block with no way back. This builds the Notice DOM (message + a clickable
// "Undo" control) so `dashboardWidgets.ts` stays about widget CRUD, not
// notice plumbing — a sibling module rather than growing that file.

import { Notice } from "obsidian";
import type { DatabaseViewConfig, WidgetDefinition } from "./types";

/** Long enough to read and act on, short enough not to pile up (~8s). */
const REMOVED_NOTICE_DURATION_MS = 8000;

type Translate = (key: string, options: { defaultValue: string; [k: string]: unknown }) => string;

/**
 * Shows the "widget removed" notice with an Undo control. Undo re-reads the
 * config at click time — not the snapshot captured at removal — so a widget
 * list that changed in between (another add/remove) doesn't get clobbered;
 * the restored widget is inserted at `min(index, length)` of whatever the
 * list looks like then.
 */
export function notifyWidgetRemoved(
  t: Translate,
  removed: WidgetDefinition,
  index: number,
  getConfig: () => DatabaseViewConfig | undefined,
  saveConfig: (cfg: DatabaseViewConfig) => void
): void {
  const message = document.createDocumentFragment();

  const text = document.createElement("span");
  text.textContent = t("views.dashboard.widget.removed", {
    title: removed.title,
    defaultValue: 'Block "{{title}}" removed',
  });
  message.appendChild(text);
  message.appendChild(document.createTextNode(" "));

  const undo = document.createElement("button");
  undo.textContent = t("views.dashboard.widget.undo", { defaultValue: "Undo" });
  message.appendChild(undo);

  const notice = new Notice(message, REMOVED_NOTICE_DURATION_MS);
  undo.addEventListener("click", () => {
    const config = getConfig();
    // A second click, or a re-add in between, must not duplicate the block.
    if (config && !config.widgets.some((w) => w.id === removed.id)) {
      const widgets = [...config.widgets];
      widgets.splice(Math.min(index, widgets.length), 0, removed);
      saveConfig({ ...config, widgets });
    }
    notice.hide();
  });
}
