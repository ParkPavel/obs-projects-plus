/**
 * i3-data — the canvas registry is consumed: a widget reading a block ref gets
 * that block's live frame; a loop is an error with no subscription; the same
 * frame is not re-published; everything is released on unsubscribe.
 */
import { get, readable, writable } from "svelte/store";
import { createDataProviderRegistry } from "src/lib/stores/dataProviderRegistry";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import { liveBlockSources, mergeBlockSources, type BlockSourcesValue } from "../blockSources";

const frame = (ids: string[]): DataFrame => ({ fields: [], records: ids.map((id) => ({ id, values: {} })) });
const A = "p1::block:v1:A";
const B = "p1::block:v1:B";

function project(aSource?: string, bSource?: string) {
  const w = (id: string, source?: string) => ({ id, type: "database-call", title: id, layout: {}, config: {}, ...(source ? { sourceConfig: { projectId: source } } : {}) });
  return { id: "p1", name: "P", views: [{ id: "v1", name: "D", filter: { conditions: [] }, config: { widgets: [w("A", aSource), w("B", bSource)] } }] } as never;
}
const texts = readable({ block: (t: string) => `Block ${t}`, cycle: "loop" });

function setup(aSource?: string, bSource?: string) {
  const registry = createDataProviderRegistry();
  const bFrame = writable(frame(["b1", "b2"]));
  let subscribers = 0;
  const frame$ = { subscribe: (fn: (f: DataFrame) => void) => { subscribers++; const stop = bFrame.subscribe(fn); return () => { subscribers--; stop(); }; } };
  registry.register({ id: "B", name: "B", frame$, refresh: () => {} });
  const p = project(aSource, bSource);
  const live = liveBlockSources(registry, readable([p]), texts);
  const seen: BlockSourcesValue[] = [];
  const stop = live.subscribe((v) => seen.push(v));
  const widget = (p as { views: Array<{ config: { widgets: unknown[] } }> }).views[0]!.config.widgets[0];
  live.watch(widget as never, p);
  return { live, bFrame, seen, stop, subscribers: () => subscribers, p, widget };
}

it("a block reading another block gets its live frame, and follows it", () => {
  const s = setup(B);
  const v = get(s.live);
  expect(v.states.get(B)).toMatchObject({ status: "ready" });
  expect((v.states.get(B) as { frame: DataFrame }).frame.records).toHaveLength(2);
  expect(v.writable.has(B)).toBe(true);
  s.bFrame.set(frame(["b1"]));
  expect((get(s.live).states.get(B) as { frame: DataFrame }).frame.records).toHaveLength(1);
  s.stop();
});

it("A ↔ B is an error state with no subscription — nothing can circulate", () => {
  const s = setup(B, A);
  expect(get(s.live).states.get(B)).toEqual({ status: "error", message: "loop" });
  expect(s.subscribers()).toBe(0);
  s.stop();
});

it("re-watching the same widget, or the same frame again, publishes nothing new", () => {
  const s = setup(B);
  const before = s.seen.length;
  s.live.watch(s.widget as never, s.p);
  s.live.watch({ ...(s.widget as object) } as never, s.p);
  expect(s.seen.length).toBe(before);
  s.stop();
});

it("unsubscribing releases the provider subscription", () => {
  const s = setup(B);
  expect(s.subscribers()).toBe(1);
  s.stop();
  expect(s.subscribers()).toBe(0);
});

it("the catalogue lists the other block and never the reader itself", () => {
  const s = setup();
  expect(get(s.live).catalogue.map((o) => o.id)).toEqual([B]);
  s.stop();
});

it("merge keeps the preloader's objects when nothing is live", () => {
  const states = new Map();
  const right = new Map();
  const out = mergeBlockSources(states, right, { states: new Map(), writable: new Set(), catalogue: [] }, [{ id: "p2", name: "P2" }]);
  expect(out.sourceStates).toBe(states);
  expect(out.rightFrames).toBe(right);
  expect(out.catalogue).toEqual([{ id: "p2", name: "P2" }]);
});

it("live wins over the preloaded state, and a same-project block is writable", () => {
  const f = frame(["x"]);
  const out = mergeBlockSources(new Map([[B, { status: "loading" as const }]]), new Map(),
    { states: new Map([[B, { status: "ready" as const, frame: f }]]), writable: new Set([B]), catalogue: [] }, []);
  expect(out.sourceStates.get(B)).toEqual({ status: "ready", frame: f, writable: true });
  expect(out.rightFrames.get(B)).toBe(f);
});
