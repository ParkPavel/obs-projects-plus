# Changelog

All notable changes to Projects Plus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.4.1] - 2026-04-21

### Fixed

#### Board drag-and-drop reliability
- `Board.svelte` now keeps column reorder state local during `svelte-dnd-action` drag cycles so shadow placeholders do not leak into persisted column order
- pending column order is flushed safely on destroy, preventing lost reorder operations or ghost columns when the view closes mid-drag
- dragged column geometry now uses rendered dimensions, which stabilizes hit testing after column collapse and under scaled board rendering

#### Shared runtime cleanup
- `esbuild.config.mjs` now patches the shared `svelte-dnd-action` destroy path to force `handleDrop()` when the active origin or shadow drop zone is destroyed
- production packaging keeps `styles.css` as the only runtime stylesheet and removes intermediate `main.css` after merge, matching the documented Obsidian plugin contract

#### Developer workflow
- `CONTRIBUTING.md` now documents the correct runtime asset set for local vault installs: `main.js`, `manifest.json`, `styles.css`
- `scripts/version-bump.mjs` now appends the new semantic version to `versions.json` correctly instead of writing an invalid package-name key

## [3.4.0] - 2026-04-18

### Added — Database View Modernization (Waves 2–5)

#### Computation Engine (Wave 2)
- **FormulaEngine unified** — `evaluateFormulaValue()` replaced `evaluateExpression()`, supports brackets, nested functions, operator precedence
- **115 built-in functions** (was 50+): +11 financial (PMT, FV, PV, NPV, IRR, RATE, IPMT, PPMT, NPER, CUMPRINC, CUMIPMT), +8 statistical (VARIANCE, VARIANCE_S, PERCENTILE, QUARTILE, CORREL, MODE, RANK, STD_DEV_S), +3 conditional (SUMIF, COUNTIF, AVERAGEIF), +6 duration (DAYS, HOURS, MINUTES, TO_DAYS, TO_HOURS, WORKDAYS), +7 math (MEDIAN, PRODUCT, MOD, EVEN, ODD, PI, RANDOM_INT), +8 string (LEFT, RIGHT, MID, REGEX_MATCH, REGEX_REPLACE, JOIN, REPEAT, ENCODE_URL), +4 conversion (TO_CURRENCY, TO_PERCENT, LET, IFBLANK), +3 date (END_OF_MONTH, WEEKDAY_NAME, ISO_WEEK), +6 aggregate-aware (SUM, AVG, COUNT, MIN, MAX, STD_DEV with @column refs)
- **Cross-record @reference** — `@fieldName` syntax resolves all column values from DataFrame
- **8 relative date filter operators** — is-today, is-this-week, is-this-month, is-this-quarter, is-last-n-days, is-next-n-days, is-overdue, is-upcoming (dayjs isoWeek + quarterOfYear)

#### Visualization (Wave 3)
- **Scatter Chart** — SVG scatter plot with trend line, R², color grouping, point sizing (10th chart type)
- **FilterTabs Widget** — unique field values as clickable tabs with ARIA tablist (7th widget)
- **SummaryRow Widget** — compact aggregation bar with count, sum, avg, median, min, max, range (8th widget)
- **Stats sparkline** — optional inline sparkline in StatsCard
- **Comparison N-metrics** — supports N metrics array (backward compat for old metricA/metricB)
- **ChartConfig progressive disclosure** — `<details>` sections for display/scatter options

#### Data Integration (Wave 4)
- **Multi-source merge** — `additionalSources?: DataSource[]`, `mergeDataFrames()` engine (union fields, dedup records)
- **Dataview LIST/TASK support** — `parseListResult()`, `parseTaskResult()` with recursive flattening
- **DateTime precision** — non-midnight Dataview dates preserve time (HH:mm)
- **Dataview query validation UI** — debounced preview in CreateProject, shows row/task count or error
- **Inline add row** — add new records directly from Database View

#### Polish (Wave 5)
- **Recursive FormulaNode** — `<svelte:self>` for unlimited nesting depth in visual formula editor
- **Formula autocomplete keyboard nav** — ArrowUp/Down/Enter/Tab with wrap-around, ARIA listbox
- **ARIA tab roving** — Home/End/Space/Enter for SettingsMenuTabs, ViewSwitcher, FilterTabsWidget
- **DataGrid ARIA grid pattern** — aria-label, aria-rowindex on cells
- **Touch visibility** — `@media (pointer: coarse)` for hover-only buttons on touch devices
- **Pipeline dirty state** — JSON.stringify diff, confirm-on-discard dialog
- **Widget resize handles** — `use:resizable` Svelte action with pointer drag, grid-snap, callback pattern

### Tests
- **Total: 42 suites, 800 tests** (was 41/730 in v3.3.1)

## [3.3.1] - 2026-04-23

### Fixed — P0: Critical

#### i18n Corruption
- `ru.json` — Restored 16 corrupted common keys (OK, Cancel, Save, Delete, etc.) that were overwritten with Database View strings
- `uk.json` — Restored 16 corrupted keys + added 2 missing keys (widget template descriptions)
- `zh-CN.json` — Added 2 missing keys (widget template descriptions)

#### Table Alignment
- `DataTableWidget.svelte` — Scroll container refactored: header and body now share a single horizontal scroll container, eliminating column misalignment on horizontal scroll

### Fixed — P1: Important

#### Adaptive Column Widths
- `DataTableWidget.svelte` — Column width calculation improved: uses `Math.max(header width, content sample width)` with min/max bounds, preventing truncated headers and overly wide empty columns

#### Aggregation Picker
- `DataTableWidget.svelte` — Aggregation function selector now shows a dropdown menu (Obsidian `Menu` API) instead of cycling on click, with all 19 aggregation functions grouped by category

#### Error Boundary
- `WidgetHost.svelte` — Widget rendering wrapped in error boundary: catches mount/update errors and shows fallback UI with retry button instead of crashing the entire Database View

#### Chart Wizard Fallback
- `WidgetHost.svelte` — Chart and Stats widgets show a configuration wizard when no fields are configured, instead of rendering empty/broken charts

### Added — P2: Enhancements

#### Formula Visual Operators
- `FormulaVisualEditor.svelte` — Operator palette section added: 10 operators (+, −, ×, ÷, =, ≠, >, <, ≥, ≤) can now be inserted from the visual editor palette alongside functions and fields

### Changed — P3: Quality of Life

#### Table View Deprecation
- `tableView.ts` — Legacy Table view now shows a deprecation banner on open, recommending migration to Database View
- Deprecation message localized in all 4 languages (en, ru, uk, zh-CN)

#### Documentation
- `user-guide.md`, `user-guide-EN.md` — Added Database View section documenting features, use cases, and migration from Table view
- `demo-vault/` — Populated with 6 sample project notes for testing all view types

### Tests
- **Total: 41 suites, 730 tests** (was 40/714 in v3.3.0)

## [3.3.0] - 2026-04-22

### Added — Database View (New)

#### Core Architecture
- **Database View** — new view type with a widget-based dashboard layout (12-column responsive grid on desktop, stacked on mobile)
- **Widget System** — 8 widget types: Data Table, Chart (10 sub-types), Stats/KPI, Comparison, Checklist, View Port, Filter Tabs, Summary Row
- **Widget Registry** — centralized metadata registry with type safety, max count constraints, default layouts
- **Widget Templates** — 3 presets: Dashboard (stats+chart+table), Analytics (pie+line+comparison+stats), Kanban+ (table+checklist+progress)
- **Migration** — automatic `TableConfig` → `DatabaseViewConfig` migration for existing projects

