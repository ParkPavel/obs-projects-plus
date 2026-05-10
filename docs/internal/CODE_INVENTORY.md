# CODE_INVENTORY.md

> **Версия**: V5.1 — 2026-05-07
> **Статус**: ACTIVE
> **Метод сбора**: `find` + `wc -l` для LOC, `Grep` для проверки imports / @deprecated / @ts-ignore.
> **Scope**: вся папка `src/`, кроме `__tests__/`, `__mocks__/`, `*.test.ts`. Пустые `index.ts` re-exports суммированы как «+N re-exports» по папкам.
> **Test baseline**: 102 suites / 1650 tests PASS (`npx jest`, 23 s).

## Легенда

- **Quality**: A (clean, idiomatic), B (good с минорными замечаниями), C (рабочий но требует внимания), D (запутан/перегружен), F (broken).
- **Status**: `active` / `deprecated` (явное @deprecated) / `broken` / `unused` / `ready-but-unwired` (экспортируется, но не импортируется в production) / `shared-lib` (используется как библиотека несколькими видами) / `wrapper` (тонкая обёртка, делегирует в каноническую реализацию).
- **⚠️**: аномалия — TODO / @ts-ignore / parallel duplicate / иной debt.

---

## 1. Entry points

- `src/main.ts` (542) — Plugin shell, регистрирует команды, settings, VisualizerPaneView, RelationPickerModal. Quality: B. Status: active.
- `src/view.ts` (189) — регистрирует ProjectView (главный view). Quality: A. Status: active. ⚠️ комментарий на :18-21: «YamlVisualizer is no longer registered as a top-level view ... must be a widget inside Database» — подтверждает план R5-011/012.
- `src/customViewApi.ts` (56) — публичный API для custom views (`updateProps`). Quality: A. Status: active.
- `src/events.ts` (70) — глобальная event bus для плагина. Quality: A. Status: active.
- `src/global.d.ts` (22) — global type declarations. Quality: A. Status: active.
- `src/obsidianProjects.d.ts` (49) — внешний API контракт. Quality: A. Status: active.

---

## 2. Core lib — engine

### `src/lib/engine/`
- `filterEvaluator.ts` (383) — **canonical** filter kernel; принимает `baseDateCtx?: Dayjs` (R5-003 готовность). Quality: A. Status: shared-lib.
- `aggregate.ts` (174) — kernel свёрток (sum/avg/count/min/max/...). Quality: A. Status: shared-lib.
- `contracts.ts` (279) — типы фильтров и pipeline. Quality: A. Status: shared-lib.
- `crossProjectResolver.ts` (253) — resolve `[[wikilink]]` → records через cross-project. Quality: A. Status: shared-lib.
- `crossProjectRollup.ts` (137) — rollup поверх cross-project relations. Quality: A. Status: shared-lib.
- `wikilink.ts` (102) — парсинг wikilinks. Quality: A. Status: shared-lib.
- `emptiness.ts` (40) — проверка пустых значений (consistent semantics). Quality: A. Status: shared-lib.

### `src/lib/formula/`
- `extendedEvaluator.ts` (1156) — **canonical** formula evaluator (~95+ функций, превосходит Notion). Quality: B (большой, но связный). Status: shared-lib.
- `index.ts` (53) — единая точка входа для formula API.

### `src/lib/helpers/formulaParser.ts` (819)
Advanced-filter formula parser (старая система). Quality: C. Status: ⚠️ **частично deprecated** — есть @deprecated аннотации, но всё ещё импортируется как parser AST. R5-002 Phase 1 закрыт, Phase 2 (полное вытеснение) deferred. **Кандидат на сокращение** в Фазе пост-V5.4.

### `src/lib/relations/`
- `crossSubBase.ts` (157) — relations между sub-base'ами. Quality: A. Status: shared-lib (используется R5-009/R5-010).
- `inverseIndex.ts` (158) — обратный индекс (B знает о A). Quality: A. Status: shared-lib.
- `inverseIndexStore.ts` (122) — Svelte store обёртка. Quality: A. Status: shared-lib.
- `contracts.ts` (83) — типы relations. Quality: A. Status: shared-lib.

