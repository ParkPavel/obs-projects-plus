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
  it("both table-shaped types offer the record they exist to hold", () => {
    for (const type of ["data-table", "database-call"] as WidgetType[]) {
      const action = primaryActionFor(type);
      expect(action).not.toBeNull();
      expect(action?.labelDefault).toBe("Add record");
      // The copy is a translation, not a code change — the key has to be real.
      expect(action?.labelKey).toMatch(/^views\.dashboard\.widget\.primary\./);
    }
  });

  it("a derived surface gets none, and that is the answer rather than a gap", () => {
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
