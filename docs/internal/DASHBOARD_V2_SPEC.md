# Dashboard V2 — Спецификация и план разработки

> **Статус**: DRAFT — требует согласования с автором проекта
> **Ветка**: `feat/dashboard-v2`
> **Архивная ветка**: `archive/dashboard-v1` — всё, что было до V2
> **Дата**: 2026-06-08
> **Заменяет**: `docs/internal/DASHBOARD_V2_MASTER_PROMPT.md` (если существует)

---

## 0. Почему начинаем с нуля

Dashboard V1 накопил системные проблемы, которые делают дальнейшее итерирование дороже, чем пересборка:

| Проблема | Проявление |
|---|---|
| **Монолит** | `DashboardCanvas.svelte` ~700 LOC — точка всего, невозможно тестировать по частям |
| **Смешанные слои** | `engine/` живёт в `src/ui/views/Dashboard/` — нарушение 4-Matryoshka |
| **Технический долг** | 55 ESLint + 72 svelte-check ошибок заблокировали CI |
| **Концептуальная размытость** | Dashboard одновременно: canvas с виджетами И база данных с view'ами — это два разных UX паттерна, которые конфликтуют |
| **Незавершённые идеи** | `database-call` (ключевой V2 концепт) добавлен, но не стал центральным |
| **Параллельные системы** | Grid layout + FreeCanvas существуют параллельно без чёткого разграничения |
| **Sprawl виджетов** | 15 типов виджетов, большинство в состоянии C/D — широко, но мелко |

**Вывод**: V1 — это эволюция без направления. V2 — это переосмысление с чёткими принципами.

---

## 1. Исходная идея (что Dashboard должен делать)

Dashboard — это **аналитическая поверхность проекта** в Obsidian.

Пользователь работает с **проектом** (набором заметок). Dashboard позволяет ему:
1. **Видеть данные проекта** в нескольких формах (таблица, доска, календарь, график)
2. **Комбинировать несколько источников** на одном экране (разные папки/теги/запросы)
3. **Строить рабочее пространство** из блоков, которые помнят своё состояние
4. **Переключаться между режимами** без потери контекста

**Ключевая метафора**: Dashboard — это **рабочий стол с несколькими мониторами**. Каждый монитор (блок) показывает независимую базу данных в выбранном представлении.

---

## 2. Ключевые принципы V2

### 2.1 `database-call` — атом данных

Каждый виджет с данными — это **самодостаточный блок**:
```
[источник данных] → [pipeline] → [representation]
 folder/tag/query     transform    table/board/calendar/gallery
```

Блок **не наследует** глобальный фрейм канваса. Каждый знает свой источник.
Это устраняет главную концептуальную путаницу V1.

### 2.2 Канвас — тонкий оркестратор

`DashboardCanvas.svelte` не должен знать про данные.
Его обязанности: **layout + routing + глобальный фильтр**.
Целевой размер: **≤ 200 LOC**.

### 2.3 Engine — в lib, не в UI

`src/ui/views/Dashboard/engine/` → `src/lib/dashboard-engine/`

Вся логика трансформации данных — чистые функции без импортов из `obsidian` и `svelte`.
Это разблокирует unit-тесты без DOM.

### 2.4 Минимальный виджет-сет, максимальное качество

Лучше 6 полностью работающих виджетов, чем 15 в состоянии C/D.
Каждый виджет выходит с тестами и без svelte-check ошибок.

### 2.5 Один layout-режим по умолчанию

Grid layout — единственный режим по умолчанию.
FreeCanvas — опция для пользователей, которые явно хотят "рабочий стол".
Не смешивать в одном рендере.

---

## 3. Архитектура V2

### 3.1 Файловая структура

