import { webcrypto } from "node:crypto";
import { TextEncoder, TextDecoder } from "node:util";
import { zipSync } from "fflate";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS } from "src/settings/settings";
import { prepareProjectPackage, binaryDigest, PACKAGE_LIMITS } from "../package";
import { createProjectZip } from "../packageZip";
import { inspectProjectPackage } from "../packageInspect";
import { PackageInspectionError } from "../packagePolicy";

const original = { crypto: window.crypto, TextEncoder: window.TextEncoder, TextDecoder: window.TextDecoder };
const encoder = new TextEncoder(), decoder = new TextDecoder();
let entries: Map<string, Uint8Array>, archive: Uint8Array;
beforeAll(async () => {
  for (const [name, value] of Object.entries({ crypto: webcrypto, TextEncoder, TextDecoder })) Object.defineProperty(window, name, { value, configurable: true });
  const project = { ...DEFAULT_PROJECT, id: "p", name: "Тест", uniqueIdCounter: 47, fieldConfig: { missing: { relation: { targetProjectId: "missing" } } } };
  const prepared = await prepareProjectPackage({ ...DEFAULT_SETTINGS, projects: [project] }, "p", ["A.md", "B.md"], async path => encoder.encode(path + " [[Alias|title]]"), "ApplicationConfig", "2026-11-14T00:00:00.000Z");
  entries = new Map(prepared.entries); archive = await createProjectZip(prepared);
});
afterAll(() => { for (const [name, value] of Object.entries(original)) Object.defineProperty(window, name, { value, configurable: true }); });
const encoded = (files = entries, level: 0 | 6 = 0) => zipSync(Object.fromEntries(files), { level, mtime: new Date(2020, 0, 1) });
const copy = () => new Uint8Array(archive);
const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const central = (bytes: Uint8Array) => view(bytes).getUint32(bytes.length - 6, true);
async function rejected(bytes: Uint8Array, code?: string) {
  try { await inspectProjectPackage(bytes, "ApplicationConfig"); throw Error("unexpected success"); }
  catch (error) { expect(error).toBeInstanceOf(PackageInspectionError); if (code) expect((error as PackageInspectionError).code).toBe(code); }
}
function manifestChange(change: (manifest: any) => void): Uint8Array {
  const files = new Map(entries), manifest = JSON.parse(decoder.decode(files.get("manifest.json")));
  change(manifest); files.set("manifest.json", encoder.encode(JSON.stringify(manifest))); return encoded(files);
}

test("plugin ZIP and ordinary stored ZIP retain exact files, counters and missing reference status", async () => {
  for (const bytes of [archive, encoded()]) {
    const result = await inspectProjectPackage(bytes, "ApplicationConfig");
    expect(result.documents[0]?.project.uniqueIdCounter).toBe(47);
    expect(result.manifest.dependencies[0]?.resolved).toBe(false);
    expect(result.archiveHash).toBe(await binaryDigest(bytes));
    for (const [path, content] of entries) expect(Array.from(result.entries.get(path)!)).toEqual(Array.from(content));
  }
});

test("the archive capture is isolated from later input buffer changes", async () => {
  const bytes = copy(), expected = await binaryDigest(bytes);
  const pending = inspectProjectPackage(bytes, "ApplicationConfig"); bytes.fill(0);
  expect((await pending).archiveHash).toBe(expected);
});

test("compressed ZIP is rejected without attempting inflation", async () => { await rejected(encoded(entries, 6), "unsupported-zip"); });
test.each([0, 1, 21, 22])("truncated %i-byte archives fail with a bounded inspection error", async length => { await rejected(archive.subarray(0, length)); });
test("missing end record and trailing data are rejected", async () => {
  await rejected(archive.subarray(0, archive.length - 1));
  const bytes = new Uint8Array(archive.length + 1); bytes.set(archive); await rejected(bytes);
});

test.each(["encryption", "multidisk", "extra", "symlink", "directory", "zip64"])("unsupported ZIP profile: %s", async feature => {
  const bytes = copy(), data = view(bytes), at = central(bytes);
  if (feature === "encryption") data.setUint16(at + 8, data.getUint16(at + 8, true) | 1, true);
  if (feature === "multidisk") data.setUint16(bytes.length - 18, 1, true);
  if (feature === "extra") data.setUint16(at + 30, 1, true);
  if (feature === "symlink") data.setUint32(at + 38, 0xa1ff0000, true);
  if (feature === "directory") data.setUint32(at + 38, 0x10, true);
  if (feature === "zip64") data.setUint16(bytes.length - 12, 0xffff, true);
  await rejected(bytes);
});

test.each(["name", "size", "offset", "flags", "descriptor"])("inconsistent local/central ZIP records: %s", async feature => {
  const bytes = copy(), data = view(bytes), at = central(bytes), nameSize = data.getUint16(26, true);
  if (feature === "name") bytes[30] = bytes[30]! ^ 1;
  if (feature === "size") data.setUint32(at + 24, data.getUint32(at + 24, true) + 1, true);
  if (feature === "offset") data.setUint32(at + 42, bytes.length + 100, true);
  if (feature === "flags") data.setUint16(6, 0, true);
  if (feature === "descriptor") { const index = 30 + nameSize + data.getUint32(at + 20, true) + 4; bytes[index] = bytes[index]! ^ 1; }
  await rejected(bytes);
});

