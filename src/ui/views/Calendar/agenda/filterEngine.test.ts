/**
 * Filter Engine Tests
 * 
 * Validates the agenda filter engine's operator logic,
 * date formula resolution, filter groups, and backward compatibility.
 */

import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import {
  evaluateFilter,
  evaluateFilters,
  evaluateFilterGroup,
  filterRecordsForList,
} from './filterEngine';
import type { DataRecord } from 'src/lib/dataframe/dataframe';
import type { AgendaFilter, AgendaFilterGroup, AgendaCustomList } from 'src/settings/v3/settings';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const BASE = dayjs('2026-02-07');

// ── Test records ──
const records: DataRecord[] = [
  { id: 'task-1', values: { name: 'Deploy server', status: 'Active', priority: 8, dueDate: '2026-02-07', tags: ['urgent', 'backend'] } },
  { id: 'task-2', values: { name: 'Design mockup', status: 'Draft', priority: 3, dueDate: '2026-02-10', tags: ['design', 'frontend'] } },
  { id: 'task-3', values: { name: 'Write tests', status: 'Active', priority: 5, dueDate: '2026-02-01', tags: ['testing'] } },
  { id: 'task-4', values: { name: 'Review PR', status: 'Done', priority: 1, dueDate: '2026-03-01', tags: [] } },
  { id: 'task-5', values: { name: 'Fix bug', status: 'Active', priority: 10, dueDate: '', tags: ['urgent', 'bugfix'] } },
  { id: 'task-6', values: { name: 'Sprint planning', status: 'Active', priority: 7, dueDate: '2026-02-14', tags: ['management'] } },
];

function mkFilter(field: string, operator: string, value?: any): AgendaFilter {
  return { id: `f-${Math.random()}`, field, operator: operator as any, value, enabled: true };
}

