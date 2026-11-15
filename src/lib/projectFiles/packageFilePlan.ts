import type { PackageManifest, PackageFile } from "./package";
import { projectFileError } from "./document";
import { packageNameKey, validatePackageManifest } from "./packageManifest";
import { projectFilesRoot } from "./paths";
import { PACKAGE_LIMITS } from "./packagePolicy";
import { createPackagePathGuard, snapshotVaultPathIndex, type VaultPathEntry } from "./packagePathPolicy";

export type { VaultPathEntry } from "./packagePathPolicy";
export interface PlannedPackageFile {
  readonly entry: string;
  readonly source: string;
  readonly destination: string;
  readonly role: "note" | "attachment";
  readonly bytes: number;
  readonly sha256: string;
}
export interface PackagePathConflict {
  readonly code: "file-exists" | "folder-exists" | "parent-file" | "path-alias" | "planned-path-alias";
  readonly destination: string;
  /** Conflicting host path, or another planned spelling for planned-path-alias. */
  readonly existing: string;
}
export interface PackageFilePlan {
  readonly stage: "file-preview";
  readonly root: string;
  readonly files: readonly PlannedPackageFile[];
  /** All required ancestors, in parent-first order, not a claim of folder ownership. */
  readonly folders: readonly string[];
  readonly conflicts: readonly PackagePathConflict[];
  /** Bytes and links have not been rewritten or inspected by this path-only plan. */
  readonly notesNeedInspection: boolean;
  fileDestination(source: string): string;
  /** Only exact source folders containing selected files have a mapping; empty string is source root. */
  folderDestination(source: string): string;
}

function parents(path: string): string[] {
  const out: string[] = [];
  for (let at = path.indexOf("/"); at >= 0; at = path.indexOf("/", at + 1)) out.push(path.slice(0, at));
  return out;
}

/**
 * Pure, bounded file placement preview for schema1 selected files. No extraction or overwrites.
 * Existing-file equality never authorizes replacement. A future installer must recheck actual Vault
 * state and bytes, validate config/scope and resolve note links before any final publication.
 */
export function planPackageFiles(
  manifest: PackageManifest, destination: string, existing: readonly VaultPathEntry[],
  configDir: string, copyRoots: readonly string[],
): PackageFilePlan {
  validatePackageManifest(manifest, configDir);
  const root = projectFilesRoot(destination, configDir);
  const checkDestination = createPackagePathGuard(configDir, copyRoots);
  checkDestination(root);
  // Snapshot only primitive metadata; keep no sender-owned objects in the resulting plan.
  const files = manifest.files.filter((file): file is PackageFile & { sourcePath: string; role: "note" | "attachment" } => file.role !== "project")
    .map(file => {
      const target = root + "/" + file.sourcePath;
      checkDestination(target, true);
      return Object.freeze({ entry: file.path, source: file.sourcePath, destination: target, role: file.role, bytes: file.bytes, sha256: file.sha256 });
    });
  const index = snapshotVaultPathIndex(existing);
  const needed = new Set([...parents(root), root]);
  const fileMap = new Map<string, string>(), folderMap = new Map<string, string>();
  for (const file of files) {
    for (const parent of parents(file.destination)) needed.add(parent);
    fileMap.set(file.source, file.destination);
    folderMap.set("", root);
    for (const folder of parents(file.source)) folderMap.set(folder, root + "/" + folder);
  }
  const conflicts: PackagePathConflict[] = [], conflictKeys = new Set<string>();
  const conflict = (code: PackagePathConflict["code"], target: string, observed: string) => {
    const key = JSON.stringify([code, target, observed]);
    if (conflictKeys.has(key)) return;
    if (conflicts.length >= PACKAGE_LIMITS.dependencies) throw projectFileError("too many file preview conflicts");
    conflictKeys.add(key);
    conflicts.push(Object.freeze({ code, destination: target, existing: observed }));
  };
  const inspect = (path: string, kind: VaultPathEntry["kind"]) => {
    for (const [observed, observedKind] of index.get(packageNameKey(path)) ?? []) {
      if (observed !== path) conflict("path-alias", path, observed);
      else if (kind === "file") conflict(observedKind === "file" ? "file-exists" : "folder-exists", path, observed);
      else if (observedKind === "file") conflict("parent-file", path, observed);
    }
  };
  const folders = [...needed].sort((a, b) => a.split("/").length - b.split("/").length || (a < b ? -1 : a > b ? 1 : 0));
  // Distinct files can still imply incompatible parent spellings (Work/a vs work/b).
  // Keep one representative per key, avoiding quadratic pairwise alias reporting.
  const planned = new Map<string, string>();
  for (const path of [...folders, ...files.map(file => file.destination)]) {
    const key = packageNameKey(path), prior = planned.get(key);
    if (prior !== undefined && prior !== path) conflict("planned-path-alias", path, prior);
    else planned.set(key, path);
  }
  for (const folder of folders) inspect(folder, "folder");
  for (const file of files) inspect(file.destination, "file");
  const lookup = (map: ReadonlyMap<string, string>, path: string) => {
    const result = map.get(path);
    if (result === undefined) throw projectFileError("unbound package path");
    return result;
  };
  return Object.freeze({ stage: "file-preview", root, files: Object.freeze(files), folders: Object.freeze(folders), conflicts: Object.freeze(conflicts),
    notesNeedInspection: files.some(file => file.role === "note"),
    fileDestination: (source: string) => lookup(fileMap, source), folderDestination: (source: string) => lookup(folderMap, source) });
}
