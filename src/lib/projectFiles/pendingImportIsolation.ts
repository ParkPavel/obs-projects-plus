import { writable } from "svelte/store";
import type { ProjectsPluginPreferences } from "src/settings/settings";
import { jsonObject, projectFileError } from "./document";
import { configuredCopyRoots, projectFilesRoot } from "./paths";
import { createPackagePathGuard } from "./packagePathPolicy";
import { packageNameKey } from "./packageManifest";
import { PACKAGE_LIMITS } from "./packagePolicy";

/** Host-owned state, never accepted from an imported project definition. */
export interface PendingProjectImport {
  readonly format: "obs-projects-plus/pending-import";
  readonly schemaVersion: 1;
  readonly id: string;
  readonly archiveHash: string;
  readonly journal: string;
  readonly paths: string[];
}

const revision = writable(0);
export const pendingImportRevision = { subscribe: revision.subscribe };
let epoch = 0, fingerprint = "", blocked = false;
let paths: ReadonlySet<string> = new Set();

export function pendingImportState(): { readonly generation: number; readonly scope: "none" | "paths" | "all" } {
  return { generation: epoch, scope: blocked ? "all" : paths.size ? "paths" : "none" };
}

/** Live old source instances see changes without waiting for a Svelte rebuild. */
export function isPendingImportPath(path: string): boolean {
  return blocked || paths.size > 0 && paths.has(packageNameKey(path));
}

/** Install before view registration, and refresh synchronously on every settings publication. */
export function refreshPendingImportIsolation(config: ProjectsPluginPreferences['projectFiles'], configDir: string): "clear" | "pending" | "invalid" {
  if (config?.pendingImport === undefined && fingerprint === "") return "clear";
  let next = "", nextBlocked = false;
  const nextPaths = new Set<string>();
  let status: "clear" | "pending" | "invalid" = "clear";
  try {
    const pending: unknown = config?.pendingImport;
    if (pending !== undefined) {
      const fail = () => { throw projectFileError("invalid pending import"); };
      if (!config || !jsonObject(pending)) return fail();
      const keys = ["format", "schemaVersion", "id", "archiveHash", "journal", "paths"];
      if (Object.keys(pending).some(key => !keys.includes(key)) || keys.some(key => !Object.prototype.hasOwnProperty.call(pending, key))) return fail();
      const { id, archiveHash, journal, paths: files } = pending;
      if (pending['format'] !== "obs-projects-plus/pending-import" || pending['schemaVersion'] !== 1 ||
          typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id) || typeof archiveHash !== "string" || !/^[a-f0-9]{64}$/.test(archiveHash) ||
          typeof journal !== "string" || !Array.isArray(files) || !files.length || files.length > PACKAGE_LIMITS.files) return fail();
      const root = projectFilesRoot(config.root, configDir);
      if (journal !== `${root}/Incoming/${archiveHash}/Installations/${id}.json`) return fail();
      const guard = createPackagePathGuard(configDir, configuredCopyRoots(config));
      let characters = 0;
      for (const path of files as unknown[]) {
        if (typeof path !== "string" || (characters += path.length) > 65536) return fail();
        guard(path, true);
        const key = packageNameKey(path);
        if (nextPaths.has(key)) return fail();
        nextPaths.add(key);
      }
      next = JSON.stringify([id, archiveHash, journal, [...nextPaths].sort()]);
      status = "pending";
    }
  } catch {
    // Unknown/corrupt pending metadata must not expose partial payloads. The
    // host reports this explicitly; this module never repairs settings/files.
    next = "invalid"; nextBlocked = true; nextPaths.clear(); status = "invalid";
  }
  if (next !== fingerprint) {
    fingerprint = next; paths = nextPaths; blocked = nextBlocked;
    revision.set(++epoch);
  }
  return status;
}