#### Data Processing Engine
- **Transform Pipeline** — 6-step pipeline: Filter, Group By, Aggregate, Compute, Unpivot, Pivot (all with 2000ms timeout, ReDoS-safe regex)
- **Pipeline Cache** — hash-based LRU cache (djb2 hash, 5min TTL, 20-entry max, per-pipeline invalidation)
- **Formula Engine** — 50+ built-in functions (Math, String, Date, Logic, TypeConversion) with field-name-based evaluation
- **Chart Data Pipeline** — `buildChartPipeline()` / `computeChartData()` transforms DataFrame → ChartData for all chart types
- **19 Column Aggregations** — sum, avg, min, max, median, range, count, count_values, count_unique, count_checked, count_unchecked, percent_checked, percent_unchecked, percent_empty, percent_not_empty, date_range, earliest, latest, none
- **Conditional Formatting** — rule-based cell/row styling with color sanitization and operator validation
- **Relation Resolver** — wiki-link parser, case-insensitive record index, cross-note relations
- **Rollup Engine** — 12 rollup functions for computed columns across related records

#### Charts (9 types)
- **Bar** — vertical, horizontal, stacked variants with SVG rendering
- **Line** — multi-series, Catmull-Rom smooth curves, optional gradient fill
- **Area** — line chart with gradient fill
- **Pie / Donut** — tooltip, legend, center label, percent display
- **Number / KPI** — auto K/M formatting, accent color support
- **Progress** — SVG progress bar with threshold-based color

#### Widgets
- **Data Table** — DataGrid with grouped rendering, virtual scroll (>100 rows), conditional formatting, relation/rollup cells
- **Stats** — configurable KPI card grid (2-4 columns) using 19 aggregation functions
- **Comparison** — side-by-side metric bars with animated width
- **Checklist** — boolean field binding, completion counter, per-item toggle
- **View Port** — embedded view selector (table/board/calendar/gallery)
- **Formula Bar** — expression editor with autocomplete, real-time validation, preview

#### UX & Accessibility
- **Widget Toolbar** — Add Widget dropdown (registry-driven, max count enforcement), Templates section
- **Drag & Drop** — widget reorder via svelte-dnd-action in stack mode
- **Layout Toggle** — grid (⊞) / stack (≡) modes, auto-stack on mobile
- **ARIA** — `ariaGrid`, `ariaGridCell`, `ariaWidget` helpers; keyboard navigation (navigateGrid, navigateList); `announceChange()` for screen readers
- **Design Tokens** — CSS custom properties: spacing scale, breakpoints, touch targets, row height, radius
- **Virtual Scroll** — windowed rendering for tables >100 rows with ResizeObserver

#### i18n (4 languages)
- All Database View strings localized: English, Russian, Ukrainian, Simplified Chinese
- ~90 translation keys covering canvas, widgets, formula bar, pipeline, charts, templates

### Changed
- `DataFieldType` extended: +Select, +Status, +Formula, +Relation, +Rollup (now 11 values)
- `view.ts` — Database registered as `views["database"]`

### Tests
- 7 new test suites: aggregation, transformExecutor, transformPivot, transformCache, chartDataPipeline, virtualScroll, widgetRegistry + accessibility + designTokens + widgetTemplates
- **Total: 40 suites, 714 tests** (was 23/457 in v3.2.2)

## [3.2.2] - 2026-04-10

### Fixed — Security & Code Quality (PR #10259 Audit)

#### P0: JSON.parse Crash Protection
- `DataFrameProvider.svelte` — `JSON.parse` on corrupted project config now wrapped in try-catch with safe fallback (`{ ...project, views: [] }`)
- `CreateField.svelte` — `JSON.parse` on list values extracted to `safeParseList()` with try-catch, prevents crash on malformed field data

#### P1: Data Loss & Filter Consistency
- `standardize.ts` — Dataview array fields (tags, aliases) were silently dropped: `value.map(...)` result was not assigned back to `res[field]`
- `filterFunctions.ts` — `contains`, `not-contains`, `has-keyword` operators now case-insensitive, consistent with Calendar filterEngine

#### Board Column DnD Race Condition
- `Board.svelte` — Column drag-and-drop worked intermittently ("every other time"): reactive `$: unpinnedColumns` recalculation from parent prop update was resetting svelte-dnd-action internal state mid-drag. Added `isDraggingColumns` guard to freeze unpinned column list during drag operations.

### Changed — ObsidianReviewBot Required Fixes (PR #10259)

#### Code Quality
- `events.ts` — Removed unnecessary `async` from synchronous callback in file watcher
- `TouchDndCoordinator.ts` — Replaced 5 inline `element.style.*` with CSS class `.ppp-drag-feedback`
- `TimelineDragManager.ts` — Replaced inline display/pointer-events with `.ppp-hit-test-hidden`/`.ppp-hit-test-active` CSS classes; removed unnecessary `s!` non-null assertion
- `filterEngine.ts` — Fixed `never` type operand in exhaustive switch default branch
- `helpers.ts` — Added `void` operator to 2 unhandled `openLinkText()` promises
- `Weekday.svelte`, `CreateField.svelte` — Added reason comments to all `eslint-disable` directives

#### Promise & Type Safety (P2)
- `filesystem.ts` — 4 fire-and-forget file watcher callbacks now use `.catch(console.error)` instead of `void`
- `main.ts` — `createNote()` promise handled with `.catch(console.error)`
- `formulaParser.ts` — `DATE_ADD`/`DATE_SUB` unsafe type assertions replaced with `Number()`/`String()` coercion

### Added — Test Coverage
- `formulaParser.test.ts` — 56 tests: tokenizer, parser, evaluator (27 built-in functions, operators, edge cases), validator
- `filterFunctions.test.ts` — 26 tests: base/string/number/boolean/list operators, case-insensitive verification, matchesCondition, matchesFilterConditions
- Total: 23 suites, 457 tests (was 21/375)

## [3.2.1] - 2026-04-09

### Fixed — Mobile Popover Positioning

#### Popover Keyboard Timing Fix
- **Root cause**: `searchInput.focus()` triggers virtual keyboard AFTER `positionContainer()`/`positionPop()` calculates position — first open uses pre-keyboard viewport height, rendering the popover behind the keyboard. Subsequent opens work correctly because the keyboard is already visible.
- **Invisible-until-settled pattern**: Popovers now start with `opacity: 0; pointer-events: none`, then reveal after `visualViewport.resize` fires (keyboard animation finished) or after 120ms fallback timeout.
- **Applied to 4 files**: `FilterRow.svelte` (`positionContainer`), `FiltersTab.svelte`, `SortTab.svelte`, `ColorFiltersTab.svelte` (`positionPop`)

#### Popover List Direction Fix
- **Root cause**: Popover uses `flex-direction: column` — search input on top, field list below. When popover opens ABOVE the trigger (to escape keyboard), the list items extend downward toward the keyboard.
- **Fix**: Added `flex-direction: column-reverse` to `.ppp-popover-container--mobile-kbd` and `.ppp-pop-box--mobile-kbd` — on mobile, the list scrolls upward from the search bar, which stays anchored near the trigger. Search bar border direction adjusted (`border-bottom` → `border-top`).

#### Popover CSS Architecture Fix
- **Root cause**: Mobile keyboard CSS modifications (`.ppp-popover-container--mobile-kbd`, `.ppp-pop-box--mobile-kbd`) were hand-edited into `styles.css` instead of being part of the compiled source. `styles.css` is a build artifact — `mergeCSS()` in `esbuild.config.mjs` merges `main.css` (design tokens) into `styles.css` on every build. Any `git checkout -- styles.css` wiped out the mobile keyboard styles.
- **Fix**: Moved CSS rules into Svelte `<style>` blocks using `:global()` selectors in `FilterRow.svelte` and `FiltersTab.svelte`. Styles now compile into `main.js` via esbuild and are injected at runtime — they survive any `styles.css` reset.
- **Additional fix**: `.ppp-pop-box` base class was missing `display: flex`, so `flex-direction: column-reverse` on the modifier had no effect. Added `display: flex` to the `--mobile-kbd` modifier.

