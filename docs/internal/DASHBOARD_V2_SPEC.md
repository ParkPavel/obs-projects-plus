# Dashboard V2 — Спецификация и план разработки

> **Статус**: СОГЛАСОВАНО — ответы получены 2026-06-09, спек обновлён
> **Ветка**: `feat/dashboard-v2`
> **Архивная ветка**: `archive/dashboard-v1` — весь V1-код сохранён, не удаляется
> **Дата**: 2026-06-09 (rev.2)
> **Пользовательское видение**: `docs/internal/DASHBOARD_V2_VISION.md` — источник правды для UX

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

## 1. Что такое Dashboard (переосмысление)

Dashboard — это **рабочая поверхность, на которой собрана вся жизнь проекта**.

> *Полное пользовательское видение: `docs/internal/DASHBOARD_V2_VISION.md` — читать перед любыми UX-решениями.*

### Ключевые тезисы

1. **Папка уже является базой.** Плагин видит схему в данных, которые уже есть — не заставляет данные приходить к схеме.

2. **Заметка и запись в БД — одна сущность.** Редактирование в таблице → изменение в markdown-файле. Редактирование frontmatter вручную → немедленное обновление во всех представлениях.

3. **Матрёшка — единственный правильный способ строить UX.** База данных может содержать другие базы данных. Клиент → список сеансов → детали сеанса. Это не опция, это архитектурный принцип V2.

4. **WikiLink — это внешний ключ.** `client: [[Иван Петров]]` — реляционная связь для rollups, кросс-запросов и автоматических агрегатов.

5. **Фильтр — это тоже база.** Сохранённый фильтр образует живую коллекцию с собственными представлениями. Это реализация `native-query` концепта.

6. **Прогрессивное раскрытие сложности.** Три кнопки на старте. Сложные функции появляются по мере потребности.

---

## 2. Ключевые принципы V2

### 2.1 `database-call` — атом данных

Каждый виджет с данными — это **самодостаточный блок**:
```
[источник данных] → [pipeline] → [representation]
 folder/tag/query     transform    table/board/calendar/gallery
```

Блок **не наследует** глобальный фрейм канваса. Каждый знает свой источник.

### 2.2 Матрёшка — обязательный принцип

**Подтверждено 2026-06-09**: Sub-base концепция — единственный правильный способ строить UX.

База данных может содержать другие базы. Клиент → список сеансов → детали сеанса.
**Матрёшка работает через связи**: поле типа `Relation` в дочерней базе образует внешний ключ. Открытие sub-base автоматически создаёт фильтр по этому ключу — пользователь не настраивает вручную.

### 2.3 Множественные суб-базы с реактивными связями ← КЛЮЧЕВОЙ ПРИНЦИП

**Подтверждено 2026-06-09**: На одном канвасе должно быть **несколько независимых суб-баз в разных блоках**, каждая со своими настройками, и между ними должны работать **двусторонние реактивные связи**.

Это не "один detail-panel сбоку". Это N полноценных `database-call` блоков на канвасе, между которыми настроена **linked selection** — выбор записи в одном блоке реактивно обновляет данные в других.

```
┌──────────────────────────────────────────────────────────────┐
│  КАНВАС                                                      │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  [Клиенты]       │  │  [Сеансы]        │                 │
│  │  Table  Board    │  │  Table  Calendar │                 │
│  │  ───────────     │  │  ──────────────  │                 │
│  │  Иван Петров ●─────→│  Сеансы Ивана   │                 │
│  │  Мария Иванова   │  │  (auto-filtered) │                 │
│  └──────────────────┘  └──────────────────┘                 │
│         │selection                │                         │
│         ▼                         ▼                         │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  [Stats: клиент] │  │  [Chart: боль]   │                 │
│  │  Иван: 15 сеансов│  │  Динамика Ивана  │                 │
│  └──────────────────┘  └──────────────────┘                 │
└──────────────────────────────────────────────────────────────┘
```

