import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, type ProjectDefinition } from "src/settings/settings";
import type { PackageManifest } from "../package";
import type { VaultPathEntry } from "../packageFilePlan";
import { previewPackageConfigPaths } from "../packageConfigPaths";
import { captureConfigPathChoices, type ConfigPathChoice } from "../packagePathBindings";

const beforeEncoder = window.TextEncoder;
beforeAll(() => Object.defineProperty(window, "TextEncoder", { value: TextEncoder, configurable: true }));
afterAll(() => Object.defineProperty(window, "TextEncoder", { value: beforeEncoder, configurable: true }));
const p: ProjectDefinition = { ...DEFAULT_PROJECT, id: "p", name: "P", templates: ["Missing/t.md"], dataSource: { kind: "folder", config: { path: "Work", recursive: true } } };
const manifest: PackageManifest = {
  format: "obs-projects-plus/package", schemaVersion: 1, settingsVersion: 4, rootProjectId: "p", createdAt: "2026-11-15T00:00:00.000Z",
  projects: [{ id: "p", name: "P", path: `Projects/${"a".repeat(64)}/Project.md`, baseRevision: "b".repeat(64), archived: false }], dependencies: [],
  selection: "configuration-and-explicit-files", dependencyCoverage: "known-runtime-references", files: [
    { path: `Projects/${"a".repeat(64)}/Project.md`, role: "project", bytes: 1, sha256: "c".repeat(64) },
    { path: "Files/Work/a.md", role: "note", sourcePath: "Work/a.md", bytes: 3, sha256: "d".repeat(64) },
  ],
};
const choice = (extra: Partial<ConfigPathChoice> = {}): ConfigPathChoice => ({ projectId: "p", location: ["templates", 0], root: "Imported", source: "Missing/t.md", kind: "file", target: "Local/t.md", origin: "existing", ...extra });
const existing: VaultPathEntry[] = [{ path: "Local/t.md", kind: "file" }, { path: "Existing/old.md", kind: "file" }];
const preview = (choices: readonly ConfigPathChoice[] = [], inventory = existing, root = "Imported") => previewPackageConfigPaths([p], manifest, root, inventory, "AppConfig", ["Copies"], choices);

test("explicit file/source/creation bindings update private proposals while scope decisions remain", () => {
  const before = JSON.stringify(p), r = preview([
    choice(), choice({ location: ["dataSource", "config", "path"], source: "Work", kind: "folder", target: "Existing" }),
    choice({ location: ["newNotesFolder"], source: "", kind: "folder", target: "Imported", origin: "planned" }),
  ]);
  expect(r.projects[0]!.project).toMatchObject({ templates: ["Local/t.md"], newNotesFolder: "Imported", dataSource: { config: { path: "Existing" } } });
  expect(r.issues.map(issue => issue.code)).toEqual(["scope-choice-required"]);
  expect(r.scopes[0]!.existingCandidates).toBe(1); expect(r.bindings.filter(option => option.mode === "explicit")).toHaveLength(3);
  expect(JSON.stringify(p)).toBe(before);
});

test("recipient same-name path is never an implicit binding; explicit same literal path can be selected", () => {
  const inventory: VaultPathEntry[] = [{ path: "Missing/t.md", kind: "file" }];
  expect(preview([], inventory).issues.map(issue => issue.code)).toContain("unbound-file");
  const r = preview([choice({ target: "Missing/t.md" })], inventory);
  expect(r.issues.map(issue => issue.code)).not.toContain("unbound-file");
  expect(r.bindings[0]).toMatchObject({ mode: "explicit", target: "Missing/t.md", defaultMode: "missing" });
  expect(preview([], inventory).issues.map(issue => issue.code)).toContain("unbound-file");
});

test("planned targets and root folders are available without creating them; origin changes are not accepted", () => {
  const r = preview([choice({ target: "Imported/Work/a.md", origin: "planned" })]);
  expect(r.projects[0]!.project.templates).toEqual(["Imported/Work/a.md"]);
  expect(r.targets).toContainEqual({ path: "Imported", kind: "folder", origin: "planned" });
  expect(preview([choice({ target: "Imported/Work/a.md", origin: "existing" })]).issues.map(issue => issue.code)).toContain("invalid-binding");
});

test("generated settings are never implicit or explicit note targets, and their file ancestors cannot become folders", () => {
  const config = `Imported/Project settings/${"a".repeat(64)}.json`;
  const r = preview([choice({ target: config, origin: "planned" })]);
  expect(r.targets.some(target => target.path === config)).toBe(false);
  expect(r.targets).toContainEqual({ path: "Imported/Project settings", kind: "folder", origin: "planned" });
  expect(r.issues.map(issue => issue.code)).toContain("invalid-binding");
  const withChild = preview([], [{ path: config + "/child.md", kind: "file" }]);
  expect(withChild.targets.some(target => target.path.startsWith(config))).toBe(false);
  const other = { ...p, templates: [`Project settings/${"a".repeat(64)}.json`] };
  expect(previewPackageConfigPaths([other], manifest, "Imported", [], "AppConfig", []).issues.map(issue => issue.code)).toContain("unbound-file");
});

