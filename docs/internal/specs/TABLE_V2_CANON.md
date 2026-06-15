# TABLE V2 CANON — таблица данных, перестроенная с нуля по образцу Notion

> Статус: КАНОН для фазы F2 (#074). Создан 2026-06-11 по мандату пользователя:
> «таблицы с нуля, без оглядки на прошлый экземпляр, с ориентированием на таблицы
> данных в Notion, включая стилистические решения».
> **Замещает** схему «DataTable Widget анатомия компонента.png» как канон F2 —
> та схема нарисована вокруг V1-виджета и наследует его компромиссы.
> Опирается на: UI_DESIGN_ARCHITECTURE §9 (Notion Visual DNA — значения), §3.4 (grid-скелет),
> DASHBOARD_V2_SPEC §3.4/§6 (контракты данных). Целевая реализация — Table tab внутри
> `database-call` (DataTableContent, сейчас 57 LOC — чистый фундамент).

---

## 0. Концептуальная модель (чем таблица ЯВЛЯЕТСЯ)

В Notion таблица — это **не грид с данными, а список страниц с типизированными свойствами**:

1. **Строка = страница.** У нас: строка = заметка. Поэтому первичная колонка (Name) — особая:
   она открывает запись (hover → `↗ OPEN`), её нельзя скрыть, она носитель идентичности.
2. **Ячейка = свойство страницы.** Редактируется НА МЕСТЕ, тем редактором, который
   соответствует типу свойства. Никаких «открой модалку, чтобы поменять статус».
3. **Вид — это линза, не контейнер.** Filter/Sort/Group/Hide — состояние ВИДА, живёт в
   тулбаре вида (pills), а не в теле таблицы. Тело таблицы — только данные.
4. **Управление через два меню.** Всё про колонку — в меню заголовка колонки. Всё про
   строку — в hover-actions строки + контекстном меню. Третьих мест нет.

### Что отвергаем из V1 (анти-канон)

| V1-паттерн | Почему мёртв |
|---|---|
| Тулбар-чипы Макет/Hidden/Group/Sort/Σ/🔍/⬇ внутри виджета | дублирует меню заголовков, съедает высоту, не-Notion |
| Баннер-хинт «кликните правой кнопкой…» | интерфейс, требующий инструкции, спроектирован неверно |
| Sub-base вкладки ВНИЗУ таблицы | вкладки видов живут СВЕРХУ (ViewTabBar database-call); суб-база = ещё одна вкладка-линза |
| Клик по ячейке → SlideIn-модалка | редактирование на месте; модалка/peek — только для открытия записи целиком |
| Emoji-глифы как иконки | только Lucide (UT2026-B T3) |
| px-размеры | только rem + токены |

---

## 1. Анатомия (зоны сверху вниз)

```
┌─ database-call block ────────────────────────────────────────────────┐
│ ViewTabBar:  [Table] [Board] [Календарь] [Суб-база: Tasks] [+]      │ ← вкладки-линзы,
│ ControlBar:  [Filter ▾] [Sort ▾] [⌕] [⋯]          [New ▾]          │   суб-базы здесь
│ ──────────────────────────────────────────────────────────────────── │
│ Header:   [☐] [𝑨 Name      ] [◯ Status ] [# MRR  ] [🔗 Client] [+] │ ← sticky, иконки типов
│ Body:      ☐  ▸ Иван Петров   ● Active     42 000   [Acme] +2       │ ← строки-страницы
│            (hover: ⋮⋮ слева, [↗ OPEN] на Name, ⊕ ⋯ справа)          │
│ NewRow:   [+ Новая запись]                                           │ ← всегда внизу тела
│ Footer:   Count 12          ·          Sum 504 000  ·                │ ← sticky aggregations
└──────────────────────────────────────────────────────────────────────┘
```

- **ControlBar** — единственный «пульт» вида: Filter/Sort как dismissable **pills**
  (высота 1.75rem, §9), активные показывают условие («Status: Active ×»), поиск
  разворачивается из иконки, `⋯` — плотность/wrap/hide-empty. Σ-toggle отсутствует:
  footer включается из меню колонки («Calculate ▸»), как в Notion.
- **`[+]` в конце header'а** — добавить свойство (создание поля во всех заметках —
  закрывает дыру Vision §2).