### Fixed — ViewSwitcher Touch Architecture Rewrite

#### touchcancel Not Handled (Root Cause of Misclick Bug)
- **Root cause**: CSS `touch-action: pan-x` on `.view-switcher` tells the browser to handle horizontal panning natively. During native pan, iOS/Android fires `touchcancel` instead of `touchend` — the `touchHandled` flag was never set, so the `click` event leaked through to the button under the finger at lift.
- **Fix**: Added `on:touchcancel={handleTouchEndOrCancel}` handler that shares logic with `touchend`. Both events now set the `touchHandled` flag when finger movement exceeds the dead-zone.

#### Swipe Navigation Conflicted with Native Scroll
- **Root cause**: `handleTouchMove` called `event.preventDefault()` and `event.stopPropagation()` during horizontal swipe detection, but with `touch-action: pan-x`, the browser had already taken control of panning — `preventDefault()` was ignored. `handleTouchEnd` then called `onSelect()` even after native scroll, causing double view switches.
- **Fix**: **Removed swipe-to-navigate entirely**. Native `pan-x` scroll via `overflow-x: auto` handles tab bar scrolling. View selection is tap-only. Simplified touch logic from ~130 lines to ~30 lines.

#### Visual Pre-Selection During Scroll
- **Root cause**: Mobile browsers apply `:active` state to buttons under the finger during native scroll, creating a visual "pre-selection" highlight.
- **Fix**: Added `-webkit-tap-highlight-color: transparent` on `.view-item` buttons. Added `touch-action: manipulation` (disables double-tap-to-zoom, removes 300ms click delay).

### Fixed — Agenda Date Selector Stuck on Today

#### Reactive Block Self-Reset
- **Root cause**: `$: if (!currentDate.isSame(selectedDate, 'day'))` in `AgendaSidebar.svelte` depended on BOTH `currentDate` (prop) and `selectedDate` (local state). When user manually selected a date via the picker, `selectedDate` changed → reactive block re-ran → saw `currentDate ≠ selectedDate` → immediately reset `selectedDate = currentDate` (back to today).
- **Fix**: Track `currentDate` prop changes via `prevCurrentDate` sentinel. Reactive block now fires only when the prop changes (calendar navigation), not when the user makes a manual selection.
- **File**: `AgendaSidebar.svelte` (lines 62–72)

### Improved — Mobile View Switcher Misclick Prevention

#### Dead-Zone Click Suppression (ViewSwitcher.svelte)
- **Problem**: When swiping the view tab bar on mobile, lifting the finger over a tab accidentally switches to that view. This happened because finger movements between 15px (old TAP_MAX_MOVE) and 35px (SWIPE_THRESHOLD) fell through a gap — `touchHandled` was never set, so the native `click` event fired.
- **Fix**: Replaced tap/swipe gap logic with a single `touchMoved` flag using an 8px dead-zone. Any finger movement beyond 8px in any direction marks the touch as "moved" and blocks the subsequent click event. Clean taps (< 8px movement) still work normally.
- **scrollIntoView on tap**: Tapping a view tab now smoothly scrolls it to the center of the tab bar for better visibility.
- **Removed**: `TAP_MAX_MOVE`, `TAP_MAX_DURATION`, `touchStartTime`, `isHorizontalSwipe`, `SWIPE_THRESHOLD`, `SWIPE_MIN_DISTANCE` — all replaced by simplified dead-zone + native scroll architecture.

### Technical
- **Tests**: 375/375 passing (21 suites)
- **Build**: OK (main.js 1.8MB, main.css 4.2KB)
- **tsc**: 0 errors

## [3.2.0] - 2026-04-03

### Added — Drag & Drop 2.0

#### Calendar Timeline DnD
- **EventBar drag**: Events in Week/Day timeline views can now be dragged to reschedule — move to a different day or time slot
- **Cross-day drag**: Drag events between days in Week view with automatic date recalculation
- **Strip resize**: Resize multi-day event bars by dragging left/right edges to adjust start/end dates
- **15-minute snap**: Time-based events snap to 15-minute intervals during drag
- **Visual drop feedback**: Drop targets highlight with accent color on hover; stronger feedback on touch devices

#### TimelineDragManager
- **DragSession architecture**: All per-drag state encapsulated in a DragSession object — clean initiation/cleanup cycle
- **Mode detection**: Single evaluation at movement threshold — move, strip-resize-start, or strip-resize-end
- **Auto-scroll**: Time-based vertical auto-scroll when dragging near container edges
- **SnapEngine**: Configurable snap intervals for both time (minutes) and day (index) axes

#### Mobile DnD Enhancements
- **Long-press activation**: Touch DnD requires 500ms long-press on drag handle to activate (prevents accidental drags)
- **Haptic feedback**: `navigator.vibrate()` on snap boundaries with 100ms throttle to prevent over-firing
- **Visual drag feedback**: Dragged element gets `maxHeight: 3rem`, `opacity: 0.9`, shadow effect
- **Touch drop targets**: `@media (pointer: coarse)` with stronger accent background and thicker borders

### Fixed

#### DnD Data Integrity
- **Single mutation point**: `CalendarView.handleRecordChange` is now the sole date mutation path — Day.svelte no longer modifies endDate (eliminates double-shift bug)
- **Format preservation**: Date-only fields stay date-only during DnD (no `T00:00:00.000Z` injection); detection via raw value pattern `/T\d{2}:\d{2}/` instead of `typeConfig.time`
- **Multi-day span preservation**: Timed moves now compute `endDate = origEnd.add(dayDelta, 'day')` — multi-day events no longer collapse to single day

#### Strip Resize Accuracy
- **Mode-specific reference**: Resize-start uses `getOriginalStripStartIndex()`, resize-end uses `getOriginalStripEndIndex()` — eliminates delta amplification from bar center
- **Handle glow**: `scale(1.02)` lift + `dnd-handle-pulse` animation on resize handles after long-press activation

#### Stability
- **Auto-scroll null safety**: `autoDetectScrollContainer(barElement)` fallback if reactive block fires before DOM ready
- **Mode lock**: Mode re-evaluation continues during first 30px of drag, then locks — prevents accidental mode switches

### Technical
- **Tests**: 375/375 passing (21 suites)
- **Build**: OK (main.js 1.8MB, main.css 4.2KB)

## [3.1.0] - 2026-03-08

### Hotfixes (included in 3.1.0 build)

#### Mobile Data Loss Fix
- **CalendarView data delivery**: Removed `dataGeneration` guard in `calendarView.ts` that blocked repeat `onData()` calls after tab switching on mobile. CalendarView now always delivers data via `$set()`, matching Table/Board/Gallery pattern.

#### Timeline Z-Index Overlap Fix
- **CurrentTimeLine.svelte**: Reduced `z-index` from 100 to 10
- **CalendarView.svelte**: Added `isolation: isolate` and `z-index: 0` on ViewContent first child to prevent timeline from overlapping Agenda sidebar

#### Board Zoom iOS Fix
- **Board.svelte**: Replaced CSS `zoom` (unsupported on Safari/iOS) with `transform: scale()` + `transform-origin: top left` + width/height compensation. Added `min-height: 100%` on viewport container.

#### Numeric Date Hardening (5 files)
- **calendar.ts, dateFormatting.ts**: `parseDateInTimezone` now rejects non-string / non-Date / non-dayjs values (prevents numeric frontmatter values like timestamps from being parsed as dates)
- **filterEngine.ts, suggestionCollector.ts**: `isDateLike` now rejects numbers
- **processor.ts**: `calculateSpanInfo` capped at 365 days to prevent infinite spans from malformed data

