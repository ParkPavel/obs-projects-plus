# UT2026-F — Architect Plan: WidgetHost decomposition (#067) + Table V2 rebuild (#074)

> Статус: ПЛАН ГОТОВ (2026-06-11), код не начат. Оба тикета XL; исполняются фазами,
> каждая фаза проходит 4 ворот отдельно. Закрывает также #068 (архитектурно).
> Основания: DASHBOARD_V2_SPEC §3.4 (DataWidgetProps), §3.5/§6 (Selection Bus — контракт
> ЗАМОРОЖЕН), §4 (fate table), UT2026-A (Legacy Containment L1–L4), мандат пользователя
> «таблицы с нуля, без оглядки на прошлый экземпляр».

## Зачем вместе

`WidgetHost.svelte` (947 LOC, 34 type-ветки, 44 импорта) — единственное место, где архивный
V1-код вшит в прод (`src/archive/dashboard-v1/*` импортируется напрямую, включая падающий
DataTableWidget). Декомпозиция хоста (#067) и замена data-table (#074) меняют один и тот же
файл с двух сторон — раздельное исполнение означает двойной merge-конфликт с самим собой.

## Целевая структура

```
widgets/
  WidgetHost.svelte          ≤200 LOC — тонкий роутер: lookup → <Shell><Component/></Shell>
  WidgetShell.svelte         ≤350 LOC — рамка: header (title, badges, actions slot),
                              content slot, collapse, drag handle, ResizeObserver,
                              SelectionBadge в header slot
  WidgetHeaderActions.svelte ≤150 LOC — collapse/config/pipeline/lock/remove → events
  widgetComponentRegistry.ts — WidgetType → { component, buildProps(ctx), configPanel }
                              (расширение существующего widgetRegistry/configPanelRegistry,
                              НЕ третий реестр)
```

Контракты, которые НЕ меняются: Selection Bus API (§6, инвариант), `filterEvaluator` (единый),
`DataWidgetProps` (§3.4), событийная схема `configChange/removeWidget/...` к канвасу,
`WidgetType` union (legacy-типы остаются в типе до завершения миграции).

## Фазы

### F1 (#067) — Shell + Router, поведение 1:1
1. `WidgetShell` + `WidgetHeaderActions` — новые, с компонент-тестами (mount, события,
   collapse, badge). Перенос header-разметки из WidgetHost.
2. `widgetComponentRegistry.ts`: 34 if-ветки → таблица. `buildProps` на тип — чистые функции,
   тестируемые без mount.
3. WidgetHost становится роутером. Mock `WidgetHost.mock.svelte` сохраняет интерфейс —
   canvas-тесты не трогаем.
4. Enforcement: `R0_6_locBudget.test.ts` — LOC-потолки на 4 файла (бюджеты из
   UI_DESIGN_ARCHITECTURE §7), чтобы #052-история (947 LOC намертво) не повторилась.

Риски F1: DnD-handle и ResizeObserver завязаны на текущую DOM-структуру хоста (grid-layout
канваса) — проверять в OBStests вручную (resize, drag, collapse, lock) по
MANUAL_TESTING_PIPELINE §5; событийный re-dispatch (15+ on:*) — самая вероятная точка потери.

### F2 (#074) — Table V2 внутри database-call
1. Развитие `DatabaseCall/DataTableContent.svelte` (НЕ архивного кода): inline cell edit
   (двунаправленность через `viewApi.updateRecord` — §6.3), row hover actions (⊕ открыть/
   развернуть), inline «+ New row» внизу, column header menu ЧЕРЕЗ `src/lib/contextMenu.ts`
   (инвариант #8), resize в rem. Notion-parity gaps P0 из UI_DESIGN_ARCHITECTURE §6.
2. Декомпозиция: DataTableContent ≤400 + TableHeaderMenu + TableRowActions + EditableCell
   (каждый ≤200, в реестр LOC-теста).
3. Виртуализация — переносим существующий механизм; НЕ пишем новый.

### F3 — Миграция data-table → database-call + Containment
1. `migrateDataTableWidget(widget, parentSource)` → database-call c
   `viewTabs:[{viewType:"table", config: mapTableConfig(...)}]`, sourceConfig = inherit.
   Идемпотентно; покрыто configProvenance-паттерном.
2. demoProject: «Список клиентов» → database-call (тест UT2026-D ловит расхождение).
3. WidgetHost: маршрут `data-table` → конвертер на лету (read-only render через
   database-call) + баннер «Convert permanently» (запись миграции в конфиг по клику).
4. Остальные 7 legacy-типов: placeholder «Deprecated widget» с CTA по fate-table
   (data-list/view-port → database-call tab; summary-row → stats; comparison/timeline/
   yaml-visualizer/sub-base-canvas → archive note). Импорты из `src/archive/` удаляются.
5. Включается инвариант **L1**: `R0_4_archiveContainment.test.ts` (0 импортов из archive)
   — закрывает #068 окончательно (падающий код больше не достижим).

## Порядок и ворота

F1 → F2 → F3, каждая фаза = отдельный коммит(ы) + 4 ворот + deploy-верификация по
MANUAL_TESTING_PIPELINE + ручной чек-лист (DnD/resize/inline-edit — API не видит).
F2 затрагивает ≥2 модулей UI+engine-границы — перед стартом сверить план с
backend-architect'ом, если появится write-path сложнее `updateRecord`.

## Definition of Done эпика

- [ ] WidgetHost ≤200, Shell ≤350, Actions ≤150, LOC-тест включён
- [ ] Inline edit / row actions / + new row / header menu в Table tab
- [ ] data-table мигрирует (авто-конверт + persist по подтверждению)
- [ ] demoProject не генерирует legacy-типы
- [ ] 0 импортов из src/archive вне archive (L1-тест зелёный)
- [ ] #068 закрыт: краш-поверхность удалена
- [ ] Selection Bus контракт не изменён (существующие suites зелёные без правок)
