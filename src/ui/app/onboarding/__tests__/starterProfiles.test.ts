/**
 * scene 7 — «Интуитивный первый опыт».
 *
 * Pins the generator's contract, not the exact folder/field vocabulary of any
 * one profile: exactly two views, no relations/rollups/additional sources,
 * the template registered as BOTH a template and an excluded note, the
 * mandatory write-before-addProject order (root folder → profile subfolder →
 * template → addProject, in that order), a failure at any step rolling back
 * exactly what THIS run created (never anything older or unrelated), and the
 * root-reuse / subfolder-suffix rules a re-run of the same profile relies on.
 */

import { TFile, TFolder } from "obsidian";

import {
  createStarterProfile,
  STARTER_PROFILE_IDS,
  StarterProfileRegistrationError,
  StarterProfileWriteError,
  type StarterProfileVault,
} from "src/ui/app/onboarding/starterProfiles";
import type { ProjectDefinition } from "src/settings/settings";

type SeedEntry = string | { path: string; kind: "file" | "folder" };

interface RecordedCall {
  readonly op: "createFolder" | "create" | "delete" | "addProject";
  readonly path: string;
}

/**
 * A minimal in-memory vault built on the SAME `TFolder`/`TFile` classes the
 * real `obsidian.Vault` returns from `getAbstractFileByPath`, so the
 * source's `instanceof TFolder` checks (root reuse, "is this folder still
 * empty" during rollback) see the same shape they would against a real
 * vault. `createFolder`/`create` refuse to overwrite anything already
 * present — the same refusal the real `obsidian.Vault` makes. `delete`
 * removes an entry and drops it from its parent's `children`, mirroring
 * what a real folder delete does to its parent's listing.
 */
// The jest mock of `obsidian` gives TFolder/TFile a path constructor; the real
// declarations tsc checks against have none. These two keep that difference in
// one place instead of casting at every call.
type TAbstractFile = import("obsidian").TAbstractFile;
const makeFolder = (path: string): TFolder => new (TFolder as unknown as new (p: string) => TFolder)(path);
const makeFile = (path: string): TFile => new (TFile as unknown as new (p: string) => TFile)(path);

function createFakeVault(seed: SeedEntry[] = []): {
  vault: StarterProfileVault;
  calls: RecordedCall[];
  entries: Map<string, TFolder | TFile>;
} {
  const entries = new Map<string, TFolder | TFile>();
  const calls: RecordedCall[] = [];
  // The vault's own root, real `Vault.getRoot()` returns a `TFolder` whose
  // `children` are exactly the top-level entries — used both to seed
  // top-level content below and to exercise case-only root collisions.
  const root = makeFolder("");

  const parentOf = (path: string): TFolder | undefined => {
    const idx = path.lastIndexOf("/");
    if (idx < 0) return root;
    const parent = entries.get(path.slice(0, idx));
    return parent instanceof TFolder ? parent : undefined;
  };

  for (const raw of seed) {
    const entry = typeof raw === "string" ? { path: raw, kind: "folder" as const } : raw;
    const node = entry.kind === "folder" ? makeFolder(entry.path) : makeFile(entry.path);
    entries.set(entry.path, node);
  }
  // Wire seeded children into seeded parents (or the vault root, for
  // top-level entries) so a pre-existing folder with pre-existing content
  // reports non-empty via `children`, and so root-level case collisions are
  // visible through `getRoot().children`.
  for (const node of entries.values()) {
    const parent = parentOf(node.path);
    if (parent) parent.children.push(node);
  }

  const vault: StarterProfileVault = {
    getAbstractFileByPath: (path: string) => entries.get(path) ?? null,
    getRoot: () => root,
    createFolder: async (path: string) => {
      if (entries.has(path)) throw new Error(`Folder already exists: ${path}`);
      const folder = makeFolder(path);
      entries.set(path, folder);
      parentOf(path)?.children.push(folder);
      calls.push({ op: "createFolder", path });
      return folder as never;
    },
    create: async (path: string, _data: string) => {
      if (entries.has(path)) throw new Error(`File already exists: ${path}`);
      const file = makeFile(path);
      entries.set(path, file);
      parentOf(path)?.children.push(file);
      calls.push({ op: "create", path });
      return file as never;
    },
    delete: async (file: TAbstractFile) => {
      if (!entries.has(file.path)) throw new Error(`Not found: ${file.path}`);
      entries.delete(file.path);
      const parent = parentOf(file.path);
      if (parent) parent.children = parent.children.filter((c) => c.path !== file.path);
      calls.push({ op: "delete", path: file.path });
    },
  };

  return { vault, calls, entries };
}