#### Agenda DnD View Reset Fix
- **CalendarView.svelte**: Added `getLatestProject()` helper that reads current project state from `get(settings).projects` instead of using stale local `project` prop. Applied in `handleAgendaSaveList`, `handleAgendaDeleteList`, `handleAgendaReorderLists` — prevents reordering agenda lists from resetting calendar view to "today".

#### Updated Metrics
- **Tests**: 375 passed (21 suites) — up from 344 (19 suites) at initial release
- **Build**: main.js 1.8MB, main.css 4.2KB

### Added — DnD Handle Engine & Unified Grip Design

#### Drag Handle Engine (replaces dragDisabled: isMobile)
- **dragHandleZone + dragHandle pattern**: All three DnD zones (Agenda lists, Board columns, Board cards) now use `dragHandleZone` wrapper with `dragHandle` directive on grip elements instead of disabling DnD entirely on mobile
- **TouchDndCoordinator.ts** (~210 lines): New gesture coordination module with `createLongPressHandler()`, `hapticFeedback()`, `applyDragFeedback()`, `isDragHandleTarget()`, `DRAG_HANDLE_SELECTOR`
- **AgendaCustomList.svelte**: `<span class="drag-grip" use:dragHandle>` — grip initiates DnD, rest of list header allows scroll
- **Board.svelte**: `dragHandleZone` on unpinned columns section, `<span class="board-column-grip" use:dragHandle>` per column
- **CardList.svelte**: `dragHandleZone` on card list, `<span class="board-card-grip" use:dragHandle>` per card

#### Unified Grip Design
- **Hover-reveal pattern**: All grips use `opacity: 0` → parent hover `opacity: 0.45` → grip hover `opacity: 1` with background feedback
- **Touch always-visible**: `@media (pointer: coarse)` shows grips at subtle opacity (0.25–0.35)
- **Consistent sizing**: Agenda 1rem wide, Board column 1rem × 1.25rem, Board card 0.5rem × 1rem — proportional to container size

### Fixed — Deep Mobile Adaptation & Gesture Debugging

#### Full-Screen Modal (AgendaListEditor)
- **Mobile full-screen takeover**: Modal on mobile (`max-width: 37.5rem`) now uses `height: 100%; max-height: none` instead of bottom-sheet — eliminates all guesswork about toolbar heights and safe areas
- **Footer above Obsidian navbar**: `padding-bottom: calc(3.5rem + env(safe-area-inset-bottom))` — 3.5rem clears Obsidian mobile toolbar
- **Overlay touch-action: auto**: Was `none` which blocked ALL child scroll via CSS touch-action intersection
- **Modal scroll containment**: `overscroll-behavior: contain` on overlay and modal

#### Mobile Filter Row Wrapping
- **filter-row**: `flex-wrap: wrap` on touch devices — chips wrap instead of overflowing right edge
- **chip-wrapper**: `flex-shrink: 1; min-width: 0` — allows chips to shrink on narrow screens
- **chip**: `overflow: hidden; flex-shrink: 1; min-width: 0` — text truncation within chips
- **chip-label**: `max-width: 4.5rem` (was 5.5rem)
- **row-prefix**: narrowed from 32px to 24px
- **fg-actions**: `padding-left: 0; flex-wrap: wrap` — action buttons wrap on mobile

#### Calendar Timebar Alignment
- **Strip segment alignment fix**: Converted `margin-left`/`margin-right` to `padding-left`/`padding-right` on `.is-start`, `.is-end`, `.is-only` strip segments
- **Root cause**: Flex margins shrink available space OUTSIDE the flex item, causing neighboring segments to shift relative to Day cells. Padding stays inside `box-sizing: border-box`, keeping each segment equal width to the corresponding day column

#### EditNote Modal Label Clipping
- **Desktop label width**: Increased `.setting-item-info` `max-width` from `8rem` to `10rem` to accommodate longer field names
- **Label overflow**: Added `overflow: visible` to `.setting-item-info` and `word-break: break-word` to `.setting-item-name` 
- **Mobile label fix**: Changed `.group-content` overflow to `overflow-x: visible; overflow-y: hidden` — allows horizontal text rendering while preserving collapse animation
- **Mobile padding**: Increased `.group-content` padding from `0.5rem` to `0.5rem 0.75rem` for better edge spacing

#### ViewSwitcher Gesture Conflicts
- **Touch-action CSS**: Added `touch-action: pan-x` to `.view-switcher` so browser doesn't compete with custom swipe handler
- **Scroll containment**: Added `overscroll-behavior-x: contain` to prevent horizontal overscroll from chaining to Obsidian sidebar
- **Edge-aware propagation**: `stopPropagation()` is now skipped when user swipes at first/last view boundary, allowing Obsidian sidebar gesture to work at navigation edges

#### Global Scroll Containment (overscroll-behavior: contain)
- **AgendaSidebar**: `.content` and `.events` containers
- **InfiniteHorizontalCalendar**: `.infinite-horizontal-calendar-wrapper`
- **Board**: `.projects--board--container`
- **App**: `.projects-main` root scroll container
- **SettingsMenuPopover**: `.tab-content`
- **AgendaIconPicker**: `.modal-content`

#### iOS Safe Area Support
- **ViewToolbar floating toggle**: `top` now uses `max(8px, env(safe-area-inset-top, 8px))` to account for iOS notch/Dynamic Island

#### Calendar Cell Inner Scroll (Shift+Wheel)
- **Day cell overflow scroll**: In headers mode (list), calendar day cells now support inner scrolling when Shift+wheel is used — events beyond the visible area can be scrolled into view
- **Smart boundary passthrough**: At scroll top/bottom boundaries, wheel events pass through to calendar for date navigation
- **No-conflict design**: Without Shift, all wheel events pass through for calendar navigation as before

#### Week/Day View Full Height
- **Viewport-filling cells**: Week and day views in headers mode now use full available viewport height instead of fixed 8rem rows
- **Flex-based stretch**: Removed `useFixedHeight` and `height: fit-content` constraints on period-container and period-content, allowing flex children to expand

#### Instant Mode View Switching
- **Root cause fix — smoothScrollTo hardcoded 400ms**: The main scroll function `smoothScrollTo()` was called with an explicit `duration: 400` parameter, bypassing `getAnimationDuration()` which returns 0 in instant mode. Removed the explicit duration so the function now consults the user's animation preference
- **Suppressed CSS transitions**: View-layer opacity/transform transitions disabled via `.ppp-instant-mode { transition: none }` class
- **Week/period animations suppressed**: `.calendar-week` fadeIn and `.period-container` slideIn animations disabled in instant mode
- **8 setTimeout delays eliminated**: All fixed delays in the navigation chain now use `isInstantMode ? 0 : N` — reactive nav (100ms), onMount scroll (150ms), scroll callbacks (50ms), interval centering (200ms), initial mount (300ms), snap delay (120ms), snap reset (300ms)

#### Data Integrity Fixes
- **DnD double-shift fix**: Removed endDate pre-mutation from Day.svelte — CalendarView.handleRecordChange() now solely handles both start and end date shifts with format-aware writes
- **Duplicate time injection fix**: Added `hasTimeInField`/`hasTimeInEnd` guards in CalendarView duplicate handler — `customTime` branch now only writes HH:mm if field config supports time
- **Field clearing fix**: Table "Clear value" now sets `null` instead of `undefined` — preserves frontmatter key with empty value instead of deleting the key entirely

