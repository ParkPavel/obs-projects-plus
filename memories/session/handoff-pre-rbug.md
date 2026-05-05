# Session Handoff — obs-projects-plus (2026-05-02 — конец R2)

> **Прочитай это ПЕРВЫМ** в начале новой сессии перед любым касанием `src/`.
> Старший контекст: [`.ai_internal/context_state.md`](../../.ai_internal/context_state.md), [`/memories/repo/obs-projects-plus-context.md`](../repo/obs-projects-plus-context.md), [`/memories/repo/bug-tracker.md`](../repo/bug-tracker.md). Архив старого handoff: `handoff-2026-05-01.md`.

## Режим работы
- Director mode (автономный оркестратор). Мандат пользователя: **«следуй всем этапам разработки до победного с промежуточными аудитами и само-коррекцией»**.
- **NO COMMIT** без явного запроса пользователя, даже при зелёных build/tests.
- Русский язык по умолчанию. Код и комментарии в коде — на английском. Без эмодзи.

## Текущее состояние (test baseline)
- **80 suites / 1176 tests PASS**, build clean.
- Один pre-existing third-party warning `obsidian-svelte/IconButton:38` — permanently off-scope.
- **PX_BUDGET = 791** (последние бампы: 783→784→785→786→787→788→791).
- Команды: `npm run build` (= `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`), `npx jest`.

## Что закрыто (R0 → R2 фазы полностью)

### R0 Foundation (gates №1–2)
- `src/lib/stores/commandBus.ts` — global Svelte store с monotonic `ts` guard, 5 R0.4a actions: `toggle-visualizer-pane`, `open-visualizer-for-file`, `add-relation`, `open-formula-editor`, `add-sub-base`.
- `src/lib/contextMenu.ts` — `openContextMenu(entries, anchor, app?)` portal-anchored обёртка над Obsidian `Menu`.
- `src/lib/formula/index.ts` — re-export канонических formula primitives.
- `src/__tests__/R0_3_pxBudget.test.ts` — px-budget ratchet.

### R1 Visualizer (gates №3–7) — независимый sidebar leaf
- `src/ui/views/VisualizerPane/visualizerPaneView.ts` + `VisualizerPane.svelte`.
- `src/lib/visualizer/{overlay,relations,colors,propertyTypes}.ts` (+ writers) — pure модели, через `processFrontMatter`.
- Reserved keys: `pp_overlay`, `pp_types`, default relation key `links`.

### R2 Database canvas reborn (gates №8–14)
**Pure модели:**
- `src/lib/database/subBase.ts` — `SubBaseDefinition`.
- `src/lib/database/subBasePartition.ts` — `partitionBySubBases`, `compareValues`.
- `src/lib/database/rollupMode.ts` — 18 Notion-style modes в 4 группах.
- `src/lib/database/cellEditor.ts` (+ writer) — 11 Stage A типов.
- `src/lib/relations/inverseIndex.ts` (+ store) — cross-base inverse, debounced rAF rebuild.

**UI:**
- `SubBaseTabs.svelte` (jsdom-mountable) — multi-table tab strip.
- `DataTableWidget.svelte` — `subBases`/`activeSubBaseId` в config, reactive partition, подписка на `commandBus` для `add-sub-base`.
- `VisualizerPane.svelte` — inline cell editor, "Linked from" секция.

### UI Polish round-1 (gate №15, по скринам пользователя 2026-05-02 00:09–00:15)
1. `data-types.color` × 4 локали добавлен.
2. `views.database.table.header-hint` × 4 локали (раньше defaultValue только en).
3. `WidgetToolbar` — raw icon names → `<Icon name={meta.icon} />` из `obsidian-svelte`.
4. Visualizer type-chip — удалён дубликатный `title` (overlap с popup).
5. `CreateField.svelte` — self-relation разрешён, current project помечен суффиксом `modals.field.configure.relation.this-project-suffix`.

## Что осталось

### R2.1 follow-up (опционально, отложено)
- Column-header context menu в `DataTableWidget`: rollup-mode picker (R2.5 готов) + property type override (R1.5 готов) через `openContextMenu`.
- Интеграция `parseCellInput`/`writeCellValue` в Database `Grid*Cell.svelte` (parity Visualizer ↔ Database). Текущие GridCells уже валидируют, поэтому nice-to-have.

### R3 Formula unification (крупный refactor)
4 fragmented surfaces:
- `src/ui/views/Database/widgets/FormulaBar.svelte` + `FormulaVisualEditor.svelte` + `FormulaNode.svelte`.
- Database Schema modal formula MVP.
- Calendar/Agenda `DateFormulaInput.svelte`.
- Filter formula context.

