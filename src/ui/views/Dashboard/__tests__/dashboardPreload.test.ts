// #136 — the preloader publishes what is known about each external source.
//
// It used to publish Map<string, DataFrame> and simply omit anything it could
// not resolve, so a consumer could not tell "still loading" from "this project
// is gone". WidgetHost bridged that gap by rendering the PARENT project's
// records instead: plausible data from the wrong project, with no signal.
// A missing key is not a state.

import {
  createPreloadRunner,
  readyFrames,
  type ExternalSourceState,
} from "../dashboardPreload";
import type { DataFrame } from "src/lib/dataframe/dataframe";

const frame = (name: string): DataFrame =>
  ({ fields: [{ name }], records: [] }) as unknown as DataFrame;

/** Collects every published snapshot so ordering can be asserted, not just the end state. */
function collector() {
  const seen: Array<ReadonlyMap<string, ExternalSourceState>> = [];
  return { seen, set: (s: ReadonlyMap<string, ExternalSourceState>) => void seen.push(s) };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("readyFrames", () => {
  it("keeps only resolved sources", () => {
    const states = new Map<string, ExternalSourceState>([
      ["a", { status: "ready", frame: frame("a") }],
      ["b", { status: "loading" }],
      ["c", { status: "unavailable" }],
      ["d", { status: "error", message: "boom" }],
    ]);

    expect([...readyFrames(states).keys()]).toEqual(["a"]);
  });

  it("is empty rather than throwing when nothing resolved", () => {
    expect(readyFrames(new Map([["b", { status: "loading" }]])).size).toBe(0);
  });
});

describe("#136 createPreloadRunner publishes source state", () => {
  it("publishes loading for every id BEFORE awaiting", async () => {
    const c = collector();
    const run = createPreloadRunner(async () => frame("x"), c.set);

    run(["p1", "p2"]);

    // The synchronous first snapshot is the whole point: it is the window in
    // which the old code rendered the parent project's data.
    expect(c.seen).toHaveLength(1);
    expect([...c.seen[0]!.values()].every((s) => s.status === "loading")).toBe(true);
    await flush();
  });

  it("marks a source ready with its frame", async () => {
    const c = collector();
    const f = frame("external");
    createPreloadRunner(async () => f, c.set)(["p1"]);
    await flush();

    expect(c.seen.at(-1)!.get("p1")).toEqual({ status: "ready", frame: f });
  });

  it("marks an unresolved source unavailable, never absent", async () => {
    const c = collector();
    createPreloadRunner(async () => undefined, c.set)(["gone"]);
    await flush();

    // Absent would be indistinguishable from loading — the original defect.
    expect(c.seen.at(-1)!.get("gone")).toEqual({ status: "unavailable" });
  });

  it("marks a throwing source as an error and keeps its message", async () => {
    const c = collector();
    createPreloadRunner(async () => {
      throw new Error("datasource unreachable");
    }, c.set)(["broken"]);
    await flush();

    expect(c.seen.at(-1)!.get("broken")).toEqual({
      status: "error",
      message: "datasource unreachable",
    });
  });

  it("isolates a failing source — one broken project does not blank its siblings", async () => {
    const c = collector();
    const good = frame("good");
    createPreloadRunner(async (id) => {
      if (id === "bad") throw new Error("nope");
      return good;
    }, c.set)(["bad", "good"]);
    await flush();

    const last = c.seen.at(-1)!;
    // The previous implementation caught at the batch level and published an
    // empty map, taking every sibling down with the one failure.
    expect(last.get("good")).toEqual({ status: "ready", frame: good });
    expect(last.get("bad")?.status).toBe("error");
  });

  it("publishes an empty map when there is nothing to resolve", () => {
    const c = collector();
    createPreloadRunner(async () => frame("x"), c.set)([]);

    expect(c.seen.at(-1)!.size).toBe(0);
  });

  it("publishes an empty map when the host cannot resolve at all", () => {
    const c = collector();
    createPreloadRunner(undefined, c.set)(["p1"]);

    expect(c.seen.at(-1)!.size).toBe(0);
  });

  it("discards a stale batch so a slow first run cannot overwrite a newer one", async () => {
    const c = collector();
    const deferred: Array<(f: DataFrame) => void> = [];
    const run = createPreloadRunner(async (id) => {
      if (id === "slow") return new Promise<DataFrame>((r) => void deferred.push(r));
      return frame("fast");
    }, c.set);

    run(["slow"]);
    run(["fast"]);
    await flush();
    deferred.forEach((r) => r(frame("slow")));
    await flush();

    const last = c.seen.at(-1)!;
    expect(last.has("slow")).toBe(false);
    expect(last.get("fast")?.status).toBe("ready");
  });
});