**Выбрал Иван → все три связанных блока перефильтровались.** Выбрал Мария → всё перестроилось.

Каждый блок-детализатор:
- Имеет **свой источник** (независимая папка/тег/запрос)
- Имеет **свои настройки** (вкладки, столбцы, группировка)
- Имеет **свои представления** (один видит Table+Calendar, другой только Stats)
- Подписан на выбор в другом блоке через `linkedToWidgetId`

Это реализует пользовательский сценарий из VISION.md: "Перетащил клиента в канбане из 'Активные' в 'Ремиссия' — в календаре обновился статус, в графике появилась точка, в карточке дописалась строка."

### 2.4 Канвас — тонкий оркестратор

`DashboardCanvas.svelte` — только layout + routing.
**≤ 200 LOC**. Никаких вызовов engine, никакого fetch данных.

### 2.5 Engine — в lib, не в UI

`src/ui/views/Dashboard/engine/` → `src/lib/dashboard-engine/`

Чистые функции. Нет импортов из `obsidian`, нет импортов из `svelte`.
Полностью тестируемо без DOM.

### 2.6 Unified Filter System

**Подтверждено 2026-06-09**: Основная проблема V1 — множество несогласованных интерфейсов фильтрации с разным поведением.

Принцип V2:
- **Один `FilterPanel.svelte`** — используется везде (проект, вью, виджет, агенда)
- **Один engine** — `filterEvaluator.ts` (уже существует, не менять)
- **Уровень фильтрации определяется точкой входа**, а не отдельным компонентом:
  - Настройки проекта → фильтрует весь проект
  - Настройки вью → фильтрует это представление
  - Настройки виджета → фильтрует данные виджета
  - Настройки агенды → фильтрует агенду

Разноуровневость **сохраняется**. Дизайн и поведение — **едины**.

### 2.7 FreeCanvas — удалить полностью

**Подтверждено 2026-06-09**: FreeCanvas полностью под снос. Единственный layout — Grid.
Код `FreeCanvas/` останется в `archive/dashboard-v1`. В V2 его нет.

### 2.8 Миграция V1 → V2 — не нужна

**Подтверждено 2026-06-09**: Финального релиза не было, пользователей мало. Пересобираем с нуля.

### 2.9 Минимальный виджет-сет, максимальное качество

Лучше 7 полностью работающих виджетов, чем 15 в состоянии C/D.
Каждый виджет выходит с тестами, без lint-ошибок, без svelte-check ошибок.

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
        └── Dashboard/             ← чистый UI-слой (нет FreeCanvas!)
            ├── index.ts
            ├── types.ts           ← WidgetType, WidgetDefinition, DatabaseViewConfig
            ├── DashboardCanvas.svelte    ← ≤ 200 LOC — только layout + routing
            ├── DashboardToolbar.svelte   ← add widget, settings, filter entry point
            ├── WidgetGrid.svelte         ← единственный layout-менеджер
            ├── widgets/
            │   ├── widgetRegistry.ts
            │   ├── WidgetHost.svelte     ← routing по типу
            │   ├── WidgetShell.svelte    ← общая обёртка (header, resize, menu)
            │   │
            │   ├── DatabaseCall/        ← ГЛАВНЫЙ виджет
            │   │   ├── DatabaseCallWidget.svelte
            │   │   ├── DatabaseCallConfig.svelte
            │   │   ├── ViewTabBar.svelte
            │   │   ├── SubBasePanel.svelte   ← детальная карточка (Матрёшка)
            │   │   └── views/               ← Table/Board/Calendar/Gallery
            │   │
            │   ├── Chart/
            │   ├── Stats/
            │   ├── Checklist/
            │   ├── FilterTabs/
            │   ├── Text/
            │   ├── Divider/
            │   └── CoverBanner/
            │
            ├── FilterPanel/             ← ЕДИНЫЙ компонент фильтрации
            │   ├── FilterPanel.svelte   ← используется на всех уровнях
            │   └── FilterRow.svelte
            │
            ├── dashboardCommands.ts
            └── dashboardPreload.ts