function trackedAddProject(calls: RecordedCall[]) {
  return jest.fn((project: ProjectDefinition) => {
    calls.push({ op: "addProject", path: project.name });
  });
}

describe("starterProfiles — three descriptors", () => {
  it.each(STARTER_PROFILE_IDS)("%s produces a project with exactly two views and no relations", async (id) => {
    const { vault, calls } = createFakeVault();
    const addProject = trackedAddProject(calls);

    const project = await createStarterProfile(id, { vault, addProject });

    expect(project.views).toHaveLength(2);
    expect(project.views[0]!.name).toBe("Обзор");
    expect(project.views[0]!.type).toBe("dashboard");
    expect(["board", "calendar"]).toContain(project.views[1]!.type);

    expect(project.additionalSources).toBeUndefined();
    for (const fieldConfig of Object.values(project.fieldConfig)) {
      expect(fieldConfig.relation).toBeUndefined();
      expect(fieldConfig.rollup).toBeUndefined();
    }

    expect(addProject).toHaveBeenCalledTimes(1);
    expect(addProject).toHaveBeenCalledWith(project);
  });

  it.each(STARTER_PROFILE_IDS)("%s registers its template as BOTH a template and an excluded note", async (id) => {
    const { vault, calls } = createFakeVault();
    const addProject = trackedAddProject(calls);

    const project = await createStarterProfile(id, { vault, addProject });

    expect(project.templates).toHaveLength(1);
    const templatePath = project.templates[0]!;
    expect(project.excludedNotes).toContain(templatePath);
    // The template lives inside the project's own folder, not at the root.
    expect(templatePath).toMatch(/^Projects Plus — Профили\/.+\/Шаблон.+\.md$/);
  });

  it.each(STARTER_PROFILE_IDS)("%s's Обзор dashboard counts with field \"*\" and count_total", async (id) => {
    const { vault, calls } = createFakeVault();
    const addProject = trackedAddProject(calls);

    const project = await createStarterProfile(id, { vault, addProject });
    const overview = project.views[0]!;
    const config = overview.config as { widgets: Array<{ type: string; title: string; config: unknown }> };
    const statsWidget = config.widgets.find((w) => w.type === "stats");
    const cards = (statsWidget?.config as { cards: Array<{ field: string; aggregation: string }> }).cards;

    expect(cards).toHaveLength(1);
    expect(cards[0]!.field).toBe("*");
    expect(cards[0]!.aggregation).toBe("count_total");

    const tableWidget = config.widgets.find((w) => w.type === "database-call");
    expect(tableWidget).toBeDefined();
  });

  it.each(STARTER_PROFILE_IDS)("%s's Обзор table tab is labelled in Russian, not \"Table\"", async (id) => {
    const { vault, calls } = createFakeVault();
    const addProject = trackedAddProject(calls);

    const project = await createStarterProfile(id, { vault, addProject });
    const overview = project.views[0]!;
    const config = overview.config as { widgets: Array<{ type: string; config: Record<string, unknown> }> };
    const tableWidget = config.widgets.find((w) => w.type === "database-call")!;
    const viewTabs = tableWidget.config["viewTabs"] as Array<{ label: string }>;

    expect(viewTabs).toHaveLength(1);
    expect(viewTabs[0]!.label).toBe("Таблица");
  });
});

describe("starterProfiles — write order", () => {
  it("writes root folder, then profile subfolder, then template, then registers the project — in that order", async () => {
    const { vault, calls } = createFakeVault();
    const addProject = trackedAddProject(calls);

    await createStarterProfile("clients", { vault, addProject });

    expect(calls.map((c) => c.op)).toEqual(["createFolder", "createFolder", "create", "addProject"]);
    expect(calls[0]!.path).toBe("Projects Plus — Профили");
    expect(calls[1]!.path).toBe("Projects Plus — Профили/Клиенты");
    expect(calls[2]!.path).toBe("Projects Plus — Профили/Клиенты/Шаблон — клиент.md");
  });

  it("does not create the root folder again when it already exists as a folder", async () => {
    const { vault, calls } = createFakeVault(["Projects Plus — Профили"]);
    const addProject = trackedAddProject(calls);

    await createStarterProfile("clients", { vault, addProject });

    expect(calls.map((c) => c.op)).toEqual(["createFolder", "create", "addProject"]);
    expect(calls[0]!.path).toBe("Projects Plus — Профили/Клиенты");
  });
});