План: извлечь `src/ui/components/FormulaEditor/FormulaEditor.svelte` с props `{expression, fields, contextLabel?, onCommit, onCancel}`; мигрировать i18n keys `views.database.formula.*` → `formula.editor.*`.

### R3.x Cross-base referencing
Опираясь на `inverseIndexStore`, добавить explicit "Cross-base column" в Database schema modal.

### R4 Polish
- Mobile parity (touch handlers, drag-drop на touch).
- a11y audit (focus, ARIA, screen reader).
- Performance profiling (large datasets, virtual scroll).
- i18n parity final sweep.
- 3.5.0 release: CHANGELOG, screenshots, version-bump.

## Критические ловушки (lessons learned)

### TypeScript strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess
- `delete this.field` (НЕ `= undefined`) для optional class fields.
- Bracket access `obj["key"]` для index-signature props (TS4111).
- Conditional spread `...(opt !== undefined ? { opt } : {})` — не инжектить undefined.

### Svelte 3.59.2
- Template parser НЕ ест inline `as Cast` в event handlers — выноси в helper.
- Dynamic `type={...}` на `<input>` блокирует `bind:value` → `value=` + `on:input`.
- `let x = prop` ≠ реактивная подписка; для re-sync на изменение prop → `$: x = prop`.

### Obsidian
- Polyfills (`String.prototype.contains`, `Array.prototype.contains`, `.first()`, `.last()`) НЕ доступны в Jest.
- Mock-fragility: каждый используемый-at-module-load Obsidian symbol нужен в `src/__mocks__/obsidian.ts` (есть: ItemView, WorkspaceLeaf, Notice, addIcon, Modal, SuggestModal, FuzzySuggestModal, Menu, TFile, TFolder, MockApp, MockFileManager).
- Persistence: ТОЛЬКО `app.fileManager.processFrontMatter`, writers возвращают `false` если host без API.

### CSS / px-budget
- Текущий бюджет 791. Литерал `1px` в CSS-комментарии ТОЖЕ считается → пиши "hairline".
- При новом px — обновляй PX_BUDGET в `src/__tests__/R0_3_pxBudget.test.ts` с записью в bumps log.

### i18n
- 4 локали: en, ru, uk, zh-CN. Любой новый ключ — parity × 4.
- Не использовать `defaultValue` как fallback для production-ключей (это создаёт language leak в non-en UI).

## Следующее действие при старте новой сессии

1. Загрузить `.ai_internal/context_state.md`, `/memories/repo/*.md`, этот handoff.
2. Если пользователь говорит «продолжаем» без новых скринов / багов — выбрать одно из:
   - **R2.1b** (column-menu enrichment) — быстрее, 2-3 todo.
   - **R3.1** (extract shared FormulaEditor) — крупнее, требует смены 4 surface'ов.
3. Если пользователь даёт скрины — анализировать по чеклисту из `/memories/audit-patterns.md`.
4. После каждой завершённой задачи — audit gate: `npm run build`, `npx jest`, обновить `context_state.md`.

## Что НЕ делать
- Не запускать commit / push / branch-операции без явного запроса.
- Не создавать новые `.md`-файлы документации без запроса.
- Не модифицировать `manifest.json`/`versions.json`/`package.json` version-полей.
- Не править `obsidian-svelte/Icon/IconButton.svelte` (off-scope).
- Не использовать `1px` в production CSS — только относительные единицы; hairline допустимо в комментарии.
# Session handoff — 2026-05-01 (REVISION 3 — User directives post-A.10 smoke)

> **Read this FIRST** at the start of any continuation session before touching `src/` or `docs/`.
> **Authoritative anchor (новый, перекрывает blueprint REVISION 2)**: [.ai_internal/REVISION_3_USER_DIRECTIVES_2026-05-01.md](../../.ai_internal/REVISION_3_USER_DIRECTIVES_2026-05-01.md).
> **Older anchors (для истории)**: [.ai_internal/context_state.md](../../.ai_internal/context_state.md), [.ai_internal/stubs.md](../../.ai_internal/stubs.md), [docs/IMPLEMENTATION_BLUEPRINT.md](../../docs/IMPLEMENTATION_BLUEPRINT.md).

## TL;DR — где мы стоим (2026-05-01)