```

> **⚠️ Нет `FreeCanvas/` папки.** Полностью удалена. Код сохранён в `archive/dashboard-v1`.

### 3.2 Поток данных (главный путь)

```
ProjectDefinition
    │
    ▼
DataSource (folder / tag / dataview / native-query)
    │
    ▼
DataFrame  ← src/lib/dataframe/dataframe.ts (неизменно)
    │
    ▼
dashboard-engine (трансформации, формулы, агрегации, relations)
    │
    ▼
WidgetHost → DatabaseCallWidget
                ├── Table view
                ├── Board view
                ├── Calendar view
                └── SubBasePanel → [вложенный DatabaseCallWidget] ← Матрёшка
```

### 3.3 Поток данных фильтрации (Unified Filter)

```
Точка входа (project settings / view toolbar / widget config / agenda)
    │
    ▼
FilterPanel.svelte  ← один компонент
    │  (scope определён пропсом или контекстом)
    ▼
FilterDefinition  ← src/settings/base/settings.ts (неизменно)
    │
    ▼
filterEvaluator.ts  ← src/lib/engine/ (неизменно, single engine)
    │
    ▼
filtered DataFrame
```

### 3.4 Контракт блока данных

```typescript
// Каждый data-widget получает этот props-контракт
interface DataWidgetProps {
  readonly source: DataSource;           // folder/tag/dv query/native-query
  readonly globalFilter?: FilterDefinition; // от canvas-level FilterTabs
  readonly transform?: TransformPipeline;
  readonly config: Record<string, unknown>;
  readonly api: ViewApi;
  // Матрёшка: если задан — блок отображает sub-base вместо списка
  readonly subBaseRecordId?: string;
}
```

### 3.5 Реактивные связи между блоками (Canvas Selection Bus)

Ключевой механизм принципа 2.3. На уровне канваса существует **Selection Bus** — Svelte store, который хранит текущий выбор по каждому блоку:

```typescript
// canvasSelectionStore.ts — создаётся в DashboardCanvas, передаётся через setContext
interface CanvasSelection {
  // widgetId → выбранные recordId (множество для multi-select)
  selections: Record<string, Set<string>>;
}

// Публичный интерфейс для виджетов
interface CanvasSelectionBus {
  // Блок A сообщает о выборе записи
  select(widgetId: string, recordId: string): void;
  deselect(widgetId: string): void;
  // Блок B читает выбор блока A
  getSelection(widgetId: string): Set<string>;
  // Реактивная подписка
  subscribe(widgetId: string, cb: (ids: Set<string>) => void): Unsubscriber;
}
```

**Настройка связей в конфигурации виджета:**

```typescript
interface DatabaseCallConfig {
  // ... остальные настройки
  
  // Linked selection — этот блок фильтруется по выбору в другом блоке
  linkedSelection?: {
    sourceWidgetId: string;    // ID блока-мастера
    relationField: string;     // поле в ЭТОМ блоке, по которому фильтровать
                               // (пусто = filter by record id directly)
  };
}
```

**Поток реактивности:**

```
Пользователь кликает запись в блоке A (Клиенты)
    │
    ▼
selectionBus.select('block-A', 'record-ivan')
    │
    ▼ (реактивно, через Svelte store)
Блок B (Сеансы) читает: linkedTo='block-A', relationField='client'
    │
    ▼
Генерирует дополнительный FilterDefinition:
  { field: 'client', operator: 'is', value: 'record-ivan' }
    │
    ▼
filterEvaluator применяет к своему DataFrame
    │
    ▼
