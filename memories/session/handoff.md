# Session handoff — 2026-04-30 (Engine v2 + YAML Визуализатор blueprint)

> **Read this first** at the start of any continuation session before touching `src/` or `docs/`.
> **Anchored in**: [docs/IMPLEMENTATION_BLUEPRINT.md](../../docs/IMPLEMENTATION_BLUEPRINT.md), [.ai_internal/context_state.md](../../.ai_internal/context_state.md), [.ai_internal/stubs.md](../../.ai_internal/stubs.md).

## TL;DR

- **Working version**: `3.4.2` WIP (internal, NOT released). Public latest = `3.4.1`. Bump rationale: avoid overwriting the published 3.4.1 beta snapshot while Stage A is in flight.
- **Plan contract**: `docs/IMPLEMENTATION_BLUEPRINT.md` REVISION 2. Approved by user 2026-04-30. §11 ANSWERED, §12 fully checked.
- **Status**: pre-coding obligations in flight. NO `src/` edits yet. NO COMMIT, NO PUSH (director-mode directive).

## Stage layout (canonical)

| Stage | Milestones | Versions | Public? |
|---|---|---|---|
| **Stage A** | M0 + M2 + Stub closures + Doc-Standardization phases 1-3 | `3.4.2` internal | No |
| **Stage B** | M1 + M3 + M4 + M5 | `3.5.0+` | First public release at end |

`M0..M5` from `docs/ROADMAP_DATABASE_2026.md`. Aliases `Wave 1/2`, `sprint`, `chunk`, `iteration`, `phase X` (when synonym for stage) are **forbidden** (Appendix B grep gate).

## Eight user answers (2026-04-30) baked into REVISION 2

1. **Q1** Visualizer **replaces native Properties pane** with full functional extension (field types, data flows, relation/rollup visual control, filter/sort, show/hide).
2. **Q2** Naming: "YAML Визуализатор" / "YAML Visualizer" / "Перегляд YAML" / "YAML 可视化器".
3. **Q3** Relation cell: array, **adaptive overflow + popover**, shared `RelationListView.svelte`.
4. **Q4** Version `3.4.2` (preserve 3.4.1 snapshot).
5. **Q5** Phased rollout BUT every deferred site registered in `.ai_internal/stubs.md` + `STB-*` in code + auditor symmetry gate (§10.8).
6. **Q6** Visualizer = **sub-plugin within plugin**. 6 Notion-parity surfaces, ~17 new files, 8 STB-VISUALIZER-* stubs (see blueprint §A.7).
7. **Q7** Order: A.1 → A.5a → A.2 → A.3 → A.4 → A.5b → A.7 → A.8 (A.6 reserved).
8. **Q8** Whole-repo doc standardization (per follow-up "включи в стандартизацию документы всего проекта даже реадми"). §14.0 inventory: ~80 active + ~25 frozen .md files. §14.1 phase-1 = precondition for Step A.1.

## Pre-coding obligations (state)

| # | Task | State |
|---|------|-------|
| 1 | Create `.ai_internal/stubs.md` (8 STB-VISUALIZER-* entries) | **DONE** 2026-04-30 |
| 2 | Refresh `memories/session/handoff.md` | **DONE** 2026-04-30 |
| 3a | §14.1 — full-repo terminology grep & sweep | pending |
| 3b | §14.1 — README single-entry-point fix (RU+EN) | pending |
| 3c | §14.1 — CHANGELOG `[Unreleased — Stage A]` seed | pending |
| 3d | §14.1 — DOCS_INDEX sync + status banners | pending |
| 3e | §14.1 — repo-root cleanup inventory | pending |
| 4 | Step A.1 (FieldConfig extension) — first `src/` edit | BLOCKED on 3a..3e |

## Quality gate baseline (must remain green)

- `tsc --noEmit -p tsconfig.json` → 0 errors
- `npx jest` → 54 suites / 923 tests PASS (must rise to ≥64 / ≥1020 by Stage A close per §A.8 DoD)
- `npm run build` → PASS

## Director protocol — non-negotiable

- **NO commit, NO push, NO tag, NO amend** without explicit user approval.
- **Auditor PASS** required before any phase is marked done. Checks: SOLID/DRY/YAGNI, OWASP Top 10, Obsidian polyfill regression, ReDoS, JSON.parse safety, reactive bindings, terminology grep (§10.9), stubs symmetry (§10.8).
- **context_state.md** updated after every significant action; this handoff refreshed at session boundary.
- **Bilingual parity** (RU↔EN) enforced for 5 doc pairs (§14.1).

## What to do at the start of the next session

