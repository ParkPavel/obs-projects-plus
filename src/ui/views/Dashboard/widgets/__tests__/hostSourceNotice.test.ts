/**
 * #194 — the broken-source notice reaches the blocks that were drawing numbers.
 *
 * This is the defect the architect pass found and the ticket had not named, and
 * it is heavier than the complaint the ticket was filed for. `hostFrames` falls
 * back to the WHOLE PROJECT when a named source resolves `broken`, and the
 * explanation reached exactly two registry entries — `data-table` and
 * `database-call`, both of which render through `DatabaseCallBlock` and call
 * `namedSourceNotice` themselves.
 *
 * So for a chart, "the source was deleted" and "no source was ever named" were
 * the same screen: it drew the whole project's totals as if they were the
 * source's. Plausible and wrong is worse than empty — an empty chart sends the
 * user to look at their configuration, and a wrong one sends them nowhere.
 *
 * `namedSourceNotice` itself is already tested; what is asserted here is REACH.
 */

import type { NamedSourceView } from "src/lib/datasources/namedSource";
import type { WidgetType } from "../../types";
import { hostSourceNotice } from "../dataScope";

const broken = (label: string): NamedSourceView => ({
  kind: "broken",
  reason: `source "${label}" produced no acquired frame`,
  label,
});

const EMPTY_FRAME = { fields: [], records: [] };

describe("#194 — which blocks the host shows a broken-source notice for", () => {
  it("reaches a chart, which is where the wrong numbers were drawn", () => {
    const notice = hostSourceNotice("chart", broken("Archive"));
    expect(notice).not.toBeNull();
    expect(notice?.placement).toBe("screen");
    expect(notice?.vars["source"]).toBe("Archive");
    // The resolver's own reason is specific and travels with the notice; a
    // generic "something went wrong" would be the empty table by another name.
    expect(notice?.hint).toContain("Archive");
  });

  it("reaches stats, checklist and filter-tabs as well", () => {
    for (const type of ["stats", "checklist", "filter-tabs"] as WidgetType[]) {
      expect({ type, shown: hostSourceNotice(type, broken("Archive")) !== null }).toEqual({
        type,
        shown: true,
      });
    }
  });

  it("stays silent for the two blocks that already render it themselves", () => {
    // `DatabaseCallBlock` is handed `namedSource` by both registry entries and
    // shows the notice inside its own chrome. A second copy above it would be
    // the same sentence twice, in two different frames.
    expect(hostSourceNotice("data-table", broken("Archive"))).toBeNull();
    expect(hostSourceNotice("database-call", broken("Archive"))).toBeNull();
  });

  it("stays silent for a type that has no data scope at all", () => {
    // `text` and `divider` are never handed a frame, so they can have no source
    // to break. A notice there would describe a state they cannot be in.
    expect(hostSourceNotice("text", broken("Archive"))).toBeNull();
    expect(hostSourceNotice("cover-banner", broken("Archive"))).toBeNull();
    expect(hostSourceNotice("timeline", broken("Archive"))).toBeNull();
  });

  it("says nothing when the source resolved, and nothing for an honest empty", () => {
    // `empty` is a real answer, and its placement is `hint` — it belongs UNDER
    // a block's own empty state, not instead of the block. Replacing a chart
    // with a full-screen notice because its source has no records today would
    // read as a failure. That distinction is the reason `placement` exists.
    expect(hostSourceNotice("chart", { kind: "ok", frame: EMPTY_FRAME, label: undefined })).toBeNull();
    expect(hostSourceNotice("chart", { kind: "ok", frame: EMPTY_FRAME, label: "Archive" })).toBeNull();
    expect(hostSourceNotice("chart", { kind: "empty", frame: EMPTY_FRAME, label: "Archive" })).toBeNull();
  });
});
