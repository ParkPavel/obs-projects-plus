// tabLinkMenu.ts — i3-final (B3): the «Link to view» entries of a tab's menu.
//
// Built here and handed to ViewTabBar as extra entries, so the tab bar stays a
// tab bar (and inside its line budget) and the linking rules stay in one place.

import type { ContextMenuEntry } from "src/lib/contextMenu";
import type { ViewDefinition } from "src/settings/base/settings";
import type { ViewTab } from "../../types";
import { isLinkableTab, linkableViews } from "./linkedView";

type Translate = (key: string, fallback: string) => string;

export interface TabLinkActions {
  readonly link: (tab: ViewTab, view: ViewDefinition) => void;
  readonly unlink: (tab: ViewTab) => void;
}

/**
 * «Link to view…» with the source project's views of the tab's type as a
 * submenu (the followed one checked), and «Unlink and keep settings» while
 * the tab follows one. Nothing for a tab type that cannot follow a view.
 */
export function tabLinkMenu(
  tab: ViewTab,
  views: readonly ViewDefinition[],
  t: Translate,
  actions: TabLinkActions
): ContextMenuEntry[] {
  if (!isLinkableTab(tab)) return [];
  const candidates = linkableViews(views, tab);
  const submenu: ContextMenuEntry[] = candidates.length > 0
    ? candidates.map((view) => ({
        title: view.name,
        checked: view.id === tab.linkedViewId,
        onClick: () => { if (view.id !== tab.linkedViewId) actions.link(tab, view); },
      }))
    : [{ title: t("views.dashboard.database-call.link-view-none", "No views of this type in the project"), disabled: true, onClick: () => undefined }];
  const entries: ContextMenuEntry[] = [
    { title: t("views.dashboard.database-call.link-view", "Link to view"), icon: "link", onClick: () => undefined, submenu },
  ];
  if (tab.linkedViewId) {
    entries.push({
      title: t("views.dashboard.database-call.unlink-view", "Unlink and keep settings"),
      icon: "unlink",
      onClick: () => actions.unlink(tab),
    });
  }
  return entries;
}
