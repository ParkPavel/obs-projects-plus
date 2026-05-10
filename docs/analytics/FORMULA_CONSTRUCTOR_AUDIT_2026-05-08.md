# Formula Constructor — Documentation Audit

> **Дата**: 2026-05-08  
> **Статус**: ЗАВЕРШЁН  
> **Назначение**: проверка корректности документального понимания об устройстве и методах внедрения конструктора формул перед началом работ.  
> **Вывод**: документация содержит **4 критических пропасти** и **1 прямую ошибку** → создан тикет R5-022.

---

## Резюме (TL;DR)

| Аспект | До аудита | После аудита |
|---|---|---|
| Задокументированных UI-поверхностей формул | 1 (FormulaEditor — упоминается) | **4 поверхности** (FormulaEditor, FormulaBar, AdvancedFilterEditor, DateFormulaInput) |
| Эталонный компонент для унификации | Не определён | **AdvancedFilterEditor.svelte** (самый полный) |
| Нодовая система в коде | Не задокументирована | **FormulaVisualEditor.svelte** — существует, AST-based, подлежит замене |
| R5-002 покрывает UI? | Подразумевалось | **Нет** — только engine-level imports |
| Новый тикет | — | **R5-022** — UnifiedFormulaConstructor |

---

## 1. Что говорит документация (до аудита)

### 1.1 REFACTOR_BACKLOG_V5.md

**R5-002** — "Unify formula stack":
- Phase 1 ✅ DONE: canonical imports migrated
- Phase 2 DEFERRED: move `evaluateValue` to `lib/formula/index.ts`
- **Не упоминает**: UI унификацию, FormulaVisualEditor, AdvancedFilterEditor, FormulaEditor stages

SESSION_REPROMPT §3 перечисляет R5-002 Phase 2 как engine-задачу (`formulaEngine.ts` → thin wrapper). Никакого упоминания UI.

### 1.2 IMAGE_PROMPTS_SCHEMA_VISUALS.md

- Изначально содержал **PRESET E** с node-based visual editor (ошибка)
- **Исправлено** в аналитической сессии 2026-05-08: заменён на анатомический промпт

### 1.3 ANALYTICAL_REVIEW_2026-05-08.md

§3.3 упоминает "formula UI fragmentation" как gap, но **не даёт**: эталонный компонент, список файлов, план конкретного тикета.

### 1.4 UX_FLOW_MAIN_SCENARIO.md

Шаг 3 (живые вычисления) упоминает `sum()` и `extendedEvaluator.ts` — только engine. UI конструктора не охвачен.

---

## 2. Что реально содержит код (по результатам аудита)

### 2.1 Четыре расходящихся UI-поверхности

| Компонент | Путь | Полнота | Роль сейчас |
|---|---|---|---|
| `FormulaEditor.svelte` | `src/ui/components/FormulaEditor/` | **Stage 1** (скелет) | Bare textarea + slots + validate callback. Комментарий явно говорит: "Stage 1 deliberately omits autocomplete + signature popover + engine adapter; those land in Stage 3" |
| `FormulaBar.svelte` | `src/ui/views/Dashboard/widgets/` | Средняя | Autocomplete (startsWith), signature popover via `findEnclosingCall()`, code/visual mode toggle, `FormulaVisualEditor` + `FormulaDebugPanel` |
| `AdvancedFilterEditor.svelte` | `src/ui/views/Calendar/agenda/` | **Наиболее полная** | Google Sheets-style autocomplete, 4 типа items (function/field/snippet/keyword), категории, сниппеты, real-time validation, help panel, DOM portaling |
| `DateFormulaInput.svelte` | `src/ui/views/Calendar/agenda/` | Специализированная | Только date formulas, grouped suggestions, live preview, flip positioning |

### 2.2 FormulaVisualEditor.svelte — существующая нодовая система

**Файл**: `src/ui/views/Dashboard/widgets/FormulaVisualEditor.svelte`

Это **AST-based визуальный редактор** с нодами. Уже существует в коде:
```typescript
// AST node system:
parseFormula(expression) → FNode AST
serializeNode(node) → string expression
insertFunction(fnName) → вставляет по paletteInsertPath или оборачивает существующий
insertAtPath(ast, path, newNode) → immutable AST update
// showPalette, paletteInsertPath: number[] | null, editingLiteral
```