1. Read this section end-to-end.
2. Read `.ai_internal/context_state.md` (latest entry first).
3. Confirm pre-coding state — which §14.1 sub-task (3a..3e) is next.
4. Confirm quality gates (tsc / jest / build) still green.
5. Proceed.

## What NOT to do

- Do not start `src/` edits until ALL of 3a..3e are done.
- Do not introduce `Wave 1/2`, `sprint X`, `chunk X`, `iteration X`, or `phase X` (when synonym for stage) anywhere in active docs.
- Do not bulk-retrofit headers into existing `src/` files (YAGNI).

---

# Session Handoff — 2026-04-22 (Architectural Reset)

## Активная директива
"LEAD PRODUCT ARCHITECT & INTEGRATIVE PROMPT MANAGER" — 6-pillar архитектурный ресет Database View: Notion-уровень UX при No-Trace (YAML/MD only) + Offline-First.

## Discovery аудит — ground truth (Explore subagent)
| Pillar | Директива | Статус |
|--------|-----------|--------|
| 1. Data Flow over Folders | нет физических папок CRM/Finance/Fitness | **FIXED** |
| 2. Interface Reclamation | каждая cog → рабочая модалка | PARTIAL (6/7 + паритет) |
| 3. Table Stability | Strict Grid + JSON persist | FAIL |
| 4. Formula Bar IntelliSense | autocomplete + debug UI | PARTIAL |
| 5. Nested Arrays / FLATTEN | UNNEST + correlation | PARTIAL (нет multi-dataset join) |
| 6. Matryoshka / Zero Pixels | @container, rem, 1px | FAIL |

## Phase 1 DONE — DATA FLOW OVER FOLDERS
- `src/ui/app/onboarding/demoProject.ts`: `writeDemoFiles(vault, ${demoFolder}/Fitness, ...)` → `writeDemoFiles(vault, demoFolder, ...)` для всех 3 вертикалей. Комментарии обновлены под принцип "Проекты — это Запросы".
- `src/ui/app/onboarding/demoVerticals.ts`: header-комментарий приведён в соответствие.
- View-level фильтры (`type == "workout"/"transaction"/"client"`) уже были корректными — сегрегация работает через метаданные, не через физическую структуру папок.
- Верификация: svelte-check 0/0, jest 44/849 PASS, build PASS.

## Phases 2–6 TODO (приоритетно для следующих сессий)

### Phase 2: INTERFACE RECLAMATION паритет (S-M)
- `initViewPortConfig` + `ViewPortConfig.svelte` (единственный widget без cog)
- Фича-паритет: filter-controls в Stats/Checklist/FilterTabs, aggregation в Comparison
- Визуальный аудит с пользовательскими скриншотами

### Phase 3: TABLE STRICT GRID (M-L)
- Найти/создать `DataGrid.svelte`; перевести column layout на `display: grid; grid-template-columns: repeat(N, minmax(col.width-rem, 1fr))`
- Pointer-based resize handle на column divider; persistence по `pointerup` → `config.table.fieldConfig[col].width` в rem
- DnD reorder колонок с persistence в `config.table.orderFields`

### Phase 4: FORMULA BAR polish (S)
- Проверить/дополнить kbd nav (ArrowUp/Down/Enter) в `FormulaBar.svelte`
- `.ppp-formula-debug` inline-панель: локализованное сообщение об ошибке parse/eval + позиция курсора; скрывать по Esc

### Phase 5: CORRELATION FLOWS — multi-dataset scatter (L)
- Новый pipeline-шаг `join` в `transformExecutor.ts`: `{type:"join", rightSource, on, aggregation}`
- `ChartConfig.scatterConfig.rightDataSource?: DataSource`; `computeScatterData` делает inner-join по date/key перед построением (X,Y)
- UI в `ChartConfig.svelte` для выбора второго источника + ключа

### Phase 6: ZERO PIXELS / MATRYOSHKA (M, cross-cutting)
- `@media (max-width|max-height|orientation)` → `@container` где компонент в widget-shell; в глобальных shell — rem-based breakpoints через CSS custom properties
- `\b[0-9]+px\b` (кроме `1px` borders, `0`) → rem / design-tokens

### Phase 7: release wrap
- CHANGELOG под v3.5.0 (architectural modernization)
- context_state + bug-tracker записи
- auditor перед final verification

## Правила продолжения
- Каждая Phase: обязательный build + jest + svelte-check перед переходом
- **Не коммитить** до подтверждения: рабочее дерево грязное, только явный список
- Делегировать: `architect` для impact Phase 3/5, `auditor` после Phase 6

---

## Previous release context (archived)
v3.4.1 Board/shared DnD hotfix был опубликован 2026-04-21. Подробности см. в `.ai_internal/context_state.md`.