describe('filterEngine', () => {
  // ═══════════════════════════════
  // String operators
  // ═══════════════════════════════
  describe('string operators', () => {
    test('is → exact match', () => {
      const f = mkFilter('status', 'is', 'Active');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(false);
    });

    test('is-not → inverse', () => {
      const f = mkFilter('status', 'is-not', 'Active');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false);
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true);
    });

    test('contains → case-insensitive', () => {
      const f = mkFilter('name', 'contains', 'deploy');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(false);
    });

    test('not-contains', () => {
      const f = mkFilter('name', 'not-contains', 'deploy');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false);
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true);
    });

    test('starts-with', () => {
      const f = mkFilter('name', 'starts-with', 'Design');
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true);
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false);
    });

    test('ends-with', () => {
      const f = mkFilter('name', 'ends-with', 'server');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(false);
    });

    test('regex', () => {
      const f = mkFilter('name', 'regex', '^(Deploy|Fix)');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true); // Deploy server
      expect(evaluateFilter(records[4]!, f, BASE)).toBe(true);  // Fix bug
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(false); // Design mockup
    });
  });

  // ═══════════════════════════════
  // Base operators
  // ═══════════════════════════════
  describe('base operators', () => {
    test('is-empty → null/undefined/empty string/empty array', () => {
      const f = mkFilter('dueDate', 'is-empty');
      expect(evaluateFilter(records[4]!, f, BASE)).toBe(true); // dueDate = ''
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false);
    });

    test('is-not-empty', () => {
      const f = mkFilter('dueDate', 'is-not-empty');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);
      expect(evaluateFilter(records[4]!, f, BASE)).toBe(false);
    });

    test('is-empty on empty array', () => {
      const f = mkFilter('tags', 'is-empty');
      expect(evaluateFilter(records[3]!, f, BASE)).toBe(true); // tags = []
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false);
    });
  });

  // ═══════════════════════════════
  // Number operators
  // ═══════════════════════════════
  describe('number operators', () => {
    test('eq', () => {
      const f = mkFilter('priority', 'eq', 8);
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(false);
    });

    test('neq', () => {
      const f = mkFilter('priority', 'neq', 8);
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false);
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true);
    });

    test('gt', () => {
      const f = mkFilter('priority', 'gt', 5);
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);  // 8 > 5
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(false); // 3 > 5
    });

    test('lt', () => {
      const f = mkFilter('priority', 'lt', 5);
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true);  // 3 < 5
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false); // 8 < 5
    });

    test('gte', () => {
      const f = mkFilter('priority', 'gte', 5);
      expect(evaluateFilter(records[2]!, f, BASE)).toBe(true);  // 5 >= 5
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(false); // 3 >= 5
    });

    test('lte', () => {
      const f = mkFilter('priority', 'lte', 5);
      expect(evaluateFilter(records[2]!, f, BASE)).toBe(true);  // 5 <= 5
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false); // 8 <= 5
    });

    // ── String-value coercion (UI text inputs pass strings) ──
    test('gt with string value (UI input coercion)', () => {
      const f = mkFilter('priority', 'gt', '5');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);  // 8 > 5
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(false); // 3 > 5
    });

    test('lt with string value (UI input coercion)', () => {
      const f = mkFilter('priority', 'lt', '5');
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true);  // 3 < 5
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false); // 8 < 5
    });

    test('eq with string value "0"', () => {
      const rec = { id: 'z', values: { budget: 0 } } as DataRecord;
      expect(evaluateFilter(rec, mkFilter('budget', 'eq', '0'), BASE)).toBe(true);
    });

    test('gt with string value "0" (budget > 0)', () => {
      const pos = { id: 'z1', values: { budget: 100 } } as DataRecord;
      const zero = { id: 'z2', values: { budget: 0 } } as DataRecord;
      const neg = { id: 'z3', values: { budget: -5 } } as DataRecord;
      const f = mkFilter('budget', 'gt', '0');
      expect(evaluateFilter(pos, f, BASE)).toBe(true);   // 100 > 0
      expect(evaluateFilter(zero, f, BASE)).toBe(false);  // 0 > 0
      expect(evaluateFilter(neg, f, BASE)).toBe(false);   // -5 > 0
    });
  });

  // ═══════════════════════════════
  // Date operators
  // ═══════════════════════════════
  describe('date operators', () => {
    test('is-on → exact date match', () => {
      const f = mkFilter('dueDate', 'is-on', '2026-02-07');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(false);
    });

    test('is-not-on → inverse', () => {
      const f = mkFilter('dueDate', 'is-not-on', '2026-02-07');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false);
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true);
    });

    test('is-before', () => {
      const f = mkFilter('dueDate', 'is-before', '2026-02-07');
      expect(evaluateFilter(records[2]!, f, BASE)).toBe(true);  // 02-01 < 02-07
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false); // 02-07 = 02-07
    });

    test('is-after', () => {
      const f = mkFilter('dueDate', 'is-after', '2026-02-07');
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true);  // 02-10 > 02-07
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false);
    });

    test('is-on-and-before', () => {
      const f = mkFilter('dueDate', 'is-on-and-before', '2026-02-07');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);  // 02-07 <= 02-07
      expect(evaluateFilter(records[2]!, f, BASE)).toBe(true);  // 02-01 <= 02-07
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(false); // 02-10 > 02-07
    });

    test('is-on-and-after', () => {
      const f = mkFilter('dueDate', 'is-on-and-after', '2026-02-07');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true);
      expect(evaluateFilter(records[2]!, f, BASE)).toBe(false);
    });

    test('is-today → matches baseDate day', () => {
      const f = mkFilter('dueDate', 'is-today');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);  // 02-07
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(false); // 02-10
    });

    test('is-overdue → before baseDate', () => {
      const f = mkFilter('dueDate', 'is-overdue');
      expect(evaluateFilter(records[2]!, f, BASE)).toBe(true);  // 02-01 overdue
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false); // 02-07 = today
    });

    test('is-upcoming → after baseDate', () => {
      const f = mkFilter('dueDate', 'is-upcoming');
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true);  // 02-10 upcoming
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false); // 02-07 = today
    });

    test('is-this-month', () => {
      const f = mkFilter('dueDate', 'is-this-month');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);  // Feb
      expect(evaluateFilter(records[3]!, f, BASE)).toBe(false); // Mar
    });
  });

  // ═══════════════════════════════
  // Date formulas in filter values (DQL)
  // ═══════════════════════════════
  describe('date formulas in filter values', () => {
    test('is-on with "today" formula', () => {
      const f = mkFilter('dueDate', 'is-on', 'today');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(false);
    });

    test('is-before with "today" formula', () => {
      const f = mkFilter('dueDate', 'is-before', 'today');
      expect(evaluateFilter(records[2]!, f, BASE)).toBe(true);  // 02-01 < 02-07
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false);
    });

    test('is-on-and-before with "today+1w" DQL formula', () => {
      const f = mkFilter('dueDate', 'is-on-and-before', 'today+1w');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);  // 02-07 <= 02-14
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true);  // 02-10 <= 02-14
      expect(evaluateFilter(records[5]!, f, BASE)).toBe(true);  // 02-14 <= 02-14
      expect(evaluateFilter(records[3]!, f, BASE)).toBe(false); // 03-01 > 02-14
    });

    test('is-after with "eom" DQL formula', () => {
      const f = mkFilter('dueDate', 'is-after', 'eom');
      // eom = 2026-02-28
      expect(evaluateFilter(records[3]!, f, BASE)).toBe(true);  // 03-01 > 02-28
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false); // 02-07 < 02-28
    });

    test('is-on-and-after with "sow" DQL formula', () => {
      const f = mkFilter('dueDate', 'is-on-and-after', 'sow');
      // sow = start of week containing 2026-02-07
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);  // 02-07 >= sow
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true);  // 02-10 >= sow
    });
  });

  // ═══════════════════════════════
  // List/Tags operators
  // ═══════════════════════════════
  describe('list/tags operators', () => {
    test('has-any-of', () => {
      const f = mkFilter('tags', 'has-any-of', ['urgent', 'design']);
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);  // has urgent
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true);  // has design
      expect(evaluateFilter(records[2]!, f, BASE)).toBe(false); // has testing
    });

    test('has-all-of', () => {
      const f = mkFilter('tags', 'has-all-of', ['urgent', 'backend']);
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);
      expect(evaluateFilter(records[4]!, f, BASE)).toBe(false); // has urgent but not backend
    });

    test('has-none-of', () => {
      const f = mkFilter('tags', 'has-none-of', ['urgent']);
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false); // has urgent
      expect(evaluateFilter(records[2]!, f, BASE)).toBe(true);  // no urgent
    });

    test('has-keyword', () => {
      const f = mkFilter('tags', 'has-keyword', 'front');
      expect(evaluateFilter(records[1]!, f, BASE)).toBe(true); // has 'frontend'
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false);
    });
  });

  // ═══════════════════════════════
  // Backward compatibility (legacy operators)
  // ═══════════════════════════════
  describe('backward compatibility — legacy operators', () => {
    test('equals → is', () => {
      const f = mkFilter('status', 'equals' as any, 'Active');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);
    });

    test('not_equals → is-not', () => {
      const f = mkFilter('status', 'not_equals' as any, 'Active');
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(false);
    });

    test('is_empty → is-empty', () => {
      const f = mkFilter('dueDate', 'is_empty' as any);
      expect(evaluateFilter(records[4]!, f, BASE)).toBe(true);
    });

    test('greater_than → gt', () => {
      const f = mkFilter('priority', 'greater_than' as any, 5);
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);
    });

    test('is_today → is-today', () => {
      const f = mkFilter('dueDate', 'is_today' as any);
      expect(evaluateFilter(records[0]!, f, BASE)).toBe(true);
    });

    test('is_overdue → is-overdue', () => {
      const f = mkFilter('dueDate', 'is_overdue' as any);
      expect(evaluateFilter(records[2]!, f, BASE)).toBe(true);
    });
  });

  // ═══════════════════════════════
  // evaluateFilters (AND conjunction)
  // ═══════════════════════════════
  describe('evaluateFilters — AND conjunction', () => {
    test('empty filters → match all', () => {
      expect(evaluateFilters(records[0]!, [], BASE)).toBe(true);
    });

    test('multiple filters → all must match', () => {
      const filters = [
        mkFilter('status', 'is', 'Active'),
        mkFilter('priority', 'gt', 5),
      ];
      expect(evaluateFilters(records[0]!, filters, BASE)).toBe(true);  // Active & 8>5
      expect(evaluateFilters(records[2]!, filters, BASE)).toBe(false); // Active & 5>5=false
    });
  });

  // ═══════════════════════════════
  // evaluateFilterGroup
  // ═══════════════════════════════
  describe('evaluateFilterGroup', () => {
    test('AND group — all must match', () => {
      const group: AgendaFilterGroup = {
        id: 'g1',
        conjunction: 'AND',
        filters: [
          mkFilter('status', 'is', 'Active'),
          mkFilter('priority', 'gte', 7),
        ],
        groups: [],
      };
      expect(evaluateFilterGroup(records[0]!, group, BASE)).toBe(true);  // Active & 8>=7
      expect(evaluateFilterGroup(records[2]!, group, BASE)).toBe(false); // Active & 5>=7=false
    });

    test('OR group — any can match', () => {
      const group: AgendaFilterGroup = {
        id: 'g2',
        conjunction: 'OR',
        filters: [
          mkFilter('status', 'is', 'Done'),
          mkFilter('priority', 'gt', 9),
        ],
        groups: [],
      };
      expect(evaluateFilterGroup(records[3]!, group, BASE)).toBe(true);  // Done
      expect(evaluateFilterGroup(records[4]!, group, BASE)).toBe(true);  // 10 > 9
      expect(evaluateFilterGroup(records[1]!, group, BASE)).toBe(false); // Draft & 3
    });

    test('empty group → match all', () => {
      const group: AgendaFilterGroup = {
        id: 'g3', conjunction: 'AND', filters: [], groups: [],
      };
      expect(evaluateFilterGroup(records[0]!, group, BASE)).toBe(true);
    });

    test('nested groups → recursive evaluation', () => {
      const group: AgendaFilterGroup = {
        id: 'g-outer',
        conjunction: 'AND',
        filters: [
          mkFilter('status', 'is', 'Active'),
        ],
        groups: [
          {
            id: 'g-inner',
            conjunction: 'OR',
            filters: [
              mkFilter('priority', 'gt', 9),
              mkFilter('dueDate', 'is-today'),
            ],
            groups: [],
          },
        ],
      };
      // task-1: Active AND (8>9=false OR is-today=true) → true
      expect(evaluateFilterGroup(records[0]!, group, BASE)).toBe(true);
      // task-5: Active AND (10>9=true OR dueDate empty=false) → true
      expect(evaluateFilterGroup(records[4]!, group, BASE)).toBe(true);
      // task-3: Active AND (5>9=false OR 02-01=today?false) → false
      expect(evaluateFilterGroup(records[2]!, group, BASE)).toBe(false);
    });

    test('disabled filters are skipped', () => {
      const group: AgendaFilterGroup = {
        id: 'g-disabled',
        conjunction: 'AND',
        filters: [
          mkFilter('status', 'is', 'Active'),
          { ...mkFilter('priority', 'gt', 100), enabled: false }, // impossible but disabled
        ],
        groups: [],
      };
      expect(evaluateFilterGroup(records[0]!, group, BASE)).toBe(true);
    });
  });

  // ═══════════════════════════════
  // filterRecordsForList — unified API
  // ═══════════════════════════════
  describe('filterRecordsForList', () => {
    test('visual mode — filters by group', () => {
      const list: AgendaCustomList = {
        id: 'l1', name: 'Active High', filterMode: 'visual',
        icon: { type: 'lucide', value: 'list' }, order: 0,
        filterGroup: {
          id: 'g', conjunction: 'AND',
          filters: [
            mkFilter('status', 'is', 'Active'),
            mkFilter('priority', 'gte', 7),
          ],
          groups: [],
        },
      };
      const result = filterRecordsForList(records, list, BASE);
      // Active & priority>=7: task-1 (8), task-5 (10), task-6 (7)
      expect(result.length).toBe(3);
      expect(result.map(r => r.id)).toContain('task-1');
      expect(result.map(r => r.id)).toContain('task-5');
      expect(result.map(r => r.id)).toContain('task-6');
    });

    test('no filters → return all', () => {
      const list: AgendaCustomList = {
        id: 'l2', name: 'All', filterMode: 'visual', icon: { type: 'lucide', value: 'list' }, order: 0,
      };
      const result = filterRecordsForList(records, list, BASE);
      expect(result.length).toBe(records.length);
    });

    test('DQL formula in visual filter works', () => {
      const list: AgendaCustomList = {
        id: 'l3', name: 'Due this week or before', filterMode: 'visual',
        icon: { type: 'lucide', value: 'list' }, order: 0,
        filterGroup: {
          id: 'g', conjunction: 'AND',
          filters: [
            mkFilter('dueDate', 'is-on-and-before', 'today+1w'),
          ],
          groups: [],
        },
      };
      const result = filterRecordsForList(records, list, BASE);
      // today+1w = 2026-02-14. Tasks on or before: task-1(02-07), task-2(02-10), task-3(02-01), task-6(02-14)
      // task-4(03-01) excluded, task-5(empty dueDate) excluded by isDateLike check
      expect(result.length).toBe(4);
    });
  });
});
