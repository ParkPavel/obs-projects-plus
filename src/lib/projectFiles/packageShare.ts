import { projectFileError } from "./document";
import { PACKAGE_LIMITS } from "./packagePolicy";

/** Outcome of a share attempt. `unavailable` never claims the OS sheet was used. */
export type PackageShareResult = "shared" | "cancelled" | "unavailable" | "failed";

/** A prepared package; the private File stays inside the closure. */
export interface PreparedPackageShare {
  readonly name: string;
  available(): boolean;
  share(): Promise<PackageShareResult>;
}

const MAX_SHARE_NAME = 200;
const UNSAFE_NAME = /[/\\]/;
const SHARE_FILE_TYPE = "application/zip";

function hasControlCharacter(name: string): boolean {
  for (const character of name) {
    const code = character.codePointAt(0);
    if (code !== undefined && (code < 0x20 || code === 0x7f)) return true;
  }
  return false;
}

function shareName(name: string): string {
  if (typeof name !== "string" || !name.trim() || name.length > MAX_SHARE_NAME || !name.toLowerCase().endsWith(".zip")) throw projectFileError("invalid share name");
  if (UNSAFE_NAME.test(name) || hasControlCharacter(name)) throw projectFileError("invalid share name");
  return name;
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { readonly name?: unknown }).name === "AbortError";
}

/**
 * Prepares a package for the browser share sheet.
 *
 * The archive bytes are copied into a private `File` before returning, so later
 * caller mutations cannot change what is shared. `share()` calls `port.share`
 * synchronously from the user gesture, without awaiting any I/O first, and never
 * creates, writes or auto-sends an archive. Hosts without `canShare` report
 * `unavailable` instead of claiming that native sharing happened.
 */
export function preparePackageShare(
  bytes: Uint8Array,
  name: string,
  port: Pick<Navigator, "canShare" | "share"> = navigator,
): PreparedPackageShare {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > PACKAGE_LIMITS.archiveBytes) throw projectFileError("invalid share data");
  const safeName = shareName(name);
  if (!port || typeof port !== "object") throw projectFileError("invalid share port");
  const file = new File([bytes], safeName, { type: SHARE_FILE_TYPE });

  const available = (): boolean => {
    try {
      return typeof port.canShare === "function" && typeof port.share === "function" && port.canShare({ files: [file] });
    } catch {
      return false;
    }
  };

  return Object.freeze({
    name: safeName,
    available,
    share: async (): Promise<PackageShareResult> => {
      if (!available()) return "unavailable";
      try {
        // Called synchronously in the click handler: nothing is awaited before this.
        await port.share({ files: [file] });
        return "shared";
      } catch (error) {
        return isAbortError(error) ? "cancelled" : "failed";
      }
    },
  });
}