#### Calendar Visual Fixes
- **Mobile compact events**: Reduced Event.svelte mobile `min-height` from 2.75rem to 1.625rem, checkbox from 1.25rem to 1rem — prevents oversized events from overflowing day cells
- **Safari overflow compatibility**: Changed `overflow: clip` to `overflow: hidden` in Day.svelte, EventList.svelte, and AgendaListEditor.svelte for older Safari/iOS compatibility
- **Today highlight TZ-safe**: Fixed timezone-aware "today" comparison in Day.svelte, DayPopup.svelte, and AgendaSidebar.svelte — uses `dayjs().tz(timezone)` instead of raw `dayjs()`
- **Table resize throttle**: Added requestAnimationFrame throttle to Resizer.svelte mousemove handler to prevent layout thrashing during column resize
- **Pinned column z-index**: Bumped GridHeader pinned column z-index from 6 to 7 to prevent overlap with sticky header

---

## [3.0.10] - 2026-02-25

### Added — Mobile Feature Parity
- **Long-press navigation (all views)** — on touch devices, long-press (500ms) on note links/cards shows an Obsidian `Menu` with "Open note", "Open in new tab", "Open in new window" options
  - `InternalLink.svelte`: touch-aware long-press detection with finger movement cancellation (10px threshold) and haptic feedback (`navigator.vibrate`)
  - Board `CardList`: handles `longpress` event from InternalLink → `showMobileNavMenu()`
  - Gallery `GalleryView`: long-press on both `CardMedia` images and `InternalLink` titles
  - Table `GridRow`: long-press on row header cells (touch events forwarded through `GridCell`)
- **EditNote mobile open mode** — on touch devices, the "Open Note" button shows a dropdown menu instead of relying on Ctrl+Click/Shift+Click modifier keys
  - Desktop: unchanged behavior (Ctrl+Click → tab, Shift+Click → window)
  - Mobile: single tap shows `Menu` with all three open modes
  - Tooltip adapts: mobile shows "Open note", desktop shows modifier key hints
- **Board: Pinch-to-zoom** — two-finger pinch gesture controls board zoom (0.25×–2.0×) on touch devices
  - Standard `touchstart`/`touchmove`/`touchend` flow with distance-based scaling
  - Safari `GestureEvent` support (`gesturestart`/`gesturechange`) for native pinch scaling
  - Works alongside existing Ctrl+Scroll zoom on desktop
- **Gallery: Responsive grid on mobile** — card width automatically capped at 200px on mobile to prevent oversized single-column layouts
  - `Grid.svelte` imports `isMobileDevice` store and uses `Math.min(cardWidth, 200)` for responsive grid
- **Touch visual feedback** — `:active` states for Gallery and Board cards on `@media (pointer: coarse)` devices
  - Gallery cards: accent border + hover background on tap
  - Board cards: shadow + alt background on tap
  - Gallery card media: `cursor: pointer` + suppressed tap highlight
- **Shared `showMobileNavMenu()` helper** (`src/ui/views/helpers.ts`) — reusable Obsidian `Menu` builder for mobile note navigation, used by all 4 non-Calendar views
- **i18n keys**: `common.open-in-tab` / `common.open-in-window` (EN + RU)

### Fixed
- InternalLink: long-press no longer triggers duplicate click events (touch-end `preventDefault` + `longPressFired` guard)
- Gallery `CardMedia`: now forwards `touchstart`/`touchmove`/`touchend` events for long-press support
- Table `GridCell`: row header now forwards touch events for long-press detection

## [3.0.9] - 2026-02-25

### Changed
- **Unified filter extraction** — shared `getFilterValuesFromConditions()` helper replaces 4 duplicate implementations in Board, Table, Gallery, Calendar views
- **Instant transitions fix** — `animationBehavior: "instant"` now fully suppresses CSS animations in Calendar week/day period transitions (`periodSlideIn`, `unitFadeIn`) and NavigationController scroll animations
- **CSS breakpoints normalized** — all `@media` breakpoints use rem units consistently (48rem, 37.5rem, 30rem) instead of mixed px values
- **CSS selector scoping** — `.modal select` → `.projects-modal select` to prevent style bleeding into other plugins' modals
- **Console logging cleanup** — 33 direct `console.debug/warn/error` calls in Calendar components replaced with centralized `calendarLogger`; development debug statements removed from navigation buttons

### Fixed
- Calendar week/day views: period slide-in animation now respects instant mode setting instead of always animating
- NavigationController: scroll animations now use `getAnimationDuration()` instead of hardcoded 400ms
- InfiniteCalendar (vertical): unit fade-in animation now respects instant mode setting

## [3.0.8] - 2026-02-24

### Added
- **Board: Column persist (закрепление статусов)** — columns can be persisted via context menu or header button; persisted columns remain visible even when no records match the status
  - `persistedStatuses` stored in `BoardConfig`, survives view reloads
  - Context menu item: "Persist" / "Unpersist" per column
  - Header button: bookmark icon (bookmark-plus / bookmark-minus)
- **Board: Persist visual indicator** — persisted columns rendered with gray left border (`var(--text-faint)`); pinned+persisted columns use accent border
- **Board: Ctrl+Scroll zoom** — zoom board view from 25% to 200% with Ctrl+mouse wheel
  - CSS `zoom` property (not `transform: scale`) to avoid stacking context issues with `svelte-dnd-action`
  - Svelte action `wheelZoom` with `{ passive: false }` for reliable `preventDefault()`
  - Zoom badge in bottom-right corner shows current level; click to reset to 100%
  - Zoom level persisted in `BoardConfig.boardZoom`
- **Board: Responsive/adaptive layout** — container queries (`@container view-content`) for board columns and cards based on viewport width
- **Board: Note creation with filters** — new notes inherit active filter values across all 4 views (Board, Table, Calendar, Gallery)
  - `getFilterValues()` extracts equality-type filters and pre-fills frontmatter on note creation
- **Unified note navigation** — consistent modifier-based navigation across all views (Board, Table, Gallery, Calendar):
  - **Click** → opens EditNoteModal (intermediate step)
  - **Ctrl+Click** → opens note in a new Obsidian tab (adjacent)
  - **Shift+Click** → opens note in a new Obsidian window
  - Table view: left-click on row number cell now opens modal (previously context menu only)
  - Modal "Open Note" button: supports same Ctrl/Shift modifiers
  - `InternalLink.svelte`: dispatches `shiftKey` alongside `newLeaf` for window navigation
  - `editNoteModal.ts`: `onOpenNote` signature changed to `(openMode: false | 'tab' | 'window') => void`
  - `linkBehavior` setting no longer affects click behavior (always opens modal on simple click)
- **i18n** — added translation keys for pin/unpin, persist/unpersist, collapse/expand columns (en, ru, uk, zh-CN)

### Fixed
- **Svelte TypeScript errors** — reduced from 326 → 0 errors by fixing type annotations across Svelte components
- **FIX-1: animationBehavior** — fixed `animationBehavior` property type mismatch with Obsidian API
- **FIX-2: Card hover jitter** — fixed card hover effect causing layout jitter in board view
- **FIX-3: persistedStatuses data layer** — fixed persisted statuses data handling in board configuration
- **Board: Column collapse mechanism** — restored original `transform: rotate(-90deg) translateX(-100%)` approach after multiple failed alternatives (`writing-mode: vertical-lr`, split template)
  - Collapse/expand button always accessible via unified template (no `{#if collapse}` split)
  - `transform-origin: left top 0px` for correct rotation pivot
- **Board: Collapsed column overlap** — constrained collapsed section height to `3rem`, adjusted `margin-right` formula (`48 - width`) to prevent overlap with neighboring columns
- **Board: Zoom breaking collapse** — replaced `transform: scale()` with CSS `zoom` property to prevent stacking context interference with `svelte-dnd-action` DnD zones
- **Settings: Tab selector disappearing on scroll** — added `flex-shrink: 0` to `.popover-header` and `.tabs` in the settings popover to prevent flex collapse when tab content overflows

