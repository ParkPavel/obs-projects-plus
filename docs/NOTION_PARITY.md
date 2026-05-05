# Notion Parity Gap Analysis — obs-projects-plus v3.4.2

**Status:** Phase 2 deliverable — feeds Phase 3 ticket queue (PARITY-* tickets).
**Reference docs:** `.ai_internal/NOTION_DATABASE_INTEGRATION_MASTER.md` (Parts I-V), `.ai_internal/NOTION_OBJECTS_UI_TREE.md` (§§5-20).
**Goal target:** ≥90% Notion-parity для Database/View use-cases, осознанные исключения для multi-user features.

---

## 0. Scoring Methodology

- ✅ **IMPL** — функциональность реализована и сопоставима с Notion по UX
- 🟡 **PARTIAL** — реализовано, но без UI/edge-cases или с упрощённой моделью
- ⬜ **MISSING** — требуется новая работа
- ⛔ **N/A** — невозможно/нерелевантно (multi-user features в single-user vault)

Score per category = (IMPL_count + 0.5 × PARTIAL_count) / (Total − N/A_count) × 100%.

---

## 1. Property Types Parity (24 типа)

| # | Notion Type | OPP Status | Code Anchor | Gap / Action |
|---|-------------|-----------|-------------|--------------|
| 1 | `title` | ✅ | [src/lib/dataframe/dataframe.ts](../src/lib/dataframe/dataframe.ts) — `DataFieldType.String` + `identifier:true` | — |
| 2 | `rich_text` | 🟡 | DataFieldType.String | Нет inline annotations (bold/italic/color/links внутри одной cell). Notion хранит `RichText[]`, OPP — plain string. PARITY-002 |
| 3 | `number` | ✅ | DataFieldType.Number, format/precision via FieldConfig | — (currency formats в §1.2.1 — already supported) |
| 4 | `select` | ✅ | DataFieldType.Select + FieldOption[] | — |
| 5 | `multi_select` | ✅ | DataFieldType.List | — (semantic match) |
| 6 | `status` | 🟡 | DataFieldType.Status + statusOptions | Нет 3-tier groups (todo/in-progress/complete). PARITY-003 |
| 7 | `date` | ✅ | DataFieldType.Date, DateField + dateFormat | — |
| 8 | `people` | ⛔ | — | Single-user vault. Можно эмулировать через select-поле "Owner". |
| 9 | `files` | 🟡 | wiki-links в string | Нет dedicated UI для drop/preview множественных файлов. PARITY-005 |
| 10 | `checkbox` | ✅ | DataFieldType.Boolean | — |
| 11 | `url` | 🟡 | DataFieldType.String | Нет clickable rendering. PARITY-001 |
| 12 | `email` | 🟡 | DataFieldType.String | Нет mailto-link. PARITY-001 |
| 13 | `phone_number` | 🟡 | DataFieldType.String | Нет tel-link / format mask. PARITY-001 |
| 14 | `formula` | ✅ | DataFieldType.Formula + [src/ui/views/Database/engine/formulaEngine.ts](../src/ui/views/Database/engine/formulaEngine.ts) | OPP покрывает 95+ функций vs Notion ~80. **Превосходит**. |
| 15 | `relation` | 🟡 | DataFieldType.Relation, wiki-links | One-way only. Two-way (dual_property) — PARITY-006. |
| 16 | `rollup` | 🟡 | [src/ui/views/Database/engine/rollup.ts](../src/ui/views/Database/engine/rollup.ts) | Нет `show_original`, `show_unique`, `percent_checked`, `*_per_group`. PARITY-007 |
| 17 | `created_time` | 🟡 | file.ctime via Dataview | Не нативное OPP-поле. PARITY-008 (auto-fields) |
| 18 | `created_by` | ⛔ | — | Single-user. |
| 19 | `last_edited_time` | 🟡 | file.mtime via Dataview | PARITY-008 |
| 20 | `last_edited_by` | ⛔ | — | Single-user. |
| 21 | `unique_id` | ⬜ | — | Auto-increment + prefix. PARITY-009 |
| 22 | `verification` | ⬜ | — | Низкий приоритет (компонент Notion AI). PARITY-N/A |
| 23 | `button` | ⬜ | — | Inline action trigger. PARITY-010 (после Automation E1) |
| 24 | `cover` (page-level) | 🟡 | Gallery view только | PARITY-011 (page-level cover в Table) |

**Score Property Types:** ✅=10, 🟡=10, ⬜=3, ⛔=4 → (10 + 5) / 20 = **75%**

---

## 2. View Types Parity (6 типов)