### `src/lib/database/`
- `rollupMode.ts` (365) — Notion-style rollup picker taxonomy + mode→engine mapping. Quality: A. Status: active. (Используется `ConfigureField.svelte`.)
- `subBase.ts` (138) — модель sub-base (источник, fields). Quality: A. Status: ready-but-partially-wired (через `SubBaseTabs` в DataTable widget; для R5-009 нужен SubBaseCanvas widget).
- `subBasePartition.ts` (111) — разбиение записей по sub-bases. Quality: A. Status: shared-lib.
- `cellEditor.ts` (192) — inline editor для ячеек. Quality: B. Status: active.
- `cellEditorWriter.ts` (32) — пишет результат editor в frontmatter. Quality: A. Status: active.

### `src/lib/dataframe/dataframe.ts` (191)
DataFrame ядро (records, fields, types). Quality: A. Status: shared-lib (фундамент).

### `src/lib/datasources/`
- `folder/datasource.ts` (89) — folder source (нативный, без зависимостей). Quality: A. Status: active.
- `tag/datasource.ts` (51) — tag source. Quality: A. Status: active.
- `dataview/datasource.ts` (236) — Dataview DQL source. Quality: B. Status: active. ⚠️ требует opt-in plugin Dataview — graceful degradation описан в `DATAVIEW_ABSORPTION_PLAN.md`.
- `dataview/standardize.ts` (47) — нормализация Dataview результатов. Quality: A. Status: active.
- `dataview/schema.ts` (18) — schema reflection. Quality: A. Status: active.
- `frontmatter/datasource.ts` (183) — generic frontmatter source. Quality: A. Status: active.
- `frontmatter/standardize.ts` (16) — нормализация. Quality: A. Status: active.
- `helpers.ts` (276) — общие утилиты для всех datasources. Quality: B. Status: shared-lib.
- `mergeFrames.ts` (37) — слияние нескольких frames. Quality: A. Status: shared-lib.
- `index.ts` (44) — registry datasources.

### `src/lib/frontmatter/`
- `reader.ts` (76) — чтение frontmatter из TFile. Quality: A. Status: shared-lib.
- `writer.ts` (109) — запись frontmatter обратно. Quality: A. Status: shared-lib.
- `codec.ts` (75) — encode/decode YAML значений. Quality: A. Status: shared-lib.
- `contracts.ts` (112) — типы. Quality: A. Status: shared-lib.

### `src/lib/metadata/`
- `decode.ts` (72) — type decoders (string→Date/Number/...). Quality: A. Status: shared-lib.
- `encode.ts` (95) — type encoders. Quality: A. Status: shared-lib.

### `src/lib/colors/`
- `contracts.ts` (81) — палитры контракты. Quality: A. Status: shared-lib.
- `math.ts` (132) — color manipulation (hue, contrast). Quality: A. Status: shared-lib.

### `src/lib/visualizer/`
Backend для VisualizerPane / YamlVisualizer:
- `overlay.ts` (261) — overlay state. Quality: B. Status: active.
- `overlayWriter.ts` (61) — overlay writer. Quality: A. Status: active.
- `propertyTypes.ts` (111) — тип-система. Quality: A. Status: active.
- `propertyTypesWriter.ts` (60) — пишет `pp_types` map. Quality: A. Status: active.
- `colors.ts` (98) — цветовая логика visualizer. Quality: A. Status: active.
- `linkRender.ts` (79) — рендер wikilinks. Quality: A. Status: active.
- `relations.ts` (97) — relation utilities для visualizer. Quality: A. Status: active.
- `relationsWriter.ts` (59) — relations writer. Quality: A. Status: active.

### `src/lib/duplicate/`
Calendar duplicate-event subsystem (Calendar feature, не related to deduplication):
- `multiDaySelection.ts` (149), `phantomRecord.ts` (133), `collisionDetector.ts` (88), `types.ts` (57). Quality: A-B. Status: shared-lib (used by Calendar).

