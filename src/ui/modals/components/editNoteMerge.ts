import type { DataRecord } from "src/lib/dataframe/dataframe";

/**
 * #101 — Live-modal dirty-merge. Reconciles a locally-edited record with the
 * latest version from the store using last-writer-wins per field:
 *   - untouched field (not in `dirty`) → store value wins
 *   - field the user touched (in `dirty`) → local value wins
 * `id` is taken from the store record (identity is stable across both).
 */
export function mergeExternal(
  local: DataRecord,
  store: DataRecord,
  dirty: Set<string>
): DataRecord {
  if (dirty.size === 0) {
    return store;
  }

  const values = { ...store.values };
  for (const key of dirty) {
    values[key] = local.values[key];
  }

  return { id: store.id, values };
}
