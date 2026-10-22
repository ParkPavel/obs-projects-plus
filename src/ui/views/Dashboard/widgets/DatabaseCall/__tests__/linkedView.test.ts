/**
 * i3-final (B3) — a database-call tab that follows a project view.
 *
 * The block itself cannot be mounted here for every branch (a require cycle
 * through BoardView), so the rules are pure functions and are proven here:
 * what a linked tab shows, what unlinking leaves behind, how the tab's sort and
 * filter reach the frame, and what the tab menu offers.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { ViewDefinition } from "src/settings/base/settings";
import type { ViewTab } from "../../../types";
import {
  isRenderableTab,
  linkTab,
  linkableViews,
  resolveTabView,
  scopeTabFrame,
  sortTabRecords,
  unlinkTab,
} from "../linkedView";
import { tabLinkMenu } from "../tabLinkMenu";
import type { ContextMenuItem } from "src/lib/contextMenu";

function view(id: string, type: string, config: Record<string, unknown> = {}, extra: Partial<ViewDefinition> = {}): ViewDefinition {
  return {
    id, name: `View ${id}`, type, config,
    filter: { conjunction: "and", conditions: [] },
    colors: { conditions: [] },
    sort: { criteria: [] },
    ...extra,
  };
}

const board = (extra: Partial<ViewTab> = {}): ViewTab => ({ id: "t1", label: "Board", viewType: "board", config: { groupByField: "own" }, ...extra });

const rec = (id: string, values: Record<string, string | number>): DataRecord => ({ id, values }) as DataRecord;
const frame = (records: DataRecord[]): DataFrame => ({
  fields: [{ name: "status", type: DataFieldType.String, repeated: false, identifier: false, derived: false }] as DataFrame["fields"],
  records,
});

const PROJECT_BOARD = view("pb", "board", { groupByField: "status", columnWidth: 300 }, {
  sort: { criteria: [{ field: "rank", order: "desc", enabled: true }] },
  filter: { conjunction: "and", conditions: [{ field: "status", operator: "is", value: "open", enabled: true }] },
});
const VIEWS = [PROJECT_BOARD, view("pc", "calendar"), view("pb2", "board"), view("dash", "dashboard")];

describe("resolveTabView", () => {
  it("an unlinked tab shows its own config, sort and filter", () => {
    const r = resolveTabView(board(), VIEWS);
    expect(r.link).toBe("none");
    expect(r.config).toEqual({ groupByField: "own" });
    expect(r.sort).toBeUndefined();
  });

  it("a linked tab reads the project view live — config, sort and filter", () => {
    const r = resolveTabView(board({ linkedViewId: "pb" }), VIEWS);
    expect(r.link).toBe("live");
    expect(r.config).toBe(PROJECT_BOARD.config);
    expect(r.sort).toBe(PROJECT_BOARD.sort);
    expect(r.filter).toBe(PROJECT_BOARD.filter);
    // live: the next settings object is what the tab shows, nothing is cached
    const edited = { ...PROJECT_BOARD, config: { groupByField: "owner" } };
    expect(resolveTabView(board({ linkedViewId: "pb" }), [edited]).config).toEqual({ groupByField: "owner" });
  });

  it("a deleted view falls back to the tab's own settings and says so", () => {
    const r = resolveTabView(board({ linkedViewId: "gone" }), VIEWS);
    expect(r.link).toBe("missing");
    expect(r.config).toEqual({ groupByField: "own" });
  });

  it("a view of another type is not followed", () => {
    expect(resolveTabView(board({ linkedViewId: "pc" }), VIEWS).link).toBe("missing");
  });
});

describe("link and unlink", () => {
  it("linking keeps the tab's own config underneath", () => {
    const linked = linkTab(board(), PROJECT_BOARD);
    expect(linked.linkedViewId).toBe("pb");
    expect(linked.config).toEqual({ groupByField: "own" });
  });

  it("unlinking copies the view's config, sort and filter into the tab — nothing is lost", () => {
    const tab = unlinkTab(board({ linkedViewId: "pb" }), VIEWS);
    expect(tab.linkedViewId).toBeUndefined();
    expect("linkedViewId" in tab).toBe(false);
    expect(tab.config).toEqual(PROJECT_BOARD.config);
    expect(tab.config).not.toBe(PROJECT_BOARD.config);
    expect(tab.sort).toEqual(PROJECT_BOARD.sort);
    expect(tab.filter).toEqual(PROJECT_BOARD.filter);
    expect(resolveTabView(tab, []).config).toEqual({ groupByField: "status", columnWidth: 300 });
  });

  it("unlinking a tab whose view is gone just drops the reference", () => {
    const tab = unlinkTab(board({ linkedViewId: "gone" }), VIEWS);
    expect(tab).toEqual(board());
  });
});

describe("scopeTabFrame — the embedded board gets sort and filter", () => {
  const records = [rec("a", { status: "open", rank: 1 }), rec("b", { status: "done", rank: 5 }), rec("c", { status: "open", rank: 3 })];

  it("applies the view's filter (AND under the block filter) and sort", () => {
    const scoped = scopeTabFrame(frame(records), resolveTabView(board({ linkedViewId: "pb" }), VIEWS), false);
    expect(scoped.frame.records.map((r) => r.id)).toEqual(["c", "a"]);
    expect(scoped.hasSort).toBe(true);
    expect(scoped.hasFilter).toBe(true);
    expect(scoped.filterConditions).toHaveLength(1);
  });

  it("no sort and no filter leaves the frame as it is and the board in manual order", () => {
    const f = frame(records);
    const scoped = scopeTabFrame(f, resolveTabView(board(), VIEWS), false);
    expect(scoped.frame).toBe(f);
    expect(scoped.hasSort).toBe(false);
    expect(scoped.hasFilter).toBe(false);
  });

  it("a block filtered upstream still tells the board a filter is active", () => {
    expect(scopeTabFrame(frame(records), undefined, true).hasFilter).toBe(true);
  });

  it("disabled sort criteria do not sort", () => {
    const sort = { criteria: [{ field: "rank", order: "desc" as const, enabled: false }] };
    expect(sortTabRecords(records, sort).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(sortTabRecords(records, { criteria: [{ field: "rank", order: "desc", enabled: true }] }).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});

describe("tab types", () => {
  it("only table, board, calendar and gallery render; the rest get an empty state", () => {
    for (const t of ["table", "board", "calendar", "gallery"] as const) expect(isRenderableTab({ viewType: t })).toBe(true);
    for (const t of ["list", "timeline", "chart", "stats"] as const) expect(isRenderableTab({ viewType: t })).toBe(false);
  });

  it("only views of the tab's own type are offered, and a table follows none", () => {
    expect(linkableViews(VIEWS, { viewType: "board" }).map((v) => v.id)).toEqual(["pb", "pb2"]);
    expect(linkableViews(VIEWS, { viewType: "table" })).toEqual([]);
  });

  it("no picker offers a type the block cannot render", () => {
    const bar = readFileSync(resolve(__dirname, "../../ViewTabBar.svelte"), "utf8");
    const creatable = bar.slice(bar.indexOf("const CREATABLE"), bar.indexOf("];", bar.indexOf("const CREATABLE")));
    expect(creatable).not.toMatch(/type: "(list|timeline|chart|stats)"/);
    const block = readFileSync(resolve(__dirname, "../DatabaseCallBlock.svelte"), "utf8");
    expect(block).not.toMatch(/not yet implemented/);
    expect(block).toMatch(/!isRenderableTab\(activeTab\)/);
    // the embedded board no longer has sort and filter switched off
    expect(block).not.toMatch(/hasSort=\{false\}/);
    expect(block).toMatch(/hasSort=\{tabScope\.hasSort\}/);
  });
});

describe("tabLinkMenu", () => {
  const t = (_key: string, fallback: string) => fallback;
  const items = (tab: ViewTab, views: ViewDefinition[], calls: string[] = []) =>
    tabLinkMenu(tab, views, t, {
      link: (_tab, v) => calls.push(`link:${v.id}`),
      unlink: () => calls.push("unlink"),
    }) as ContextMenuItem[];

  it("offers the source project's views of the same type, the followed one checked", () => {
    const calls: string[] = [];
    const [link] = items(board({ linkedViewId: "pb" }), VIEWS, calls);
    expect(link?.title).toBe("Link to view");
    const sub = link?.submenu as ContextMenuItem[];
    expect(sub.map((s) => [s.title, s.checked])).toEqual([["View pb", true], ["View pb2", false]]);
    sub[1]?.onClick();
    sub[0]?.onClick(); // already followed: no write
    expect(calls).toEqual(["link:pb2"]);
  });

  it("offers unlinking only while linked", () => {
    expect(items(board(), VIEWS).map((i) => i.title)).toEqual(["Link to view"]);
    const calls: string[] = [];
    const entries = items(board({ linkedViewId: "pb" }), VIEWS, calls);
    expect(entries.map((i) => i.title)).toEqual(["Link to view", "Unlink and keep settings"]);
    entries[1]?.onClick();
    expect(calls).toEqual(["unlink"]);
  });

  it("says so when the project has no view of that type, and offers nothing for a table", () => {
    const [link] = items(board(), [view("pc", "calendar")]);
    expect((link?.submenu as ContextMenuItem[])[0]).toMatchObject({ disabled: true });
    expect(items({ id: "t", label: "T", viewType: "table", config: {} }, VIEWS)).toEqual([]);
  });
});