### Changed
- **Board: Column header unified template** — single template for collapsed/expanded states; `.right` div always rendered with collapse/expand button; pin/persist/menu buttons hidden via `{#if !collapse}`
- **Board: Pinned columns section** — pinned columns rendered in a separate `<section>` without DnD, preventing accidental reordering
- **Board: DnD wrapper** — `flex-shrink: 0` on column wrappers to prevent column squeezing

### Technical
- **74 files changed** (+523, −669 lines)
- **Tests**: 344/344 passing (19 suites) ✅
- **Build**: OK (main.js 1.7MB, main.css 4.2KB)
- **svelte-check**: 0 errors, 0 warnings
- **Lint**: 0 errors

## [3.0.7] - 2026-02-19

### Fixed
- **Tag detection** — fixed tag-based datasource silently dropping notes
  - New `normalizeTag()` function: strips extra `#`, re-adds exactly one (`"##daily"` → `"#daily"`, `"daily"` → `"#daily"`)
  - New `stripTagHash()` helper for safe YAML storage — `replace(/^#+/, "")` instead of fragile `.replace("#", "")`
  - Fixed double-`#` bug in `parseFrontMatterTags()` — YAML `tags: ["#daily"]` no longer becomes `"##daily"`
  - `TagDataSource.includes()` now normalizes config tag before comparison
  - `dataApi.ts` uses `stripTagHash()` when writing tags to frontmatter
  - InMemFileSystem aligned with Obsidian filesystem for accurate test coverage
  - 25 new tests: 12 for `normalizeTag`/`stripTagHash`, 13 for `TagDataSource.includes()`

### Changed
- **Date field semantics** — `dateField` repurposed from "legacy start date fallback" to "creation date"
  - `dateField` no longer participates in event start detection priority chain
  - New `creationDateField` variable in CalendarView — resolved from `config.dateField`, auto-filled on note creation
  - `extractDateWithPriority()` in `calendar.ts` — removed Priority 2 (legacy dateField fallback)
  - `extractDates()` in `processor.ts` — removed `config.dateField` from start date priority
  - Settings UI label: "Поле даты (date)" → "Дата создания (date)" with explanatory hint
  - All 12 templates updated with `date` field alongside `startDate`
  - Demo project: 35 records updated with `date` field, `calendarConfig.dateField` = `"date"`

### Performance
- **Lightweight grouping hash** — `generateGroupingHash()` now hashes only `record.id` + date field value instead of `JSON.stringify` on all values (O(n×m) → O(n))
- **Lightweight records fingerprint** — `createRecordsFingerprint()` includes only calendar-relevant fields (~5-6) instead of every field per record (O(n×m) → O(n×k), k ≈ 5)
- **Synthetic DataField cache** — `resolveFieldByName()` caches synthetic fields by key, preventing new object references on every Svelte reactive tick that cascaded re-renders
- **Memoized grouping & sorting** — `groupRecordsByRange()` and `sortGroupedRecords()` only re-run when content-aware hash changes, not on every tick
- **Double-tap delay** — reduced from 300ms → 200ms for improved perceived responsiveness

### Documentation
- Updated user guides (RU/EN) with calendar date field mapping table (`startDate` / `endDate` / `date`)
- Updated READMEs (RU/EN) with `date` field in frontmatter examples
- Updated templates/README.md with `date` and `endDate` fields documentation
- Tag detection analysis: `docs/debug/tag-detection-analysis.md` (352-line root cause analysis)

### Technical
- **Tests**: 344/344 passing (19 suites) ✅
- **Build**: OK (main.js 1.6MB, main.css 4.2KB)
- **Lint**: 0 errors

## [3.0.6] - 2026-02-15

### Fixed
- **Obsidian API compliance** — technical release preparing for Obsidian Community submission
  - `vault.modify()` → `vault.process()` for atomic file writes (2 locations)
  - All `innerHTML` usage replaced with safe DOM: `setIcon()`, `el.empty()`, `createSpan()` (23 locations)
  - All `document.*` replaced with `activeDocument.*` for multi-window support (109 locations)
  - Removed 9 stray `console.log()` from production code
  - Fixed `manifest.json` description format (removed colon per guidelines)

### Changed
- **Inline styles → CSS classes** — extracted 38 repeated inline style patterns into `.ppp-popover-*` and `.ppp-pop-*` CSS classes in `styles.css`
- **Hardcoded colors → CSS variables** — replaced 17 hardcoded color values with Obsidian CSS variables (`var(--text-error)`, `var(--color-red-rgb, ...)`, `var(--background-modifier-hover)`, etc.)
- **`@ts-ignore` → `@ts-expect-error`** — converted all 28 `@ts-ignore` directives; removed 25 that were unnecessary, kept 5 with proper error descriptions
- **ESLint configuration** — added `eslint-plugin-obsidianmd` (v0.1.9) with 23 Obsidian-specific rules enabled

## [3.0.5] - 2026-02-09

### Added
- 🎯 **Comprehensive Filter System (42 operators)**
  - Base: `is-empty`, `is-not-empty`
  - String: `is`, `is-not`, `contains`, `not-contains`, `starts-with`, `ends-with`, `regex`
  - Number: `eq`, `neq`, `lt`, `gt`, `lte`, `gte`
  - Boolean: `is-checked`, `is-not-checked`
  - Date: `is-on`, `is-not-on`, `is-before`, `is-after`, `is-on-and-before`, `is-on-and-after`, `is-today`, `is-this-week`, `is-this-month`, `is-overdue`, `is-upcoming`
  - List/Tags: `has-any-of`, `has-all-of`, `has-none-of`, `has-keyword`
  - Filter Groups with nested AND/OR logic (up to 3 levels)
  - Dynamic operator lists per field type

- 🚀 **Advanced Filter Mode**
  - Formula-based filtering with full tokenizer + parser + evaluator (620 lines)
  - 42 built-in functions (AND, OR, NOT, IS_EMPTY, CONTAINS, IS_TODAY, HAS_ANY_OF, etc.)
  - Real-time validation with error reporting
  - Function palette with categorization (logical/comparison/date/array)
  - Fields palette with type indicators
  - Keyboard shortcuts: Ctrl+Space (functions), Tab (indent)

- 📋 **Agenda 2.0 — Custom Lists**
  - List builder — create, edit, delete lists with filters
  - Lucide + Emoji icon picker for each list
  - Custom accent color for left border
  - DQL-compatible date formulas: `today`, `sow`, `eom`, `today+1w`, `som-1m`
  - Value autocomplete from vault frontmatter
  - Visual and Advanced filter modes

- 📝 **Frontmatter Editor Improvements**
  - YAML Date objects correctly detected as Date type
  - Plain objects → String (via JSON.stringify)
  - "Note fields" vs "Project fields" separation
  - Project fields collapsed by default with dashed border

- 🛡️ **Settings Panel Redesign**
  - Chip-based UI for filters, sort, and color rules
  - Imperative DOM popups via `document.body.appendChild()`
  - Fixed dropdown closing settings panel

- 🌐 **Full i18n Audit**
  - EN: added 5 missing keys (heatmap, components.note.edit)
  - RU: major restructuring — removed 18 dead keys, added ~60 new keys
  - Added sections: modals.view (16), modals.field (28), modals.input, modals.confirm
  - Added: views.developer, views.table, views.board, views.gallery
  - Added: navigation.active-project, heatmap keys, short-titles

### Fixed
- 🔧 **Agenda sidebar collapse** — local Set prevents state leak between lists
- 🔧 **detectCellType** — Date objects and plain objects handled correctly
- 🔧 **Settings dropdown** — no longer closes settings panel when opened

### Technical
- **filterEngine.ts v3.1.0**: Unified API for visual + advanced modes
- **formulaParser.ts**: Complete tokenizer + parser + evaluator
- **operatorHelpers.ts**: Field-type-aware operator management
- **suggestionCollector.ts**: Autocomplete value collection
- **filterHelpers.ts**: Shared helpers for settings UI tabs
- **dateFormulaParser.ts**: DQL-compatible formula parser
- **Backward compatibility**: Old filter format automatically migrated
- **Tests**: 291/291 passing ✅
- **Build**: 1.6MB bundle ✅
- **ESLint**: 0 errors ✅
- **TypeScript**: Strict mode, 0 compilation errors
- **/skip comments**: 14 documented locations

