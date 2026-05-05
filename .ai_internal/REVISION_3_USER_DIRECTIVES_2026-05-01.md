# Revision 3 — User Directives 2026-05-01

> **Статус**: ревизия контекста после ручного smoke-теста Stage A.10 и критического разговора с пользователем. **NO CODE до явного утверждения нового плана**. Этот документ фиксирует обновлённое понимание продукта, поправки к моей предыдущей интерпретации, новые требования и критические находки. Все последующие милстоуны Stage B / M1..M5 строятся ПОВЕРХ этого документа.
>
> **Anchored in**: пользовательская директива от 2026-05-01 (после ручного теста Stage A.10), скриншот Notion Rollup property menu, скриншот нативной Properties pane Obsidian.

---

## 0. Что подтверждено и что осталось работать

### Stage A.10 — ручной smoke-тест
- ✅ Календарь — работоспособность вернулась после фикса Relation detection.
- ✅ Остальные виды (Board / Gallery / Table) — без регрессий.
- ❌ **Database view** — функционал НЕ перестроен, не готов к тестированию.
- ❌ **YAML Визуализатор / metadata viewer** — НЕ заменяет нативную Properties pane, не обладает запрашиваемыми функциями.

### Главный вывод пользователя
> «Главный пробел — тотальное игнорирование точек пользовательского входа в функции через интерфейс. YAML Визуализатор должен быть нативной функцией. ВСЕ взаимодействия с новыми функциями в принципе 0. Самое главное — игнорирование того факта, что сами таблицы нужно построить заново.»

---

## 1. Уточнённая модель продукта (после поправок)

### 1.1 Заметка = строка БД, но с многоуровневыми представлениями

Это **самое важное уточнение** к моей предыдущей модели:

```
Источник данных (folder/tag/dataview)
    │
    ▼
Глобальный фильтр вида  ← настройка в "шестерёнке" вида
    │
    ▼
"Поток вида"  ← общий набор записей, видимый этому View
    │
    ├──────► База 1 (default-таблица вида)
    │
    ├──────► База 2 «Бюджеты»  (фильтр: budget != null)
    │           │
    │           │  двусторонняя relation
    │           ▼
    └──────► База 3 «Траты»    (фильтр: spent != null)
                │   relation → База 2
                │   rollup    → budget из связи
                ▼
            Внутри каждой записи Базы 3 видны связанные записи Базы 2
            Внутри каждой записи Базы 2 видны связанные записи Базы 3 (обратный список)
```

**Ключевые тезисы**:
- **Под-базы** — это таблицы внутри одного Database View (не отдельные view-tabs). Каждая под-база — свой фильтр, свой набор колонок, своя сортировка/группировка.
- **Relation работает не только cross-project**. Relation внутри ОДНОГО вида связывает под-базы между собой → способ переупаковки и потоковой передачи данных.
- **Двусторонние связи**: Relation в Базе 3 → Бюджеты автоматически создаёт inverse-relation в Базе 2 → Траты.
- **Rollup поверх связи** агрегирует поле другой под-базы по правилам (sum / count / show original / show unique values / percent / count true и т.д. — см. §1.4).
- **Formula-колонка** работает в пределах одной базы, но может ссылаться на rollup-колонку (т.е. цепочка: relation → rollup → formula).

### 1.2 Фронтматтер ↔ типы колонок

| Тип колонки  | Что лежит в YAML | Как показывается |
|--------------|------------------|------------------|
| Text         | строка           | inline editor |
| Number       | число            | numeric input |
| Boolean      | true/false       | checkbox |
| **Date**     | YYYY-MM-DD       | date picker (БЕЗ времени) |
| **Datetime** | ISO с временем   | date+time picker |
| List         | array of string  | tag-list |
| **Select**   | строка (одна из enum) | chip с цветом |
| **Status**   | строка (одна из enum, обычно отдельный набор) | chip с цветом, отдельная семантика для Board "колонок" |
| **Relation** | wikilinks `[[…]]` (массив!)  | pill-список с overflow `+K more` |
| **Rollup**   | вычисляется        | derived display, не пишется в YAML |
| **Formula**  | вычисляется        | derived display, не пишется в YAML |

