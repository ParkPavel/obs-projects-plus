/**
 * #199 — what a settings write actually put on disk.
 *
 * #185 treated a resolved `saveData` promise as proof that the file changed. A
 * live run showed that it is not: with `data.json` made read-only, the write
 * reported success, the file did not change, and nothing reached the user —
 * the retries, the chip and the notice all hang off a rejection that never
 * came. Node's own `fs.writeFile` throws `EPERM` on that same file, so the
 * refusal exists; it is lost somewhere inside the host.
 *
 * Hence: read the file back and compare. Two things make that harder than it
 * sounds, and both are handled here rather than at the call site.
 *
 * **Formatting belongs to the host.** Indentation, key order and the trailing
 * newline are its business, so the comparison is structural. It also compares
 * what JSON persistence would actually produce, not the in-memory object: a
 * `Date` is written as a string and read back as one, and a check that called
 * that a difference would raise "not saved" on a perfectly good save.
 *
 * **Someone else may write the same file.** A second Obsidian window or a
 * synchroniser can replace `data.json` between the write and the read-back. The
 * file then matches neither what was written nor what was there before — and
 * that is NOT this plugin's write failing. Retrying there would overwrite
 * somebody's change with a value they never asked for, so the three cases are
 * named apart rather than collapsed into a boolean.
 */

/** What the file on disk says about the write that just claimed to succeed. */
export type DiskVerdict =
  /** The file holds what was written. */
  | "confirmed"
  /** The file is unchanged, or unreadable: the write did not land. */
  | "not-written"
  /** Someone else wrote something else. Not this writer's failure. */
  | "superseded";

/**
 * Deterministic JSON: objects with their keys sorted, arrays in order.
 *
 * Feed it values that have already been through a JSON round trip — see
 * `asPersisted` — so that `Date`, `NaN` and friends are already in the form the
 * file would hold.
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(",")}}`;
}

/**
 * `value` as JSON persistence would leave it: `Date` becomes a string, `NaN`
 * and `Infinity` become null, a `Map` becomes `{}`, `undefined` disappears.
 *
 * Returns `null` for a value JSON cannot represent at all (a cycle, a BigInt) —
 * such a value could not have been written either.
 */
function asPersisted(value: unknown): unknown | null {
  try {
    const text = JSON.stringify(value);
    if (text === undefined) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The canonical form used for comparison, or `null` when there is none. */
export function canonical(value: unknown): string | null {
  const persisted = asPersisted(value);
  if (persisted === null && value !== null) return null;
  return stableStringify(persisted);
}

/**
 * Did `raw` — the text now on disk — come from writing `written`?
 *
 * `previous` is the canonical form last known to be on disk; pass `null` when
 * that is unknown, and a mismatch is then read as a failed write, which is the
 * safe direction for a first write.
 */
export function classifyDisk(
  written: unknown,
  raw: string,
  previous: string | null
): DiskVerdict {
  const expected = canonical(written);
  if (expected === null) return "not-written";

  let onDisk: string;
  try {
    onDisk = stableStringify(JSON.parse(raw));
  } catch {
    // A half-written or truncated file. Whoever produced it, this writer's
    // value is not what is there, and the user needs to know.
    return "not-written";
  }

  if (onDisk === expected) return "confirmed";
  if (previous !== null && onDisk !== previous) return "superseded";
  return "not-written";
}

/** Convenience for callers that only need the yes/no. */
export function payloadMatches(written: unknown, raw: string): boolean {
  return classifyDisk(written, raw, null) === "confirmed";
}
