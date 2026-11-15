import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, type ProjectDefinition } from "src/settings/settings";
import type { PackageManifest } from "../package";
import type { VaultPathEntry } from "../packageFilePlan";
import { previewPackageConfigPaths } from "../packageConfigPaths";

const previousEncoder = window.TextEncoder;
beforeAll(() => Object.defineProperty(window, "TextEncoder", { value: TextEncoder, configurable: true }));
afterAll(() => Object.defineProperty(window, "TextEncoder", { value: previousEncoder, configurable: true }));
const project = (extra: Record<string, unknown> = {}): ProjectDefinition => ({ ...DEFAULT_PROJECT, id: "p", name: "P", dataSource: { kind: "folder", config: { path: "Work", recursive: true } }, ...extra }) as ProjectDefinition;
const manifest = (projects: ProjectDefinition[], paths: string[]): PackageManifest => ({
  format: "obs-projects-plus/package", schemaVersion: 1, settingsVersion: 4, rootProjectId: projects[0]!.id, createdAt: "2026-11-15T00:00:00.000Z",
  projects: projects.map((p, i) => ({ id: p.id, name: p.name, path: `Projects/${String(i + 1).repeat(64)}/Project.md`, baseRevision: "a".repeat(64), archived: i > 0 })),
  files: [...projects.map((_, i) => ({ path: `Projects/${String(i + 1).repeat(64)}/Project.md`, role: "project" as const, bytes: 1, sha256: "b".repeat(64) })),
    ...paths.map(sourcePath => ({ path: "Files/" + sourcePath, sourcePath, role: /\.md$/i.test(sourcePath) ? "note" as const : "attachment" as const, bytes: 3, sha256: "c".repeat(64) }))],
  dependencies: [], selection: "configuration-and-explicit-files", dependencyCoverage: "known-runtime-references",
});
const preview = (p = project(), paths = ["Work/a.md", "Templates/t.md", "Assets/cover.png"], existing: VaultPathEntry[] = []) =>
  previewPackageConfigPaths([p], manifest([p], paths), "Imported", existing, "AppConfig", []);

test("binds exact template/exclusion/source/creation paths in a private copy and retains opaque state", () => {
  const p = project({ templates: ["Templates/t.md"], excludedNotes: ["Work/a.md"], newNotesFolder: "Work", uniqueIdCounter: 42, isDefault: true,
    extra: { link: "[[Work/a#heading|alias]]", expression: "Work" } });
  const before = JSON.stringify(p), r = preview(p), copy = r.projects[0]!.project;
  expect(r.stage).toBe("configuration-path-preview"); expect(r.projects[0]!.archived).toBe(false);
  expect(copy).toMatchObject({ id: "p", templates: ["Imported/Templates/t.md"], excludedNotes: ["Imported/Work/a.md"], newNotesFolder: "Imported/Work", uniqueIdCounter: 42, isDefault: true, extra: { link: "[[Work/a#heading|alias]]", expression: "Work" } });
  expect(copy.dataSource.config).toMatchObject({ path: "Imported/Work", recursive: true });
  expect(r.changes.map(change => change.location)).toEqual([["templates", 0], ["excludedNotes", 0], ["dataSource", "config", "path"], ["newNotesFolder"]]);
  expect(r.issues.map(issue => issue.code)).toEqual(["scope-choice-required"]);
  expect(JSON.stringify(p)).toBe(before);
});

test("retains empty creation fallback for primary folder and native-folder sources", () => {
  const folder = preview().projects[0]!.project;
  expect(folder.newNotesFolder).toBe(""); expect(folder.dataSource.config).toMatchObject({ path: "Imported/Work" });
  const r = preview(project({ dataSource: { kind: "native-query", config: { from: { kind: "folder", path: "Work", recursive: false }, where: { text: "Work" }, limit: 10 } } }));
  expect(r.projects[0]!.project.newNotesFolder).toBe("");
  expect(r.projects[0]!.project.dataSource.config).toEqual({ from: { kind: "folder", path: "Imported/Work", recursive: false }, where: { text: "Work" }, limit: 10 });
  expect(r.issues.map(issue => issue.code)).toEqual(["scope-choice-required"]);
});

