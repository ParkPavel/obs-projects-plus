# Устройство кода / Code structure

Документ описывает код, который лежит в этом дереве сейчас: слои, правила зависимостей,
точки расширения и инварианты, которые проверяются тестами. Это не план и не спецификация
будущего — если код и документ расходятся, прав код, а документ нужно поправить.

This document describes the code as it stands in this tree: layers, dependency rules,
extension points and the invariants that tests enforce. It is not a roadmap. If the code and
this document disagree, the code wins and this file needs an update.

---

## 1. Слои / Layers

Зависимости направлены внутрь: внешний слой знает о внутреннем, внутренний о внешнем — нет.

| Слой | Где лежит | За что отвечает |
|---|---|---|
| **Shell** | `src/main.ts`, `src/view.ts`, `src/customViewApi.ts`, `src/managers/`, `src/events.ts` | Жизненный цикл плагина, команды Obsidian, регистрация представлений |
| **UI** | `src/ui/app/`, `src/ui/views/`, `src/ui/components/`, `src/ui/modals/`, `src/ui/settings/`, `src/ui/tokens/` | Svelte-компоненты, представления (Dashboard, Calendar, Board, Gallery, YamlVisualizer, VisualizerPane), настройки |
| **Engine** | `src/lib/engine/`, `src/lib/dashboard-engine/`, `src/lib/formula/`, `src/lib/database/`, `src/lib/relations/`, `src/lib/visualizer/` | Чистая логика: фильтры, агрегация, формулы, связи и rollup. Без DOM и без Obsidian API |
| **Data** | `src/lib/dataframe/`, `src/lib/dataApi.ts`, `src/lib/datasources/`, `src/lib/filesystem/`, `src/lib/frontmatter/`, `src/lib/metadata/`, `src/lib/settings/`, `src/settings/` | Чтение и запись заметок, источники данных, схема полей, настройки |

### Правила зависимостей / Dependency rules

- **Engine и Data не трогают DOM** и не импортируют `obsidian`. Исключение — адаптеры
  в `src/lib/filesystem/obsidian/`, которые для этого и существуют.
- **Data не импортирует Engine и UI.**
- **Engine не импортирует UI-компоненты.** Фактическое исключение:
  `src/lib/dashboard-engine/` берёт из `src/ui/views/Dashboard/types` описания типов конфигурации
  виджетов, а `conditionalFormat.ts` — предикат `matchesCondition` из `src/ui/app/filterFunctions`.
  Это остаток переезда движка Dashboard из `src/ui/` в `src/lib/`; новые такие импорты не добавляем.
- Любая функция Engine должна быть проверяемой в Jest без jsdom.

---

## 2. Как данные попадают на экран / From note to view

1. Проект описан папкой, тегом или Dataview-запросом (`src/lib/datasources/`).
2. Источник отдаёт `DataFrame` — список полей и записей (`src/lib/dataframe/dataframe.ts`).
3. Представление применяет фильтр, сортировку и — для Dashboard — конвейер преобразований
   (`src/lib/dashboard-engine/transformExecutor.ts`).
4. Правка в интерфейсе идёт обратно в frontmatter через `src/lib/dataApi.ts`
   и `fileManager.processFrontMatter()`, а не через перезапись файла целиком.
5. Изменение файла в хранилище поднимает пересчёт: Dashboard и другие виды обновляются
   по подписке на источник.

Порядок фильтрации Dashboard: фильтр блока сужает записи **до** конвейера преобразований.
Инвариант закреплён тестом `src/__tests__/R_filterOrder.invariant.test.ts`.

---

## 3. Где что добавлять / Where to add things

| Что нужно | Куда смотреть |
|---|---|
| Новый виджет Dashboard | `src/ui/views/Dashboard/widgets/` + запись в `widgets/widgetRegistry.ts`, компонент подключается в `WidgetHost.svelte` |
| Новый тип графика | `src/ui/views/Dashboard/widgets/Chart/` + `src/lib/dashboard-engine/chartDataPipeline.ts` |
| Новый источник данных | наследник `DataSource` в `src/lib/datasources/` (см. `index.ts`) |
| Новая функция формул | `src/lib/helpers/formulaParser.ts` + описание в `src/lib/dashboard-engine/formulaMetadata.ts`; импорт только через фасад `src/lib/formula` |
| Новый оператор фильтра | `src/lib/engine/filterEvaluator.ts` и подписи операторов в переводах |
| Новая операция агрегации | `src/lib/engine/aggregate.ts` (ядро) и `src/lib/dashboard-engine/aggregation.ts` (итоговые строки) |
| Новый язык интерфейса | `src/lib/stores/translations/` (`en.json` — источник, затем `ru.json`, `uk.json`, `zh-CN.json`) |
| Новый код ошибки | реестр `src/lib/errors/` и таблица в [ERROR_CODES.md](ERROR_CODES.md) |
| Своё представление из другого плагина | публичный контракт `src/customViewApi.ts`, описан в [api.md](api.md) / [api-ru.md](api-ru.md) |

