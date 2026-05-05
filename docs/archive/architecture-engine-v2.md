# Architecture: Internal Data Engine v2
# Архитектура: Внутренний движок данных v2

> **Статус**: ACTIVE — замещает разрозненные ссылки на Dataview в предыдущих спецификациях
> **Дата**: 2026-04-30
> **Версия плагина**: 3.4.X WIP
> **Контекст**: Стратегический пересмотр после выявления критических ограничений Dataview-зависимости

---

## 1. Проблема — критическое упущение

При разработке Database View были допущены фундаментальные архитектурные упущения:

1. **Зависимость от Dataview неправильно оценена.** Dataview использовался как ориентир и опциональный источник данных, но для полноценной работы Relations и Rollups он **не нужен** — нативный YAML-парсер плагина (FrontMatterDataSource) читает всё необходимое самостоятельно.

2. **RelationResolver существует, но ограничен.** `engine/relationResolver.ts` умеет разрешать wiki-links только внутри **одного DataFrame** (одного проекта). Для Notion-подобных связей между базами нужен кросс-проектный резолвер.

3. **FieldConfig не расширен под Relations/Rollups.** `DataFieldType.Relation` и `DataFieldType.Rollup` объявлены в `dataframe.ts`, но `FieldConfig` в settings не содержит конфигурации для этих типов — нет `targetProjectId`, нет `rollupConfig`.

4. **Custom Properties Viewer отсутствует.** Obsidian нативно показывает YAML-поля как plain-text. Для полноценной работы с типизированными полями, связями и rollup-значениями необходим собственный просмотрщик свойств.

5. **Formula Editor не унифицирован.** FormulaBar встроен только в DatabaseViewCanvas. Схема (PDF, 2026-04-30) требует универсального popup-редактора формул, применимого во всех контекстах.

---

## 2. Граница Dataview-зависимости — точная карта

### Что работает БЕЗ Dataview (folder/tag datasource)

| YAML тип | Пример | Статус |
|---|---|---|
| Строка | `title: "Счет 1"` | ✅ Читается нативно |
| Число | `balance: 50000` | ✅ Читается нативно |
| Дата | `date: 2026-01-15` | ✅ Читается нативно |
| Булев | `active: true` | ✅ Читается нативно |
| Массив строк | `tags: [work, finance]` | ✅ Читается нативно |
| Вложенный объект | `sets: [{reps: 10, weight: 80}]` | ✅ Читается нативно (UNNEST-шаг разворачивает) |
| Wiki-link как строка | `account: "[[Счет 1]]"` | ✅ Читается как строка |
| Wiki-link как живая связь | `account: [[Счет 1]]` (resolved) | ⚠️ Нужен RelationResolver |

### Что требует Dataview (или нашего кода)

| Функциональность | Dataview | Наш код |
|---|---|---|
| `[[wikilinks]]` как живые связи внутри одного проекта | ✅ Может | ✅ `relationResolver.ts` |
| `[[wikilinks]]` как живые связи между проектами | ✅ Может | ❌ **GAP: нужен CrossProjectRelationResolver** |
| Rollups по wiki-links внутри проекта | ✅ Может | ✅ `rollup.ts` |
| Rollups по wiki-links между проектами | ✅ Может | ❌ **GAP: нужен CrossProjectRollup** |
| Метаданные файла (`file.ctime`, `file.size`) | ✅ Только через Dataview | ❌ Планируем через MetadataCache |
| Inline-поля в теле (`field:: value`) | ✅ Только Dataview | ❌ Вне scope |
| Dataview-запросы (`TABLE ... FROM ...`) | ✅ Только Dataview | ❌ Off-scope (опциональный datasource) |

**Вывод**: Folder/Tag datasources уже не зависят от Dataview. Единственное, чего не хватает для полноценных баз — это **кросс-проектные связи и rollups** которые нужно реализовать в нашем движке.

---

## 3. Текущее состояние движка — честный аудит

### ✅ Реализовано

