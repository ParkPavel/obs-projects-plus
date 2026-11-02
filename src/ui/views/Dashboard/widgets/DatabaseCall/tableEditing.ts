import { writable } from "svelte/store";
import { Notice } from "obsidian";
import type { DataField, DataRecord, DataValue, Optional } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import { updateRecordValues } from "src/lib/datasources/helpers";
import { noticeFor } from "src/lib/errors/errorText";
import type { RenderRow } from "./tableCanon";

interface EditingCell { recordId: string; field: string }
interface EditState {
  cell: EditingCell | null;
  rows: RenderRow[] | null;
  saving: boolean;
  retry: number;
}
export interface CellCommit { record: DataRecord; field: string; value: Optional<DataValue> }

/** One table edit owns its stable row and draft until persistence is acknowledged. */
export function createTableEditing(api: () => ViewApi, fields: () => DataField[]) {
  let state: EditState = { cell: null, rows: null, saving: false, retry: 0 };
  const store = writable(state);
  let alive = true;
  const set = (patch: Partial<EditState>) => { state = { ...state, ...patch }; if (alive) store.set(state); };
  const finish = () => set({ cell: null, rows: null });
  return {
    subscribe: store.subscribe,
    start(cell: EditingCell, rows: RenderRow[]): void {
      if (state.saving || state.cell) return;
      set({ cell, rows });
    },
    cancel(): void { if (!state.saving) finish(); },
    destroy(): void { alive = false; },
    async commit({ record, field, value }: CellCommit): Promise<void> {
      if (state.saving || !alive) return;
      const session = state.cell;
      if (record.values[field] === value) { finish(); return; }
      set({ saving: true });
      try {
        const written = await api().updateRecord(updateRecordValues(record, { [field]: value }), fields());
        if (alive && state.cell === session) {
          if (written) finish();
          else set({ retry: state.retry + 1 });
        }
      } catch (error) {
        if (alive && state.cell === session) set({ retry: state.retry + 1 });
        new Notice(noticeFor("PPP-201", { path: record.id }));
        console.error("[Projects+] table cell write failed", error);
      } finally { set({ saving: false }); }
    },
  };
}

/** Re-arm exactly once when the writer reports a failed attempt. */
export function onCellRetry(reset: () => void): (version: number) => void {
  let last = 0;
  return (version) => { if (version !== last) { last = version; reset(); } };
}