Блок B отображает только сеансы Ивана
```

**Множественные связи:** Блоки C (Stats) и D (Chart) могут быть независимо связаны с блоком A по той же схеме. Каждый обновляется отдельно, со своим pipeline.

**Двунаправленность:** Если блок B изменяет запись (через inline-edit в Table), `viewApi.updateRecord()` пишет в markdown-файл → Obsidian metadata cache обновляется → все блоки, подписанные на этот источник, получают новый DataFrame через `externalFrameInvalidation` store → реактивное обновление.

---

## 4. Типология виджетов V2

### Категория A — Данные (Data widgets)

| Тип | Описание | Приоритет |
|---|---|---|
| `database-call` | Мульти-вью блок + Матрёшка (sub-base карточки) | **P0** |
| `chart` | График (bar/line/pie/donut) | P1 |
| `stats` | Агрегированные метрики (count/sum/avg/динамика) | P1 |
| `checklist` | Список задач с прогресс-баром | P2 |

### Категория B — Управление (Control widgets)

| Тип | Описание | Приоритет |
|---|---|---|
| `filter-tabs` | Вкладки фильтра — canvas-level scope, применяется ко всем data-блокам | P1 |

### Категория C — Макет (Layout widgets)

| Тип | Описание | Приоритет |
|---|---|---|
| `text` | Статический Markdown-текст | P2 |
| `divider` | Горизонтальный разделитель с опциональным заголовком | P2 |
| `cover-banner` | Баннер с заголовком и изображением | P3 |

### Виджеты V1 — окончательная судьба

| Тип V1 | Решение V2 | Код |
|---|---|---|
| `data-table` | → входит в `database-call` как вкладка Table | удалить |
| `view-port` | → входит в `database-call` как general wrapper | удалить |
| `data-list` | → входит в `database-call` как вкладка List | удалить |
| `sub-base-canvas` | → реализован через `SubBasePanel` в `database-call` | удалить (заменить) |
| `comparison` | ❌ Удалить | в `archive/dashboard-v1` |
| `summary-row` | ❌ Удалить → заменяет `stats` | в `archive/dashboard-v1` |
| `yaml-visualizer` | ❌ Удалить из Dashboard → отдельный View | в `archive/dashboard-v1` |
| `timeline` | ❌ Удалить (P3, зависит от calendar engine) | в `archive/dashboard-v1` |
| `FreeCanvas` | ❌ Удалить полностью | в `archive/dashboard-v1` |

> **Все удалённые виджеты живут в `archive/dashboard-v1`. Ни один не стирается с git-истории.**

---

## 5. `database-call` — детальный дизайн

`database-call` — главный атом Dashboard. Каждый экземпляр — полноценная независимая единица.

### 5.1 Автономный блок (Standalone mode)

```
┌─────────────────────────────────────────────────────┐
│ 📁 Clients  [Table] [Board] [Calendar] [Gallery] [+]│ ← ViewTabBar
├─────────────────────────────────────────────────────┤
│  Name         │  Status    │  Last session           │
│  Иван Петров  │  Active    │  2026-06-01             │
│  Мария Иванова│  Remission │  2026-05-15             │
└─────────────────────────────────────────────────────┘
```

**Вкладки (viewType)**:
- `table` — DataTable с виртуализацией, группировкой, условным форматированием
- `board` — Kanban с semantic-режимом для Status полей
- `calendar` — Календарь по дате начала/конца
- `gallery` — Сетка карточек с cover-изображением
- `list` — Компактный список

### 5.2 Связанный блок (Linked mode — реактивная суб-база)

Блок с настроенным `linkedSelection` — это **реактивная суб-база**. Он выглядит идентично автономному блоку, но его данные определяются выбором в другом блоке.

```
┌──────────────────────────────────────────────────────────────┐
│  КАНВАС                                                      │
│                                                              │
│  ┌────────────────────┐   ┌────────────────────┐            │
│  │ Клиенты (master)   │   │ Сеансы (linked→A)  │            │
│  │ [Table] [Board]    │   │ [Table] [Calendar] │            │
│  │ ────────────────   │   │ ────────────────── │            │
│  │ ● Иван Петров   ───────→  Сеанс 2026-06-01  │            │
│  │   Мария Иванова    │   │  Сеанс 2026-05-14  │            │
│  └────────────────────┘   └────────────────────┘            │
│                                                              │
│  ┌────────────────────┐   ┌────────────────────┐            │
│  │ Stats (linked→A)   │   │ Chart (linked→A)   │            │
│  │ 15 сеансов         │   │ ▁▃▅▇▅▃▁ боль       │            │
│  │ Ø 45 мин           │   │ ──────── динамика  │            │
│  └────────────────────┘   └────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

