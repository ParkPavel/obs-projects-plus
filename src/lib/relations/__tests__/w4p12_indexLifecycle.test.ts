/**
 * w4-p12 (audit F18) — the inverse index's timers belong to its life.
 *
 * The store schedules a rebuild at creation (in case `resolved` fired before
 * it subscribed). When `resolved` then came, `rebuildNow` dropped the
 * reference to that still-live timer, so `destroy` could not cancel it: the
 * vault was scanned once more after the store was gone. Now a rebuild cancels
 * what was scheduled, and after destroy nothing scans or publishes.
 */
import { get } from "svelte/store";
import { createInverseIndexStore } from "../inverseIndexStore";

type App = import("obsidian").App;
type TFile = import("obsidian").TFile;

function fakeApp() {
  let scans = 0;
  const listeners = new Map<string, Array<() => void>>();
  const files = [{ path: "A.md" } as unknown as TFile];
  const app = {
    vault: {
      getMarkdownFiles: () => {
        scans += 1;
        return files;
      },
    },
    metadataCache: {
      getFileCache: () => ({ frontmatter: { links: ["[[T]]"] } }),
      getFirstLinkpathDest: () => null,
      on(event: string, cb: () => void) {
        listeners.set(event, [...(listeners.get(event) ?? []), cb]);
        return { event, cb };
      },
      offref(ref: { event: string; cb: () => void }) {
        listeners.set(ref.event, (listeners.get(ref.event) ?? []).filter((cb) => cb !== ref.cb));
      },
    },
  } as unknown as App;
  const fire = (event: string) => (listeners.get(event) ?? []).forEach((cb) => cb());
  return { app, fire, scans: () => scans };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("inverse index store — life cycle", () => {
  it("startup timer, resolved, destroy: no scan after destroy (old code: a second scan)", () => {
    const { app, fire, scans } = fakeApp();
    const store = createInverseIndexStore(app);
    fire("resolved");
    expect(scans()).toBe(1);
    store.destroy();
    jest.advanceTimersByTime(1000);
    expect(scans()).toBe(1);
  });

  it("nothing is published after destroy, even by an explicit rebuild", () => {
    const { app, scans } = fakeApp();
    const store = createInverseIndexStore(app);
    const seen = jest.fn();
    const unsubscribe = store.subscribe(seen);
    store.destroy();
    store.rebuild();
    jest.advanceTimersByTime(1000);
    expect(scans()).toBe(0);
    expect(seen).toHaveBeenCalledTimes(1); // the initial empty value only
    unsubscribe();
  });

  it("a second destroy is safe", () => {
    const { app } = fakeApp();
    const store = createInverseIndexStore(app);
    store.destroy();
    expect(() => store.destroy()).not.toThrow();
  });

  it("a burst of changes is one rebuild, and the index is current", () => {
    const { app, fire, scans } = fakeApp();
    const store = createInverseIndexStore(app);
    fire("resolved");
    const before = scans();
    for (let i = 0; i < 20; i++) fire("changed");
    jest.advanceTimersByTime(250);
    expect(scans() - before).toBe(1);
    expect(get(store).get("T")).toEqual([{ sourcePath: "A.md", viaKey: "links" }]);
    store.destroy();
  });
});
