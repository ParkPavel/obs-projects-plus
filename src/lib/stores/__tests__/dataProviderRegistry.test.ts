import { get, writable, type Readable } from "svelte/store";

import type { DataFrame } from "src/lib/dataframe/dataframe";
import {
  createDataProviderRegistry,
  DATA_PROVIDER_REGISTRY_CONTEXT_KEY,
  type DataProvider,
  type DataProviderRegistry,
} from "src/lib/stores/dataProviderRegistry";

function emptyFrame(): DataFrame {
  return { fields: [], records: [] };
}

function makeProvider(
  id: string,
  name: string = id,
  refreshSpy: jest.Mock = jest.fn()
): DataProvider & { frame$: ReturnType<typeof writable<DataFrame>> } {
  const frame$ = writable<DataFrame>(emptyFrame());
  return {
    id,
    name,
    frame$,
    refresh: refreshSpy,
  };
}

describe("dataProviderRegistry — context key", () => {
  it("exposes a stable unique Symbol", () => {
    expect(typeof DATA_PROVIDER_REGISTRY_CONTEXT_KEY).toBe("symbol");
    expect(DATA_PROVIDER_REGISTRY_CONTEXT_KEY.toString()).toContain(
      "ppp:dataProviderRegistry"
    );
  });
});

describe("dataProviderRegistry — factory creates independent instances", () => {
  it("each call returns a new registry that does not share state", () => {
    const a = createDataProviderRegistry();
    const b = createDataProviderRegistry();

    a.register(makeProvider("alpha"));

    expect(a.getProvider("alpha")).toBeDefined();
    expect(b.getProvider("alpha")).toBeUndefined();
    expect(get(a as Readable<ReadonlyMap<string, DataProvider>>).size).toBe(1);
    expect(get(b as Readable<ReadonlyMap<string, DataProvider>>).size).toBe(0);
  });
});

describe("dataProviderRegistry — register / unregister / getProvider", () => {
  let registry: DataProviderRegistry;

  beforeEach(() => {
    registry = createDataProviderRegistry();
  });

  it("register adds a provider observable via getProvider and the store", () => {
    const p = makeProvider("widget-1", "Widget One");
    registry.register(p);

    expect(registry.getProvider("widget-1")).toBe(p);
    const snapshot = get(registry);
    expect(snapshot.size).toBe(1);
    expect(snapshot.get("widget-1")?.name).toBe("Widget One");
  });

  it("register with an existing id replaces the previous provider", () => {
    const original = makeProvider("widget-1", "Original");
    const replacement = makeProvider("widget-1", "Replacement");

    registry.register(original);
    registry.register(replacement);

    expect(registry.getProvider("widget-1")).toBe(replacement);
    expect(get(registry).size).toBe(1);
  });

  it("unregister removes by id and is a no-op for unknown ids", () => {
    const p = makeProvider("widget-1");
    registry.register(p);
    registry.unregister("widget-1");
    expect(registry.getProvider("widget-1")).toBeUndefined();
    expect(get(registry).size).toBe(0);

    // Unknown id — should not throw or mutate.
    expect(() => registry.unregister("missing")).not.toThrow();
    expect(get(registry).size).toBe(0);
  });

  it("emits a single subscriber update per mutation", () => {
    const updates: number[] = [];
    const unsub = registry.subscribe((m) => updates.push(m.size));

    registry.register(makeProvider("a"));
    registry.register(makeProvider("b"));
    registry.unregister("a");

    // initial 0, +a => 1, +b => 2, -a => 1
    expect(updates).toEqual([0, 1, 2, 1]);
    unsub();
  });
});

describe("dataProviderRegistry — notifyAll", () => {
  it("invokes refresh() on every registered provider exactly once", () => {
    const registry = createDataProviderRegistry();
    const refreshA = jest.fn();
    const refreshB = jest.fn();

    registry.register(makeProvider("a", "A", refreshA));
    registry.register(makeProvider("b", "B", refreshB));

    registry.notifyAll();

    expect(refreshA).toHaveBeenCalledTimes(1);
    expect(refreshB).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when no providers are registered", () => {
    const registry = createDataProviderRegistry();
    expect(() => registry.notifyAll()).not.toThrow();
  });
});

describe("dataProviderRegistry — clear", () => {
  it("removes all providers", () => {
    const registry = createDataProviderRegistry();
    registry.register(makeProvider("a"));
    registry.register(makeProvider("b"));
    expect(get(registry).size).toBe(2);

    registry.clear();
    expect(get(registry).size).toBe(0);
    expect(registry.getProvider("a")).toBeUndefined();
  });
});
