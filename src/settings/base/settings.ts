// Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.1 — RollupFunction is
// imported as type-only to introduce no runtime coupling from the settings
// layer into the Database engine layer.
import type { RollupFunction } from "src/lib/engine/aggregate";

export type ProjectId = string;
export type ViewId = string;

export type ViewType = string;

export interface ViewDefinition {
  readonly name: string;
  readonly id: ViewId;
  readonly type: ViewType;
   
  readonly config: Record<string, any>;
  readonly filter: FilterDefinition;
  readonly colors: ColorFilterDefinition;
  readonly sort: SortDefinition;
}

export interface SortDefinition {
  readonly criteria: SortingCriteria[];
}

export interface SortingCriteria {
  readonly field: string;
  readonly order: SortOrder;
  readonly enabled: boolean;
}

export type SortOrder = "asc" | "desc";

export interface FilterDefinition {
  readonly conjunction?: "and" | "or";
  readonly conditions: FilterCondition[];
  readonly groups?: FilterDefinition[];
}

export interface ColorFilterDefinition {
  readonly conditions: ColorRule[];
}

export interface ColorRule {
  color: string;
  condition: FilterCondition;
}

export type BaseFilterOperator = "is-empty" | "is-not-empty";

export type StringFilterOperator =
  | "is"
  | "is-any-of"
  | "is-not"
  | "contains"
  | "not-contains"
  | "starts-with"
  | "ends-with"
  | "regex";

export function isStringFilterOperator(
  op: FilterOperator
): op is StringFilterOperator {
  return ["is", "is-any-of", "is-not", "contains", "not-contains", "starts-with", "ends-with", "regex"].includes(op);
}

export type NumberFilterOperator = "eq" | "neq" | "lt" | "gt" | "lte" | "gte";

export function isNumberFilterOperator(
  op: FilterOperator
): op is NumberFilterOperator {
  return ["eq", "neq", "lt", "gt", "lte", "gte"].includes(op);
}

export type BooleanFilterOperator = "is-checked" | "is-not-checked";

export function isBooleanFilterOperator(
  op: FilterOperator
): op is BooleanFilterOperator {
  return ["is-checked", "is-not-checked"].includes(op);
}

export type DateFilterOperator =
  | "is-on"
  | "is-not-on"
  | "is-before"
  | "is-after"
  | "is-on-and-before"
  | "is-on-and-after"
  | "is-today"
  | "is-this-week"
  | "is-this-month"
  | "is-this-quarter"
  | "is-this-year"
  | "is-past-week"
  | "is-past-month"
  | "is-past-year"
  | "is-next-week"
  | "is-next-month"
  | "is-next-year"
  | "is-last-n-days"
  | "is-next-n-days"
  | "is-overdue"
  | "is-upcoming";

export function isDateFilterOperator(
  op: FilterOperator
): op is DateFilterOperator {
  return [
    "is-on",
    "is-not-on",
    "is-before",
    "is-after",
    "is-on-and-before",
    "is-on-and-after",
    "is-today",
    "is-this-week",
    "is-this-month",
    "is-this-quarter",
    "is-this-year",
    "is-past-week",
    "is-past-month",
    "is-past-year",
    "is-next-week",
    "is-next-month",
    "is-next-year",
    "is-last-n-days",
    "is-next-n-days",
    "is-overdue",
    "is-upcoming",
  ].includes(op);
}

export type ListFilterOperator =
  | "has-any-of"
  | "has-all-of"
  | "has-none-of"
  | "has-keyword";

export function isListFilterOperator(
  op: FilterOperator
): op is ListFilterOperator {
  return ["has-any-of", "has-all-of", "has-none-of", "has-keyword"].includes(
    op
  );
}

export type FilterOperator =
  | BaseFilterOperator
  | StringFilterOperator
  | NumberFilterOperator
  | BooleanFilterOperator
  | DateFilterOperator
  | ListFilterOperator;

export type FilterOperatorType =
  | "unary"
  | "binary-text"
  | "binary-number"
  | "binary-date"
  | "binary-multitext";

export const filterOperatorTypes: Record<FilterOperator, FilterOperatorType> = {
  "is-empty": "unary",
  "is-not-empty": "unary",
  is: "binary-text",
  "is-any-of": "binary-multitext",
  "is-not": "binary-text",
  contains: "binary-text",
  "not-contains": "binary-text",
  "starts-with": "binary-text",
  "ends-with": "binary-text",
  regex: "binary-text",
  eq: "binary-number",
  neq: "binary-number",
  lt: "binary-number",
  gt: "binary-number",
  lte: "binary-number",
  gte: "binary-number",
  "is-checked": "unary",
  "is-not-checked": "unary",
  "is-on": "binary-date",
  "is-not-on": "binary-date",
  "is-before": "binary-date",
  "is-after": "binary-date",
  "is-on-and-before": "binary-date",
  "is-on-and-after": "binary-date",
  "has-any-of": "binary-multitext",
  "has-all-of": "binary-multitext",
  "has-none-of": "binary-multitext",
  "has-keyword": "binary-text",
  "is-today": "unary",
  "is-this-week": "unary",
  "is-this-month": "unary",
  "is-this-quarter": "unary",
  "is-this-year": "unary",
  "is-past-week": "unary",
  "is-past-month": "unary",
  "is-past-year": "unary",
  "is-next-week": "unary",
  "is-next-month": "unary",
  "is-next-year": "unary",
  "is-last-n-days": "binary-number",
  "is-next-n-days": "binary-number",
  "is-overdue": "unary",
  "is-upcoming": "unary",
};

export function getFilterOperatorType(
  op: FilterOperator | undefined
): FilterOperatorType | undefined {
  return op ? filterOperatorTypes[op] : undefined;
}

