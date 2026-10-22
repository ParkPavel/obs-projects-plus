/**
 * i3-final — the values a key holds across this project's notes, memoized.
 *
 * The block asked for them on every render (the colour palette, each opened
 * select), and every ask scanned every markdown file of the vault (audit P2).
 * The other notes' values are now kept per (note, scope, key) and dropped when
 * the metadata cache reports a change — debounced, so a burst of `changed`
 * events during a sync costs one clear. The note's own values are read fresh
 * on every ask and always come first, so an edit in this note shows at once.
 */

import { inScope, valuesForKey, type NoteScope } from "./noteProperties";

export interface UsedValuesSource {
  /** Every markdown file of the vault. */
  files(): ReadonlyArray<{ path: string }>;
  frontmatterOf(file: { path: string }): Record<string, unknown> | null | undefined;
}

export interface UsedValuesCache {
  /** The values of `key`: the note's own first, then the other notes' in `scope`. */
  get(
    path: string,
    own: Record<string, unknown> | null | undefined,
    key: string,
    scope: NoteScope,
  ): string[];
  /** Drop every memo now. */
  invalidate(): void;
  /** Drop every memo once the events stop for `debounceMs`. */
  invalidateSoon(): void;
  /** Cancel a pending clear (the block is gone). */
  dispose(): void;
  /** Vault scans made so far (for tests and diagnostics). */
  scans(): number;
}

const LIMIT = 200;

export function createUsedValuesCache(
  source: UsedValuesSource,
  debounceMs = 300,
): UsedValuesCache {
  const memo = new Map<string, string[]>();
  let timer: number | null = null;
  let scanCount = 0;

  function others(path: string, key: string, scope: NoteScope): string[] {
    const id = `${path}\u0000${scope.folder}\u0000${scope.recursive ? 1 : 0}\u0000${key}`;
    const hit = memo.get(id);
    if (hit) return hit;
    scanCount += 1;
    const values = valuesForKey(
      source
        .files()
        .filter((f) => f.path !== path && inScope(f.path, scope))
        .map((f) => source.frontmatterOf(f)),
      key,
      LIMIT,
    );
    memo.set(id, values);
    return values;
  }

  function cancel(): void {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  }

  return {
    get(path, own, key, scope) {
      const mine = valuesForKey([own], key, LIMIT);
      const merged = new Set(mine);
      for (const v of others(path, key, scope)) {
        if (merged.size >= LIMIT) break;
        merged.add(v);
      }
      return [...merged];
    },
    invalidate() {
      cancel();
      memo.clear();
    },
    invalidateSoon() {
      cancel();
      timer = window.setTimeout(() => {
        timer = null;
        memo.clear();
      }, debounceMs);
    },
    dispose: cancel,
    scans: () => scanCount,
  };
}
