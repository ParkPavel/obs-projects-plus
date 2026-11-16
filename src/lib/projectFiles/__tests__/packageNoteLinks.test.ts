import { TextEncoder } from "node:util";
type CachedMetadata = import("obsidian").CachedMetadata;
type LinkCache = import("obsidian").LinkCache;
jest.mock("yaml", () => {
  const nodePath = require("node:path");
  return jest.requireActual(nodePath.join(nodePath.dirname(require.resolve("yaml/package.json")), "dist", "index.js"));
});
import { DEFAULT_PROJECT } from "src/settings/settings";
type PackageManifest = import("../package").PackageManifest;
import { previewPackageConfigPaths } from "../packageConfigPaths";
import { previewPackageNoteLinks } from "../packageNoteLinks";
type ConfigPathChoice = import("../packagePathBindings").ConfigPathChoice;

const saved = window.TextEncoder;
beforeAll(() => Object.defineProperty(window, "TextEncoder", { value: TextEncoder, configurable: true }));
afterAll(() => Object.defineProperty(window, "TextEncoder", { value: saved, configurable: true }));
const project = { ...DEFAULT_PROJECT, id: "p", name: "P", dataSource: { kind: "folder" as const, config: { path: "Work", recursive: true } } };
const manifest: PackageManifest = { format: "obs-projects-plus/package", schemaVersion: 1, settingsVersion: 4, rootProjectId: "p", createdAt: "2026-11-16T00:00:00.000Z", projects: [{ id: "p", name: "P", path: `Projects/${"a".repeat(64)}/Project.md`, baseRevision: "b".repeat(64), archived: false }], dependencies: [], selection: "configuration-and-explicit-files", dependencyCoverage: "known-runtime-references", files: [
  { path: `Projects/${"a".repeat(64)}/Project.md`, role: "project", bytes: 1, sha256: "c".repeat(64) },
  ...["Work/Note.md", "Work/A.md", "Assets/image.png"].map(sourcePath => ({ path: "Files/" + sourcePath, sourcePath, role: sourcePath.endsWith(".md") ? "note" as const : "attachment" as const, bytes: 1, sha256: "d".repeat(64) })),
] };
function ref(text: string, original: string, link: string): LinkCache {
  const from = text.indexOf(original);
  return { original, link, position: { start: { offset: from, line: 0, col: from }, end: { offset: from + original.length, line: 0, col: from + original.length } } };
}
function run(text: string, cache: CachedMetadata, choices: ConfigPathChoice[] = []) {
  const inventory = [{ path: "Local/A.md", kind: "file" as const }], config = previewPackageConfigPaths([project], manifest, "Imported", inventory, "AppConfig", []);
  const notes = new Map([["Work/Note.md", { text, cache }], ["Work/A.md", { text: "", cache: {} }]]);
  return previewPackageNoteLinks(config, manifest, notes, choices, inventory, "AppConfig", []);
}
const choice = (source: string, target = "Imported/Work/A.md", origin: "planned" | "existing" = "planned"): ConfigPathChoice => ({ projectId: "p", root: "Imported", location: ["packageFiles", 0, "links", 0], source, target, origin, kind: "file" });
const output = (r: ReturnType<typeof run>) => Buffer.from(r.content.get("Imported/Work/Note.md")!).toString("utf8");

test("wiki ambiguity requires intent, then preserves alias, heading and code that native syntax did not identify", () => {
  const text = 'See [[A#Heading|Alias]], [label](A.md "Title") and `[[A]]`.', cache = { links: [ref(text, "[[A#Heading|Alias]]", "A#Heading"), ref(text, '[label](A.md "Title")', "A.md")] };
  expect(run(text, cache).issues.some(issue => issue.code === "unbound-file")).toBe(true);
  const r = run(text, cache, [choice("A#Heading")]);
  expect(r.issues).toEqual([]);
  expect(output(r)).toBe('See [[Imported/Work/A.md#Heading|Alias]], [label](A.md "Title") and `[[A]]`.');
});

test("relative attachments map exactly and explicit recipient paths preserve Markdown title and fragment", () => {
  const text = '![picture](../Assets/image.png) [label](Missing.md#Block "Keep title")';
  const cache = { embeds: [ref(text, "![picture](../Assets/image.png)", "../Assets/image.png")], links: [ref(text, '[label](Missing.md#Block "Keep title")', "Missing.md#Block")] };
  // Cache links are visited before embeds, so the missing destination is decision0.
  const r = run(text, cache, [choice("Missing.md#Block", "Local/A.md", "existing")]);
  expect(r.issues).toEqual([]); expect(output(r)).toBe('![picture](../Assets/image.png) [label](../../Local/A.md#Block "Keep title")');
});

test("external and same-note heading links are retained without recipient resolution", () => {
  const text = "[web](https://example.com) [[#Heading]]";
  const r = run(text, { links: [ref(text, "[web](https://example.com)", "https://example.com"), ref(text, "[[#Heading]]", "#Heading")] });
  expect(r.issues).toEqual([]); expect(output(r)).toBe(text); expect(r.bindings).toEqual([]);
});

test("stale native positions refuse output instead of editing a similar occurrence", () => {
  const text = "[[A]]", cache = { links: [{ ...ref(text, text, "A"), original: "[[B]]" }] };
  const r = run(text, cache); expect(r.issues.some(issue => issue.code === "unsupported-note-link")).toBe(true); expect(r.content.has("Imported/Work/Note.md")).toBe(false);
});

test("reference definitions are rewritten once while reference usage is retained", () => {
  const text = '[label][id]\n\n[id]: A.md "Title"', definition = ref(text, '[id]: A.md "Title"', "A.md");
  const r = run(text, { links: [ref(text, "[label][id]", "A.md")], referenceLinks: [{ id: "id", link: "A.md", position: definition.position }] });
  expect(r.issues).toEqual([]); expect(output(r)).toBe(text);
});

test("native frontmatter references are rewritten as scalar edits while comments and unrelated properties stay exact", () => {
  const text = '---\nrelated: "[[A]]" # keep\nother: unchanged\n---\nBody';
  const end = text.indexOf("---", 4) + 3;
  const r = run(text, { frontmatterPosition: { start: { line: 0, col: 0, offset: 0 }, end: { line: 4, col: 3, offset: end } }, frontmatterLinks: [{ key: "related", original: "[[A]]", link: "A" }] }, [choice("A")]);
  expect(r.issues).toEqual([]);
  expect(output(r)).toBe('---\nrelated: "[[Imported/Work/A.md]]" # keep\nother: unchanged\n---\nBody');
});
