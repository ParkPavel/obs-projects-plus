/**
 * obsidian-projects-types — public type contracts for Custom Views
 * registered against the obs-projects-plus host plugin.
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  v3.0.0 — BREAKING CHANGES (v4.0 refactor / REFACTOR-007)             ║
 * ╠═══════════════════════════════════════════════════════════════════════╣
 * ║  This package re-exports a frozen MIRROR of the internal Custom View  ║
 * ║  API in `src/customViewApi.ts`. The host plugin is the SINGLE SOURCE  ║
 * ║  OF TRUTH; this file MUST stay synchronised with it on each major     ║
 * ║  bump. Do NOT edit one without the other.                             ║
 * ║                                                                       ║
 * ║  v2 → v3 migration cheatsheet:                                        ║
 * ║    DataFrame              + readonly errors?                          ║
 * ║    DataField              + readonly typeConfig?                      ║
 * ║    DataFieldType          + List, Select, Status, Formula,            ║
 * ║                             Relation, Rollup                          ║
 * ║    DataQueryResult        + dataGeneration?, hasSort, hasFilter,      ║
 * ║                             filterConditions?                         ║
 * ║    ProjectDefinition      + dateFormat?, autosave?, agenda?           ║
 * ║    ProjectViewProps       + saveViewFilter?, getRecordColor,          ║
 * ║                             sortRecords, getRecord                    ║
 * ║                                                                       ║
 * ║  Anything tagged `@deprecated` will be removed in v4.x.               ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 *
 * @see ../docs/PHASE_3_TICKETS.md REFACTOR-007
 * @since 3.0.0
 */

// ═════════════════════════════════════════════════════════════════════════
// Identity & primitives
// ═════════════════════════════════════════════════════════════════════════

export type ProjectId = string;
export type ViewId = string;

/**
 * `T | undefined | null`. Distinct in semantics:
 *   - `undefined` — field has been REMOVED from a DataRecord.
 *   - `null`      — field exists but has no value yet.
 */
export type Optional<T> = T | undefined | null;

// ═════════════════════════════════════════════════════════════════════════
// DataFrame primitives
// ═════════════════════════════════════════════════════════════════════════

/**
 * Vault-scoped record-shape error surfaced from datasource parsing.
 *
 * `position` is opaque — host plugin uses it for click-to-source navigation.
 */
export interface RecordError {
  readonly recordId: string;
  readonly message: string;
  readonly position?: { readonly line?: number; readonly column?: number };
}

/**
 * DataFrame is the core data structure that contains structured data for a
 * collection of notes.
 */
export type DataFrame = {
  readonly fields: DataField[];
  readonly records: DataRecord[];
  /**
   * @since 3.0.0
   * Soft errors emitted by the datasource parser. Custom views may surface
   * them in a non-blocking diagnostic panel.
   */
  readonly errors?: RecordError[];
};

/**
 * DataField holds metadata for a value in DataRecord, for example a front
 * matter property.
 */
export type DataField = {
  readonly name: string;
  readonly type: DataFieldType;
  /**
   * @since 3.0.0
   * User-defined per-field configuration (select options, date precision,
   * relation target etc.). Shape is plugin-private and intentionally
   * opaque to external custom views.
   */
  readonly typeConfig?: Readonly<Record<string, unknown>>;
  readonly repeated: boolean;
  readonly identifier: boolean;
  /**
   * Derived fields are computed from other fields and cannot be modified
   * via the ViewApi.
   */
  readonly derived: boolean;
};

export enum DataFieldType {
  String = "string",
  Number = "number",
  Boolean = "boolean",
  Date = "date",
  /** @since 3.0.0 — multi-text (tags / list of strings). */
  List = "multitext",
  /** @since 3.0.0 — bounded set, single value. */
  Select = "select",
  /** @since 3.0.0 — status (Notion-style with workflow groups). */
  Status = "status",
  /** @since 3.0.0 — derived value computed from a formula expression. */
  Formula = "formula",
  /** @since 3.0.0 — wiki-link to another record (cross-project supported). */
  Relation = "relation",
  /** @since 3.0.0 — aggregate over a related record's column. */
  Rollup = "rollup",
  Unknown = "unknown",
}

export type DataRecord = {
  readonly id: string;
  readonly values: Record<string, Optional<DataValue>>;
};

export type DataValue =
  | string
  | number
  | boolean
  | Date
  | Array<Optional<DataValue>>;

// ═════════════════════════════════════════════════════════════════════════
// Filter / Sort surface (read-only mirror; full alphabet in host plugin)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Open string union for filter operators. The host plugin owns the full
 * canonical alphabet (~30 operators) — kept open here so external custom
 * views remain forward-compatible when new operators land.
 *
 * @since 3.0.0
 */
export type FilterOperator = string;

export interface FilterCondition {
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value?: string;
  readonly enabled: boolean;
}

export interface FilterDefinition {
  readonly conjunction?: "and" | "or";
  readonly conditions: FilterCondition[];
  readonly groups?: FilterDefinition[];
}

// ═════════════════════════════════════════════════════════════════════════
// Date format / Agenda (opaque shapes; consumed by built-in views only)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Per-project date-format preference.
 *
 * The exact shape is plugin-private. Custom views should treat this as
 * an opaque object and pass it back unchanged when persisting config.
 *
 * @since 3.0.0
 */
export type DateFormatConfig = Readonly<Record<string, unknown>>;

/**
 * Per-project Agenda 2.0 configuration. Opaque to external custom views.
 *
 * @since 3.0.0
 */
