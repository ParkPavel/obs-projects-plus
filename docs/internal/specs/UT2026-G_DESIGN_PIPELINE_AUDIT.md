# UT2026-G — Аудит дизайн-пайплайнов (visual stack) × текущий план разработки

> Источник: `C:\Users\Park\OBSv1.0\visual stack\` — 15 схем от дизайнеров.
> Дата анализа: 2026-06-11. Сверено с кодом @ `6d4a043` и планом UT2026-F.
> Вердикт: пайплайны частично историчны (эпоха V1/R5), но содержат 4 потерянных
> продуктовых элемента и готовые спеки для 3 открытых тикетов. План скорректирован.

## A. Дизайн подтверждён реализацией (расхождений нет)

| Схема | Статус в коде |
|---|---|
| Transform Pipeline (8 шагов) | ✅ 1:1 — все 8 типов шагов в PipelineEditor/transformExecutor + transformCache |
| Архитектура 4 слоя | ✅ соответствует (футер схемы «106 suites/1679» — историчный снапшот, сейчас 141/2074) |
| Formula Engine 115+ | ✅ `lib/formula/index.ts` канон, `formulaParser.ts` @deprecated (подтверждено), ~109 функций в метаданных |
| Реактивный контур R5-016 «BROKEN (P0)» | ✅ **схема устарела**: `transformCache.invalidateAll()` зарегистрирован на dataFrame store — контур починен после создания схемы |
| Система связей R5-010 (inverse index, cross-entity rollup) | ✅ done (#010) |
| Матрёшка (3 уровня) | ✅ реализована |
| YAML Visualizer R5-011 | ✅ был done; виджет заархивирован в #056 (см. D2/#082) |

## B. Дизайн уточняет открытые тикеты (готовые спеки — принять)

1. ~~«DataTable Widget анатомия» = визуальный канон для F2~~ **ОТМЕНЕНО 2026-06-11**
   (вердикт пользователя: схема нарисована вокруг V1-виджета и не является перестройкой
   с нуля). Канон F2 = **`specs/TABLE_V2_CANON.md`** — концептуальная модель Notion-таблицы
   (строка=страница, ячейка=свойство, вид=линза) + стилистическая матрица. Из PNG-схемы
   в канон перенесены переосмысленными только: bulk select, relation pill-chips «+N»,
   footer-агрегации, hover drag-handle (TABLE_V2_CANON §6).
2. **«Formula builder — Anatomy» = готовая спека #077**. Ключевое требование дизайна:
   FormulaConstructor — **единый компонент для всех точек ввода формул** (TableProperty,
   AdvancedFilterEditor, FormulaBar, ConfigureField, FilterEditor + Dashboard). Слои:
   toolbar → input c подсветкой/автокомплитом сигнатур → live preview → help-панель
   категорий. #077 переведён из «design_required» в «DESIGN READY», приоритет P1.
3. **4 пресета (Project Tracker / Finance / Analytics Lab / Content Library) = контент #061**.
   Дизайн даёт состав каждого пресета повиджетно. Решение по слиянию с Vision §7:
   - **канвас-пресеты** (WIDGET_TEMPLATES) ← 4 дизайнерских пресета;
   - **onboarding-профили** (clients/fitness/journal из Vision) ← генерируют папки+данные
     и ссылаются на эти пресеты. #061 рескоуплен.

## C. Потеряно планом — дизайн требует, тикета не было

| Элемент | Схема | Действие |
|---|---|---|
| **Formula Node widget** — fx-блок на канвасе (`=sum(@budget) + progress`) | Таксономия №11 | #080 (decision required: V2.5 или отказ — тип в WidgetType отсутствует) |
| **RelationPickerPopover** — поиск + multiselect при выборе связей («3 selected · Done») | Система связей (RS-019 planned) | #081 P2/M — закрывает Notion-gap «Relation picker popup» |
| **Bulk select (RS-020)** | DataTable анатомия | влит в F2 (#074) |
| **Properties pane (R5-012)** — типизированная карточка записи вместо YAML-виджета | YAML Visualizer | #082 P2/M: выровнять RecordCardView/SlideInPanel с дизайном typed-карточки; #011/#012 закрыты как superseded |

## D. Конфликты дизайна с принятыми V2-решениями (курс НЕ меняем)

1. **Свободный канвас + Grid-toggle** (light-mockup) — V2 осознанно stack-only, FreeCanvas
   удалён в Phase 3; free canvas = V3 (FREE_CANVAS_SPEC.md draft). Схема — эпохи V1.
2. **Таксономия 11 виджетов** включает Comparison/ViewPort/SummaryRow/YamlVisualizer/
   SubBaseCanvas — V2 fate table (§4) их убирает; UT2026-A L2 уже скрыл их из палитры.
   Реанимации нет; их ФУНКЦИИ переезжают (SummaryRow→stats, SubBase→database-call и т.д.).
3. Light-тема мокапов — тема даётся Obsidian'ом; токены `--ppp-*` адаптивны. Не дефект.

## Скорректированный план (полная очередь)

| # | Блок | Источник |
|---|---|---|
| 1 | **F1** #067 Shell+Router (+ R0_6 LOC-budget) | UT2026-F |
| 2 | **F2** #074 Table V2 — канон «DataTable анатомия»: inline edit, row actions, header menu, bulk select, relation chips, sub-base tabs, drag handle | UT2026-F + G.B1 |
| 3 | **F3** миграция data-table + L1 containment (закрывает #068) | UT2026-F |
| 4 | **#077** единый FormulaConstructor во всех 5 точках + именованный popup (P1, DESIGN READY) | G.B2 |
| 5 | **#061** Template Library: 4 канвас-пресета + 3 onboarding-профиля | G.B3 |
| 6 | #081 RelationPickerPopover; #082 typed-карточка записи | G.C |
| 7 | #078 CalendarView decomposition (2328 LOC); #079 hex-ratchet тест | аудит 2026-06-11 |
| 8 | #075-остаток + #076 (дизайн-сессия по UT2026-E), #060, #036 | прежний план |
| 9 | Решения пользователя: #066 (YAML-конфиг), #080 (Formula Node), #071 (репро) | gates |

V3 без изменений: free canvas, drag-to-link #062, Timeline #063, Graph #064, SmartSuggest-аналитика.
