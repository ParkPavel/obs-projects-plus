import type { PackageManifest } from "../package";
import { planPackageFiles, type VaultPathEntry } from "../packageFilePlan";

const manifest = (sources = ["Work/Note.md", "Assets/photo.png"]): PackageManifest => ({
  format: "obs-projects-plus/package", schemaVersion: 1, settingsVersion: 4, rootProjectId: "p", createdAt: "2026-11-15T00:00:00.000Z",
  projects: [{ id: "p", name: "P", path: `Projects/${"a".repeat(64)}/Project.md`, baseRevision: "b".repeat(64), archived: false }], dependencies: [],
  selection: "configuration-and-explicit-files", dependencyCoverage: "known-runtime-references",
  files: [{ path: `Projects/${"a".repeat(64)}/Project.md`, role: "project", bytes: 1, sha256: "c".repeat(64) },
    ...sources.map(sourcePath => ({ path: "Files/" + sourcePath, sourcePath, role: /\.md$/i.test(sourcePath) ? "note" as const : "attachment" as const, bytes: 3, sha256: "d".repeat(64) }))],
});
const plan = (existing: VaultPathEntry[] = [], sources?: string[], root = "Import/Client", copies: string[] = []) =>
  planPackageFiles(manifest(sources), root, existing, "AppConfig", copies);

test("preserves selected subtrees and metadata, with exact file/folder lookups and no project payload extraction", () => {
  const input = manifest(), before = JSON.stringify(input), r = planPackageFiles(input, "Import/Client", [], "AppConfig", []);
  expect(r.stage).toBe("file-preview"); expect(r.conflicts).toEqual([]); expect(r.notesNeedInspection).toBe(true);
  expect(r.files).toEqual([
    { entry: "Files/Work/Note.md", source: "Work/Note.md", destination: "Import/Client/Work/Note.md", role: "note", bytes: 3, sha256: "d".repeat(64) },
    { entry: "Files/Assets/photo.png", source: "Assets/photo.png", destination: "Import/Client/Assets/photo.png", role: "attachment", bytes: 3, sha256: "d".repeat(64) },
  ]);
  expect(r.fileDestination("Work/Note.md")).toBe("Import/Client/Work/Note.md");
  expect(r.folderDestination("Work")).toBe("Import/Client/Work"); expect(r.folderDestination("")).toBe("Import/Client");
  expect(r.folders).toEqual(["Import", "Import/Client", "Import/Client/Assets", "Import/Client/Work"]);
  expect(JSON.stringify(input)).toBe(before);
});

test("same-name notes in different source folders remain distinct and prefixes cannot leak", () => {
  const r = plan([], ["Work/a.md", "Workish/a.md"]);
  expect(r.fileDestination("Work/a.md")).not.toBe(r.fileDestination("Workish/a.md"));
  for (const source of ["work/a.md", "a.md", "Work/a", "Work/a.md/other"]) expect(() => r.fileDestination(source)).toThrow("unbound");
  for (const folder of ["Wor", "work", "Missing"]) expect(() => r.folderDestination(folder)).toThrow("unbound");
});

test.each(["file", "folder"] as const)("existing %s at target blocks placement, never authorizes overwrite", kind => {
  const r = plan([{ path: "Import/Client/Work/Note.md", kind }]);
  expect(r.conflicts).toContainEqual({ code: kind === "file" ? "file-exists" : "folder-exists", destination: "Import/Client/Work/Note.md", existing: "Import/Client/Work/Note.md" });
});

test("a file at a required ancestor is reported; exact existing folders are reusable", () => {
  expect(plan([{ path: "Import", kind: "folder" }, { path: "Import/Client", kind: "folder" }]).conflicts).toEqual([]);
  expect(plan([{ path: "Import/Client", kind: "file" }]).conflicts).toEqual([{ code: "parent-file", destination: "Import/Client", existing: "Import/Client" }]);
});

test("case aliases and Unicode-normalized aliases are reported for files AND inferred parent folders", () => {
  const r = plan([{ path: "import/Client/Other.md", kind: "file" }, { path: "Import/Client/Cafe\u0301.md", kind: "file" }], ["Café.md"]);
  expect(r.conflicts).toContainEqual({ code: "path-alias", destination: "Import", existing: "import" });
  expect(r.conflicts).toContainEqual({ code: "path-alias", destination: "Import/Client", existing: "import/Client" });
  expect(r.conflicts).toContainEqual({ code: "path-alias", destination: "Import/Client/Café.md", existing: "Import/Client/Cafe\u0301.md" });
});

