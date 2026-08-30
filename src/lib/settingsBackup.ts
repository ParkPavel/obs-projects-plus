/**
 * #145 — a restore point for the migrations that rewrite a dashboard on open.
 *
 * `DashboardView.onOpen` runs two of them — a legacy `TableConfig` rewrite and
 * the #118 transform split — and persists the result. Both are conservative and
 * idempotent, but the first write is irreversible and the UI offers no undo.
 * The existing backup in `main.ts` covers a different case: settings that could
 * not be parsed at all, which a successful migration never reaches.
 *
 * **The copy is taken from memory, not from disk.** The first cut read
 * `data.json` back and deferred the migrated save until the read finished.
 * Cross-model review found the hole: between the deferred save and the read,
 * the user (or a second tab, or the view being closed) can persist a newer
 * dashboard, and the late write then overwrites it with a stale config. The
 * migration being idempotent does not protect against a lost update.
 *
 * So the pre-migration config — which the caller is already holding — is what
 * gets written, and the migrated save stays synchronous, exactly as it was
 * before this feature existed. The backup can then be as slow as it likes.
 *
 * **One backup per migration event, not per view.** The first version wrote at
 * most one file per view, reasoning that a later migration would capture an
 * already-migrated shape. Live testing in the OBStests vault (2026-08-28)
 * showed the reasoning is wrong and the cost is real: a second legacy pipeline
 * introduced into the same view migrated correctly and its pre-state was
 * silently not preserved, because a backup from the first event already
 * existed. Each event has its own distinct pre-state, and that is precisely
 * what the payload holds — so each event gets its own file.
 *
 * The file count stays small on its own: a migration only fires when there is
 * something legacy left to migrate, which for any given view happens once and
 * then never again unless a config is hand-edited or imported.
 */
import type { App } from "obsidian";

const BACKUP_PREFIX = "migration-backup-";

function pluginDir(app: App): string {
  return `${app.vault.configDir}/plugins/obs-projects-plus`;
}

/** Slug that identifies which view a backup belongs to. */
function backupKey(projectId: string, viewId: string): string {
  return `${projectId}-${viewId}`.replace(/[^A-Za-z0-9_-]/g, "_");
}

/**
 * `exists` throwing must not cancel the backup: a name that is probably free is
 * better than no restore point at all. Cross-model audit, 2026-08-28 — the
 * first version let the rejection escape the naming loop, so an adapter hiccup
 * silently skipped the write entirely.
 */
async function taken(app: App, path: string): Promise<boolean> {
  try {
    return await app.vault.adapter.exists(path);
  } catch {
    return false;
  }
}

/** How many pre-migration backups this view already has on disk. */
export async function countMigrationBackups(
  app: App,
  projectId: string,
  viewId: string
): Promise<number> {
  const dir = pluginDir(app);
  const prefix = `${BACKUP_PREFIX}${backupKey(projectId, viewId)}-`;
  try {
    const listing = await app.vault.adapter.list(dir);
    return listing.files.filter((file) => file.slice(dir.length + 1).startsWith(prefix))
      .length;
  } catch {
    // Unreadable directory: report nothing rather than guessing. The write below
    // is attempted regardless, and a failed write never blocks a migration.
    return 0;
  }
}

/**
 * Writes the pre-migration configuration of one view, once per migration event.
 *
 * Returns the backup path, or `null` when the write failed — a migration must
 * never be blocked by its restore point. Never overwrites an existing file: the
 * name carries an ISO timestamp, and a name collision would mean two migrations
 * in the same millisecond for the same view.
 */
export async function writeMigrationBackup(args: {
  readonly app: App;
  readonly projectId: string;
  readonly viewId: string;
  readonly config: unknown;
}): Promise<string | null> {
  const { app, projectId, viewId, config } = args;
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const base = `${pluginDir(app)}/${BACKUP_PREFIX}${backupKey(projectId, viewId)}-${stamp}`;
    // Millisecond stamps collide when two migrations of the same view land in
    // the same tick. Rare in a vault, routine in a test — and an overwrite here
    // would destroy the very state this exists to keep, so the name yields
    // rather than the file.
    let target = `${base}.json`;
    for (let n = 2; n < 100 && (await taken(app, target)); n++) {
      target = `${base}-${n}.json`;
    }
    const payload = JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        reason: "dashboard config migration (#145)",
        projectId,
        viewId,
        config,
      },
      null,
      2
    );
    await app.vault.adapter.write(target, payload);
    return target;
  } catch (error) {
    console.error("[obs-projects-plus] migration backup failed", error);
    return null;
  }
}