**Критические уточнения**:
- **Date и Datetime — раздельные типы**. Не ломать формат календаря: Date = day-precision, Datetime = с часом/минутой. Это сейчас уже так в коде; защитить регрессионными тестами.
- **Select и Status — оба формы списков** (enum-колонки), но **Status** имеет дополнительную семантику для Board (default-группировка).
- **Список enum-значений** в YAML ничем не отличается от обычной строки — соответствие по имени колонки + значению (например, `priority: high` распознаётся как Select, если `priority` объявлен как Select в схеме).

### 1.3 Relation — двусторонний поток данных

- Внутри проекта: `client: [[Acme Corp]]` → ссылка на запись из проекта-цели.
- Между под-базами: `budget: [[Q1 Budget]]` → ссылка на запись из соседней под-базы того же View.
- **Manual relations в Visualizer**: пользователь вручную пристёгивает к заметке ссылки на любые другие заметки (даже вне проектов) — превращает заметку в мини-базу.
- **Двусторонние**: при объявлении связи автоматически создаётся обратный список в целевой записи.
- **Render**: pill-list, overflow `+K more` с popover (как в Notion), кликабельно, hover preview.

### 1.4 Rollup — упрощённое визуальное представление

Референс-скриншот пользователя (Notion Rollup property menu):
```
Edit property
Change type
─────────
Show original         ← список оригинальных значений
Show unique values  ✓ ← дедуплицированный список
Count                ►  (Count all / Count values / Count unique values / Count empty / …)
Percent              ►  (Percent empty / Percent not empty / Percent checked / …)
More options         ►  (Sum / Average / Median / Min / Max / Range — для numeric)
```

**Требование**:
- Rollup должен поддерживать **любой формат целевой колонки** (не только number).
- UI выбора: сначала **target column** (с любым типом), потом — **аггрегация**, доступная под этот тип.
- Для text/list/relation: Show original / Show unique values / Count.
- Для number: + Sum / Avg / Min / Max / Median / Range.
- Для boolean: + Percent checked / Percent unchecked.
- Для date: + Earliest / Latest / Range.

Это ШИРЕ чем мой текущий 12-функциональный enum — нужно расширить + сделать UI **картинку выбора** как в Notion (не два независимых dropdown-а).

### 1.5 Formula — отдельный модуль

**Унифицированный модуль формул для ВСЕГО плагина** (директива пользователя):
- Сейчас есть **Formula bar** в Database view (строится).
- Сейчас есть **Formula MVP modal** в Schema/CreateField (примитив).
- Сейчас есть **operatorHelpers / Agenda formula** в Calendar (требует углубления).
- Сейчас есть **Dataview-style queries** для datasource.

**Новое требование**: единый Formula Editor — общий компонент, переиспользуемый везде:
- Database column formulas
- Filter formulas (если отказываемся от visual-builder для power users)
- Agenda formula
- Под-база selection (фильтр + формула)
- Rollup custom function (Stage B+)

**Дизайн**: dedicated modal/popup с IntelliSense, live preview, syntax check, доступ к колонкам текущей и связанных баз, готовые функции из Dataview-совместимого диалекта.

### 1.6 Per-note property preferences (НОВОЕ — пропускал ранее)

> **Цитата пользователя**: «заметки или категории заметок должны запоминать какие свойства для них показываются всегда, какие можно скрыть и раскрыть, какие закрепить в том или ином порядке или переместить»

Это **per-note overlay** поверх схемы проекта:
- Схема проекта объявляет 12 полей.
- В отдельной заметке `Бета-тестирование v3.0` пользователь скрыл `color`, закрепил `priority` сверху, развернул только 5 видимых, остальные свернул.
- Эти настройки персистируются (frontmatter-extension? settings? per-note YAML key?).
- При открытии заметки Visualizer применяет per-note overlay поверх project schema.

