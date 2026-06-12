// tableCanon.ts — F2.1 (#074, TABLE_V2_CANON): the pure model behind Table V2.
//
// Columns, sorting, search and per-type cell display are computed here so the
// Svelte layer renders dumb zones. No archive imports, no parallel filter
// engine — filtering stays at view/block level; this module only orders and
// presents what the canonical pipeline already produced.

import {
  DataFieldType,
  type DataField,
  type DataRecord,
  type DataValue,
  type Optional,
} from "src/lib/dataframe/dataframe";
import type { DataTableConfig, DataTableSortCriteria } from "../../types";
import { getOptionColor, type ExtendedFieldTypeConfig } from "../../fieldTypes";

// ── Columns ──────────────────────────────────────────────────

export interface TableColumn {
  readonly field: DataField;
  readonly widthRem: number;
  /** Row identity column (canon §0.1): opens the record, cannot hide. */
  readonly isPrimary: boolean;
}

const DEFAULT_WIDTH_REM: Partial<Record<DataFieldType, number>> = {
  [DataFieldType.Boolean]: 5,
  [DataFieldType.Number]: 7,
  [DataFieldType.Date]: 8.5,
  [DataFieldType.Status]: 9,
  [DataFieldType.Select]: 9,
  [DataFieldType.List]: 12,
  [DataFieldType.Formula]: 8,
  [DataFieldType.Relation]: 12,
  [DataFieldType.Rollup]: 8,
};

function primaryFieldName(fields: readonly DataField[]): string {
  return (
    fields.find((f) => f.identifier)?.name ??
    fields.find((f) => f.name === "name")?.name ??
    fields[0]?.name ??
    ""
  );
}

/**
 * Housekeeping fields hidden unless the user explicitly sets hide:false —
 * `path` is plugin bookkeeping, not user data (UT-R2 #084).
 */
const DEFAULT_HIDDEN = new Set(["path"]);

function isVisible(
  name: string,
  primary: string,
  cfg: { hide?: boolean } | undefined
): boolean {
  if (name === primary) return true;
  if (cfg?.hide === true) return false;
  if (DEFAULT_HIDDEN.has(name)) return cfg?.hide === false;
  return true;
}

export function buildColumns(
  fields: readonly DataField[],
  config: DataTableConfig | undefined
): TableColumn[] {
  const primary = primaryFieldName(fields);
  const fieldCfg = config?.fieldConfig ?? {};
  const order = config?.orderFields ?? [];
  const byName = new Map(fields.map((f) => [f.name, f]));

  const ordered: DataField[] = [
    ...order.map((n) => byName.get(n)).filter((f): f is DataField => !!f),
    ...fields.filter((f) => !order.includes(f.name)),
  ];

  return ordered
    .filter((f) => isVisible(f.name, primary, fieldCfg[f.name]))
    .map((f) => {
      const cfg = fieldCfg[f.name];
      // legacy px width migrates lazily on read (types.ts deprecation note)
      const widthRem =
        cfg?.widthRem ?? (cfg?.width ? cfg.width / 16 : undefined) ??
        (f.name === primary ? 17 : DEFAULT_WIDTH_REM[f.type] ?? 11);
      return { field: f, widthRem, isPrimary: f.name === primary };
    })
    .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
}

/**
 * Shared grid-template-columns for header/body/footer (one grid context).
 * Tracks are FIXED widths: the table overflows horizontally as one unit
 * inside the shared scroll container (UT-R2 #083 — flexible tracks made
 * header and body disagree about column positions).
 */
export function gridTemplate(columns: readonly TableColumn[]): string {
  return columns.map((c) => `${c.widthRem}rem`).join(" ");
}

// ── Sorting ──────────────────────────────────────────────────

export function activeSortCriteria(
  config: DataTableConfig | undefined
): DataTableSortCriteria[] {
  if (config?.sortCriteria?.length) return [...config.sortCriteria];
  if (config?.sortField) {
    return [{ field: config.sortField, order: config.sortAsc === false ? "desc" : "asc" }];
  }
  return [];
}