### `src/lib/filesystem/`
- `filesystem.ts` (82) — abstract filesystem interface. Quality: A. Status: shared-lib.
- `obsidian/filesystem.ts` (220) — Obsidian-backed impl. Quality: A. Status: active.
- `inmem/filesystem.ts` (135) — in-memory impl для тестов. Quality: A. Status: shared-lib (test-helper).

### `src/lib/stores/`
Svelte stores:
- `settings.ts` (357), `ui.ts` (224), `dataframe.ts` (152), `i18n.ts` (152), `palettes.ts` (94), `duplicateStore.ts` (286), `commandBus.ts` (45). Quality: A-B. Status: active. ⚠️ `dataframe.ts:27` — `@ts-ignore` (immer/TS2589 known issue).
- Мелкие: `api.ts` (9), `capabilities.ts` (10), `customViews.ts` (5), `events.ts` (17), `externalFrameInvalidation.ts` (16), `fileSystem.ts` (5), `obsidian.ts` (9). Quality: A. Status: shared-lib.

### `src/lib/helpers/`
- `formulaParser.ts` (819) — см. выше (legacy).
- `dateFormulaParser.ts` (325) — date-formula preprocessor. Quality: B. Status: active.
- `gestureHandler.ts` (465) — общие gesture-utils для Calendar. Quality: B. Status: shared-lib.
- `dateFormatting.ts` (160), `performance.ts` (244), `removeDanglingSourceReferences.ts` (111), `clipboard.ts` (27), `animation.ts` (23), `regexSafety.ts` (18), `sanitizeHtml.ts` (16). Quality: A. Status: shared-lib.

### Прочие top-level
- `src/lib/dataApi.ts` (354) — публичный data-API для custom views. Quality: B. Status: active.
- `src/lib/contextMenu.ts` (205) — `openContextMenu()` helper (R5-006 canonical). Quality: A. Status: shared-lib.
- `src/lib/externalFrameResolver.ts` (79) — external frame resolver. Quality: A. Status: shared-lib.
- `src/lib/helpers.ts` (198) — legacy global helpers. Quality: C. Status: ⚠️ **дубликат с `lib/helpers/`** (директорией). Кандидат на разбор/перенос.
- `src/lib/obsidian.ts` (93) — Obsidian app shortcuts. Quality: A. Status: shared-lib.
- `src/lib/viewApi.ts` (85) — view API. Quality: A. Status: shared-lib.
- `src/lib/templates/interpolate.ts` (19) — template interpolation. Quality: A. Status: shared-lib.
- `src/lib/types/validation.ts` (81) — runtime type validators. Quality: A. Status: shared-lib.

---

## 3. Settings

- `src/settings/settings.ts` (233) — текущая chain v1→v2→v3→v4. Quality: A. Status: active.
- `src/settings/base/settings.ts` (330) — базовые типы. Quality: A. Status: active.
- `src/settings/v1/settings.ts` (119), `v2/settings.ts` (223), `v3/settings.ts` (486), `v4/settings.ts` (234) — versioned migrations. Quality: A. Status: active. (R5-008 закрыт V5.3.)

---

## 4. Managers

- `src/managers/CommandManager.ts` (142) — команды плагина (register/dispatch). Quality: A. Status: active.

---

## 5. UI — app