```
src/lib/datasources/
  frontmatter/datasource.ts  — YAML-ридер (folder/tag, без Dataview)
  folder/datasource.ts       — FolderDataSource
  tag/datasource.ts          — TagDataSource
  dataview/datasource.ts     — DataviewDataSource (опциональный)

src/lib/externalFrameResolver.ts
  — Загружает DataFrame из другого проекта по projectId
  — Работает с folder/tag/dataview datasources
  — Throttled warnings, graceful degradation

src/ui/views/Database/engine/
  relationResolver.ts        — Wiki-link парсинг + резолв внутри одного DataFrame
  rollup.ts                  — Аггрегация по resolved relations (внутри DataFrame)
  transformExecutor.ts       — JoinStep: hash-join двух DataFrames
  joinKey.ts                 — Нормализация ключей (Date/string/ISO)
  formulaEngine.ts           — 102 функции формул, AST evaluator
  formulaMetadata.ts         — Реестр функций с документацией
```

### ❌ Не реализовано (критические пробелы)

```
1. CrossProjectRelationResolver
   — resolveRelationsAcrossProjects(record, fieldName, externalFrame)
   — Нужен для: [[Счет 1]] в журнале → запись в базе счетов

2. CrossProjectRollup
   — computeCrossProjectRollup(record, config, externalFrame)
   — Нужен для: Текущий баланс в счете = SUM транзакций журнала

3. Расширение FieldConfig в settings
   — RelationFieldConfig { targetProjectId: string }
   — RollupFieldConfig { relationField: string, targetField: string, function: RollupFunction }

4. RELATION/ROLLUP field types в DataFieldType (объявлены, не используются в settings)
   — DataFieldType.Relation = "relation" — DECLARED
   — DataFieldType.Rollup = "rollup" — DECLARED
   — Но FieldConfig = StringFieldConfig & DateFieldConfig — нет rel/rollup config

5. Custom Properties Viewer (PropertiesPanel)
   — Альтернатива нативному Obsidian Properties
   — Typed fields с relation/rollup UI
   — Отдельный leaf/sidebar

6. Formula Editor Popup (унифицированный)
   — Popup вместо embedded FormulaBar
   — Preview результата, категории функций, примеры
   — Применим во всех контекстах (не только DatabaseViewCanvas)
```

---

## 4. Целевая архитектура v2

### 4.1 Диаграмма потока данных (расширенная)

```
Obsidian Vault + MetadataCache
        │
        ▼
FrontMatterDataSource                    ← Folder/Tag: Dataview НЕ нужен
        │ queryAll() → DataFrame A (Base 1: Accounts)
        │ queryAll() → DataFrame B (Base 2: Journal)
        │
        ▼
CrossProjectRelationResolver             ← NEW: Engine v2
        │ resolveAcross(record_B, "Счет", frameA) → DataRecord in A
        │
        ▼
CrossProjectRollupEngine                 ← NEW: Engine v2
        │ computeRollup(record_A, {
        │   relationField: "Journal",    ← backlink from B to A
        │   targetField: "amount",
        │   function: "sum"
        │ }, frameB) → RollupResult
        │
        ▼
DataFrame (enriched with virtual fields)
  - record.values["Текущий баланс"] = RollupResult.value (derived, readonly)
        │
        ▼
executeTransform(pipeline)
        │
        ▼
Widget render (DataTable, Chart, Stats, ...)
```

### 4.2 Кросс-проектные связи — механика

**Принцип**: запись в Base 2 (журнал) хранит `Счет: "[[Счет 1]]"` в YAML frontmatter. Это обычная строка. `CrossProjectRelationResolver` парсит её как wiki-link и разрешает в запись из Base 1 (счета).

```typescript
// Расширение FieldConfig (additive, backward-compat).
// Используется namespaced sub-config внутри FieldConfig — НЕ discriminated union.
// Это позволяет существующим строковым/датным конфигам сосуществовать.

export type RelationFieldConfig = {
  /** ID проекта, на записи которого ссылается это поле */
  readonly targetProjectId: string;
  /** Поле в целевом проекте для отображения записей (basename if absent) */
  readonly displayField?: string;
};

export type RollupFieldConfig = {
  /** Поле в ТЕКУЩЕМ датафрейме, содержащее wiki-links на другой проект */
  readonly relationField: string;
  /** ID целевого проекта (для backlinks: тот же что в RelationFieldConfig) */
  readonly targetProjectId?: string;
  /** Поле в ЦЕЛЕВОМ датафрейме, значения которого аггрегируются */
  readonly targetField: string;
  /** Функция аггрегации */
  readonly function: RollupFunction;
  readonly separator?: string;
};

// FieldConfig расширяется namespace-полями (см. Appendix M0.1 в IMPLEMENTATION_PLAN):
// FieldConfig = StringFieldConfig & DateFieldConfig & {
//   relation?: RelationFieldConfig;
//   rollup?: RollupFieldConfig;
// };
```