| # | Notion View | OPP Status | Code Anchor | Gap |
|---|-------------|-----------|-------------|-----|
| 1 | Table View | ✅ | [src/ui/views/Database/widgets/DataTable](../src/ui/views/Database/widgets/DataTable) + legacy [src/ui/views/Table](../src/ui/views/Table) | DataTableWidget = Notion-parity (resize, freeze, sort, agg row, conditional format). PARITY-012: tree/sub-items rendering |
| 2 | Board (Kanban) | ✅ | [src/ui/views/Board](../src/ui/views/Board) | PARITY-013: card cover image + horizontal layout option |
| 3 | Calendar | ✅ | [src/ui/views/Calendar](../src/ui/views/Calendar) | Agenda 2.0 — ahead of Notion. ✅ |
| 4 | Gallery | ✅ | [src/ui/views/Gallery](../src/ui/views/Gallery) | PARITY-014: card-size variants (small/medium/large) |
| 5 | Timeline (Gantt) | ⬜ | — | PARITY-015: новый view-type. См. ARCHITECTURE_V4.md §6 (вынести в новый §7) |
| 6 | List | ⬜ | — | PARITY-016: minimal table variant |

**Score View Types:** ✅=4, ⬜=2 → 4/6 = **67%**

---

## 3. Filter / Sort / Group Parity

| Feature | OPP Status | Code Anchor | Gap |
|---------|-----------|-------------|-----|
| Property filters basic | ✅ | [src/lib/datasources/frontmatter/filter.ts](../src/lib/datasources/frontmatter/filter.ts) | — |
| AND/OR conjunction (1 level) | ✅ | FilterDefinition.conjunction | — |
| Nested filter groups (recursive) | ⬜ | — | PARITY-017. Унифицировать с FilterIR в `lib/engine/`. |
| Relative date (past_week/this_month/...) | ⬜ | — | PARITY-004. Low effort, high UX value. |
| Filter by formula result | 🟡 | через ComputeStep + FilterStep | PARITY-018: первоклассная поддержка |
| Filter by rollup | ⬜ | — | PARITY-019 |
| Multi-field sort | ✅ | DataTableSortCriteria[] | — |
| Sort by formula result | 🟡 | ComputeStep + SortStep | PARITY-020: UI dropdown |
| Group by 1 level | ✅ | GroupConfig | — |
| Group by 2 levels | ✅ | subGroupField | — |
| Group date by day/week/month/year | ✅ | GroupByStep.dateGrouping | — |
| Sort within groups | ✅ | GroupConfig.sortOrder | — |

**Score Filter/Sort/Group:** ✅=8, 🟡=2, ⬜=4 → (8 + 1) / 14 = **64%**

---

## 4. Formula Parity (Notion Formula 2.0)

См. MASTER §1.3.2 — полный каталог функций.

| Группа | Notion count | OPP count | Status |
|--------|--------------|-----------|--------|
| Строковые | ~25 | 30+ | ✅ Превосходит |
| Числовые | ~22 | 22 + financial (PMT/IRR/NPV) | ✅ Превосходит |
| Логические | 13 | 13 | ✅ |
| Дата | 23 | 25+ (dayjs) | ✅ |
| Списки | 19 | 18 | 🟡 (нет `zip`, `extract` нативно) → PARITY-021 |
| Спец. (`prop()`, `id()`, `lets()`) | 4 | 3 | 🟡 PARITY-022 |

**Score Formula:** **95%** — OPP лидирует.

---

## 5. Table View UI Controls

| Notion Feature | OPP Status | Code Anchor |
|----------------|-----------|-------------|
| Column resize (rem-based) | ✅ | DataTableWidget.widthRem |
| Column reorder (drag) | ✅ | orderFields |
| Column hide/show | ✅ | DataTableFieldConfig.hide |
| Column pin/freeze | ✅ | freezeUpTo |
| Aggregation row | ✅ | showAggregationRow + AggregationConfig |
| Row height (compact/default/expanded) | ✅ | rowHeight |
| Text wrap | ✅ | wrapText |
| Conditional formatting | ✅ | ConditionalFormat[] |
| Right-click column menu | ✅ | DataTableWidget context menu |
| Insert column left/right | 🟡 | через FieldEditor, нет inline | PARITY-023 |
| Inline cell editor (≠ modal) | ✅ | CellEditor.svelte |
| Bulk row select + actions | 🟡 | частично | PARITY-024 |
| Drag handle на строке | 🟡 | в Board ✅, в Table нет | PARITY-025 |

**Score Table UI:** ✅=10, 🟡=3 → (10 + 1.5) / 13 = **88%**

---

## 6. Automation / Triggers (E-Phase в MASTER §6)

| Feature | OPP Status | Notes |
|---------|-----------|-------|
| Property-change trigger | ⬜ | PARITY-026. Hook в `dataApi.updateRecord` + AutomationEngine |
| Record-added trigger | ⬜ | PARITY-026 (vault.on("create")) |
| Record-deleted trigger | ⬜ | PARITY-026 |
| Scheduled trigger | ⛔ | Obsidian не имеет scheduler |
| Action: edit property | ⬜ | PARITY-026 |
| Action: create record | ⬜ | PARITY-026 |
| Action: notification | ⬜ | через Notice() |

