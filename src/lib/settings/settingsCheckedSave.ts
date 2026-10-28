import { canonical } from "./settingsVerify";
import { SETTINGS_WRITE_REFUSED } from "./settingsWriter";

/** The public host port, injected so the read/callback/write interleaving is testable. */
export interface CheckedSettingsAdapter {
  exists(path: string): Promise<boolean>;
  append(path: string, data: string): Promise<void>;
  process(path: string, update: (raw: string) => string): Promise<string>;
}

export interface SettingsWriteBase {
  readonly canonical: string | null;
  /** Exact bytes already seen by recovery, including a damaged JSON payload. */
  readonly raw: string | null;
}

/**
 * Compare inside the host's queued read/modify/write, rather than before a
 * separate saveData call. This serializes writers using that adapter; it is
 * not an OS transaction with an unrelated process writing the file directly.
 * Verification and reconciliation remain owned by the settings writer.
 */
export async function saveCheckedSettings(
  adapter: CheckedSettingsAdapter,
  path: string,
  base: SettingsWriteBase,
  value: unknown
): Promise<void | typeof SETTINGS_WRITE_REFUSED> {
  // Refuse unserializable state before even bootstrapping an empty file.
  const serialized = JSON.stringify(value, null, 2);
  const desired = canonical(value);
  if (serialized === undefined || desired === null) throw new Error("settings are not JSON serializable");
  const fresh = base.canonical === canonical(null) && base.raw === null;
  if (fresh && !(await adapter.exists(path))) {
    // append-empty never truncates a version which appeared after exists().
    // A host refusing creation reports failure; there is no blind-write fallback.
    await adapter.append(path, "");
  }
  let called = false;
  let accepted = false;
  await adapter.process(path, (raw) => {
    called = true;
    let current: string | null = null;
    try { current = canonical(JSON.parse(raw)); } catch { /* recovery compares exact damaged bytes */ }
    accepted = base.canonical !== null ? current === base.canonical || (fresh && raw === "")
      : base.raw !== null && raw === base.raw;
    if (!accepted) return raw;
    return current === desired ? raw : serialized;
  });
  if (!called) throw new Error("settings process did not check the file");
  if (!accepted) return SETTINGS_WRITE_REFUSED;
}