```
src/
├── lib/
│   └── dashboard-engine/          ← НОВЫЙ (перенос из ui/views/Dashboard/engine/)
│       ├── index.ts               ← публичный API engine
│       ├── transformExecutor.ts
│       ├── aggregation.ts
│       ├── chartDataPipeline.ts
│       ├── conditionalFormat.ts
│       ├── formulaEngine.ts
│       ├── formulaMetadata.ts
│       ├── joinKey.ts
│       ├── relationResolver.ts
│       ├── rollup.ts
│       ├── transformCache.ts
│       ├── transformPivot.ts
│       ├── transformTypes.ts
│       ├── virtualScroll.ts
│       └── __tests__/             ← все существующие тесты engine переезжают сюда
│
└── ui/
    └── views/
        └── Dashboard/             ← чистый UI-слой
            ├── index.ts
            ├── types.ts           ← WidgetType, WidgetDefinition, DatabaseViewConfig
            ├── DashboardCanvas.svelte    ← ≤ 200 LOC — оркестратор
            ├── DashboardToolbar.svelte   ← add widget, settings, global filter
            ├── WidgetGrid.svelte         ← grid layout manager
            ├── FreeCanvas/               ← опциональный свободный канвас
            │   ├── FreeCanvas.svelte
            │   └── ...
            ├── widgets/
            │   ├── widgetRegistry.ts     ← реестр типов → компоненты
            │   ├── WidgetHost.svelte     ← routing по типу
            │   ├── WidgetShell.svelte    ← общая обёртка (header, resize, menu)
            │   │
            │   ├── DatabaseCall/        ← ГЛАВНЫЙ виджет
            │   │   ├── DatabaseCallWidget.svelte
            │   │   ├── DatabaseCallConfig.svelte
            │   │   ├── ViewTabBar.svelte
            │   │   └── views/           ← Table/Board/Calendar/Gallery внутри блока
            │   │
            │   ├── Chart/
            │   ├── Stats/
            │   ├── Checklist/
            │   ├── FilterTabs/
            │   ├── Text/                ← статический текст (markdown)
            │   ├── Divider/
            │   └── CoverBanner/
            │
            ├── dashboardCommands.ts
            └── dashboardPreload.ts
```

### 3.2 Поток данных

```
ProjectDefinition
    │
    ▼
DataSource (folder / tag / dataview)
    │
    ▼
DataFrame  ← src/lib/dataframe/dataframe.ts (неизменно)
    │
    ▼
dashboard-engine (трансформации, формулы, агрегации)
    │
    ▼
WidgetHost → [DatabaseCallWidget | ChartWidget | StatsWidget | ...]
```

### 3.3 Контракт блока данных

```typescript
// Каждый data-widget получает этот props-контракт
interface DataWidgetProps {
  // Источник
  readonly source: DataSource;           // folder/tag/dv query
  // Опциональный предфильтр (от глобального FilterTabs)
  readonly globalFilter?: FilterDefinition;
  // Пайплайн трансформаций (сортировка, группировка, формулы)
  readonly transform?: TransformPipeline;
  // Конфигурация отображения (специфична для типа виджета)
  readonly config: Record<string, unknown>;
  // API для записи (создание/обновление записей)
  readonly api: ViewApi;
}
```

---

## 4. Типология виджетов V2

### Категория A — Данные (Data widgets)

| Тип | Описание | Источник данных | Приоритет |
|---|---|---|---|
| `database-call` | Мульти-вью блок (Table/Board/Calendar/Gallery) | Независимый | **P0** |
| `chart` | График (bar/line/pie/donut) | Независимый | P1 |
| `stats` | Агрегированные метрики (count/sum/avg) | Независимый | P1 |
| `checklist` | Список задач с прогресс-баром | Независимый | P2 |

### Категория B — Навигация (Navigation widgets)

| Тип | Описание | Приоритет |
|---|---|---|
| `filter-tabs` | Вкладки фильтра, применяется ко всем data-виджетам | P1 |

### Категория C — Макет (Layout widgets)

| Тип | Описание | Приоритет |
|---|---|---|
| `text` | Статический Markdown-текст | P2 |
| `divider` | Горизонтальный разделитель с опциональным заголовком | P2 |
| `cover-banner` | Баннер с заголовком и изображением | P3 |

### Виджеты V1 — судьба

| Тип V1 | Решение |
|---|---|
| `data-table` | → `database-call` (вкладка Table) |
| `view-port` | → `database-call` (общая обёртка) |
| `data-list` | → `database-call` (вкладка List) |
| `comparison` | Отложен (сложность > ценность на этом этапе) |
| `summary-row` | Отложен (заменяется Stats widget) |
| `sub-base-canvas` | Отложен (архитектурная сложность без UX-ценности для большинства пользователей) |
| `yaml-visualizer` | Переедет в отдельный View, не в Dashboard |
| `timeline` | Отложен (P3, зависит от стабильности calendar engine) |

---

## 5. `database-call` — детальный дизайн

`database-call` — это блок-контейнер. Внутри него пользователь выбирает:
1. **Источник** — папка / тег / Dataview-запрос
2. **Набор вкладок** — каждая вкладка = один режим отображения со своим конфигом
3. **Глобальный фильтр блока** — применяется ко всем вкладкам

