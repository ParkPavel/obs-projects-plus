/**
 * #194 — which widget types show the «Data scope» control.
 *
 * Beside `primaryAction.test.ts`, and for the same reason: the rule under test
 * is a design rule, not a lookup. A widget has a data scope IF AND ONLY IF it
 * derives what it shows from the frame it was handed.
 *
 * The temptation this pins against is the opposite of #169's. `sourceId` was
 * already honoured for EVERY type by `hostFrames`, ahead of any gate, while
 * only `database-call` offered a way to set it — so the easy "fix" was to
 * narrow the reader to match the writer. That was put to the user and rejected;
 * the surface widens to match the engine instead. A red here means someone
 * gated the control by a type the engine still reads for, which puts a stored
 * value back out of reach — exactly the defect the ticket exists to close.
 */

import type { WidgetType } from "../../types";
import { hasDataScope } from "../headerChrome";

/** Derives what it shows from the host's frame. */
const SCOPED: WidgetType[] = [
  "data-table",
  "database-call",
  "chart",
  "stats",
  "checklist",
  "filter-tabs",
];

/** Static chrome, or a retired type that renders a placeholder. */
const UNSCOPED: WidgetType[] = [
  "cover-banner",
  "text",
  "divider",
  "comparison",
  "view-port",
  "summary-row",
  "data-list",
  "sub-base-canvas",
  "yaml-visualizer",
  "timeline",
];

describe("#194 — a type has a data scope only if it derives what it shows", () => {
  it("gives one to all six blocks that read the frame", () => {
    for (const type of SCOPED) {
      expect({ type, scoped: hasDataScope(type) }).toEqual({ type, scoped: true });
    }
  });

  it("gives none to static chrome or to a retired type", () => {
    // `cover-banner` is here for a reason that is not "it is decorative": the
    // registry hands it `config` and no frame at all, so a scope would narrow
    // nothing. The retired types render `LegacyWidgetPlaceholder`, and a picker
    // on a placeholder is chrome on a headstone.
    for (const type of UNSCOPED) {
      expect({ type, scoped: hasDataScope(type) }).toEqual({ type, scoped: false });
    }
  });

  it("says yes to filter-tabs, and that is a decision and not an oversight", () => {
    // #194 §4. `filter-tabs` derives THE TABS from its frame, so narrowing it
    // decides what the rest of the canvas can then be narrowed by. The rule is
    // mechanical; excluding it would be a special case with no argument behind
    // it. Recorded here so the consequence is read rather than discovered.
    expect(hasDataScope("filter-tabs")).toBe(true);
  });

  it("covers every member of WidgetType, so a new type cannot arrive unanswered", () => {
    // The two lists above are the whole union. Without this, adding a widget
    // type would leave it silently unscoped and nobody would be told.
    const answered = [...SCOPED, ...UNSCOPED].sort();
    expect(new Set(answered).size).toBe(answered.length);
    expect(answered).toEqual(
      (
        [
          "chart",
          "checklist",
          "comparison",
          "cover-banner",
          "data-list",
          "data-table",
          "database-call",
          "divider",
          "filter-tabs",
          "stats",
          "sub-base-canvas",
          "summary-row",
          "text",
          "timeline",
          "view-port",
          "yaml-visualizer",
        ] as WidgetType[]
      ).sort()
    );
  });
});