**Ключевые свойства:**
- **Независимые настройки**: каждый блок имеет свои вкладки, столбцы, сортировку
- **Независимый источник**: блок "Сеансы" смотрит в папку `Sessions/`, блок "Stats" — туда же, но с другим pipeline агрегаций
- **Реактивность через selectionBus**: выбор записи в мастере → мгновенное обновление всех linked-блоков
- **N linked-блоков к одному мастеру**: без ограничений
- **Цепочки**: блок B может быть мастером для блока C (трёхуровневая Матрёшка на одном канвасе)

### 5.3 Как настраивается связь

В UI — через контекстное меню блока "Link to..." → выбор блока-мастера → выбор поля связи.

```typescript
// Сохраняется в DatabaseCallConfig.linkedSelection:
{
  sourceWidgetId: "block-clients",
  relationField: "client"   // поле в папке Sessions/, тип Relation → Clients/
}
```

Когда `linkedSelection` задан — блок добавляет к своему pipeline дополнительный `FilterDefinition`, автоматически создаваемый из текущего выбора в мастере.

### 5.4 Настройка вкладок

Каждая вкладка хранит свой `config` — sort/filter/group/columns. Переключение вкладок не сбрасывает состояние соседних.

**Создание в UI**: "Add Block" → выбор источника → автоматически создаётся вкладка Table. Связь настраивается отдельно через контекстное меню уже созданного блока.

---

## 6. Canvas Selection Bus — реактивность между блоками

Это самостоятельная подсистема, обеспечивающая принцип 2.3.

### 6.1 Структура

```
DashboardCanvas.svelte
  │  createCanvasSelectionBus() → передаётся через setContext
  │
  ├── WidgetHost (block-clients, master)
  │     └── DatabaseCallWidget
  │           └── при клике на запись:
  │                 selectionBus.select('block-clients', 'ivan-petrov-id')
  │
  ├── WidgetHost (block-sessions, linked → block-clients)
  │     └── DatabaseCallWidget
  │           ├── реактивно читает: selectionBus.getSelection('block-clients')
  │           ├── строит auto-filter: { field:'client', op:'is', value:'ivan-petrov-id' }
  │           └── pipeline: filterEvaluator(frame, [userFilter, autoFilter])
  │
  └── WidgetHost (block-stats, linked → block-clients)
        └── StatsWidget
              └── реактивно читает тот же selectionBus
```

### 6.2 Правила

- **Selection store живёт на канвасе**, не в global singleton. Каждый Dashboard-инстанс изолирован.
- **Нет выбора = показывать все данные** (autoFilter не применяется, если мастер ничего не выбрал).
- **Снятие выбора**: клик по уже выбранной записи или по пустой области мастера → deselect → linked-блоки возвращаются к своему полному dataset.
- **Multi-select**: linked-блок применяет фильтр `is any of [ids]` когда в мастере выбрано несколько записей.
- **Circular links запрещены**: A→B→A валидируется при настройке, запись не сохраняется.

### 6.3 Двунаправленность записи

Реактивность **чтения** — через selectionBus. Реактивность **записи** — через Obsidian metadata cache:

```
Пользователь редактирует ячейку в блоке B (Сеансы)
    │
    ▼
viewApi.updateRecord(recordId, { pain_level: 3 })
    │
    ▼  (пишет в markdown frontmatter)
Obsidian metadata cache invalidate
    │
    ▼  (через externalFrameInvalidation store)
Все блоки на канвасе, читающие из той же папки Sessions/ — перезагружают DataFrame
    │
    ▼
Stats-блок показывает новое среднее боли. Chart-блок обновляет график. Немедленно.
```

Это и есть "двусторонние реактивные связи" из пользовательского требования.

---

## 7. Unified Filter System

### 7.1 Проблема V1

В V1 фильтры реализованы как **несколько независимых систем** с разным дизайном и поведением:
- Фильтр в настройках проекта (project-level)
- `FilterBridge.svelte` — Dashboard-специфичный
- `FilterTabs` виджет
- Calendar: свой `filterEngine.ts` (параллельная реализация — нарушение инварианта!)
- Агенда: свой фильтр

**Итог**: пользователь видит разные интерфейсы для одного действия. UX разорван.

### 7.2 Решение V2

**Один `FilterPanel.svelte`**, который используется на всех уровнях:

```
Уровень          Точка входа                    Scope
─────────────────────────────────────────────────────────────────
Project          Project settings → Filters      Весь проект
View             View toolbar → Filter icon      Это представление
Widget           Widget config → Filter tab      Данные виджета
Agenda           Agenda header → Filter          Агенда
```

`FilterPanel` принимает:
```typescript
interface FilterPanelProps {
  value: FilterDefinition;
  fields: DataField[];           // доступные поля для фильтрации
  onChange: (f: FilterDefinition) => void;
  // Опционально — для отображения метки уровня в UI
  scopeLabel?: string;
}
```

Scope определяется контекстом вызова, а не отдельным компонентом.

### 7.3 Engine — filterEvaluator.ts (не трогать)

`src/lib/engine/filterEvaluator.ts` — канонический engine. **Единственный**. Уже существует и работает. Любое использование фильтрации должно проходить через него.

Calendar's `filterEngine.ts` — удалить, заменить вызовом `filterEvaluator`.

### 7.4 Фильтры как базы (native-query)

Сохранённый фильтр → `native-query` datasource → живая коллекция с собственным Dashboard.

```
FilterDefinition → nativeQuery.ts → DataSource → DataFrame
                                     ↑
                              already implemented in #045.2
```

UI-точка входа в `CreateProject.svelte` — задача #048 (P1).

---

## 8. Layout-система (Grid только)

**FreeCanvas удалён.** Единственный layout — Grid.

### 7.1 Grid (12-колоночная сетка)

```typescript
interface GridLayout {
  x: number;   // 0-11 (column index)
  y: number;   // row index
  w: number;   // column span (1-12)
  h: number;   // row span
}
```

Высота ряда: `4rem` (= стандартный unit). Drag-resize через `svelte-dnd-action`.

### 7.2 Минимальные размеры виджетов

| Тип виджета | minW | minH |
|---|---|---|
| `database-call` | 4 | 4 |
| `chart` | 3 | 3 |
| `stats` | 2 | 1 |
| `checklist` | 3 | 3 |
| `filter-tabs` | 4 | 1 |
| `text` | 2 | 1 |
| `divider` | 2 | 1 |
| `cover-banner` | 6 | 2 |

---

## 9. Canvas — дизайн компонента (≤ 200 LOC)

