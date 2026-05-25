# #022 — NEEDS-ANALYSIS: UnifiedFormulaConstructor

**Дата:** 2026-05-25
**Status:** analysis_done: true (готов к dev cycle / partial drift recovery)
**Sizing:** XL (на бумаге) — фактически **уже почти полностью реализован**. Остаток: XS (drift recovery) + опциональные S/M follow-ups.

> **Критическое открытие (semantic-analyzer, 2026-05-25):**
> Основной scope тикета #022 уже доставлен в код, но BACKLOG и CHANGELOG этого не отражают. Этот документ — одновременно NEEDS-ANALYSIS и documentation drift recovery.

---

## 0. Conflict map: BACKLOG vs реальность

| Aspect | BACKLOG.md (до этого doc sweep) | Код (2026-05-25) |
|---|---|---|
| #022 статус | `📋 BACKLOG`, `analysis_done: false` | Файлы кода содержат явные R5-022 markers о доставке |
| `FormulaVisualEditor.svelte` | "needs deletion scope analysis" | **Не существует в `src/`** (удалён) |
| Code/visual mode toggle | "needs to be removed" | Удалён (`FormulaBar.svelte:8` — комментарий "toggle was removed from FormulaBar too") |
| `FormulaConstructor` unified surface | Goal of #022 | **Создан** (`src/ui/components/FormulaConstructor/FormulaConstructor.svelte`, 368 LOC), используется и `FormulaBar`, и `FormulaEditor` |
| #002 Phase 2 (evaluateValue → lib/formula) | `⏸ DEFERRED`, блокер для #022 | **Сделан**: `formulaEngine.ts:1` header "thin re-export wrapper (R5-002 Phase 2)" |
| `FORMULA_CONSTRUCTOR_AUDIT_2026-05-08.md` | BACKLOG ссылается на этот файл | **Не существует** в `docs/` — устаревшая ссылка |

Evidence (цитаты из исходников):
- `FormulaEditor.svelte:8-9` — *"`enableVisualMode` prop and FormulaVisualEditor were removed (R5-022). The visual node-editor approach was rejected — code mode is the only surface."*
- `FormulaConstructor.svelte:3-4` — *"unified formula text editor … Extracted from FormulaBar.svelte (R5-022) to eliminate four diverging formula-input surfaces across the plugin."*
- `FormulaBar.svelte:7-9` — *"The code/visual mode toggle and FormulaVisualEditor were removed (R5-022)."*

---

## 1. Deletion scope

### Уже удалено (нет в `src/`)
- `src/ui/views/Dashboard/widgets/FormulaVisualEditor.svelte` — удалён
- `enableVisualMode` prop на `FormulaEditor` — удалён
- Code/visual mode toggle UI в `FormulaBar` — удалён

### Dead-code residue (210 LOC, кандидаты на archive)

| Файл | LOC | Статус | Кто импортирует |
|---|---|---|---|
| `src/ui/views/Dashboard/widgets/FormulaNode.svelte` | 130 | **DEAD** | Никто (grep подтверждён 2026-05-25) |
| `src/ui/views/Dashboard/engine/formulaSerializer.ts` | 78 | **DEAD transitively** | Только `FormulaNode.svelte` |
| **Итого dead code** | **208** | | |

Verification grep (2026-05-25):
- `FormulaNode\.svelte|import.*FormulaNode` — найдены только type-imports `FormulaNode` (тип из `src/lib/formula`, alive). Никаких import `.svelte`-компонента.
- `formulaSerializer|serializeNode|getFunctionCategory` — потребители только: `FormulaNode.svelte:8`, сам `formulaSerializer.ts`.

### Что остаётся (alive)
| Файл | LOC | Роль |
|---|---|---|
| `src/ui/components/FormulaConstructor/FormulaConstructor.svelte` | 368 | Unified surface, canonical |
| `src/ui/components/FormulaEditor/FormulaEditor.svelte` | 71 | Slot-wrapper над FormulaConstructor (header/footer/help slots). Потребитель: `YamlVisualizer.svelte` |
| `src/ui/views/Dashboard/widgets/FormulaBar.svelte` | 248 | Dashboard widget. Wrappит FormulaConstructor + field-name input, debounced preview (300 ms), debug panel, apply/cancel |

---

## 2. AST node system — текущее состояние

**Важное различение** ("replace AST node system" в формулировке тикета конфликтует двух понятий):

