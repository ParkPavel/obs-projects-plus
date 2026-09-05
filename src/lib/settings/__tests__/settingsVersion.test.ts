import { versionOnDisk } from "src/lib/settings/settingsVersion";

describe("#185 — when the migration result is written back", () => {
  it("reports the old version so the migration is persisted", () => {
    expect(versionOnDisk({ version: 1, projects: [] }, 4)).toBe(1);
    expect(versionOnDisk({ version: 3 }, 4)).toBe(3);
  });

  it("does not rewrite a file that is already current", () => {
    expect(versionOnDisk({ version: 4, projects: [] }, 4)).toBeNull();
  });

  it("does not create a settings file for a vault that has none", () => {
    expect(versionOnDisk(null, 4)).toBeNull();
    expect(versionOnDisk(undefined, 4)).toBeNull();
  });

  it("ignores a payload that carries no usable version", () => {
    expect(versionOnDisk({ projects: [] }, 4)).toBeNull();
    expect(versionOnDisk({ version: "3" }, 4)).toBeNull();
    expect(versionOnDisk([{ version: 1 }], 4)).toBeNull();
    expect(versionOnDisk("nonsense", 4)).toBeNull();
  });
});
