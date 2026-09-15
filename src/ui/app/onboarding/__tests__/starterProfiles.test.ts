/**
 * scene 7 — «Интуитивный первый опыт».
 *
 * Pins the generator's contract, not the exact folder/field vocabulary of any
 * one profile: exactly two views, no relations/rollups/additional sources,
 * the template registered as BOTH a template and an excluded note, the
 * mandatory write-before-addProject order (a failed write must never leave a
 * registered project pointing at a folder that was never fully written), and
 * that a taken root gets a suffix rather than being reused or overwritten.
 */

import {
  createStarterProfile,
  STARTER_PROFILE_IDS,
  StarterProfileWriteError,
  type StarterProfileVault,
} from "src/ui/app/onboarding/starterProfiles";
import type { ProjectDefinition } from "src/settings/settings";

/**
 * A minimal in-memory vault: `getAbstractFileByPath` answers from a `Set` of
 * paths that "exist", `createFolder`/`create` add to it and refuse to
 * overwrite anything already present — the same refusal the real
 * `obsidian.Vault` makes, which is what "never touches an existing file"
 * relies on.
 */
function createFakeVault(seed: string[] = []): {
  vault: StarterProfileVault;
  existing: Set<string>;
  createdFolders: string[];
  createdFiles: Map<string, string>;
} {
  const existing = new Set<string>(seed);
  const createdFolders: string[] = [];
  const createdFiles = new Map<string, string>();

  const vault: StarterProfileVault = {
    getAbstractFileByPath: (path: string) =>
      (existing.has(path) ? ({ path } as never) : null),
    createFolder: async (path: string) => {
      if (existing.has(path)) throw new Error(`Folder already exists: ${path}`);
      existing.add(path);
      createdFolders.push(path);
      return { path } as never;
    },
    create: async (path: string, data: string) => {
      if (existing.has(path)) throw new Error(`File already exists: ${path}`);
      existing.add(path);
      createdFiles.set(path, data);
      return { path } as never;
    },
  };

  return { vault, existing, createdFolders, createdFiles };
}

describe("starterProfiles — three descriptors", () => {
  it.each(STARTER_PROFILE_IDS)("%s produces a project with exactly two views and no relations", async (id) => {
    const { vault } = createFakeVault();
    const addProject = jest.fn();

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
    const { vault } = createFakeVault();
    const addProject = jest.fn();

    const project = await createStarterProfile(id, { vault, addProject });

    expect(project.templates).toHaveLength(1);
    const templatePath = project.templates[0]!;
    expect(project.excludedNotes).toContain(templatePath);
    // The template lives inside the project's own folder, not at the root.
    expect(templatePath).toMatch(/^Projects Plus — Профили\/.+\/Шаблон.+\.md$/);
  });

  it.each(STARTER_PROFILE_IDS)("%s's Обзор dashboard counts with field \"*\" and count_total", async (id) => {
    const { vault } = createFakeVault();
    const addProject = jest.fn();

    const project = await createStarterProfile(id, { vault, addProject });
    const overview = project.views[0]!;
    const config = overview.config as { widgets: Array<{ type: string; config: unknown }> };
    const statsWidget = config.widgets.find((w) => w.type === "stats");
    const cards = (statsWidget?.config as { cards: Array<{ field: string; aggregation: string }> }).cards;

    expect(cards).toHaveLength(1);
    expect(cards[0]!.field).toBe("*");
    expect(cards[0]!.aggregation).toBe("count_total");

    const tableWidget = config.widgets.find((w) => w.type === "database-call");
    expect(tableWidget).toBeDefined();
  });
});

describe("starterProfiles — write-before-addProject order", () => {
  it("does not call addProject when the template write fails, and the error carries its path", async () => {
    const { vault } = createFakeVault();
    const originalCreate = vault.create.bind(vault);
    const failingVault: StarterProfileVault = {
      ...vault,
      create: () => Promise.reject(new Error("disk full")),
    };
    const addProject = jest.fn();

    await expect(createStarterProfile("clients", { vault: failingVault, addProject })).rejects.toBeInstanceOf(
      StarterProfileWriteError
    );
    expect(addProject).not.toHaveBeenCalled();

    // Sanity: the failure is specifically the template create call, not a
    // vault that never worked at all.
    await expect(originalCreate("Projects Plus — Профили/Клиенты/x.md", "")).resolves.toBeDefined();
  });

  it("names the failed path on the thrown error", async () => {
    const { vault } = createFakeVault();
    const failingVault: StarterProfileVault = {
      ...vault,
      create: () => Promise.reject(new Error("disk full")),
    };
    const addProject = jest.fn();

    try {
      await createStarterProfile("clients", { vault: failingVault, addProject });
      throw new Error("expected createStarterProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(StarterProfileWriteError);
      expect((error as StarterProfileWriteError).path).toBe(
        "Projects Plus — Профили/Клиенты/Шаблон — клиент.md"
      );
    }
  });

  it("does not register the project when the folder write fails either", async () => {
    const { vault } = createFakeVault();
    const failingVault: StarterProfileVault = {
      ...vault,
      createFolder: () => Promise.reject(new Error("permission denied")),
    };
    const addProject = jest.fn();

    await expect(createStarterProfile("workouts", { vault: failingVault, addProject })).rejects.toBeInstanceOf(
      StarterProfileWriteError
    );
    expect(addProject).not.toHaveBeenCalled();
  });
});

describe("starterProfiles — root collision", () => {
  it("suffixes the root when something unrelated already occupies it, and never touches it", async () => {
    const { vault, createdFolders, createdFiles } = createFakeVault(["Projects Plus — Профили"]);
    const addProject = jest.fn();

    const project = await createStarterProfile("clients", { vault, addProject });

    expect(createdFolders).not.toContain("Projects Plus — Профили");
    expect(createdFolders).toContain("Projects Plus — Профили 2");
    expect(createdFolders).toContain("Projects Plus — Профили 2/Клиенты");
    expect([...createdFiles.keys()]).toEqual(["Projects Plus — Профили 2/Клиенты/Шаблон — клиент.md"]);

    expect((project.dataSource as { config: { path: string } }).config.path).toBe(
      "Projects Plus — Профили 2/Клиенты"
    );
  });

  it("picks the next free suffix when both the base root and \"2\" are taken", async () => {
    const { vault } = createFakeVault([
      "Projects Plus — Профили",
      "Projects Plus — Профили 2",
    ]);
    const addProject = jest.fn();

    const project = await createStarterProfile("workouts", { vault, addProject });

    expect((project.dataSource as { config: { path: string } }).config.path).toBe(
      "Projects Plus — Профили 3/Тренировки"
    );
  });
});

describe("starterProfiles — re-run safety", () => {
  it("creates a suffixed copy on a second run instead of reusing the first", async () => {
    const { vault } = createFakeVault();
    const addProject = jest.fn();

    const first: ProjectDefinition = await createStarterProfile("project-journal", { vault, addProject });
    const second: ProjectDefinition = await createStarterProfile("project-journal", { vault, addProject });

    const firstPath = (first.dataSource as { config: { path: string } }).config.path;
    const secondPath = (second.dataSource as { config: { path: string } }).config.path;

    expect(firstPath).toBe("Projects Plus — Профили/Дневник проекта");
    expect(secondPath).toBe("Projects Plus — Профили 2/Дневник проекта");
    expect(addProject).toHaveBeenCalledTimes(2);
  });
});
