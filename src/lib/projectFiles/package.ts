import type { LatestProjectsPluginSettings } from "src/settings/settings";
import { createProjectDocument, printProjectDocument, projectFileError, textDigest } from "./document";
import { packageDependencies, type PackageDependency } from "./packageDependencies";
import { projectFilesRoot } from "./paths";
import { PACKAGE_LIMITS } from "./packagePolicy";
import { validatePackageManifest } from "./packageManifest";

export { PACKAGE_LIMITS } from "./packagePolicy";
export type PackageFileRole = "project" | "note" | "attachment";
export interface PackageFile { path: string; role: PackageFileRole; sourcePath?: string; bytes: number; sha256: string }
export interface PackageManifest {
  format: "obs-projects-plus/package"; schemaVersion: 1; settingsVersion: 4; rootProjectId: string; createdAt: string;
  projects: { id: string; name: string; path: string; baseRevision: string; archived: boolean }[];
  dependencies: PackageDependency[];
  files: PackageFile[];
  /** Scope is explicit: a selected subset is never labelled a complete vault backup. */
  selection: "configuration-and-explicit-files";
  dependencyCoverage: "known-runtime-references";
}
export interface PreparedProjectPackage {
  manifest: PackageManifest;
  entries: ReadonlyMap<string, Uint8Array>;
  settingsRevision: string;
}

export async function binaryDigest(bytes: Uint8Array): Promise<string> {
  if (!window.crypto?.subtle) throw projectFileError("secure digest unavailable");
  const digest = await window.crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Export paths must remain portable and cannot reach the host's hidden settings. */
export function packageFilePath(path: string, configDir: string): string { return projectFilesRoot(path, configDir); }

export async function prepareProjectPackage(settings: LatestProjectsPluginSettings, rootId: string, paths: readonly string[],
  read: (path: string) => Promise<Uint8Array>, configDir: string, createdAt = new Date().toISOString()): Promise<PreparedProjectPackage> {
  // Snapshot before any asynchronous work; never export live mutable settings.
  const copy = JSON.parse(JSON.stringify(settings)) as LatestProjectsPluginSettings;
  const graph = packageDependencies(copy, rootId);
  const entries = new Map<string, Uint8Array>(), names = new Set<string>(), files: PackageFile[] = [];
  const projects: PackageManifest["projects"] = [];
  let total = 0;
  const add = async (path: string, role: PackageFileRole, input: Uint8Array, sourcePath?: string) => {
    const key = path.normalize("NFC").toLowerCase();
    if (names.has(key)) throw projectFileError("duplicate or nonportable package path");
    if (entries.size >= PACKAGE_LIMITS.files - 1 || input.length > PACKAGE_LIMITS.fileBytes || total + input.length > PACKAGE_LIMITS.totalBytes) throw projectFileError("package size limit");
    const bytes = new Uint8Array(input);
    names.add(key); total += bytes.length; entries.set(path, bytes);
    files.push({ path, role, ...(sourcePath ? { sourcePath } : {}), bytes: bytes.length, sha256: await binaryDigest(bytes) });
  };
  for (const { project, archived } of graph.projects) {
    const document = await createProjectDocument(project);
    const path = `Projects/${await textDigest(project.id)}/Project.md`;
    await add(path, "project", new TextEncoder().encode(printProjectDocument(document)));
    projects.push({ id: project.id, name: project.name, path, baseRevision: document.baseRevision, archived });
  }
  // Validate every selected name and case/Unicode collision BEFORE reading user files.
  const selected = new Set<string>();
  if (paths.length + entries.size >= PACKAGE_LIMITS.files) throw projectFileError("too many package files");
  for (const input of paths) {
    const path = packageFilePath(input, configDir), key = path.normalize("NFC").toLowerCase();
    if (selected.has(key)) throw projectFileError("duplicate or nonportable source path");
    selected.add(key);
  }
  for (const path of paths) await add("Files/" + path, /\.md$/i.test(path) ? "note" : "attachment", await read(path), path);
  const manifest: PackageManifest = { format: "obs-projects-plus/package", schemaVersion: 1, settingsVersion: 4, rootProjectId: rootId,
    createdAt, projects, dependencies: graph.dependencies, files, selection: "configuration-and-explicit-files", dependencyCoverage: "known-runtime-references" };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2) + "\n");
  if (total + manifestBytes.length > PACKAGE_LIMITS.totalBytes || manifestBytes.length > PACKAGE_LIMITS.manifestBytes) throw projectFileError("package size limit");
  validatePackageManifest(manifest, configDir);
  entries.set("manifest.json", manifestBytes);
  return { manifest, entries, settingsRevision: await textDigest(JSON.stringify(copy)) };
}
