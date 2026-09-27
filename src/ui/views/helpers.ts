import { makeContext } from "src/lib/helpers";
import type { DataField } from "../../lib/dataframe/dataframe";
import type { ViewProps } from "../app/useView";
import { TFile, type App, type Menu } from "obsidian";

import { i18n } from "src/lib/stores/i18n";
import { app } from "src/lib/stores/obsidian";
import { get } from "svelte/store";
import { VIEW_TYPE_PROJECTS } from "src/viewType";
import { openContextMenu, type ContextMenuEntry } from "src/lib/contextMenu";
import { openRecord, type OpenRecordTarget } from "src/lib/record/openRecord";

export function fieldToSelectableValue(field: DataField): {
  label: string;
  value: string;
} {
  return {
    label: field.name,
    value: field.name,
  };
}

export const getRecordColorContext = makeContext<ViewProps["getRecordColor"]>();
export const sortRecordsContext = makeContext<ViewProps["sortRecords"]>();

export function menuOnContextMenu(event: MouseEvent, menu: Menu): void {
  const contextMenuFunc = (event: MouseEvent) => {
    window.removeEventListener("contextmenu", contextMenuFunc);
    event.preventDefault();
    event.stopPropagation();
    menu.showAtMouseEvent(event);
  };
  window.addEventListener("contextmenu", contextMenuFunc, false);
}

export function handleHoverLink(event: MouseEvent, sourcePath: string) {
  const targetEl = event.target as HTMLDivElement;
  const anchor =
    targetEl.tagName === "A" ? targetEl : targetEl.querySelector("a");
  if (!anchor || !anchor.hasClass("internal-link")) return;

  const href = anchor.getAttr("href");
  const file =
    href && get(app).metadataCache.getFirstLinkpathDest(href, sourcePath);

  if (file instanceof TFile) {
    get(app).workspace.trigger("hover-link", {
      event,
      source: VIEW_TYPE_PROJECTS,
      hoverParent: anchor,
      targetEl,
      linktext: file.name,
      sourcePath: file.path,
    });
  }
}

/**
 * v3.0.10: Show a mobile-friendly navigation menu for opening notes.
 * Used by Board, Table, Gallery when a long-press occurs on a record/link.
 *
 * #168 step (a): the old `(linkText, sourcePath)` pair permitted any link, so a
 * line-local reading could not tell whether this helper opened a record or an
 * arbitrary note. It takes an `OpenRecordTarget` now, which makes every caller
 * state that it is opening a record — the classification lives at the call site
 * instead of being guessed at afterwards.
 *
 * @param appInstance - The Obsidian App instance
 * @param target - The record to open
 * @param event - The originating touch/mouse event (for positioning)
 * @param onModal - Optional callback for "open in modal" action
 */
export function showMobileNavMenu(
  appInstance: App,
  target: OpenRecordTarget,
  event: TouchEvent | MouseEvent,
  onModal?: () => void,
): void {
  const t = get(i18n);
  const entries: ContextMenuEntry[] = [];

  if (onModal) {
    entries.push({ title: t.t("common.open-note"), icon: "file-text", onClick: () => onModal() });
  }
  entries.push({
    title: t.t("common.open-in-tab"), icon: "file-plus",
    onClick: () => void openRecord(target, "tab", { app: appInstance }),
  });
  entries.push({
    title: t.t("common.open-in-window"), icon: "maximize",
    onClick: () => void openRecord(target, "window", { app: appInstance }),
  });

  openContextMenu(entries, event);
}