export type AgendaConfig = Readonly<Record<string, unknown>>;

// ═════════════════════════════════════════════════════════════════════════
// DataSource
// ═════════════════════════════════════════════════════════════════════════

export type DataSource = FolderDataSource | TagDataSource | DataviewDataSource;

export type FolderDataSource = {
  readonly kind: "folder";
  readonly config: {
    readonly path: string;
    readonly recursive: boolean;
  };
};

export type TagDataSource = {
  readonly kind: "tag";
  readonly config: {
    readonly tag: string;
    readonly hierarchy: boolean;
  };
};

export type DataviewDataSource = {
  readonly kind: "dataview";
  readonly config: {
    readonly query: string;
  };
};

// ═════════════════════════════════════════════════════════════════════════
// ProjectDefinition
// ═════════════════════════════════════════════════════════════════════════

/**
 * Public mirror of `src/settings/v3/settings.ts::ProjectDefinition`.
 *
 * The internal type is generic over `ViewDef`; the public mirror collapses
 * that generic because external custom views always observe the resolved
 * `ViewDefinition` shape.
 */
export type ProjectDefinition = {
  readonly name: string;
  readonly id: ProjectId;
  readonly defaultName: string;
  readonly templates: string[];
  readonly excludedNotes: string[];
  readonly isDefault: boolean;
  readonly dataSource: DataSource;
  /** @since 3.0.0 — secondary datasources merged into the primary frame. */
  readonly additionalSources?: DataSource[];
  readonly newNotesFolder: string;
  /** @since 3.0.0 — per-project date-format override. */
  readonly dateFormat?: DateFormatConfig;
  /** @since 3.0.0 — note-editor autosave toggle. Default `true`. */
  readonly autosave?: boolean;
  /** @since 3.0.0 — Agenda 2.0 configuration. */
  readonly agenda?: AgendaConfig;
};

// ═════════════════════════════════════════════════════════════════════════
// ViewApi (write surface; class for `instanceof` ergonomics)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Write-side view API exposed to custom views.
 *
 * NOTE: at runtime, custom views receive the host plugin's concrete
 * implementation via `ProjectViewProps.viewApi`. The class declaration
 * here is a **structural** stub — declared as a class so external code
 * can both type-check (`api: ViewApi`) and `instanceof`-narrow.
 *
 * Methods are intentionally `void` returning; the host implementation
 * may queue I/O asynchronously without changing the public signature.
 */
export class ViewApi {
  addRecord(
    _record: DataRecord,
    _fields: DataField[],
    _templatePath: string
  ): void {}
  updateRecord(_record: DataRecord, _fields: DataField[]): void {}
  /** @since 3.0.0 */
  updateRecords(
    _records: DataRecord[],
    _fields: DataField[]
  ): void | Promise<void> {}
  deleteRecord(_recordId: string): void {}
  /** @since 3.0.0 — value/position for the new field. */
  addField(
    _field: DataField,
    _value?: Optional<DataValue>,
    _position?: number
  ): void {}
  updateField(_field: DataField, _oldName?: string): void {}
  deleteField(_field: string): void {}
}

// ═════════════════════════════════════════════════════════════════════════
// Custom View contract
// ═════════════════════════════════════════════════════════════════════════

export type DataQueryResult = {
  data: DataFrame;
  /**
   * @since 3.0.0
   * Monotonic counter; increments only when the source data frame
   * actually changes. Use to short-circuit expensive recomputes.
   */
  dataGeneration?: number;
  /** @since 3.0.0 — whether host applied a non-trivial sort. */
  hasSort: boolean;
  /** @since 3.0.0 — whether host applied a non-trivial filter. */
  hasFilter: boolean;
  /** @since 3.0.0 — active (enabled) filter conditions for the current view. */
  filterConditions?: FilterCondition[];
};

/**
 * ProjectViewProps provides various metadata for the views.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- View config is plugin-specific; T defaults to any
export interface ProjectViewProps<T = Record<string, any>> {
  viewId: ViewId;
  project: ProjectDefinition;
  config: T;
  saveConfig: (config: T) => void;
  /**
   * @since 3.0.0
   * Persist a new filter definition on the current view. Optional — not
   * all hosts implement promote-to-global UX. When omitted, hide any
   * UI that would call it.
   */
  saveViewFilter?: (filter: FilterDefinition) => void;
  contentEl: HTMLElement;
  viewApi: ViewApi;
  readonly: boolean;
  /**
   * @since 3.0.0
   * Resolves the active color rule for a record. Returns `null` when
   * no rule matches.
   */
  getRecordColor: (record: DataRecord) => string | null;
  /**
   * @since 3.0.0
   * Returns the records sorted per the host's current sort definition.
   * Pure: does not mutate the input array.
   */
  sortRecords: (records: ReadonlyArray<DataRecord>) => DataRecord[];
  /**
   * @since 3.0.0
   * Lookup by record id. Returns `undefined` when the record is no
   * longer in the current frame (deleted, filtered out by source).
   */
  getRecord: (id: string) => DataRecord | undefined;
}

/**
 * ProjectView is the base class for all Project views.
 *
 * To create a new built-in view, create a class that extends this one
 * and register it via `onRegisterProjectView()` in your plugin entry.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- View config is plugin-specific; T defaults to any
export abstract class ProjectView<T = Record<string, any>> {
  onData(_result: DataQueryResult): void {}
  onOpen(_props: ProjectViewProps<T>): void {}
  onClose(): void {}
  abstract getViewType(): string;
  abstract getDisplayName(): string;
  abstract getIcon(): string;
}
