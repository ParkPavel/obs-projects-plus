// linkedView.ts — i3-final (B3): a database-call tab that follows a project view.
//
// Notion calls it a linked view, Bases embeds `![[File.base#View]]`: the block
// shows a view that lives in the project, and changing that view changes the
// block. A tab carries `linkedViewId`; while the view exists its config, sort
// and filter are the tab's, read live. The block's own filter is already applied
// to the frame upstream, so the view's filter narrows it further — an AND.
//
// Pure on purpose: `DatabaseCallBlock` cannot be mounted in jest for every case
// (a require cycle through BoardView), so the rules live where a test can reach.

import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import { applyFilter } from "src/lib/engine/filterEvaluator";
import { hasFilterEffect } from "src/lib/engine/filterCompose";
import type { FilterCondition, FilterDefinition, SortDefinition, ViewDefinition } from "src/settings/base/settings";
import { sortRecords } from "src/ui/app/viewSort";
import type { ViewTab } from "../../types";

/** The tab types a block can render. Stored tabs of any other type get an empty state. */
export const RENDERABLE_TAB_TYPES: ReadonlyArray<ViewTab["viewType"]> = ["table", "board", "calendar", "gallery"];

/**
 * The tab types that can follow a project view. A table is not among them: the
 * project has no standalone table view any more (tables live in dashboards), so
 * a table tab takes its field layout from the dashboard instead (`fieldLayout.ts`).
 */
const LINKABLE_TAB_TYPES: ReadonlyArray<ViewTab["viewType"]> = ["board", "calendar", "gallery"];

export const isRenderableTab = (tab: Pick<ViewTab, "viewType">): boolean => RENDERABLE_TAB_TYPES.includes(tab.viewType);
export const isLinkableTab = (tab: Pick<ViewTab, "viewType">): boolean => LINKABLE_TAB_TYPES.includes(tab.viewType);

/** The source project's views a tab of this type may follow. */
export function linkableViews(views: readonly ViewDefinition[], tab: Pick<ViewTab, "viewType">): ViewDefinition[] {
  return isLinkableTab(tab) ? views.filter((v) => v.type === tab.viewType) : [];
}

export interface ResolvedTabView {
  readonly config: Record<string, unknown>;
  readonly sort: SortDefinition | undefined;
  readonly filter: FilterDefinition | undefined;
  /** `none` — the tab's own settings; `live` — read from `view`; `missing` — the view is gone, own settings shown. */
  readonly link: "none" | "live" | "missing";
  readonly view: ViewDefinition | undefined;
}

/** What a tab shows: the linked view's settings while it exists, else its own. */
export function resolveTabView(tab: ViewTab, views: readonly ViewDefinition[]): ResolvedTabView {
  const own = { config: tab.config ?? {}, sort: tab.sort, filter: tab.filter };
  if (!tab.linkedViewId) return { ...own, link: "none", view: undefined };
  const view = views.find((v) => v.id === tab.linkedViewId && v.type === tab.viewType);
  if (!view) return { ...own, link: "missing", view: undefined };
  return { config: view.config ?? {}, sort: view.sort, filter: view.filter, link: "live", view };
}

/** Follow `view`. The tab's own config is kept untouched underneath. */
export function linkTab(tab: ViewTab, view: ViewDefinition): ViewTab {
  return { ...tab, linkedViewId: view.id };
}

/**
 * Stop following. The view's config, sort and filter are COPIED into the tab,
 * so what the user was looking at is what stays — nothing is lost by unlinking.
 * A tab whose view is already gone just drops the reference and keeps its own.
 */
export function unlinkTab(tab: ViewTab, views: readonly ViewDefinition[]): ViewTab {
  const { linkedViewId: _link, ...rest } = tab;
  const resolved = resolveTabView(tab, views);
  if (resolved.link !== "live") return rest;
  const { sort: _sort, filter: _filter, ...base } = rest;
  // A deep copy: the tab must not share objects with the settings it left.
  const copy = JSON.parse(JSON.stringify({ config: resolved.config, sort: resolved.sort, filter: resolved.filter })) as
    { config: Record<string, unknown>; sort?: SortDefinition; filter?: FilterDefinition };
  return {
    ...base,
    config: copy.config,
    ...(copy.sort ? { sort: copy.sort } : {}),
    ...(copy.filter ? { filter: copy.filter } : {}),
  };
}

const enabledSort = (sort: SortDefinition | undefined): boolean => (sort?.criteria ?? []).some((c) => c.enabled);

/** Records in the tab's sort order; a copy in their own order when it has none. */
export function sortTabRecords(records: readonly DataRecord[], sort: SortDefinition | undefined): DataRecord[] {
  return sort && enabledSort(sort) ? sortRecords([...records], sort) : [...records];
}

export interface ScopedTabFrame {
  readonly frame: DataFrame;
  readonly hasSort: boolean;
  readonly hasFilter: boolean;
  readonly filterConditions: FilterCondition[];
}

/**
 * The tab's own filter and sort, on top of the frame the block already
 * narrowed. `blockFiltered` says the frame was narrowed upstream (block filter,
 * canvas selection), which a board must know to keep manual order honest.
 */
export function scopeTabFrame(
  frame: DataFrame,
  resolved: Pick<ResolvedTabView, "sort" | "filter"> | undefined,
  blockFiltered: boolean
): ScopedTabFrame {
  const filter = resolved?.filter;
  const filtered = hasFilterEffect(filter) ? applyFilter(frame, filter) : frame;
  const sort = resolved?.sort;
  const sorted = enabledSort(sort) ? { ...filtered, records: sortTabRecords(filtered.records, sort) } : filtered;
  const filterConditions = (filter?.conditions ?? []).filter((c) => c.enabled !== false);
  return {
    frame: sorted,
    hasSort: enabledSort(sort),
    hasFilter: blockFiltered || filterConditions.length > 0 || (filter?.groups?.length ?? 0) > 0,
    filterConditions,
  };
}
