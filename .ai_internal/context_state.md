# Context State — obs-projects-plus

## Текущее состояние
- **Версия**: 3.2.2 (tag: 3.2.2, HEAD: main)
- **Дата релиза**: 2026-04-10
- **Тесты**: 23 suite, 457 tests, все PASS
- **Ошибки компиляции**: 0
- **Git**: clean, no uncommitted changes

## v3.3.0 — Database View (в разработке)
- **Статус**: Спецификация DRAFT v1.2 — три документа, аудит пройден, согласование завершено
- **Основной документ**: `docs/architecture-database-view.md` (DRAFT v1.2, 2026-04-12)
  - Все C1-C7 критических и M1-M9 средних проблем устранены
  - Новый §20: Obsidian Community Guidelines Compliance (14 пунктов, все ✅ кроме 1 ⚠️ minAppVersion)
  - Единый 5-фазный план: все фазы v3.3.x (Phase 5 = backlog v3.3.0-rc)
  - ColumnAggregation (footer) vs AggregationFunction (pipeline) — naming resolved
  - TransformPipeline работает на Enriched DataFrame, интегрирован в pipeline diagram §2.2
- **UI/UX спецификация**: `docs/database-view-ui-ux.md` (DRAFT v1.1, 2026-04-12)
  - M10: Убрана дублирующая кнопка collapse в Widget Header
  - FormulaBar visual mode: v3.3.x-post (не v3.4.0+)
  - L2: Cross-reference на pivot §6.1-6.2 для Transform Pipeline Editor
- **Pivot/Transform спецификация**: `docs/database-view-pivot.md` (DRAFT v1.1, 2026-04-12)
  - M8: validatePipelineOrder() добавлен в executor §5.2
  - Regex safety §9.3: добавлен запрет lookbehind (iOS compatibility)
  - DateGrouping.outputField: convention `${field}_${granularity}`
  - Phase 4: v3.3.x-post (не v3.4.0+)
- **Бэкап старого черновика**: `docs/architecture-database-view.OLD.md`
- **Аудит**: `docs/audit-database-view-specs.md` — 21 issue → все resolved
- **Obsidian compliance**: verified, 14/14 пункты checked
- **Реализация**: ожидает старта Phase 1 (Foundation)

## История версий
- v3.2.1 — bugfix: touchcancel ViewSwitcher, popover CSS, agenda date selector
- v3.2.0 — Drag & Drop 2.0
- v3.1.0 — deep mobile adaptation, DnD handle engine, calendar UX
- v3.0.10 — mobile feature parity
- v3.0.9 — unified filters, instant mode fix
- v3.0.8 — Board UX (persist, zoom, collapse)

---

## ObsidianReviewBot — Required (PR #10259, scan e8ba16c, 2026-04-09)

### BOT-1/2: `@typescript-eslint/no-explicit-any`
**Статус**: ✅ DONE — все eslint-disable имеют `-- reason`. Оставшиеся `any` — в type conversion matrix (CreateField.svelte) и YAML/frontmatter обработке, где `unknown` не применим.

### BOT-3: `events.ts:30` — Async arrow function has no 'await'
**Статус**: ✅ DONE — убрали `async` у inner callback, обновили тип `withDataSource` callback.

### BOT-4: `TouchDndCoordinator.ts:132-136` — Direct `element.style.*`
**Статус**: ✅ DONE — заменены 5 inline styles на CSS-класс `.ppp-drag-feedback`.

### BOT-5: `TimelineDragManager.ts:1341,1351,1378` — Direct `element.style.*`
**Статус**: ✅ DONE — заменены `style.display`/`style.pointerEvents` на `.ppp-hit-test-hidden`/`.ppp-hit-test-active` CSS-классы.

### BOT-6: `TimelineDragManager.ts:1425` — Unnecessary type assertion
**Статус**: ✅ DONE — `s!.record.id` → `s.record.id` (TS narrowing через `s?.thresholdCrossed && s?.record`).

### BOT-7: `filterEngine.ts:353` — Invalid operand for '+' (Got `never`)
**Статус**: ✅ DONE — промежуточная переменная `const unknownFilter: { operator: string } = filter as never`.

### BOT-8: `helpers.ts:138,147` — Unhandled promises
**Статус**: ✅ DONE — добавлен `void` оператор перед `openLinkText()`.

### BOT-9: eslint-disable comments без обоснования
**Статус**: ✅ DONE — Weekday.svelte + CreateField.svelte — добавлены `-- reason`.

---

