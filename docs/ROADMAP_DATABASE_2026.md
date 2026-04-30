# Database Roadmap 2026 (rev. 2026-04-30)

> **Ревизия**: 2026-04-30 — Стратегический пересмотр после выявления критических ограничений
> **Все версии**: в рамках 3.4.X (публичный выпуск не готов)
> **Источник правды**: `docs/architecture-engine-v2.md`

---

## Scope

Roadmap for Database direction. All work is WIP under 3.4.X until explicit release readiness decision.

- Product baseline: release 3.4.1 published (last public release).
- Quality baseline: 54 suites, 923 tests (WIP 3.4.1), production build success.
- **Revised strategic target**: самодостаточный движок данных без критической зависимости от Dataview, кросс-проектные Relations/Rollups, Custom Properties Viewer.

---

## Принципы (уточнены)

- **YAML-first**: все поля frontmatter читаются нашим движком, без Dataview.
- **Relations are wiki-links**: `[[Note]]` в YAML = typed relation field, не просто строка.
- **Rollups are derived**: вычисляются движком из related records, хранятся в памяти (не в YAML).
- One model, multiple views: table/board/gallery share one data context.
- Visual-first composition: core workflows must work without raw JSON editing.
- Release-safe delivery: each milestone must include tests, docs sync, and migration safety.

---

## Обнаруженные критические пробелы (2026-04-30)

Эти пробелы **блокируют** реализацию Notion-подобных баз данных:

| Пробел | F-id | Описание | Приоритет |
|---|---|---|---|
| **G1** | F8 | `CrossProjectRelationResolver` отсутствует — wiki-links не разрешаются между проектами | CRITICAL |
| **G2** | F9 | `CrossProjectRollupEngine` отсутствует — rollup между проектами невозможен | CRITICAL |
| **G3** | F10 | `FieldConfig` не расширен — нет `RelationFieldConfig`, `RollupFieldConfig` | HIGH |
| **G4** | F11 | Custom Properties Viewer отсутствует — нет типизированного UI для свойств заметок | HIGH |
| **G5** | F12 | Formula Editor Popup не унифицирован — существует только в DatabaseViewCanvas | MEDIUM |

> **F-id mapping**: Пробелы G1-G5 соответствуют findings F8-F12 в `docs/IMPLEMENTATION_PLAN_CURRENT.md` §4.

---

## Milestones

### M0 — Engine Foundation (CRITICAL — Q2 2026)

**Outcome**: движок поддерживает кросс-проектные Relations и Rollups.

**Почему сначала**: без этого ни один пользовательский сценарий с "Base 1 ↔ Base 2" не работает.

**Deliverables**:

1. Расширить `FieldConfig` в `src/settings/base/settings.ts`:
   - `RelationFieldConfig { type: "relation", targetProjectId: string, displayField?: string }`
   - `RollupFieldConfig { type: "rollup", relationField: string, targetField: string, function: RollupFunction }`

2. `src/lib/engine/crossProjectResolver.ts` (NEW):
   - `resolveAcrossProjects(record, fieldName, externalFrame)` → `DataRecord[]`
   - Использует `externalFrameResolver.ts` для загрузки внешнего фрейма
   - Кеш на уровне сессии (не пересобирать индекс при каждом запросе)

3. `src/lib/engine/crossProjectRollup.ts` (NEW):
   - `computeCrossProjectRollup(record, rollupConfig, externalFrame)` → `RollupResult`
   - `computeCrossProjectRollupColumn(df, rollupConfig, externalFrame)` → `Map<string, RollupResult>`
   - Использует `RollupFunction` из `rollup.ts`

4. Enrich DataFrame в `FrontMatterDataSource`:
   - При наличии `RelationFieldConfig` — добавить виртуальное resolved-поле (список связанных ID)
   - При наличии `RollupFieldConfig` — добавить виртуальное derived-поле с computed value

**Code anchors**:
- `src/settings/base/settings.ts`
- `src/lib/engine/crossProjectResolver.ts` (NEW)
- `src/lib/engine/crossProjectRollup.ts` (NEW)
- `src/lib/datasources/frontmatter/datasource.ts`
- `src/ui/views/Database/engine/relationResolver.ts` (расширить)
- `src/ui/views/Database/engine/rollup.ts` (расширить)

**Definition of done**:
- Тест: запись в Base 2 с `Счет: "[[Счет 1]]"` → resolved `DataRecord` из Base 1
- Тест: запись в Base 1 получает `Текущий баланс` = SUM(`amount`) из linked Base 2 records
- 0 новых зависимостей от Dataview

---

### M1 — Field Types UI (HIGH — Q2-Q3 2026)

**Outcome**: пользователь может настроить Relation и Rollup поля через UI без JSON-редактирования.

**Deliverables**:

1. UI для настройки Relation field в DataTable column config:
   - Выбор целевого проекта из `$settings.projects`
   - Выбор display field (как показывать записи)

2. UI для настройки Rollup field:
   - Выбор relation field (из существующих relation полей)
   - Выбор target field из целевого проекта
   - Выбор aggregation function

3. Отображение в DataTable:
   - Relation cell: список wiki-links с resolved names (кликабельные)
   - Rollup cell: computed value, badge "∑", tooltip с источником

4. Inline редактирование Relation field:
   - Dropdown с поиском по записям целевого проекта
   - Запись в YAML frontmatter как `[[Note Name]]`