```
┌─────────────────────────────────────────────────────┐
│ 📁 Projects/Active  [Table] [Board] [Calendar] [+]  │ ← ViewTabBar
├─────────────────────────────────────────────────────┤
│                                                     │
│          [Контент выбранной вкладки]                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Вкладки (viewType)**:
- `table` — DataTable с виртуализацией, группировкой, условным форматированием
- `board` — Kanban с semantic-режимом для Status полей
- `calendar` — Календарь по дате начала/конца
- `gallery` — Сетка карточек с cover-изображением
- `list` — Компактный список

**Настройка**: каждая вкладка хранит свой `config` — sort/filter/group/columns. Переключение вкладок не сбрасывает состояние соседних.

**Создание**: в UI — кнопка "Add Block" → выбор источника → автоматически создаётся вкладка Table.

---

## 6. Глобальный фильтр (filter-tabs)

`filter-tabs` виджет — единственный не-data виджет, который влияет на другие.

Когда установлен `filter-tabs`, все `database-call` блоки **на этом канвасе** получают дополнительный `globalFilter`. Каждый блок применяет его поверх своего pipeline.

Механизм: `filterBridgeStore` — Svelte store на уровне канваса, который `filter-tabs` пишет, а `WidgetHost` читает для каждого data-виджета.

---

## 7. Layout-система

### 7.1 Grid mode (по умолчанию)

12-колоночная сетка с высотой ряда = `1rem * N`. Drag-resize через `svelte-dnd-action`.

```typescript
interface GridLayout {
  x: number;   // 0-11 (column)
  y: number;   // row index
  w: number;   // column span (1-12)
  h: number;   // row span
}
```

### 7.2 Free mode (опциональный)

Пользователь переключает канвас в режим "Free Canvas" через toolbar.
В этом режиме виджеты позиционируются абсолютно (px → rem-конвертация).
FreeCanvas-код переезжает без изменений из V1.

### 7.3 Переключение

Переключение Grid ↔ Free не должно терять виджеты. Конвертация:
- Grid → Free: x/y/w/h × base-rem → top/left/width/height
- Free → Grid: snap to nearest grid cell

---

## 8. Canvas — дизайн компонента (≤ 200 LOC)

```svelte
<!-- DashboardCanvas.svelte — ТОЛЬКО оркестрация -->
<script lang="ts">
  // Props: config, frame, api, project
  // Derived: widgets, layout, globalFilter
  // NO data fetching, NO engine calls
  // Delegates:
  //   - Toolbar → DashboardToolbar
  //   - Layout  → WidgetGrid | FreeCanvas
  //   - Save    → один метод saveConfig(patch)
  //   - Schema  → dashboardCommands.ts (открытие модалок)