## Внутренний аудит v3.2.1 — Результаты (2026-04-10)

### P0 — Критические (2) — ✅ DONE
1. `DataFrameProvider.svelte:48` — `JSON.parse(text)` обёрнут в try-catch, fallback: `{ ...project, views: [] }`
2. `CreateField.svelte:238,332` — `JSON.parse(listValue)` заменён на `safeParseList()` с try-catch

### P1 — Серьёзные (6) — ✅ DONE (все проверены)
3. `filterEngine.ts:246` — ReDoS: ✅ УЖЕ ЗАЩИЩЁН (200 char limit + 10K slice + try-catch)
4. `dataview/standardize.ts:23` — ✅ DONE — `value.map(...)` результат теперь присваивается в `res[field]`
5. `CreationPreview.svelte:22-23` — ✅ ЛОЖНЫЙ ALARM — все `$:` корректны, `let` только для local state
6. `EditNote.svelte:41` — ✅ ЛОЖНЫЙ ALARM — `startEditTitle()` синхронизирует `editedTitle` перед показом
7. `filterFunctions.ts` `contains/not-contains/has-keyword` — ✅ DONE — сделаны case-insensitive (консистентно с filterEngine)
8. `formulaParser.ts` vs `filterEngine.ts` — ✅ КОНСИСТЕНТНО — оба locale-aware через dayjs

### P2 — Предупреждения (5) — ✅ DONE (что релевантно)
9. `filesystem.ts:116,127,138,149` — ✅ DONE — `void callback()` → `.catch(console.error)`
10. `main.ts:160` — ✅ DONE — `void createNote()` → `.catch(console.error)`
11. `CreateField.svelte:238` — ✅ DONE (в рамках P0)
12. `formulaParser.ts:653,660` — ✅ DONE — `evaluate() as T` → `Number(evaluate())` / `String(evaluate()) as T`
13. Тестовое покрытие: formulaParser, filterFunctions — ✅ DONE (82 новых теста: tokenizer, parser, evaluator, validator, string/number/boolean/list/date operators)

### P3 — Наблюдения (7) — закрыто
- has-keyword — ✅ починено в рамках P1#7 (case-insensitive)
- validation.ts `any` — все с eslint-disable + reason
- bundle size (1.8mb) — информационно, не блокирует
- tsconfig deprecation — IDE-only (VS Code TS 6.x), tsc 5.7.2 OK с `"5.0"`

---

## Изменённые файлы (сессия 2026-04-10)

| Файл | Изменение |
|------|-----------|
| `src/events.ts` | BOT-3: убран async у inner callback, обновлён тип withDataSource |
| `src/ui/views/Calendar/agenda/filterEngine.ts` | BOT-7: fix never operand в default branch |
| `src/ui/views/helpers.ts` | BOT-8: void перед openLinkText() x2 |
| `src/ui/views/Calendar/dnd/TimelineDragManager.ts` | BOT-5,6: CSS-классы + убран s! assertion |
| `src/ui/views/Calendar/agenda/TouchDndCoordinator.ts` | BOT-4: CSS-класс .ppp-drag-feedback |
| `src/ui/tokens/tokens.css` | Новые CSS-классы: .ppp-drag-feedback, .ppp-hit-test-hidden, .ppp-hit-test-active |
| `src/lib/datasources/dataview/standardize.ts` | P1: value.map() result assigned to res[field] |
| `src/ui/app/DataFrameProvider.svelte` | P0: JSON.parse try-catch |
| `src/ui/modals/components/CreateField.svelte` | P0: safeParseList() + eslint-disable reason |
| `src/ui/views/Calendar/components/Calendar/Weekday.svelte` | BOT-9: eslint-disable reason |
| `src/ui/app/filterFunctions.ts` | P1#7: contains/not-contains/has-keyword → case-insensitive |
| `src/lib/filesystem/obsidian/filesystem.ts` | P2.1: void callback → .catch(console.error) x4 |
| `src/main.ts` | P2.2: void createNote → .catch(console.error) |
| `src/lib/helpers/formulaParser.ts` | P2.4: DATE_ADD/DATE_SUB type assertions → Number()/String() |
| `src/lib/helpers/formulaParser.test.ts` | NEW: 56 тестов — tokenize, parse, evaluate (logic, string, date, array, arithmetic), validate |
| `src/ui/app/filterFunctions.test.ts` | NEW: 26 тестов — base/string/number/boolean/list operators, matchesCondition, matchesFilterConditions |
| `.vscode/settings.json` | NEW: typescript.tsdk → project TS |
