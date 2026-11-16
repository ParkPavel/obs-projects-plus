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
  readonly phase?: "note-inspection";
}

/** Operational object order is irrelevant; exact plan/journal identity and canonical path membership are not. */
export function samePendingImport(left: PendingProjectImport | undefined, right: PendingProjectImport): boolean {
  const identity = (input: PendingProjectImport | undefined): string | null => {
    if (!input || !jsonObject(input)) return null;
    const required = ["format", "schemaVersion", "id", "archiveHash", "journal", "paths"];
    if (required.some(key => !Object.prototype.hasOwnProperty.call(input, key)) || Object.keys(input).some(key => !required.includes(key) && key !== "phase") ||
        Object.prototype.hasOwnProperty.call(input, "phase") && input.phase !== "note-inspection" || input.format !== "obs-projects-plus/pending-import" || input.schemaVersion !== 1 ||
        typeof input.id !== "string" || typeof input.archiveHash !== "string" || typeof input.journal !== "string" || !Array.isArray(input.paths) || !input.paths.length || input.paths.length > PACKAGE_LIMITS.files) return null;
    let characters = 0; const paths = new Set<string>();
    for (const path of input.paths) {
      if (typeof path !== "string" || (characters += path.length) > 65536) return null;
      const key = packageNameKey(path); if (paths.has(key)) return null; paths.add(key);
    }
    return JSON.stringify([input.format, input.schemaVersion, input.id, input.archiveHash, input.journal, input.phase ?? null, [...paths].sort()]);
  };
  const expected = identity(right);
  return expected !== null && identity(left) === expected;
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
      if (Object.keys(pending).some(key => !keys.includes(key) && key !== "phase") || keys.some(key => !Object.prototype.hasOwnProperty.call(pending, key)) ||
          Object.prototype.hasOwnProperty.call(pending, "phase") && pending['phase'] !== "note-inspection") return fail();
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
        if (pending['phase'] === "note-inspection") {
          const prefix = `${root}/Incoming/${archiveHash}/Note inspection/${id}/`;
          if (!/^[a-f0-9]{64}$/.test(id) || !path.startsWith(prefix) || !/^[a-f0-9]{64}\.md$/.test(path.slice(prefix.length))) return fail();
        } else guard(path, true);
        const key = packageNameKey(path);
        if (nextPaths.has(key)) return fail();
        nextPaths.add(key);
      }
      next = JSON.stringify([id, archiveHash, journal, [...nextPaths].sort(), pending['phase'] ?? null]);
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