- `src/ui/app/App.svelte` (369) — root component. Quality: B. Status: active.
- `src/ui/app/View.svelte` (282) — view shell (cross-project enrichment + filter cascade). Quality: B. Status: active.
- `src/ui/app/DataFrameProvider.svelte` (153) — dataframe context provider. Quality: A. Status: active. (R5-007 JSON.parse safety применён.)
- `src/ui/app/useView.ts` (110) — ProjectView lifecycle hook. Quality: A. Status: active.
- `src/ui/app/viewSort.ts` (117) — сортировка views. Quality: A. Status: shared-lib.
- `src/ui/app/viewHelpers.ts` (51) — `extractRelationTargetIds`, `getRecordColor` (R5-014). Quality: A. Status: shared-lib.
- `src/ui/app/filterFunctions.ts` (23) — UI-level filter helpers. Quality: A. Status: active.
- `src/ui/app/onboarding/Onboarding.svelte` (90), `TabContainer.svelte` (38), `onboardingModal.ts` (31). Quality: A. Status: active.
- `src/ui/app/onboarding/demoProject.ts` (1842), `demoVerticals.ts` (212) — демо-данные. Quality: B. Status: active. ⚠️ `demoProject.ts` 1842 LOC — большой data-файл, не код, не блокирует.

---

## 6. UI — shared components

### `src/ui/components/Navigation/`
- `ViewSwitcher.svelte` (345) — переключатель видов. Quality: B. Status: active.
- `CompactNavBar.svelte` (177) — компактный navbar. Quality: B. Status: active.
- `ViewSpecificActions.svelte` (47), `AddViewButton.svelte` (17), `SettingsMenuButton.svelte` (17). Quality: A. Status: active.

### `src/ui/components/Navigation/SettingsMenu/`
- `SettingsMenuPopover.svelte` (328) — popover контейнер. Quality: B. Status: active.
- `SettingsMenuTabs.svelte` (141) — табы меню. Quality: A. Status: active.
- `tabs/ViewConfigTab.svelte` (766), `FiltersTab.svelte` (552), `ViewsTab.svelte` (426), `ColorFiltersTab.svelte` (331), `SortTab.svelte` (205), `ProjectTab.svelte` (147), `filterHelpers.ts` (134). Quality: B-C. Status: active. ⚠️ `ViewConfigTab.svelte` 766 LOC — кандидат на split (но не блокирующий).

### `src/ui/components/FieldControl/FieldControl.svelte` (534)
Универсальный field-control (input для всех DataFieldType). Quality: B. Status: shared-lib (R5-005 палитры применены).

### `src/ui/components/ColorPicker/ColorPicker.svelte` (793)
Полный picker с favorites + swatches. Quality: B. Status: active. (R5-005 palette store wired.)

### `src/ui/components/ImagePreview/ImagePreview.svelte` (262)
Quality: A. Status: active.

### `src/ui/components/CardMetadata/`
Inline previews для Calendar/Gallery (Checkbox, Date, Datetime, Number, Tags, Text, CardMetadata.svelte). Quality: A. Status: shared-lib.

### Прочие
- `MultiTextInput.svelte` (346), `popoverDropdown.ts` (202), `ErrorBoundary.svelte` (227), `TagsInput.svelte` (193), `Tag.svelte` (143), `TagInput.svelte` (97), `TagList.svelte` (65), `RichTextTag.svelte` (85), `DatetimeInput.svelte` (163), `DateInput.svelte` (85), `InternalLink.svelte` (137), `TimePicker.svelte` (100), `FormulaEditor.svelte` (128), `Layout/ViewToolbar.svelte` (294). Quality: A-B. Status: shared-lib / active.
- Мелкие компоненты-обёртки (Box, Field, Flair, HorizontalGroup, Accordion, ColorItem, FileListInput, ViewLayout, ViewHeader, ViewContent, AccordionItem) — 1-40 LOC. Quality: A. Status: shared-lib.

---

## 7. UI — modals