**Уровни настройки**:
1. Project schema (default order, default visibility)
2. Note-category overlay (можно по тегу/папке заранее задать профиль)
3. Per-note overlay (финальный override)

### 1.7 Synergy с нативным Obsidian

- Visualizer должен **выглядеть похоже** на нативную Properties pane (для онбординга).
- Все свойства → честный YAML frontmatter (никакого проприетарного формата).
- Hover preview / link navigation / mobile / hotkeys / theme tokens — нативный путь.
- **При этом**: YAML Visualizer заменяет нативную панель, добавляя relation/rollup/formula/per-note prefs/manual relations.

---

## 2. UX-принципы (директива)

### 2.1 Универсальная адаптивность — принцип «матрёшки»

> «Obsidian работает на неограниченном колличестве устройств — мы физически не можем предсказать параметров и прописать удобные условия для всех. Поэтому в проекте мы используем ИСКЛЮЧИТЕЛЬНО относительные единицы. А для ориентации всех элементов всегда работает принцип МАТРЁШКИ — каждый элемент существует не в вакууме, а привязан к своим соседям, родителям и детям, и чётко имеет понимание в универсальной адаптивности самостоятельно.»

**Конкретные правила (новые / усилены)**:
- **Только относительные единицы**: `rem` / `em` / `%` / `vh` / `vw` / `clamp()`. **НИКАКИХ `px`** (кроме границ ≤ 2px и заведомых констант, которые потом тоже надо подавлять).
- **Container queries** > media queries, где возможно (Obsidian поддерживает).
- **Каждый компонент** знает свои min/max sizes относительно родителя.
- **Никаких `position: absolute` без явного relative-anchor** (контекстные меню, popovers — strict positioning).
- **Touch-минимум**: 2.25rem (36px при default 16px root).
- **Никаких hardcoded breakpoints в JS**: вся адаптивность через CSS.

### 2.2 Точки пользовательского входа

Главный пробел Stage A.10:
- Функционал есть, но **нет нативных точек входа в интерфейсе**.
- Toolbar Schema-кнопка — это ОДНА точка, нужно мно́жество.

**Требуемые точки входа**:
- Native context menu заметки → "Open as YAML Visualizer"
- Native ribbon icon → переключение Properties pane на наш Visualizer
- Right sidebar leaf — постоянно доступная панель свойств активной заметки
- Command palette — все ключевые действия
- Hotkeys (configurable)
- Inline cell click → contextual editor (Notion-style)
- Cell context menu → property type / sort / filter / rollup
- Column header context menu → edit / hide / pin / sort / insert left / insert right (как в Notion screenshot)

### 2.3 Apple-grade «без молчаливых багов»

- Нет визуальных «пустых» состояний без объяснения причин.
- Все warning chips локализованы и actionable (клик → исправление).
- Кнопки с состояниями (`:hover`, `:active`, `:focus-visible`, `aria-pressed`, `disabled`).
- Анимации только функциональные (≤ 200ms), не декоративные.
- Touch-friendly везде, не только в очевидных местах.

---

## 3. Критические находки в текущем коде

### 3.1 Database view — таблицы нужно построить заново

> **Цитата пользователя**: «сейчас визуал заимствован из старых версий вместе с обсолютно всеми тотальными проблемами кривизной колонок, критически не верными закреплениями контекстных меню колонок и т.д. А ещё в одном виде невозможно вставить больше одной таблицы.»

**Подтверждённые проблемы**:
1. **Кривизна колонок**: ширины колонок, ресайзинг, alignment контента — наследие Wave 1.
2. **Контекстные меню колонок** — закрепление (positioning) сломано, не привязано к header'у.
3. **Только одна таблица в виде**: Database View поддерживает один `data-table` widget, не несколько.
4. **Нет под-баз**: фильтр-промоушен есть, но под-базы как первоклассный концепт отсутствуют.
5. **Inline cell editing** для Stage A типов отсутствует.
6. **Отсутствует drag-reorder для записей** в Database (есть в Board, нет в Database table widget).