**Вердикт**: Пользователь сказал "нодовую систему не внедряем". `FormulaVisualEditor.svelte` — **это и есть нодовая система**. Подлежит замене. В документации отсутствует как проблема.

### 2.3 AdvancedFilterEditor.svelte — эталон для R5-022

Реализует паттерн наиболее близкий к Notion:
```typescript
interface AcItem {
  label: string;
  insert: string;
  kind: 'function' | 'field' | 'keyword' | 'snippet';
  args?: string;
  desc: string;
  category?: string;
}

// buildAcItems(query) → function list + field list + snippets + keywords (max 20)
// renderAcPopover() → imperative DOM portal к activeDocument.body (обходит overflow)
// backdrop-filter: blur(0.75rem) + translucent фон
// Ctrl+Space принудительный вызов; Tab/Enter вставка; Esc закрытие
```

**Это эталон** для `UnifiedFormulaConstructor`. Не calendar-specific по логике — только по размещению.

### 2.4 formulaMetadata.ts — задокументированный ноль

**Файл**: `src/ui/views/Dashboard/engine/formulaMetadata.ts`

Полный статический реестр:
```typescript
export interface FormulaMetadata {
  readonly name: string;
  readonly signature: string;    // ← для signature popover
  readonly returnType: string;   // ← для type inference hints
  readonly doc: string;          // ← для help panel
  readonly category: FormulaCategory;  // logical|math|string|date|financial|statistical|array|conversion|utility
}
// 9 категорий × 115+ функций
// findEnclosingCall(expression, cursorPos): string | undefined  ← уже реализован
```

**В документации**: ноль ссылок. `formulaMetadata.ts` нигде не упомянут как источник данных для help panel.

### 2.5 suggestionCollector.ts — задокументированный ноль

**Файл**: `src/ui/views/Calendar/agenda/suggestionCollector.ts`

```typescript
collectFieldSuggestions(records, fieldName, fieldType): string[]  // min 2 уникальных значения
collectAllFieldSuggestions(records, fields): Record<string, string[]>
getSuggestionsForField(records, field): string[]  // использует typeConfig.options если есть
```

Собирает **реальные значения полей из записей** для autocomplete field-value подсказок. Не упомянут нигде в планировании формул.

### 2.6 findEnclosingCall() — переиспользуемый, но не задокументированный

Функция уже реализована в `formulaMetadata.ts` и используется в `FormulaBar.svelte` для signature hint popover. Это готовый строительный блок для `UnifiedFormulaConstructor` — но не задокументирован как таковой.

### 2.7 FormulaDebugPanel.svelte

`src/ui/views/Dashboard/widgets/FormulaDebugPanel.svelte` — отдельный error panel с clipboard copy, dismiss button, keyboard handler. Переиспользуемый элемент, не упомянут в планировании.

---

## 3. Разрыв между документацией и кодом: матрица

| Аспект | Документация говорит | Реальность в коде | Тип разрыва |
|---|---|---|---|
| Нодовый редактор | Не существует / не планируется | `FormulaVisualEditor.svelte` — AST-based СУЩЕСТВУЕТ | 🔴 Ошибочное умолчание |
| FormulaEditor Stage | "есть FormulaEditor" | Stage 1 скелет, stages 2-3 запланированы в комментарии, не в backlog | 🟠 Неполнота |
| Эталонный компонент | Не определён | `AdvancedFilterEditor.svelte` — наиболее полный | 🟠 Пропасть |
| formulaMetadata.ts | Не упомянут | 115+ функций, полные signature + doc + category | 🔴 Пропасть |
| suggestionCollector.ts | Не упомянут | Готов к переиспользованию | 🟡 Пропасть |
| findEnclosingCall() | Не упомянут | Работает в FormulaBar | 🟡 Пропасть |
| R5-002 охватывает UI? | Подразумевалось | Только engine imports | 🟠 Неполнота |
| Единый компонент | Нет тикета | Нет реализации | 🔴 Пропасть — создан R5-022 |

---

## 4. Сравнение с Notion (по коду, не по предположениям)