- `EditNote.svelte` (931) — редактирование записи в модалке. Quality: C. Status: active. ⚠️ **2 × @ts-ignore** (:175, :177 — immer + WritableDraft).
- `CreateProject.svelte` (913) — мастер создания проекта. Quality: C. Status: active. ⚠️ **2 × @ts-expect-error** (:286, :288 — миграция старого формата, осознанные).
- `CreateField.svelte` (623), `ConfigureField.svelte` (543) — UI создания/настройки полей. Quality: B. Status: active. ✅ **`ConfigureField.svelte:203-318` содержит готовый Rollup UI.**
- `Schema.svelte` (319) — схема записи (тип-маппинг). Quality: B. Status: active.
- `DateFormatSelector.svelte` (189), `AddView.svelte` (128), `CreateNote.svelte` (153), `Inspector.svelte` (85), `ConfirmDialog.svelte` (40), `InputDialog.svelte` (48), `CenterBox.svelte` (12). Quality: A-B. Status: active.
- Modal helpers (`addViewModal.ts`, `createProjectModal.ts`, `createNoteModal.ts`, `inputDialog.ts`, `confirmDialog.ts`, `editNoteModal.ts`, `inspector.ts`, `schemaModal.ts`, `createFieldModal.ts`, `configureField.ts`, `dataFieldTypeOptions.ts`) — 35-92 LOC. Quality: A. Status: active.

---

## 8. UI — settings (per-vault)

- `src/ui/settings/settings.ts` (294) — settings tab. Quality: A. Status: active.
- `Projects.svelte` (74), `Archives.svelte` (73). Quality: A. Status: active.

---

## 9. Views — Dashboard (главная точка роста)

### Корень
- `DashboardCanvas.svelte` (751) — полотно Дашборда (drag/drop layout). Quality: B. Status: active. (R5-013 закрыт — extracted commands/preload/toolbar/filterBridge/templateConfirm.)
- `DashboardToolbar.svelte` (125), `FilterBridge.svelte` (140), `TemplateConfirmDialog.svelte` (87) — extracted sub-components. Quality: A. Status: active.
- `dashboardCommands.ts` (24), `dashboardPreload.ts` (55), `dashboardView.ts` (86), `migration.ts` (86), `designTokens.ts` (101), `fieldTypes.ts` (99), `widgetTemplates.ts` (535), `types.ts` (392). Quality: A-B. Status: active.

### Engine (`src/ui/views/Dashboard/engine/`)
- `transformExecutor.ts` (1190) — pipeline executor (filter→group→aggregate→sort). Quality: B. Status: active. ⚠️ большой, но связный.
- `chartDataPipeline.ts` (283), `aggregation.ts` (267), `relationResolver.ts` (237), `formulaMetadata.ts` (209), `accessibility.ts` (166), `transformCache.ts` (162), `conditionalFormat.ts` (124), `virtualScroll.ts` (104), `formulaSerializer.ts` (78), `rollup.ts` (67), `joinKey.ts` (39). Quality: A-B. Status: active. ⚠️ `rollup.ts` имеет `@deprecated` re-exports → импортировать из `lib/engine/aggregate` напрямую.
- `formulaEngine.ts` (21) — wrapper. Status: wrapper.
- `transformTypes.ts` (168) — pipeline types. Quality: A. Status: shared-lib.

### Widgets (`src/ui/views/Dashboard/widgets/`)
**Реестры**:
- `widgetRegistry.ts` (108), `configPanelRegistry.ts` (138), `WidgetHost.svelte` (746), `WidgetToolbar.svelte` (198), `_shared/WidgetConfigShell.svelte` (229), `resizable.ts` (146). Quality: B. Status: shared-lib (host).

**DataTable** (новая таблица — заменила legacy TableView):
- `DataTableWidget.svelte` (1118) — основной widget. Quality: B. Status: active. ⚠️ большой, но это центральный вид.
- `SubBaseTabs.svelte` (176) — табы sub-base; **уже подключён в DataTableWidget**. Quality: A. Status: active.
- `FieldPresetMenu.svelte` (351), `GroupHeader.svelte` (92), `fieldPreset.ts` (103), `groupRows.ts` (108), `widthUnits.ts` (49). Quality: A-B. Status: active.

**Charts**:
- `ChartConfig.svelte` (411), `ChartWidget.svelte` (214), `ScatterChart.svelte` (228), `PieChart.svelte` (159), `LineChart.svelte` (158), `BarChart.svelte` (138), `NumberChart.svelte` (25), `ProgressChart.svelte` (46). Quality: A-B. Status: active. (Преимущество над Notion.)