test.each([
  ["AppConfig/plugins/data.json", "file"], ["Copies/Projects/x.md", "file"], ["Copies/Backups/x.md", "file"],
  ["Copies/Incoming/x.md", "file"], ["Copies/Packages/x.md", "file"], ["Copies/sync-index.json", "file"],
  [".hidden/x.md", "file"], ["Local", "folder"],
] as const)("cannot bind a file field to protected/wrong-kind target %s", (target, kind) => {
  const r = preview([choice({ target })], [{ path: target, kind }]);
  expect(r.issues.map(issue => issue.code)).toContain("invalid-binding");
});

test("case/NFC aliases in target ancestors exclude ambiguous targets even with unique final files", () => {
  const r = preview([choice()], [{ path: "Local/t.md", kind: "file" }, { path: "local/other.md", kind: "file" }]);
  expect(r.issues.map(issue => issue.code)).toContain("invalid-binding");
  expect(r.targets.some(target => target.path === "Local/t.md")).toBe(false);
  const unicode = preview([choice({ target: "Café/t.md" })], [{ path: "Café/t.md", kind: "file" }, { path: "Cafe\u0301/other.md", kind: "file" }]);
  expect(unicode.issues.map(issue => issue.code)).toContain("invalid-binding");
});

test("changed destination, missing target or wrong source never silently fall back to an automatic proposal", () => {
  for (const r of [preview([choice()], existing, "Other"), preview([choice()], []), preview([choice({ source: "old" })])]) {
    expect(r.issues.map(issue => issue.code)).toContain("invalid-binding");
    expect(r.projects[0]!.project.templates).toEqual(["Missing/t.md"]);
  }
});

test("known visited locations only: unused/prototype paths remain diagnostics and cannot patch arbitrary config", () => {
  const r = preview([choice({ location: ["__proto__", "polluted"] })]);
  expect(r.issues.map(issue => issue.code)).toContain("stale-binding");
  expect(r.projects[0]!.project).not.toHaveProperty("polluted"); expect({}).not.toHaveProperty("polluted");
});

test("bindings do not waive file copy conflicts, malformed settings, or unrelated scopes", () => {
  const r = preview([choice()], [...existing, { path: "Imported/Work/a.md", kind: "file" }]);
  expect(r.files.conflicts.map(conflict => conflict.code)).toContain("file-exists");
  expect(r.issues.map(issue => issue.code)).toContain("scope-choice-required");
  const malformed = { ...p, templates: [0] } as unknown as ProjectDefinition;
  const other = previewPackageConfigPaths([malformed], manifest, "Imported", existing, "AppConfig", [], [choice()]);
  expect(other.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(["invalid-shape", "stale-binding", "scope-choice-required"]));
});

test("empty creation-folder choice is explicit and inherited fallback survives reset", () => {
  const c = choice({ location: ["newNotesFolder"], source: "", kind: "folder", target: "Imported", origin: "planned" });
  expect(preview([c]).projects[0]!.project.newNotesFolder).toBe("Imported");
  expect(preview().projects[0]!.project.newNotesFolder).toBe("");
  expect(preview().bindings.find(option => option.purpose === "creation-folder")?.defaultMode).toBe("inherited");
});

test("captures immutable choices and rejects duplicates, unsupported fields and oversized inputs", () => {
  const input = { ...choice(), location: ["templates", 0] };
  const captured = captureConfigPathChoices([input]); input.target = "Changed.md"; input.location[0] = "changed";
  expect(captured[0]).toMatchObject({ target: "Local/t.md", location: ["templates", 0] });
  expect(Object.isFrozen(captured)).toBe(true); expect(Object.isFrozen(captured[0]!.location)).toBe(true);
  expect(() => captureConfigPathChoices([choice(), choice()])).toThrow("duplicate");
  expect(() => captureConfigPathChoices([{ ...choice(), extra: true } as ConfigPathChoice])).toThrow("invalid");
  expect(() => captureConfigPathChoices(Array.from({ length: 4097 }, () => choice()))).toThrow("invalid");
  const many = Array.from({ length: 1600 }, (_, index) => choice({ projectId: "p".repeat(512), location: ["templates", index], source: "s".repeat(240), target: "t".repeat(240), root: "r".repeat(240) }));
  expect(() => captureConfigPathChoices(many)).toThrow("too large");
});

test.each([
  { kind: "scope" }, { origin: "other" }, { location: [] }, { location: ["x", -1] }, { source: 5 }, { target: "" }, { projectId: "" },
])("rejects malformed choice %j", invalid => {
  expect(() => captureConfigPathChoices([{ ...choice(), ...invalid } as unknown as ConfigPathChoice])).toThrow("invalid");
});