```svelte
<!-- DashboardCanvas.svelte — ТОЛЬКО layout + routing -->
<script lang="ts">
  // Props: config, api, project
  // Derived: widgets, layout, canvasFilter (от FilterTabs виджета)
  //
  // ЗАПРЕЩЕНО:
  //   ❌ import из dashboard-engine/
  //   ❌ applyFormulaFields / applyAutoFields
  //   ❌ прямые fetch данных
  //   ❌ бизнес-логика трансформаций
  //   ❌ FreeCanvas / WindowShell
  //
  // ДЕЛЕГИРУЕТ:
  //   Toolbar  → DashboardToolbar.svelte
  //   Layout   → WidgetGrid.svelte
  //   Widget   → WidgetHost.svelte → [конкретный виджет]
  //   Save     → один метод saveConfig(patch)
  //   Schema   → dashboardCommands.ts
</script>

<ViewLayout>
  <DashboardToolbar ... />
  <WidgetGrid widgets={$widgets} on:change={saveLayout} />
</ViewLayout>
```

---

## 10. Engine → lib (план переноса)

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

## 11. Технические требования V2

### Инварианты Dashboard (добавляются к глобальным из AGENTS.md)

1. `DashboardCanvas.svelte` — **≤ 200 LOC** (проверять перед каждым PR).
2. Каждый widget-компонент — **≤ 300 LOC** (исключение: DatabaseCallWidget ≤ 400).
3. `dashboard-engine/` — **нет импортов из `obsidian`** (Engine остаётся чистым).
4. `FilterPanel.svelte` — **единственный** компонент для фильтрации на всех уровнях.
5. `filterEvaluator.ts` — **единственный** engine для фильтрации. Calendar's `filterEngine.ts` — удалить.
6. **Нет `FreeCanvas`** в коде Dashboard V2.
7. `canvasSelectionStore` — **singleton на уровне канваса**, не глобальный. Каждый Dashboard-инстанс изолирован.
8. **Нет circular links** между блоками (A→B→A) — валидировать при настройке.
9. Каждый новый виджет-тип — **тест в widgetRegistry.test.ts**.
10. Каждый новый публичный метод в `dashboard-engine/` — **unit-тест**.

### Gates перед каждым PR (стандартные 4-gate)

```bash
npm run build          # 0 ошибок
npm test               # baseline ≥ 139 suites / 2099 tests
npm run lint           # 0 ошибок
npm run svelte-check   # 0 ошибок
```

### Первый шаг — восстановить CI (Фаза 0)

