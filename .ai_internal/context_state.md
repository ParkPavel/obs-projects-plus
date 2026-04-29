# Context State — obs-projects-plus

## Текущее состояние
- **UPDATE 2026-04-23 — Post-audit Round 2 (v3.4.1 WIP): MEDIUM polish + P2/P3 backlog clear**: продолжение доработок после первого раунда аудита. Все оставшиеся пункты из backlog `auditor`-а закрыты. (1) **P2 #6 UX relabel correlation fields**: в `src/ui/views/Database/widgets/Chart/ChartConfig.svelte` labels "Right source/Left key/Right key" → "Right source (Y)/Left join key (this source)/Right join key (right source)" с explanatory note `.correlate-hint` "Y values come from the matched row in the right source. Matching uses date day-granularity." Устраняет непрозрачность семантики X/Y при correlation. (2) **P3 #8 correlation diagnostics**: engine `src/ui/views/Database/engine/chartDataPipeline.ts::computeScatterData` заполняет новый optional `correlationStats: {leftCount, rightCount, matched}` в `ScatterData` (types.ts расширен) во всех 3 return points; `src/ui/views/Database/widgets/Chart/ChartWidget.svelte` рассчитывает 3 kinds warnings: `missing-right` (correlation enabled но правый фрейм не подгружен), `no-matches` (0 matched rows), `mostly-unmatched` (matched < leftCount*0.1). Warning-banner встаёт на месте empty-state для первых двух и inline над ScatterChart для третьего; новый CSS `.ppp-chart-correlation-warning` + `--inline` variant. Устраняет silent empty chart при typo в rightKey или stale resolver cache. (3) **MEDIUM aria-describedby**: no-sources hints в `PipelineEditor.svelte` (JoinStep) и `ChartConfig.svelte` (scatter correlation) получили `id="ppp-join-no-sources-hint-{i}"` / `id="ppp-scatter-no-sources-hint"` + `role="note"`, соответствующие controls получили `aria-describedby` — screen readers теперь читают hint при focus на disabled checkbox/select. (4) **MEDIUM dangling rightSourceId cleanup**: новый pure helper `src/lib/helpers/removeDanglingSourceReferences.ts` walks projects→views→config.widgets, strip-ит JoinStep с `rightSourceId === removedId` и chart correlation с тем же id; tolerant structural checks (`isJoinStep`, `sanitizeWidget`), immutable copies, unknown widget shapes pass through. Integrated в `src/lib/stores/settings.ts::deleteProject` — после filter projects вызывается `removeDanglingSourceReferences(draft.projects, projectId)`. Устраняет persistent "right source unavailable" warnings после удаления sibling-проекта. (5) **Unit tests**: `src/lib/helpers/__tests__/removeDanglingSourceReferences.test.ts` (7 кейсов: empty removedId, no dangling refs, join strip, correlation strip, correlation-to-other-project preserved, multiple projects/views, tolerant to widgets без transform/config). TS bracket-notation fix: `view.config["widgets"]` вместо `.widgets` из-за index signature. (6) **i18n**: `views.database.chart.scatter.{correlate-hint,warn-missing-right,warn-no-matches,warn-mostly-unmatched}` + relabeled existing `right-source/left-key/right-key` во всех 4 локалях (en/ru/uk/zh-CN). **Quality gate**: tsc **0**, svelte-check **0/0**, jest **54 suites / 923 tests PASS** (+1 suite, +7 tests vs Round 1 baseline 53/916), production build **PASS** (exit=0, 1 pre-existing a11y warning от third-party `obsidian-svelte/IconButton`, off-scope). Плагин остаётся WIP на 3.4.1. Весь backlog аудита v3.5.0 закрыт. NO COMMIT.
- **UPDATE 2026-04-23 — Release v3.5.0 ОТКАТ + Post-audit polish (v3.4.1 WIP)**: по директиве пользователя ("пуш еще не готов, все это работа над версией только в рамках 3.4... Плагин все еще крайне не готов к публичному выпуску") откатил Phase 7 release-bump: (a) `package.json`/`manifest.json`/`versions.json` возвращены на `3.4.1`; (b) секция `[3.5.0] 2026-04-23 — Architectural Reset` удалена из `CHANGELOG.md`; (c) `releases/v3.5.0/` snapshot удалён. Работа Phase 5 UI + 6 + 4 остаётся в коде как WIP под маркой 3.4.1. Далее по результатам аудита `auditor` применены все оставшиеся P1/P2/P3 фиксы: (1) **P1 #1 vault-event invalidation → rightFramesStore**: создан `src/lib/stores/externalFrameInvalidation.ts` (writable<number> tick + `bumpExternalFrameInvalidation()`); `App.svelte.invalidateExternalFrameCache()` теперь бампит tick после clear(); `DatabaseViewCanvas.svelte` preloader получил `lastInvalidationTick` + `$externalFrameInvalidation` как reactive dep — re-runs preload pass для current `referencedIds` не только при смене id-set, но и при vault modify/create/delete/rename + settings.projects mutations. (2) **P2 #3 joinKey docstring**: header `UTC day-granularity key … UTC getters used` → `local-timezone day-granularity key … getFullYear/getMonth/getDate` (код не менялся, doc vs behavior теперь consistent). (3) **P2 #4 memoize resolveFrameById**: `$: resolveFrameById = (...)` → `const resolveFrameById = (...)` с `get(app/settings/fileSystem)` внутри closure (lazy-read вместо closure-capture); `new ViewApi(...)` больше не пересоздаётся на каждый $settings tick, downstream `$:` пересчёты устранены. (4) **P2 #5 resolver unit tests**: создан `src/lib/__tests__/externalFrameResolver.test.ts` (6 кейсов: project-not-found → null, folder/tag/dataview happy paths, dataview-without-api → null, datasource-throw → null + console.warn). Jest config: `esbuild-jest` не переваривает `import type` в тестах — workaround через inline `any`-типы. (5) **P3 #7 aggregation input → select**: в JoinStep `<input type="text" list="...">` → `<select>` over `AGG_FUNCTIONS` (consistency с Aggregate-step / Pivot-step, typo-proof). (6) **P3 #9 throttle console.warn**: `src/lib/externalFrameResolver.ts` — `warnThrottled(projectId, err)` с 5s TTL per-projectId через `Map<string, number>`; cascade reactive invalidations больше не спамит консоль. (7) **P3 #10 extract WidgetHost duplicate**: три inline arrow-handlers (`on:configChange` / `on:tableConfigChange` / `on:removeWidget`) вынесены в named functions `handleWidgetConfigChange`/`handleTableConfigChange`/`handleRemoveWidget` на top-level; оба `<WidgetHost>`-блока (DnD + regular) теперь идентичны и thin, drift-risk устранён. Также в resolver: explicit `case "folder":` перед default (ещё из P3 backlog). **Quality gate**: tsc **0**, svelte-check **0/0**, jest **53 suites / 916 tests PASS** (+1 suite, +6 tests), production build **PASS** (1 a11y warning от third-party `obsidian-svelte/IconButton`, off-scope). Остались как backlog (не блокеры WIP): P2 #6 UX-rename Y/X fields в correlation (Y from right source hint), P3 #8 bridge-warning на 0 matches при typo в rightKey. Плагин остаётся WIP на 3.4.1 до явного решения о публикации. NO COMMIT.
- **UPDATE 2026-04-23 — Phase 7 DELIVERED (Release wrap v3.5.0 — §5.7)** _[ОТКАЧЕН той же датой — см. запись выше]_: финализация Architectural Reset. (1) Bumped `package.json`, `manifest.json`, `versions.json` с `3.4.1 → 3.5.0` (minAppVersion остался `1.5.7`). (2) `CHANGELOG.md` — новая `[3.5.0] — 2026-04-23 — Architectural Reset` секция с краткой сводкой шести pillars (5 cross-source correlation, 4 formula IntelliSense, 6 Zero Pixels, 3 data hygiene, 2b field presets) + Phase 5 UI stability fixes (generation-token, try/catch, no-cache-null). (3) `releases/v3.5.0/` snapshot: `main.js` (2.44 MB), `manifest.json` (479 B), `styles.css` (30.6 KB), `RELEASE_NOTES.md` (полный upgrade-guide, quality stats, artifacts list). (4) Ребилд после version bump: `node esbuild.config.mjs production` → success, 1 A11y warning от `obsidian-svelte/IconButton.svelte` (third-party, off-scope). **НЕ ВЫПОЛНЕНО (требует явного одобрения пользователя)**: `git tag 3.5.0`, `git commit`, `git push`. Per director-mode safety: NO COMMIT / NO PUSH без explicit user approval. Все 7 фаз Architectural Reset закрыты; ждём санкцию на commit+tag.
- **UPDATE 2026-04-23 — Phase 5 UI DELIVERED (Correlation Flows UI — §5.5 finalisation) + audit applied**: закрыт deferred UI-контур Pillar 5 (cross-source correlation). Файлы: (1) `src/lib/externalFrameResolver.ts` (NEW) — pure resolver `resolveExternalFrame(projectId, {fileSystem, preferences, projects, dataviewApi, app})`: switch по `project.dataSource.kind` (dataview/tag/folder-default), `queryAll()`, try/catch → `null` + console.warn. (2) `src/lib/viewApi.ts` — конструктор `ViewApi` получил опциональный 3-й параметр `resolveExternalFrame?: (projectId) => Promise<DataFrame \| null>`. (3) `src/ui/app/App.svelte` — closure `resolveFrameById` с `externalFrameCache: Map<string, Promise<DataFrame\|null>>`, inline в `new ViewApi(source, $api, resolveFrameById)`; cache-invalidation на vault events (`modify`/`create`/`delete`/`rename` через `vault.on/offref` в onMount cleanup) + reactive invalidate при изменении `$settings.projects` (key=`id\|name` join); null-результаты не кэшируются (ретрай на следующем access). (4) `src/ui/views/Database/DatabaseViewCanvas.svelte` — `collectReferencedSourceIds(widgets)` сканит `widget.transform.steps[*].type === "join"` + `widget.config.correlation.rightSourceId` для chart-scatter; reactive `$: referencedIds`, key-diff guard (`lastReferencedKey`) + **generation-token** (`preloadGeneration`, `token === preloadGeneration` проверка перед `rightFramesStore.set`) защищают от promise-race при быстрой смене id; try/catch вокруг async IIFE предохраняет от unhandled rejection; `$rightFramesStore` + `availableSources = $settings.projects.filter(p.id !== project.id)` пробрасываются в оба WidgetHost mount-site (DnD + regular). (5) `src/ui/views/Database/widgets/WidgetHost.svelte` — новые props `availableSources`, `rightFrames: ReadonlyMap<string, DataFrame>`; `executeTransform(enrichedFrame, currentPipeline, { rightFrames }).data` протаскивает context; `chartRightFrame = rightFrames.get(scatterCfg.correlation.rightSourceId) ?? null` для scatter; forwarding `availableSources` в ChartConfig/PipelineEditor. (6) `src/ui/views/Database/widgets/Chart/ChartWidget.svelte` — prop `rightFrame: DataFrame \| null = null`, `computeScatterData(source, scatterConfig, rightFrame ?? undefined)`. (7) `src/ui/views/Database/widgets/Chart/ChartConfig.svelte` — new `availableSources` prop + correlation section в `{#if isScatter}` блоке: checkbox enable (strip-ключ через destructuring для `exactOptionalPropertyTypes`), source `<select>`, left-key `<select>` из fieldNames, right-key `<input type=text>`. (8) `src/ui/views/Database/widgets/PipelineEditor.svelte` — STEP_TYPES получил `{value:"join", labelKey:"views.database.pipeline.join", icon:"⋈"}`; `createDefaultStep("join")` инициализирует с `availableSources[0]?.id ?? ""` + `fieldNames[0]`; `stepLabel` case с human-readable `left=right.right`; helpers `updateJoinStep` + `toggleJoinAggregation` (destructuring strip для опционального aggregation); editor branch `{#if step.type === "join"}` — right source select (с fallback-hint при пустом списке), leftKey/rightKey, how select (inner/left), опциональный aggregation checkbox + function input. (9) i18n keys в 4 локалях (en/ru/uk/zh-CN) — `views.database.pipeline.{join,join-right-source,join-left-key,join-right-key,join-right-key-placeholder,join-how,join-inner,join-left,join-aggregate,join-no-sources,aggregate-function}` + `views.database.chart.scatter.{correlate-enable,right-source,left-key,right-key,right-key-placeholder,no-sources}`. **Аудит через `auditor`**: 1 P0 + 3 P1 + 6 MEDIUM. Применены P0 #1 (generation-token race-fix), P1 #2 (try/catch async IIFE), P1 #3 (vault-event cache invalidation + null-no-cache). Отложены MEDIUM: closure churn на $settings tick (не регрессия), AbortController на queryAll, dangling rightSourceId migration при удалении sibling-project, aria-describedby на no-sources hint, explicit folder-kind case в resolver. Верификация: jest **52 suites / 910 tests PASS**, svelte-check **0/0**, tsc **0 errors**, build **PASS**. NO COMMIT.
- **UPDATE 2026-04-23 — Phase 6 DELIVERED (Zero Pixels / Matryoshka sweep — §5.6)**: все критерии acceptance из плана выполнены. (A) **`@media (max-width|max-height|orientation)` в `src/ui/views/Database/` → 0 matches** (уже было выполнено прошлыми волнами — 29 `@container` правил в widget shells сделали свою работу). (B) **`Npx` (N≥2) в `src/ui/views/Database/widgets/` → 0 matches** (исключая var() fallback-ы и комментарии) — проведена конверсия на real offender-ах: `DataTableWidget.svelte` aggregation-row border-top `2px → 1px` (hairline semantic), `WidgetHost.svelte` widget-error `border-left: 3px → 0.1875rem` + resize outline `2px dashed → 0.125rem dashed` + offset `-1px → -0.0625rem`, `DatabaseViewCanvas.svelte` 2 focus-visible outlines `2px solid / 1px offset → 0.125rem / 0.0625rem`, `FilterTabsWidget.svelte` tab focus outline `2px / -2px → 0.125rem / -0.125rem`, `StatsCard.svelte` inline `border-left: 3px → 0.1875rem`, `FormulaVisualEditor.svelte` — visual-empty `2px dashed → 0.125rem`, 6 category-rail `border-left: 3px <hex> → 0.1875rem` (logic/math/string/date/comparison/conversion), 3 × `border-radius: 10px → 0.625rem` (chip / literal-input / palette-chip). `chartHeightPx` в `chartDataPipeline.ts` оставлен как есть — это boundary к chart-библиотеке, ожидающей numeric px; переименование сломало бы 7 chart-renderer компонентов без user-visible value (YAGNI). Верификация grep (исключая `var(--…, Npx)` fallback-и и `//`/`*` комментарии): 0 matches. Gates: jest **52 suites / 910 tests PASS**, svelte-check **0/0**, build **PASS**. NO COMMIT.
- **UPDATE 2026-04-23 — Phase 5 KERNEL DELIVERED (Correlation Flows — §5.5) + intermediate audit applied**: доставлено engine-kernel ядро Pillar 5 (cross-type DataFrame correlation) по YAGNI: ядро + тесты, UI/preload/filesystem — deferred. Файлы: (1) `src/ui/views/Database/engine/transformTypes.ts` — новый вариант `JoinStep {type:"join", rightSourceId, on:{leftKey,rightKey}, how:"inner"|"left", aggregation?, suffix?}` в union `TransformStep`; новый interface `TransformContext {rightFrames?: ReadonlyMap<string, DataFrame>}` — side-channel для пред-резолвленных правых фреймов (DataSource не сериализуется, поэтому step держит только id). (2) `src/ui/views/Database/engine/transformExecutor.ts` — `STEP_ORDER` получил `join: 0` (наравне с unnest/unpivot); `executeTransform(source, pipeline, context?)` и `executeStep(df, step, warnings, context?)` протащили опциональный context; новая pure функция `executeJoin(df, step, warnings, context?)` — hash-join через `joinKey()`: строит `Map<key, DataRecord[]>` на правом фрейме, для каждой левой строки (a) `inner/no-match` → drop, (b) `left/no-match` → null-filled row `${id}__joinL`, (c) `aggregation` set → single merged row `${id}__joinA` (numeric right columns via `computeAggFn`, non-numeric → FIRST), (d) no aggregation → cartesian `${id}__join_${i}`. Suffix collision: `rightKey` исключается из output, коллидирующие имена получают `suffix ?? "__r"`. Guard: `MAX_JOIN_OUTPUT_RECORDS = MAX_OUTPUT_RECORDS` обрывает cartesian. Unresolved `rightFrame` / отсутствующий `leftKey` → warn + passthrough (данные идут дальше как есть). (3) `src/ui/views/Database/engine/joinKey.ts` (NEW) — shared normaliser `joinKey(v: unknown): string`: `null/undefined → "\0"`, `Date → D:yyyy-MM-dd` (local-TZ day), ISO-prefix strings (`^\d{4}-\d{2}-\d{2}`) → тот же `D:yyyy-MM-dd` ключ (покрывает кейс когда frontmatter date parsed как Date на одной стороне и как string на другой — основной real-world mismatch), arrays → JSON, прочее → `typeof:value`. (4) `src/ui/views/Database/engine/transformCache.ts` — `executeTransformCached(source, pipeline, context?)` пробрасывает context; `computeCacheKey` при `context.rightFrames.size > 0` добавляет суффикс `__R__<hash>` где hash = sorted `id:hashDataFrame(frame)` через `simpleHash` → разный правый фрейм = разный cache key. (5) `src/ui/views/Database/types.ts` — `ScatterChartConfig` расширен опциональным `correlation?: {rightSourceId, on:{leftKey, rightKey}}`. (6) `src/ui/views/Database/engine/chartDataPipeline.ts` — импорт shared `joinKey as scatterJoinKey`; `computeScatterData(source, config, rightFrame?)` при `config.correlation && rightFrame` строит hash-index по `rightKey`, пары X(left)/Y(right.first-match), иначе single-frame path как раньше (backward-compat). (7) `src/ui/views/Database/engine/__tests__/joinStep.test.ts` (NEW, 7 tests) — workouts(w1..w3)+nutrition(n1..n3 с дубликатами n2+n3 на тот же день): inner drops unmatched, left keeps w3 null calories, aggregation AVG collapses n2+n3→2250, `note__r` suffix на коллизии, unresolved rightFrame warn+passthrough, missing leftKey warn+passthrough, day-granularity normalization. (8) `src/ui/views/Database/engine/__tests__/scatterCorrelation.test.ts` (NEW, 3 tests) — day-key pairing `[[80,2200],[82,2400]]`, fallback при отсутствии rightFrame, trend line + R² на correlated data. **Intermediate-аудит через `auditor`**: 0 BLOCKER / 2 HIGH / 3 MEDIUM / 5 LOW / 3 NITPICK. Применены ship-blockers: HIGH#1 (ISO-string vs Date key mismatch) + HIGH#2 (TZ precision) + MEDIUM#3 (DRY между двумя joinKey impls) — все три закрыты созданием shared `joinKey.ts` с ISO-prefix нормализацией и local-TZ day semantics (UTC-getters были отвергнуты — ломают local-midnight Dates). Отложены: MEDIUM#4 (STEP_ORDER tier для filter-before-join оптимизации), MEDIUM#5 (hashDataFrame weak sampling на right frames), LOW#6-#10 (join-right bucket cap, suffix-collision loop, aggregation empty-string handling, ID stability), NITPICK#11-#13 (test cast ugliness, determinism, empty-map cache marker). Non-scope: rightDataSource picker в ChartConfig, JoinStep визуальный editor в PipelineEditor, DatabaseViewCanvas preload расширение, filesystem `metadataCache.on("resolved")` subscription для cache-invalidation. Верификация: svelte-check **0/0**, jest **52 suites / 910 tests PASS** (+2 suites/+10 tests vs Phase 4 baseline 50/900), build success. NO COMMIT.
- **UPDATE 2026-04-23 — Phase 4 DELIVERED (Formula IntelliSense polish) + intermediate audit applied**: доставлен §5.4 плана. Файлы: (1) `src/ui/views/Database/engine/formulaMetadata.ts` (NEW) — статический реестр `FormulaMetadata {name, signature, returnType, doc, category}` для всех **102 функций** formulaEngine (9 категорий: logical/math/string/date/financial/statistical/array/conversion/utility); exports `getFormulaMetadata(name)` (case-insensitive), `getAllFormulaMetadata()`, и pure `findEnclosingCall(source, cursor): string | null` — string-literal-aware (skip `"..."`/`'...'` с backslash-escape) reverse-scan для определения охватывающего function-call. (2) `src/ui/views/Database/engine/formulaEngine.ts` — re-export блок `{ getFormulaMetadata, getAllFormulaMetadata, type FormulaMetadata, type FormulaCategory }` сверху файла → единая import-surface для потребителей. (3) `src/ui/views/Database/widgets/FormulaBar.svelte` — переключён с `evaluateFormulaValue` на `evaluateFormulaWithError` (rich errors); новые state-переменные `runtimeError: string \| null`, `debugDismissed: boolean`, `cursorPosition: number`, `activeSignature: FormulaMetadata \| null`; реактивный блок вычисляет `activeSignature` сначала по highlighted suggestion, затем по `findEnclosingCall(inputValue, cursorPosition)`; `handleCursorMove(e)` обновляет `cursorPosition` на click/keyup/focus textarea; `insertSuggestion` теперь тоже синхронизирует `cursorPosition` после `setSelectionRange`; сигнатурный popover (`<div.ppp-formula-signature>`) выводит `signature` + `returns: <type>` + `category` + `doc` под textarea-ом; при runtime-error и `!debugDismissed` монтируется `<FormulaDebugPanel>`; `debugDismissed` сбрасывается только когда `runtimeError` исчезает (фикс аудита #1 — изначально стоял keystroke-reset, ломавший Dismiss-кнопку для юзеров ещё редактирующих broken expression). Новые CSS-правила `.ppp-formula-signature*` (accent-color code + muted meta row + normal doc paragraph). (4) `src/ui/views/Database/widgets/FormulaDebugPanel.svelte` (NEW) — accordion-панель ошибок рантайма: `role="region"` + `aria-label`; toggle с `aria-expanded` и вращающимся каретом; actions-row с `Copy error` (использует `navigator.clipboard.writeText` best-effort, swallow-fail безопасно; payload: message + cursor + expression plain-text) и `Dismiss` (dispatch `dismiss`); body показывает `<pre>`-ованный message и cursor position; Esc на `role="region"` dispatches dismiss. Border `1px solid var(--text-error)` (соответствует Zero Pixels Policy — hairline). (5) i18n-ключи `views.database.formula.{signature-returns,signature-category,debug-title,debug-cursor,debug-copy,debug-dismiss,runtime-error}` добавлены во все 4 локали (en/ru/uk/zh-CN). (6) `src/ui/views/Database/engine/__tests__/formulaMetadata.test.ts` (NEW, 5 тестов) — covers every formulaEngine function, shape consistency, case-insensitivity, undefined-for-unknown, sentinel signatures. (7) `src/ui/views/Database/engine/__tests__/FormulaBar.kbd.test.ts` (NEW, 10 тестов) — `findEnclosingCall`: no-call, simple, nested-innermost, skip-closed-siblings, cursor-at-paren, no-identifier-before-paren, cursor-past-length, **string-literal awareness** (double/single quotes + backslash escapes — добавлено после аудита #2). **Promesso-аудит через `auditor`** (intermediate): 0 BLOCKER / 0 HIGH / 1 MEDIUM / 3 LOW / 2 NITPICK. Применены #1 (keystroke-reset dismissal → убрано), #2 (string-literal aware findEnclosingCall + 3 новых теста), #3 (on:focus handler + post-insertion cursorPosition sync). Отложены: #4 (Esc в debug-panel — пока Dismiss-кнопки и parent-Esc достаточно), #5-#6 (a11y nits aria-controls/aria-live politeness). Верификация: svelte-check **0/0**, jest **50 suites / 900 tests PASS** (+2 suites/+15 tests vs Phase 3 baseline), build success. NO COMMIT.
- **UPDATE 2026-04-23 — Phase 3 progress: F6 (processFrontMatter) + F5 (rem width persistence)**: закрыты два критических findings из §4 плана. **F6 (`fileManager.processFrontMatter`)** — (1) `src/lib/filesystem/filesystem.ts` — `IFile` получил опциональный метод `processFrontMatter(fn: (fm) => void): Promise<boolean>` с default-реализацией возвращающей `false`; (2) `src/lib/filesystem/obsidian/filesystem.ts` — `ObsidianFile` переопределяет через `app.fileManager.processFrontMatter` с defensive-guard для старых API-surface; (3) `src/lib/dataApi.ts` — `DataApi.updateRecord` / `updateRecords` сначала пробуют `processFrontMatter` и только при `false` fallback-ают на legacy read-modify-write; extracted pure helper `applyRecordToFrontmatter(fm, fields, record)` соблюдает те же правила что `doUpdateRecord` (date formatting, derived-field exclusion); (4) `src/lib/__tests__/dataApi.processFrontMatter.test.ts` (NEW, 5 tests) — verifies precedence (prefer pfm), fallback path, derived-field exclusion, date formatting. Побочный fix: `jest.config.js` получил `moduleNameMapper` entry для `svelte-i18next` → `src/__mocks__/svelte-i18next.js` (NEW), иначе ESM-форма пакета ломает ts-jest при импорте модулей, транзитивно тянущих `stores/i18n`. **F5 (rem widths)** — (1) `src/ui/views/Database/types.ts` — `DataTableFieldConfig` получил `widthRem?: number`, legacy `width?: number` помечен deprecated (kept for back-compat); (2) `src/ui/views/Database/widgets/DataTable/widthUnits.ts` (NEW) — pure helpers `pxToRem`/`remToPx`/`resolveColumnWidthPx` с защитой от SSR и clamp-ом precision до 3 знаков; (3) `DataTableWidget.svelte` — `handleColumnResize` теперь персистит как `widthRem` (конверсия px→rem), strip-ая legacy `width` через destructuring; computed GridColDef `width` получается через `resolveColumnWidthPx(..., default)` — precedence `widthRem > width > fallback`; (4) `src/ui/views/Database/__tests__/widthUnits.test.ts` (NEW, 6 tests) — round-trip lossless at 16px root, precedence, fallback. Unchanged: grid-template-columns refactor и StrictGrid fork — deferred (YAGNI): px-leak закрыт при persistence, а внутренний render GridCell/GridColumnHeader использует numeric px из GridColDef — unit-agnostic. Верификация: svelte-check 0/0, jest **48 suites / 885 tests PASS** (+2 suites +11 tests), build success. NO COMMIT.
- **UPDATE 2026-04-23 — Phase 2b DELIVERED (FieldPreset, scoped implementation)**: по корректному скоупу (preset = snapshot **только** field-layout DataTableConfig, без filter/widgets) полностью реализованы и провалидированы пайплайны. Файлы: (1) `src/ui/views/Database/types.ts` — добавлен public interface `FieldPreset {id,label,fieldConfig?,orderFields?,sortCriteria?,freezeUpTo?,groupBy?,rowHeight?,wrapText?}`; `DatabaseViewConfig` расширен `readonly fieldPresets?: FieldPreset[]` + `readonly activeFieldPresetId?: string`; (2) `src/ui/views/Database/widgets/DataTable/fieldPreset.ts` (NEW) — pure helpers `snapshotFromTable(table): Omit<FieldPreset,"id"|"label">` (deep-clone presettable keys), `applyPresetToTable(table, preset): DataTableConfig` (exact-layout semantics: strip presettable → re-apply из preset; non-presettable поля aggregations/conditionalFormats/defaultValues/hintDismissed/sortField/sortAsc сохраняются), `PRESETTABLE_KEYS` экспортирован для тестов; (3) `src/ui/views/Database/widgets/DataTable/FieldPresetMenu.svelte` (NEW) — dropdown-меню у правого края DataTable-toolbar: «Save current layout…» (prompt label), список пресетов с active highlight + rename/delete per-row, «Detach preset» при активном, click-catcher scrim для dismiss; (4) `src/ui/views/Database/widgets/DataTable/DataTableWidget.svelte` — новые опциональные props `fieldPresets`, `activeFieldPresetId`; новый event `fieldPresetsChange: {fieldPresets, activeFieldPresetId}`; mounted `FieldPresetMenu` в новом `.ppp-datatable-toolbar` строке (видим только non-readonly); handlers `handleFieldPresetApply` (диспатчит configChange c `applyPresetToTable` + fieldPresetsChange с новым activeId) и `handleFieldPresetSave` (диспатчит только fieldPresetsChange); (5) `src/ui/views/Database/widgets/WidgetHost.svelte` — props/event/dispatcher extended, forwarding без трансформации; (6) `src/ui/views/Database/DatabaseViewCanvas.svelte` — оба WidgetHost mount-site-а (DnD + regular) получили `fieldPresets={config?.fieldPresets ?? []}` + `activeFieldPresetId={config?.activeFieldPresetId}`; новый handler `handleFieldPresetsChange` делает `saveConfig({...config, fieldPresets, ...(activeFieldPresetId ? {activeFieldPresetId} : {})})` с корректным strip-ключом когда undefined (требование `exactOptionalPropertyTypes: true`); (7) i18n-ключи `views.database.field-presets.{label,title,aria-label,save-current,apply,rename,delete,detach,prompt-new,prompt-rename,confirm-delete}` добавлены в en/ru/uk/zh-CN; (8) `src/ui/views/Database/__tests__/fieldPreset.test.ts` (NEW) — 7 тестов: snapshotFromTable копирует ровно `PRESETTABLE_KEYS`, deep-clones (mutation не протекает в source), omits undefined; applyPresetToTable имеет exact-layout семантику (absent keys очищаются), сохраняет non-presettable поля, round-trip snapshot→apply идемпотентен, returns new object. Дополнительно — доудалён осиротевший файл `src/ui/views/Database/VerticalSwitcher.svelte` (ещё пытался импортировать `VerticalPreset` из удалённого типа — revert от 2026-04-23 его физически не удалил, исправлено). Верификация: svelte-check **0 errors / 0 warnings**, jest **46 suites / 874 tests PASS**, build **success**. NO COMMIT.

- **UPDATE 2026-04-23 — Phase 2b SCOPE CORRECTION + REVERT (Architectural Reset v3.5.0)**: Product Architect отверг предыдущую трактовку "Verticals as first-class" как out-of-scope: preset внутри Database-view должен быть **только snapshot конфигурации полей** (column layout), а не bundle `{filter, widgets}`. Filter — это view-level концепция (`view.filter`), widgets — view-level концепция (`config.widgets`), и индустриальная сегрегация (Fitness/Finance/CRM) канонически реализуется через **3 параллельных Database-view с view-level фильтрами**, а не через switcher внутри одного view. **Полный revert предыдущей Phase 2b**: (1) удалён `src/ui/views/Database/VerticalSwitcher.svelte` (untracked, полностью мой misdesign); (2) `types.ts` — удалён interface `VerticalPreset`, удалены поля `activeVerticalId`, `showVerticalSwitcher`, `verticals` из `DatabaseViewConfig`, удалён неиспользованный import `FilterDefinition`; (3) `widgetTemplates.ts` — удалены `VERTICAL_TYPE_FILTER`, `buildVerticalFilter`, `buildDefaultVerticals`, удалены imports `VerticalPreset`/`FilterDefinition`. `isVertical` флаг и `getVerticalTemplates()` оставлены как informational (не читаются runtime кодом); (4) `DatabaseViewCanvas.svelte` — удалён import `VerticalSwitcher` и `buildDefaultVerticals`, удалены реактивные `verticals`/`activeVerticalId`/`showVerticalSwitcher`, удалены `handleVerticalSelect`/`handleVerticalClear`, удалён render-блок `{#if showVerticalSwitcher}`; (5) `demoProject.ts` — восстановлены 3 параллельных view (`🏋️ Фитнес` / `💰 Финансы` / `👥 CRM`) через helper `makeVerticalConfig(templateId)` + три `fitnessDatabaseConfig`/`financeDatabaseConfig`/`crmDatabaseConfig` с view-level filter-ами по frontmatter `type`; (6) i18n — удалён блок `views.database.verticals.{label,aria-label,clear}` из `en/ru/uk/zh-CN.json`. Updated `docs/IMPLEMENTATION_PLAN_CURRENT.md`: переписаны §2 (Pillar 2 → FIXED через Phase 2a), §3.2 (теперь «Field presets (target)» с `FieldPreset` interface), §4 (F1/F2/F3 помечены WITHDRAWN с объяснением), §5 (status-table Phase 2a → done, 2b → «Field presets», LOW risk), §5.2 (полная перезапись Phase 2b: `DataTableFieldConfig` snapshot menu, файлы, non-goals, acceptance), §6 (risk #4 WITHDRAWN), §10 (next step). Верификация post-revert: svelte-check 0/0, jest 45 suites/867 tests PASS, build success. Phase 2a остаётся корректным и in-place (ViewPort cog + `configPanelRegistry.ts` + 18 unit tests). NO COMMIT.
- **UPDATE 2026-04-22 — Phase 2a VERIFIED GREEN (Architectural Reset v3.5.0, ViewPort cog + configPanelRegistry)**: (1) создан `src/ui/views/Database/widgets/configPanelRegistry.ts` — единый реестр `Record<WidgetType, ConfigPanelDescriptor>` с `{hasCog, isConfigured(config), initDefaults(fields)}`; data-table имеет `hasCog:false` (right-click menu owns settings), остальные 7 типов включают cog. (2) создан `src/ui/views/Database/widgets/ViewPort/ViewPortConfig.svelte` — cog-panel с view picker (reuses ViewPortSelector), label override, headerVisible toggle. (3) `WidgetHost.svelte` рефакторен: удалены 6 локальных `init*Config` функций и константы `DEFAULT_CHART_CONFIG`/`DEFAULT_STATS_CONFIG`, добавлен реактивный `panelDescriptor = getConfigPanel(widget.type)`, cog-кнопка условна на `panelDescriptor.hasCog`, добавлена render-branch для `view-port`. (4) `src/ui/views/Database/__tests__/configPanelRegistry.test.ts` — 18 тестов покрывают `hasCog`, `isConfigured`, `initDefaults` для всех widget types (DataField mocks требуют `identifier: false`). Верификация: svelte-check 0/0, jest 45 suites/867 tests PASS, build success. Это закрывает F4 (ViewPort без cog) и устраняет дублирование init-логики в WidgetHost.
- **UPDATE 2026-04-22 — Repo cleanup + Implementation plan rewrite (Architectural Reset v3.5.0)**: Очищен корневой шум: удалены `_git_log.txt`, `failures.txt`, `ts_errors.txt` (tracked → `git rm --cached` + физ. delete), `lint_output.txt`, `lint_output_after.txt`, `recovery-2026-04-21.bundle` (untracked → физ. delete). `.gitignore` расширен: `lint_output*.txt`, `*.bundle`, `/RELEASE_NOTES.md`, плюс явные одиночные паттерны для `failures.txt`/`ts_errors.txt`. Полностью переписан `docs/IMPLEMENTATION_PLAN_CURRENT.md` под 6-pillar Architectural Reset: §1 директива, §2 honest ground-truth verdict (PASS/PARTIAL/FAIL), §3 target architecture (pipeline-diagram + Obsidian/Dataview dependency registry), §4 критические findings F1–F7 (Vertical filter-bug, hardcoded verticals, demo parallel-views compensation, DataGrid cross-coupling, px-leak в engine, отсутствие processFrontMatter, WidgetHost monolith), §5 execution waves 2a/2b/3/4/5/6/7 с acceptance criteria и file lists, §6 risk register (10 позиций), §7 verification gates, §8 YAGNI non-goals. `docs/DOCS_INDEX.md` синхронизирован (пометка "Architectural Reset v3.5.0 plan"; удалена dangling-ссылка `architecture-database-view.OLD.md`). Следующий шаг: Phase 2a (ViewPort cog + `configPanelRegistry.ts` extraction).
- **UPDATE 2026-04-22 — Architectural Reset Phase 1 (DATA FLOW OVER FOLDERS)**: По директиве "LEAD PRODUCT ARCHITECT & INTEGRATIVE PROMPT MANAGER" проведён честный 6-pillar discovery audit (Explore subagent). Вердикт: FAIL по pillars 1/3/6, PARTIAL по 2/4/5. **Phase 1 исправлен**: demo перестал создавать физические подпапки `Fitness/`, `Finance/`, `CRM/`. Все vertical-записи теперь пишутся flat в `demoFolder`, сегрегация — через `view.filter` по frontmatter `type` (`workout`|`transaction`|`client`). Изменения: (1) `src/ui/app/onboarding/demoProject.ts` — `writeDemoFiles(vault, demoFolder, ...)` вместо `${demoFolder}/Fitness` и т.д.; обновлён комментарий про "DATA FLOW OVER FOLDERS"; recursive=true оставлен для будущих user-subfolder кейсов. (2) `src/ui/app/onboarding/demoVerticals.ts` — обновлён header-комментарий модуля. Per-view фильтры в views `🏋️ Фитнес`/`💰 Финансы`/`👥 CRM` уже были корректны (filter by type) — их трогать не потребовалось. Верификация: svelte-check 0/0, jest 44 suites/849 tests PASS, build PASS. **Phases 2–6 запланированы** (см. session handoff).
- **UPDATE 2026-04-22 — Phase 1E ⑦b: promote local→global filter button (closes TODO/STUB from chain ⑦)**: Достроен plumbing от `ProjectViewProps.saveViewFilter` до кнопки «↥» в local-chip filter-bridge. (1) **API-слой** — `src/customViewApi.ts` получил новое опциональное поле `saveViewFilter?: (filter: FilterDefinition) => void`, дополнительно экспортирован `FilterDefinition` в imports. (2) **Plumbing** — `src/ui/app/useView.ts` добавлен опциональный `onViewFilterChange` в `ViewProps`, и при `onOpen` свойство `saveViewFilter` добавляется в объект props только когда callback определён (через conditional spread — требуется из-за `exactOptionalPropertyTypes: true`). (3) **Wire** — `src/ui/app/View.svelte` определяет `handleViewFilterChange(filter)` → `settings.updateView(project.id, {...view, filter})` и передаёт его в `useView` как `onViewFilterChange`. (4) **Database consumer** — `databaseView.ts` прокидывает `props.saveViewFilter` в Svelte-компонент как `onViewFilterChange`; `DatabaseViewCanvas.svelte` получает новый prop `onViewFilterChange?: (filter) => void` (default undefined). (5) **UX** — новая функция `promoteLocalToGlobal()` конвертирует `activeFilterTab` в `FilterCondition {field, operator: "is", value, enabled: true}`, аппендит к текущим `globalFilters` с dedup-защитой (skip если условие с тем же field+value+is уже присутствует), вызывает `onViewFilterChange({conjunction: "and", conditions})`, сбрасывает `activeFilterTab`. В local-chip рядом с «×» clear-кнопкой теперь показывается «↥» promote-кнопка (условно: `onViewFilterChange && !readonly`), accent-цвет, hover-flip на `interactive-accent` background. (6) **i18n** — добавлены ключи `views.database.canvas.filter-bridge-{global,local,clear,promote}` во все 4 языка (en, ru, uk, zh-CN); ранее они работали только через `defaultValue` (хрупкий fallback замечен auditor'ом). Верификация: svelte-check 0/0, jest 44/849, build PASS. Failure в процессе: первая попытка сорвалась на `exactOptionalPropertyTypes` TS-ошибке (`undefined` не assignable к опциональному методу); fix: conditional-spread при передаче saveViewFilter.
- **UPDATE 2026-04-22 — Phase 1E audit pass (post-chain hardening)**: Проведён auditor-review chain ①–⑧, найдено 0 CRITICAL, 4 WARNING, 8 INFO. Устранены P1-пункты: (a) `demoVerticals.ts` — `writeDemoFiles` стал идемпотентным: `vault.createFolder` уже был в try/catch, добавил try/catch на каждый `vault.create` (файл уже существует → skip), а в главном цикле — per-vertical try/catch с `console.warn`, так что сбой в одной vertical (Fitness) не блокирует остальные (Finance/CRM); (b) `FilterTabsWidget.extractUniqueValues` — теперь skip-ит non-primitive values (`typeof val !== "string"|"number"|"boolean"`), чтобы nested-поля (`sessions: [...]`) не превращались в бессмысленные tabs типа «[object Object]»; (c) i18n-ключи `unnest-suggestion-{title,body,button}` добавлены в `uk.json` и `zh-CN.json` (были только en/ru); (d) `ViewSwitcher.svelte` — chevron-кнопки теперь скрыты на touch-устройствах (`!$isTouchDevice`), чтобы не перекрывать вкладки при нативном pan-x; (e) `WidgetHost.svelte` — на `.ppp-widget-type-badge` добавлен `aria-hidden="true"`, screenreader больше не читает «My Table (chart)»; (f) `DataTableWidget.svelte` row-header aggregation cell получил `role="rowheader"` + `aria-label` (был пустым для screenreader'ов); (g) `PipelineEditor.svelte` sampleSize для `detectArrayFields` поднят с 10 до 50 записей (редкие массивы в разреженном frontmatter теперь обнаруживаются); (h) устранён **pre-existing** bug дубликата `updateStep` в `updateFilterValue` (вызывался дважды подряд с идентичным результатом; замечен auditor'ом, но не относился к chain ①–⑧). Верификация: svelte-check 0/0, jest 44 suites/849 tests PASS, build PASS. Оставшиеся INFO-пункты (chevron `:focus-visible`, ResizeObserver в onMount, `role="group"` для пустого tablist) — accepted without action (хрупкость минимальна, рефакторинг не планируется).
- **UPDATE 2026-04-22 — Phase 1E (continued): chain ⑤–⑧ — nested-data banner + container queries + filter bridge + view-tabs scroll-indicator**: (5) **PipelineEditor nested-data banner** — `src/ui/views/Database/widgets/PipelineEditor.svelte` получает новый опциональный prop `source: { records }`; реактивный `arrayFields` сканирует первые 10 records на предмет array-valued полей, исключая уже unnest-нутые. При обнаружении рисуется discoverability-banner (accent-border, ⊞ icon) «Array fields detected: Fields X contain arrays. Use Unnest to split each item into its own row.» с one-click кнопками `⊞ {field}` — по клику `addUnnestForField` prepend-ит `{type: "unnest", field}` в начало pipeline (чтобы последующие filter/group-by/aggregate видели уплощённые строки). `WidgetHost.svelte` передаёт `source={frame}`. i18n-ключи добавлены в `en.json` и `ru.json`. (6) **Container-query adaptivity pass** — инвентаризация: Stats/Chart/Comparison/DataTable/SummaryRow/WidgetConfigShell уже имели `@container widget` rules на 20/35rem, проверены и оставлены как есть (не над-инженерим). Единственная новая правка — `FilterTabsWidget.svelte` получил `@container widget (max-width: 20rem)` с уменьшенным padding (0.1875rem/0.375rem) и шрифтом (smaller), так как теперь он активен end-to-end и его нужно делать компактным при узких widget-контейнерах. Checklist использует flex-column — адаптивен нативно. (7) **Local↔Global filter bridge** — Database view теперь осведомлён о view.filter: `databaseView.ts` получает `filterConditions` из `DataQueryResult` и прокидывает в `DatabaseViewCanvas` через новый prop `globalFilters: FilterCondition[]`. Отрисовывается `.ppp-filter-bridge` strip после FormulaBar и перед widget-grid: при `activeGlobalFilters.length > 0` показывается chip «🌐 Global filter: N condition(s)» с tooltip-ом перечисляющим условия; при `activeFilterTab` отдельный chip «⎘ Local: field = value» с «×» clear-кнопкой. Это устраняет раз-ориентацию пользователя когда данные сужены глобальными фильтрами, которые он не видит в canvas, и делает локальный click-to-filter reversible без открытия widget config. (8) **Toolbar scroll-indicator** — `src/ui/components/Navigation/ViewSwitcher.svelte` обёрнут в `.view-switcher-container` с двумя оверлейными чevron'ами («‹» / «›») и edge-fade масками через `::before`/`::after` linear-gradient. Реактивный `updateScrollIndicators()` пересчитывает `canScrollLeft`/`canScrollRight` на `scroll` event, при изменении `views` (через `Promise.resolve().then`) и через `ResizeObserver` на сам switcher element. Chevron при клике вызывает `scrollByStep(±1)` с `scrollBehavior: smooth` и шагом `max(clientWidth * 0.6, 120px)`. `onDestroy` disconnect ResizeObserver. Верификация chain ①–⑧: svelte-check 0/0, jest 44 suites/849 tests PASS, build PASS.
- **UPDATE 2026-04-22 — Phase 1E: data-seed + FilterTabs end-to-end + Σ language + sticky-tooltip fix (chain ①–④)**: (1) **Demo verticals** — новый модуль `src/ui/app/onboarding/demoVerticals.ts` создаёт 3 sub-проекта в папке «Projects Plus - Demo Verticals»: Fitness/ (7 workout заметок с nested `sets: [{reps,weight,restSec}]`, 3 упражнения × 3 недели прогрессии), Finance/ (10 транзакций с amount/tax/net/rate/creditLine), CRM/ (8 клиентов со вложенными `sessions: [{date,duration,topic}]` и stage — active/prospect/negotiation/churned). Каждый vertical получает собственный Projects Plus project и Database view с соответствующим template (`fitness-workout`/`finance-accounting`/`crm-clients`); вызывается из `App.svelte` после `createDemoProject` с non-fatal catch. (2) **FilterTabs end-to-end** — обнаружен и устранён критический bug: `on:filter` event из `FilterTabsWidget` поднимался через `WidgetHost` через pass-through `on:filter`, но в `DatabaseViewCanvas.svelte` ему не было слушателя → клик по вкладке ничего не делал. Добавлены: singleton state `activeFilterTab: {field, value} | null`, derived `displayFrame` с фильтрацией records, `handleFilterTab` handler; `WidgetHost` теперь получает `frame={widget.type === "filter-tabs" ? frame : displayFrame}` (сама filter-tabs видит полный frame, чтобы автоподбор вкладок корректно считался); в `FilterTabsWidget.svelte` добавлены empty-states «Click ⚙ to pick a field» и «No values found in 'X'». (3) **Σ aggregation-row label** — в `DataTableWidget.svelte` row-header ячейка теперь рендерит `Σ` глиф (text-accent, bold), tooltip «Aggregation row — click a cell to pick a function». Создан единый визуальный язык с pipeline-кнопкой из Phase 1C: Σ = аггрегация, ⚙ = настройки. (4) **Sticky "Weight progression" tooltip fix** — в `WidgetHost.svelte` заменён `aria-label={widgetAria["aria-label"]}` на `aria-labelledby={'ppp-widget-title-' + widget.id}` с id на видимый title-span; убран `title={widget.type}` с type-badge. Obsidian больше не генерирует дублирующий native tooltip поверх widget'а. Верификация: svelte-check 0/0, jest 44 suites/849 tests PASS, build PASS.
- **UPDATE 2026-04-22 — Phase 1D: UI straightening pass (по скриншотам пользователя)**: (1) `src/ui/views/Database/widgets/Chart/ChartWidget.svelte` — когда `isDegenerate=true`, body чарта теперь не рендерится совсем (был `{#if isDegenerate}...{/if}{#if isEmpty}` — оба блока показывались одновременно: hint сверху + «100%» или одноточечный line ниже). Изменено на `{#if isDegenerate}...{:else if isEmpty}...{:else ...}`, добавлен модификатор `.ppp-chart-widget--degenerate` убирающий `min-height` → hint отображается компактно без белого прямоугольника под ним. (2) `src/ui/views/Database/widgets/Stats/StatsWidget.svelte` + `StatsCard.svelte` — добавлен prop `fieldMissing` с проверкой `availableFieldNames.has(card.field)`; карточки со ссылкой на несуществующее поле показывают `⚠`, оранжевую левую границу, lowered opacity и inline hint «no field "xxx"», с tooltip указывающим на открытие config (решает кейс «— Avg weight» из fitness-template на нефитнес-данных). (3) `src/ui/views/Database/widgets/DataTable/DataTableWidget.svelte` — удалена внешняя кнопка «+ Новая заметка» (DataGrid уже рендерит собственный footer через `onRowAdd`, что приводило к двум кнопкам подряд: «+ Добавить заметку» от DataGrid + «+ Новая заметка» от обёртки). Удалены соответствующие неиспользуемые CSS-селекторы `.ppp-add-row-btn*`. Верификация: svelte-check 0/0, jest 44 suites/849 tests PASS, build PASS.
- **UPDATE 2026-04-22 — Phase 1C: widget discoverability + vertical templates**: (1) устранён визуально-идентичный «дубль шестерёнок» в `src/ui/views/Database/widgets/WidgetHost.svelte` — pipeline-кнопка теперь рендерит глиф `∑` вместо `⛭` (совпадал со ⚙ в большинстве шрифтов), показывает badge со счётчиком шагов и остаётся видимой когда `currentPipeline.steps.length > 0` (`.ppp-widget-pipeline-btn--active`), tooltip/aria-label локализованы с упоминанием "filter, group, unnest, sort"; `initChecklistConfig` теперь консистентно ставит `showConfig = true` (ранее панель не открывалась автоматически для checklist). (2) В `src/ui/views/Database/widgets/Chart/ChartWidget.svelte` добавлен degenerate-data баннер (`isDegenerate`) который детектирует pie/donut с единственной категорией и line/area/bar с <2 точками и выводит объяснение «All records share the same value of X» вместо молчаливого отображения «100%» (это и было на скриншоте пользователя на вкладке «База: Аналит…»). (3) В `src/ui/views/Database/widgetTemplates.ts` добавлены три вертикальных шаблона: `fitness-workout` (stats+chart+donut+table с `transform: { steps: [{type:"unnest", field:"sets"}] }` — демонстрирует nested YAML → rows для весов/повторов/отдыха), `finance-accounting` (4-card KPI gross/tax/net/credit + comparison gross-vs-net + trend bar + summary-row с валютой), `crm-clients` (filter-tabs по stage + pipeline KPI + horizontal-bar conversion funnel + unnested sessions line chart + table). Добавлены i18n ключи `views.database.templates.fitness-workout[-desc]`, `.finance-accounting[-desc]`, `.crm-clients[-desc]` в en.json и ru.json. **TODO**: демо-папки с примерными заметками (sets/amount/stage) ещё не созданы — templates сейчас применимы к пользовательским данным, но в онбординге «из коробки» показывают пустой state. Это отдельная задача (Phase 3 data-seed). Верификация: svelte-check 0/0, jest 44 suites/849 tests PASS, build PASS.
- **UPDATE 2026-04-22 — Phase 1B of "Total Access" directive delivered**: добавлены недостающие конфиг-панели `src/ui/views/Database/widgets/Comparison/ComparisonConfig.svelte` (metrics[]: field/label/color, mode absolute/percentage/normalized, orientation, showDelta; миграция legacy metricA/metricB при первом сохранении) и `src/ui/views/Database/widgets/FilterTabs/FilterTabsConfig.svelte` (field + showAll + preview auto-detected значений + seed-кнопка "Use as tabs" + ручное редактирование tabs[]); в `WidgetHost.svelte` шестерёнка расширена на `comparison` и `filter-tabs`, добавлены `initComparisonConfig`/`initFilterTabsConfig` с seed-значениями из numeric/первого поля; в `DataTable/DataTableWidget.svelte` добавлен discoverability-баннер "Right-click column header to rename, change type, hide, pin, resize" с dismiss-кнопкой (persist в `DataTableConfig.hintDismissed`); в `DatabaseViewCanvas.svelte` расширен tooltip ƒx-кнопки (IntelliSense, live preview, syntax check); верификация: svelte-check 0/0, jest 44 suites/849 tests PASS, build PASS
- **UPDATE 2026-04-22 — Phase 1A of "Total Access" directive delivered**: создан unified config shell `src/ui/views/Database/widgets/_shared/WidgetConfigShell.svelte` (title, subtitle, dirty badge, close, container-query adaptive, shared form primitives `.ppp-cfg-row/list/item/add/remove` через `:global` — Zero-Pixels/rem only); реализованы недостающие панели `src/ui/views/Database/widgets/SummaryRow/SummaryRowConfig.svelte` (add/remove колонок, поле с datalist, агрегация из ColumnAggregation, формат number/percent/currency, символ валюты) и `src/ui/views/Database/widgets/Stats/StatsConfig.svelte` (cards editor с label/field/aggregation/format/currency/sparkline + grid columns 2/3/4); в `WidgetHost.svelte` шестерёнка расширена на stats+summary-row, добавлены `initStatsConfig`/`initSummaryRowConfig` с принудительным открытием панели и `handleStatsConfigChange`; все новые панели имеют close; верификация: svelte-check 0/0, jest databaseView.e2e + widgetTemplates 26/26 PASS, build PASS
- **UPDATE 2026-04-22 — SummaryRow transparency + pipeline i18n**: в `src/ui/views/Database/widgets/SummaryRow/SummaryRowWidget.svelte` добавлен rules-bar (records · pipeline steps · columns), ячейки теперь показывают локализованную агрегацию вместо сырого имени поля (`Сумма · estimate` вместо `estimate`), empty-state с указанием на шестерёнку, новый prop `pipelineSteps`; `WidgetHost.svelte` пробрасывает `pipelineSteps={currentPipeline.steps.length}`; в `ru/en/uk/zh-CN.json` добавлены ключи `views.database.pipeline.how-to` и `how-to-steps` (убран English-only defaultValue в PipelineEditor how-to подсказке); верификация: svelte-check PASS 0/0, jest databaseView.e2e 18/18 PASS, build PASS
- **UPDATE 2026-04-22 — Checklist configurability/visibility fix delivered**: закрыт критичный UX-gap "по каким параметрам выводится checklist": добавлен отдельный конфиг-панельный компонент `src/ui/views/Database/widgets/Checklist/ChecklistConfig.svelte` (check field, label field, mode all/open/done, sort field/order, limit), в `src/ui/views/Database/widgets/WidgetHost.svelte` подключена кнопка настройки для checklist + инициализация default config и проброс `pipelineSteps`, в `src/ui/views/Database/widgets/Checklist/ChecklistWidget.svelte` добавлен явный rules-bar (source count, check field, mode, sort, pipeline steps) и реализованы фильтрация/сортировка/лимит на уровне виджета; верификация: `npm run svelte-check` PASS, `databaseView.e2e.test.ts` PASS (18), `npm run build` PASS
- **UPDATE 2026-04-22 — Accessibility + settings integration hardening (post-user retest)**: по критическим замечаниям пользователя устранены ключевые UX-блокеры: в `src/ui/components/Navigation/CompactNavBar.svelte` скрыт project-title в шапке на малых/touch экранах; в `src/ui/components/Navigation/SettingsMenu/SettingsMenuPopover.svelte` overlay переведён на `position: fixed` и поднят z-index выше sticky header (чтобы глобальные настройки не уходили "под шапку"); в `src/ui/components/Navigation/SettingsMenu/tabs/ViewConfigTab.svelte` добавлена интеграция локальных и глобальных настроек (быстрые переходы к Filters/Colors/Sort), а также расширены доступные Database controls (row height, wrap text, aggregation row, freeze up to) с корректным nested update в `config.table` вместо сломанного top-level update
- **UPDATE 2026-04-22 — Demo views restored + expanded**: после замечания "зачем снесены остальные виды" в `src/ui/app/onboarding/demoProject.ts` сохранены 3 preconfigured Database views и одновременно возвращены Board/Calendar/Gallery/Tasks/Meetings для полноты demo-сценариев и backward testing coverage
- **UPDATE 2026-04-22 — Demo templates overhauled for real user testing (3 Database views)**: `createDemoProject` в `src/ui/app/onboarding/demoProject.ts` перестроен под 3 готовых Database-сценария (`📋 База: Обзор`, `📋 База: Kanban+`, `📋 База: Аналитика`) вместо mixed board/calendar/gallery; каждый вид стартует с преднастроенным template layout + pipeline transforms для демонстрации flow; обновлены quick actions, table defaults и demo-facing copy (`Database view` вместо legacy `Table view`)
- **UPDATE 2026-04-22 — Pipeline UX improved for large schemas**: в `src/ui/views/Database/widgets/PipelineEditor.svelte` внедрён ввод с поиском через `datalist` для полей и aggregation functions (вместо длинных не-searchable selects), добавлены formula expression hints и короткий how-to блок; это устраняет сценарий ручного пролистывания длинных списков при настройке шага
- **UPDATE 2026-04-22 — Template correctness fixes (Kanban+/Overview)**: в `src/ui/views/Database/widgetTemplates.ts` исправлены несогласованные поля (`done` -> `completed`), пересобраны KPI/summary/chart defaults под реальные demo поля (`progress`, `estimate`, `status`, `completed`) и стабилизирован `kanban-plus` chart (`donut` status split); `src/ui/views/Database/__tests__/widgetTemplates.test.ts` расширен под новый контракт
- **UPDATE 2026-04-22 — User-testing readiness gate passed for DataTable-priority refactor**: добиты UX-остатки legacy `table`: в `src/lib/stores/settings.ts` `addView()` нормализует incoming `table -> database`, в `src/ui/components/Navigation/ViewSwitcher.svelte` и `src/ui/components/Navigation/SettingsMenu/tabs/ViewsTab.svelte` иконка резолвится через `database` для legacy type; устранён build-blocker TS6133 в `src/ui/views/Database/__tests__/DatabaseViewCanvas.test.ts`; финальная верификация: `npm run svelte-check` PASS (`0 errors, 0 warnings`), `settings.test.ts` PASS (2), `migration.test.ts` PASS (8), `DatabaseViewCanvas.test.ts` PASS (7), `npm run build` PASS
- **UPDATE 2026-04-22 — DataTable refactor prioritization finalized (table→database normalization)**: закрыт критичный runtime gap между legacy `table` и active `database`: default creation path переведён на Database (`src/lib/dataApi.ts`, `src/ui/modals/components/AddView.svelte`), в AddView выровнена i18n-обработка встроенного типа `database`, добавлен safe runtime fallback `table -> database` в `src/ui/app/useView.ts`, migration pipeline в `src/settings/settings.ts` теперь всегда прогоняет v1/v2 результаты через `v3Resolve` (единая нормализация view type); в `src/settings/settings.test.ts` восстановлен legacy input `table` и добавлен отдельный тест на `migrateSettings`-нормализацию в `database`; верификация: `settings.test.ts` PASS (2 tests), `migration.test.ts` 8/8 PASS, `DatabaseViewCanvas.test.ts` 7/7 PASS
- **UPDATE 2026-04-22 — Database Canvas UI regression coverage completed**: добавлен mounted Jest test `src/ui/views/Database/__tests__/DatabaseViewCanvas.test.ts` на сценарии quick action apply-template confirm/cancel/apply, toolbar applyTemplate path, formula bar toggle/apply/cancel и mobile layout toggle disabled; для поддержки component tests в текущем Jest-контуре добавлен custom transformer `scripts/jest/svelte-ts-transformer.cjs` с TS-in-Svelte transpile и edge-case guard для type-only named imports, `jest.config.js` обновлён под `.svelte` + ESM transform path, `DatabaseViewCanvas.svelte` переведён с barrel import на direct imports `ViewContent.svelte` / `ViewLayout.svelte`, добавлен disabled-state styling и явный `void` для fire-and-forget async template replace calls; верификация: `DatabaseViewCanvas.test.ts` 7/7 pass, `src/__tests__/svelteTsTransformer.test.ts` 1/1 pass, `migration.test.ts` 8/8 pass, `databaseView.e2e.test.ts` 18/18 pass
- **UPDATE 2026-04-22 — Wave A hardening pass completed**: добавлен guard-подтверждение перед destructive replace widgets при применении шаблона в `DatabaseViewCanvas.svelte` (toolbar + quick actions), добавлена modal i18n в `en/ru/uk/zh-CN`, восстановлен сломанный ключ `menus.tab-header.new-window.title` в `en.json`, расширены e2e проверки шаблонов в `databaseView.e2e.test.ts`; верификация: `migration.test.ts` 8/8 pass, `databaseView.e2e.test.ts` 18/18 pass, final audit => PASS WITH NOTES (только test coverage gap для UI-модалки)
- **UPDATE 2026-04-22 — Wave A prototype started in code**: в Database внедрён quick actions прототип: добавлена типобезопасная модель `quickActions` в `DatabaseViewConfig`, миграция legacy table config теперь инициализирует `Overview Preset` + `Formula Builder`, в `DatabaseViewCanvas.svelte` добавлен quick actions rail с обработкой `apply-template`/`toggle-formula-bar`, добавлен новый шаблон `overview-finance` в `widgetTemplates.ts`; i18n ключи добавлены в `en/ru/uk/zh-CN`; покрытие обновлено в `migration.test.ts` (8/8 pass)
- **UPDATE 2026-04-22 — docs structured + roadmap built**: добавлены `docs/DOCS_INDEX.md` (единая точка навигации) и `docs/ROADMAP_DATABASE_2026.md` (календарный roadmap Database); связность обновлена в `docs/DOCUMENTATION_STRUCTURE.md`, `docs/IMPLEMENTATION_PLAN_CURRENT.md`, `docs/architecture-database-view.md`
- **UPDATE 2026-04-22 — docs inventory normalized**: в `docs/` зафиксирована явная классификация Active/Reference/Archive; обновлены `CODE_STANDARDS*.md` под baseline `839 tests`; исторические спецификации получили пометки archive/reference и ссылку на единый активный план `docs/IMPLEMENTATION_PLAN_CURRENT.md`
- **UPDATE 2026-04-22 — Notion benchmark ingested into Database vector**: визуальные паттерны из пользовательских скриншотов Notion зафиксированы как обязательный UX-вектор для баз, а не как ad-hoc вдохновение; фокус на overview-first IA, quick actions, relation/rollup-first KPI и template-driven data entry
- **UPDATE 2026-04-22 — v3.4.1 published**: release commit `011bb5f5a25862ed79b21d4aa3e3c055b50a2513` запушен в `origin/main`, tag `3.4.1` синхронизирован на тот же SHA и запушен; GitHub Release `3.4.1` опубликован (author `github-actions[bot]`) с ассетами `main.js`, `manifest.json`, `styles.css`
- **UPDATE 2026-04-21 — v3.4.1 release prepared**: собран полноценный patch release `3.4.1` для Board/shared DnD hotfix; синхронизированы `package.json`, `manifest.json`, `versions.json`, исправлен баг в `scripts/version-bump.mjs`, обновлены `CHANGELOG.md`, `RELEASES.md`, `RELEASES-EN.md`, `README.md`, `README-EN.md`, создан снапшот `releases/v3.4.1/` с `main.js`, `manifest.json`, `styles.css`, `RELEASE_NOTES.md`
- **UPDATE 2026-04-21 — v3.4.1 verification**: `npm test` success, `npm run svelte-check` => `0 errors, 0 warnings`, `npm run build` success; runtime package подтверждён как `main.js` + `manifest.json` + `styles.css`, `main.css` отсутствует как и задумано; read-only audit intended payload => no release-blocking findings
- **UPDATE 2026-04-21 — v3.4.0 release notes scoped hotfix note**: принято решение не трогать общий `CHANGELOG.md`/`RELEASES.md` в грязном дереве; точечно обновлён только `releases/v3.4.0/RELEASE_NOTES.md`, добавлен короткий `Post-release Hotfixes` блок про Board column DnD ghost/shadow fix и shared DnD destroy-path cleanup, чтобы packaged release notes соответствовали уже проверенному runtime `main.js`
- **Handoff 2026-04-21**: сохранён компактный handoff по последнему завершённому fix-блоку Board ghost-after-close; подтверждён root cause в `svelte-dnd-action` destroy path, build-time patch в `esbuild.config.mjs` принудительно делает `handleDrop()` для активной origin/shadow zone, `main.css` после merge в `styles.css` автоматически удаляется, `CONTRIBUTING.md` обновлён под runtime package (`main.js`, `manifest.json`, `styles.css`), `npm run build` success, следующий вероятный шаг после user retest — возврат к `Database Wave R2.6 Pipeline Preview per step`
- **Handoff 2026-04-21**: сохранён краткий handoff по восстановлению GitHub Release `3.3.0`; release опубликован как archived binary release, административный тег `3.3.0` указывает на `1d4d1b62ddc3b21e02a7c0a8e54770d676532894`, так как исторический source commit/tag не найден
- **Handoff 2026-04-21**: сохранён build-fix по `npm run svelte-check`; commit `1d4d1b62ddc3b21e02a7c0a8e54770d676532894`, GitHub `Node.js CI` для SHA = success, дерево остаётся грязным только из-за unrelated изменений
- **Версия**: 3.4.1 (published)
- **Дата обновления**: 2026-04-22
- **Тесты**: 42 suites, 839 tests, ALL PASS
- **Компиляция**: tsc 0 errors
- **Сборка**: runtime package = `main.js` + `manifest.json` + `styles.css`; `main.css` теперь считается промежуточным build-артефактом и удаляется после merge
- **Git**: дерево грязное; для следующего шага нужен выборочный stage/commit только release payload `3.4.1` без unrelated файлов
- **v3.4.0 Spec**: `docs/database-view-v3.4.0-spec.md` (полная спецификация модернизации)
- **Refactoring Spec**: `docs/refactoring-spec-v1.md` — 10 волн UX-рефакторинга

### UPDATE 2026-04-22 — Database UX benchmark (Notion-inspired)
- **Почему не попало раньше**: предыдущий фокус сессии был release-critical (3.4.1 ship), а benchmark-выводы были озвучены только в сообщении и не перенесены в формальный roadmap-блок
- **Что фиксируем теперь в общий вектор**:
  - Overview-first структура: верхний уровень `Navigation + Quick Actions`, ниже `Core Databases`
  - Двухконтурный flow для финансов: `Accounts` ↔ `Journal` + агрегаты `Categories/Months`
  - Relation/Rollup-first UX: KPI-карточки и сводные поля как primary surface, а не вторичный отчёт
  - Template-driven creation: one-click `New Income/Expense/Transfer/Account` без длинного form-path
  - Compact control rail: filter/sort/group/visibility всегда рядом с текущим view (без глубоких меню)
  - Multi-view continuity: Table/Board/Gallery как режимы одной модели данных с единым контекстом фильтрации
- **Привязка к ближайшим задачам**:
  - после R2.6 добавить слой `Overview Presets` для Database
  - в R3 включить `Quick Action Bar` и `KPI cards from rollups` как обязательные deliverables
  - добавить отдельные preset-конфиги для finance use-case (`Accounts`, `Journal`, `Monthly Summary`, `Categories`)

### UPDATE 2026-04-21 — Crash Recovery / Wave R2 Saved
- **Wave R2 Pipeline Editor**: завершён в `src/ui/views/Database/widgets/PipelineEditor.svelte`
  - inline FILTER builder: field/operator/value + AND/OR + add/remove conditions
  - AGGREGATE: multi-column editor + aggregation picker
  - PIVOT: aggregation function dropdown
  - UNPIVOT: keepFields chips + fieldGroups pattern/outputName
  - UNNEST: добавлен в меню шагов + field/prefix/keepOriginal UI
  - COMPUTE: multi-column editor
  - dirty-state + discard confirm сохранены
- **Верификация**: `npx tsc --noEmit --skipLibCheck` clean, `npx jest --no-coverage` → 42 suites / 839 tests PASS
- **Git recovery status**:
  - local branch: `main`
  - remote `origin` всё ещё указывает на `https://github.com/ParkPavel/obs-projects-plus.git`
  - `git ls-remote origin` => repository not found (GitHub repo удалён)
  - `gh` CLI отсутствует, автоматическое пересоздание remote из workspace недоступно
- **Recovery result**:
  - локальный backup commit: `00ad70a` — `chore: save current recovery state after crash`
  - создан переносимый backup: `recovery-2026-04-21.bundle`
  - через credential manager получены рабочие GitHub credentials
  - push в `origin/main` выполнен успешно
  - финальная проверка: local `HEAD` == remote `origin/main`, ветка clean / up-to-date
- **Смысл для следующей сессии**: не начинать R2 заново; следующий функциональный шаг после recovery — `R2.6 Pipeline Preview per step`, затем R3 widget config UI

### UPDATE 2026-04-21 — Lint blockers cleared
- Исправлены 4 блокирующие ESLint errors:
  - `src/ui/views/Database/__tests__/databaseView.e2e.test.ts` — `require()` заменён на import
  - `src/ui/views/Database/engine/formulaEngine.ts` — удалён лишний boolean cast (`no-extra-boolean-cast`)
  - `src/ui/views/Database/engine/transformExecutor.test.ts` — тестовый regex переписан без lookbehind для iOS compatibility rule
  - `src/ui/views/Database/widgets/DataTable/groupRows.ts` — `let` → `const`
- Верификация после фикса:
  - `npm run lint` => **0 errors, 169 warnings**
  - `npx tsc --noEmit --skipLibCheck` => clean
- Текущее состояние CI по lint: сборку больше не блокируют ошибки, остался только warning-backlog (unused eslint-disable, tsdoc, no-static-styles-assignment)

### UPDATE 2026-04-21 — Release tag normalized
- Создан и отправлен git tag **`3.4.0`** без префикса `v` по правилу релизных тегов
- Тег указывает на commit `8fe9924403e4ce9e705651dd40d27fcf7f532dfa`
- Проверка: local tag exists, remote `origin` tag exists

### UPDATE 2026-04-21 — GitHub Release workflow fix prepared
- Причина невыпуска GitHub Release: workflow `release.yml` падал с `HTTP 403: Resource not accessible by integration`
- Корень проблемы: `GITHUB_TOKEN` у GitHub Actions не имел `contents: write`
- Локально исправлено: в `.github/workflows/release.yml` и `.github/workflows/ci.yml` добавлено `permissions: contents: write`
- Для фактического автопубликуемого релиза требуется push workflow-фикса в `main`, затем повторный запуск публикации

### UPDATE 2026-04-21 — Release artifacts published
- 4 блокирующих lint-фикса для Database View отправлены в `main`
- Локальный `npm run lint` => **0 errors, 104 warnings**
- Локальный `npm run build` => success
- Создан каталог `releases/v3.4.0/` со слепком сборки: `main.js`, `main.css`, `styles.css`, `manifest.json`, `RELEASE_NOTES.md`
- В GitHub Release `3.4.0` загружены артефакты: `main.js`, `main.css`, `styles.css`, `manifest.json`, `RELEASE_NOTES.md`
- Для хранения release snapshot в git добавлено точечное исключение `.gitignore`: `!releases/*/main.js`
- Проверка GitHub API: release `3.4.0` содержит полный набор из 5 ассетов

### UPDATE 2026-04-21 — svelte-check fixed for GitHub build
- Исправлен GitHub failure на шаге `npm run svelte-check`
- `src/ui/modals/components/CreateField.svelte`:
  - матрица `conversions` ослаблена до partial-типизации по `DataFieldType`
  - `convert()` теперь безопасно работает через optional lookup и fallback без падения на новых enum-типах (`select`, `status`, `formula`, `relation`, `rollup`)
- `src/ui/views/Database/widgets/Chart/ScatterChart.svelte`:
  - убран невалидный CSS `r:` в `:hover`
  - hover-эффект точки переведён на `transform: scale(1.2)` + анимированный `stroke-width`
- Верификация: локальный `npm run svelte-check` => **0 errors, 0 warnings**
- Фикс отправлен в `main` commit `1d4d1b62ddc3b21e02a7c0a8e54770d676532894` (`fix: resolve svelte-check build regressions`)
- Проверка GitHub Actions API: свежий workflow `Node.js CI` для этого SHA завершился со статусом **success**

### UPDATE 2026-04-21 — Restored GitHub Release 3.3.0
- Восстановлен старый стабильный релиз **`3.3.0`** на GitHub
- На remote создан тег `3.3.0`
- В GitHub Release `3.3.0` загружены артефакты из локального снапшота `releases/v3.3.0/`:
  - `main.js`, `main.css`, `styles.css`, `manifest.json`, `RELEASE_NOTES.md`
- Публичная ссылка релиза: `https://github.com/ParkPavel/obs-projects-plus/releases/tag/3.3.0`
- Важный caveat: исходный source commit версии `3.3.0` в текущей git-истории не найден; релиз восстановлен как archived binary release, а тег `3.3.0` создан административно и сейчас указывает на commit `1d4d1b62ddc3b21e02a7c0a8e54770d676532894`

### UPDATE 2026-04-21 — Board column DnD regression fixed
- В промежуточном тестировании выявлен критичный баг нецелевого вида `Board`: при reorder колонок они исчезали/зависали как floating shadow поверх UI
- Root cause: `src/ui/views/Board/components/Board/Board.svelte` не фильтровал `svelte-dnd-action` shadow placeholder из `consider/finalize`, в отличие от уже защищённых мест в Database/Calendar
- Исправление:
  - Board переведён на локальный `dndUnpinnedColumns` state для column DnD вместо мутации реального `columns` prop в `consider`
  - shadow placeholder теперь рендерится явно как lightweight placeholder div, а не исчезает из списка преждевременно
  - сохранение порядка выполняется только на `finalize` с фильтрацией placeholder перед persistence
  - добавлен safe flush `pendingColumnOrder` в `onDestroy`, чтобы не терять reorder при unmount до завершения delayed finalize
  - cleanup timeout/drag-state при destroy
  - второй уровень фикса после повторного репорта пользователя:
    - wrapper/placeholder/dragged clone теперь используют фактический DnD footprint колонки, включая collapsed path (`48px` вместо полного `columnWidth`)
    - добавлен `animate:flip` на DnD wrapper для стабильного reposition после reorder
    - `transformDraggedElement` теперь нормализует размеры clone по реальному wrapper width, а не по глобальному `columnWidth`
    - снятие local drag guard теперь ждёт подтверждённого порядка из входного `columns`, а не только таймера
    - column reorder намеренно отключён при `zoom !== 1`, потому что Board использует `transform: scale(...)`, что ломает координатную систему `svelte-dnd-action`
- Вывод по происхождению бага: это не Database-specific поломка логики Board, а побочный эффект общей DnD-инфраструктуры/паттерна работы с `svelte-dnd-action` placeholder items
- Верификация:
  - `get_errors` для `Board.svelte` => clean
  - локальный `npm run svelte-check` => **0 errors, 0 warnings**
  - короткий аудит => **no findings**, остался только тестовый gap без runtime DnD automation

### UPDATE 2026-04-21 — Shared DnD destroy-path + build packaging corrected
- Поднят полный контекст после повторного репорта пользователя: проблема Board оказалась не только локальной логикой списка, а дефектом shared destroy-path в `svelte-dnd-action`
- Подтверждённый root cause:
  - dragged clone выносится библиотекой в `body`
  - при destroy активной dnd-zone библиотека раньше только откладывала удаление zone до post-drop и не делала forced cleanup dragged clone/listeners
  - если view закрывался во время drag, ghost мог оставаться поверх UI даже после закрытия вида
- Исправление внесено в shared build patch `esbuild.config.mjs`:
  - для `svelte-dnd-action` добавлен patch `scheduleDZForRemovalAfterDrop(node, destroyDz)` → forced `handleDrop()` when destroyed zone is active drag origin/shadow zone
  - старый patch `multiScroller?.destroy()` сохранён
- Дополнительная системная правка сборки:
  - `main.css` признан промежуточным build output, а не runtime-ассетом плагина
  - после merge в `styles.css` файл `main.css` автоматически удаляется
  - `CONTRIBUTING.md` обновлён: локальная установка снова соответствует Obsidian packaging contract (`main.js`, `manifest.json`, `styles.css`)
- Ключевой процессный вывод:
  - предыдущие source-правки без `npm run build` не могли гарантированно проявиться в Obsidian, потому что runtime загружает только `main.js`
- Верификация:
  - `npm run build` => success
  - `main.js` пересобран
  - `styles.css` обновлён
  - `main.css` после build отсутствует

### UPDATE 2026-04-21 — Board drag geometry corrected for scaled rendering
- После пользовательского ретеста подтверждён остаточный дефект: ghost больше не зависает, но column drop/hit-test оставался нестабильным и ухудшался при увеличении масштаба
- Локализована причина в `src/ui/views/Board/components/Board/Board.svelte`:
  - `transformDraggedElement` принудительно задавал dragged clone логическую ширину колонки (`columnWidth`/footprint), а не фактический rendered size на экране
  - при увеличенном масштабе это давало растущий рассинхрон между clone и placeholder/hit-test зоной reorder
- Исправление:
  - dragged clone теперь получает width/height из `element.getBoundingClientRect()` вместо логической ширины из dataset
  - placeholder footprint для списка сохранён отдельным и не изменён
- Верификация:
  - `get_errors` для `Board.svelte` => clean
  - `npm run build` => success

### КРИТИЧЕСКАЯ ПРОБЛЕМА (2026-04-20)
Пользовательское тестирование выявило: backend мощный (115 формул, 6 pipeline шагов, 8 виджетов), но UI не позволяет использовать большинство функций. Pipeline FILTER/UNPIVOT/UNNEST не имеют UI. 5 из 8 виджетов без настроек. Формулы не материализуются в колонки. Таблица — legacy дизайн. Шаблоны ломаются на не-демо проектах. Демо-проект не показывает настроенную базу.

### Следующий шаг: Wave R2 (Pipeline Editor Complete Rewrite)

### Wave 8 — Tech Debt Cleanup (ЗАВЕРШЕНО)
- **Phase 8.1**: DRY ISO_WEEK — `d.isoWeek()` вместо 6 строк ручного кода, убрано дублирование dayjs.extend (filterFunctions.ts), расширен Jest setup.ts
- **Phase 8.2**: DRY aggregation — `computeAggregateValue()` в aggregation.ts, удалены локальные дубли в StatsCard.svelte и SummaryRowWidget.svelte (~80 LOC удалено)
- **Phase 8.3**: DRY PMT helper — `pmtCore()`, `fvBeforePeriod()`, `ipmtForPeriod()` в formulaEngine.ts, рефакторены PMT/IPMT/PPMT/CUMPRINC/CUMIPMT (~50 LOC дублирования удалено)
- **Phase 8.4**: handleRowEdit type safety — `Record<string, any>` → `Record<string, Optional<DataValue>>` в DataTableWidget.svelte
- **Phase 8.5**: migration idCounter → `crypto.randomUUID()` — migration.ts + DatabaseViewCanvas.svelte (stateless UUID, no counter leaks)
- **Phase 8.6**: U13 XSS in onboarding — `sanitizeHtml()` whitelist sanitizer (lib/helpers/sanitizeHtml.ts), Onboarding.svelte `{@html ts(...)}` вместо `{@html t(...)}`

### Wave 7 — Security + Notion Parity (ЗАВЕРШЕНО)
- **Phase 7.0**: P1/P2 security fixes
  - ReDoS protection: `regexSafety.ts` shared util (isUnsafePattern + MAX_REGEX_INPUT_LENGTH=10K)
  - Stack overflow: MAX_EVAL_DEPTH=64 в formulaEngine evaluateNode
  - DoS iteration: MAX_LIST_ITEMS=10K для MAP/FILTER/REDUCE
- **Phase 7.1**: Bi-directional relations
  - `computeBacklinks()` + `enrichWithBacklinks()` в relationResolver.ts
  - WidgetHost.svelte: auto-enrichment (reactive $: enrichedFrame)
  - Derived `X_backlinks` fields with DataFieldType.Relation
- **Phase 7.2**: Multi-key sort per widget
  - `DataTableSortCriteria` interface в types.ts
  - `onDataSort` prop в DataGrid → context menu "Sort A→Z / Z→A"
  - sortRecords applied to records before rendering
  - Sort indicator in column headers via `column.sort`
- **Phase 7.3**: Sub-groups (2-level)
  - `subGroupField` + `subGroupSortOrder` в GroupConfig
  - `buildSubGroups()` в groupRows.ts
  - Nested GroupHeader rendering с level-based indentation
- **Phase 7.4**: Record templates + auto-fill
  - `defaultValues?: Record<string, string>` в DataTableConfig
  - `handleAddRow(groupKey?)` — auto-fill group field value
  - All DataGrid onRowAdd callbacks updated

### Фаза v3.4.0 — Database View Modernization
- **Статус**: Wave 1–5 ЗАВЕРШЕНЫ (все 5 волн)
- **Wave 1 результаты**:
  - **U1**: ViewConfigTab i18n — 30+ hardcoded строк → `$i18n.t()`, 4 локали обновлены
  - **U6**: PopoverDropdown shared — `src/ui/components/popoverDropdown.ts` (~190 LOC), FiltersTab/SortTab/ColorFiltersTab рефакторены (удалено ~400 LOC дублирования)
  - **U4**: Project Quick-Switcher — кнопка с именем проекта в CompactNavBar, searchable popover через shared module, i18n ключи в 4 локалях
- **Wave 2 результаты**:
  - **A2**: COMPUTE→FormulaEngine unification — `evaluateFormulaValue()` заменил `evaluateExpression()`, поддержка скобок, вложенных функций, оператор приоритет (* before +)
  - **A9**: Relative date filters — 8 новых операторов (`is-today`, `is-this-week`, `is-this-month`, `is-this-quarter`, `is-last-n-days`, `is-next-n-days`, `is-overdue`, `is-upcoming`), dayjs isoWeek+quarterOfYear
  - **Financial (11)**: PMT, FV, PV, NPV, IRR, RATE, IPMT, PPMT, NPER, CUMPRINC, CUMIPMT
  - **Statistical (8)**: VARIANCE, VARIANCE_S, PERCENTILE, QUARTILE, CORREL, MODE, RANK, STD_DEV_S
  - **Conditional (3)**: SUMIF, COUNTIF, AVERAGEIF
  - **Duration (6)**: DAYS, HOURS, MINUTES, TO_DAYS, TO_HOURS, WORKDAYS
  - **Enhanced Math (7)**: MEDIAN, PRODUCT, MOD, EVEN, ODD, PI, RANDOM_INT
  - **Enhanced String (8)**: LEFT, RIGHT, MID, REGEX_MATCH, REGEX_REPLACE, JOIN, REPEAT, ENCODE_URL
  - **Conversion/Logic (4)**: TO_CURRENCY, TO_PERCENT, LET (stub), IFBLANK
  - **Date (3)**: END_OF_MONTH, WEEKDAY_NAME, ISO_WEEK
  - **Aggregate-aware (6)**: SUM, AVG, COUNT, MIN, MAX, STD_DEV — work with @column refs
  - **Cross-record @reference**: `@fieldName` syntax → column_ref AST node → resolves all column values from DataFrame
  - **Parser upgrade**: 50+ new functions registered, operator precedence fix (additive/multiplicative layers)
  - **Total formulas**: 42 → 98 functions
- **Wave 3 результаты**:
  - **A7**: ScatterChart — SVG scatter plot (trend line, R², color grouping, point sizing), `computeScatterData()` pipeline
  - **Stats sparkline**: optional inline sparkline in StatsCard (`buildSparkline()` polyline)
  - **Comparison N-metrics**: refactored to support N metrics array (backward compat for old metricA/metricB), mode: absolute/percentage/normalized
  - **FilterTabs widget**: new widget — unique field values as clickable tabs, "All" tab, ARIA tablist, dispatches filter event
  - **SummaryRow widget**: new widget — compact aggregation bar (count, sum, avg, median, min, max, range, etc.)
  - **ChartConfig progressive disclosure**: `<details>` sections for display/scatter options, scatter-specific config panel
  - **Chart type**: 9 → 10 (added scatter)
  - **Widget types**: 6 → 8 (added filter-tabs, summary-row)
  - **i18n**: 15+ keys added to all 4 locales (scatter, filter-tabs, summary-row)
  - **TS fixes**: filterOperatorTypes now includes all 8 relative date operators, formulaEngine.test uses DataFieldType enum, chartDataPipeline proper spread construction
- **Тесты**: 42 suites, 800 tests (+8 merge tests, +13 Wave 3), ALL PASS
- **Следующая**: ✅ Все волны завершены. Готов к релизу v3.4.0.
- **Wave 4 результаты**:
  - **A4**: DateTime precision — non-midnight Dataview dates now preserve time (HH:mm)
  - **A5**: Dataview query validation UI — debounced preview in CreateProject, shows row/task count or error
  - **A3**: Dataview LIST/TASK support — `parseListResult()`, `parseTaskResult()` with recursive flattening
  - **A1**: Multi-source merge — `additionalSources?: DataSource[]` in ProjectDefinition, `mergeDataFrames()` engine (union fields, dedup records), DataFrameProvider multi-source resolution, CreateProject UI for managing additional sources, i18n in 4 locales
  - **Tests**: mergeFrames.test.ts (8 tests: empty, single, union fields, concat records, dedup, 3-frame merge)
- **Wave 5 результаты (Polish)**:
  - **U11**: Recursive FormulaNode — `<svelte:self>` для неограниченной вложенности AST, CSS → `:global()` pattern
  - **U9**: Formula autocomplete kbd nav — ArrowUp/Down/Enter/Tab, wrap-around, ARIA listbox
  - **U5**: ARIA tab roving — SettingsMenuTabs, ViewSwitcher, FilterTabsWidget (Home/End/Space/Enter)
  - **U7**: DataGrid ARIA grid — `aria-label`, `aria-rowindex` on cells
  - **U14**: Touch visibility — `@media (pointer: coarse)` for hover-only buttons
  - **U10**: Pipeline dirty state — JSON.stringify diff, confirm-on-discard dialog
  - **U8**: Widget resize handles — `use:resizable` Svelte action, pointer drag, grid-snap, callback pattern 42→100 формул, 11 финансовых, 8 статистических, scatter chart, multi-source merge, inline add row, ARIA accessibility
- **Estimated new code**: ~4,300 LOC + ~1,330 LOC tests
- **5 волн**: Infrastructure → Computation → Visualization → Data Integration → Polish
- **Конкурентный анализ**: Notion (formulas, views), Airtable (Interface Designer), Coda (200+ formulas)
- **Персоны**: PM (Elena), Financial (Mikhail), Academic (Anna), Creator (Dima), Lead (Sara)
- **6 сценариев**: Financial Dashboard, Academic Analysis, Sprint Planning, Content Calendar, Quick Switching, Formula Power User

---

## Архитектура (текущая)

### Стек
TypeScript strict + Svelte 3.59.2 + esbuild CJS + Jest 29 + i18next (en/ru/uk/zh-CN)

### Конвейер данных
```
DataSource[] (folder|tag|dataview) → queryAll() → DataFrame[] → mergeDataFrames() → DataFrame {fields[], records[]}
  → RelationResolver (wiki-links → target records)
  → FormulaEngine (115 fn, per-record, cross-record @reference)
  → RollupEngine (12 fn, cross-record)
  → FilterEngine (31 operators incl. 8 relative date, AND/OR groups, depth ≤ 20)
  → SortEngine (multi-key, type-aware, natural sort)
  → TransformPipeline per-widget (UNPIVOT→COMPUTE→FILTER→GROUP-BY→AGGREGATE→PIVOT)
  → Widget render (8 types: DataTable, Chart, Stats, Comparison, Checklist, ViewPort, FilterTabs, SummaryRow)
```

### Ограничения архитектуры
- ~~1 проект = 1 DataSource (нет cross-project JOIN/merge)~~ → ✅ SOLVED (A1: multi-source merge)
- ~~Dataview: только TABLE-запросы, read-only, DateTime обрезается до YYYY-MM-DD~~ → ✅ SOLVED (A3: LIST/TASK, A4: DateTime precision)
- ~~COMPUTE step: только +−×÷, без скобок, без вызовов функций~~ → ✅ SOLVED (A2: FormulaEngine unified)
- ~~Финансовые функции: 0 из 11~~ → ✅ SOLVED (A6: 11 financial functions)
- ~~Статистические: только STD_DEV~~ → ✅ SOLVED (8 statistical + 6 aggregate-aware)

### Views (5 зарегистрированных)
| View | Статус | Ключевые возможности |
|------|--------|---------------------|
| Database | ✅ Основной | 8 виджетов, pipeline, 115 формул, условное форматирование, resize, multi-source |
| Board | ✅ Стабильный | Kanban DnD, grouping, pin, zoom 0.25–2× |
| Calendar | ✅ Стабильный | Agenda, timeline, DnD reschedule/resize, heatmap |
| Gallery | ✅ Стабильный | Cover images, fit modes, responsive |
| Table | ⚠️ Deprecated | Баннер миграции → Database, auto-migration в settings |

---

## История релизов (сводка)

### v3.3.2 — Runtime + Performance (текущий, uncommitted)
- svelte-dnd-action multiScroller?.destroy() patch
- Rollup O(n²)→O(n), UNPIVOT O(n·k·m)→O(n·k)
- Safety caps: 100K records, depth 20, 500 wikilinks
- Legacy Table→Database auto-migration + TableView removed
- ViewConfigTab reactive binding fix (let→$:, 25+ vars)
- DnD performance (5 fixes), CSS perf (blur removed, shadow→outline)

### v3.3.1 — Modernization
- i18n corruption fix (ru/uk 16 keys)
- Table column alignment (scroll container)
- Adaptive column widths, aggregation picker (Obsidian Menu API)
- Error boundary, Chart/Stats wizard fallback
- Formula visual operators (+10)
- Deprecation banner, demo vault, user guide

### v3.3.0 — Database View (6 phases)
- Phase 1: Foundation (types, transforms, aggregation, migration, canvas, DataTable)
- Phase 2: Formulas (42 fn), conditional format, grouping, pipeline editor, Select/Status cells
- Phase 3: Charts (9 types SVG), Stats, transform cache, PIVOT
- Phase 4: Relations, Rollups, Comparison, Checklist widgets
- Phase 5: ViewPort, virtual scroll, accessibility, design tokens, templates
- Phase 6: Deep integration (all engines wired to UI), DnD reorder, mobile

### v3.3.0 Hotfixes
- HF1: PieChart restore, DataTable row open/edit, column operations
- HF2: ChecklistWidget wiki-links, StatsWidget defaults, chart labels

### Closing Audit
- Security: CSS injection (StatsCard, GroupHeader), ReDoS order fix
- Quality: WidgetToolbar dismiss, WidgetHost safe cast
- Bot compliance: activeDocument, clipboard wrapper, ReDoS filterEngine

### Pre-v3.3.0
- v3.2.1: JSON.parse safety, filterFunctions case-insensitive, formulaParser tests
- v3.2.0: Drag & Drop 2.0
- Bot review fixes: async callback, CSS classes, assertions, eslint reasons

---

## Известные проблемы (открытые)

### UI/UX (из аудита 2026-04-16)
| # | Sev | Проблема |
|---|-----|----------|
| U1 | P1 | ViewConfigTab: ~40 hardcoded Russian strings (не через $i18n.t) |
| U2 | P1 | SettingsMenuPopover: DOM querying для sidebar detection |
| U3 | P1 | Calendar field mapping: text input без валидации |
| U4 | P2 | Project switching = 3 клика (нет quick-switcher) |
| U5 | P2 | SettingsMenuTabs: нет ARIA tab roving (ArrowLeft/Right) |
| U6 | P2 | FiltersTab/SortTab/ColorFiltersTab: 3× дублированный imperative popover |
| U7 | P2 | DataGrid: нет aria-label, columnheader roles, activedescendant |
| U8 | P2 | ConfigureField: тип поля disabled без объяснения |
| U9 | P2 | FormulaBar: autocomplete без keyboard nav (ArrowUp/Down) |
| U10 | P2 | PipelineEditor: нет dirty-state/confirm при закрытии |
| U11 | P2 | FormulaVisualEditor: max 2 уровня вложенности (не рекурсивный) |
| U12 | ~~P2~~ | ~~ChartConfig: все опции плоским списком (нет progressive disclosure)~~ ✅ Wave 3 |
| U13 | P2 | Onboarding: {@html} с i18n = potential XSS |
| U14 | P3 | ProjectTab: hover-only actions невидимы на touch |
| U15 | P3 | DatabaseViewCanvas: символьные иконки (−, +, ƒx, ⊞) |

### Архитектурные
| # | Проблема | Статус |
|---|----------|--------|
| A1 | Нет cross-project queries / multi-source merge | Open |
| A2 | ~~COMPUTE step не использует FormulaEngine~~ | ✅ Wave 2 |
| A3 | Dataview: LIST/TASK не поддержаны | Open |
| A4 | Dataview: DateTime precision loss | Open |
| A5 | Dataview: нет validation UI / graceful error handling | Open |
| A6 | ~~Нет финансовых функций~~ | ✅ Wave 2 (11 fn) |
| A7 | ~~Нет correlation/scatter chart~~ | ✅ Wave 3 (ScatterChart + R²) |
| A8 | Нет inline add row в таблице | Open → Wave 4 |
| A9 | ~~Нет relative date filters~~ | ✅ Wave 2 (8 ops) |

### Deferred (tech debt)
- migration.ts: idCounter → crypto.randomUUID()
- DRY aggregation logic (4× duplication)
- transformExecutor regex cache
- WEEK computation duplication

---

## Каскадный план модернизации v3.4.0

> Принцип: каждый решённый блок создаёт инфраструктуру для следующего.

### Волна 1: ViewConfigTab i18n → Shared Popover → Project Switcher
**Цепочка**: U1 → U6 → U4

1. **U1: ViewConfigTab i18n** (~40 hardcoded Russian → $i18n.t)
   - **Выход**: все строки ViewConfigTab локализованы
   - **Разблокирует**: consistent i18n pattern для U4 (project switcher)
   
2. **U6: Shared Popover component** (extract 3× duplicated popover)
   - **Выход**: `PopoverDropdown.svelte` — reusable, Escape/click-outside
   - **Разблокирует**: U4 (project switcher dropdown), U9 (formula autocomplete), A5 (Dataview validation)

3. **U4: Project Quick-Switcher** (dropdown в navbar)
   - **Выход**: 1 клик вместо 3 для смены проекта
   - **Разблокирует**: UX-базу для multi-source (A1) — пользователь видит проекты как first-class

### Волна 2: COMPUTE upgrade → Financial functions → Relative dates
**Цепочка**: A2 → A6 → A9

4. **A2: COMPUTE step → FormulaEngine** (унификация)
   - **Выход**: COMPUTE поддерживает скобки, IF, ROUND, все 42 функции
   - **Разблокирует**: A6 (финансовые функции получат полный доступ через COMPUTE)

5. **A6: Financial functions** (PMT, FV, PV, NPV, IRR, RATE + IPMT, PPMT, NPER)
   - **Выход**: 11 новых функций в FormulaEngine
   - **Разблокирует**: кредитные калькуляторы, бюджетное планирование

6. **A9: Relative date filters** (this-week, last-month, next-N-days)
   - **Выход**: ~8 новых операторов в FilterEngine
   - **Разблокирует**: динамические дашборды (задачи на этой неделе, просроченные)

### Волна 3: Статистика → Scatter chart → Cross-project
**Цепочка**: stats → A7 → A1

7. **Statistical functions** (VARIANCE, PERCENTILE, QUARTILE, CORREL)
   - **Выход**: 6 новых функций в FormulaEngine + aggregation
   - **Разблокирует**: A7 (scatter chart с корреляцией)

8. **A7: Scatter/Correlation chart**
   - **Выход**: новый тип chart (X vs Y, R², trend line)
   - **Разблокирует**: visual analytics для cross-project данных

9. **A1: Multi-source merge** (composite datasource)
   - **Выход**: UNION ALL / LEFT JOIN по ключу
   - **Разблокирует**: cross-project корреляции, сводные дашборды

### Волна 4: Dataview deep + Table UX
**Цепочка**: A5 → A3 → A4 → A8

10. **A5: Dataview query validation UI** (live preview, error display)
    - **Выход**: безопасная работа с Dataview
    - **Разблокирует**: A3 (LIST/TASK — пользователь видит результат)

11. **A3: Dataview LIST/TASK support**
    - **Выход**: task checkboxes, completion tracking через Dataview
    - **Разблокирует**: task management workflows

12. **A4: DateTime precision** (сохранять HH:mm)
    - **Выход**: timeline события с временем из Dataview
    
13. **A8: Inline add row** (+ New в таблице)
    - **Выход**: Notion-like UX добавления записей

### Волна 5: Accessibility + Polish
14. **U5/U7: ARIA tab roving + grid accessibility**
15. **U9: Formula autocomplete keyboard nav** (использует PopoverDropdown из Волны 1)
16. **U12: ChartConfig progressive disclosure**
17. **U14: Touch visibility** (@media pointer: coarse)
18. **U11: FormulaVisualEditor рекурсивный рендер**