| Сущность | Локация | Статус | Не путать |
|---|---|---|---|
| `FormulaNode` (TS тип) | `src/lib/helpers/formulaParser.ts` | **ALIVE, essential** — канонический AST, produced by `parseFormula()`, consumed by `extendedEvaluator.ts` (115+ функций) + tests | НЕ трогать |
| `FormulaNode.svelte` (UI компонент) | `src/ui/views/Dashboard/widgets/FormulaNode.svelte` | **DEAD** — residual visualizer для AST, был телом `FormulaVisualEditor` | Archive |

AST как data model — остаётся. Visual node-editor над ней — был отвергнут (R5-022 решение).

---

## 3. AdvancedFilterEditor как baseline

`src/ui/views/Calendar/agenda/AdvancedFilterEditor.svelte` (773 LOC) — gold-standard для разных аспектов; сравнение:

| Aspect | AdvancedFilterEditor (baseline) | FormulaConstructor (current) | Действие |
|---|---|---|---|
| Suggestion catalog | Hardcoded `FUNCTION_CATALOG` + `SNIPPET_CATALOG` + `KEYWORD_ITEMS` (~75 items) с категориями, args hints, descriptions | `getFormulaFunctions()` + `fields[]`. Без snippets и descriptions в dropdown | **Gap** — добавить snippet catalog (опционально prop) |
| Signature popover | Через help-panel toggle | Live IntelliSense через `findEnclosingCall` + `getFormulaMetadata` | **FormulaConstructor superior** |
| Portal/positioning | `activeDocument.body.appendChild` + flip + clamp + blur backdrop + z-index 10001 | `position: absolute` в relative container. Может clip в SlideInPanel (~22 rem) | **Gap** — мигрировать на `FloatingPopup` |
| Keyboard | Arrow ↑↓, Tab, Enter, Esc, **Ctrl+Space** (force open) | Arrow ↑↓, Tab, Enter, Ctrl+Enter (commit), Esc. **Нет Ctrl+Space** | **Gap** — добавить Ctrl+Space |
| Empty-formula snippets | Показывает snippet catalog на focus при пустом | Нет empty-state suggestions | **Gap** (если решено добавить snippets) |
| Help toggle | Built-in `showHelp` + two-column reference | Нет help UI | По решению UX |
| Validation badge | "✓ valid" / "⚠ N errors" / "Ctrl+Space hint" | Errors list под textarea | Опционально |
| Encoding | UTF-8 mojibake (pre-existing bug) | Чистый | n/a |

### FormulaConstructor превосходит baseline в:
1. Live signature popover (`findEnclosingCall`, well unit-tested в `FormulaBar.kbd.test.ts`)
2. Канонический `getFormulaFunctions()` — нет drift risk
3. Svelte-idiomatic rendering (vs imperative `createElement` в AdvancedFilterEditor)
4. Чистая кодировка

---

## 4. Keyboard spec

### Текущий FormulaConstructor (`handleKeydown`, FormulaConstructor.svelte:150-194)

| Клавиша | Контекст | Действие |
|---|---|---|
| `Esc` | suggestions open | close suggestions, stopPropagation |
| `ArrowDown` | suggestions open | next item (wraps to 0 at end) |
| `ArrowUp` | suggestions open | previous item (wraps to end at 0) |
| `Enter` (без Ctrl) | suggestion highlighted | insert + close |
| `Tab` | suggestions open | insert highlighted (или index 0) + close |
| `Ctrl+Enter` | always | commit if `errors.length === 0 && value.trim()` |

### Recommended addition (для #022.3)

| Клавиша | Контекст | Действие |
|---|---|---|
| `Ctrl+Space` | always | force-open suggestion popover (даже если cursor word пуст или suggestions закрыты Esc) |
| `Tab` (no suggestions) | optional | insert 2 spaces (mimic AdvancedFilterEditor) — debatable |
| focus при empty | optional | показать snippet catalog (если решено добавить snippets) |

### Obsidian global hotkey конфликты
- Grep по hotkey-кодам — **никаких конфликтов** с Ctrl+Space (не используется Obsidian core в editor scope)
- Ctrl+Enter внутри `<textarea>` — local handler, command palette не intercept при focus on textarea
- **Safe to add Ctrl+Space**

---

## 5. Portal pattern