### 4.3 Backlinks как основа rollups

Для Rollup (Base 1 видит аггрегат из Base 2) нужна ОБРАТНАЯ связь. Два подхода:

**Подход A — Явные backlinks** (рекомендуется): пользователь явно объявляет Rollup-поле в Base 1, указывая "смотреть в Base 2, поле Счет, аггрегировать amount". `CrossProjectRollupEngine` строит обратный индекс один раз.

**Подход B — Автоматические backlinks**: движок автоматически сканирует все DataFrame на наличие ссылок обратно. Expensive, нужен кеш.

→ Выбираем **Подход A** (YAGNI, explicit > implicit).

Для backlink-rollup (Base 1 видит SUM из Base 2) `RollupFieldConfig.targetProjectId` указывает на Base 2 явно, а `relationField` — это поле в Base 2, которое содержит wiki-link на Base 1. Engine выполняет обратный поиск: «найти все записи Base 2, где `relationField` ссылается на текущую запись Base 1».

```typescript
// Base 1 (Accounts) — FieldConfig:
"Текущий баланс": {
  rollup: {
    targetProjectId: "base2-journal-id",   // куда смотрим
    relationField: "Счет",                  // поле в Base 2, ссылающееся на Base 1
    targetField: "amount",                  // что аггрегируем
    function: "sum"
  }
}
```

Никакого специального backlink-синтаксиса не нужно — backlink выводится из конфигурации (`targetProjectId` указывает на источник записей, `relationField` — обратная ссылка).

### 4.4 Custom Properties Viewer — спецификация

**Назначение**: заменить нативный Obsidian Properties panel собственной реализацией с поддержкой типизированных полей, связей и rollup-значений.

**Архитектура**:
```
src/ui/views/PropertiesPanel/
  PropertiesPanelView.ts           ← Obsidian ItemView (leaf)
  PropertiesPanel.svelte           ← главный компонент
  fields/
    StringField.svelte             ← текст, email, URL, телефон
    NumberField.svelte             ← числа с форматированием
    DateField.svelte               ← даты с pickers
    BooleanField.svelte            ← checkbox
    SelectField.svelte             ← dropdown + status
    RelationField.svelte           ← wiki-link dropdown с поиском по целевому проекту
    RollupField.svelte             ← computed, readonly, показывает значение + источник
    FormulaField.svelte            ← computed, readonly + открывает Formula Editor
    FileField.svelte               ← прикреплённые файлы
    ListField.svelte               ← массивы тегов/текста
```

**Ключевые требования**:
- Синхронизация с `MetadataCache.on("changed")` — обновление в реальном времени
- Write through `fileManager.processFrontMatter` — атомарные записи
- RelationField: dropdown из записей целевого проекта (lazy-load)
- RollupField: computed + badge "Вычислено из N записей"
- FormulaField: inline preview + кнопка открытия Formula Editor

### 4.5 Formula Editor Popup — спецификация

**Назначение**: унифицированный редактор формул доступный из любого контекста (не только DatabaseViewCanvas).

**Из PDF-схемы** (2026-04-30):
```
Редактор формул
├── Заголовок
├── Поле ввода формулы            ← Monaco-like textarea с syntax highlight
├── Предпросмотр результата       ← живое вычисление на текущих данных
├── Внутренняя база потоков       ← список доступных свойств (fields) как completion
├── Формулы по категориям         ← accordeon по категориям (logic/math/string/date...)
│   ├── Каждый элемент: подсказка + пример
│   └── Кнопка "Скопировать пример"
└── [Иконки быстрых действий]
```