test.each(["", "/"])("root folder spelling %j binds to import root without inventing individual files", path => {
  const r = preview(project({ dataSource: { kind: "folder", config: { path, recursive: true } } }));
  expect(r.projects[0]!.project.dataSource.config).toMatchObject({ path: "Imported" });
});

test("tag/native-tag/query definitions remain unchanged and require explicit scope and creation-folder choices", () => {
  for (const dataSource of [
    { kind: "tag", config: { tag: "#task", hierarchy: true } },
    { kind: "native-query", config: { from: { kind: "tag", tag: "#task", hierarchy: false }, where: { field: "task" } } },
    { kind: "dataview", config: { query: 'TABLE task FROM "Work"', filter: "task" } },
  ]) {
    const r = preview(project({ dataSource }));
    expect(r.projects[0]!.project.dataSource).toEqual(dataSource);
    expect(r.issues.map(issue => issue.code)).toEqual(["scope-choice-required", "creation-folder-choice-required"]);
    expect(r.scopes[0]!.existingCandidates).toBeNull();
  }
});

test("candidate counts are explicitly an upper bound before exclusions/filters and respect recursive scope", () => {
  const existing: VaultPathEntry[] = ["Imported/Work/old.md", "Imported/Work/a.md", "Imported/Work/sub/next.md", "Imported/Workish/no.md", "Imported/Work/photo.png"].map(path => ({ path, kind: "file" }));
  for (const recursive of [false, true]) {
    const r = preview(project({ excludedNotes: ["Work/a.md"], dataSource: { kind: "folder", config: { path: "Work", recursive } } }), undefined, existing);
    expect(r.scopes[0]!.existingCandidates).toBe(recursive ? 3 : 2);
    expect(r.issues.map(issue => issue.code)).toContain("scope-choice-required");
  }
});

test("unselected templates/exclusions/folders do not bind to recipient names or basename matches", () => {
  const r = preview(project({ templates: ["t.md"], excludedNotes: ["Missing/a.md"], newNotesFolder: "Missing", dataSource: { kind: "folder", config: { path: "Wor", recursive: true } } }), undefined,
    [{ path: "t.md", kind: "file" }, { path: "Missing/a.md", kind: "file" }]);
  expect(r.issues.map(issue => issue.code)).toEqual(["unbound-file", "unbound-file", "unbound-folder", "scope-choice-required", "unbound-folder"]);
  expect(r.projects[0]!.project.templates).toEqual(["t.md"]);
  expect(r.scopes[0]!.existingCandidates).toBeNull();
});

test("configuration-only package needs explicit folder bindings and preserves archive state", () => {
  const a = project(), b = project({ id: "q", name: "Q" });
  const r = previewPackageConfigPaths([b, a], manifest([a, b], []), "Imported", [], "AppConfig", []);
  expect(r.projects.map(item => [item.project.id, item.archived])).toEqual([["p", false], ["q", true]]);
  expect(r.issues.filter(issue => issue.code === "unbound-folder")).toHaveLength(2);
});

test("maps active cover/record paths but retains unused inline sources, external URLs and unrelated text", () => {
  const p = project({ views: [{ id: "v", name: "V", type: "dashboard", config: { widgets: [
    { id: "cover", type: "cover-banner", config: { src: "Assets/cover.png", overlay: "Work/a.md" } },
    { id: "external", type: "cover-banner", config: { src: "https://example.com/cover.png" } },
    { id: "sub", type: "sub-base-canvas", config: { inverseTargetId: "Work/a.md", fields: ["Work/a.md"] } },
    { id: "db", type: "database-call", config: { sourceConfig: { kind: "folder", config: { path: "Work", recursive: false } } } },
  ] } }] });
  const r = preview(p), widgets = r.projects[0]!.project.views[0]!.config['widgets'] as { config: Record<string, unknown> }[];
  expect(widgets[0]!.config).toEqual({ src: "Imported/Assets/cover.png", overlay: "Work/a.md" });
  expect(widgets[1]!.config['src']).toBe("https://example.com/cover.png");
  expect(widgets[2]!.config).toEqual({ inverseTargetId: "Imported/Work/a.md", fields: ["Work/a.md"] });
  expect(widgets[3]!.config['sourceConfig']).toEqual({ kind: "folder", config: { path: "Work", recursive: false } });
  expect(r.scopes.map(scope => scope.location)).toEqual([["dataSource", "config"]]);
});