### Documentation
- **architecture-filters.md**: Filter system architecture
- **architecture-agenda.md**: Agenda 2.0 architecture

---

## [3.0.4] - 2026-02-03

### Fixed
- 🔧 **Async Methods Without Await (7 instances)**
  - Fixed `dataApi.ts:163` — Added `await` to `file.delete()` call in deleteRecord
  - Fixed `inmem/filesystem.ts` — Removed `async` from synchronous methods (read/write/delete/create)
  - Fixed `view.ts` — Added explicit `void` return type to `onload()` method
  - **Commit**: eb46fab
  - **Impact**: Eliminates false async/await patterns, improves code clarity ✅

- ⚙️ **Type Safety Improvements (3 instances)**
  - Fixed `editNoteModal.ts:33` — Removed unnecessary async/await (onRenameNote returns void, not Promise)
  - Fixed `logger.ts:99` — Changed error parameter from `Error | unknown` to `unknown` (union was redundant)
  - Fixed `view.ts:56` — Simplified onPaneMenu source parameter from union to `string` (string subsumes literals)
  - **Commit**: eb46fab
  - **Impact**: Cleaner types, fixes TypeScript compilation warnings ✅

- 📦 **Optional Improvements**
  - Upgraded to `FileManager.trashFile()` from `Vault.trash()` (2 instances)
  - Now respects user's file deletion preferences (trash vs permanent delete)
  - Updated: `ObsidianFile.delete()` and `ObsidianFileSystem.delete()`
  - **Commit**: eb46fab

- 🔍 **Type Analysis Documentation**
  - Created comprehensive `docs/ANY_TYPES_ANALYSIS.md` (600+ lines)
  - Analyzed all 25 `any` types in codebase
  - Result: 20 justified (80%) — API constraints, generic utilities, external libraries
  - Fixed: 3 safe improvements (viewSort.ts isEmpty: `any` → `unknown`)
  - Removed: 2 dead code methods (filesystem.ts readValue/writeValue)
  - **Commit**: 343c84c
  - **Impact**: Demonstrates excellent type hygiene for community plugin review ✅

### Technical
- **Tests**: 150/150 passing ✅
- **Build**: Successful (6.5s, 1.4MB bundle) ✅
- **ESLint**: 0 errors ✅
- **TypeScript**: All compilation errors resolved ✅
- **Regressions**: None detected ✅
- **Code Review**: All required Obsidian review issues resolved
- **Documentation**: ANY_TYPES_ANALYSIS.md explains justified `any` usage

### Notes
- Remaining 20 `any` types are architecturally justified:
  - Generic utilities (throttle, debounce) — standard TypeScript patterns
  - Settings migration — handles v1/v2/v3 formats with untyped Plugin.loadData()
  - Event bus — dynamic payloads by design
  - External APIs — Dataview integration, Obsidian incomplete type definitions
- All changes follow Obsidian Plugin Guidelines
- Plugin ready for community plugins submission

## [3.0.2] - 2026-01-27

### Fixed
- 📊 **Table View - Reactive Date Formatting**
  - Fixed critical issue where date formats weren't applied from project settings
  - Changed from static setContext to reactive Svelte store (writable)
  - Dates now update immediately when format settings change
  - Project context properly propagates to all date cells
- ❌ **Table View - Invalid Date Validation**
  - Added rawValue prop for displaying non-date values in date fields
  - Invalid values (e.g., string "2" in date field) now show with red background
  - Each cell handles errors independently - one bad date doesn't break others
  - Invalid data shown as-is for easy debugging
- 🎛️ **Board View - Group By Field**
  - Added dropdown selector for grouping field in view configuration
  - Only string fields with options are suggested
  - Settings persist correctly in view config

### Added
- ⚙️ **Animation Behavior Setting**
  - New global preference: Smooth / Instant animations
  - Calendar scrollIntoView respects this setting
  - Translations for Russian and English

### Changed
- 🧹 **Interface Cleanup**
  - Removed project dropdown from CompactNavBar completely
  - Removed unused props (projects, projectId)
  - Optimized rendering with fewer unnecessary redraws

## [3.0.1] - 2026-01-27

### Fixed
- 📱 **DayPopup Mobile Scrolling** - Fixed native scroll on mobile devices
  - Removed blocking of touch events that prevented scrolling
  - Added `cancelable` check before preventDefault()
  - Touch scrolling now works smoothly without interference
  - Fixed "Intervention" console errors
- 📝 **EditNote Modal - Title Reactivity**
  - Modal now auto-closes after note rename
  - Fixed issue where old name remained after rename
  - Proper data reload with new note ID

## [3.0.0] - 2026-01-22

### Removed
- 🗑️ **3-Day View Removed** - Simplified zoom hierarchy
  - Removed '3days' from CalendarInterval type
  - Updated ZOOM_LEVELS: ['year', 'month', '2weeks', 'week', 'day']
  - Removed from all navigation and timeline configurations

### Fixed
- 🔧 **Day/Week Views - Timeline Default** - Now correctly show timeline (bars) by default
  - Changed effectiveDisplayMode logic: day/week → 'bars', 2weeks/month → 'headers'
  - Day view now renders 24-hour timeline instead of list
- 🔧 **2-Weeks View - Events Display** - Added HeaderStripsSection for multi-day events
  - Was showing empty cells, now displays multi-day strips above week rows
- 🔧 **Week View - Event Names** - Fixed file paths showing instead of names
  - Added getDisplayName() to TimelineView.svelte and EventBar.svelte
  - Priority: name field → title field → file.name → getDisplayName()
- 🔧 **Year Heatmap - Data Flow** - Enhanced date field detection
  - processor.ts now tries: startDate, date, deadline, dueDate, scheduled
  - Improved data binding to heatmap cells

### Changed
- 📐 **Simplified Zoom Hierarchy** - Removed redundant 3-day level
  - Year → Month → 2-Weeks → Week → Day (5 levels instead of 6)
  - Cleaner navigation flow
- 🎨 **Display Mode Defaults** - Smart defaults per zoom level
  - day/week: 'bars' (timeline with time axis)
  - 2weeks/month: 'headers' (grid with HeaderStripsSection)

## [3.2.0] - 2026-01-03

### Added
- 📅 **HeaderStripsSection Component** - New component for multi-day event strips
  - Renders above week rows in MonthBlock
  - Lane-based layout for overlapping events
  - Supports multi-day timed, multi-day all-day, and single all-day events

### Fixed
- 🔧 **Month View - Multi-day Events** - Now display in week header instead of cells
  - Created HeaderStripsSection.svelte (~340 lines)
  - Events spanning multiple days show as horizontal strips
  - All-day events display as pills in header row
- 🔧 **Month View - Cell Height** - Cells now have consistent fixed height
  - Removed variable height based on content
  - Header can expand but uniformly across week

### Changed
- 📐 **Day.svelte Simplified** - Removed ~200 lines of obsolete multi-day code
  - Now only renders timed events
  - Cleaner separation of concerns

## [3.0.0-beta] - 2025-12-31

### Added
- 🎯 **Timeline View** - Day/Week views with vertical time axis
  - **EventBar** - Positioned events based on start/end time
  - **EventBarContainer** - Smart column layout for overlapping events
  - **EventTimeline** - Vertical hour axis (6:00-22:00 default)
  - **CurrentTimeLine** - Red line showing current time
  - **EventIndicator** - Triangle markers (▲▼) for off-screen events
