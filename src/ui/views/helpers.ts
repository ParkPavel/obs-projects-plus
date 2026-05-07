import { makeContext } from "src/lib/helpers";
import { DataFieldType, type DataField } from "../../lib/dataframe/dataframe";
import type { ViewProps } from "../app/useView";
import { TFile, type App, type Menu } from "obsidian";

import { i18n } from "src/lib/stores/i18n";
import { app } from "src/lib/stores/obsidian";
import { get } from "svelte/store";
import { VIEW_TYPE_PROJECTS } from "src/view";
import { openContextMenu, type ContextMenuEntry } from "src/lib/contextMenu";

export function fieldIcon(field: DataField): string {
  switch (field.type) {
    case DataFieldType.String:
      if (field.repeated) {
        switch (field.name) {
          case "tags":
            return "tags";
          case "aliases":
            return "forward";
        }
        return "list";
      }
      return "text";
    case DataFieldType.Number:
      return "binary";
    case DataFieldType.Boolean:
      return "check-square";
    case DataFieldType.Date:
      return field.typeConfig?.time ? "clock" : "calendar";
    // Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.5a — icons for the
    // five Stage A field types that previously fell through to "file-question".
    case DataFieldType.Select:
      return "list-checks";
    case DataFieldType.Status:
      return "circle-dot";
    case DataFieldType.Formula:
      return "function-square";
    case DataFieldType.Relation:
      return "link";
    case DataFieldType.Rollup:
      return "sigma";
  }
  return "file-question";
}

export function fieldDisplayText(field: DataField): string {
  switch (field.type) {
    case DataFieldType.String:
      if (field.repeated) {
        switch (field.name) {
          case "tags":
            return get(i18n).t("data-types.tags");
          case "aliases":
            return get(i18n).t("data-types.aliases");
        }
        return get(i18n).t("data-types.list");
      }
      return get(i18n).t("data-types.string");
    case DataFieldType.Number:
      return get(i18n).t("data-types.number");
    case DataFieldType.Boolean:
      return get(i18n).t("data-types.boolean");
    case DataFieldType.Date:
      return field.typeConfig?.time
        ? get(i18n).t("data-types.datetime")
        : get(i18n).t("data-types.date");
    case DataFieldType.Select:
      return get(i18n).t("data-types.select");
    case DataFieldType.Status:
      return get(i18n).t("data-types.status");
    case DataFieldType.Formula:
      return get(i18n).t("data-types.formula");
    case DataFieldType.Relation:
      return get(i18n).t("data-types.relation");
    case DataFieldType.Rollup:
      return get(i18n).t("data-types.rollup");
  }
  return get(i18n).t("data-types.unknown");
}

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
 * @param appInstance - The Obsidian App instance
 * @param linkText - The note link text (file path)
 * @param sourcePath - The source file path
 * @param event - The originating touch/mouse event (for positioning)
 * @param onModal - Optional callback for "open in modal" action
 */
export function showMobileNavMenu(
  appInstance: App,
  linkText: string,
  sourcePath: string,
  event: TouchEvent | MouseEvent,
  onModal?: () => void,
): void {
  const t = get(i18n);
  const entries: ContextMenuEntry[] = [];

  if (onModal) {
    entries.push({ title: t.t("common.open-note"), icon: "file-text", onClick: () => onModal!() });
  }
  entries.push({
    title: t.t("common.open-in-tab"), icon: "file-plus",
    onClick: () => void appInstance.workspace.openLinkText(linkText, sourcePath, "tab"),
  });
  entries.push({
    title: t.t("common.open-in-window"), icon: "maximize",
    onClick: () => void appInstance.workspace.openLinkText(linkText, sourcePath, "window"),
  });

  openContextMenu(entries, event);
}
