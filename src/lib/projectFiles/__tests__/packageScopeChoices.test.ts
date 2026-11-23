import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, type ProjectDefinition } from "src/settings/settings";
import type { PackageManifest } from "../package";
import { previewPackageConfigPaths } from "../packageConfigPaths";
import { capturePackageScopeChoices, reviewPackageScopes, scopeRuleDisplayable, type PackageScopeChoice } from "../packageScopeChoices";

const oldCrypto = window.crypto, oldEncoder = window.TextEncoder;
beforeAll(() => { Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true }); Object.defineProperty(window, "TextEncoder", { value: TextEncoder, configurable: true }); });
afterAll(() => { Object.defineProperty(window, "crypto", { value: oldCrypto, configurable: true }); Object.defineProperty(window, "TextEncoder", { value: oldEncoder, configurable: true }); });
const basis = "f".repeat(64);
const p: ProjectDefinition = { ...DEFAULT_PROJECT, id: "p", name: "P", dataSource: { kind: "folder", config: { path: "Work", recursive: true } } };
const manifest: PackageManifest = {
  format: "obs-projects-plus/package", schemaVersion: 1, settingsVersion: 4, rootProjectId: "p", createdAt: "2026-11-15T00:00:00.000Z",
  projects: [{ id: "p", name: "P", path: `Projects/${"a".repeat(64)}/Project.md`, baseRevision: "b".repeat(64), archived: false }], dependencies: [],
  selection: "configuration-and-explicit-files", dependencyCoverage: "known-runtime-references", files: [
    { path: `Projects/${"a".repeat(64)}/Project.md`, role: "project", bytes: 1, sha256: "c".repeat(64) },
    { path: "Files/Work/a.md", role: "note", sourcePath: "Work/a.md", bytes: 3, sha256: "d".repeat(64) },
  ],
};
const preview = (project = p) => previewPackageConfigPaths([project], manifest, "Imported", [], "AppConfig", ["Copies"]);
const choiceFor = (row: Awaited<ReturnType<typeof reviewPackageScopes>>['rows'][number]): PackageScopeChoice => ({ projectId: row.projectId, location: row.location, revision: row.revision, mode: "keep-rule" });

test("confirmation resolves only its own scope issue and preserves config bytes, archive flag and independent errors", async () => {
  const config = preview({ ...p, templates: ["Missing.md"] }), before = JSON.stringify(config);
  const first = await reviewPackageScopes(config, basis);
  expect(first.rows[0]).toMatchObject({ status: "pending", kind: "folder", value: "Imported/Work", recursive: true, existingCandidates: 0 });
  const result = await reviewPackageScopes(config, basis, [choiceFor(first.rows[0]!)]);
  expect(result.rows[0]!.status).toBe("confirmed"); expect(result.issues.map(issue => issue.code)).toEqual(["unbound-file"]);
  expect(JSON.stringify(config)).toBe(before);
  expect((await reviewPackageScopes(config, basis)).rows[0]!.status).toBe("pending");
});

test.each(["folder", "tag", "dataview", "native-query"] as const)("%s source requires explicit confirmation even with no calculated candidates", async kind => {
  const dataSource = kind === "folder" ? p.dataSource : kind === "tag" ? { kind, config: { tag: "work", hierarchy: true } } : kind === "dataview" ? { kind, config: { query: 'TABLE name FROM #work\nWHERE done = false' } } : { kind, config: { from: { kind: "tag", tag: "work", hierarchy: false } } };
  const config = preview({ ...p, dataSource } as ProjectDefinition), initial = await reviewPackageScopes(config, basis);
  const result = await reviewPackageScopes(config, basis, [choiceFor(initial.rows[0]!)]);
  expect(result.rows[0]!.status).toBe("confirmed"); expect(result.issues.map(issue => issue.code)).not.toContain("scope-choice-required");
  if (kind !== "folder") { expect(result.rows[0]!.existingCandidates).toBeNull(); expect(result.issues.map(issue => issue.code)).toContain("creation-folder-choice-required"); }
});

test.each(["basis", "project", "recursive", "archive"])("a changed %s invalidates old intent", async change => {
  const config = preview(), first = await reviewPackageScopes(config, basis), choice = choiceFor(first.rows[0]!);
  const next = change === "project" ? preview({ ...p, defaultName: "Changed" }) : change === "recursive" ? preview({ ...p, dataSource: { kind: "folder", config: { path: "Work", recursive: false } } }) : change === "archive" ? { ...config, projects: config.projects.map(item => ({ ...item, archived: true })) } : config;
  const result = await reviewPackageScopes(next, change === "basis" ? "e".repeat(64) : basis, [choice]);
  expect(result.rows[0]!.status).toBe("invalid"); expect(result.issues.map(issue => issue.code)).toContain("invalid-scope-choice"); expect(result.issues.map(issue => issue.code)).toContain("scope-choice-required");
});

