# ARCHITECTURE_V5

> **Версия**: V5.0-foundation
> **Дата**: 2026-05-05
> **Статус**: TARGET — целевая архитектура. Часть пунктов реализована, часть — план.
> **Замещает**: `ARCHITECTURE.md`, `ARCHITECTURE_V4.md`.

---

## 0. Видение V5 (что меняется по сравнению с V4)

| Аспект | V4 | V5 |
|---|---|---|
| Главная парадигма | "Database view" — табличное представление с виджетами | "Dashboard view" — свободное масштабируемое полотно (canvas) |
| Структура проекта | один dataframe → несколько views | один проект → много sub-base'ов (Matryoshka) с двусторонними relations + rollups |
| YAML | сторонняя panel | каждая заметка с frontmatter = мини-база; YAML Visualizer заменяет нативную Properties pane |
| Formula | 4 разрозненных evaluator'а + UI shell'ов | один AST + два evaluator'а (boolean/value) + один UI shell |
| Color | 5 ad-hoc реализаций | один `ColorPalette` контракт + один store |
| Table | legacy DataGrid из forked obsidian-projects v2 | удалён; единственный путь — `DataTable` widget внутри Dashboard |
| Filter | каноничный `filterEvaluator` + параллельный Calendar `filterEngine` | один engine с baseDate-aware preprocessor'ом |

---

## 1. Слои (4-Matryoshka)

Зависимости направлены **внутрь** (Clean Architecture). Внешние слои знают о внутренних, но не наоборот.

```
┌─────────────────────────────────────────────────────────────┐
│ Shell (entry / lifecycle)                                   │
│   src/main.ts, src/view.ts, src/customViewApi.ts            │
│   src/managers/CommandManager.ts, src/events.ts             │
└─────────────────────────────────────────────────────────────┘
                          │ depends ↓
┌─────────────────────────────────────────────────────────────┐
│ UI surfaces (Svelte)                                        │
│   src/ui/app/         (App, View, useView, DataFrameProvider)│
│   src/ui/views/       (Dashboard, Calendar, Board, Gallery, │
│                        VisualizerPane, YamlVisualizer)      │
│   src/ui/components/  (FormulaEditor, ColorPicker, Nav, ...)│
│   src/ui/modals/                                            │
│   src/ui/settings/                                          │
└─────────────────────────────────────────────────────────────┘
                          │ depends ↓
┌─────────────────────────────────────────────────────────────┐
│ Engine (pure logic — no DOM, no Obsidian API)               │
│   src/lib/engine/      (filterEvaluator, aggregate,         │
│                         crossProjectResolver, emptiness,    │
│                         wikilink, contracts)                │
│   src/lib/database/    (subBase, cellEditor, partition)     │
│   src/lib/relations/   (inverseIndex, crossSubBase)         │
│   src/lib/visualizer/  (property-types, relations, overlay) │
│   src/lib/formula/     (parser + evaluators — V5 unified)   │
│   src/ui/views/Dashboard/engine/  (transformExecutor,       │
│                                    formulaEngine, rollup,   │
│                                    aggregation, virtualScroll)│
└─────────────────────────────────────────────────────────────┘
                          │ depends ↓
┌─────────────────────────────────────────────────────────────┐
│ Data (I/O + типы)                                           │
│   src/lib/dataframe/    (DataFrame, DataField, DataRecord)  │
│   src/lib/dataApi.ts    (CRUD frontmatter)                  │
│   src/lib/datasources/  (folder, tag, frontmatter, dataview)│
│   src/lib/filesystem/   (Obsidian + inmem adapters)         │
│   src/lib/frontmatter/  (reader, writer, codec)             │
│   src/lib/metadata/     (encode/decode)                     │
└─────────────────────────────────────────────────────────────┘
```

