import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
type MetadataCache = import("obsidian").MetadataCache;
type Vault = import("obsidian").Vault;
type CachedMetadata = import("obsidian").CachedMetadata;
import { inspectNativeNote } from "../nativeNoteInspection";

jest.mock("obsidian", () => ({ TFile: class {}, TFolder: class {} }));
const { TFolder } = require("obsidian");
const saved = { crypto: window.crypto, TextEncoder: window.TextEncoder };
beforeAll(() => { for (const [key, value] of Object.entries({ crypto: webcrypto, TextEncoder })) Object.defineProperty(window, key, { value, configurable: true }); });
afterAll(() => { for (const [key, value] of Object.entries(saved)) Object.defineProperty(window, key, { value, configurable: true }); });
function fixture(cache: CachedMetadata = {}) {
  let callback!: (file: { path: string }, text: string, cache: CachedMetadata) => void;
  const folders = new Map<string, unknown>(), offref = jest.fn(), create = jest.fn(async (path: string, text: string) => {
    callback({ path: path + "other" }, text, { links: [] });
    callback({ path }, "old text", { links: [] });
    callback({ path }, text, cache);
  });
  const vault = { getAbstractFileByPath: (path: string) => folders.get(path) ?? null,
    createFolder: async (path: string) => { folders.set(path, new TFolder()); }, create } as unknown as Vault;
  const metadata = { on: jest.fn((_event: string, fn: typeof callback) => { callback = fn; return {}; }), offref } as unknown as MetadataCache;
  return { vault, metadata, create, offref };
}
test("accepts only the native event for the exact staged file and exact text, then unsubscribes", async () => {
  const f = fixture({ frontmatter: { ignoredLargeObject: true } });
  const result = await inspectNativeNote(f.vault, f.metadata, "Copies/Incoming/hash", "Work/Note.md", "```dataviewjs\nthrow Error('never execute')\n```", () => {});
  expect(result.text).toContain("never execute"); expect(result.cache).toEqual({});
  expect(f.create).toHaveBeenCalledTimes(1); expect(f.offref).toHaveBeenCalledTimes(1);
  expect(f.create.mock.calls[0]![0]).toMatch(/^Copies\/Incoming\/hash\/Note inspection\/.+\/[a-f0-9]{64}\.md$/);
});
test("failed creation and retired work always unsubscribe and retain the inspection file", async () => {
  const f = fixture(); f.create.mockRejectedValueOnce(Error("create refused"));
  await expect(inspectNativeNote(f.vault, f.metadata, "Copies/Incoming/hash", "N.md", "Text", () => {})).rejects.toThrow("create refused");
  expect(f.offref).toHaveBeenCalledTimes(1);
});
test("native metadata link count is bounded before capturing cache data", async () => {
  const f = fixture({ links: Array.from({ length: 4097 }, () => ({})) as NonNullable<CachedMetadata['links']> });
  await expect(inspectNativeNote(f.vault, f.metadata, "Copies/Incoming/hash", "N.md", "Text", () => {})).rejects.toThrow("too many note links");
  expect(f.offref).toHaveBeenCalledTimes(1);
});
