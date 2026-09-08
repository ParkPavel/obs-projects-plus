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
export function brokenCopyPath(
  dir: string | undefined,
  at: Date
): string | null {
  if (dir === undefined || dir === "") return null;
  return `${dir}/data.broken-${stamp(at)}.json`;
}

/**
 * #200 — where the OTHER version goes when memory and disk disagree.
 *
 * A sibling of `brokenCopyPath` rather than the same name: `data.broken-*`
 * would be a lie about a file that is perfectly well formed and simply belongs
 * to somebody else — a second window, a synchroniser, a hand edit. The name is
 * what the user reads in the notice, so it has to say which of the two things
 * happened.
 */
export function conflictCopyPath(
  dir: string | undefined,
  at: Date,
  token = randomToken()
): string | null {
  if (dir === undefined || dir === "") return null;
  return `${dir}/data.conflict-${stamp(at)}-${token}.json`;
}

/**
 * Six hex characters, appended to the timestamp.
 *
 * Both reviews of #200 arrived at this from opposite ends. The first said never
 * to write a path whose absence cannot be established, and offered a
 * high-entropy suffix as the way out; the second found that two external-change
 * callbacks landing in the same millisecond both see the timestamped name as
 * free and both write it, the second silently replacing the first recovery
 * file. A name nobody else can generate answers both without asking the adapter
 * a question it may not be able to answer.
 *
 * `Math.random` is right here: this is a collision-avoidance token, not a
 * secret, and nothing about the recovery file depends on it being unguessable.
 */
function randomToken(): string {
  return Math.random().toString(16).slice(2, 8).padEnd(6, "0");
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
    //
    // #200 briefly answered the opposite for the conflict copy, because there
    // the caller overwrites `data.json` once the copy reports success. That was
    // the wrong lever: the danger is a name somebody else might hold, so the
    // conflict copy stopped depending on the answer instead — its name carries
    // a random token, and absence follows from how it was built.
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

/**
 * #200 — preserve the version this session refused to adopt.
 *
 * Written VERBATIM, unlike the broken copy: this file is valid settings that
 * somebody meant, so the useful recovery is renaming it back over `data.json`,
 * and a wrapper object would make that impossible. The broken copy wraps
 * because its payload is evidence rather than settings.
 *
 * Returns the path written or `null`, and the caller must branch on it: a
 * notice naming a file that was never written is the #195 defect one level up.
 */
export async function writeConflictCopy(
  adapter: BrokenCopyAdapter,
  dir: string | undefined,
  payload: string,
  at: Date
): Promise<string | null> {
  const base = conflictCopyPath(dir, at);
  if (base === null) return null;
  // `freeName` still asks, because a check that CAN be answered is worth having
  // — but an adapter that cannot answer no longer costs the copy, since the
  // name already carries enough entropy that absence is a property of how it
  // was built rather than of what the file system says.
  const path = await freeName(adapter, base);
  if (path === null) return null;
  try {
    await adapter.write(path, payload);
    return path;
  } catch {
    return null;
  }
}