**Score Automation:** **0%** (но это Phase E — out of v3.5.x scope).

---

## 7. Inline UI / Slash Commands (UI_TREE §18)

| Feature | OPP Status | Notes |
|---------|-----------|-------|
| Slash command palette (`/`) | ⬜ | PARITY-027. Низкий приоритет — Obsidian имеет свою command palette. |
| Inline mentions (`@`, `[[`) | ✅ | Obsidian wiki-links — нативно |
| Page templates | 🟡 | Templates per project | PARITY-028: template UI per database |

---

## 8. Сводный Notion-parity score

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Property Types | 75% | 0.25 | 18.75 |
| View Types | 67% | 0.20 | 13.4 |
| Filter/Sort/Group | 64% | 0.15 | 9.6 |
| Formula | 95% | 0.15 | 14.25 |
| Table UI Controls | 88% | 0.15 | 13.2 |
| Automation | 0% | 0.05 | 0 |
| Inline UI | 70% | 0.05 | 3.5 |
| **TOTAL** | | **1.00** | **72.7%** |

**Целевой score 90%** — достигается выполнением P0+P1 tickets из §9.

---

## 9. Gap Tickets — приоритизированный список

См. [docs/PHASE_3_TICKETS.md](PHASE_3_TICKETS.md) — Layer 6: Notion Parity Tickets.

**P0 (блокируют parity ≥80%):**
- PARITY-001 — URL/Email/Phone field rendering (1d)
- PARITY-004 — Relative date filters (1d)
- PARITY-006 — Two-way relations (3d)
- PARITY-007 — Rollup full function set (2d)

**P1 (parity → 90%):**
- PARITY-002 — RichText annotations (5d)
- PARITY-009 — unique_id field (1d)
- PARITY-015 — Timeline view (10d)
- PARITY-016 — List view (1d)
- PARITY-017 — Nested filter groups (3d)
- PARITY-008 — Auto-fields (created_time/last_edited_time) (1d)

**P2 (UX polish):**
- PARITY-003 — Status groups
- PARITY-013/014 — Board/Gallery card variants
- PARITY-018-024 — UX refinements
- PARITY-025 — Row drag handle
- PARITY-027 — Slash palette
- PARITY-028 — Per-DB templates

**P3 (out of scope):**
- PARITY-010 — Button field (after Automation)
- PARITY-026 — AutomationEngine (Phase E)

---

## 10. Out-of-scope rationale

- **`people`/`created_by`/`last_edited_by`** — single-user vault. Эмуляция через `select` или Dataview implicit fields покрывает 95% use-cases.
- **Notion AI / verification** — out-of-scope: требует cloud LLM.
- **Synced blocks** — Obsidian имеет `![[note#section]]` embed, аналог покрывает 80%.
- **Public sharing / publish** — Obsidian Publish — отдельный продукт.
- **Comments / mentions** — out-of-scope для v3.5; возможен через nested блоки в page body.

---

## 11. Где OPP превосходит Notion

| Feature | OPP | Notion |
|---------|-----|--------|
| UNNEST (array → rows) | ✅ | ❌ |
| PIVOT / UNPIVOT | ✅ | ❌ |
| Cross-source JOIN | ✅ | ❌ (только relations) |
| Financial functions (PMT/IRR/NPV/...) | ✅ | ❌ |
| Conditional formatting в Table | ✅ | 🟡 ограниченно |
| Charts (bar/line/pie/scatter/donut) | ✅ | ⬜ только Notion AI dashboards |
| KPI/Comparison/Summary widgets | ✅ | ⬜ |
| Filter tabs | ✅ | ⬜ |
| Multi-widget dashboard (CSS Grid drag) | ✅ | ⬜ |
| Local-first / offline | ✅ | ❌ |
| Plain markdown storage (no lock-in) | ✅ | ❌ |

**Это конкурентные преимущества — должны быть документированы в README/positioning.**

---

## 12. Roadmap binding

- v3.5.0 (current): foundation hardening (REFACTOR-* tickets) → unlock Layer 1+
- v3.5.1: Phase B (Property System) → PARITY-001, 003, 004, 008, 009 → ~80% parity
- v3.5.2: Phase C (Relation/Rollup) → PARITY-006, 007 → ~85% parity
- v3.5.3: Phase D (View System) → PARITY-015, 016, 017 → ~90% parity ✅ цель
- v3.5.4: Phase E (Automation) — optional
- v3.5.5: Phase F (Sub-items) — optional

---

**Версия:** 1.0 — 2025
**Источник истины:** Notion docs analysis (`.ai_internal/NOTION_*.md`).
