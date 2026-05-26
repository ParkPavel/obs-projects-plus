/**
 * native-query — lightweight ad-hoc query layer over folder/tag sources.
 *
 * Ticket: #045.2 (M-DATAVIEW-BRIDGE Gap 2)
 *
 * Bridges the "DQL is the only path for ad-hoc queries" gap identified in
 * `docs/internal/DATAVIEW_ABSORPTION_PLAN.md` §4 Gap 2. Provides a small
 * SQL-like programmatic surface — `FROM folder|tag WHERE conditions SORT
 * field LIMIT n` — built strictly on top of:
 *
 *   - the existing `FolderDataSource` / `TagDataSource` (data acquisition)
 *   - the canonical `filterEvaluator.applyFilter` (single filter engine,
 *     CLAUDE.md invariant)
 *
 * Design constraints (per ticket scope):
 *   - Pure module. All dependencies passed in via `NativeQueryDeps`; no
 *     module-level singletons or plugin globals.
 *   - Does NOT instantiate Dataview. Native-query is intentionally the
 *     "works-without-DV" path. Dataview-backed projects still go through
 *     `createDataviewSource` (#045.1).
 *   - Does NOT touch `filterEvaluator.ts`. Uses `applyFilter` as a library
 *     consumer (read-only contract).
 *   - Does NOT register a new `ProjectDefinition.dataSource.kind`. This is
 *     a layer on top of existing sources, not a new persisted source kind.
 */

import { produce } from "immer";
import dayjs from "dayjs";