**Архитектура**:
```
src/ui/modals/FormulaEditorModal.ts    ← Obsidian Modal wrapper
src/ui/views/Database/widgets/FormulaEditorPopup.svelte
  ├── uses: formulaEngine.ts (execute)
  ├── uses: formulaMetadata.ts (categories, docs)
  └── dispatches: change (newExpression)
```

**Интеграция** (глобальный аудит взаимодействий — по директиве из схемы):
- `FormulaBar.svelte` → открывает popup вместо inline editor
- `PropertiesPanel/FormulaField.svelte` → открывает popup
- `DataTable` computed columns → открывает popup
- `StatsCard` formula KPI → открывает popup

---

## 5. Граница реализации — версии 3.4.X

Вся работа ведётся в рамках `3.4.X`. Ниже матрица приоритетов:

### Приоритет 1 — Фундамент (разблокирует всё остальное)

| Задача | Файлы | Статус |
|---|---|---|
| Расширить `FieldConfig` под Relations/Rollups | `src/settings/base/settings.ts` | ❌ TODO |
| `RelationFieldConfig`, `RollupFieldConfig` типы | `src/settings/base/settings.ts` | ❌ TODO |
| `CrossProjectRelationResolver` | `src/lib/engine/crossProjectResolver.ts` (NEW) | ❌ TODO |
| `CrossProjectRollupEngine` | `src/lib/engine/crossProjectRollup.ts` (NEW) | ❌ TODO |
| Enrich DataFrame с виртуальными Rollup-полями | `src/lib/datasources/frontmatter/datasource.ts` | ❌ TODO |

### Приоритет 2 — Field Types UI

| Задача | Файлы | Статус |
|---|---|---|
| UI для настройки Relation field | `src/ui/views/Database/widgets/DataTable/*` | ❌ TODO |
| UI для настройки Rollup field | `src/ui/views/Database/widgets/DataTable/*` | ❌ TODO |
| Отображение Relation field в DataTable | `DataGrid / StrictGrid` | ❌ TODO |
| Отображение Rollup field (computed, readonly) | `DataGrid / StrictGrid` | ❌ TODO |

### Приоритет 3 — Custom Properties Viewer

| Задача | Файлы | Статус |
|---|---|---|
| `PropertiesPanelView.ts` (Obsidian leaf) | `src/ui/views/PropertiesPanel/` | ❌ TODO |
| `PropertiesPanel.svelte` | `src/ui/views/PropertiesPanel/` | ❌ TODO |
| Typed field components | `src/ui/views/PropertiesPanel/fields/` | ❌ TODO |
| RelationField с dropdown | `src/ui/views/PropertiesPanel/fields/RelationField.svelte` | ❌ TODO |
| Регистрация листа в `main.ts` | `src/main.ts` | ❌ TODO |

### Приоритет 4 — Formula Editor Popup

| Задача | Файлы | Статус |
|---|---|---|
| `FormulaEditorModal.ts` | `src/ui/modals/` | ❌ TODO |
| `FormulaEditorPopup.svelte` | `src/ui/views/Database/widgets/` | ❌ TODO |
| Интеграция во все точки входа | `FormulaBar`, `PropertiesPanel`, etc. | ❌ TODO |

---

## 6. Ограничения — что НЕ реализуем (YAGNI)

- Inline-поля `fieldname:: value` (только Dataview — off-scope)
- Real-time collaborative sync
- AI-генерация формул
- Server-side relations (cloud storage)
- Многоуровневые rollups (rollup из rollup) — в первой итерации
- Автоматические backlinks (только явные в FieldConfig)

---

## 7. Связанные документы

- `docs/ROADMAP_DATABASE_2026.md` — обновлённый roadmap с учётом v2
- `docs/IMPLEMENTATION_PLAN_CURRENT.md` — план реализации с новыми findings
- `docs/architecture-database-view.md` — базовый архитектурный документ
- `src/ui/views/Database/engine/relationResolver.ts` — текущий RelationResolver
- `src/ui/views/Database/engine/rollup.ts` — текущий RollupEngine
- `src/lib/externalFrameResolver.ts` — кросс-проектная загрузка фреймов