function rank(value: Optional<DataValue>): number {
  return value === null || value === undefined || value === "" ? 1 : 0;
}

function compareValues(a: Optional<DataValue>, b: Optional<DataValue>): number {
  const emptiness = rank(a) - rank(b);
  if (emptiness !== 0 || rank(a) === 1) return emptiness;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export function applySort(
  records: readonly DataRecord[],
  config: DataTableConfig | undefined
): DataRecord[] {
  const criteria = activeSortCriteria(config);
  if (criteria.length === 0) return [...records];
  return [...records].sort((ra, rb) => {
    for (const { field, order } of criteria) {
      const cmp = compareValues(ra.values[field], rb.values[field]);
      if (cmp !== 0) return order === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

// ── Search ───────────────────────────────────────────────────

export function applySearch(
  records: readonly DataRecord[],
  query: string
): DataRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...records];
  return records.filter((r) =>
    r.id.toLowerCase().includes(q) ||
    Object.values(r.values).some((v) => v != null && String(v).toLowerCase().includes(q))
  );
}

// ── Cell display (canon §2) ──────────────────────────────────

export const MAX_VISIBLE_PILLS = 3;

export interface CellPill {
  readonly label: string;
  readonly color: string | null;
}

export type CellDisplay =
  | { readonly kind: "empty" }
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "number"; readonly text: string }
  | { readonly kind: "check"; readonly checked: boolean }
  | { readonly kind: "pills"; readonly pills: CellPill[]; readonly overflow: number; readonly status: boolean };

const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function wikilinkLabels(raw: string): string[] {
  const labels: string[] = [];
  for (const m of raw.matchAll(WIKILINK)) labels.push((m[2] ?? m[1] ?? "").trim());
  return labels.length > 0 ? labels : [raw];
}

function toPills(labels: string[], color: (label: string) => string | null, status: boolean): CellDisplay {
  const visible = labels.slice(0, MAX_VISIBLE_PILLS);
  return {
    kind: "pills",
    pills: visible.map((label) => ({ label, color: color(label) })),
    overflow: Math.max(0, labels.length - MAX_VISIBLE_PILLS),
    status,
  };
}

export function cellDisplay(field: DataField, value: Optional<DataValue>): CellDisplay {
  if (value === null || value === undefined || value === "") return { kind: "empty" };

  const optionColor = (label: string): string | null => {
    const cfg = field.typeConfig as ExtendedFieldTypeConfig | undefined;
    return cfg ? getOptionColor(cfg, label) : null;
  };

  if (field.repeated && Array.isArray(value)) {
    return toPills(value.map((v) => String(v)), optionColor, false);
  }

  switch (field.type) {
    case DataFieldType.Boolean:
      return { kind: "check", checked: value === true };
    case DataFieldType.Number:
      return { kind: "number", text: typeof value === "number" ? value.toLocaleString() : String(value) };
    case DataFieldType.Date:
      return { kind: "text", text: value instanceof Date ? value.toISOString().slice(0, 10) : String(value) };
    case DataFieldType.Select:
      return toPills([String(value)], optionColor, false);
    case DataFieldType.Status:
      return toPills([String(value)], optionColor, true);
    case DataFieldType.Relation:
      return toPills(wikilinkLabels(String(value)), () => null, false);
    case DataFieldType.Formula:
    case DataFieldType.Rollup:
      return typeof value === "number"
        ? { kind: "number", text: value.toLocaleString() }
        : { kind: "text", text: String(value) };
    default: {
      // UT-R2 #085: wikilinks in plain String fields read as link chips,
      // not raw "[[...]]" markup — the cell honors what the user wrote.
      const text = String(value);
      if (WIKILINK.test(text)) {
        WIKILINK.lastIndex = 0;
        return toPills(wikilinkLabels(text), () => null, false);
      }
      return { kind: "text", text };
    }
  }
}