</script>
```

**Запрещено в DashboardCanvas**: импорты из `engine/`, `applyFormulaFields`, `applyAutoFields`, прямые fetch данных, бизнес-логика трансформаций.

---

## 9. Engine → lib (план переноса)

Текущее положение: `src/ui/views/Dashboard/engine/`
Целевое положение: `src/lib/dashboard-engine/`

**Перенос без изменений логики** — только пути импортов:

| Файл | Действие |
|---|---|
| `transformExecutor.ts` | Перенести |
| `aggregation.ts` | Перенести |
| `chartDataPipeline.ts` | Перенести |
| `conditionalFormat.ts` | Перенести |
| `formulaEngine.ts` | Перенести + исправить ReDoS (issue из V1) |
| `formulaMetadata.ts` | Перенести |
| `joinKey.ts` | Перенести |
| `relationResolver.ts` | Перенести |
| `rollup.ts` | Перенести |
| `transformCache.ts` | Перенести |
| `transformPivot.ts` | Перенести |
| `transformTypes.ts` | Перенести |
| `virtualScroll.ts` | Перенести |
| `applyAutoFields.ts` | Перенести (из root Dashboard/) |
| `applyFormulaFields.ts` | Перенести |
| `__tests__/` | Перенести, пути исправить |

**Публичный API**: `src/lib/dashboard-engine/index.ts` экспортирует только то, что нужно UI.

---

## 10. Технические требования V2

### Инварианты (добавляются к глобальным)

1. `DashboardCanvas.svelte` — **≤ 200 LOC** (проверять перед каждым PR).
2. Каждый widget-компонент — **≤ 300 LOC** (исключение: DatabaseCallWidget ≤ 400).
3. `dashboard-engine/` — **нет импортов из `obsidian`** (Engine остаётся чистым).
4. `dashboard-engine/` — **100% покрытие unit-тестами** для всех публичных функций.
5. Каждый новый виджет-тип — **тест в widgetRegistry.test.ts**.

### Gates перед каждым PR (стандартные 4-gate)

```bash
npm run build          # 0 ошибок
npm test               # baseline ≥ 139 suites / 2099 tests
npm run lint           # 0 ошибок
npm run svelte-check   # 0 ошибок
```

### Первый шаг — восстановить CI

Прежде чем писать V2-код, необходимо:
1. Исправить 55 ESLint ошибок (issue #049)
2. Исправить 72 svelte-check ошибки (issue #049)
3. Зафиксировать зелёный baseline на `feat/dashboard-v2`

---

## 11. План разработки по фазам

### Фаза 0 — Чистый старт (нет кода V2, только зелёный CI)
- [ ] Исправить все ESLint ошибки (55 штук)
- [ ] Исправить все svelte-check ошибки (72 штуки)
- [ ] Подтвердить: `npm run lint` 0 ошибок, `npm run svelte-check` 0 ошибок
- [ ] Зафиксировать базовый коммит на `feat/dashboard-v2`

### Фаза 1 — Перенос Engine в lib (без изменения логики)
- [ ] Создать `src/lib/dashboard-engine/`
- [ ] Перенести все engine-файлы (только изменение путей импортов)
- [ ] Перенести тесты engine
- [ ] Обновить все импорты в `src/ui/views/Dashboard/`
- [ ] Подтвердить: `npm test` baseline держится

### Фаза 2 — Новый DashboardCanvas (≤ 200 LOC)
- [ ] Декомпозировать `DashboardCanvas.svelte` — вынести всё лишнее
- [ ] `WidgetGrid.svelte` — единственный layout-хозяин
- [ ] `WidgetShell.svelte` — общая обёртка для всех виджетов
- [ ] `WidgetHost.svelte` — routing по типу, без бизнес-логики

### Фаза 3 — DatabaseCallWidget (главный виджет)
- [ ] `DatabaseCallWidget.svelte` — источник + табы + pipeline
- [ ] `ViewTabBar.svelte` — переключение вкладок, добавление новых
- [ ] Вкладка Table — рефакторинг DataTable как view внутри блока
- [ ] Вкладка Board — рефакторинг Board view как view внутри блока
- [ ] Вкладка Calendar — адаптация Calendar engine
- [ ] Вкладка Gallery — адаптация Gallery view

### Фаза 4 — Utility-виджеты
- [ ] `ChartWidget` — bar/line/pie на базе существующего Chart V1
- [ ] `StatsWidget` — агрегации count/sum/avg
- [ ] `FilterTabsWidget` — глобальный фильтр канваса
- [ ] `TextWidget`, `DividerWidget` — статический контент

### Фаза 5 — Интеграция и полировка
- [ ] FreeCanvas-режим — перенос без изменений
- [ ] `CoverBanner` виджет
- [ ] i18n — все строки через i18n ключи
- [ ] Миграция настроек V1 → V2 (для пользователей, которые перейдут)
- [ ] Demo project обновлён под V2

---

## 12. Вопросы для согласования

Следующие решения требуют явного подтверждения автором проекта:

1. **Удаление виджетов** — `sub-base-canvas`, `yaml-visualizer`, `comparison`, `summary-row`, `timeline` из V2. Можно ли их полностью убрать из кода, или нужно сохранить совместимость с V1-настройками?

2. **Sub-base концепция** — В V1 была идея Matryoshka (базы внутри баз). Нужно ли её сохранять в V2, или `database-call` с вложенным источником это достаточный аналог?

3. **Миграция настроек V1 → V2** — Если у пользователя есть сохранённый Dashboard V1, как он должен выглядеть после перехода? Нужна ли автоматическая миграция?

4. **FreeCanvas-режим** — Оставить как-есть (перенести без изменений) или рефакторить вместе с остальным?

5. **`filter-tabs` scope** — Глобальный фильтр должен применяться ко всем data-блокам на канвасе, или пользователь должен явно подписывать блоки на фильтр?

---

## 13. Что НЕ меняем в V2

- `src/lib/dataframe/` — DataFieldType, DataFrame, DataRecord остаются неизменными
- `src/lib/engine/filterEvaluator.ts` — канонический filter engine (single source of truth)
- `src/lib/formula/` — formula stack V5 (AST + evaluators)
- `src/lib/relations/` — bidirectional relations engine
- Все View-типы вне Dashboard (Board, Calendar, Gallery, VisualizerPane) — не трогаем
- `styles.css` дизайн-токены — только через `--ppp-*` переменные

---

*Документ будет обновляться по мере согласования и начала реализации.*
