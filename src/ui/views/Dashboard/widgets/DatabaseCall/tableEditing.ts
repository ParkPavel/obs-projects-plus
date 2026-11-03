import { writable } from "svelte/store";
import { Notice } from "obsidian";
import type { DataField, DataRecord, DataValue, Optional } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import { updateRecordValues } from "src/lib/datasources/helpers";
import { noticeFor } from "src/lib/errors/errorText";
import type { RenderRow } from "./tableCanon";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { cellAccess } from "./tableCellAccess";
import { choiceValueAllowed } from "src/lib/suggestions/choiceOptions";

interface EditingCell { recordId: string; field: string }
interface EditState {
  cell: EditingCell | null;
  rows: RenderRow[] | null;
  saving: boolean;
  retry: number;
}
export interface CellCommit { record: DataRecord; field: string; value: Optional<DataValue> }

/** One table edit owns its stable row and draft until persistence is acknowledged. */
export function createTableEditing(api: () => ViewApi, fields: () => DataField[], scope: () => string | undefined = () => undefined, readonly: () => boolean = () => false) {
  let state: EditState = { cell: null, rows: null, saving: false, retry: 0 };
  const store = writable(state);
  let alive = true;
  const context = () => {
    const schema = JSON.stringify(fields());
    return { api: api(), fields: JSON.parse(schema) as DataField[], schema, scope: scope() };
  };
  let owner: ReturnType<typeof context> | null = null;
  const sameWriter = (left: ViewApi, right: ViewApi) => left === right || left.dataSource !== undefined && left.dataSource === right.dataSource && left.dataApi === right.dataApi;
  const valid = (currentApi: ViewApi, currentFields: DataField[], currentScope: string | undefined, blocked: boolean) => !!owner && !blocked &&
    sameWriter(owner.api, currentApi) && owner.scope === currentScope && owner.schema === JSON.stringify(currentFields);
  const set = (patch: Partial<EditState>) => { state = { ...state, ...patch }; if (alive) store.set(state); };
  const finish = () => { owner = null; set({ cell: null, rows: null }); };
  return {
    subscribe: store.subscribe,
    refresh(currentApi: ViewApi, currentFields: DataField[], currentScope: string | undefined, blocked: boolean): void {
      if (owner && !valid(currentApi, currentFields, currentScope, blocked)) finish();
    },
    start(cell: EditingCell, rows: RenderRow[]): void {
      if (state.saving || state.cell || !alive || readonly()) return;
      owner = context();
      set({ cell, rows });
    },
    cancel(): void { if (!state.saving) finish(); },
    destroy(): void { alive = false; owner = null; },
    async commit({ record, field, value }: CellCommit): Promise<void> {
      if (state.saving || !alive) return;
      const session = state.cell;
      if (readonly()) { finish(); return; }
      if (session && (session.recordId !== record.id || session.field !== field)) return;
      if (session && !valid(api(), fields(), scope(), readonly())) { finish(); return; }
      const target = fields().find(candidate => candidate.name === field);
      if (!target || target.identifier || !cellAccess(target, record.values[field], false).editable) return;
      // Checkbox clicks are the only commits that do not open a draft session.
      if (!session && (target.type !== DataFieldType.Boolean || typeof value !== "boolean")) return;
      const writer = owner ?? context();
      if (record.values[field] === value) { finish(); return; }
      if (!choiceValueAllowed(target, value)) { set({ retry: state.retry + 1 }); return; }
      set({ saving: true });
      try {
        const written = await writer.api.updateRecord(updateRecordValues(record, { [field]: value }), writer.fields);
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
