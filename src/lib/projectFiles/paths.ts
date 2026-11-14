import { projectFileError } from "./document";
import type { ProjectsPluginPreferences } from "src/settings/settings";

type CopyPreferences = ProjectsPluginPreferences["projectFiles"];

/** Old roots remain reserved: changing the destination must not turn copies into records. */
export function configuredCopyRoots(config: CopyPreferences): readonly string[] {
  const candidates: unknown[] = [config?.root, ...(Array.isArray(config?.previousRoots) ? config.previousRoots as unknown[] : [])];
  return [...new Set(candidates.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

export function nextCopyPreferences(previous: CopyPreferences, input: string, autoSync: boolean, configDir: string): NonNullable<CopyPreferences> {
  const root = projectFilesRoot(input, configDir);
  const previousRoots = configuredCopyRoots(previous).filter(old => old.toLowerCase() !== root.toLowerCase());
  return { root, autoSync, ...(previousRoots.length ? { previousRoots } : {}) };
}

/** Portable vault-relative destinations; no normalization that changes ownership. */
export function projectFilesRoot(input: string, configDir: string): string {
  if (!input || input.length > 240 || input !== input.trim() || input.includes("\\") || input.includes("%")) {
    throw projectFileError("invalid destination folder");
  }
  const segments = input.split("/");
  if (segments.some(s => !s || s === "." || s === ".." || s.startsWith(".") || /[<>:"|?*]/.test(s) || Array.from(s).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
      /[. ]$/.test(s) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s))) {
    throw projectFileError("unsafe destination folder");
  }
  const lower = input.normalize("NFC").toLocaleLowerCase("en-US"), config = configDir.normalize("NFC").toLocaleLowerCase("en-US");
  if (lower === config || lower.startsWith(config + "/") || config.startsWith(lower + "/")) {
    throw projectFileError("destination overlaps application configuration");
  }
  return input;
}

/** Only this feature's reserved documents, not imported user notes beside them. */
export function isProjectCopyPath(path: string, root: string | readonly string[] | undefined): boolean {
  const roots: readonly unknown[] = typeof root === "string" ? [root] : Array.isArray(root) ? root : [];
  const lower = path.toLowerCase();
  return roots.some(candidate => {
    if (typeof candidate !== "string" || !candidate) return false;
    const prefix = candidate.toLowerCase() + "/";
    return lower.startsWith(prefix) && /^(?:projects\/[a-f0-9]{64}\/project\.md|backups\/[a-f0-9]{64}\/[a-f0-9]{64}\.md|incoming\/[a-f0-9]{64}(?:\.json|\/.+))$/.test(lower.slice(prefix.length));
  });
}