**Решение**: **полная переработка таблицы как нового модуля**. Старый `DataTable` widget — переписать на нативную реализацию с матрёшечным резайзингом, нативными контекстными меню (привязка через portal к header-cell), поддержкой множественных таблиц в виде, inline-редакторами для всех типов.

### 3.2 YAML Визуализатор — не интегрирован

- Существующий `YamlVisualizer.svelte` — single-file MVP без leaf, без context-menu entry, без hotkey.
- 8 stubs `STB-VISUALIZER-*` зарегистрированы, но НЕ закрыты.
- Replacement нативной Properties pane не реализован.
- Manual relations / per-note overlay / cross-vault note mini-DB — отсутствуют.

### 3.3 Унифицированный модуль формул — отсутствует

- Сейчас 4+ независимых формульных surface (Database formula bar / Schema formula MVP / Agenda operatorHelpers / Dataview queries).
- Каждый — свой парсер, свой UI, свой набор функций.
- **Нужно**: единый Formula Editor + единый dialect + единый AST + единый IntelliSense.

### 3.4 Отсутствие сквозной интеграции под-баз

- Концепт «таблицы внутри вида с собственным фильтром, связанные через Relation» не существует в коде.
- Глобальный фильтр вида и table-локальный фильтр — два отдельных слоя без объединения.
- Двусторонние Relation между под-базами — отсутствуют.

---

## 4. Ревизия плана разработки

### 4.1 Принцип ревизии (директива)

> «Необходим критический анализ с правкой всех планов внедрения и построение работы по принципам, где каждое решение помогает в решении следующего этапа.»

**Новый порядок** (вместо линейного A→B):

```
Phase R0 — Foundation (фундамент)
    ├─ R0.1 Унифицированный Formula Editor (модальное окно + AST + dialect)
    ├─ R0.2 Унифицированный модуль контекстных меню (portal-anchored)
    ├─ R0.3 CSS-аудит: rem-only conversion, матрёшечная адаптивность
    └─ R0.4 Обзор всех точек входа (entry-point inventory)

Phase R1 — Visualizer (метадата как первоклассный объект)
    ├─ R1.1 YAML Visualizer как leaf + sidebar pane + native replacement
    ├─ R1.2 Per-note property overlay (visibility/order/pin)
    ├─ R1.3 Inline relation editor + manual relations (вне проектов)
    ├─ R1.4 Color-aware reading (палитра в ридере)
    └─ R1.5 Property type editor popup (Notion-grade)

Phase R2 — Database canvas reborn
    ├─ R2.1 Полностью переписанный TableWidget (rem-based, матрёшка)
    ├─ R2.2 Множественные таблицы в одном виде (под-базы)
    ├─ R2.3 Концепт под-базы (фильтр + relation + rollup внутри view)
    ├─ R2.4 Двусторонние Relation между под-базами
    ├─ R2.5 Rollup UI в стиле Notion (target → calculation chain)
    └─ R2.6 Inline cell editing для всех Stage A типов

Phase R3 — Power users
    ├─ R3.1 Formula columns (поверх R0.1)
    ├─ R3.2 Agenda formula унификация
    ├─ R3.3 Filter formula mode (опционально)
    └─ R3.4 Cross-base referencing в формулах

Phase R4 — Polish & Release
    ├─ R4.1 Mobile parity sweep
    ├─ R4.2 i18n parity
    ├─ R4.3 A11y audit
    ├─ R4.4 Performance profiling
    └─ R4.5 Public 3.5.0
```

### 4.2 Обоснование порядка