Прежде чем писать V2-код, необходимо:
1. Исправить 55 ESLint ошибок (issue #049)
2. Исправить 72 svelte-check ошибки (issue #049)
3. Подтвердить зелёный baseline на `feat/dashboard-v2`

---

## 12. План разработки по фазам

### Фаза 0 — Чистый старт (зелёный CI)
- [ ] Исправить все ESLint ошибки (55 штук, issue #049)
- [ ] Исправить все svelte-check ошибки (72 штуки, issue #049)
- [ ] `npm run lint` → 0 ошибок ✅
- [ ] `npm run svelte-check` → 0 ошибок ✅
- [ ] Базовый коммит на `feat/dashboard-v2` — только исправления, нет нового кода

### Фаза 1 — Перенос Engine в lib
- [ ] Создать `src/lib/dashboard-engine/`
- [ ] Перенести все engine-файлы (только изменение путей импортов)
- [ ] Перенести тесты engine в `src/lib/dashboard-engine/__tests__/`
- [ ] Обновить все импорты в `src/ui/views/Dashboard/`
- [ ] Удалить Calendar's `filterEngine.ts` → заменить на `filterEvaluator.ts`
- [ ] `npm test` baseline держится ✅

### Фаза 2 — Unified Filter System
- [ ] Создать `FilterPanel.svelte` — единый компонент для всех уровней
- [ ] Создать `FilterRow.svelte` — одна строка условия
- [ ] Заменить `FilterBridge.svelte` → `FilterPanel`
- [ ] Заменить project-level filter UI → `FilterPanel`
- [ ] Заменить view-level filter UI → `FilterPanel`
- [ ] Все 4 гейта ✅

### Фаза 3 — Новый DashboardCanvas (≤ 200 LOC)
- [ ] Убрать из `DashboardCanvas.svelte` все engine-вызовы
- [ ] `WidgetGrid.svelte` — единственный layout-хозяин
- [ ] `WidgetShell.svelte` — общая обёртка (header, resize, context menu)
- [ ] `WidgetHost.svelte` — routing по типу, без бизнес-логики
- [ ] Удалить весь `FreeCanvas/` код из V2
- [ ] `DashboardCanvas.svelte` ≤ 200 LOC ✅

### Фаза 4 — DatabaseCallWidget + Матрёшка + Canvas Selection Bus
- [ ] `DatabaseCallWidget.svelte` — источник + табы + pipeline
- [ ] `ViewTabBar.svelte` — переключение вкладок, добавление новых
- [ ] `canvasSelectionStore.ts` — Selection Bus на уровне канваса
- [ ] Реактивная подписка linked-блоков на выбор мастера
- [ ] Auto-filter по `linkedSelection.relationField` при наличии выбора
- [ ] Multi-select в мастере → `is any of [ids]` фильтр в linked-блоках
- [ ] Настройка связей через контекстное меню блока "Link to..."
- [ ] Двунаправленная реактивность записи через `externalFrameInvalidation`
- [ ] Вкладка Table — DataTable как view внутри блока
- [ ] Вкладка Board — Kanban как view внутри блока
- [ ] Вкладка Calendar — Calendar engine адаптация
- [ ] Вкладка Gallery — Gallery view адаптация
- [ ] Все 4 гейта ✅

### Фаза 5 — Utility-виджеты
- [ ] `ChartWidget` — bar/line/pie
- [ ] `StatsWidget` — count/sum/avg/динамика
- [ ] `FilterTabsWidget` — canvas-level фильтр (пишет в store → читают data-блоки)
- [ ] `ChecklistWidget`
- [ ] `TextWidget`, `DividerWidget`

### Фаза 6 — Завершение
- [ ] `CoverBanner` виджет
- [ ] i18n — все строки через i18n ключи
- [ ] #048 — UI точка входа native-query в `CreateProject.svelte`
- [ ] Demo project обновлён под V2
- [ ] Обновить `DASHBOARD_V2_SPEC.md` — финальный статус всех фаз

---

## 13. Решения (согласовано 2026-06-09)

| # | Вопрос | Решение |
|---|---|---|
| 1 | **Удаление виджетов** | ✅ Подтверждено. `comparison`, `summary-row`, `yaml-visualizer`, `timeline`, `FreeCanvas` удаляются из V2. Код остаётся в `archive/dashboard-v1`. |
| 2 | **Sub-base / Матрёшка** | ✅ **Ключевой принцип V2.** Матрёшка — единственный правильный способ строить UX. Реализовать через `SubBasePanel` в `database-call`. |
| 3 | **Миграция V1 → V2** | ✅ Не нужна. Финального релиза не было, пересобираем с нуля. |
| 4 | **FreeCanvas** | ✅ **Полностью под снос.** Единственный layout — Grid. |
| 5 | **Система фильтров** | ✅ Унификация. Один `FilterPanel.svelte` для всех уровней. Уровень определяется точкой входа автоматически. Один engine — `filterEvaluator.ts`. |

---

## 14. Что НЕ меняем в V2

- `src/lib/dataframe/` — DataFieldType, DataFrame, DataRecord остаются неизменными
- `src/lib/engine/filterEvaluator.ts` — канонический filter engine (single source of truth)
- `src/lib/formula/` — formula stack V5 (AST + evaluators)
- `src/lib/relations/` — bidirectional relations engine
- Все View-типы вне Dashboard (Board, Calendar, Gallery, VisualizerPane) — не трогаем
- `styles.css` дизайн-токены — только через `--ppp-*` переменные

---

*Документ последний раз обновлён: 2026-06-09 (rev.2 — все 5 вопросов согласованы)*
