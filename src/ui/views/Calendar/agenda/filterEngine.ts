/**
 * Agenda Filter Engine — thin wrapper over canonical `lib/engine/filterEvaluator`.
 *
 * R5-003: collapsed from 396 LOC into a delegator. Calendar-specific
 * semantics (`regex` op, strict `is-upcoming`, formula resolution
 * relative to agenda's `baseDate`) are now expressed via canonical
 * operators + `FilterOpts`.
 */

import dayjs, { Dayjs } from 'dayjs';
import type { DataRecord, DataField } from 'src/lib/dataframe/dataframe';
import type { AgendaFilter, AgendaFilterGroup, AgendaCustomList } from 'src/settings/v3/settings';
import type { FilterOperator, FilterCondition, FilterDefinition } from 'src/settings/base/settings';
import { isDateFilterOperator } from 'src/settings/base/settings';
import { parseFormula, evaluateFormula } from 'src/lib/formula';
import { matchesCondition, matchesFilterConditions, type FilterOpts } from 'src/lib/engine/filterEvaluator';
import { stripToDisplay } from 'src/lib/engine/wikilink';
import { calendarLogger } from '../logger';

const CAL_OPTS: FilterOpts = { upcomingInclusive: false };

/** Legacy → canonical operator names from v3.0.4 saved settings. */
const LEGACY_OPS: Record<string, FilterOperator> = {
  equals: 'is', not_equals: 'is-not', is_empty: 'is-empty', is_not_empty: 'is-not-empty',
  greater_than: 'gt', less_than: 'lt', greater_or_equal: 'gte', less_or_equal: 'lte',
  is_today: 'is-today', is_this_week: 'is-this-week', is_overdue: 'is-overdue',
  is_upcoming: 'is-upcoming', not_contains: 'not-contains',
};

function toCondition(filter: AgendaFilter): FilterCondition {
  const op = (LEGACY_OPS[filter.operator] ?? filter.operator) as FilterOperator;
  const v = filter.value;
  const value = v == null ? undefined
    : typeof v === 'string' ? v
    : Array.isArray(v) ? JSON.stringify(v)
    : String(v);
  const cond: FilterCondition = value === undefined
    ? { field: filter.field, operator: op, enabled: true }
    : { field: filter.field, operator: op, value, enabled: true };
  return cond;
}

function prepareRecord(record: DataRecord, field: string, op: FilterOperator): DataRecord {
  const raw = record.values[field];
  if (typeof raw !== 'string') return record;
  let v: string | Date = stripToDisplay(raw);
  if (isDateFilterOperator(op) && typeof v === 'string' && v) {
    const d = dayjs(v);
    if (d.isValid()) v = d.toDate();
  }
  if (v === raw) return record;
  return { ...record, values: { ...record.values, [field]: v as any } };
}

export function evaluateFilter(record: DataRecord, filter: AgendaFilter, baseDate: Dayjs = dayjs()): boolean {
  const cond = toCondition(filter);
  return matchesCondition(cond, prepareRecord(record, cond.field, cond.operator), baseDate, CAL_OPTS);
}

export function evaluateFilters(record: DataRecord, filters: AgendaFilter[], baseDate: Dayjs = dayjs()): boolean {
  return filters.length === 0 || filters.every(f => evaluateFilter(record, f, baseDate));
}

function toDefinition(group: AgendaFilterGroup): FilterDefinition {
  return {
    conjunction: group.conjunction === 'OR' ? 'or' : 'and',
    conditions: (group.filters ?? []).filter(f => f.enabled !== false).map(toCondition),
    groups: (group.groups ?? []).map(toDefinition),
  };
}

function collectFieldOps(group: AgendaFilterGroup, out: Map<string, FilterOperator>): void {
  for (const f of group.filters) {
    if (f.enabled === false) continue;
    const op = (LEGACY_OPS[f.operator] ?? f.operator) as FilterOperator;
    if (!out.has(f.field)) out.set(f.field, op);
  }
  for (const g of group.groups) collectFieldOps(g, out);
}

export function evaluateFilterGroup(record: DataRecord, group: AgendaFilterGroup, baseDate: Dayjs = dayjs()): boolean {
  const fieldOps = new Map<string, FilterOperator>();
  collectFieldOps(group, fieldOps);
  let prepared = record;
  for (const [field, op] of fieldOps) prepared = prepareRecord(prepared, field, op);
  return matchesFilterConditions(toDefinition(group), prepared, baseDate, CAL_OPTS);
}

export function filterRecordsForList(
  records: DataRecord[],
  list: AgendaCustomList,
  baseDate: Dayjs = dayjs(),
  _fields: DataField[] = []
): DataRecord[] {
  if (list.filterMode === 'advanced' && list.filterFormula) {
    try {
      const ast = parseFormula(list.filterFormula);
      return records.filter(r => {
        try { return evaluateFormula(ast, r, baseDate.toDate()); }
        catch (e) { calendarLogger.error(`[FilterEngine] formula eval failed for ${r?.id}`, e); return false; }
      });
    } catch (e) {
      calendarLogger.error(`[FilterEngine] formula parse failed: ${list.filterFormula}`, e);
      return [];
    }
  }
  if (list.filterMode === 'visual' && list.filterGroup) {
    return records.filter(r => evaluateFilterGroup(r, list.filterGroup!, baseDate));
  }

  if ('filters' in list && Array.isArray((list as any).filters)) {
    calendarLogger.warn('[FilterEngine] legacy list.filters format');

    return records.filter(r => evaluateFilters(r, (list as any).filters, baseDate));
  }
  return records;
}

export function filterRecordsForListLegacy(records: DataRecord[], filters: AgendaFilter[], baseDate: Dayjs = dayjs()): DataRecord[] {
  return records.filter(r => evaluateFilters(r, filters, baseDate));
}