test("unknown config types and invalid known paths get diagnostics rather than string coercion", () => {
  const r = preview(project({ templates: [7], dataSource: { kind: ["folder"], config: { path: "Work" } },
    views: [{ id: "v", name: "V", type: "dashboard", config: { widgets: [{ id: "w", type: "extension", config: { src: "Work/a.md" } }] } }] }));
  expect(r.issues.map(issue => issue.code)).toEqual(["invalid-shape", "unsupported-config", "creation-folder-choice-required", "unsupported-config"]);
});

test("empty optional image/record placeholders and an empty tag retain their meanings", () => {
  const p = project({ dataSource: { kind: "tag", config: { tag: "", hierarchy: false } }, views: [{ id: "v", name: "V", type: "dashboard", config: { widgets: [
    { id: "cover", type: "cover-banner", config: { src: "" } }, { id: "sub", type: "sub-base-canvas", config: { inverseTargetId: "" } },
  ] } }] });
  const r = preview(p);
  expect(r.changes).toEqual([]);
  expect(r.issues.map(issue => issue.code)).toEqual(["scope-choice-required", "creation-folder-choice-required"]);
  expect(r.projects[0]!.project.views).toEqual(p.views);
});

test("rejects project coverage/identity mismatch instead of applying metadata to the wrong config", () => {
  const p = project(), m = manifest([p], []);
  expect(() => previewPackageConfigPaths([], m, "Imported", [], "AppConfig", [])).toThrow("coverage");
  expect(() => previewPackageConfigPaths([project({ name: "other" })], m, "Imported", [], "AppConfig", [])).toThrow("coverage");
});

test("bounds decisions and expanded configuration bytes; refusal preserves original", () => {
  expect(() => preview(project({ templates: Array(4097).fill("Work/a.md") }))).toThrow("too many configuration path decisions");
  const p = project({ templates: Array(3000).fill("a.md"), extra: "x".repeat(1800000), dataSource: { kind: "folder", config: { path: "", recursive: true } } });
  const before = JSON.stringify(p);
  expect(() => previewPackageConfigPaths([p], manifest([p], ["a.md"]), "R".repeat(120), [], "AppConfig", [])).toThrow("too large");
  expect(JSON.stringify(p)).toBe(before);
});

test("bounds structural visits even when views have no path fields", () => {
  const p = project({ views: Array.from({ length: 17000 }, (_, i) => ({ id: String(i), name: "V", type: "board", config: {} })) });
  expect(() => preview(p)).toThrow("too complex");
});

test("candidate scan budget returns unknown rather than a partial or guessed count", () => {
  const sources = Array.from({ length: 101 }, (_, i) => ({ kind: "folder", config: { path: `F${i}`, recursive: true } }));
  const p = project({ dataSource: sources[0], additionalSources: sources.slice(1) });
  const paths = sources.map(source => source.config.path + "/new.md");
  const existing: VaultPathEntry[] = Array.from({ length: 10000 }, (_, i) => ({ path: `Imported/F0/old${i}.md`, kind: "file" }));
  const r = preview(p, paths, existing);
  expect(r.scopes[0]!.existingCandidates).toBe(10000); expect(r.scopes[99]!.existingCandidates).toBe(0);
  expect(r.scopes[100]!.existingCandidates).toBeNull();
});