- **Working version**: `3.4.2` WIP (internal). Public latest = `3.4.1`. Релиз 3.5.0 откладывается до завершения R0..R4 нового плана.
- **Stage A.10 closed**: 60 suites / 985 tests PASS, build OK. Manual smoke подтвердил: Calendar восстановлен, Board/Gallery/Table без регрессий.
- **Главный вывод пользователя**: Database view функционально не перестроен (наследует Wave-1 проблемы), YAML Визуализатор не заменяет нативную Properties pane, точки пользовательского входа в новые функции = 0. Нужен полный пересмотр плана.
- **Новый план — Revision 3**: фазы R0 Foundation → R1 Visualizer → R2 Database canvas reborn → R3 Power users → R4 Polish & Release. Линейный Stage A→B упразднён.
- **STATUS**: NO CODE. Жду от пользователя (a) подтверждения §1–§4 Revision 3, (b) ответов на 7 вопросов §5, (c) решения о гранулярности старта R0.

## Что делать в следующей сессии

1. Прочитать [.ai_internal/REVISION_3_USER_DIRECTIVES_2026-05-01.md](../../.ai_internal/REVISION_3_USER_DIRECTIVES_2026-05-01.md) end-to-end.
2. Прочитать запись `2026-05-01 — REVISION 3` в [.ai_internal/context_state.md](../../.ai_internal/context_state.md).
3. Проверить статус ответов пользователя на §5 — если получены, продвигаться к старту R0.1 Formula Editor скелета (после делегирования `architect` для оценки импакта).
4. Если ответов нет — НЕ начинать код. Можно делать read-only подготовку: entry-point inventory (R0.4), CSS rem-audit grep, formula-surfaces inventory.

## Что нельзя

- **NO `src/` edits** до явного утверждения Revision 3 §1–§4 пользователем.
- **NO commit / push / tag / amend** без explicit user approval (директор-протокол не отменён).
- **NO бросать Stage A результаты**: 60/985 — baseline для всех R-фаз. Любая регрессия = blocker.

## Ключевые расхождения Revision 3 ↔ Blueprint REVISION 2 (для архива)

| Что | REVISION 2 | REVISION 3 |
|---|---|---|
| Visualizer | sub-plugin внутри project view-tab | leaf + sidebar + native pane replacement + per-note overlay + manual relations для ЛЮБОЙ заметки |
| Rollup | 12 фиксированных функций | Notion-style меню (Show original / Unique / Count / Percent / More options), для любого типа целевой колонки |
| Formula | per-surface (Database / Schema / Agenda / Dataview) | единый Formula Editor для всего плагина |
| Database table | M2 incremental polish | полный rewrite, множественные таблицы в виде, под-базы, двусторонние relation |
| Под-базы | отсутствуют | first-class концепт внутри Database View |
| Relation | cross-project | + внутри view между под-базами + двусторонние + manual вне проектов |
| Date/Datetime | смешаны в Date | строго раздельные типы |
| CSS units | rem-предпочтительно | **исключительно** относительные, hardcoded px = blocker |
| Точки входа | toolbar Schema button | context menu + ribbon + sidebar leaf + palette + hotkeys + inline editor + column header menu |

## Quality gate baseline (must remain green)

- `tsc --noEmit -p tsconfig.json` → 0 errors
- `npx jest` → **60 suites / 985 tests PASS** (Stage A.10 baseline)
- `npm run build` → PASS (1 pre-existing third-party a11y warning, off-scope)

## Pre-R0 obligations (открытые)

| # | Task | Owner | State |
|---|------|-------|-------|
| 1 | Подтверждение §1–§4 Revision 3 | user | **WAIT** |
| 2 | Ответы на 7 вопросов §5 | user | **WAIT** |
| 3 | Решение о гранулярности R0 (целиком vs дробление) | user | **WAIT** |
| 4 | Bug-tracker update (внести 6 critical findings из §3 Revision 3) | director | pending |
| 5 | R0.4 Entry-point inventory (read-only) | director | можно начать без gate |
| 6 | Stubs.md sweep — пометить STB-VISUALIZER-* как "subsumed by R1" | director | можно начать без gate |

## Director protocol — non-negotiable (без изменений)

- **NO commit, NO push, NO tag, NO amend** без explicit user approval.
- **Auditor PASS** required before any phase is marked done.
- **context_state.md** updated after every significant action.
- **Bilingual parity** (RU↔EN) для всех новых i18n keys.

---

# (АРХИВ) Session handoff — 2026-04-30 (Engine v2 + YAML Визуализатор blueprint)

> Этот раздел сохранён для истории. Перекрыт Revision 3 от 2026-05-01.
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