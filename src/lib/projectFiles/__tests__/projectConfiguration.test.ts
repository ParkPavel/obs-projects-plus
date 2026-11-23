import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, type ProjectDefinition } from "src/settings/settings";
import { MAX_PROJECT_DOCUMENT_BYTES, textDigest } from "../document";
import {
  createProjectConfiguration,
  parseProjectConfiguration,
  PROJECT_CONFIGURATION_FORMAT,
} from "../projectConfiguration";

const cryptoBefore = window.crypto, encoderBefore = window.TextEncoder;
beforeAll(() => {
  Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(window, "TextEncoder", { value: TextEncoder, configurable: true });
});
afterAll(() => {
  Object.defineProperty(window, "crypto", { value: cryptoBefore, configurable: true });
  Object.defineProperty(window, "TextEncoder", { value: encoderBefore, configurable: true });
});

const OWNER = "owner_1";
const project = (id = "p"): ProjectDefinition => ({ ...DEFAULT_PROJECT, id, name: "Работа " + id });
const envelope = async (): Promise<Record<string, unknown>> => JSON.parse(await createProjectConfiguration(project(), OWNER));
const projectOf = (value: Record<string, unknown>): Record<string, unknown> => value["project"] as Record<string, unknown>;

test("creates pretty LF JSON with owner and the original revision, and parses it back", async () => {
  const source = project();
  const text = await createProjectConfiguration(source, OWNER);
  expect(text.endsWith("\n")).toBe(true);
  expect(text).not.toContain("\r");
  expect(text).toBe(JSON.stringify(JSON.parse(text), null, 2) + "\n");
  const parsed = parseProjectConfiguration(text);
  expect(parsed.format).toBe(PROJECT_CONFIGURATION_FORMAT);
  expect(parsed.schemaVersion).toBe(1);
  expect(parsed.settingsVersion).toBe(4);
  expect(parsed.owner).toBe(OWNER);
  expect(parsed.baseRevision).toBe(await textDigest(JSON.stringify(source)));
  expect(parsed.project).toEqual(source);
});

test("captures the project synchronously before the async digest", async () => {
  const source = project();
  const pending = createProjectConfiguration(source, OWNER);
  const mutable = source as unknown as { name: string; future: boolean };
  mutable.name = "Изменено после вызова";
  mutable.future = true;
  const parsed = parseProjectConfiguration(await pending);
  expect(parsed.project.name).toBe("Работа p");
  expect(parsed.project).not.toHaveProperty("future");
});

test("round-trips Unicode and unknown fields losslessly, preserving insertion order", async () => {
  const source = {
    ...project(),
    name: "Проект — Привет 🌍",
    custom: { z: 1, a: "значение", unicode: "日本語" },
  } as unknown as ProjectDefinition;
  const parsed = parseProjectConfiguration(await createProjectConfiguration(source, OWNER));
  expect(parsed.project).toEqual(source);
  const custom = (parsed.project as unknown as Record<string, unknown>)["custom"] as Record<string, unknown>;
  expect(Object.keys(custom)).toEqual(["z", "a", "unicode"]);
});

test("accepts an edited payload that keeps its origin baseRevision", async () => {
  const original = await envelope();
  const edited = JSON.stringify({ ...original, project: { ...projectOf(original), name: "Отредактировано" } }, null, 2) + "\n";
  const parsed = parseProjectConfiguration(edited);
  expect(parsed.project.name).toBe("Отредактировано");
  expect(parsed.baseRevision).toBe(original["baseRevision"]);
});

test("refuses envelope, version, owner and revision deviations", async () => {
  const original = await envelope();
  const variant = (patch: Record<string, unknown>) => JSON.stringify({ ...original, ...patch });
  expect(() => parseProjectConfiguration(variant({}))).not.toThrow();
  for (const patch of [
    { format: "obs-projects-plus/project-copy" },
    { schemaVersion: 2 },
    { settingsVersion: 3 },
    { owner: "плохой" },
    { owner: "" },
    { owner: "x".repeat(129) },
    { baseRevision: "A".repeat(64) },
    { baseRevision: "a".repeat(63) },
    { baseRevision: "z".repeat(64) },
    { extra: 1 },
    { project: { ...projectOf(original), views: [{ id: "v" }, { id: "v" }] } },
    { project: { ...projectOf(original), views: "нет" } },
  ]) expect(() => parseProjectConfiguration(variant(patch))).toThrow();
  const missing = {
    format: original["format"], schemaVersion: 1, settingsVersion: 4,
    baseRevision: original["baseRevision"], project: original["project"],
  };
  expect(() => parseProjectConfiguration(JSON.stringify(missing))).toThrow();
  for (const text of ["null", "[]", '"текст"', "4", "{}"]) expect(() => parseProjectConfiguration(text)).toThrow();
});

test("refuses oversized, too deep, too large and non-finite payloads", async () => {
  expect(() => parseProjectConfiguration("a".repeat(MAX_PROJECT_DOCUMENT_BYTES + 1))).toThrow();
  const original = await envelope();
  const wrap = (future: unknown) => JSON.stringify({ ...original, project: { ...projectOf(original), future } });
  let deep: unknown = 0;
  for (let index = 0; index < 40; index++) deep = [deep];
  expect(() => parseProjectConfiguration(wrap(deep))).toThrow();
  expect(() => parseProjectConfiguration(wrap(new Array(20000).fill(0)))).toThrow();
  const nonFinite = wrap("NONFINITE").replace('"future":"NONFINITE"', '"future":1e999');
  expect(() => parseProjectConfiguration(nonFinite)).toThrow();
});

test("refuses invalid owners and oversized projects on creation", async () => {
  await expect(createProjectConfiguration(project(), "плохой")).rejects.toThrow();
  await expect(createProjectConfiguration(project(), "x".repeat(129))).rejects.toThrow();
  const huge = { ...project(), newNotesFolder: "a".repeat(MAX_PROJECT_DOCUMENT_BYTES) };
  await expect(createProjectConfiguration(huge, OWNER)).rejects.toThrow();
});