---

## 4. Ключевые контракты / Key contracts

Источник правды — код; здесь только карта, чтобы знать, какой файл открыть.

| Контракт | Файл | Смысл |
|---|---|---|
| `DataFrame` | `src/lib/dataframe/dataframe.ts` | `{ fields, records }` — единая форма данных между слоями. Любой движок принимает и возвращает её |
| Фильтр | `src/lib/engine/filterEvaluator.ts` | `matchesCondition`, `matchesFilterConditions`, `applyFilter`. Единственный движок фильтрации, включая agenda календаря |
| Формулы | `src/lib/formula/index.ts` | Канонический путь импорта: разбор, проверка и вычисление формул, включая формулы дат |
| Агрегация | `src/lib/engine/aggregate.ts` | Ядро операций; `count` во всех слоях считает непустые значения |
| Связи и rollup | `src/lib/engine/crossProjectResolver.ts`, `crossProjectRollup.ts`, `src/lib/dashboard-engine/relationResolver.ts` | Разбор wikilink-ссылки, статусы (найдена / не найдена / неоднозначна), расчёт по связанным записям |
| Представление-плагин | `src/customViewApi.ts` | `ProjectView`: `getViewType`, `getDisplayName`, `getIcon`, `onOpen`, `onData`, `onClose` |
| Настройки | `src/lib/settings/` | Версии схемы и миграции; запись настроек идёт одним владельцем (`R0_24_oneSettingsWriter`) |

---

## 5. Инварианты / Invariants

Каждый пункт закреплён тестом в `src/__tests__/` (имена файлов `R0_*`) или правилом ESLint;
нарушение валит сборку, а не остаётся на усмотрение ревью.

1. **Никакого DOM в Engine и Data.**
2. **Никакого `innerHTML`** — только `createEl()`, `createSpan()`, `setIcon()`, `el.empty()`.
3. **Никаких обращений к `document`** — `activeDocument`, иначе плагин ломается в отдельном окне.
4. **Frontmatter пишется через `fileManager.processFrontMatter()`**, не через `vault.modify()`.
5. **`JSON.parse` пользовательских данных — только в try/catch** с проверкой формы.
6. **Регулярные выражения из пользовательского ввода** проходят через `src/lib/helpers/regexSafety.ts`.
7. **Размеры в интерфейсе — в `rem` и токенах.** Пиксели разрешены только там, где координату
   даёт JavaScript (`getBoundingClientRect`). Бюджет `px` зафиксирован ratchet-тестом `R0_3_pxBudget`.
8. **`rem` считается от контейнера, а не от корня документа** (`R0_16_remInContainer`) — от этого
   зависит адаптивность вложенных блоков.
9. **Текст интерфейса живёт в переводах**, а не в коде (`R0_22_noHardcodedUiText`).
10. **`styles.css` — рукописный источник.** `esbuild.config.mjs` дописывает блок токенов между
    маркерами после сборки; сгенерированную часть не редактируем руками.
11. **Обещания не бросаем без обработки.** Любая запись сообщает об ошибке (`Notice`) и, если была
    оптимистичная правка интерфейса, откатывает её.
12. **Никаких полифилов Obsidian** (`String.contains`, `.first()`, `.last()`) — стандартные методы.

---

## 6. Сборка и проверки / Build and checks

```bash
npm ci
npm run dev            # пересборка на каждое сохранение
npm run build          # tsc -noEmit + production-бандл main.js и styles.css
npm test               # Jest
npm run lint           # ESLint + правила obsidianmd
npm run svelte-check   # типы в Svelte-шаблонах
```

Публикуемый плагин — ровно три файла: `main.js`, `manifest.json`, `styles.css`.
Все четыре проверки должны проходить без ошибок; CI запускает их на каждый pull request.

Правила оформления кода — [CODE_STANDARDS-RU.md](CODE_STANDARDS-RU.md) /
[CODE_STANDARDS.md](CODE_STANDARDS.md). Процесс изменений — [CONTRIBUTING](../CONTRIBUTING.md).
