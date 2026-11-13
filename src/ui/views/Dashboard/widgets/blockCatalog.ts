// blockCatalog.ts — B7: the ONE list of blocks a person can insert.
//
// The «+» between blocks and at the end of the page opens this list. Every
// entry says what the block IS in plain words, not what it is called inside
// the code. Retired (legacy) types are not offered at all: an existing
// instance keeps rendering, but nobody is invited to make a new one.

import type { WidgetType } from "../types";
import { canAddWidget } from "./widgetRegistry";

export interface BlockChoice {
  readonly type: WidgetType;
  readonly icon: string;
  readonly labelKey: string;
  readonly labelDefault: string;
  readonly descKey: string;
  readonly descDefault: string;
}

const K = "views.dashboard.insert";

export const BLOCK_CHOICES: readonly BlockChoice[] = [
  { type: "database-call", icon: "database", labelKey: `${K}.database`, labelDefault: "Database",
    descKey: `${K}.database-desc`, descDefault: "Table, board or calendar built from notes" },
  { type: "chart", icon: "bar-chart-2", labelKey: `${K}.chart`, labelDefault: "Chart",
    descKey: `${K}.chart-desc`, descDefault: "Bars, lines or a pie from a field's values" },
  { type: "stats", icon: "hash", labelKey: `${K}.stats`, labelDefault: "Numbers",
    descKey: `${K}.stats-desc`, descDefault: "Counts, sums and averages at a glance" },
  { type: "text", icon: "type", labelKey: `${K}.text`, labelDefault: "Text",
    descKey: `${K}.text-desc`, descDefault: "A note, heading or explanation" },
  { type: "checklist", icon: "check-square", labelKey: `${K}.checklist`, labelDefault: "Checklist",
    descKey: `${K}.checklist-desc`, descDefault: "Tick off notes as done" },
  { type: "filter-tabs", icon: "filter", labelKey: `${K}.filter-tabs`, labelDefault: "Filter tabs",
    descKey: `${K}.filter-tabs-desc`, descDefault: "Tabs that narrow every block on the page" },
  { type: "cover-banner", icon: "image", labelKey: `${K}.cover`, labelDefault: "Cover",
    descKey: `${K}.cover-desc`, descDefault: "An image across the top of the page" },
  { type: "divider", icon: "minus", labelKey: `${K}.divider`, labelDefault: "Divider",
    descKey: `${K}.divider-desc`, descDefault: "A line between sections" },
];

/** The insert menu for the page as it is now: a capped type is shown, disabled. */
export function insertChoices(current: ReadonlyArray<{ type: WidgetType }>): Array<BlockChoice & { allowed: boolean }> {
  return BLOCK_CHOICES.map((choice) => ({ ...choice, allowed: canAddWidget(choice.type, [...current]) }));
}