**FilterTabs**, **Stats**, **Comparison**, **Checklist**, **SummaryRow**, **ViewPort** widgets — все active, A-B quality, ~80-230 LOC каждый.

**Formula UI**:
- `FormulaBar.svelte` (578), `FormulaVisualEditor.svelte` (608), `FormulaDebugPanel.svelte` (164), `FormulaNode.svelte` (130). Quality: B. Status: active. ⚠️ **результат formula НЕ рендерится инлайн в ячейках DataTable** (см. MPLAN-001).

**PipelineEditor.svelte** (1397) — редактор pipeline (filter→compute→...). Quality: B. Status: active. ⚠️ большой — кандидат на split.

---

## 10. Views — Calendar (НЕ ТРОГАТЬ — best-in-class)

### Корень
- `CalendarView.svelte` (2416) — главный view. Quality: B. Status: active. ⚠️ монолит, но best-in-class — не разбирать в V5.
- `calendar.ts` (643), `processor.ts` (686), `constants.ts` (294), `types.ts` (214), `logger.ts` (156), `calendarView.ts` (81). Quality: B. Status: active.

### Agenda (`src/ui/views/Calendar/agenda/`)
- `FilterRow.svelte` (1041) — UI строка фильтра. Quality: B. Status: active. ⚠️ большой.
- `AgendaListEditor.svelte` (860), `AdvancedFilterEditor.svelte` (773), `AgendaCustomList.svelte` (399), `DateFormulaInput.svelte` (400), `FilterGroupEditor.svelte` (353), `AgendaIconPicker.svelte` (233), `TouchDndCoordinator.ts` (229), `operatorHelpers.ts` (225), `suggestionCollector.ts` (142), `AgendaFilterEditor.svelte` (41). Quality: B. Status: active.
- **`filterEngine.ts` (396)** — ⚠️ **PARALLEL filter implementation, target R5-003**. Использует `matchesCondition` из canonical, но дублирует много логики. Должен стать thin wrapper (~50 LOC).

### Components (`src/ui/views/Calendar/components/`)
- `Timeline/AgendaSidebar.svelte` (1507) — agenda sidebar. Quality: B.
- `Calendar/InfiniteHorizontalCalendar.svelte` (1354), `TimelineView.svelte` (1009), `HeaderStripsSection.svelte` (969), `Day.svelte` (930), `YearHeatmap.svelte` (789), `InfiniteCalendar.svelte` (627), `DayColumn.svelte` (490), `EventBar.svelte` (464), `MultiDayEventStrip.svelte` (316), `AllDayEventStrip.svelte` (314), `EventBarContainer.svelte` (214), `TwoWeeksBlock.svelte` (172), `MonthBlock.svelte` (149), `EventList.svelte` (146), `CurrentTimeLine.svelte` (128), `EventTimeline.svelte` (123), `EventIndicator.svelte` (118), `Event.svelte` (98), `Week.svelte` (55), `Date.svelte` (42), `MonthHeader.svelte` (38), `Calendar.svelte` (29), `WeekHeader.svelte` (18), `Weekday.svelte` (44), `Ellipsis.svelte` (11), `ColorPill.svelte` (11). Quality: B. Status: active.
- `DayPopup/RecordItem.svelte` (1371), `DayPopup.svelte` (1071), `DuplicatePopup.svelte` (651). Quality: B-C.
- `DuplicatePopup/` (8 файлов, 32-448 LOC) — Calendar duplicate UI. Quality: B. Status: active.

### Subsystems
- `dnd/TimelineDragManager.ts` (1461), `DragOverlay.svelte` (270), `CreationPreview.svelte` (260), `SnapEngine.ts` (142), `HapticManager.ts` (99), `types.ts` (173). Quality: B. Status: active.
- `gestures/GestureCoordinator.ts` (613), `GestureManager.ts` (381). Quality: B. Status: active.
- `viewport/ViewportStateManager.ts` (423). Quality: B. Status: active.
- `navigation/NavigationController.ts` (258). Quality: B. Status: active.
- `animation/AnimationController.ts` (147). Quality: A. Status: active.

