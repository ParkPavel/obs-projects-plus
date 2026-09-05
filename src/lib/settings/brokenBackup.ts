/**
 * #195 — where the forensic copy of unreadable settings is kept.
 *
 * The copy used to be written into `data.json` itself, as sibling keys next to
 * restored defaults. That file is rewritten WHOLE by every ordinary save, so
 * the copy survived only until the next one — and a live run found the next one
 * arriving immediately: with the project list empty, the view offers onboarding,
 * and creating the demo project saves settings over the copy the notice had just
 * told the user to look for.
 *
 * #185 closed one route to that write (the store's echo). This module closes the
 * class instead of the route: while the copy lives in the file the plugin
 * rewrites, every future write is a new way to lose it.
 *
 * So the copy goes to a sibling file that nothing else touches, and the notice
 * names it. Two properties matter and are both tested:
 *
 *   - **The name is unique per episode.** A second corruption must not overwrite
 *     the first copy, because the first is the one that holds the user's real
 *     data — the second may already be a copy of restored defaults.
 *   - **Failure is reported, not assumed.** The writer returns the path it wrote
 *     or `null`, and the caller's message differs accordingly. Promising a file
 *     that was never written is the same defect one level down.
 */

/** The minimum of Obsidian's `DataAdapter` this needs. Injected, never imported. */
export interface BrokenCopyAdapter {
  write(path: string, data: string): Promise<void>;
  read(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
}

/** Timestamp in a form that is legal in a filename on every host. */
function stamp(at: Date): string {
  return at.toISOString().replace(/[:.]/g, "-");
}

/**
 * The copy's path for one episode. `dir` is the plugin folder
 * (`manifest.dir`); it is optional in Obsidian's own typing, so callers that
 * cannot supply it get `null` rather than a path relative to the vault root.
 */
export function brokenCopyPath(dir: string | undefined, at: Date): string | null {
  if (dir === undefined || dir === "") return null;
  return `${dir}/data.broken-${stamp(at)}.json`;
}

/** The settings file itself, for reading back a payload `loadData` could not parse. */
export function settingsFilePath(dir: string | undefined): string | null {
  if (dir === undefined || dir === "") return null;
  return `${dir}/data.json`;
}

/**
 * Read what is on disk when Obsidian's own parse failed. Returns the raw text,
 * or `null` if it cannot be read — the caller then has nothing to copy, which
 * is a different message from a copy that failed to write.
 */
export async function readRawSettings(
  adapter: BrokenCopyAdapter,
  dir: string | undefined
): Promise<string | null> {
  const path = settingsFilePath(dir);
  if (path === null) return null;
  try {
    if (!(await adapter.exists(path))) return null;
    return await adapter.read(path);
  } catch {
    return null;
  }
}

/**
 * The first unused name at or after `base`, or `null` if the adapter cannot say.
 *
 * The ceiling is deliberate and low: ten collisions on one millisecond means
 * something other than corruption is happening, and looping further would turn
 * a recovery path into a spin.
 */
async function freeName(
  adapter: BrokenCopyAdapter,
  base: string
): Promise<string | null> {
  try {
    if (!(await adapter.exists(base))) return base;
    for (let n = 2; n <= 10; n += 1) {
      const candidate = base.replace(/\.json$/, `-${n}.json`);
      if (!(await adapter.exists(candidate))) return candidate;
    }
    return null;
  } catch {
    // An adapter that cannot answer `exists` is not a reason to lose the copy:
    // writing over a name that probably does not exist beats not writing.
    return base;
  }
}

/**
 * Write the forensic copy. Returns the path written, or `null` on any failure —
 * including a missing plugin directory, which is why the caller must branch on
 * the result rather than on the absence of an exception.
 *
 * `payload` is text, not an object: on the truncated-JSON path there is no
 * object to serialise, and the bytes as they are on disk are the evidence.
 */
export async function writeBrokenCopy(
  adapter: BrokenCopyAdapter,
  dir: string | undefined,
  payload: string,
  reason: string,
  at: Date
): Promise<string | null> {
  const base = brokenCopyPath(dir, at);
  if (base === null) return null;
  // The timestamp alone is not a guarantee: two episodes can round to the same
  // millisecond, and a file with that name may already exist for reasons this
  // module cannot see. Since the whole point is that the FIRST copy is never
  // touched, the name is checked rather than assumed.
  const path = await freeName(adapter, base);
  if (path === null) return null;
  const contents = JSON.stringify(
    {
      __broken_backup_reason: reason,
      __broken_backup_at: at.toISOString(),
      __broken_backup_raw: payload,
    },
    null,
    2
  );
  try {
    await adapter.write(path, contents);
    return path;
  } catch {
    return null;
  }
}