- **R0 раньше всего**: каждая последующая фаза опирается на унифицированные блоки (формулы, меню, CSS-rules). Без них R1/R2 будут наследовать те же проблемы фрагментации.
- **R1 раньше R2**: Visualizer — самый частый touchpoint (открыл заметку → видишь свойства). UX-фундамент для всего остального. Опыт здесь определяет восприятие плагина.
- **R2 поверх R1**: Database canvas использует те же visualizer-компоненты для inline editing → reuse, а не дубль.
- **R3 поверх R2**: Formula columns используют унифицированный Formula Editor (R0.1) и под-базы (R2.3).
- **R4 — финальная полировка**: после фундамента и всех фаз — полный sweep mobile/i18n/a11y.

### 4.3 Что становится неактуальным из старого плана

- **Stage B M1 (Field Types UI polish)** → растворяется в R1.5.
- **Stage B M3 (Formula Editor Popup)** → становится R0.1, **двигается в самое начало**.
- **Stage B M4 (Pipeline)** → распадается на R3.4 + R2.3.
- **Stage B M5 (public 3.5.0)** → становится R4.5.
- **Stubs `STB-VISUALIZER-*`** — все закрываются в R1, ни один не остаётся deferred.

---

## 5. Открытые вопросы (требуют ответа перед стартом R0)

1. **Persistence per-note overlay**: где хранить?
   - (а) В frontmatter заметки (`pp_overlay: { hidden: [...], pinned: [...], order: [...] }`) — портативно, но засоряет YAML.
   - (б) В settings плагина (по path заметки) — чисто, но non-portable.
   - (в) Гибрид: project-level overlay в settings, per-note — в frontmatter (если пользователь явно настроил).

2. **Manual relations вне проекта**: как пользователь добавляет relation к заметке, у которой нет project-схемы?
   - Через Visualizer "+ add relation" → wikilink picker.
   - Поле создаётся ad-hoc в frontmatter (например, `links: [[X]], [[Y]]`).
   - Persistence только в YAML, без нашей схемы.

3. **Под-базы**: их фильтры — это `FilterDefinition` (как глобальный) или новый `SubBaseDefinition` с собственными relation/rollup-полями?

4. **Двусторонние Relation**: где хранить inverse-link?
   - (а) Авто-материализация в YAML обеих заметок.
   - (б) Только runtime-derive (Engine v2 строит inverse-index при загрузке).
   - (в) Гибрид (inverse derived, но писать в YAML по флагу).

5. **Унификация Agenda formula**: ломаем backward-compat существующих фильтров агенды или мигрируем автоматически?

6. **Replacement нативной Properties pane**: hijack нативного компонента или открываем рядом?
   - Hijack рискован (Obsidian update может сломать).
   - Side-by-side: нативная + наша — confusing.
   - Идеал: settings-toggle "Use Projects Plus Visualizer for properties" — пользователь решает.

7. **Rem-only**: терпим ли существующие `px` в третьих библиотеках (`obsidian-svelte`)? Или mocks/wrappers?

---

## 6. Definition of Done для Revision 3 (предварительно)

### Functional
- [ ] YAML Visualizer открывается как leaf + sidebar + замена нативной pane.
- [ ] Manual relations + per-note overlay работают.
- [ ] Color preview в ридере.
- [ ] Database view содержит ≥2 таблиц в одном view.
- [ ] Под-базы с фильтрами + двусторонние relation работают.
- [ ] Rollup поверх любого типа колонки с Notion-style UI.
- [ ] Formula column работает поверх унифицированного Formula Editor.
- [ ] Все формульные surface переключены на единый модуль.

### Quality
- [ ] 100% относительных единиц в `src/**/*.{svelte,css}` (исключения зафиксированы).
- [ ] Принцип матрёшки соблюдён (новый CSS lint-правило).
- [ ] ≥80 test suites / ≥1200 tests (рост за счёт Visualizer + Database rewrite).
- [ ] `tsc -noEmit` clean.
- [ ] `npm run build` без новых warnings.
- [ ] Все 8 `STB-VISUALIZER-*` закрыты.
- [ ] Все 4 точки входа (palette / ribbon / context menu / sidebar) реализованы.