### Существующие реализации в codebase
| Компонент | Тип | Назначение |
|---|---|---|
| `FloatingPopup.svelte` | **CANONICAL** popup engine | Flip + clamp, focus trap, Esc/outside-mousedown close, mobile bottom-sheet, anchored via `triggerEl: HTMLElement`. Spec: `.ai_internal/New-specification/POPUP_PATTERN_GUIDE.md` (ticket #034.1) |
| `SlideInPanel.svelte` | Right-edge panel | Field/filter/CF settings (V6 / DG-3). Не для popup. |
| `SettingsMenuPopover.svelte`, `MultiTextInput.svelte`, `ViewToolbar.svelte` | Ad-hoc | `position: fixed` + `appendChild(body)` |
| `AdvancedFilterEditor.svelte` | Ad-hoc legacy | Imperative portal, mojibake-laden, не reusable |

### Рекомендация для #022.4
Suggestion dropdown FormulaConstructor должен мигрировать на **FloatingPopup** — canonical popup engine. Это:
1. Не нарушает инвариант "no parallel implementations"
2. Даёт flip+clamp+focus-trap бесплатно
3. Решает clipping в SlideInPanel (`22 rem` width)
4. Учитывает `activeDocument` (Obsidian popout-window support)

### Svelte 3.59.2 ограничения
- Нет native portal primitive
- Стандарт: `containerEl.appendChild(node); onDestroy => remove()` (используется в FloatingPopup)
- `activeDocument` (не `document`) обязателен для popout window support

---

## 6. Dependency #002 Phase 2

**Already complete** (несмотря на BACKLOG `⏸ DEFERRED`):
- `src/ui/views/Dashboard/engine/formulaEngine.ts` — 21-line re-export shell с явным header *"R5-002 Phase 2. Implementation moved to src/lib/formula/extendedEvaluator.ts"*
- `src/lib/formula/index.ts` — re-exports `evaluateFormulaValue`, `evaluateFormulaWithError`, `validateFormulaExpression`, `getFormulaFunctions`, `isStyledValue`
- Grep по `evaluateValue` — zero hits в `src/` (rename на `evaluateFormulaValue`/`evaluateFormulaWithError` уже произошёл)

**Не блокер.** BACKLOG entry нужно перевести в ✅ DONE.

---

## 7. Test impact

### Существующие suites, касающиеся формулы
- `src/lib/formula/__tests__/index.test.ts` — canonical re-exports
- `src/lib/helpers/formulaParser.test.ts`, `__tests__/formulaParser.test.ts` — parser + AST
- `src/lib/helpers/dateFormulaParser.test.ts` — date formulas
- `src/ui/views/Dashboard/engine/formulaEngine.test.ts` — evaluation API surface
- `src/ui/views/Dashboard/engine/__tests__/FormulaBar.kbd.test.ts` — unit-tests для `findEnclosingCall` (pure logic, не keyboard simulation)
- `src/ui/views/Dashboard/engine/__tests__/formulaMetadata.test.ts` — metadata registry
- `src/ui/views/Dashboard/__tests__/applyFormulaFields.test.ts` — pipeline integration
- `src/ui/views/Calendar/agenda/__tests__/operatorHelpers.stageA.test.ts` — Calendar agenda operators

### Test gap
**Нет JSDOM unit-теста для `FormulaConstructor.svelte`.** Рекомендуются (в #022.5):
- `src/ui/components/FormulaConstructor/__tests__/FormulaConstructor.dom.test.ts` — suggestion filtering, signature popover state machine
- `src/ui/components/FormulaConstructor/__tests__/FormulaConstructor.kbd.test.ts` — keyboard contract (включая Ctrl+Space когда добавлен)

### PX-budget
- Текущий ratchet: `≤ 191` (`R0_3_pxBudget.test.ts`) — note: CLAUDE.md OBSv1.0 говорит 186, но локальный плагин показывает 191
- `FormulaConstructor.svelte` — только `rem` и CSS vars (проверено в `<style>` block)
- Любой новый portal styling должен оставаться rem-only

### Baseline
135 suites / 2020 tests (после #045.3 merge `0f87c53`)

---

## 8. Sub-tickets decomposition (рекомендация)

Поскольку XL scope в основном доставлен, остаток разбивается на маленькие тикеты:

| ID | Subject | Sizing | Зависимости | Risk |
|---|---|---|---|---|
| **#022.1** | Documentation sweep | XS | — | Низкий |
| **#022.2** | Archive dead code (FormulaNode.svelte + formulaSerializer.ts → `.ai_internal/Archive/`) | XS | grep verified | Низкий, требует user OK на удаление per CLAUDE.md |
| **#022.3** | Add Ctrl+Space force-open + empty-state snippets (опционально) | S | — | Низкий, безопасно (нет hotkey conflicts) |
| **#022.4** | Migrate suggestion dropdown на FloatingPopup | M | — | Средний (затрагивает positioning, focus trap) |
| **#022.5** | JSDOM unit tests для FormulaConstructor | S | #022.3 (для тестов keyboard) | Низкий |
| **#022.6** | Migrate AdvancedFilterEditor.svelte → FormulaConstructor | M | #022.3, #022.4 | Средний (Calendar agenda regression risk, нужен manual QA) |

### Если sub-tickets не желаемы
Слить #022.3 + #022.4 + #022.5 в один S/M тикет.

---

## 9. Open questions

1. **R5-022 unification accepted?** Код говорит yes (explicit comments), BACKLOG say no. Resolved: drift recovery doc sweep подтверждает yes.
2. **Archive `FormulaNode.svelte` + `formulaSerializer.ts` (208 LOC)?** Per CLAUDE.md OBSv1.0 — не удалять, перемещать в `.ai_internal/Archive/` с префиксом `OLD-`. Требует подтверждения пользователя.
3. **Мигрировать `AdvancedFilterEditor.svelte` на FormulaConstructor?** UTF-8 mojibake + parallel implementation + противоречит "eliminate divergent surfaces" goal. Medium effort, high value.
4. **Ctrl+Space?** Non-conflicting, рекомендовано. UX decision.
5. **Portal-ize suggestions?** Нужно если FormulaConstructor работает в SlideInPanel (22 rem width). Visual QA подтвердит clipping.
6. **Snippet catalog source:** built-in defaults или prop per-surface? Architectural call.
7. **#002 Phase 2 status reconciliation:** обновляем BACKLOG на ✅ DONE — да.

---

## 10. Existing audit assessment

**`docs/internal/FORMULA_CONSTRUCTOR_AUDIT_2026-05-08.md` не существует.** Searched whole `docs/` tree — файл отсутствует. Возможные причины:
- Был archive/renamed
- Planning placeholder, никогда не создавался
- BACKLOG ссылается на stale path

**Рекомендация:** этот документ становится primary source of truth для #022. Удалить ссылку на отсутствующий audit из BACKLOG.md line 226.

---

## Data flow

```
src/lib/helpers/formulaParser.ts         ──┐
  parseFormula → FormulaNode (TYPE)        │
  validateFormula                          │
                                           │
src/lib/formula/extendedEvaluator.ts      ─┤
  evaluateFormulaValue                     ├──► src/lib/formula/index.ts
  evaluateFormulaWithError                 │     (canonical re-export)
  validateFormulaExpression                │
  getFormulaFunctions                      │
                                           │
src/lib/helpers/dateFormulaParser.ts      ─┘

                                                      │
                                                      ▼
src/ui/views/Dashboard/engine/formulaEngine.ts  (R5-002 Phase 2 re-export shell)
src/ui/views/Dashboard/engine/formulaMetadata.ts  (signature/IntelliSense data + findEnclosingCall)

                                                      │
                                                      ▼
src/ui/components/FormulaConstructor/FormulaConstructor.svelte   ◄── UNIFIED SURFACE
              ▲                ▲
              │                └─── src/ui/components/FormulaEditor/FormulaEditor.svelte
              │                          ▲
              │                          └─── src/ui/views/YamlVisualizer/YamlVisualizer.svelte
              │
              └─── src/ui/views/Dashboard/widgets/FormulaBar.svelte
                        ▲
                        └─── PipelineEditor / DashboardCanvas

[DEAD]  src/ui/views/Dashboard/widgets/FormulaNode.svelte  (no consumers)
[DEAD]  src/ui/views/Dashboard/engine/formulaSerializer.ts  (only consumed by FormulaNode.svelte)

[PARALLEL]  src/ui/views/Calendar/agenda/AdvancedFilterEditor.svelte
              ▲
              └── (still re-implements its own formula editor — divergent surface)
```

---

## Module impact (full scope если все sub-tickets выполнены)

- `src/ui/components/FormulaConstructor` (#022.3, #022.4, #022.5)
- `src/ui/views/Dashboard/widgets` (#022.2 archive)
- `src/ui/views/Dashboard/engine` (#022.2 archive)
- `src/ui/views/Calendar/agenda` (#022.6 optional)

**4 модуля, 6–9 файлов** в зависимости от выбора sub-tickets.

---

## Recommendation

1. **Этап 1 (этот PR):** doc sweep — закрыть drift в BACKLOG/CHANGELOG, зафиксировать NEEDS-ANALYSIS, перевести #022 и #002 Phase 2 на ✅ DONE.
2. **Этап 2 (следующий PR):** archive dead code (#022.2) — после явного user OK.
3. **Этап 3 (опциональные PR):** UX-улучшения #022.3/4/5/6 по приоритету user.

Implementation, выходящая за doc sweep, требует **frontend-architect ревью** перед dev cycle (multi-module + portal architecture decision).
