import { webcrypto } from "node:crypto";
import { TextEncoder, TextDecoder } from "node:util";
import { unzipSync } from "fflate";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS, type ProjectDefinition } from "src/settings/settings";
import { prepareProjectPackage, binaryDigest, PACKAGE_LIMITS } from "../package";
import { packageDependencies } from "../packageDependencies";
import { createProjectZip } from "../packageZip";
import { parseProjectDocument } from "../document";

const cryptoBefore = window.crypto, encoderBefore = window.TextEncoder;
beforeAll(() => {
  Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(window, "TextEncoder", { value: TextEncoder, configurable: true });
});
afterAll(() => {
  Object.defineProperty(window, "crypto", { value: cryptoBefore, configurable: true });
  Object.defineProperty(window, "TextEncoder", { value: encoderBefore, configurable: true });
});
const project = (id = "one"): ProjectDefinition => ({ ...DEFAULT_PROJECT, id, name: "Работа " + id, uniqueIdCounter: 31 });
const value = (projects = [project()], archives: ProjectDefinition[] = []) => ({ ...DEFAULT_SETTINGS, projects, archives });
const decoder = new TextDecoder();

test("typed graph includes archived dependencies, cycles and unresolved references without rewriting configuration", () => {
  const one = { ...project(), fieldConfig: { relation: { relation: { targetProjectId: "two::part" } }, missing: { rollup: { backlink: { projectId: "missing", relationField: "r" } } } } } as unknown as ProjectDefinition;
  const two = { ...project("two"), additionalSources: [{ id: "part", kind: "tag", config: { tag: "task", hierarchy: false } }], fieldConfig: { back: { relation: { targetProjectId: "one" } } } } as ProjectDefinition;
  const input = value([one], [two]);
  const graph = packageDependencies(input, "one");
  expect(graph.projects.map(item => [item.project.id, item.archived])).toEqual([["one", false], ["two", true]]);
  expect(graph.dependencies).toContainEqual({ from: "one", reference: "two::part", target: "two", resolved: true });
  expect(graph.dependencies).toContainEqual({ from: "one", reference: "missing", target: "missing", resolved: false });
  expect(one.fieldConfig['relation']?.relation?.targetProjectId).toBe("two::part");
});

test("block and chart/join dependencies retain full reference identities", () => {
  const view = (id: string, widgets: unknown[]) => ({ id, name: id, type: "dashboard", config: { widgets }, filter: { conditions: [] }, colors: { conditions: [] }, sort: { criteria: [] } });
  const one = { ...project(), views: [view("v1", [{ id: "chart", type: "chart", config: { dataProjectId: "two::block:v2:table", correlation: { rightSourceId: "gone" }, series: [{ dataProjectId: "two" }] }, transform: { steps: [{ type: "join", rightSourceId: "two" }] } }])] };
  const two = { ...project("two"), views: [view("v2", [{ id: "table", type: "database-call", config: {} }])] };
  const graph = packageDependencies(value([one, two]), "one");
  expect(graph.projects).toHaveLength(2);
  expect(graph.dependencies.find(item => item.reference === "two::block:v2:table")?.resolved).toBe(true);
  expect(graph.dependencies.find(item => item.reference === "gone")?.resolved).toBe(false);
});

test("configuration-only package excludes global preferences and preserves counters", async () => {
  const read = jest.fn();
  const prepared = await prepareProjectPackage(value(), "one", [], read, "AppConfig", "2026-11-14T00:00:00.000Z");
  const archive = await createProjectZip(prepared);
  const unpacked = unzipSync(archive);
  const config = parseProjectDocument(decoder.decode(unpacked[prepared.manifest.projects[0]!.path]));
  expect(config.project).toEqual(project());
  expect(config.project.uniqueIdCounter).toBe(31);
  expect(Object.keys(unpacked)).toHaveLength(2);
  expect(prepared.manifest).not.toHaveProperty("preferences");
  expect(read).not.toHaveBeenCalled();
  expect(await createProjectZip(prepared)).toEqual(archive);
});

