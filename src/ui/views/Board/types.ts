export interface BoardConfig {
  readonly groupByField?: string;
  readonly checkField?: string;
  readonly headerField?: string;
  /** NPLAN-D2 — page-level icon field (emoji or lucide icon name). */
  readonly iconField?: string;
  readonly orderSyncField?: string;
  readonly columnWidth?: number;
  readonly columns?: ColumnSettings;
  readonly includeFields?: string[];
  readonly freezeAll?: boolean;
  readonly persistedStatuses?: string[];
  readonly boardZoom?: number;
  /**
   * NPLAN-C1 — When `"semantic"`, Board columns are grouped by the
   * `statusGroups` buckets (todo / inProgress / complete) defined on
   * the grouping field's `FieldConfig`. Default `"values"` preserves
   * existing behaviour (columns = unique field values).
   */
  readonly groupMode?: "values" | "semantic";
}

export interface ColumnSettings {
  [name: string]: {
    readonly weight?: number;
    readonly records?: string[];
    readonly collapse?: boolean;
  };
}
