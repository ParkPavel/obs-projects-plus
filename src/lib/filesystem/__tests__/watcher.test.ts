/**
 * REFACTOR-205 — reload-cycle / no listener leak.
 *
 * The watcher itself holds no mutable state; every event registration
 * is delegated to `plugin.registerEvent`, which Obsidian disposes on
 * plugin unload. This suite documents and locks that contract by
 * simulating multiple plugin reload cycles.
 */

import type { Plugin } from "obsidian";
import { ObsidianFileSystemWatcher } from "../obsidian/filesystem";

interface MockPlugin {
  registerEvent: jest.Mock;
  app: {
    vault: { on: jest.Mock };
    metadataCache: { on: jest.Mock };
  };
}

function makePlugin(): MockPlugin {
  return {
    registerEvent: jest.fn(),
    app: {
      vault: { on: jest.fn((_evt: string, _cb: unknown) => ({ tag: "ref" })) },
      metadataCache: {
        on: jest.fn((_evt: string, _cb: unknown) => ({ tag: "ref" })),
      },
    },
  };
}

describe("ObsidianFileSystemWatcher / reload-cycle", () => {
  it("does not retain references between instances (no module-level state)", () => {
    const p1 = makePlugin();
    const p2 = makePlugin();
    const w1 = new ObsidianFileSystemWatcher(p1 as unknown as Plugin);
    const w2 = new ObsidianFileSystemWatcher(p2 as unknown as Plugin);
    w1.onCreate(async () => undefined);
    w2.onCreate(async () => undefined);
    expect(p1.registerEvent).toHaveBeenCalledTimes(1);
    expect(p2.registerEvent).toHaveBeenCalledTimes(1);
  });

  it("registers each event exactly once per on* call", () => {
    const p = makePlugin();
    const w = new ObsidianFileSystemWatcher(p as unknown as Plugin);
    w.onCreate(async () => undefined);
    w.onChange(async () => undefined);
    w.onDelete(async () => undefined);
    w.onRename(async () => undefined);
    expect(p.registerEvent).toHaveBeenCalledTimes(4);
    expect(p.app.vault.on).toHaveBeenCalledWith("create", expect.any(Function));
    expect(p.app.vault.on).toHaveBeenCalledWith("delete", expect.any(Function));
    expect(p.app.vault.on).toHaveBeenCalledWith("rename", expect.any(Function));
    expect(p.app.metadataCache.on).toHaveBeenCalledWith("changed", expect.any(Function));
  });

  it("reload N times = exactly N×K registrations on the live plugin only", () => {
    // K = 4 (one per on* method); each cycle uses a fresh plugin to
    // simulate Obsidian disposing the previous one.
    const cycles = 5;
    const plugins: MockPlugin[] = [];
    for (let i = 0; i < cycles; i++) {
      const p = makePlugin();
      plugins.push(p);
      const w = new ObsidianFileSystemWatcher(p as unknown as Plugin);
      w.onCreate(async () => undefined);
      w.onChange(async () => undefined);
      w.onDelete(async () => undefined);
      w.onRename(async () => undefined);
    }
    for (const p of plugins) {
      expect(p.registerEvent).toHaveBeenCalledTimes(4);
    }
  });
});