---

## 11. Views — Board (НЕ ТРОГАТЬ — стабильный)

- `BoardView.svelte` (547), `Board.svelte` (504), `CardList.svelte` (241), `ColumnHeader.svelte` (229), `BoardColumn.svelte` (172), `NewColumn.svelte` (92), `BoardOptionsProvider.svelte` (39), `boardHelpers.ts` (54), `board.ts` (172), `boardView.ts` (56), `BoardSettings.svelte` (82), `settingsModal.ts` (38), `types.ts` (20+52). Quality: B. Status: active.

---

## 12. Views — Gallery

- `GalleryView.svelte` (220), `gallery.ts` (50), `galleryView.ts` (51), `GalleryOptionsProvider.svelte` (26), `GallerySettings.svelte` (40), `helpers.ts` (24), `Card/Card.svelte` (3), `Card/CardContent.svelte` (3), `Card/CardMedia.svelte` (3), `Grid/Grid.svelte` (15), `Image/Image.svelte` (7). Quality: A-B. Status: active. ⚠️ Card-файлы по 3 LOC выглядят как просто re-exports.

---

## 13. Views — Table (DataGrid shared library)

⚠️ TableView.svelte УЖЕ УДАЛЁН (R5-001 V5.4). Папка содержит только shared `DataGrid/` library, потребляемая Dashboard `DataTableWidget`.

- `DataGrid.svelte` (269) — shared grid component. Quality: B. Status: shared-lib.
- `GridCell/GridCell.svelte` (336), `GridTypedCell.svelte` (143), `Resizer.svelte` (77), `GridCellGroup.svelte` (46). Quality: B. Status: shared-lib.
- **Cell types**:
  - `GridBooleanCell.svelte` (30), `GridDateCell.svelte` (106), `GridDatetimeCell.svelte` (97), `GridListCell.svelte` (23), `GridNumberCell.svelte` (75), `NumberInput.svelte` (57), `NumberLabel.svelte` (15), **`GridRelationCell.svelte` (56)** — рендерит pill-chips через `RelationListView`, **`GridRollupCell.svelte` (39)** — рендерит rollup result, `GridSelectCell.svelte` (118), `GridTextCell.svelte` (94), `TextLabel.svelte` (79). Quality: A-B. Status: shared-lib.
  - **❌ Нет `GridFormulaCell.svelte`** — formula cells fall through к `GridCell` (см. `GridTypedCell.svelte:134-142`). **MPLAN-001**.
- `GridHeader/GridHeader.svelte` (93), `GridColumnHeader.svelte` (102), `GridRow.svelte` (159). Quality: A-B. Status: shared-lib.
- `dataGrid.ts` (24), `helpers.ts` (22). Quality: A. Status: shared-lib.
- `SwitchSelect/SwitchSelect.svelte` (45). Quality: A. Status: shared-lib.

---

## 14. Views — VisualizerPane (sidebar pane)

Зарегистрирован как top-level view в `main.ts:104`. Использует `YamlVisualizer.svelte` как рендерер.

- `VisualizerPane.svelte` (818) — sidebar pane. Quality: B. Status: active.
- `visualizerPaneView.ts` (85) — Obsidian ItemView wrapper. Quality: A. Status: active.
- `RelationPickerModal.ts` (56) — FuzzySuggestModal для выбора relation target. Quality: A. Status: active.

---

## 15. Views — YamlVisualizer

⚠️ **Не зарегистрирован** как top-level view (см. `src/view.ts:18-21`). Файлы сохранены для конверсии в Dashboard widget (R5-011/R5-012).

- `YamlVisualizer.svelte` (485) — главный component. Quality: B. Status: **ready-but-unwired** (используется только внутри VisualizerPane.svelte как рендерер).
- `RelationListView.svelte` (154) — pill-list рендер relations. Quality: A. Status: shared-lib (используется `GridRelationCell.svelte` + VisualizerPane). **Логически принадлежит Table/DataGrid или общему shared, не YamlVisualizer.**
- `types.ts` (18). Quality: A. Status: shared-lib.

