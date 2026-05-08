# Session Re-prompt — Следующая сессия реализации (V5.8 / V5.9)

> **Назначение**: нулевая точка входа для следующей агентской сессии реализации.
> **Обновлён**: 2026-05-08 (аналитическая сессия, Клод внешний аудит)
> **Замещает**: предыдущую версию SESSION_REPROMPT (Session 3/6 scope).
> **Режим**: это сессия **РЕАЛИЗАЦИИ** — конкретные тикеты ниже. Не аналитическая.

---

## 0. Инструкция для агента

1. Прочитай §1 (стек), §2 (что уже сделано), §3 (что делать), §4 (правила)
2. Входная точка работы — **R5-016 (P0)**, затем по порядку в §3
3. Перед любым изменением >2 модулей → консультация с `architect` субагентом
4. После каждого крупного блока → `context-keeper` субагент
5. Никакого `@ts-ignore`, никаких `px` (кроме ratchet-guard)

---

## 1. Стек проекта

| Параметр | Значение |
|----------|---------|
| Плагин | obs-projects-plus v3.4.2 |
| TypeScript | strict mode, zero `@ts-ignore` |
| UI | Svelte 3.59.2 |
| Build | esbuild + custom mergeCSS |
| Tests | Jest 29 — **106–107 suites / 1679–1700 tests PASS** |
| i18n | i18next (en/ru/uk/zh-CN) |
| Peer deps | obsidian API, obsidian-dataview (optional) |
| PX-budget | ≤191 hardcoded px (ratchet locked in `R0_3_pxBudget.test.ts`) |

---

## 2. Что уже сделано (не трогать, не переделывать)

### V5.1–V5.7 — ВСЁ ЗАВЕРШЕНО

| Тикет | Что | Статус |
|---|---|---|
| R5-001 | Удалён legacy DataGrid/TableView → DataTable widget активен | ✅ DONE |
| R5-002 | Formula stack Phase 1 (canonical imports) | ✅ DONE Phase 1 |
| R5-003 | Calendar filterEngine → thin wrapper над filterEvaluator | ✅ DONE |
| R5-005 | Unified Color/Palette system (`lib/stores/palettes.ts`) | ✅ DONE |
| R5-006 | `new Menu()` → `openContextMenu()` везде | ✅ DONE |
| R5-007 | ReDoS guards + JSON.parse safety | ✅ DONE |
| R5-008 | Settings migration v3→v4 | ✅ DONE |
| R5-009 | SubBaseCanvasWidget + SubBaseCanvasConfig created | ✅ DONE |
| R5-011 | YamlVisualizerWidget создан и зарегистрирован | ✅ DONE |
| R5-013 | DashboardCanvas: dashboardCommands.ts + dashboardPreload.ts извлечены | ✅ PARTIAL (756 LOC → цель ~250) |
| R5-014 | Unit tests на useView, folder/dataview datasource, viewHelpers | ✅ DONE |
| R5-015 | `(view as any).$set` → typed `updateProps()` | ✅ DONE |

### Дополнительно реализовано (не было в backlog V5.1–V5.5)

- `applyFormulaFields.ts` — formula columns инлайн (MPLAN-001)
- Rollup UI в `ConfigureField.svelte` (203–318) — готов
- `GridRelationCell.svelte` — pill-chips через `RelationListView`
- `SubBaseTabs.svelte` интегрирован в `DataTableWidget.svelte`
- `GridTypedCell.svelte` — typed cell dispatch по DataFieldType

---

## 3. Что делать (приоритизированный список)

### 🔴 P0 — R5-016: Замкнуть реактивный контур

**Это главная задача сессии.** Без неё дашборд — статичный отчёт, а не живая база.

**Проблема**: `invalidateTransformCache()` существует в `transformCache.ts` но **не вызывается** из vault event handlers. `vault.on("modify")` → `DataFrameProvider.refresh()` → DataFrame пересобирается → `transformCache.get(key)` → **возвращает устаревший результат** → UI не обновляется.

**Scope**:
1. `src/ui/views/Dashboard/engine/transformCache.ts`
   - Добавить `invalidateAll()` и `invalidate(projectId: string)` (key-selective)
2. `src/ui/app/DataFrameProvider.svelte`
   - Внутри существующего `refresh()` callback: вызвать `invalidate(projectId)` до rebuild
3. `src/ui/views/Dashboard/DashboardCanvas.svelte`
   - Убедиться что store subscription после invalidation вызывает re-render transform pipeline
   - Добавить `isRecalculating: boolean` state — показывать spinne/indicator в header пока пересчёт
4. `src/lib/datasources/folder/datasource.ts`
   - Проверить что `onVaultChange` callback поднимается корректно до `DataFrameProvider.refresh()`
5. Новый тест: `src/ui/views/Dashboard/engine/transformCache.test.ts`
   - `invalidate()` вызван → следующий `get()` — cache miss → pipeline re-runs → PASS

**Debounce**: vault.on("rename"/"create"/"delete") может срабатывать серийно. Добавить `debounce(300ms)` к вызову `invalidate()` в DataFrameProvider.

**AC**: открыть Dashboard с `sum(amount)`. Изменить `amount` в source-файле. Через ≤500ms Dashboard обновляется без ручного действия.

**Complexity**: S (≤200 LOC — wiring, не новая логика)
**Depends on**: R5-013 PARTIAL (DashboardCanvas должен иметь изолированный subscription point)

