/**
 * #194 — what taking the data scope off actually stores.
 *
 * The whole point of the surface is that it can be UNDONE, and "undone" has a
 * precise meaning here: the key is GONE, not `""` and not present-but-undefined.
 * `resolveNamedSource` guarantees that a config without `sourceId` gets the
 * merge frame by reference (#170), so "never narrowed" and "narrowed and then
 * un-narrowed" have to be one state in the file as well as in the resolver.
 *
 * `""` would resolve identically today — the reader tests `!sourceId` — so this
 * is not a behaviour test dressed up. It pins the STORED SHAPE, because the
 * value ends up in a user's `data.json` where a stale empty key is a question
 * the next reader has to answer, and because `exactOptionalPropertyTypes`
 * refuses the lazy spelling outright.
 */

import type { WidgetSourceConfig } from "../../types";
import { applyDataScope } from "../dataScope";

describe("#194 — un-narrowing removes the key", () => {
  it("removes `sourceId` rather than storing an empty string", () => {
    const next = applyDataScope({ projectId: "", sourceId: "src-2" }, "");
    expect("sourceId" in next).toBe(false);
    expect(Object.keys(next)).toEqual(["projectId"]);
    // Serialised, because that is the form the config is stored in: both `""`
    // and an explicit `undefined` would survive this round trip as evidence
    // that someone once narrowed the block.
    expect(JSON.stringify(next)).toBe('{"projectId":""}');
  });

  it("leaves the stored object alone and returns a new one", () => {
    // The host patches a widget with the RESULT; mutating the current config in
    // place would change what the reactive statement is diffing against.
    const stored: WidgetSourceConfig = { projectId: "other-project", sourceId: "src-2" };
    expect(applyDataScope(stored, "")).toEqual({ projectId: "other-project" });
    expect(stored.sourceId).toBe("src-2");
  });

  it("keeps every other key of the config when narrowing", () => {
    expect(applyDataScope({ projectId: "other-project" }, "src-3")).toEqual({
      projectId: "other-project",
      sourceId: "src-3",
    });
  });

  it("narrows a widget that never carried a sourceConfig at all", () => {
    // Every non-`database-call` widget is in this state today. The inert
    // `projectId: ""` it gains is the already-shipped spelling of "this view's
    // data" — `resolveDbCallView` honours `projectId` only for `database-call`
    // — and #194 §6 records it as a known side effect rather than a discovery.
    expect(applyDataScope(undefined, "src-1")).toEqual({ projectId: "", sourceId: "src-1" });
    expect(applyDataScope(undefined, "")).toEqual({ projectId: "" });
    expect("sourceId" in applyDataScope(undefined, "")).toBe(false);
  });

  it("round-trips: narrow, then un-narrow, back to the starting shape", () => {
    const start: WidgetSourceConfig = { projectId: "" };
    const narrowed = applyDataScope(start, "src-1");
    expect(narrowed.sourceId).toBe("src-1");
    expect(applyDataScope(narrowed, "")).toEqual(start);
  });
});