import {
  DataFieldType,
  type DataField,
  type DataFrame,
  type DataRecord,
  type DataValue,
} from "src/lib/dataframe/dataframe";
import { applyFilter } from "src/lib/engine/filterEvaluator";
import type { IFileSystem } from "src/lib/filesystem/filesystem";
import type {
  FilterDefinition,
  SortDefinition,
} from "src/settings/base/settings";
import type {
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";

import { FolderDataSource } from "../folder/datasource";
import { TagDataSource } from "../tag/datasource";

// ── Public surface ─────────────────────────────────────────────────────

/**
 * `FROM` clause for a native query. Selects which underlying datasource to
 * acquire records from. Only `folder` and `tag` are supported here —
 * Dataview-backed queries are produced by `createDataviewSource` instead.
 */
export type NativeQuerySource =
  | { readonly kind: "folder"; readonly path: string; readonly recursive?: boolean }
  | { readonly kind: "tag"; readonly tag: string; readonly hierarchy?: boolean };

/**
 * A lightweight ad-hoc query. All clauses except `from` are optional.
 *
 *   from   — datasource to read records from (folder or tag)
 *   where  — canonical FilterDefinition; applied via `applyFilter`
 *   sort   — multi-criterion sort with per-criterion `enabled` flag
 *   limit  — non-negative integer; values <= 0 disable the limit
 *
 * Semantically equivalent to:
 *   FROM <from> [WHERE <where>] [SORT <sort>] [LIMIT <limit>]
 */
export interface NativeQuery {
  readonly from: NativeQuerySource;
  readonly where?: FilterDefinition;
  readonly sort?: SortDefinition;
  readonly limit?: number;
}

/**
 * Dependencies needed to execute a native query. Kept explicit (no globals)
 * so the executor stays pure and testable.
 *
 * Note: `excludedNotes` is forwarded to the synthesized project definition
 * so that downstream sources honour the same exclusion semantics they would
 * for a "real" project.
 */
export interface NativeQueryDeps {
  readonly fileSystem: IFileSystem;
  readonly preferences: ProjectsPluginPreferences;
  readonly excludedNotes?: ReadonlyArray<string>;
}

/**
 * Execute a `NativeQuery` and return the resulting `DataFrame`.
 *
 * Pipeline:
 *   1. Acquire base frame from folder/tag source (`queryAll`).
 *   2. Apply `where` via `applyFilter` (canonical filterEvaluator).
 *   3. Apply `sort` criteria (left-to-right tie-breaking, enabled-only).
 *   4. Apply `limit` (slice from head; negative/zero/undefined → no slice).
 *
 * Errors from the underlying source propagate (e.g. `TooManyNotesError`).
 */
export async function executeNativeQuery(
  query: NativeQuery,
  deps: NativeQueryDeps
): Promise<DataFrame> {
  const baseFrame = await acquireBaseFrame(query.from, deps);

  let frame = baseFrame;

  if (query.where && hasFilterConditions(query.where)) {
    frame = applyFilter(frame, query.where);
  }

  if (query.sort && query.sort.criteria.length > 0) {
    frame = applySort(frame, query.sort);
  }

  if (typeof query.limit === "number" && query.limit > 0) {
    frame = applyLimit(frame, query.limit);
  }

  return frame;
}

// ── Internals ──────────────────────────────────────────────────────────

/**
 * Construct a synthetic `ProjectDefinition` carrying the requested
 * folder/tag config and use the existing datasource classes to acquire
 * records. Re-using the concrete sources guarantees we honour every
 * piece of folder/tag semantics already in place (recursion, hierarchy
 * matching, excludedNotes, frontmatter standardisation).
 */
async function acquireBaseFrame(
  source: NativeQuerySource,
  deps: NativeQueryDeps
): Promise<DataFrame> {
  const excludedNotes = [...(deps.excludedNotes ?? [])];

  if (source.kind === "folder") {
    const project: ProjectDefinition = synthesizeProject({
      kind: "folder",
      config: {
        path: source.path,
        recursive: source.recursive ?? false,
      },
    }, excludedNotes);
    const ds = new FolderDataSource(deps.fileSystem, project, deps.preferences);
    return ds.queryAll();
  }

  // source.kind === "tag"
  const project: ProjectDefinition = synthesizeProject({
    kind: "tag",
    config: {
      tag: source.tag,
      hierarchy: source.hierarchy ?? false,
    },
  }, excludedNotes);
  const ds = new TagDataSource(deps.fileSystem, project, deps.preferences);
  return ds.queryAll();
}

/**
 * Synthesize a minimal `ProjectDefinition` carrying just the bits the
 * folder/tag sources actually read. Marked `isDefault: false` and uses an
 * opaque, namespaced id so it is unambiguously a transient construct.
 */
function synthesizeProject(
  dataSource: ProjectDefinition["dataSource"],
  excludedNotes: string[]
): ProjectDefinition {
  return {
    name: "__native-query__",
    id: "__native-query__",
    fieldConfig: {},
    views: [],
    defaultName: "",
    templates: [],
    excludedNotes,
    isDefault: false,
    dataSource,
    newNotesFolder: "",
  };
}

/**
 * `where` may be present but empty (no conditions, no nested groups). Only
 * skip the filter pass when there is truly nothing to evaluate — same idiom
 * as `DataviewDataSource.queryAll` (#045.5) for behavioural consistency.
 */
function hasFilterConditions(filter: FilterDefinition): boolean {
  return (
    (filter.conditions?.length ?? 0) > 0 ||
    (filter.groups?.length ?? 0) > 0
  );
}

/**
 * Apply multi-criterion sort. Disabled criteria are ignored. Sort is
 * stable for equal keys (Array.prototype.sort is stable in modern engines
 * — Node 12+ / V8 7.0+ per ECMAScript 2019).
 */
export function applySort(
  frame: DataFrame,
  sort: SortDefinition
): DataFrame {
  const activeCriteria = sort.criteria.filter((c) => c.enabled);
  if (activeCriteria.length === 0) {
    return frame;
  }

  const fieldByName = new Map<string, DataField>();
  for (const f of frame.fields) {
    fieldByName.set(f.name, f);
  }

  return produce(frame, (draft) => {
    draft.records.sort((a, b) => {
      for (const criterion of activeCriteria) {
        const fld = fieldByName.get(criterion.field);
        const av = a.values[criterion.field];
        const bv = b.values[criterion.field];

        // Empties always sort after populated values, regardless of
        // `order`. This matches Notion/Airtable behaviour and matches
        // user expectations: "missing data" should never float to the
        // top of a descending sort.
        const aEmpty = isEmptyForSort(av);
        const bEmpty = isEmptyForSort(bv);
        if (aEmpty && bEmpty) continue;
        if (aEmpty) return 1;
        if (bEmpty) return -1;

        const cmp = compareValues(av, bv, fld?.type ?? DataFieldType.String);
        if (cmp !== 0) {
          return criterion.order === "desc" ? -cmp : cmp;
        }
      }
      return 0;
    });
  });
}

/**
 * Compare two populated cell values for sort purposes.
 *
 * Pre-condition: callers must pre-filter empty values. `applySort` does
 * this so empties land at the tail regardless of `order` direction.
 */
function compareValues(
  a: DataValue | undefined,
  b: DataValue | undefined,
  type: DataFieldType
): number {
  switch (type) {
    case DataFieldType.Number: {
      const an = typeof a === "number" ? a : Number(a);
      const bn = typeof b === "number" ? b : Number(b);
      if (Number.isNaN(an) && Number.isNaN(bn)) return 0;
      if (Number.isNaN(an)) return 1;
      if (Number.isNaN(bn)) return -1;
      return an - bn;
    }
    case DataFieldType.Boolean: {
      const ab = a === true ? 1 : 0;
      const bb = b === true ? 1 : 0;
      return ab - bb;
    }
    case DataFieldType.Date:
    case DataFieldType.AutoTime: {
      const at = toTimestamp(a);
      const bt = toTimestamp(b);
      if (at === null && bt === null) return 0;
      if (at === null) return 1;
      if (bt === null) return -1;
      return at - bt;
    }
    default: {
      // String/Select/Status/List/Relation/Formula/Rollup/etc.
      // Coerce to string and use locale-aware numeric-aware comparison.
      const as = stringifyForSort(a);
      const bs = stringifyForSort(b);
      return as.localeCompare(bs, undefined, { numeric: true, sensitivity: "base" });
    }
  }
}

function isEmptyForSort(v: DataValue | undefined): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string" && v.length === 0) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function toTimestamp(v: DataValue | undefined): number | null {
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === "string" && v.length > 0) {
    const parsed = dayjs(v);
    return parsed.isValid() ? parsed.toDate().getTime() : null;
  }
  return null;
}

function stringifyForSort(v: DataValue | undefined): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) {
    return v.map((el) => stringifyForSort(el as DataValue | undefined)).join(",");
  }
  // Fallback for plain objects — keep deterministic.
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Apply LIMIT — slice the first `n` records. `n` is guaranteed positive
 * by `executeNativeQuery`; we still guard against fractional input.
 */
export function applyLimit(frame: DataFrame, n: number): DataFrame {
  const safeN = Math.floor(n);
  if (safeN <= 0) return frame;
  if (frame.records.length <= safeN) return frame;
  return produce(frame, (draft) => {
    draft.records = draft.records.slice(0, safeN) as DataRecord[];
  });
}
