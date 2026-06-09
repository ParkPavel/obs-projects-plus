# Dataview Adaptive Absorption Plan

> **Версия**: V5.0
> **Дата**: 2026-05-07
> **Статус**: DRAFT — входной материал для аналитической сессии 3.
> **Связанные документы**: [ARCHITECTURE_V5.md](../ARCHITECTURE_V5.md), [MASTER_MAP_V5.md](MASTER_MAP_V5.md), [NOTION_PARITY.md](NOTION_PARITY.md)

---

## 0. Контекст и проблема

### Текущее состояние

Плагин имеет три источника данных (`src/lib/datasources/`):
- `folder/` — читает все файлы из папки через Obsidian API
- `tag/` — фильтрует файлы по тегу
- `dataview/` — делегирует DQL-запрос движку Dataview

`DataviewDataSource` использует `plugin.app.plugins.getPlugin("dataview")` — жёсткая опциональная зависимость. Если Dataview не установлен → источник недоступен. При этом Dataview — тяжёлый плагин (~200k+ LOC, собственный кэш, реактивность), который загружается целиком ради использования его как query-backend.

### Архитектурная проблема

"Кирпичная механика" (brick mechanics) — термин для ситуации, когда механика скопирована напрямую из Notion без адаптации к природе Obsidian:
- Notion: каждая запись — облачный объект с UUID, типизированными property-values в PostgreSQL
- Obsidian: каждая запись — Markdown-файл с YAML frontmatter на диске
- Текущий плагин пытается имитировать Notion поверх Dataview, который сам поверх Obsidian → два слоя абстракции где нужен один

---

## 1. Принцип адаптивного поглощения

**Поглощение ≠ замена Dataview.**

Dataview остаётся как opt-in query-enhancer. Адаптивное поглощение означает:

1. **Dataview-инструменты = аналоги функций Notion** — использовать то, что Dataview уже делает, как реализацию соответствующих Notion-концепций
2. **Gaps → bridges** — там, где Dataview не покрывает Notion-поведение, строятся мосты поверх Dataview API
3. **Native-first** — для базовых use-cases (folder/tag sources) Dataview не нужен вообще
4. **Obsidian-native модель** — `файл = запись`, `папка = коллекция`, `frontmatter = схема` — не копируем Notion, адаптируем принципы

---

## 2. Матрица аналогов: Notion ↔ Dataview ↔ Bridge

| Notion функция | Dataview аналог | Нужен bridge? | Bridge-описание |
|----------------|-----------------|---------------|-----------------|
| Database schema (property types) | `dv.pages().file.frontmatter` — нетипизировано | **Да** | `fieldConfig` в settings → типизирует поля поверх DV |
| Filter (WHERE) | `dv.pages().where(p => ...)` | **Частично** | `filterEvaluator.ts` как canonical bridge — DV query + наш filter kernel |
| Sort | `dv.pages().sort(p => p.field)` | **Нет** | DV сортировка достаточна для базового случая |
| Group by | — (нет в DV) | **Да** | `groupRows.ts` в Dashboard engine — полностью нативный |
| Relations (`[[wikilink]]`) | `dv.pages().file.inlinks/outlinks` | **Да** | `inverseIndex.ts` + `crossProjectResolver.ts` — bidirectional |
| Rollup | — (нет в DV) | **Да** | `rollupMode.ts` + `crossProjectRollup.ts` — полностью нативный |
| Formula | — (нет в DV) | **Да** | `extendedEvaluator.ts` — полностью нативный |
| Status (3-tier groups) | — (DV не знает статус-семантику) | **Да** | `StatusFieldTypeConfig` в fieldConfig + Board grouping |
| Aggregation (count/sum/avg) | `dv.pages().length`, ручные reduce | **Да** | `aggregate.ts` — полностью нативный |
| Created/edited time | `dv.pages().file.ctime/.mtime` | **Нет** | `pp_created_time`/`pp_last_edited_time` из `TFile.stat` |
| Full-text search | — | **Да** | Не в scope V5 |
| Nested sub-bases | — | **Да** | `subBase.ts` + `SubBaseTabs.svelte` — полностью нативный |

---

## 3. Что работает хорошо (не ломать)

- **Folder datasource** — не использует Dataview, работает нативно через Obsidian API. Основной источник для большинства пользователей.
- **Tag datasource** — аналогично, нативный.
- **`TFile.stat`** — даёт ctime/mtime без Dataview (PARITY-008 реализован).
- **Wikilink parsing** — `wikilink.ts` нативный, не зависит от DV.
- **filterEvaluator.ts** — canonical filter kernel, не зависит от DV.

---

## 4. Gaps, требующие bridges (приоритет сессии 3)

### Gap 1 — Relation UI (критический)
- **Текущее**: relation-поле хранит `[[wikilink]]` в frontmatter; движок разрешает ссылку. Но в таблице отображается как сырой текст.
- **Notion**: pill-chip список с цветом, overflow `+K more`, hover preview.
- **Bridge**: `GridRelationCell.svelte` уже переписан как `RelationListView` wrapper — нужно подключить к `resolvedLabels` от `crossProjectResolver`.

### Gap 2 — Status semantics в Board (высокий)
- **Текущее**: Status = Select с особыми именами. Board не знает о 3-уровневой группировке.
- **Notion**: Not Started / In Progress / Done — три семантические группы, Board колонки стандартизированы.
- **Bridge**: `StatusFieldTypeConfig.groups` уже есть в settings — нужен Board-side рендерер групп.

### Gap 3 — Sub-base tabs UI (высокий)
- **Текущее**: `subBase.ts` и `SubBaseTabs.svelte` существуют, но не подключены в `DashboardCanvas`.
- **Notion**: inline database = самостоятельная вкладка внутри страницы-родителя.
- **Bridge**: вписать `SubBaseTabs` как первоклассный UI-элемент в `DashboardCanvas`, переключение между под-базами.

### Gap 4 — Dataview DQL as query source (средний)
- **Текущее**: `DataviewDataSource` работает, но требует Dataview.
- **Адаптация**: когда DV установлен → использовать его DQL как filter source; когда нет → folder/tag sources с нашим `filterEvaluator`.
- **Bridge**: graceful degradation — если `getPlugin("dataview") === null`, предложить folder source; не ломать UI.

### Gap 5 — Rollup UI (средний)
- **Текущее**: `rollupMode.ts` реализован (20+ функций), но UI для создания rollup-поля — заглушка.
- **Notion**: Edit property → выбор функции из dropdown → отображение результата в ячейке.
- **Bridge**: дополнить `ConfigureField.svelte` для rollup-типа; подключить `rollupMode` к ячейкам.

---

## 5. Что НЕ в scope адаптации

- Full DQL поддержка (JavaScript eval, JOIN между vault-папками)
- Реал-тайм реактивность Dataview (его live-query subscription)
- Замена Dataview как поискового движка для других плагинов
- Multi-user / collaborative features

---

## 6. Scope V5.8 — Dataview Adaptive Bridge (заполняется в сессии 3)

Цели фазы V5.8:
- `DataviewDataSource` → `DataviewEnhancedSource` с явным opt-in и graceful degradation
- `src/lib/datasources/native-query/` — lightweight subset: `FROM folder WHERE conditions SORT field LIMIT n`
- Bridge-слой для Gap 1 (Relation UI) и Gap 5 (Rollup UI)
- Обновление `DataviewDataSource` для использования нашего `filterEvaluator` как canonical filter (вместо DV-нативной фильтрации) — единая семантика для всех sources

**Конкретные файлы и tickets определяются в сессии 3.**
