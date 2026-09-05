/**
 * #185 — when a migration has to be written back.
 *
 * Until now the result of a v1→v4 migration reached the disk only as a side
 * effect: the settings store fired once on subscribe and that echo was written.
 * Removing the echo without replacing it would leave a v1 file on disk until
 * the user happened to change something, so the write is now explicit — and
 * explicit means it needs a rule for WHEN.
 *
 * The rule is the version, not the shape. `migrateSettings` also normalises
 * (fills in defaults, resolves view types) on a payload that is already
 * current, and rewriting `data.json` for that would mean every launch rewrites
 * the file — a write per open, and a fresh mtime on a synchronised vault, for
 * no change the user made.
 */
export function versionOnDisk(raw: unknown, current: number): number | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    // No settings file yet, or nothing usable in it. Nothing is written: the
    // defaults live in memory and are recomputed on every load, so a vault that
    // has never configured the plugin does not get a `data.json` for opening it.
    return null;
  }
  const version = (raw as { version?: unknown }).version;
  if (typeof version !== "number" || version === current) return null;
  return version;
}
