# Session Handoff — 2026-04-22 (Architectural Reset)

## Активная директива
"LEAD PRODUCT ARCHITECT & INTEGRATIVE PROMPT MANAGER" — 6-pillar архитектурный ресет Database View: Notion-уровень UX при No-Trace (YAML/MD only) + Offline-First.

## Discovery аудит — ground truth (Explore subagent)
| Pillar | Директива | Статус |
|--------|-----------|--------|
| 1. Data Flow over Folders | нет физических папок CRM/Finance/Fitness | **FIXED** |
| 2. Interface Reclamation | каждая cog → рабочая модалка | PARTIAL (6/7 + паритет) |
| 3. Table Stability | Strict Grid + JSON persist | FAIL |
| 4. Formula Bar IntelliSense | autocomplete + debug UI | PARTIAL |
| 5. Nested Arrays / FLATTEN | UNNEST + correlation | PARTIAL (нет multi-dataset join) |
| 6. Matryoshka / Zero Pixels | @container, rem, 1px | FAIL |

## Phase 1 DONE — DATA FLOW OVER FOLDERS
- `src/ui/app/onboarding/demoProject.ts`: `writeDemoFiles(vault, ${demoFolder}/Fitness, ...)` → `writeDemoFiles(vault, demoFolder, ...)` для всех 3 вертикалей. Комментарии обновлены под принцип "Проекты — это Запросы".
- `src/ui/app/onboarding/demoVerticals.ts`: header-комментарий приведён в соответствие.
- View-level фильтры (`type == "workout"/"transaction"/"client"`) уже были корректными — сегрегация работает через метаданные, не через физическую структуру папок.
- Верификация: svelte-check 0/0, jest 44/849 PASS, build PASS.

## Phases 2–6 TODO (приоритетно для следующих сессий)

### Phase 2: INTERFACE RECLAMATION паритет (S-M)
- `initViewPortConfig` + `ViewPortConfig.svelte` (единственный widget без cog)
- Фича-паритет: filter-controls в Stats/Checklist/FilterTabs, aggregation в Comparison
- Визуальный аудит с пользовательскими скриншотами

### Phase 3: TABLE STRICT GRID (M-L)
- Найти/создать `DataGrid.svelte`; перевести column layout на `display: grid; grid-template-columns: repeat(N, minmax(col.width-rem, 1fr))`
- Pointer-based resize handle на column divider; persistence по `pointerup` → `config.table.fieldConfig[col].width` в rem
- DnD reorder колонок с persistence в `config.table.orderFields`

### Phase 4: FORMULA BAR polish (S)
- Проверить/дополнить kbd nav (ArrowUp/Down/Enter) в `FormulaBar.svelte`
- `.ppp-formula-debug` inline-панель: локализованное сообщение об ошибке parse/eval + позиция курсора; скрывать по Esc

### Phase 5: CORRELATION FLOWS — multi-dataset scatter (L)
- Новый pipeline-шаг `join` в `transformExecutor.ts`: `{type:"join", rightSource, on, aggregation}`
- `ChartConfig.scatterConfig.rightDataSource?: DataSource`; `computeScatterData` делает inner-join по date/key перед построением (X,Y)
- UI в `ChartConfig.svelte` для выбора второго источника + ключа

### Phase 6: ZERO PIXELS / MATRYOSHKA (M, cross-cutting)
- `@media (max-width|max-height|orientation)` → `@container` где компонент в widget-shell; в глобальных shell — rem-based breakpoints через CSS custom properties
- `\b[0-9]+px\b` (кроме `1px` borders, `0`) → rem / design-tokens

### Phase 7: release wrap
- CHANGELOG под v3.5.0 (architectural modernization)
- context_state + bug-tracker записи
- auditor перед final verification

## Правила продолжения
- Каждая Phase: обязательный build + jest + svelte-check перед переходом
- **Не коммитить** до подтверждения: рабочее дерево грязное, только явный список
- Делегировать: `architect` для impact Phase 3/5, `auditor` после Phase 6

---

## Previous release context (archived)
v3.4.1 Board/shared DnD hotfix был опубликован 2026-04-21. Подробности см. в `.ai_internal/context_state.md`.