export interface FilterCondition {
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value?: string;
  readonly enabled: boolean;
}

export type StringFieldConfig = {
  options?: string[];
  richText?: boolean;
  fileLinks?: boolean;
};

export type DateFieldConfig = {
  time?: boolean;
};

/**
 * Cross-project relation configuration for a single field.
 *
 * Declares that the field's wiki-link values resolve to records of an
 * external project identified by `targetProjectId`. The optional
 * `displayField` selects which target field to render in adaptive
 * relation views (defaults to file basename).
 *
 * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.1.
 *
 * @since 3.4.2 (Stage A / M0.1)
 */
export type RelationFieldConfig = {
  readonly targetProjectId: string;
  readonly displayField?: string;
  /**
   * R5-010 — Optional sub-base scope. When set, only target records
   * passing this filter are surfaced as resolved targets. Stored
   * inline (not as a SubBase reference) so the relation config stays
   * self-contained — no global SubBase registry required.
   */
  readonly targetSubBaseFilter?: FilterDefinition;
  /**
   * NPLAN-A4 — Two-way relation declaration. Names the field on the
   * **target** project that mirrors this relation. Sprint 4 wires the
   * inverse writer; schema-only here so projects can persist the
   * intent before write-back ships.
   */
  readonly inverseFieldName?: string;
  /** Optional display field for the inverse side (defaults to file basename). */
  readonly inverseDisplayField?: string;
};

/**
 * Cross-project rollup configuration for a single field.
 *
 * Declares that the field is computed by aggregating `targetField`
 * values from records reached through the relation field
 * `relationField` on the same project. `targetProjectId` is optional
 * because it can be inferred from the relation field's own config;
 * when present it serves as an explicit override.
 *
 * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.1.
 *
 * @since 3.4.2 (Stage A / M0.1)
 */
export type RollupFieldConfig = {
  readonly relationField: string;
  readonly targetProjectId?: string;
  readonly targetField: string;
  readonly function: RollupFunction;
  readonly separator?: string;
  /**
   * R2.1b — Notion-style mode id (UI-layer presentational selector
   * over the engine `function` kernel). Optional for backward compat;
   * writers MUST sync `function` from `getRollupMode(mode).fn` when
   * setting `mode` to keep the runtime invariant.
   *
   * @since 3.4.2 (R2.1b)
   */
  readonly mode?: import("src/lib/database/rollupMode").RollupModeId;
};

export type FieldConfig = StringFieldConfig &
  DateFieldConfig & {
    readonly relation?: RelationFieldConfig;
    readonly rollup?: RollupFieldConfig;
    /**
     * R2.1b — Project-scope property-type override. Replaces the
     * inferred `DataFieldType` for cell rendering, operator picker,
     * and value parsing. Persisted at the project level so all views
     * (Table/Board/Calendar/Gallery) of the same project agree on the
     * type.
     *
     * @since 3.4.2 (R2.1b)
     */
    readonly type?: import("src/lib/visualizer/propertyTypes").PropertyType;
    /**
     * NPLAN-A3 — Status semantic groups (overlay only).
     *
     * Maps user-defined option values into three semantic buckets so
     * Board/Calendar can optionally collapse columns into todo /
     * in-progress / complete. Schema-only in Sprint 1; Board grouping
     * still derives columns from unique values by default. The
     * "blocked"-style states intentionally piggyback on `inProgress`
     * unless the user splits them out via fourth bucket later.
     */
    readonly statusGroups?: {
      readonly todo?: string[];
      readonly inProgress?: string[];
      readonly complete?: string[];
    };
    /**
     * NPLAN-A1 — AutoTime field source. Names which file timestamp
     * (`created` or `modified`) the field reads from `TFile.stat`.
     * Read-only; ignored unless the field's type is
     * `DataFieldType.AutoTime`.
     */
    readonly autoTime?: "created" | "modified";
    /**
     * NPLAN-A2 — Unique-ID prefix (e.g. "TASK-"). Optional; when
     * absent the bare counter value is rendered. Counter itself lives
     * on `ProjectDefinition.uniqueIdCounter`.
     */
    readonly uniqueIdPrefix?: string;
  };

export type ShowCommand = {
  readonly project: string;
  readonly view?: string;
};

export type LinkBehavior = "open-note" | "open-editor";

export type FirstDayOfWeek = "sunday" | "monday" | "default";

export type MobileCalendarView = "month" | "week" | "day";

export type AnimationBehavior = "smooth" | "instant";

export type ProjectsPluginPreferences = {
  readonly projectSizeLimit: number;
  readonly frontmatter: {
    readonly quoteStrings: "PLAIN" | "QUOTE_DOUBLE";
  };
  readonly locale: {
    firstDayOfWeek: FirstDayOfWeek;
  };
  readonly commands: ShowCommand[];
  readonly linkBehavior: LinkBehavior;
  readonly mobileCalendarView: MobileCalendarView;
  readonly showViewTitles: boolean;
  readonly animationBehavior: AnimationBehavior;
  /** v4.0.3: Disable haptic (vibration) feedback on mobile devices */
  readonly disableHapticFeedback: boolean;
  /**
   * R5-012 — When true, the plugin closes Obsidian's built-in
   * `file-properties` leaves on every active-leaf-change and surfaces
   * the YAML Visualizer pane instead. Default false to keep the native
   * pane available out of the box.
   */
  readonly replaceObsidianProperties: boolean;
};

export type UnsavedViewDefinition = Omit<
  ViewDefinition,
  "name" | "id" | "type"
>;

export const DEFAULT_VIEW: UnsavedViewDefinition = {
  config: {},
  filter: { conjunction: "and", conditions: [] },
  colors: { conditions: [] },
  sort: { criteria: [] },
};
