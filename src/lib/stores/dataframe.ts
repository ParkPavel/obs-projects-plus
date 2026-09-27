import { produce, castDraft } from "immer";
import { writable } from "svelte/store";

import {
  DataFieldType,
  type DataField,
  type DataFrame,
  type DataRecord,
} from "src/lib/dataframe/dataframe";
import type { DataSource } from "../datasources";
import type { IdentifiedFrame } from "../datasources/sourceSelection";

export const dataSource = writable<DataSource | undefined>();

// #016 — Reactive loop fix (Option A from 016_PHASE1_ANALYTICS_PLAN.md).
//
// Downstream consumers (e.g. transform cache in
// src/ui/views/Dashboard/engine/transformCache.ts) keep hashed/derived data
// that must be invalidated atomically with dataFrame mutations. Previously the
// invalidation lived in App.svelte with a 300 ms debounce, racing the
// un-debounced `dataFrame.merge()` path in events.ts → stale cache hits.
//
// Fix: any module wanting to be notified of a dataFrame mutation registers a
// callback here once at plugin init; the callback is invoked **synchronously
// before** each mutator's `update()` so by the time Svelte subscribers fire,
// downstream caches are already cleared.
//
// Layering: dataframe.ts is the data store and is allowed to expose a
// registration hook (low-level → high-level). The UI layer (App.svelte) owns
// the wiring; lib/stores does not import from src/ui.
const invalidationCallbacks = new Set<() => void>();

/**
 * Register a callback fired synchronously before every dataFrame mutation
 * (addRecord, updateRecord(s), deleteRecord, add/update/deleteField, merge).
 *
 * Returns an unsubscribe function. Idempotent for the same callback reference.
 */
export function registerDataFrameInvalidation(
  callback: () => void
): () => void {
  invalidationCallbacks.add(callback);
  return () => {
    invalidationCallbacks.delete(callback);
  };
}

/**
 * Test-only: clear all registered invalidation callbacks. Production code
 * should call the unsubscribe function returned from `registerDataFrameInvalidation`.
 */
export function __clearDataFrameInvalidationCallbacks(): void {
  invalidationCallbacks.clear();
}

function notifyDataFrameInvalidation(): void {
  // Fire each callback inside a try/catch so a buggy listener cannot break
  // store mutations or freeze the reactive pipeline.
  for (const cb of invalidationCallbacks) {
    try {
      cb();
    } catch (err) {
      console.error("[Projects+] dataFrame invalidation callback threw", err);
    }
  }
}

export const dataFrame = createDataFrame();

/**
 * The same records the merge holds, with provenance kept (#170 step 1).
 *
 * `dataFrame` is the project as a whole and stays the default everywhere. This
 * is beside it so a block that names one source can look that source's frame up
 * instead of querying again — acquisition still happens exactly once, in
 * `DataFrameProvider`. Empty until a project resolves; a block that names
 * nothing never reads it.
 */
export const frameParts = writable<IdentifiedFrame[]>([]);

function createDataFrame() {
  const { update, set, subscribe } = writable<DataFrame>({
    fields: [],
    records: [],
  });

  return {
    set,
    subscribe,
    addRecord(record: DataRecord) {
      notifyDataFrameInvalidation();
      update((state) => ({ ...state, records: [...state.records, record] }));
    },
    updateRecord(record: DataRecord) {
      notifyDataFrameInvalidation();
      update((state) => ({
        ...state,
        records: state.records.map((r) => (r.id === record.id ? record : r)),
      }));
    },
    updateRecords(records: DataRecord[]) {
      notifyDataFrameInvalidation();
      update((state) => ({
        ...state,
        records: state.records.map((r) => records.find((_r) => _r.id === r.id) ?? r),
      }));
    },
    deleteRecord(id: string) {
      notifyDataFrameInvalidation();
      update((state) => ({ ...state, records: state.records.filter((record) => record.id !== id) }));
    },
    addField(newField: DataField, position?: number) {
      notifyDataFrameInvalidation();
      update((state) => {
        const fields = [...state.fields];
        if (position) fields.splice(position, 0, newField);
        else fields.push(newField);
        return { ...state, fields };
      });
    },
    updateField(updated: DataField, oldName?: string) {
      notifyDataFrameInvalidation();
      update((state) => ({
        ...state,
        fields: state.fields
          .map((field) => (field.name === oldName ? updated : field))
          .filter((field) => field.name !== oldName),
        records: oldName
          ? state.records.map((record) => {
              const values = { ...record.values };
              values[updated.name] = values[oldName];
              delete values[oldName];
              return { ...record, values };
            })
          : state.records,
      }));
    },
    deleteField(fieldName: string) {
      notifyDataFrameInvalidation();
      update((state) => ({ ...state, fields: state.fields.filter((field) => field.name !== fieldName) }));
    },
    merge(updated: DataFrame) {
      notifyDataFrameInvalidation();
      update((existing) =>
        produce(existing, (draft) => {
          // Merge records.
          const recordSet = Object.fromEntries(
            existing.records.map((record) => [record.id, record])
          );
          updated.records.forEach((record) => {
            recordSet[record.id] = record;
          });
          const records = Object.values(recordSet);
          draft.records = castDraft(records);

          // Merge fields.
          updated.fields.forEach((newField) => {
            const existingField = existing.fields.find(
              (f) => f.name === newField.name
            );

            if (existingField) {
              if (existingField.type !== newField.type) {
                const existingFieldIndex = existing.fields.findIndex(
                  (field) => field.name === newField.name
                );
                draft.fields[existingFieldIndex] = {
                  ...newField,
                  type: DataFieldType.String,
                };
              }
            } else {
              draft.fields.push(newField);
            }
          });

          // Read the plain records, not the draft: immer's draft type for the
          // DataRecord union exceeds TypeScript's instantiation depth (TS2589).
          draft.fields = draft.fields.filter((field) =>
            records.some((record) => record.values[field.name] !== undefined)
          );

          // Merge errors.
          const updatedIds = updated.records.map((record) => record.id);

          // Remove previously errored records.
          draft.errors =
            draft.errors?.filter((err) => !updatedIds.includes(err.recordId)) ??
            [];

          // Add new errors.
          draft.errors = [...draft.errors, ...(updated.errors ?? [])];
        })
      );
    },
  };
}