test("infers existing folder from its children even without explicit folder inventory", () => {
  const r = plan([{ path: "Import/Client/Assets/photo.png/deeper.md", kind: "file" }]);
  expect(r.conflicts).toContainEqual({ code: "folder-exists", destination: "Import/Client/Assets/photo.png", existing: "Import/Client/Assets/photo.png" });
});

test("inconsistent inventory cannot silently turn a file into an ancestor folder", () => {
  expect(() => plan([{ path: "Elsewhere", kind: "file" }, { path: "Elsewhere/child.md", kind: "file" }])).toThrow("inconsistent");
  expect(() => plan([{ path: "Elsewhere/child.md", kind: "file" }, { path: "Elsewhere", kind: "file" }])).toThrow("inconsistent");
});

test.each(["", "/tmp", "../outside", "A/../B", "A\\B", " App", "AppConfig", "AppConfig/plugins", "A%2fB", "A/CON"])("rejects unsafe/config destination %s", root => {
  expect(() => plan([], undefined, root)).toThrow();
});

test.each(["Projects", "BACKUPS", "Incoming", "Packages", "sync-index.json"])("reserves copy namespace %s across current/history roots", namespace => {
  expect(() => plan([], undefined, `History/${namespace}`, ["Copies", "History"])).toThrow("reserved");
  expect(() => plan([], [`${namespace}/x.md`], "History", ["History"])).toThrow("reserved");
});

test("copy namespace checks use Unicode/case aliases and prevent files taking the copy root or its ancestor", () => {
  expect(() => plan([], undefined, "Cafe\u0301/Incoming", ["Café"])).toThrow("reserved");
  expect(() => plan([], ["Copies"], "Import", ["Import/Copies"])).toThrow("reserved");
  expect(() => plan([], ["Copies"], "Import", ["Import/Copies/Nested"])).toThrow("reserved");
  expect(plan([], undefined, "Copies/Imported", ["Copies"]).conflicts).toEqual([]);
});

test("rejects portable conflicts already inside manifest and overlong combined destination paths", () => {
  expect(() => plan([], ["a.md", "A.md"])).toThrow();
  expect(() => plan([], ["a", "a/b.md"])).toThrow();
  expect(() => plan([], ["x".repeat(230) + ".md"])).toThrow();
});

test("configuration-only preview and attachment-only preview do not claim note inspection", () => {
  const empty = plan([], []);
  expect(empty.files).toEqual([]); expect(empty.notesNeedInspection).toBe(false);
  expect(() => empty.folderDestination("")).toThrow("unbound");
  expect(plan([], ["image.png"]).notesNeedInspection).toBe(false);
});

test("captures immutable metadata detached from later source or inventory edits", () => {
  const m = manifest(), existing: VaultPathEntry[] = [{ path: "Import/Client/Work/Note.md", kind: "file" }];
  const r = planPackageFiles(m, "Import/Client", existing, "AppConfig", []);
  m.files[1]!.sourcePath = "Changed.md"; existing.splice(0);
  expect(r.fileDestination("Work/Note.md")).toBe("Import/Client/Work/Note.md"); expect(r.conflicts).toHaveLength(1);
  expect(Object.isFrozen(r)).toBe(true); expect(Object.isFrozen(r.files)).toBe(true); expect(Object.isFrozen(r.folders)).toBe(true);
  expect(r.files.every(Object.isFrozen)).toBe(true); expect(r.conflicts.every(Object.isFrozen)).toBe(true);
});

test("bounds inventory count, implied parents and duplicate path input volume", () => {
  expect(() => plan(Array.from({ length: 100001 }, () => ({ path: "a", kind: "file" })))).toThrow("too large");
  expect(() => plan(Array.from({ length: 50001 }, (_, i) => ({ path: `d${i}/x.md`, kind: "file" })))).toThrow("too large");
  expect(() => plan(Array.from({ length: 4097 }, () => ({ path: "x".repeat(4096), kind: "file" })))).toThrow("too large");
});

test("root folder entry, duplicates and unrelated legacy names do not invent conflicts", () => {
  const r = plan([{ path: "", kind: "folder" }, { path: "Import", kind: "folder" }, { path: "Import", kind: "folder" }, { path: ".private/legacy.md", kind: "file" }]);
  expect(r.conflicts).toEqual([]);
});
