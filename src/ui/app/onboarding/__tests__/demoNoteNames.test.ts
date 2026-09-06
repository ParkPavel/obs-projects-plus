import { createDemoProject } from "src/ui/app/onboarding/demoProject";

/**
 * #198 — every demo note must reach the disk.
 *
 * The name test next door pins the sanitiser; this one pins the SET. A demo
 * seed is edited by people writing prose, and the failure it caused was
 * invisible until a user read the console: the project registered fine and
 * simply had a note missing.
 */

const FORBIDDEN = ["*", '"', "\\", "<", ">", ":", "|", "?"];

function fakeVault(created: string[]): never {
  return {
    getAbstractFileByPath: () => null,
    createFolder: () => Promise.resolve(),
    create: (path: string) => {
      // The host's own rule, applied to the part after the folder.
      const name = path.slice(path.lastIndexOf("/") + 1);
      for (const bad of FORBIDDEN) {
        if (name.includes(bad)) {
          return Promise.reject(
            new Error(`File name cannot contain ${bad}: ${name}`)
          );
        }
      }
      created.push(path);
      return Promise.resolve({ path });
    },
  } as never;
}

describe("#198 — the demo set writes every note", () => {
  it("produces no filename the host would refuse", async () => {
    const created: string[] = [];
    const errors: unknown[] = [];
    const spy = jest
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        errors.push(args);
      });

    await createDemoProject(fakeVault(created));

    spy.mockRestore();

    expect(created.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    for (const path of created) {
      const name = path.slice(path.lastIndexOf("/") + 1);
      for (const bad of FORBIDDEN) {
        expect(name).not.toContain(bad);
      }
    }
  });
});
