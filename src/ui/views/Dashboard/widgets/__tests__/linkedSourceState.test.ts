// #136/#137 — what a block reads, as one value instead of a frame that might
// belong to someone else.

import {
  resolveBlockSource,
  blockFrame,
  blockFrameOrEmpty,
  isExternalSource,
  resolveDbCallView,
} from "../linkedSourceState";
import type { ExternalSourceState } from "../../dashboardPreload";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { WidgetDefinition } from "../../types";

const frame = (name: string): DataFrame =>
  ({ fields: [{ name }], records: [{ id: "r1", values: {} }] }) as unknown as DataFrame;

const parent = frame("parent");
const external = frame("external");

const states = (entries: Array<[string, ExternalSourceState]> = []) =>
  new Map<string, ExternalSourceState>(entries);

describe("#136 resolveBlockSource", () => {
  it("reads the host's own frame when no external source is configured", () => {
    expect(resolveBlockSource(undefined, states(), parent)).toEqual({
      kind: "parent",
      frame: parent,
    });
  });

  it("reports loading while the source is resolving", () => {
    const source = resolveBlockSource("p1", states([["p1", { status: "loading" }]]), parent);

    expect(source).toEqual({ kind: "loading", projectId: "p1" });
  });

  it("treats an absent entry as loading, not as gone", () => {
    // The preloader publishes `loading` for every referenced id before awaiting,
    // so an absent key means the batch has not started. Guessing "unavailable"
    // would put an error in front of the user on every first render.
    expect(resolveBlockSource("p1", states(), parent)).toEqual({
      kind: "loading",
      projectId: "p1",
    });
  });

  it("returns the external frame when ready", () => {
    const source = resolveBlockSource(
      "p1",
      states([["p1", { status: "ready", frame: external }]]),
      parent
    );

    expect(source).toEqual({ kind: "ready", projectId: "p1", frame: external });
  });

  it("reports unavailable, carrying the id so the UI can name it", () => {
    const source = resolveBlockSource("gone", states([["gone", { status: "unavailable" }]]), parent);

    expect(source).toEqual({ kind: "unavailable", projectId: "gone" });
  });

  it("carries the message through on error", () => {
    const source = resolveBlockSource(
      "bad",
      states([["bad", { status: "error", message: "unreachable" }]]),
      parent
    );

    expect(source).toEqual({ kind: "error", projectId: "bad", message: "unreachable" });
  });

  it.each(["loading", "unavailable", "error"] as const)(
    "never hands back the parent's frame when the source is %s",
    (status) => {
      const state = (status === "error"
        ? { status, message: "x" }
        : { status }) as ExternalSourceState;
      const source = resolveBlockSource("p1", states([["p1", state]]), parent);

      // This is the whole defect: `?? frame` used to substitute the parent's
      // records here, presenting another project's data as the source's own.
      expect(blockFrame(source)).toBeNull();
      expect(blockFrameOrEmpty(source)).not.toBe(parent);
      expect(blockFrameOrEmpty(source).records).toHaveLength(0);
    }
  );
});

describe("#136 blockFrame", () => {
  it("returns the frame for parent and ready", () => {
    expect(blockFrame({ kind: "parent", frame: parent })).toBe(parent);
    expect(blockFrame({ kind: "ready", projectId: "p", frame: external })).toBe(external);
  });

  it("returns null rather than an empty frame, so callers must decide", () => {
    // An empty frame reads as "no records match" — a claim about the source,
    // not about our failure to load it.
    expect(blockFrame({ kind: "unavailable", projectId: "p" })).toBeNull();
  });
});

describe("#136 isExternalSource", () => {
  it("is false only for the host's own frame", () => {
    expect(isExternalSource({ kind: "parent", frame: parent })).toBe(false);
    expect(isExternalSource({ kind: "loading", projectId: "p" })).toBe(true);
    expect(isExternalSource({ kind: "ready", projectId: "p", frame: external })).toBe(true);
    expect(isExternalSource({ kind: "unavailable", projectId: "p" })).toBe(true);
  });
});

describe("#136 resolveDbCallView", () => {
  const widget = (extra: Partial<WidgetDefinition> = {}): WidgetDefinition =>
    ({
      id: "w1",
      type: "database-call",
      title: "W",
      layout: { x: 0, y: 0, w: 4, h: 4 },
      config: {},
      ...extra,
    }) as WidgetDefinition;

  it("keeps frame and isExternal in step for a ready external source", () => {
    const view = resolveDbCallView(
      widget({ sourceConfig: { projectId: "p1" } as never }),
      states([["p1", { status: "ready", frame: external }]]),
      parent
    );

    expect(view.isExternal).toBe(true);
    expect(view.frame).toBe(external);
  });

  it("never reports isExternal with the parent's frame — the #136 shape", () => {
    const view = resolveDbCallView(
      widget({ sourceConfig: { projectId: "p1" } as never }),
      states([["p1", { status: "unavailable" }]]),
      parent
    );

    expect(view.isExternal).toBe(true);
    expect(view.frame).not.toBe(parent);
  });

  it("uses the transformed frame for a widget with no external source", () => {
    const view = resolveDbCallView(widget(), states(), parent);

    expect(view.isExternal).toBe(false);
    expect(view.frame).toBe(parent);
  });

  it("ignores sourceConfig on a widget that is not a database-call", () => {
    const view = resolveDbCallView(
      widget({ type: "chart", sourceConfig: { projectId: "p1" } as never }),
      states([["p1", { status: "ready", frame: external }]]),
      parent
    );

    expect(view.isExternal).toBe(false);
    expect(view.frame).toBe(parent);
  });
});