- **Header-иконки типов** обязательны (𝑨 text, ◯ select, # number, 🔗 relation, ☑
  checkbox, 📅 date — Lucide-эквиваленты): тип читается взглядом, tooltip несёт
  frontmatter-ключ (#060 въезжает сюда).

## 2. Стилистика (Notion Visual DNA → решения)

Значения токенов — §9 UI_DESIGN_ARCHITECTURE. Решения поверх них:

| Решение | Канон |
|---|---|
| Сетка | **только горизонтальные** разделители строк (`--background-modifier-border`); вертикальные — нет (появляются как тень resize-ручки на hover границы колонки). Никакой zebra |
| Строка | высота 2.25rem (36px DNA), три плотности из `⋯` (compact 1.75 / default 2.25 / tall 3) |
| Hover строки | фон всей строки `--ppp-db-surface-hover`, без рамок; actions проявляются opacity-transition 120ms |
| Выделение | `--ppp-db-surface-selected`; dimmed (selection bus) — opacity .4 |
| Редактирование ячейки | ячейка приподнимается: фон `--background-primary`, ring 0.125rem `--interactive-accent`, тень `--ppp-shadow-md` — паттерн «cell becomes a popover» |
| Текст | Name — `--text-normal` medium; прочие ячейки — `--text-normal` regular; footer и заголовки — `--text-muted`; пустые ячейки — ПУСТЫЕ (без плейсхолдера), на hover ячейки появляется призрачный «—» `--text-faint` |
| Select/Status | **pill**: фон из palette store (никаких hex), радиус 0.25rem, padding 0 0.375rem, высота 1.25rem; Status — с точкой-индикатором ● |
| Multi-select/tags | pills в строку, overflow «+N» (раскрывается в редакторе ячейки) |
| Relation | pill с подчёркиванием-намёком,克лик по pill = peek записи; редактор — RelationPickerPopover (#081); overflow «+N» |
| Checkbox | чистый чекбокс по центру, без текста |
| Date | текст; редактор — существующий DateInput popover |
| Number/Formula/Rollup | выравнивание ВПРАВО, моноширинные цифры (`font-variant-numeric: tabular-nums`) |
| Заголовки | `--text-muted`, regular (не bold — Notion), иконка типа слева, ↕-индикатор сорта справа; hover → `--ppp-db-surface-hover`; клик = меню колонки |
| Group headers | строка-секция: chevron + значение + счётчик `--text-muted`, фон `--background-secondary`, collapse с анимацией высоты |
| Footer | `--text-muted`, hover ячейки footer'а → дроп «Calculate ▸» (count/sum/avg/…) |

## 3. Взаимодействия (полная матрица)

| Жест | Результат |
|---|---|
| Клик по ячейке (не Name) | редактор типа НА МЕСТЕ: text→input, number→input right, select/status→dropdown с поиском и созданием опции, date→DateInput, relation→#081, checkbox→toggle сразу |
| Esc / клик вне | отмена/коммит редактора (blur = commit, Esc = revert) |
| Tab / Shift+Tab, Enter | следующая/предыдущая ячейка; Enter в последней строке → новая запись |
| Hover строки | слева ⋮⋮ (drag, только при ручном сорте) + ☐; на Name — `↗ OPEN`; справа ⊕ (вставить ниже) и ⋯ (меню строки: open/duplicate/delete/copy link) |
| Клик Name / ↗ | открыть запись (peek SlideIn; в новой вкладке — модификатором) |
| ☐ + Shift-клик | bulk-выделение диапазона; появляется плавающий bulk-бар (count · delete · edit property) |
| Клик заголовка | меню колонки через `contextMenu.ts`: Sort ASC/DESC, Filter by, Hide, Freeze up to, Wrap, Calculate ▸, Edit property (тип/имя), Delete property |
| Drag заголовка | переупорядочить колонку; drag границы — resize (rem) |
| `[+]` в header | создать свойство: имя+тип → frontmatter bulk-write c подтверждением «во всех N заметках?» (Vision §2) |
| `+ Новая запись` | inline-строка, фокус в Name, Enter = создать следующую |

Всё редактирование — через `viewApi.updateRecord` (двунаправленность §6.3); никаких
параллельных путей записи.

## 4. Данные и движок (без изменений контрактов)

DataWidgetProps (§3.4 SPEC), единый `filterEvaluator`, Selection Bus заморожен, derived
pipeline (`applyFormulaFields` → `enrichFrameWithRelations`). Виртуализация — перенос
существующего механизма. Группировка — `groupRecords` (semantic/values) как есть.

## 5. Декомпозиция и бюджеты (в R0_6)

```
DataTableContent.svelte   ≤ 250  — оркестратор зон (header/body/footer/new-row)
TableControlBar.svelte    ≤ 200  — pills Filter/Sort/⌕/⋯ (использует FilterPanel)
TableHeader.svelte        ≤ 200  — заголовки, иконки типов, resize/drag, [+]
TableRow.svelte           ≤ 150  — строка + hover-actions + bulk ☐
EditableCell.svelte       ≤ 250  — диспетчер редакторов по DataFieldType (инвариант #1!)
TableFooter.svelte        ≤ 120  — агрегации + Calculate-меню
TableGroupSection.svelte  ≤ 100  — group header + collapse
```

Диспетчеризация редакторов — строго по `DataFieldType`, не по имени поля.

## 6. Что берём из дизайн-схемы «DataTable анатомия» (переосмыслено)

Bulk select ✔ (как §3), relation pill-chips «+N» ✔ (стилистика §2), footer-агрегации ✔
(вход через меню колонки, не Σ-кнопку), hover drag-handle ✔ (только manual sort).
НЕ берём: нижние sub-base вкладки (переезжают в ViewTabBar), тулбар-чипы, hint-баннер.

## 7. Порядок внутри F2 (уточнение UT2026-F)

F2.1 скелет: ControlBar + Header + Row + Footer на токенах §2, read-only, virtual scroll  
F2.2 EditableCell: text/number/checkbox/date → select/status → relation (#081 здесь)  
F2.3 строчные операции: hover-actions, + New row, bulk-бар, клавиатура  
F2.4 колонки: меню заголовка, resize/drag/freeze, `[+]` add property  
F2.5 группировка + sub-base как вкладка ViewTabBar  
Каждый подэтап — 4 ворот + деплой-верификация; визуальный чек по этому канону.
```
DoD F2 = таблица неотличима по поведению от Notion-таблицы в пределах матрицы §3,
при нулевом наследовании кода и разметки из src/archive/dashboard-v1/DataTable.
```
