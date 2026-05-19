import type { DataFieldType, DataField } from "src/lib/dataframe/dataframe";

 
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
  /**
   * #044.3a cross-widget receiver flag: row matches the canvas-level selection
   * emitted by another widget. Additive/optional so standalone Table consumers
   * — which never set this — keep their existing un-styled appearance.
   */
  readonly highlighted?: boolean;
  /**
   * #044.3a cross-widget receiver flag: row does NOT match an active selection
   * from another widget. Renders at reduced opacity. Additive/optional for the
   * same backwards-compat reason as `highlighted`.
   */
  readonly dimmed?: boolean;
}