**Запрещённые зависимости** (статически проверять PR review'ом):
- Engine не импортирует из `src/ui/`, кроме исторического исключения `src/ui/views/Dashboard/engine/` (этот узел будет переехать в `src/lib/dashboard-engine/` в V5.2).
- Data не импортирует из Engine/UI/Shell.
- Никакой импорт из `obsidian` в Engine и Data, кроме adapter'ов в `src/lib/filesystem/obsidian/`.

---

## 2. Модули и грейды (inventory) {#inventory}

Сокращения: A — clean+tested · B — works+tests, minor smells · C — works, no tests / known issues · D — legacy, регрессии · F — broken/dead.

### 2.1 Shell

| Модуль | LOC | Grade |
|---|---|---|
| `src/main.ts` | ~520 | C — нет тестов, fire-and-forget promises |
| `src/view.ts` | ~150 | C |
| `src/customViewApi.ts` | ~50 | A |
| `src/managers/CommandManager.ts` | ~150 | B |
| `src/events.ts` | ~30 | B |

### 2.2 UI app/

| Модуль | LOC | Grade |
|---|---|---|
| `src/ui/app/App.svelte` | ~400 | B (нет mounted tests) |
| `src/ui/app/View.svelte` | ~350 | B |
| `src/ui/app/useView.ts` | ~110 | B (Svelte 4 blocker `(view as any).$set`) |
| `src/ui/app/DataFrameProvider.svelte` | ~250 | B (`JSON.parse` без try/catch) |
| `src/ui/app/filterFunctions.ts` | ~25 | A (facade) |
| `src/ui/app/viewSort.ts` | ~150 | B |

### 2.3 UI views/

| Модуль | LOC | Grade |
|---|---|---|
| `src/ui/views/Dashboard/` | ~800 + widgets | B |
| `src/ui/views/Dashboard/DashboardCanvas.svelte` | ~700 | B (too big — split в R5-013) |
| `src/ui/views/Table/` (legacy DataGrid) | ~1800 | **D** — под удаление в R5-001 |
| `src/ui/views/Board/` | ~600 | C |
| `src/ui/views/Calendar/` | ~5000+ | C (свой filterEngine — R5-003) |
| `src/ui/views/Calendar/agenda/filterEngine.ts` | ~520 | C — параллельный engine |
| `src/ui/views/Gallery/` | ~400 | B |
| `src/ui/views/YamlVisualizer/` | ~300 | C — переезжает в Dashboard widgets (R5-011) |
| `src/ui/views/VisualizerPane/` | ~250 | B |

### 2.4 UI components/

| Модуль | LOC | Grade |
|---|---|---|
| `FormulaEditor/FormulaEditor.svelte` | ~150 | C — shell готов, не подключён |
| `ColorPicker/ColorPicker.svelte` | ~400 | C — свой favorites localStorage |
| `Navigation/` (CompactNavBar, ViewSwitcher, SettingsMenu) | ~1500 | B |
| `FieldControl/FieldControl.svelte` | ~600 | B |
| прочие (Box, Layout, Flair, TagsInput, ...) | ~1500 | B/C |

### 2.5 Engine layer (A-grade зона)

| Модуль | Tests |
|---|---|
| `src/lib/engine/aggregate.ts` | aggregate.test |
| `src/lib/engine/filterEvaluator.ts` | filterEvaluator.test (60+ кейсов) |
| `src/lib/engine/crossProjectResolver.ts` | crossProjectResolver.test + integration |
| `src/lib/engine/crossProjectRollup.ts` | crossProjectRollup.test |
| `src/lib/engine/wikilink.ts`, `emptiness.ts`, `contracts.ts` | unit tests |
| `src/lib/database/{subBase, cellEditor, rollupMode, partition}` | 6 тестов |
| `src/lib/relations/{inverseIndex, crossSubBase}` | 3 теста |
| `src/lib/visualizer/{property-types, relations, overlay}` | 7 тестов |
| `src/lib/formula/index.ts` (facade) | index.test |

### 2.6 Dashboard engine (внутри ui/views — переедет в lib в V5.2)

| Модуль | Grade |
|---|---|
| `transformExecutor.ts` | A |
| `formulaEngine.ts` | B (ReDoS — R5-007) |
| `formulaMetadata.ts` | A |
| `formulaSerializer.ts` | C |
| `aggregation.ts` | B (count divergence — R5-004) |
| `rollup.ts` | B (deprecated re-exports) |
| `relationResolver.ts` | A |
| `conditionalFormat.ts`, `transformCache.ts`, `virtualScroll.ts`, `chartDataPipeline.ts`, `joinKey.ts` | A/B |

### 2.7 Data layer

| Модуль | Grade |
|---|---|
| `dataframe/dataframe.ts` | A |
| `dataApi.ts` | B (fire-and-forget) |
| `viewApi.ts` | A |
| `datasources/{folder,tag,frontmatter,dataview}` | B (folder/dataview без unit tests) |
| `datasources/mergeFrames.ts`, `helpers.ts` | A |
| `filesystem/{obsidian,inmem,watcher}` | B |
| `frontmatter/{reader,writer,codec}` | A |
| `metadata/{encode,decode}` | A |
| `stores/*` | B |
| `colors/{math,contracts}` | C — `contracts.ts` мёртв (R5-005) |
| `templates/interpolate.ts` | A |
| `settings/{v1,v2,v3,migrate}` | B |

---

## 3. Контракты (что считается публичным API внутри плагина)

### 3.1 ProjectView (custom view contract)

```ts
// src/customViewApi.ts
abstract class ProjectView<TConfig = unknown> {
  abstract getViewType(): string;
  abstract getDisplayName(): string;
  abstract getIcon(): string;
  abstract onOpen(props: ProjectViewProps<TConfig>): Promise<void>;
  abstract onClose(): Promise<void>;
  // V5: добавить публичный метод update(props) вместо `(view as any).$set`
  abstract update(props: Partial<ProjectViewProps<TConfig>>): void;
}
```

Изменение в V5 (R5-015): `update()` обязателен. Каждый view (Dashboard/Board/Calendar/Gallery) реализует через свой Svelte компонент.

### 3.2 DataFrame

```ts
type DataFrame = { fields: DataField[]; records: DataRecord[] };
type DataRecord = { id: string; values: Record<string, DataValue> };
type DataValue = string | number | boolean | string[] | Date | null | undefined;
```

Источник правды: `src/lib/dataframe/dataframe.ts`. Любой engine принимает и возвращает `DataFrame`.

### 3.3 Filter contract (V5 unified)

```ts
// src/lib/engine/filterEvaluator.ts
function matchesFilterConditions(
  record: DataRecord,
  filter: FilterDefinition,
  ctx: { baseDate?: Dayjs },          // V5: baseDate опциональный для Calendar agenda
): boolean;
```

Calendar agenda filterEngine удаляется (R5-003). Все консьюмеры (App.svelte, View.svelte, transformExecutor, AgendaCustomList) импортируют только из этого модуля.

### 3.4 Formula contract (V5 unified)

```ts
// src/lib/formula/
export function parseFormula(input: string): FormulaAst;       // существует
export function evaluateBoolean(ast, record, ctx): boolean;    // V5: миграция из formulaParser.evaluateFormula
export function evaluateValue(ast, record, ctx): DataValue;    // V5: миграция из Dashboard/engine/formulaEngine
export function preprocessDateFormula(input, baseDate): Dayjs; // V5: миграция из dateFormulaParser
```

UI shell — единый `src/ui/components/FormulaEditor/FormulaEditor.svelte`. Подключается в FormulaBar, AdvancedFilterEditor, DateFormulaInput.

### 3.5 Aggregation contract

```ts
// src/lib/engine/aggregate.ts (kernel)
type AggregationOp =
  | "count" | "count_unique" | "count_values"
  | "sum" | "avg" | "median" | "min" | "max" | "range"
  | "percent_true" | "concat" | "concat_unique";

// src/ui/views/Dashboard/engine/aggregation.ts (footer extras — V5.1 rename)
type FooterOp =
  | AggregationOp
  | "count_total"   // V5: было `count` с другой семантикой → переименовано (R5-004)
  | "count_checked" | "count_unchecked"
  | "percent_checked" | "percent_unchecked"
  | "percent_empty" | "percent_not_empty"
  | "earliest" | "latest" | "date_range";
```

Инвариант V5: `count` имеет одинаковую семантику (non-null) во всех слоях.

### 3.6 ColorPalette contract (V5: оживить контракт)

```ts
// src/lib/colors/contracts.ts (был мёртв; V5 — единственный источник)
interface ColorToken { id: string; hex: string; name?: string; }
interface ColorPalette { id: string; name: string; tokens: ColorToken[]; }
```

Единственный store: `src/lib/stores/palettes.ts` (создаётся в R5-005). Потребители: ColorPicker, RecordItem, ColorFiltersTab, FieldControl, любой Dashboard widget.

### 3.7 Sub-base contract (V5 — Matryoshka)

```ts
// src/lib/database/subBase.ts (расширяется в R5-009)
interface SubBase {
  id: string;
  name: string;
  parentProjectId: string;
  filter?: FilterDefinition;     // sub-base = subset проекта по фильтру
  sort?: SortDefinition;
  schema?: FieldSchema;          // optional override полей
  relations?: SubBaseRelation[]; // V5.6: bidirectional links to other sub-bases
}

// src/lib/relations/crossSubBase.ts (расширяется в R5-010)
function resolveCrossSubBaseTargets(
  sourceRecord: DataRecord,
  relation: SubBaseRelation,
  index: InverseIndex,
): DataRecord[];
```

---

## 4. Инварианты (must-hold throughout codebase)

1. **No DOM in Engine/Data.** Любая Engine-функция должна быть тестируемой в Jest без jsdom.
2. **No Obsidian polyfill leaks.** Никаких `String.contains`, `Array.contains`, `.first()`, `.last()` — используем `.includes()`, `[0]`, `[length-1]`.
3. **No `JSON.parse` без try/catch на user payload.** Settings, filter values, file content — обязательно guard.
4. **No `new RegExp(userInput)` без `isUnsafePattern()` guard** + `MAX_REGEX_INPUT_LENGTH` cap.
5. **No `new Menu()` мимо `openContextMenu` helper** — в V5.1 все 7 offenders мигрируют.
6. **`px` budget в src/.{svelte,css} ≤ 191** — locked ratchet test `R0_3_pxBudget.test.ts`. Только JS-bound coordinate px (top/left/width/height из getBoundingClientRect) допустимы.
7. **Reactive prop sync в Svelte 3**: используем `$: x = prop` для подписки, `let x = prop` только для one-shot init (с явным комментарием).
8. **Date precision**: `dayjs().isSame(other, 'day')` в filter сравнениях, не `getTime()`.
9. **Fire-and-forget promises**: запрещены. Любая mutating API должна обработать reject через `Notice()` + опциональный rollback оптимистичной мутации.
10. **`styles.css` — hand-maintained source.** `esbuild.config.mjs::mergeCSS()` дописывает токены пост-сборкой между маркерами. Не удалять и не редактировать сгенерированную часть вручную.

---

## 5. Сборка и тесты

- **Build**: `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production` → `main.js` + merged `styles.css`.
- **Tests**: `npx jest` — **98 suites / 1597 tests** (на момент 2026-05-05).
- **i18n**: `i18next`, языки `en/ru/uk/zh-CN`.
- **Зависимости (frozen)**: Svelte 3.59.2, esbuild, Jest 29, dayjs, immer, fp-ts, svelte-dnd-action, uuid, obsidian-svelte, peer obsidian-dataview.

## 6. Видение будущих фаз (где V5 заканчивается)

V5.7 завершается, когда:
- Legacy Table view удалён (R5-001).
- Все formula UI используют `FormulaEditor` shell (R5-002).
- Calendar agenda filter — обёртка над kernel (R5-003).
- Color palettes унифицированы (R5-005).
- Sub-bases canvas работает (R5-009) с двусторонними relations + rollups (R5-010).
- YAML Visualizer — widget внутри Dashboard, опционально заменяет Properties pane (R5-011, R5-012).

После V5.7 — миграция на Svelte 4 (R5-015 как blocker уже снят) и обсуждение V6 (потенциально: collaborative editing, web export).