test("active sources require independent confirmation; unused inline JSON adds no scope", async () => {
  const config = preview({ ...p, additionalSources: [{ kind: "tag", config: { tag: "extra", hierarchy: false } }], views: [{ id: "v", name: "Board", type: "dashboard", filter: { conditions: [], operator: "and" }, config: { widgets: [{ type: "database-call", title: "Inline", config: { sourceConfig: { kind: "tag", config: { tag: "inline", hierarchy: true } } } }] } }] } as unknown as ProjectDefinition);
  const first = await reviewPackageScopes(config, basis), result = await reviewPackageScopes(config, basis, [choiceFor(first.rows[0]!)]);
  expect(result.rows.map(row => row.status)).toEqual(["confirmed", "pending"]);
  expect(result.issues.filter(issue => issue.code === "scope-choice-required")).toHaveLength(1);
  expect(config.projects[0]!.project.views[0]!.config['widgets']).toEqual([{ type: "database-call", title: "Inline", config: { sourceConfig: { kind: "tag", config: { tag: "inline", hierarchy: true } } } }]);
});

test("malformed and unbound sources remain blocked even with a matching revision", async () => {
  for (const dataSource of [{ kind: "folder", config: { path: "Missing", recursive: true } }, { kind: "tag", config: { tag: "work", hierarchy: "bad" } }]) {
    const config = preview({ ...p, dataSource } as unknown as ProjectDefinition), first = await reviewPackageScopes(config, basis);
    const result = await reviewPackageScopes(config, basis, [choiceFor(first.rows[0]!)]);
    expect(result.rows[0]).toMatchObject({ status: "blocked", blockedReason: "source-issues" });
    expect(result.issues.map(issue => issue.code)).toContain("scope-choice-required"); expect(result.issues.map(issue => issue.code)).toContain("invalid-scope-choice");
  }
});

test("unknown source fields are stale choices and cannot address arbitrary JSON locations", async () => {
  const config = preview(), before = JSON.stringify(config), result = await reviewPackageScopes(config, basis, [{ projectId: "p", location: ["__proto__", "x"], revision: basis, mode: "keep-rule" }]);
  expect(result.rows[0]!.status).toBe("pending"); expect(result.issues.map(issue => issue.code)).toContain("stale-scope-choice"); expect(JSON.stringify(config)).toBe(before);
});

test("long or overly multiline rules are never confirmed from a truncated UI preview", async () => {
  for (const query of ["q".repeat(8193), "q\n".repeat(129)]) {
    const config = preview({ ...p, dataSource: { kind: "dataview", config: { query } } }), first = await reviewPackageScopes(config, basis);
    const result = await reviewPackageScopes(config, basis, [choiceFor(first.rows[0]!)]);
    expect(result.rows[0]).toMatchObject({ status: "blocked", blockedReason: "long-rule" });
    expect(result.issues.map(issue => issue.code)).toContain("scope-choice-required");
  }
  expect(scopeRuleDisplayable("q".repeat(8192))).toBe(true);
});

test("capture is immutable, rejects duplicate/unknown/malformed input and enforces byte/count bounds", () => {
  const mutable = { projectId: "p", location: ["dataSource", "config"], revision: basis, mode: "keep-rule" as const }, captured = capturePackageScopeChoices([mutable]);
  mutable.location[0] = "changed"; mutable.revision = "e".repeat(64); expect(captured[0]).toMatchObject({ location: ["dataSource", "config"], revision: basis });
  expect(Object.isFrozen(captured[0]!.location)).toBe(true);
  expect(() => capturePackageScopeChoices([captured[0]!, captured[0]!])).toThrow("duplicate");
  for (const patch of [{ mode: "accept-all" }, { location: [] }, { location: [-1] }, { revision: "bad" }, { extra: true }]) expect(() => capturePackageScopeChoices([{ ...captured[0], ...patch } as PackageScopeChoice])).toThrow();
  expect(() => capturePackageScopeChoices(Array.from({ length: 4097 }, () => captured[0]!))).toThrow();
  expect(() => capturePackageScopeChoices(Array.from({ length: 4096 }, (_, i) => ({ ...captured[0]!, projectId: "p".repeat(512), location: [i, ...Array(15).fill("x".repeat(100))] })))).toThrow("too large");
});

test("retired reviews cannot return a successful result after an async hash", async () => {
  let checks = 0;
  await expect(reviewPackageScopes(preview(), basis, [], () => { if (++checks > 1) throw Error("retired"); })).rejects.toThrow("retired");
});

test("metadata and choices cannot change across the async digest boundary", async () => {
  const config = preview(), mutableScopes = config.scopes.map(row => ({ ...row, location: [...row.location] }));
  const mutable = { ...config, scopes: mutableScopes }, pending = reviewPackageScopes(mutable, basis);
  mutableScopes[0]!.value = "Changed"; mutableScopes[0]!.location[0] = "other";
  expect((await pending).rows[0]).toMatchObject({ value: "Imported/Work", location: ["dataSource", "config"] });
});

test("oversized scope metadata or issue growth refuses a preview rather than dropping diagnostics", async () => {
  const config = preview(), first = await reviewPackageScopes(config, basis), choice = choiceFor(first.rows[0]!);
  await expect(reviewPackageScopes({ ...config, scopes: Array(4097).fill(config.scopes[0]) }, basis)).rejects.toThrow("too large");
  const full = { ...config, issues: Array.from({ length: 4096 }, () => ({ projectId: "other", location: ["templates"], code: "unbound-file" as const })) };
  await expect(reviewPackageScopes(full, basis, [{ ...choice, revision: "e".repeat(64) }])).rejects.toThrow("too many");
});
