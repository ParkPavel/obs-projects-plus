import type { DataRecord } from "src/lib/dataframe/dataframe";
import { matchesParsed, parseSearchQuery } from "./tableSearchMatch";

const CHUNK_SIZE = 128;
const TIME_BUDGET_MS = 4;

/**
 * Large tables must not scan in the input/Svelte flush. Yield macrotasks,
 * publish only complete results, and discard work on a new query/frame or
 * unmount. Small tables retain immediate filtering and the same predicate.
 */
export function createTableSearch(
  onResult: (records: DataRecord[]) => void,
  onPending: (pending: boolean) => void,
) {
  let timer: number | undefined;
  let timerWindow: Window | undefined;
  let revision = 0;
  let destroyed = false;

  function cancel(): void {
    revision++;
    if (timer !== undefined) timerWindow?.clearTimeout(timer);
    timer = undefined;
  }

  return {
    update(records: readonly DataRecord[], query: string, ownerWindow: Window = window, fieldNames: readonly string[] = []): void {
      cancel();
      if (destroyed) return;
      timerWindow = ownerWindow;
      const parsed = parseSearchQuery(query, fieldNames);
      if (!parsed.terms.length || records.length <= CHUNK_SIZE) {
        onResult(parsed.terms.length ? records.filter((r) => matchesParsed(r, parsed)) : [...records]);
        onPending(false);
        return;
      }
      onPending(true);
      const ownRevision = revision;
      const result: DataRecord[] = [];
      let index = 0;

      function chunk(): void {
        timer = undefined;
        if (destroyed || ownRevision !== revision) return;
        const started = ownerWindow.performance.now();
        let scanned = 0;
        do {
          const record = records[index++];
          if (record && matchesParsed(record, parsed)) result.push(record);
          scanned++;
        } while (index < records.length && scanned < CHUNK_SIZE && ownerWindow.performance.now() - started < TIME_BUDGET_MS);
        if (index < records.length) {
          timer = ownerWindow.setTimeout(chunk, 0);
        } else {
          onResult(result);
          onPending(false);
        }
      }
      timer = ownerWindow.setTimeout(chunk, 0);
    },
    destroy(): void {
      destroyed = true;
      cancel();
    },
  };
}
