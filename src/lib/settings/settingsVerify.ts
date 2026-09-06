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
 * Hence: read the file back and compare. The comparison is structural rather
 * than textual because the host owns the formatting — indentation, key order
 * and trailing newline are its business, and a comparison that failed on those
 * would turn every successful save into a false alarm, which is worse than the
 * defect it guards.
 */

/**
 * Deterministic JSON: objects with their keys sorted, arrays in order.
 *
 * `undefined` inside an object is dropped exactly as `JSON.stringify` drops it,
 * so a value that could not survive the round trip is not treated as a
 * difference.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null) ?? "null";
  }
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
 * Did `raw` — the text now on disk — come from writing `written`?
 *
 * Unparseable text is a mismatch, not an exception: a half-written file is
 * precisely the case this exists to catch, and it must reach the user through
 * the same path as any other failed write.
 */
export function payloadMatches(written: unknown, raw: string): boolean {
  let onDisk: unknown;
  try {
    onDisk = JSON.parse(raw);
  } catch {
    return false;
  }
  return stableStringify(onDisk) === stableStringify(written);
}
