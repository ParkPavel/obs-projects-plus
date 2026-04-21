import type { DataFieldType, DataField } from "src/lib/dataframe/dataframe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic row model with dynamic column values
export type GridValidRowModel = { [key: string]: any };
export type GridRowModel<R extends GridValidRowModel = GridValidRowModel> = R;
export type GridColType = DataFieldType;

export interface GridColDef extends DataField {
  readonly field: string;
  readonly width?: number;
  readonly hide?: boolean;
  readonly editable?: boolean;
  readonly header?: boolean;
  readonly pinned?: boolean;
}

export type GridRowId = string;

export interface GridRowProps {
  readonly rowId: GridRowId;
  readonly row: GridRowModel;
  /** Optional per-cell inline styles (field name → CSS string). */
  readonly cellStyles?: Record<string, string>;
}