---

### 🟠 P1 — R5-010: Bidirectional relations + rollups across sub-bases

**Scope**:
- `src/lib/relations/crossSubBase.ts` — расширить для двустороннего lookup
- `src/lib/engine/crossProjectRollup.ts` → generalize → `crossEntityRollup` (project + sub-base unified)
- UI: relation picker modal (новый) + rollup field config UI update

**AC**: relation между sub-base A (поле `tasks`) и B (поле `project`) работает в обе стороны. Изменение в A → rollup в B обновляется (зависит от R5-016).

**Complexity**: XL (~800 LOC)
**Depends on**: R5-009 ✅ DONE, R5-016

---

### 🟠 P1 — R5-013: Довести DashboardCanvas до цели ~250 LOC

Текущее: 756 LOC после частичного извлечения. Остались: SchemaManager, TemplateManager.
- Извлечь в `dashboardSchema.ts` и `dashboardTemplates.ts`
- Цель: DashboardCanvas.svelte = layout + DnD только (~250 LOC)

**Complexity**: M
**Note**: частично блокирует R5-016 (clean subscription point)

---

### 🟡 P2 — R5-012: YAML Visualizer как Properties pane (optional default)

- Settings toggle "Use YAML Visualizer as Properties pane" (default off)
- `src/main.ts` — auto-show на file open
- `src/ui/views/VisualizerPane/` — side-by-side embed

**Complexity**: M
**Depends on**: R5-011 ✅ DONE

---

### 🟡 P2 — R5-002 Phase 2: Move evaluateValue to lib/formula

- `src/ui/views/Dashboard/engine/formulaEngine.ts` → становится тонким wrapper'ом (перенести `evaluateValue`)
- `src/lib/formula/index.ts` — добавить `evaluateValue`

**Complexity**: S

---

### 🟡 P2 — R5-019: Relation picker popover (не heavy modal)

- Новый `src/ui/components/RelationPicker/RelationPickerPopover.svelte`
- Wire в DataTable cell click для Relation полей
- Searchable, keyboard-navigable

**Complexity**: M
**Depends on**: R5-010

---

### 📋 P3 — Visual polish (R5-018, R5-020, R5-021)

- R5-018: px→rem sweep в `styles.css` (DESIGN_CONCEPT §1)
- R5-020: row hover highlight, drag handle, bulk select (DESIGN_CONCEPT §3)
- R5-021: CSS transitions `opacity 120ms ease` на hover controls (DESIGN_CONCEPT §5)

---

## 4. Ключевые инварианты (нельзя нарушать)

| Инвариант | Описание |
|---|---|
| PX-budget | 191 locked — проверяется тестом `R0_3_pxBudget.test.ts` |
| TypeScript strict | Zero `@ts-ignore` |
| styles.css | Hand-maintained источник; токены мержатся `esbuild.config.mjs::mergeCSS()` |
| Architectural changes | >2 модулей → `architect` subagent до кода |
| Context preservation | После крупного блока → `context-keeper` subagent |
| Write tool only | НЕ PowerShell Set-Content (BOM issue L-001) |
| Enum values | `DataFieldType.String`, не `"string"` (L-004) |
| DataField | Требует `identifier: boolean` (L-005) |

---

## 5. Критерий успеха сессии

**Главный критерий (UX flow шаг 3)**:
> Пользователь меняет статус задачи в markdown файле. Dashboard через ≤500ms показывает обновлённый `sum()` без ручного закрытия/открытия.

Полный UX сценарий (5 шагов): `docs/internal/UX_FLOW_MAIN_SCENARIO.md`

---

## 6. Входные материалы (прочитать в начале)

| Документ | Что даёт |
|----------|---------|
| `docs/internal/MASTER_MAP_V5.md` | Навигация + фазы + K-* debt items (обновлён 2026-05-08) |
| `docs/internal/REFACTOR_BACKLOG_V5.md` | Все R5-* тикеты (R5-001…R5-021, обновлён 2026-05-08) |
| `docs/internal/UX_FLOW_MAIN_SCENARIO.md` | Главный сценарий, матрица готовности по шагам |
| `docs/analytics/ANALYTICAL_REVIEW_2026-05-08.md` | Полный аналитический срез: visual audit, Notion comparison, gaps |
| `docs/internal/DATAVIEW_ABSORPTION_PLAN.md` | V5.8 Dataview bridge (Gap 1–5) |
| `docs/internal/DESIGN_CONCEPT_NOTION_AESTHETIC.md` | Визуальный референс (тикеты обновлены до R5-*) |
| `memories/repo/session-state.md` | Архитектурный лог, code map, lessons learned |
| `docs/internal/MODERNIZATION_PLAN_V5.md` | Детальный план MPLAN-* тикетов (от сессии 6) |

---

## 7. Известные пропасти (не в текущем scope, задокументировать если найдёшь решение)

- **Property-level relations** — концепт связи между *свойствами* разных заметок, а не только между записями (строками). Сейчас R5-010 = связь записей целиком. Архитектурно не описано.
- **Writeable formula fields** — формула, которая пишет результат обратно в frontmatter. Cycle detection потребует.
- **Side-peek карточки** — клик на relation chip → side panel с карточкой записи (нет тикета).
- **V5.8 Dataview Adaptive Bridge** — конкретные тикеты из `DATAVIEW_ABSORPTION_PLAN.md §6` всё ещё DRAFT.