| Функция | OBS (реально) | Notion |
|---|---|---|
| Autocomplete popover | ✅ реализован в AdvancedFilterEditor (Google Sheets-style) | ✅ аналогично |
| Ghost arg hint у курсора | 🔄 статичный `(args)` в строке dropdown (не inline ghost text) | ✅ inline серый текст прямо в textarea |
| Signature popover при наборе | ✅ `findEnclosingCall()` в FormulaBar | ✅ аналогично |
| Help/doc панель | ❌ нет в компоненте (данные есть в formulaMetadata.ts) | ✅ expandable правая панель |
| Sidebar полей БД | ❌ нет отдельного sidebar | ✅ кликабельный список полей |
| Live preview результата | ✅ частично в DateFormulaInput; ✅ в FormulaBar через previewRecord | ✅ любое выражение |
| Категории функций | ✅ `FormulaCategory` в metadata (9 категорий) — не показаны в UI | ✅ в dropdown |
| Сниппеты | ✅ в AdvancedFilterEditor | ✅ |
| Keyboard nav (↑↓ Tab Esc) | ✅ в AdvancedFilterEditor | ✅ |
| Нодовый редактор | ❌ FormulaVisualEditor (к замене) | ❌ нет у Notion тоже |

**Ключевой вывод**: разрыв с Notion — не в функциональности (она почти есть), а в **рассредоточении** по 4 несвязанным компонентам и отсутствии help panel.

---

## 5. Рекомендации: что нужно исправить

### 5.1 Новый тикет R5-022 — UnifiedFormulaConstructor

**Создан в REFACTOR_BACKLOG_V5.md** (см. §11).

Суть: взять `AdvancedFilterEditor` как основу, вынести в `src/ui/components/FormulaConstructor/`, заменить им `FormulaBar.svelte`'s visual mode, `FormulaEditor.svelte` Stage 1, и в конечном итоге `DateFormulaInput` (для date-specific формул через `mode="date"`).

`FormulaVisualEditor.svelte` — **удалить** (нодовая система, не соответствует концепции).

### 5.2 SESSION_REPROMPT — добавить раздел

В SESSION_REPROMPT §3 добавлен пункт R5-022 (P2, после R5-016 и R5-010).

### 5.3 Что документация описывает **верно**

- R5-002 Phase 2 (engine: `evaluateValue` move) — правильно описан, нужно делать независимо
- `extendedEvaluator.ts` как реальный движок — верно
- 115+ функций как преимущество — верно (подтверждено `formulaMetadata.ts`)
- Anatomy image prompt (PRESET E заменён) — правильно отражает реальную архитектуру

---

## 6. Верифицированные файлы (прочитано в ходе аудита)

| Файл | Размер | Что проверялось |
|---|---|---|
| `src/ui/components/FormulaEditor/FormulaEditor.svelte` | ~80 LOC | Stage 1, slots, props |
| `src/ui/views/Dashboard/widgets/FormulaBar.svelte` | ~300 LOC | autocomplete, signature popover, mode toggle |
| `src/ui/views/Dashboard/widgets/FormulaVisualEditor.svelte` | ~250 LOC | AST node system (to replace) |
| `src/ui/views/Dashboard/widgets/FormulaDebugPanel.svelte` | ~60 LOC | error UI, reusable |
| `src/ui/views/Dashboard/engine/formulaMetadata.ts` | ~700 LOC | 115+ functions, 9 categories, findEnclosingCall |
| `src/ui/views/Calendar/agenda/AdvancedFilterEditor.svelte` | ~450 LOC | gold-standard autocomplete, portal pattern |
| `src/ui/views/Calendar/agenda/DateFormulaInput.svelte` | ~200 LOC | date-specific, live preview, portal |
| `src/ui/views/Calendar/agenda/suggestionCollector.ts` | ~100 LOC | field value collection |

---

## 7. Связанные документы

- [`REFACTOR_BACKLOG_V5.md §11`](../internal/REFACTOR_BACKLOG_V5.md) — R5-022 тикет
- [`SESSION_REPROMPT.md`](../internal/SESSION_REPROMPT.md) — обновлён: добавлен R5-022 в §3
- [`IMAGE_PROMPTS_SCHEMA_VISUALS.md`](IMAGE_PROMPTS_SCHEMA_VISUALS.md) — Formula Builder Anatomy (исправлен в этой сессии)
- [`ANALYTICAL_REVIEW_2026-05-08.md §3.3`](ANALYTICAL_REVIEW_2026-05-08.md) — первичное обнаружение фрагментации