test("selected Unicode notes and binary attachments have exact bytes and manifest hashes", async () => {
  const contents = new Map([["Заметки/Визит.md", new TextEncoder().encode("[[Клиент|имя]]#якорь\r\n![[фото.png]]")], ["Вложения/фото.png", new Uint8Array([0, 255, 1, 2, 0])]]);
  const prepared = await prepareProjectPackage(value(), "one", [...contents.keys()], async path => contents.get(path)!, "AppConfig");
  const archive = await createProjectZip(prepared), unpacked = unzipSync(archive);
  for (const [path, bytes] of contents) {
    expect(Array.from(unpacked["Files/" + path]!)).toEqual(Array.from(bytes));
    expect(prepared.manifest.files.find(file => file.sourcePath === path)?.sha256).toBe(await binaryDigest(bytes));
  }
  expect(JSON.parse(decoder.decode(unpacked['manifest.json']))).toEqual(prepared.manifest);
  contents.get("Вложения/фото.png")![0] = 13;
  expect(prepared.entries.get("Files/Вложения/фото.png")![0]).toBe(0);
});

test.each(["../note.md", "/note.md", "A/../note.md", "A\\note.md", ".hidden/data.json", "AppConfig/data.json", "A/CON", "A/trailing."])("unsafe selected path %s is rejected before reads", async path => {
  const read = jest.fn();
  await expect(prepareProjectPackage(value(), "one", [path], read, "AppConfig")).rejects.toThrow();
  expect(read).not.toHaveBeenCalled();
});

test.each([["A.md", "a.md"], ["é.md", "e\u0301.md"]])("portable name collisions are rejected before reads: %j", async (...paths: string[]) => {
  const read = jest.fn();
  await expect(prepareProjectPackage(value(), "one", paths, read, "AppConfig")).rejects.toThrow("duplicate");
  expect(read).not.toHaveBeenCalled();
});

test("file and entry bounds reject oversize export; input read failures remain errors", async () => {
  await expect(prepareProjectPackage(value(), "one", ["large.bin"], async () => new Uint8Array(PACKAGE_LIMITS.fileBytes + 1), "AppConfig")).rejects.toThrow("size limit");
  const read = jest.fn();
  await expect(prepareProjectPackage(value(), "one", Array.from({ length: 256 }, (_, i) => `${i}.md`), read, "AppConfig")).rejects.toThrow("too many");
  expect(read).not.toHaveBeenCalled();
  await expect(prepareProjectPackage(value(), "one", ["gone.md"], async () => { throw Error("gone"); }, "AppConfig")).rejects.toThrow("gone");
});

test("changed captured bytes or manifest cannot silently produce a different reviewed package", async () => {
  const prepared = await prepareProjectPackage(value(), "one", ["Note.md"], async () => new Uint8Array([1]), "AppConfig");
  prepared.entries.get("Files/Note.md")![0] = 2;
  await expect(createProjectZip(prepared)).rejects.toThrow("preview changed");
});

test("the combined payload limit stops further file reads", async () => {
  const bytes = new Uint8Array(PACKAGE_LIMITS.fileBytes);
  const read = jest.fn(async () => bytes);
  await expect(prepareProjectPackage(value(), "one", ["1.bin", "2.bin", "3.bin", "4.bin", "5.bin"], read, "AppConfig")).rejects.toThrow("size limit");
  expect(read).toHaveBeenCalledTimes(4);
});

test("retired operations abort archive construction", async () => {
  const prepared = await prepareProjectPackage(value(), "one", [], async () => new Uint8Array(), "AppConfig");
  await expect(createProjectZip(prepared, () => { throw Error("retired"); })).rejects.toThrow("retired");
  expect(() => packageDependencies(value([project(), project()]), "one")).toThrow("duplicate");
});