---

## 16. Helpers / прочее

- `src/ui/views/helpers.ts` (160) — глобальные view-utils. Quality: B. Status: shared-lib.

---

## 17. Острова (ready-but-unwired) и аномалии

| Файл / зона | Заметка | Будущий ticket |
|---|---|---|
| `YamlVisualizer/YamlVisualizer.svelte` (485 LOC) | Готов, но не зарегистрирован как widget. | R5-011 |
| `YamlVisualizer/RelationListView.svelte` (154) | Используется, но логически в неверной папке (общий shared). | R5-011 (попутно перенести). |
| `Calendar/agenda/filterEngine.ts` (396) | Параллельная filter-импл; должен быть thin-wrapper над `lib/engine/filterEvaluator`. | R5-003 |
| `GridFormulaCell.svelte` (отсутствует) | Formula cells fall through к generic `GridCell`. Result не рендерится. | MPLAN-001 |
| `lib/helpers/formulaParser.ts` (819) | Частично @deprecated; много импортируется. R5-002 Phase 2 deferred. | пост-V5.4 |
| `lib/helpers.ts` (198) + `lib/helpers/` (директория) | Дубль namespace. | пост-V5.4 cleanup |
| `Dashboard/engine/rollup.ts` (67) | @deprecated re-exports из `lib/engine/aggregate`. | пост-V5.4 cleanup (имеет 6+ импортёров) |
| `EditNote.svelte:175,177` | 2 × `@ts-ignore` (immer/TS2589). | технический долг (low priority) |
| `stores/dataframe.ts:27` | 1 × `@ts-expect-error` (immer TS2589). | технический долг (low priority) |
| `CreateProject.svelte:286,288` | 2 × `@ts-expect-error` (миграция). | acceptable (миграция) |
| `ViewConfigTab.svelte` (766), `PipelineEditor.svelte` (1397), `CalendarView.svelte` (2416), `RecordItem.svelte` (1371), `DayPopup.svelte` (1071), `InfiniteHorizontalCalendar.svelte` (1354), `TimelineDragManager.ts` (1461), `AgendaSidebar.svelte` (1507), `extendedEvaluator.ts` (1156), `transformExecutor.ts` (1190), `DataTableWidget.svelte` (1118), `EditNote.svelte` (931), `CreateProject.svelte` (913) | Файлы > 800 LOC — следить, но не разбирать в V5 если работают (Calendar/Board запрет). | future |

---

## 18. Сводка

- **Production файлов** (без тестов / mocks / re-exports): ~270.
- **LOC всего src/** (production): ~50 000.
- **Острова**: 1 явный (YamlVisualizer.svelte → R5-011), 1 параллель (filterEngine.ts → R5-003), 1 отсутствующий компонент (GridFormulaCell → MPLAN-001).
- **@ts-ignore / @ts-expect-error**: 5 (EditNote × 2, CreateProject × 2, dataframe store × 1) — все осознанные, но `EditNote.svelte` стоит вычистить.
- **Файлы > 800 LOC**: 13 — большинство в Calendar (don't touch) или Dashboard (PipelineEditor/DataTableWidget/extendedEvaluator). Не блокируют V5.
- **Зависимости**: канонические точки — `lib/engine/filterEvaluator`, `lib/formula/extendedEvaluator`, `lib/engine/aggregate`, `lib/relations/crossProjectResolver`, `lib/contextMenu`. Не дублировать!

---

## 19. Следующий шаг

Этот inventory — вход для `MODERNIZATION_PLAN_V5.md`, где:
- Открытые R5-tickets (R5-003, R5-001 финал, R5-009, R5-010, R5-011, R5-012) переносятся as-is.
- Новые MPLAN-001…008 покрывают: formula inline render, URL/Email/Phone, относительные даты, status semantic groups, auto-fields, unique ID, nested filter groups, list view.
