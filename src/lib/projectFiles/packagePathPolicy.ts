import { projectFileError } from "./document";
import { packageNameKey } from "./packageManifest";
import { projectFilesRoot } from "./paths";

export interface VaultPathEntry { readonly path: string; readonly kind: "file" | "folder" }
export const PACKAGE_PATH_LIMITS = { entries: 100000, characters: 16 * 1024 * 1024, copyRoots: 128 } as const;

/** Shared portable/configuration/service-namespace policy for copies and explicit bindings. */
export function createPackagePathGuard(configDir: string, copyRoots: readonly string[]): (path: string, file?: boolean) => void {
  if (copyRoots.length > PACKAGE_PATH_LIMITS.copyRoots) throw projectFileError("file preview inventory too large");
  const reserved = copyRoots.map(root => packageNameKey(projectFilesRoot(root, configDir)));
  const folders = new Set(["projects", "backups", "incoming", "packages"]);
  return (path: string, file = false) => {
    projectFilesRoot(path, configDir);
    const name = packageNameKey(path);
    for (const root of reserved) {
      if (file && (name === root || root.startsWith(name + "/"))) throw projectFileError("destination is reserved for project copies");
      if (!name.startsWith(root + "/")) continue;
      const first = name.slice(root.length + 1).split("/")[0]!;
      if (folders.has(first) || first === "sync-index.json") throw projectFileError("destination is reserved for project copies");
    }
  };
}

/** Validated metadata snapshot, including inferred ancestors. No filesystem access. */
export function snapshotVaultPathIndex(existing: readonly VaultPathEntry[]): ReadonlyMap<string, ReadonlyMap<string, VaultPathEntry["kind"]>> {
  if (existing.length > PACKAGE_PATH_LIMITS.entries) throw projectFileError("file preview inventory too large");
  const index = new Map<string, Map<string, VaultPathEntry["kind"]>>();
  let indexed = 0, characters = 0, inputCharacters = 0;
  const add = (path: string, kind: VaultPathEntry["kind"]) => {
    const key = packageNameKey(path), variants = index.get(key) ?? new Map<string, VaultPathEntry["kind"]>();
    const prior = variants.get(path);
    if (prior !== undefined) {
      if (prior !== kind) throw projectFileError("inconsistent file preview inventory");
      return false;
    }
    characters += path.length;
    if (++indexed > PACKAGE_PATH_LIMITS.entries || characters > PACKAGE_PATH_LIMITS.characters) throw projectFileError("file preview inventory too large");
    variants.set(path, kind); index.set(key, variants); return true;
  };
  for (const item of existing) {
    if (typeof item.path !== "string" || item.path.length > 4096 || (item.kind !== "file" && item.kind !== "folder")) throw projectFileError("invalid file preview inventory");
    inputCharacters += item.path.length;
    if (inputCharacters > PACKAGE_PATH_LIMITS.characters) throw projectFileError("file preview inventory too large");
    if (item.path === "" && item.kind === "folder") continue;
    if (!item.path || item.path.startsWith("/") || item.path.endsWith("/") || item.path.includes("//")) throw projectFileError("invalid file preview inventory");
    if (!add(item.path, item.kind)) continue;
    for (let at = item.path.lastIndexOf("/"); at >= 0; at = item.path.lastIndexOf("/", at - 1)) {
      if (!add(item.path.slice(0, at), "folder")) break;
    }
  }
  return index;
}
