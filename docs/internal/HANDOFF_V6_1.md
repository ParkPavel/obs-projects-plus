# Отчёт передачи контекста — V6.1 (2026-05-09)

## Состояние системы (финальный снимок)

| Метрика | Значение |
|---|---|
| Jest | **108 suites / 1721 tests PASS** |
| tsc | **0 errors** |
| PX-budget (src/) | **181 / 191** |
| `@ts-ignore` | **0** |

---

## Что закрыто за эту сессию

### R5-020 — Row interaction chrome ✅
**Проблема:** `GridRow.svelte` передавал `row-selected={selected}` в `GridCellGroup` — дефисное имя атрибута Svelte молча игнорирует как несуществующий prop. Выбранные строки не имели никакой визуальной индикации несмотря на то, что `BulkActionBar` корректно показывал счётчик.

**Правки:**
- `src/ui/views/Table/components/DataGrid/GridCellGroup.svelte` — добавлен `export let selected: boolean = false`; `aria-selected={selected || undefined}`; `class:selected`; CSS `color-mix(in srgb, var(--interactive-accent) 10%, transparent)` для выделенного фона (16% при ховере)
- `src/ui/views/Table/components/DataGrid/GridRow.svelte` — строка 129: `row-selected={selected}` → `{selected}`

---

### R5-012 — Replace Obsidian Properties pane ✅ (аудит, не новый код)
Обнаружено, что тикет уже реализован полностью в предыдущих сессиях:
- `replaceObsidianProperties: boolean` в `Preferences` schema (`src/settings/base/settings.ts:370`)
- Default `false` во всех версиях v1–v4
- Settings UI toggle (`src/ui/settings/settings.ts:239`)
- `maybeReplacePropertiesPane()` + `active-leaf-change` хук (`src/main.ts:350–404`)

Backlog обновлён, статус исправлен на ✅ DONE.

---

### R5-018 — Grid layout token sweep (px→rem) ✅
Конвертированы все hardcoded px значения в секциях "Imperative Popover Styles" и "Settings Tab Popover Styles" файла `styles.css`:

| Было | Стало |
|---|---|
| `border-radius: 8px` | `var(--ppp-radius-xl, 0.5rem)` |
| `font-size: 13px / 12px` | `var(--ppp-font-size-md/sm, ...)` |
| `gap: 6px / 8px` | `var(--ppp-space-3/4, ...)` |
| `padding: 6px 10px` | `var(--ppp-space-3, 0.375rem) 0.625rem` |
| `min-height: 28px` | `var(--ppp-button-height-sm, 1.75rem)` |
| `min-width: 180px / max-width: 320px` | `11.25rem / 20rem` |
| `box-shadow: 0 4px 16px / 0 8px 24px` | rem-эквиваленты |
| `outline: 2px solid` / `outline-offset: 2px` | `0.125rem` |
| `translateY(8px)` в keyframe | `translateY(0.5rem)` |

**Сохранены без изменений:** hairline `border: 1px solid` (spec-разрешение), `.sr-only` clip-idiom (`width: 1px; height: 1px; margin: -1px` — browser idiom, должен быть точно 1px).

---

### R5-004 — Footer aggregation count semantic ✅ (подтверждено закрытым)
Обнаружено в session-state: `migration.ts + migration.test.ts + v4/settings.ts` уже на месте, 36 тестов проходят. Тикет закрыт.

---

## Что НЕ тронуто (оставшиеся 181 px в src/)

Все 181 оставшихся вхождения в `src/` — это:
1. **Hairline `1px` borders** в 60+ компонентах — spec разрешает, примеры: `PipelineEditor.svelte` (17), `AgendaListEditor.svelte` (10)
2. **Динамические JS-pixel значения** в `TimelineView.svelte`: `top:{vr.top}px; left:{vr.left}px; width:{vr.width}px; height:{vr.height}px` — позиции из DOM-измерений, конвертировать невозможно
3. **Определения токенов** в `tokens.css` и `design-tokens.css`: `--ppp-border-width: 1px`, `--ppp-radius-full: 9999px` — canonical definitions

---

## Архитектурный контекст (для следующей сессии)

### Стек
- **Svelte 3.59.2** (заморожена — не апгрейдить)
- **TypeScript** strict + `exactOptionalPropertyTypes: true`
- **Jest 29**, **esbuild**
- Zero `@ts-ignore` invariant

### Ключевые файлы DataGrid (только что изменены)
```
src/ui/views/Table/components/DataGrid/
├── GridCellGroup.svelte   ← selected prop + CSS (R5-020)
├── GridRow.svelte         ← prop fix {selected} (R5-020)
├── GridCell.svelte        ← 3x 1px hairlines (не тронуто)
└── GridHeader/            ← не тронуто
```

### Слой настроек
```
settings/base/settings.ts         ← Preferences interface (replaceObsidianProperties здесь)
settings/v4/settings.ts           ← DEFAULT_SETTINGS
src/ui/settings/settings.ts       ← Settings tab UI (toggle на строке 239)
src/main.ts                        ← maybeReplacePropertiesPane() (строки 350–404)
```

### CSS-токены
```
src/ui/tokens/tokens.css          ← src/ canonical tokens (импортируется в main.ts)
src/lib/tokens/design-tokens.css  ← альтернативный токен-файл
styles.css (root)                 ← Obsidian-plugin глобальный CSS (НЕ в src/, не считается в PX-budget)
```

---

## Открытые задачи (приоритет)

| # | Тикет | Описание | Сложность | Статус |
|---|---|---|---|---|
| 1 | **NPLAN-D1** | RichText annotations — аннотации в ячейках | XL | BACKLOG |
| 2 | **R5-017** | Reconcile DESIGN_CONCEPT ticket refs с R5-* системой. Чисто документация. | XS | BACKLOG |

---

## Инварианты — никогда не нарушать

1. Dispatch по `DataFieldType`, никогда по `field.name`
2. Даты = 4 параметра: `startDate`, `startTime`, `endDate`, `endTime`
3. Board columns = derived от unique values выбранного поля
4. Pipeline: `applyFormulaFields` → `enrichFrameWithRelations` → display
5. Zero `@ts-ignore` в `src/`
6. PX-budget ratchet ≤ 191 (текущий: 181)
7. `filterEvaluator.ts` — единственный canonical filter engine
