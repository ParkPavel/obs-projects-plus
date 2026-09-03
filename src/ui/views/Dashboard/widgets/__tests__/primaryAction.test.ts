/**
 * #169 — which widget types have an action of their own, and who runs it.
 *
 * The rule under test is a design rule, not a lookup: a widget has a primary
 * action only when it CREATES OR APPENDS the thing the user reads that block
 * for. The temptation this pins against is filling the table in later "for
 * completeness" — a chart with an add button promises a record it cannot hold,
 * and a header that runs the creation itself gives a block two ways to make a
 * record where the user already had one.
 */

import type { WidgetType } from "../../types";
import { primaryActionFor } from "../headerChrome";

describe("#169 — a type has a primary action only if it creates what it shows", () => {
  it("the table offers the record it exists to hold", () => {
    const action = primaryActionFor("data-table");
    expect(action).not.toBeNull();
    expect(action?.labelDefault).toBe("Add record");
    // The copy is a translation, not a code change — the key has to be real.
    expect(action?.labelKey).toMatch(/^views\.dashboard\.widget\.primary\./);
  });

  it("a multi-view block gets none, because creation there needs context", () => {
    // The finding that changed this table, from the adversarial review of
    // #169. `database-call` hosts Board, Calendar and Gallery tabs, and each
    // creates a record WITH the context of what you are looking at: the
    // column's value, the day you clicked, the active filter. A header button
    // stands outside all of it — on a Calendar tab it would write a record
    // with no date, which then does not appear in the calendar that made it.
    // Offering a shortcut that lands somewhere else is worse than offering
    // none, so the rule excludes it rather than the rule being bent.
    expect(primaryActionFor("database-call")).toBeNull();
  });

  it("a derived surface gets none either, and that is an answer not a gap", () => {
    // A chart and a stats card are computed from other records; they hold none
    // of their own. `filter-tabs` narrows, `text` and `divider` are chrome —
    // and narrowing, sorting and display config are never primary by the rule.
    for (const type of ["chart", "stats", "filter-tabs", "text", "divider", "cover-banner"] as WidgetType[]) {
      expect({ type, action: primaryActionFor(type) }).toEqual({ type, action: null });
    }
  });

  it("names no type the widget registry does not have", () => {
    // A label keyed off a type that no longer exists would render nowhere and
    // be found by nobody. Every answer above is about a live member.
    const live: WidgetType[] = ["data-table", "database-call", "chart", "stats"];
    for (const type of live) {
      expect(() => primaryActionFor(type)).not.toThrow();
    }
  });
});
