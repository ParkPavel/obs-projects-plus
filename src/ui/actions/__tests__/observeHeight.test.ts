/** 17.10 — one shared ResizeObserver reports each node's height (no iframe per node). */
import { observeHeight } from "../observeHeight";

it("every node is observed by the same observer and reports its own height", () => {
  const instances: Array<{ cb: ResizeObserverCallback; observed: Element[] }> = [];
  (global as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observed: Element[] = [];
    constructor(public cb: ResizeObserverCallback) { instances.push(this); }
    observe(el: Element) { this.observed.push(el); }
    unobserve(el: Element) { this.observed = this.observed.filter((x) => x !== el); }
    disconnect() {}
  };
  const a = document.createElement("div");
  const b = document.createElement("div");
  const seen: string[] = [];
  const ha = observeHeight(a, (h) => seen.push(`a:${h}`));
  observeHeight(b, (h) => seen.push(`b:${h}`));
  expect(instances).toHaveLength(1);
  expect(instances[0]!.observed).toEqual([a, b]);
  instances[0]!.cb([{ target: b, contentRect: { height: 40 } } as unknown as ResizeObserverEntry], {} as ResizeObserver);
  expect(seen).toEqual(["b:40"]);
  ha.destroy();
  expect(instances[0]!.observed).toEqual([b]);
});