- 📅 **Multi-day Event Support**
  - **MultiDayEventStrip** - Horizontal strips spanning multiple days
  - **AllDayEventStrip** - Full-width strips for all-day events
- �️ **Year Heatmap View** - GitHub-style yearly overview
  - **Heat levels 0-4** - Color intensity based on event count
  - **Month grid layout** - 4x3 on desktop, 2xN on mobile
  - **Click navigation** - Click day to zoom into day view, click month to zoom into month view
  - **Dark theme support** - Custom GitHub-inspired dark colors
- 📋 **Agenda Sidebar** - Day summary panel with grouped events
  - Morning/Afternoon/Evening grouping with i18n support
  - Collapsible sidebar with accessibility features
  - ARIA labels and screen reader support
- 🎨 **Design Tokens** - Fluid Architecture token system
  - Primitive, semantic, and component tokens
  - rem-based sizing for accessibility
  - High contrast and reduced motion support
- ⚙️ **Extended View Config**
  - startHour/endHour configuration
  - eventColorField selection
  - showWeekends toggle
  - showAllDaySection toggle
- 🔗 **Color Filter Indicators** - Visual dots on events matching color filters
- 🌐 **Timezone Support** - Timezone-aware event display and parsing
- ⚠️ **Error Boundary** - Graceful error handling component
  - Custom fallback UI with retry option
  - Error details in development mode
  - i18n-ready error messages
- ⚡ **Performance Utilities** - Optimized event handling
  - throttle, debounce, rafThrottle functions
  - Idle callback wrapper
  - Performance measurement helpers

### Changed
- 📐 **ROADMAP v3.0.0 Compliance** - Major architecture alignment
  - DayColumn: timezone/dateField integration
  - EventTimeline: Dynamic hours calculation
  - EventBar: colorFilters prop added
- 🎨 **Compact Navigation** - Unified navigation panel with Lucide icons
- 📱 **Mobile-First** - Enhanced touch gestures and responsive layout
  - **Edge swipe protection** - Prevents conflicts with Obsidian sidebar gestures
  - **Touch action optimization** - `overscroll-behavior-x: contain` for smoother scrolling
- ♿ **Accessibility Classes** - Added sr-only, visually-hidden, skip-link
- 🌍 **Full i18n** - All hardcoded strings internationalized

### Fixed
- 🔧 **TypeScript Errors** - All compilation errors resolved
- 🔧 **Import Paths** - Consistent relative imports throughout
- ♿ **Accessibility** - aria-labels, keyboard navigation, screen reader support
- 🔄 **Resize Performance** - RAF-based resize handling for smooth updates

## [2.2.0] - 2025-01-21

### Added
- 📱 **Mobile UX Overhaul** - Complete redesign of mobile experience
  - **DayPopup** - Full-screen popup for viewing all events on a day
  - **Single Tap** - Opens DayPopup with day overview and event list
  - **Double Tap** - Creates new note directly
  - **Floating Today Button** - Semi-transparent button appears when toolbar is hidden
- 🎛️ **Toolbar Collapse** - Full toolbar hiding (not just buttons) with floating toggle
  - Collapse buttons positioned in top-left corner
  - Semi-transparent collapsed state for minimal UI
- 📅 **Day Cell Height** - 100% taller cells on mobile for better touch targets
- 🔄 **Record Actions** - Settings, duplicate, and delete actions in DayPopup
- 📋 **Duplicate Feature** - Mini calendar for selecting target dates to duplicate notes
- 🚫 **Mobile Drag Disabled** - Prevents accidental drag conflicts on touch devices

### Changed
- 🎨 **ViewToolbar** - Refactored with `.collapsed` class and floating toggle
- 📱 **Responsive Styles** - Enhanced mobile styles for View selectors
- 🌐 **Translations** - Added ru/en/uk/zh-CN translations for new DayPopup strings

### Fixed
- ♿ **Accessibility** - Added keyboard handlers for a11y compliance

## [2.1.0] - 2025-01-21

### Added
- 🔍 **Calendar Zoom Gestures** - Ctrl+scroll and pinch-to-zoom for instant view switching
  - Zoom levels: Month ↔ 2 Weeks ↔ Week ↔ 3 Days ↔ Day
- 🎯 **Date Centering** - Zoom maintains focus on the date under cursor
- 💫 **Visual Zoom Indicator** - Apple-style indicator showing current zoom level
- 🔄 **Infinite Scroll** - Smooth scrolling navigation replaces Prev/Today/Next buttons

### Changed
- 🎨 **Calendar UI Redesign** - Removed navigation buttons for cleaner interface
- ⚡ **Event Handling** - Optimized wheel event processing for zoom gestures

### Fixed
- 🐛 **Zoom Blocking** - Fixed issue where zoom stopped working after first use
- 🔧 **Ctrl+Wheel Events** - Fixed event propagation in horizontal calendar views (week/day)
- ⚡ **Debounce** - Added proper debounce to prevent multiple zoom triggers

## [2.0.1] - 2024-11-21

### Changed
- 🧹 **Code Cleanup** - Removed AI-generated slop (unnecessary/duplicate code)
- 🔧 **Build Configs** - Updated vite, tsconfig.json, package.json
- 📚 **Documentation** - Created/updated internal_docs.md with project state analysis

## [2.0.0] - 2024-01-XX

### Added
- 🎉 **Major Version Release** - Complete rewrite and enhancement of the original plugin

- ⚡ **Performance Improvements** - Enhanced loading speed and memory management
- 🎨 **UI/UX Enhancements** - Improved interface design and user experience
- 📊 **Advanced Configuration** - More customization options for projects
- 🔧 **Better Error Handling** - Improved error messages and recovery
- 📱 **Responsive Design** - Better mobile and tablet support

### Changed
- 🔄 **Plugin ID** - Changed from `obsidian-projects` to `obs-projects-plus`
- 📝 **Author Information** - Updated to reflect current maintainer (Park Pavel)
- 🏗️ **Architecture** - Improved code structure and maintainability
- 📚 **Documentation** - Enhanced README and user guides

### Fixed
- 🐛 **Memory Leaks** - Resolved memory issues in long-running sessions
- 🔧 **Compatibility** - Fixed issues with latest Obsidian versions
- 🌐 **Localization** - Improved translation accuracy and coverage
- ⚡ **Performance** - Optimized rendering for large datasets

### Security
- 🔒 **Dependencies** - Updated all dependencies to latest secure versions
- 🛡️ **Code Review** - Enhanced security practices in development

## [1.17.4] - 2024-XX-XX (Original)

### Original Features (by Marcus Olsson)
- 📋 Table view for project management
- 📌 Board view with Kanban-style interface
- 📅 Calendar view for timeline management
- 🖼️ Gallery view for visual project browsing
- 📁 Folder-based project creation
- 🏷️ Tag-based project organization
- 🔍 Dataview query integration
- 📝 Custom note templates
- ⚙️ Advanced configuration options

---

## Migration Guide

### From Original Obsidian Projects

If you're migrating from the original Obsidian Projects plugin:

1. **Backup your data** - Always backup your vault before migration
2. **Install Projects Plus** - Use BRAT or manual installation
3. **Disable original plugin** - Turn off the original Obsidian Projects plugin
4. **Import settings** - Your existing projects should be automatically detected
5. **Verify functionality** - Test all your projects and views

### Breaking Changes

- **Plugin ID changed** - Some community plugins may need updates
- **API changes** - Custom integrations may require updates
- **Settings format** - Enhanced settings with backward compatibility

---

## Support

For migration issues or questions:
- 📧 **GitHub Issues**: [Create an issue](https://github.com/ParkPavel/obs-projects-plus/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/ParkPavel/obs-projects-plus/discussions)
- 🌐 **Website**: [parkpavel.github.io](https://parkpavel.github.io/park-pavel/)