**Code anchors**:
- `src/ui/views/Database/widgets/DataTable/`
- `src/ui/views/Database/types.ts`

**Definition of done**:
- Relation и Rollup поля настраиваются через UI
- Нет ручного JSON-редактирования
- Тесты покрывают field config UI

---

### M2 — Custom Properties Viewer (HIGH — Q3 2026)

**Outcome**: пользователь видит типизированные свойства заметки в отдельной панели с полной поддержкой Relations и Rollups.

> **Зависимость**: M2 требует M0 (для Relation/Rollup runtime) **и** M3 (для `FormulaField.svelte` → FormulaEditorPopup). Рекомендуется M3 выполнять параллельно с M0/M1.

**Deliverables**:

1. `PropertiesPanelView.ts` — Obsidian ItemView (leaf)
2. `PropertiesPanel.svelte` — главный компонент
3. Typed field components:
   - `StringField`, `NumberField`, `DateField`, `BooleanField`, `SelectField`
   - `RelationField.svelte` — dropdown с поиском по целевому проекту
   - `RollupField.svelte` — computed, readonly, с badge и tooltip
   - `FormulaField.svelte` — computed + кнопка открытия Formula Editor
4. Write through `fileManager.processFrontMatter` — атомарные записи
5. Real-time sync с `MetadataCache.on("changed")`

**Code anchors**:
- `src/ui/views/PropertiesPanel/` (NEW directory)
- `src/main.ts` — регистрация листа

**Definition of done**:
- Панель открывается командой из Obsidian command palette
- Relation fields показывают resolved names (не raw `[[]]`)
- Rollup fields показывают computed value
- Изменения синхронизируются с vault немедленно

---

### M3 — Formula Editor Popup (MEDIUM — Q3 2026)

**Outcome**: унифицированный Formula Editor popup доступен из всех контекстов.

**Deliverables** (из схемы 2026-04-30):

1. `FormulaEditorModal.ts` — Obsidian Modal wrapper
2. `FormulaEditorPopup.svelte`:
   - Поле ввода с syntax highlighting
   - Живой предпросмотр результата (на текущих данных записи)
   - Список доступных полей как completion (внутренняя база потоков)
   - Формулы по категориям (accordeon)
   - Подсказки + примеры с кнопкой "Скопировать"
3. Глобальный аудит и интеграция во все точки входа:
   - `FormulaBar.svelte` → открывает popup
   - `PropertiesPanel/FormulaField.svelte` → открывает popup
   - Computed column в DataTable → открывает popup
   - StatsCard formula → открывает popup

**Code anchors**:
- `src/ui/modals/FormulaEditorModal.ts` (NEW)
- `src/ui/views/Database/widgets/FormulaEditorPopup.svelte` (NEW)
- `src/ui/views/Database/widgets/FormulaBar.svelte` (MODIFY)

**Definition of done**:
- Единый popup открывается из всех контекстов
- Preview вычисляется на текущей записи
- Все категории функций доступны с примерами

---

### M4 — Pipeline Completion & Stability (Q3-Q4 2026)

**Outcome**: все transform steps полностью конфигурируемы, без ручного JSON.

**Deliverables**:
- Полные step editors для filter, aggregate, pivot, unpivot, unnest
- Step-level preview (до/после rows и columns)
- Inline validation с actionable hints

**Definition of done**:
- 0 ручных JSON-редактирований для standard workflows
- Тесты покрывают все step editors

---

### M5 — Stabilization and Release Readiness (Q4 2026)

**Outcome**: Database UX и docs готовы к публичному релизу.

> **Версионная политика**: M0-M4 — внутренние выпуски в рамках **3.4.X WIP** (НЕ публикуются). M5 — первый публичный релиз с полной Database-функциональностью; bump версии до **3.5.0+** происходит ТОЛЬКО на финальном release-cut по явному одобрению пользователя.

**Deliverables**:
- Cross-view consistency pass (table, board, gallery)
- Performance and accessibility pass
- Documentation release pass и cleanup
- Первый публичный релиз с Database (3.5.0+)

**Definition of done**:
- Performance budget: <100ms render при 1000 записей
- 0 high-severity audit findings
- Docs synchronized with shipped behavior

---

## Dependencies and Risks

| Risk | Impact | Mitigation |
|---|---|---|
| CrossProjectResolver performance на больших vault | HIGH | Кеш индексов + lazy-load внешних фреймов |
| Settings migration при добавлении RelationFieldConfig | HIGH | Additive changes only + migration test |
| Obsidian API changes (processFrontMatter) | MEDIUM | Abstraction via IFile interface |
| UX complexity outgrowing discoverability | MEDIUM | Progressive disclosure, empty-states с guidance |
| Pipeline regressions без test expansion | MEDIUM | Mandatory test gate per milestone |

## KPI Targets

- Time to first useful cross-database overview: under 5 minutes for a new user.
- Manual JSON edits for standard workflows (including relations): 0.
- Test coverage: +10 suites / +50 tests per milestone.
- Transform-related bug reports: decreasing trend after M2.
- Release documentation lag: 0 unresolved items at release cut.

## Governance

- Active execution details live in `docs/IMPLEMENTATION_PLAN_CURRENT.md`.
- This roadmap is the calendar-level source of truth for Database direction.
- Update after each milestone close or scope shift.