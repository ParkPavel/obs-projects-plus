import { projectFileError } from "./document";

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
  const lower = input.toLocaleLowerCase("en-US"), config = configDir.toLocaleLowerCase("en-US");
  if (lower === config || lower.startsWith(config + "/") || config.startsWith(lower + "/")) {
    throw projectFileError("destination overlaps application configuration");
  }
  return input;
}

/** Only this feature's reserved documents, not imported user notes beside them. */
export function isProjectCopyPath(path: string, root: string | undefined): boolean {
  if (!root) return false;
  const prefix = root.toLowerCase() + "/", lower = path.toLowerCase();
  if (!lower.startsWith(prefix)) return false;
  return /^(?:projects\/[a-f0-9]{64}\/project\.md|backups\/[a-f0-9]{64}\/[a-f0-9]{64}\.md)$/.test(lower.slice(prefix.length));
}