describe("starterProfiles — rollback on write failure", () => {
  it("rolls back nothing and reports no leftovers when the FIRST write (root folder) fails", async () => {
    const { vault, calls } = createFakeVault();
    const failingVault: StarterProfileVault = {
      ...vault,
      createFolder: () => Promise.reject(new Error("permission denied")),
    };
    const addProject = trackedAddProject(calls);

    try {
      await createStarterProfile("clients", { vault: failingVault, addProject });
      throw new Error("expected createStarterProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(StarterProfileWriteError);
      const writeError = error as StarterProfileWriteError;
      expect(writeError.path).toBe("Projects Plus — Профили");
      expect(writeError.leftovers).toEqual([]);
    }
    expect(addProject).not.toHaveBeenCalled();
  });

  it("removes the just-created root when the profile subfolder write fails, leaving no leftovers", async () => {
    const { vault, calls, entries } = createFakeVault();
    let subfolderCallCount = 0;
    const failingVault: StarterProfileVault = {
      ...vault,
      createFolder: (path: string) => {
        subfolderCallCount++;
        if (subfolderCallCount === 2) return Promise.reject(new Error("permission denied"));
        return vault.createFolder(path);
      },
    };
    const addProject = trackedAddProject(calls);

    try {
      await createStarterProfile("clients", { vault: failingVault, addProject });
      throw new Error("expected createStarterProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(StarterProfileWriteError);
      const writeError = error as StarterProfileWriteError;
      expect(writeError.path).toBe("Projects Plus — Профили/Клиенты");
      expect(writeError.leftovers).toEqual([]);
    }
    expect(addProject).not.toHaveBeenCalled();
    // The root this run created was removed again — nothing left behind.
    expect(entries.has("Projects Plus — Профили")).toBe(false);
    expect(calls.map((c) => c.op)).toEqual(["createFolder", "delete"]);
  });

  it("removes both folders when the template write fails, leaving no leftovers", async () => {
    const { vault, calls, entries } = createFakeVault();
    const originalCreate = vault.create.bind(vault);
    const failingVault: StarterProfileVault = {
      ...vault,
      create: () => Promise.reject(new Error("disk full")),
    };
    const addProject = trackedAddProject(calls);

    try {
      await createStarterProfile("clients", { vault: failingVault, addProject });
      throw new Error("expected createStarterProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(StarterProfileWriteError);
      const writeError = error as StarterProfileWriteError;
      expect(writeError.path).toBe("Projects Plus — Профили/Клиенты/Шаблон — клиент.md");
      expect(writeError.leftovers).toEqual([]);
    }
    expect(addProject).not.toHaveBeenCalled();
    expect(entries.has("Projects Plus — Профили")).toBe(false);
    expect(entries.has("Projects Plus — Профили/Клиенты")).toBe(false);
    expect(calls.map((c) => c.op)).toEqual([
      "createFolder",
      "createFolder",
      "delete",
      "delete",
    ]);

    // Sanity: the failure is specifically the template create call, not a
    // vault that never worked at all.
    await expect(originalCreate("Projects Plus — Профили/Клиенты/x.md", "")).resolves.toBeDefined();
  });

  it("does not roll back a pre-existing root that was only reused, not created", async () => {
    const { vault, calls, entries } = createFakeVault(["Projects Plus — Профили"]);
    const failingVault: StarterProfileVault = {
      ...vault,
      create: () => Promise.reject(new Error("disk full")),
    };
    const addProject = trackedAddProject(calls);

    await expect(
      createStarterProfile("clients", { vault: failingVault, addProject })
    ).rejects.toBeInstanceOf(StarterProfileWriteError);

    // The pre-existing root survives; only this run's subfolder is rolled back.
    expect(entries.has("Projects Plus — Профили")).toBe(true);
    expect(entries.has("Projects Plus — Профили/Клиенты")).toBe(false);
    expect(calls.map((c) => c.op)).toEqual(["createFolder", "delete"]);
  });

  it("reports a leftover path, in creation order, when cleanup itself fails", async () => {
    const { vault, calls } = createFakeVault();
    const failingVault: StarterProfileVault = {
      ...vault,
      create: () => Promise.reject(new Error("disk full")),
      delete: (file: TAbstractFile) => {
        // The profile subfolder refuses to delete (e.g. something started
        // watching it); the root underneath it is therefore also left,
        // since it still contains that subfolder.
        if (file.path === "Projects Plus — Профили/Клиенты") {
          return Promise.reject(new Error("locked"));
        }
        return vault.delete(file);
      },
    };
    const addProject = trackedAddProject(calls);

    try {
      await createStarterProfile("clients", { vault: failingVault, addProject });
      throw new Error("expected createStarterProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(StarterProfileWriteError);
      const writeError = error as StarterProfileWriteError;
      expect(writeError.path).toBe("Projects Plus — Профили/Клиенты/Шаблон — клиент.md");
      // Both the subfolder (delete failed) and the root (still contains it)
      // are reported, in the order they were created.
      expect(writeError.leftovers).toEqual([
        "Projects Plus — Профили",
        "Projects Plus — Профили/Клиенты",
      ]);
    }
    expect(addProject).not.toHaveBeenCalled();
  });

  it("reports a leftover path when a created folder is no longer empty at cleanup time", async () => {
    const { vault, calls, entries } = createFakeVault();
    const failingVault: StarterProfileVault = {
      ...vault,
      create: async (path: string, data: string) => {
        if (path === "Projects Plus — Профили/Клиенты/Шаблон — клиент.md") {
          // Something else wrote into the freshly created subfolder before
          // this run's own template write failed.
          await vault.create("Projects Plus — Профили/Клиенты/чужой файл.md", "");
          throw new Error("disk full");
        }
        return vault.create(path, data);
      },
    };
    const addProject = trackedAddProject(calls);

    try {
      await createStarterProfile("clients", { vault: failingVault, addProject });
      throw new Error("expected createStarterProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(StarterProfileWriteError);
      const writeError = error as StarterProfileWriteError;
      expect(writeError.leftovers).toEqual([
        "Projects Plus — Профили",
        "Projects Plus — Профили/Клиенты",
      ]);
    }
    // The unrelated file that showed up is never touched by cleanup.
    expect(entries.has("Projects Plus — Профили/Клиенты/чужой файл.md")).toBe(true);
  });

  it("reports a root folder materialized by a rejecting createFolder instead of deleting it", async () => {
    const { vault, calls, entries } = createFakeVault();
    const failingVault: StarterProfileVault = {
      ...vault,
      createFolder: async (path: string) => {
        // An adapter that writes the folder to disk and only fails on a
        // later, separate part of the same call (e.g. metadata) — the
        // folder is left behind on disk despite the rejection.
        await vault.createFolder(path);
        throw new Error("metadata write failed");
      },
    };
    const addProject = trackedAddProject(calls);

    try {
      await createStarterProfile("clients", { vault: failingVault, addProject });
      throw new Error("expected createStarterProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(StarterProfileWriteError);
      const writeError = error as StarterProfileWriteError;
      expect(writeError.path).toBe("Projects Plus — Профили");
      // It exists but cannot be attributed — the step returned no object —
      // so it is named rather than deleted.
      expect(writeError.leftovers).toEqual(["Projects Plus — Профили"]);
    }
    expect(entries.has("Projects Plus — Профили")).toBe(true);
    expect(calls.filter((c) => c.op === "delete")).toHaveLength(0);
    expect(addProject).not.toHaveBeenCalled();
  });

  it("reports a subfolder materialized by a rejecting createFolder, and keeps its root", async () => {
    const { vault, calls, entries } = createFakeVault();
    let call = 0;
    const failingVault: StarterProfileVault = {
      ...vault,
      createFolder: async (path: string) => {
        call++;
        if (call === 2) {
          await vault.createFolder(path);
          throw new Error("metadata write failed");
        }
        return vault.createFolder(path);
      },
    };
    const addProject = trackedAddProject(calls);

    try {
      await createStarterProfile("clients", { vault: failingVault, addProject });
      throw new Error("expected createStarterProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(StarterProfileWriteError);
      const writeError = error as StarterProfileWriteError;
      expect(writeError.path).toBe("Projects Plus — Профили/Клиенты");
      // The unattributable subfolder stops the unwinding, so the root this
      // run created stays with it — and both are named.
      expect(writeError.leftovers).toEqual([
        "Projects Plus — Профили",
        "Projects Plus — Профили/Клиенты",
      ]);
    }
    expect(entries.has("Projects Plus — Профили/Клиенты")).toBe(true);
    expect(entries.has("Projects Plus — Профили")).toBe(true);
    expect(calls.filter((c) => c.op === "delete")).toHaveLength(0);
    expect(addProject).not.toHaveBeenCalled();
  });

  it("reports a template materialized by a rejecting create, and keeps the folders under it", async () => {
    const { vault, calls, entries } = createFakeVault();
    const failingVault: StarterProfileVault = {
      ...vault,
      create: async (path: string, data: string) => {
        await vault.create(path, data);
        throw new Error("metadata write failed");
      },
    };
    const addProject = trackedAddProject(calls);

    try {
      await createStarterProfile("clients", { vault: failingVault, addProject });
      throw new Error("expected createStarterProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(StarterProfileWriteError);
      const writeError = error as StarterProfileWriteError;
      expect(writeError.path).toBe("Projects Plus — Профили/Клиенты/Шаблон — клиент.md");
      expect(writeError.leftovers).toEqual([
        "Projects Plus — Профили",
        "Projects Plus — Профили/Клиенты",
        "Projects Plus — Профили/Клиенты/Шаблон — клиент.md",
      ]);
    }
    expect(entries.has("Projects Plus — Профили/Клиенты/Шаблон — клиент.md")).toBe(true);
    expect(entries.has("Projects Plus — Профили/Клиенты")).toBe(true);
    expect(entries.has("Projects Plus — Профили")).toBe(true);
    expect(calls.filter((c) => c.op === "delete")).toHaveLength(0);
    expect(addProject).not.toHaveBeenCalled();
  });

  it("never deletes the rejecting step's own target, even replaced at the same path", async () => {
    // Review round 7's reproduction: the step materializes its target and
    // then rejects, and something else takes that path before cleanup runs.
    // The step returned no object, so nothing here can be attributed to this
    // run — and nothing may be deleted on the strength of a path alone.
    const { vault, calls, entries } = createFakeVault();
    const failingVault: StarterProfileVault = {
      ...vault,
      create: async (path: string, data: string) => {
        await vault.create(path, data);
        entries.delete(path);
        await vault.create(path, "somebody else's file");
        throw new Error("metadata write failed");
      },
    };
    const addProject = trackedAddProject(calls);

    try {
      await createStarterProfile("clients", { vault: failingVault, addProject });
      throw new Error("expected createStarterProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(StarterProfileWriteError);
      expect((error as StarterProfileWriteError).leftovers).toEqual([
        "Projects Plus — Профили",
        "Projects Plus — Профили/Клиенты",
        "Projects Plus — Профили/Клиенты/Шаблон — клиент.md",
      ]);
    }
    expect(entries.has("Projects Plus — Профили/Клиенты/Шаблон — клиент.md")).toBe(true);
    expect(calls.filter((c) => c.op === "delete")).toHaveLength(0);
    expect(addProject).not.toHaveBeenCalled();
  });

  it("does not delete a same-path replacement during cleanup, and reports it as a leftover instead", async () => {
    const { vault, calls, entries } = createFakeVault();
    const failingVault: StarterProfileVault = {
      ...vault,
      create: async () => {
        // Something else removed this run's own subfolder and put an
        // unrelated new folder at the exact same path before this run's
        // own template write itself fails.
        entries.delete("Projects Plus — Профили/Клиенты");
        entries.set("Projects Plus — Профили/Клиенты", makeFolder("Projects Plus — Профили/Клиенты"));
        throw new Error("disk full");
      },
    };
    const addProject = trackedAddProject(calls);

    try {
      await createStarterProfile("clients", { vault: failingVault, addProject });
      throw new Error("expected createStarterProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(StarterProfileWriteError);
      const writeError = error as StarterProfileWriteError;
      // The replacement is not this run's object — left alone and
      // reported, and the root (which still contains it) is left too.
      expect(writeError.leftovers).toEqual([
        "Projects Plus — Профили",
        "Projects Plus — Профили/Клиенты",
      ]);
    }
    // The replacement itself was never deleted by cleanup.
    expect(entries.get("Projects Plus — Профили/Клиенты")).toBeInstanceOf(TFolder);
    expect(
      calls.some((c) => c.op === "delete" && c.path === "Projects Plus — Профили/Клиенты")
    ).toBe(false);
  });
});

describe("starterProfiles — addProject failure", () => {
  it("rolls back every write and throws a registration-specific error when addProject throws", async () => {
    const { vault, calls, entries } = createFakeVault();
    const addProject = jest.fn(() => {
      throw new Error("settings write failed");
    });

    try {
      await createStarterProfile("clients", { vault, addProject });
      throw new Error("expected createStarterProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(StarterProfileRegistrationError);
      expect(error).not.toBeInstanceOf(StarterProfileWriteError);
      const registrationError = error as StarterProfileRegistrationError;
      expect(registrationError.leftovers).toEqual([]);
      // The message never claims a path failed to write — nothing did.
      expect(registrationError.message).not.toMatch(/Could not write/);
    }
    expect(addProject).toHaveBeenCalledTimes(1);
    expect(entries.has("Projects Plus — Профили")).toBe(false);
    expect(entries.has("Projects Plus — Профили/Клиенты")).toBe(false);
    expect(entries.has("Projects Plus — Профили/Клиенты/Шаблон — клиент.md")).toBe(false);
    expect(calls.filter((c) => c.op === "delete")).toHaveLength(3);
  });

  it("keeps this run's files when the project is registered, and still reports the failure", async () => {
    const { vault, calls, entries } = createFakeVault();
    // Svelte's writable assigns the new value and only then notifies
    // subscribers, so a subscriber that throws leaves the project IN
    // settings and still surfaces the exception here. Deleting the files
    // then would strip the folders off a project the user now has.
    const addProject = jest.fn(() => {
      throw new Error("a subscriber threw after the store was updated");
    });

    try {
      await createStarterProfile("clients", { vault, addProject, isProjectRegistered: () => true });
      throw new Error("expected createStarterProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(StarterProfileRegistrationError);
      const registrationError = error as StarterProfileRegistrationError;
      // The project is in the store's value, so the files stay — and they are
      // NOT reported as leftovers for the user to delete by hand.
      expect(registrationError.registered).toBe(true);
      expect(registrationError.leftovers).toEqual([]);
    }

    expect(entries.has("Projects Plus — Профили/Клиенты/Шаблон — клиент.md")).toBe(true);
    expect(calls.filter((c) => c.op === "delete")).toHaveLength(0);
  });
});

describe("starterProfiles — case-only collisions", () => {
  it("suffixes the root when a case-only variant already occupies the base name", async () => {
    const { vault, calls, entries } = createFakeVault([
      // Same name as ROOT_FOLDER_BASE modulo case — what a case-insensitive
      // Windows/macOS file system would already have on disk.
      "projects plus — профили",
    ]);
    const addProject = trackedAddProject(calls);

    const project = await createStarterProfile("clients", { vault, addProject });

    expect(calls[0]).toEqual({ op: "createFolder", path: "Projects Plus — Профили 2" });
    expect((project.dataSource as { config: { path: string } }).config.path).toBe(
      "Projects Plus — Профили 2/Клиенты"
    );
    // The case-variant is left untouched, and the exact-case base name is
    // never created (it would collide on disk).
    expect(entries.has("projects plus — профили")).toBe(true);
    expect(entries.has("Projects Plus — Профили")).toBe(false);
  });

  it("suffixes the subfolder when a case-only variant already occupies the plain subfolder name", async () => {
    const { vault, calls } = createFakeVault([
      "Projects Plus — Профили",
      "Projects Plus — Профили/клиенты",
    ]);
    const addProject = trackedAddProject(calls);

    const project = await createStarterProfile("clients", { vault, addProject });

    expect(calls.map((c) => c.op)).toEqual(["createFolder", "create", "addProject"]);
    expect(calls[0]!.path).toBe("Projects Plus — Профили/Клиенты 2");
    expect((project.dataSource as { config: { path: string } }).config.path).toBe(
      "Projects Plus — Профили/Клиенты 2"
    );
  });
});

describe("starterProfiles — root reuse and subfolder suffixing", () => {
  it("reuses an existing root FOLDER instead of suffixing past it", async () => {
    const { vault, calls, entries } = createFakeVault(["Projects Plus — Профили"]);
    const addProject = trackedAddProject(calls);

    const project = await createStarterProfile("clients", { vault, addProject });

    expect(calls.map((c) => c.op)).toEqual(["createFolder", "create", "addProject"]);
    expect(entries.has("Projects Plus — Профили 2")).toBe(false);
    expect((project.dataSource as { config: { path: string } }).config.path).toBe(
      "Projects Plus — Профили/Клиенты"
    );
  });

  it("suffixes the ROOT only when a FILE occupies the root path", async () => {
    const { vault, calls } = createFakeVault([{ path: "Projects Plus — Профили", kind: "file" }]);
    const addProject = trackedAddProject(calls);

    const project = await createStarterProfile("clients", { vault, addProject });

    expect(calls[0]).toEqual({ op: "createFolder", path: "Projects Plus — Профили 2" });
    expect((project.dataSource as { config: { path: string } }).config.path).toBe(
      "Projects Plus — Профили 2/Клиенты"
    );
  });

  it("picks the next free numbered root when the base and \"2\" are both files", async () => {
    const { vault, calls } = createFakeVault([
      { path: "Projects Plus — Профили", kind: "file" },
      { path: "Projects Plus — Профили 2", kind: "file" },
    ]);
    const addProject = trackedAddProject(calls);

    const project = await createStarterProfile("workouts", { vault, addProject });

    expect((project.dataSource as { config: { path: string } }).config.path).toBe(
      "Projects Plus — Профили 3/Тренировки"
    );
  });

  it("suffixes the SUBFOLDER, not the root, when the subfolder name is already taken", async () => {
    const { vault, calls } = createFakeVault([
      "Projects Plus — Профили",
      "Projects Plus — Профили/Клиенты",
    ]);
    const addProject = trackedAddProject(calls);

    const project = await createStarterProfile("clients", { vault, addProject });

    expect(calls.map((c) => c.op)).toEqual(["createFolder", "create", "addProject"]);
    expect(calls[0]!.path).toBe("Projects Plus — Профили/Клиенты 2");
    expect((project.dataSource as { config: { path: string } }).config.path).toBe(
      "Projects Plus — Профили/Клиенты 2"
    );
  });

  it("suffixes the subfolder when a FILE (not just a folder) already occupies that path", async () => {
    const { vault, calls } = createFakeVault([
      "Projects Plus — Профили",
      { path: "Projects Plus — Профили/Клиенты", kind: "file" },
    ]);
    const addProject = trackedAddProject(calls);

    const project = await createStarterProfile("clients", { vault, addProject });

    expect((project.dataSource as { config: { path: string } }).config.path).toBe(
      "Projects Plus — Профили/Клиенты 2"
    );
  });
});

describe("starterProfiles — re-run safety", () => {
  it("re-running the SAME profile reuses the shared root and suffixes the second subfolder", async () => {
    const { vault, calls } = createFakeVault();
    const addProject = trackedAddProject(calls);

    const first: ProjectDefinition = await createStarterProfile("project-journal", { vault, addProject });
    const second: ProjectDefinition = await createStarterProfile("project-journal", { vault, addProject });

    const firstPath = (first.dataSource as { config: { path: string } }).config.path;
    const secondPath = (second.dataSource as { config: { path: string } }).config.path;

    expect(firstPath).toBe("Projects Plus — Профили/Дневник проекта");
    expect(secondPath).toBe("Projects Plus — Профили/Дневник проекта 2");
    expect(addProject).toHaveBeenCalledTimes(2);
    // The root folder is created once and reused the second time.
    expect(calls.filter((c) => c.op === "createFolder" && c.path === "Projects Plus — Профили")).toHaveLength(1);
  });

  it("a second, DIFFERENT profile lands under the same shared root as the first", async () => {
    const { vault, calls } = createFakeVault();
    const addProject = trackedAddProject(calls);

    const clients = await createStarterProfile("clients", { vault, addProject });
    const workouts = await createStarterProfile("workouts", { vault, addProject });

    expect((clients.dataSource as { config: { path: string } }).config.path).toBe(
      "Projects Plus — Профили/Клиенты"
    );
    expect((workouts.dataSource as { config: { path: string } }).config.path).toBe(
      "Projects Plus — Профили/Тренировки"
    );
  });
});
