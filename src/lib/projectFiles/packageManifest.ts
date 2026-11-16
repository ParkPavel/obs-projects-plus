import { jsonObject } from "./document";
import { projectFilesRoot } from "./paths";
import { PACKAGE_LIMITS, PackageInspectionError } from "./packagePolicy";
import type { PackageManifest } from "./package";

const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const text = (value: unknown, limit: number, empty = false): value is string => typeof value === "string" && (empty || value.length > 0) && value.length <= limit;
function invalid(): never { throw new PackageInspectionError("invalid-manifest"); }
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!jsonObject(value) || Object.keys(value).some(key => !keys.includes(key))) invalid();
  return value;
}
export function packageNameKey(path: string): string { return path.normalize("NFC").toLowerCase(); }

/** A package profile, not a general-purpose filesystem extractor. */
export function checkedPackageEntryPath(path: string, configDir: string): void {
  if (path === "manifest.json" || /^Projects\/[a-f0-9]{64}\/Project\.md$/.test(path)) return;
  if (path.startsWith("Files/")) {
    try { projectFilesRoot(path.slice(6), configDir); return; } catch { /* Report one bounded, non-user-controlled error. */ }
  }
  throw new PackageInspectionError("unsafe-path");
}

/** Unknown manifest fields/versions block interpretation; project payloads remain lossless. */
export function validatePackageManifest(input: unknown, configDir: string): asserts input is PackageManifest {
  const value = object(input, ["format", "schemaVersion", "settingsVersion", "rootProjectId", "createdAt", "projects", "dependencies", "files", "selection", "dependencyCoverage"]);
  if (value['format'] !== "obs-projects-plus/package" || value['schemaVersion'] !== 1 || value['settingsVersion'] !== 4 ||
      !text(value['rootProjectId'], 512) || !text(value['createdAt'], 32) || !Number.isFinite(Date.parse(value['createdAt'])) ||
      new Date(value['createdAt']).toISOString() !== value['createdAt'] || value['selection'] !== "configuration-and-explicit-files" ||
      value['dependencyCoverage'] !== "known-runtime-references") invalid();
  if (!Array.isArray(value['projects']) || !value['projects'].length || value['projects'].length > PACKAGE_LIMITS.projects ||
      !Array.isArray(value['files']) || !value['files'].length || value['files'].length >= PACKAGE_LIMITS.files ||
      !Array.isArray(value['dependencies']) || value['dependencies'].length > PACKAGE_LIMITS.dependencies) invalid();
  const ids = new Set<string>(), projectPaths = new Set<string>();
  for (const item of value['projects']) {
    const project = object(item, ["id", "name", "path", "baseRevision", "archived"]);
    if (!text(project['id'], 512) || !text(project['name'], 4096, true) || typeof project['path'] !== "string" ||
        !/^Projects\/[a-f0-9]{64}\/Project\.md$/.test(project['path']) || !hash(project['baseRevision']) || typeof project['archived'] !== "boolean" ||
        ids.has(project['id']) || projectPaths.has(project['path'])) invalid();
    ids.add(project['id']); projectPaths.add(project['path']);
  }
  if (!ids.has(value['rootProjectId'])) invalid();
  const names = new Set<string>(), describedProjects = new Set<string>();
  let total = 0;
  for (const item of value['files']) {
    const file = object(item, ["path", "role", "sourcePath", "bytes", "sha256"]);
    if (typeof file['path'] !== "string" || !hash(file['sha256']) || typeof file['bytes'] !== "number" ||
        !Number.isSafeInteger(file['bytes']) || file['bytes'] < 0 || file['bytes'] > PACKAGE_LIMITS.fileBytes) invalid();
    checkedPackageEntryPath(file['path'], configDir);
    const key = packageNameKey(file['path']);
    if (file['path'] === "manifest.json" || names.has(key)) invalid();
    names.add(key); total += file['bytes'];
    if (total > PACKAGE_LIMITS.totalBytes) throw new PackageInspectionError("size-limit");
    if (file['role'] === "project") {
      if (!projectPaths.has(file['path']) || 'sourcePath' in file) invalid();
      describedProjects.add(file['path']);
    } else {
      if (!text(file['sourcePath'], 240) || file['path'] !== "Files/" + file['sourcePath'] ||
          file['role'] !== (/\.md$/i.test(file['sourcePath']) ? "note" : "attachment")) invalid();
    }
  }
  if (describedProjects.size !== projectPaths.size) invalid();
  for (const name of names) {
    const parts = name.split("/");
    for (let i = 1; i < parts.length; i++) if (names.has(parts.slice(0, i).join("/"))) invalid();
  }
  const dependencies = new Set<string>();
  for (const item of value['dependencies']) {
    const dependency = object(item, ["from", "reference", "target", "resolved"]);
    if (!text(dependency['from'], 512) || !ids.has(dependency['from']) || !text(dependency['reference'], 4096) ||
        !text(dependency['target'], 512) || typeof dependency['resolved'] !== "boolean") invalid();
    const key = JSON.stringify([dependency['from'], dependency['reference']]);
    if (dependencies.has(key)) invalid(); dependencies.add(key);
  }
}