### UX
- [ ] Calendar/Board/Gallery — без регрессий (smoke-tested).
- [ ] Inline editing для всех Stage A типов.
- [ ] Touch-targets ≥ 2.25rem везде.
- [ ] Нет hardcoded breakpoints в JS.
- [ ] i18n parity: en / ru / uk / zh-CN — 100% новых keys.

---

## 7. Следующий шаг

**UPDATE 2026-05-01**: Пользователь делегировал автономное продвижение «до победного с промежуточными аудитами и само-коррекцией». §5 закрыт следующими решениями (могут быть скорректированы):

| # | Вопрос | Решение | Обоснование |
|---|--------|---------|-------------|
| 5.1 | Persistence per-note overlay | **Гибрид**: project-level overlay в `settings.preferences.notePropertyOverlays[projectId]` (default-профиль); per-note — в frontmatter ключе `pp_overlay` ТОЛЬКО если пользователь явно настроил. | Не засоряет YAML дефолтами, но даёт portability для важных override. |
| 5.2 | Manual relations | Frontmatter ad-hoc: пользователь даёт key (default `links`), значение — массив wikilinks. Visualizer показывает UI "+ Add relation" с picker'ом, имя ключа конфигурируется в Visualizer-pane settings. | Нативный YAML, не наша схема, синергия с Obsidian outgoing/incoming links. |
| 5.3 | Под-базы | Новый `SubBaseDefinition` = `FilterDefinition` + own `colors`/`fields`/`sortBy`/`relations`/`rollups`. Сериализуется внутри `DatabaseConfig.subBases: SubBaseDefinition[]`. | Чистая декомпозиция, FilterDefinition остаётся универсальным. |
| 5.4 | Двусторонние Relation | **Runtime-derive**: Engine v2 при загрузке строит inverse-index `Map<noteId, Set<{sourceField, sourceNote}>>`. В YAML пишется только прямая связь. Опциональная материализация откладывается до пользовательского запроса. | Минимум YAML noise, нет sync-проблем, легко удалить. |
| 5.5 | Agenda formula унификация | Auto-migrate: старый `operatorHelpers` сохранить как deprecated wrapper поверх unified Formula AST; миграция выполняется на runtime при первой загрузке. Backward-compat 100%. | Без breaking change для пользователей. |
| 5.6 | Replacement нативной Properties pane | **Settings-toggle, default OFF**. Side-by-side по умолчанию (наш Visualizer как separate sidebar leaf). Hijack включается только при явном `settings.visualizer.replaceNativePane = true`. | Безопасность при обновлениях Obsidian, выбор пользователю. |
| 5.7 | Rem-only | Свой код — strict rem/em/%/clamp. Третьи библиотеки (`obsidian-svelte`) — терпим, но обёрнуты в наши wrappers с rem-presentation. CSS-lint правило в R0.3 запрещает `\b\d+px\b` в `src/**/*.{svelte,css}` кроме `0` и `1px` borders. | Прагматизм: не форкаем чужой код, контролируем свой. |

**Гранулярность R0**: дробим. Порядок R0.4a → R0.2 → R0.1 → R0.3 → R0.4b/c (entry-skeletons прежде всего, чтобы UI-фундамент был доступен для последующих фаз).

**Режим**: автономный, с audit-gate (60/985 baseline) после каждого R-под-шага. Любая регрессия → немедленный откат.

---

## Anchors

- Stage A.9 recovery: [.ai_internal/context_state.md](context_state.md) запись 2026-05-03
- Stage A.10 hardening: [.ai_internal/context_state.md](context_state.md) запись 2026-05-04
- Notion Rollup screenshot: пользовательское вложение 2026-05-01 (Show original / Show unique values / Count / Percent / More options)
- Native Obsidian Properties pane screenshot: пользовательское вложение 2026-05-01 (демо проблемы)
- Stubs registry: [.ai_internal/stubs.md](stubs.md)
- Implementation blueprint (пред-ревизия): [docs/IMPLEMENTATION_BLUEPRINT.md](../docs/IMPLEMENTATION_BLUEPRINT.md)