test("CRC damage and manifest hash mismatch are both detected", async () => {
  const bytes = copy(), index = 30 + view(bytes).getUint16(26, true); bytes[index] = bytes[index]! ^ 1;
  await rejected(bytes, "checksum");
  await rejected(manifestChange(manifest => { manifest.files[0].sha256 = "0".repeat(64); }), "checksum");
});

test.each(["Files/../Escape.md", "/Files/A.md", "Files/A\\B.md", "Files/.hidden/data.json", "Files/ApplicationConfig/data.json", "Files/CON", "Files/escaped%2f.md", "\uFEFFmanifest.json"])("unsafe archive path %s is rejected", async path => {
  const files = new Map(entries); files.set(path, encoder.encode("unsafe")); await rejected(encoded(files), "unsafe-path");
});
test.each([["Files/A.md", "Files/a.md"], ["Files/é.md", "Files/e\u0301.md"], ["Files/A.md", "Files/A.md/Child.md"]])("portable name collision %j", async (...names: string[]) => {
  const files = new Map(entries); for (const path of names) files.set(path, encoder.encode("duplicate"));
  await rejected(encoded(files), "unsafe-path");
});

test("unlisted files, repeated manifest identities and unknown/future manifest fields are rejected", async () => {
  const extra = new Map(entries); extra.set("Files/extra.md", encoder.encode("extra")); await rejected(encoded(extra), "invalid-manifest");
  await rejected(manifestChange(manifest => { manifest.schemaVersion = 2; }), "invalid-manifest");
  await rejected(manifestChange(manifest => { manifest.future = true; }), "invalid-manifest");
  await rejected(manifestChange(manifest => { manifest.projects.push(manifest.projects[0]); }), "invalid-manifest");
  await rejected(manifestChange(manifest => { manifest.files.push(manifest.files[0]); }), "invalid-manifest");
});

test("a sender cannot change root identity, revisions or claim missing dependencies resolve", async () => {
  await rejected(manifestChange(manifest => { manifest.rootProjectId = "other"; }), "invalid-manifest");
  await rejected(manifestChange(manifest => { manifest.projects[0].baseRevision = "0".repeat(64); }), "invalid-manifest");
  await rejected(manifestChange(manifest => { manifest.dependencies[0].resolved = true; }), "invalid-manifest");
  await rejected(manifestChange(manifest => { manifest.dependencies = []; }), "invalid-manifest");
});

test("declared oversized payloads and oversized input fail before extraction", async () => {
  const bytes = copy(), data = view(bytes), at = central(bytes);
  data.setUint32(at + 20, PACKAGE_LIMITS.fileBytes + 1, true); data.setUint32(at + 24, PACKAGE_LIMITS.fileBytes + 1, true);
  await rejected(bytes, "size-limit");
  await rejected(new Uint8Array(PACKAGE_LIMITS.archiveBytes + 1), "size-limit");
});

test("orphan local entries cannot hide outside the central directory", async () => {
  const files = new Map(entries); files.set("Files/hidden.md", encoder.encode("hidden"));
  const bytes = encoded(files), data = view(bytes), oldEnd = bytes.length - 22;
  let at = central(bytes), last = at;
  while (at < oldEnd) { last = at; at += 46 + data.getUint16(at + 28, true) + data.getUint16(at + 30, true) + data.getUint16(at + 32, true); }
  const removed = oldEnd - last, result = new Uint8Array(bytes.length - removed);
  result.set(bytes.subarray(0, last)); result.set(bytes.subarray(oldEnd), last);
  const end = result.length - 22, out = view(result);
  out.setUint16(end + 8, files.size - 1, true); out.setUint16(end + 10, files.size - 1, true);
  out.setUint32(end + 12, data.getUint32(oldEnd + 12, true) - removed, true);
  await rejected(result, "invalid-zip");
});

test("retired inspection stops without returning payloads", async () => {
  await expect(inspectProjectPackage(archive, "ApplicationConfig", () => { throw Error("retired"); })).rejects.toThrow("retired");
});

test("Unicode-equivalent configuration folders cannot be smuggled as ordinary files", async () => {
  const files = new Map(entries); files.set("Files/De\u0301fauts/data.json", encoder.encode("settings"));
  await expect(inspectProjectPackage(encoded(files), "Défauts")).rejects.toMatchObject({ code: "unsafe-path" });
});

test("deep opaque project data yields a controlled rejection rather than leaking a stack error", async () => {
  const files = new Map(entries), manifest = JSON.parse(decoder.decode(files.get("manifest.json")));
  const path: string = manifest.projects[0].path;
  const document = decoder.decode(files.get(path)).replace('"project": {', '"project": {"deep":' + '['.repeat(10000) + '0' + ']'.repeat(10000) + ',');
  const bytes = encoder.encode(document); files.set(path, bytes);
  const description = manifest.files.find((file: { path: string }) => file.path === path);
  description.bytes = bytes.length; description.sha256 = await binaryDigest(bytes);
  files.set("manifest.json", encoder.encode(JSON.stringify(manifest)));
  await rejected(encoded(files), "invalid-manifest");
});
