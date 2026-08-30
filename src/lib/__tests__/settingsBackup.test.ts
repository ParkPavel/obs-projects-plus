/**
 * #145 — the dashboard migrations rewrite stored configuration on open, with
 * no undo, so the pre-migration shape is written next to `data.json` once.
 *
 * What can regress: capturing an already-migrated shape (a second backup for
 * the same view), letting a failed write block the migration, or assuming the
 * vault's config folder is `.obsidian`.
 */
import type { App } from "obsidian";

import { countMigrationBackups, writeMigrationBackup } from "src/lib/settingsBackup";

// Deliberately not the default config folder: the vault's config directory is
// user-configurable, and the backup must follow `Vault#configDir`.
const CONFIG_DIR = "my-config";
const DIR = `${CONFIG_DIR}/plugins/obs-projects-plus`;

function fakeApp(files: Record<string, string>, failWrite = false): App {
  return {
    vault: {
      configDir: CONFIG_DIR,
      adapter: {
        list: async (path: string) => {
          if (path !== DIR) throw new Error("ENOENT");
          return { files: Object.keys(files), folders: [] };
        },
        exists: async (path: string) => path in files,
        read: async (path: string) => {
          const content = files[path];
          if (content === undefined) throw new Error("ENOENT");
          return content;
        },
        write: async (path: string, content: string) => {
          if (failWrite) throw new Error("EROFS: read-only file system");
          files[path] = content;
        },
      },
    },
  } as unknown as App;
}

const CONFIG = { widgets: [{ id: "w1", transform: { steps: ["filter", "pivot"] } }] };

describe("#145 migration backup", () => {
  it("writes the pre-migration config handed to it, not the file on disk", async () => {
    // The point of taking it from memory: `data.json` may already hold the
    // migrated shape by the time this write lands, because the migrated save is
    // synchronous and this is not.
    const files: Record<string, string> = { [`${DIR}/data.json`]: '{"already":"migrated"}' };
    const app = fakeApp(files);

    const path = await writeMigrationBackup({
      app,
      projectId: "p1",
      viewId: "v1",
      config: CONFIG,
    });

    expect(path).toMatch(/migration-backup-p1-v1-.*\.json$/);
    const written = JSON.parse(files[path!]!);
    expect(written.config).toEqual(CONFIG);
    expect(written.projectId).toBe("p1");
    expect(written.viewId).toBe("v1");
  });

  it("takes one backup per migration event, never overwriting an earlier one", async () => {
    // Live run in the OBStests vault, 2026-08-28: the first version wrote at
    // most one file per view, so a second legacy pipeline migrated into the same
    // view lost its pre-state entirely. Each event has its own.
    const files: Record<string, string> = {};
    const app = fakeApp(files);

    const first = await writeMigrationBackup({
      app,
      projectId: "p1",
      viewId: "v1",
      config: CONFIG,
    });
    const second = await writeMigrationBackup({
      app,
      projectId: "p1",
      viewId: "v1",
      config: { widgets: [] },
    });

    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    // The first file still holds the first event's pre-state, untouched.
    expect(JSON.parse(files[first!]!).config).toEqual(CONFIG);
    expect(JSON.parse(files[second!]!).config).toEqual({ widgets: [] });
    expect(Object.keys(files)).toHaveLength(2);
  });

  it("keeps views independent — another view still gets its own backup", async () => {
    const files: Record<string, string> = {};
    const app = fakeApp(files);

    await writeMigrationBackup({ app, projectId: "p1", viewId: "v1", config: CONFIG });
    const other = await writeMigrationBackup({
      app,
      projectId: "p1",
      viewId: "v2",
      config: CONFIG,
    });

    expect(other).not.toBeNull();
    expect(Object.keys(files)).toHaveLength(2);
  });

  it("counts backups per view", async () => {
    const app = fakeApp({
      [`${DIR}/migration-backup-p1-v1-2026-01-01.json`]: "{}",
      [`${DIR}/migration-backup-p1-v1-2026-02-01.json`]: "{}",
    });

    expect(await countMigrationBackups(app, "p1", "v1")).toBe(2);
    expect(await countMigrationBackups(app, "p1", "v2")).toBe(0);
  });

  it("swallows a failed write so it can never block a migration", async () => {
    const app = fakeApp({}, true);
    await expect(
      writeMigrationBackup({ app, projectId: "p1", viewId: "v1", config: CONFIG })
    ).resolves.toBeNull();
  });
});

// Cross-model audit of the live run, 2026-08-28: a throwing `exists` used to
// escape the naming loop, so an adapter hiccup skipped the write entirely and
// the migration proceeded with no restore point at all.
describe("#145 an unreliable adapter must not cost the restore point", () => {
  it("still writes when exists() throws", async () => {
    const files: Record<string, string> = {};
    const app = {
      vault: {
        configDir: CONFIG_DIR,
        adapter: {
          list: async () => ({ files: Object.keys(files), folders: [] }),
          exists: async () => {
            throw new Error("EBUSY");
          },
          read: async () => "{}",
          write: async (path: string, content: string) => {
            files[path] = content;
          },
        },
      },
    } as unknown as App;

    const path = await writeMigrationBackup({
      app,
      projectId: "p1",
      viewId: "v1",
      config: CONFIG,
    });

    expect(path).not.toBeNull();
    expect(JSON.parse(files[path!]!).config).toEqual(CONFIG);
  });
});
