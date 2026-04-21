# 🚀 Release Information

## Current Release: v3.4.0

**Release Date**: April 18, 2026  
**Status**: 🟢 Stable  
**Compatibility**: Obsidian 1.5.7+
**Type**: Major Feature — Database View Modernization (115 formulas, 8 widgets, 10 chart types, multi-source merge)

## 📦 Download Options

### 🎯 Recommended: BRAT Installation
```bash
# Add to BRAT
ParkPavel/obs-projects-plus
```

### 📥 Manual Installation
- **GitHub Releases**: [Download Latest](https://github.com/ParkPavel/obs-projects-plus/releases)
- **Source Code**: [View on GitHub](https://github.com/ParkPavel/obs-projects-plus)

## 🔄 Migration from Original Plugin

### Automatic Migration
Projects Plus automatically detects and migrates settings from the original Obsidian Projects plugin.

### Manual Migration Steps
1. **Backup your vault** before migration
2. **Disable** the original Obsidian Projects plugin
3. **Install** Projects Plus
4. **Enable** Projects Plus
5. **Verify** your projects are working correctly

### Breaking Changes
- **Plugin ID**: Changed from `obsidian-projects` to `obs-projects-plus`
- **API Changes**: Some API methods have been updated
- **Settings Format**: Enhanced settings with backward compatibility

## �️ Roadmap

| Priority | Feature | Version | Status | Docs |
|:--------:|---------|---------|--------|:----:|
| ✅ | **Agenda 2.0 & Filter System** | v3.0.5 | Released | [Architecture](docs/architecture-filters.md) |
| ✅ | **Obsidian Guidelines Compliance** | v3.0.6 | Released | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Optimization + Tags + Date Fields** | v3.0.7 | Released | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Board UX: persist, zoom, collapse** | v3.0.8 | Released | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Unified Filters + Instant Mode** | v3.0.9 | Released | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Mobile Feature Parity** | v3.0.10 | Released | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Deep Mobile Adaptation** | v3.1.0 | Released | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Drag & Drop 2.0** | v3.2.0 | Released | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Bugfix & Mobile UX** | v3.2.1 | Released | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Security & Code Quality** | v3.2.2 | Released | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Database View** | v3.3.0 | Released | [Architecture](docs/architecture-database-view.md) |
| ✅ | **Database View Modernization** | v3.4.0 | Released | [Architecture](docs/architecture-database-view.md) |
| 🥈 | **Calendar Sync** (iCal, Google, CalDAV) | v3.5.0 | Planned | — |

## 📋 Release Notes

---

### 🚀 v3.4.0 (April 18, 2026) — Database View Modernization

> **115 formulas, 8 widgets, 10 chart types, multi-source merge, Dataview LIST/TASK, scatter chart, ARIA accessibility, widget resize**

#### 🧮 Computation Engine
- **115 built-in formulas** (was 50+): financial (PMT, FV, NPV, IRR...), statistical (VARIANCE, PERCENTILE, CORREL...), conditional aggregations (SUMIF, COUNTIF, AVERAGEIF), durations (DAYS, WORKDAYS...), extended string (REGEX_MATCH, JOIN...), conversions (TO_CURRENCY, TO_PERCENT)
- **Cross-record @reference** — `@fieldName` to access all column values
- **8 relative date filter operators** — is-today, is-this-week, is-this-month, is-this-quarter, is-last-n-days, is-next-n-days, is-overdue, is-upcoming

#### 📊 Visualization
- **Scatter Chart** — SVG scatter plot with trend line, R², color groups, point sizing (10th chart type)
- **FilterTabs Widget** — unique field values as clickable tabs (7th widget)
- **SummaryRow Widget** — compact aggregation bar (8th widget)
- **Stats sparkline** — inline sparkline in KPI cards
- **Comparison N-metrics** — supports N metrics (was 2)

#### 🔗 Data Integration
- **Multi-source merge** — combine data from multiple folders/tags/Dataview queries
- **Dataview LIST/TASK** — parse LIST and TASK results with recursive flattening
- **DateTime precision** — Dataview dates preserve time (HH:mm)
- **Inline add row** — add records directly from Database View

#### ✨ Polish & Accessibility
- **Recursive FormulaNode** — visual formula editor with unlimited nesting depth
- **ARIA tab roving** — full keyboard navigation for all tabs
- **DataGrid ARIA** — aria-label, aria-rowindex
- **Touch visibility** — buttons visible on touch devices without hover
- **Pipeline dirty state** — unsaved changes warning
- **Widget resize** — drag bottom-right corner to resize widgets

#### 🧪 Tests
42 suites, 800 tests (was 41/730 in v3.3.1).

---

### 🏗️ v3.3.0 (April 22, 2026) — Database View

> **New view type: widget dashboard with 8 widget types, 10 chart types, transform pipeline, formulas, and full l10n (4 languages)**

#### 🆕 Database View

The new `Database` view turns any project into a customizable dashboard. Widgets arrange on a 12-column grid (desktop) or stack vertically (mobile). Each widget can have its own data transform pipeline.

**8 Widget Types**: Data Table (grouped, virtual scroll, conditional formatting), Chart (10 sub-types), Stats/KPI (19 aggregation functions), Comparison (N metric bars), Checklist (boolean field binding), View Port (embedded view), Filter Tabs (field value tabs), Summary Row (aggregation bar).

**Data Engine**: 6-step transform pipeline (Filter, Group By, Aggregate, Compute, Unpivot, Pivot) with LRU cache, 115 formula functions, relation resolver, rollup engine.

**Charts**: Bar, Horizontal Bar, Stacked Bar, Line, Area, Pie, Donut, Number/KPI, Progress, Scatter — all SVG-rendered.

**UX**: Widget Toolbar with 3 preset templates, drag-and-drop reorder, grid/stack layout toggle, ARIA accessibility, virtual scroll for >100 rows.

**i18n**: All strings localized to English, Russian, Ukrainian, Simplified Chinese (~90 keys).

**Tests**: 42 suites, 800 tests (was 23/457 in v3.2.2).

---

### 🛠️ v3.2.2 (April 10, 2026) — Security & Code Quality

> **PR #10259 audit: JSON.parse protection, Board DnD race condition fix, case-insensitive filters, +82 tests**

---

### �🛠️ v3.2.1 (April 9, 2026) — Bugfix & Mobile UX

> **Mobile popover fixes, ViewSwitcher touch architecture rewrite, agenda date selector fix, CSS pipeline vulnerability resolved**

#### 🔧 Fixed: Mobile Popovers & Keyboard

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| **Popover behind keyboard on first open** | `searchInput.focus()` triggers keyboard AFTER position is calculated | Invisible start (`opacity: 0`) → `reveal()` after `visualViewport.resize` or 120ms |
| **Field list below keyboard** | `flex-direction: column` with popover above trigger | `column-reverse` — list scrolls up, search stays at bottom |
| **Popover styles lost on git checkout** | CSS was hand-edited in `styles.css` (build artifact) | Moved to Svelte `<style>` via `:global()` → compiled into `main.js` |
| **`column-reverse` had no effect on `.ppp-pop-box`** | Base class lacked `display: flex` | Added `display: flex` to the `--mobile-kbd` modifier |

#### 🔧 Fixed: ViewSwitcher — Full Touch Architecture Rewrite

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| **Misclick on swipe (primary bug)** | `touch-action: pan-x` → browser takes control → `touchcancel` instead of `touchend` → `touchHandled` flag never set | Added `on:touchcancel` — shared handler with `touchend` |
| **Double view switch** | Swipe navigation called `onSelect()` after native scroll | **Removed** swipe-to-navigate entirely. Native `pan-x` scrolls, tap selects |
| **Visual pre-selection during scroll** | Browsers apply `:active` to buttons under finger during pan | `-webkit-tap-highlight-color: transparent` + `touch-action: manipulation` |

#### 🔧 Fixed: Agenda Date Selector Stuck on Today

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| **Date wouldn't change — always today** | Reactive block `$: if (!currentDate.isSame(selectedDate))` depended on both variables → reset on manual selection | Track only prop changes via `prevCurrentDate` — manual selection doesn't trigger reset |

#### 🚀 Improved: View Switcher (ViewSwitcher)

| Improvement | Description |
|-------------|-------------|
| **Simplified architecture** | ~130 lines of touch logic → ~30 lines. Removed `SWIPE_THRESHOLD`, `SWIPE_MIN_DISTANCE`, `isHorizontalSwipe` |
| **Dead-zone 8px** | Any movement > 8px blocks `click`. Clean tap < 8px works |
| **scrollIntoView on tap** | Selected tab smoothly scrolls to center of tab bar |

#### Metrics
- **Tests**: 375/375 PASS (21 suites)
- **Build**: OK (main.js 1.8MB, main.css 4.2KB)
- **tsc**: 0 errors
---

### 🎯 v3.2.0 (April 3, 2026) — Drag & Drop 2.0

> **Full Calendar Timeline DnD: drag events between days and time slots, strip resize, snap engine, mobile DnD with long-press**

#### 🗓️ Calendar Timeline DnD

| Feature | Description |
|---------|-------------|
| **EventBar drag** | Drag events in Week/Day timeline views to reschedule date/time |
| **Cross-day drag** | Move events between days in Week view with automatic date recalculation |
| **Strip resize** | Resize multi-day event bars by dragging left/right edges to adjust start/end dates |
| **15-min snap** | Time-based events snap to 15-minute intervals during drag |
| **Visual drop feedback** | Drop targets highlight with accent color; stronger feedback on touch devices |

#### ⚙️ TimelineDragManager

- **DragSession** — all per-drag state encapsulated in a session object: clean initiate/cleanup cycle
- **Mode detection** — single evaluation at movement threshold: move, strip-resize-start, or strip-resize-end
- **Auto-scroll** — time-based vertical auto-scroll when dragging near container edges
- **SnapEngine** — configurable snap intervals for both time (minutes) and day (index) axes
- **Mode lock** — mode re-evaluation during first 30px of drag, then locks

#### 📱 Mobile DnD

- **Long-press (500ms)** — DnD activation only after holding on drag handle
- **Haptic feedback** — `navigator.vibrate()` on snap boundaries with 100ms throttle
- **Visual feedback** — `maxHeight: 3rem`, `opacity: 0.9`, shadow during drag
- **Touch drop targets** — `@media (pointer: coarse)` with stronger accent background

#### 🛡️ Data Integrity

| Fix | Description |
|-----|-------------|
| Single mutation point | `CalendarView.handleRecordChange` is the sole date mutation path (eliminates double-shift) |
| Format preservation | Date-only fields stay date-only during DnD (no `T00:00:00.000Z` injection) |
| Multi-day span | Timed moves compute `endDate = origEnd.add(dayDelta, 'day')` — span doesn't collapse |
| Strip resize accuracy | Resize-start/end use bar start/end instead of center — eliminates delta amplification |

#### Metrics
- **Tests**: 375/375 PASS (21 suites)
- **Build**: OK (main.js 1.8MB, main.css 4.2KB)

---

### 📱 v3.1.0 (March 8, 2026) — Deep Mobile Adaptation, DnD Handle Engine & Unified Grip Design

> **Comprehensive mobile adaptation: DnD handle engine with dragHandleZone, full-screen modal, unified grip design, scroll containment, gesture coordination**

#### 🎯 DnD Handle Engine (replaces dragDisabled: isMobile)

The initial v3.1.0 approach disabled DnD entirely on mobile via `dragDisabled: isMobile`. This was rejected — instead, a proper **drag handle engine** was implemented:

| Component | Before | After |
|-----------|--------|-------|
| AgendaSidebar (lists) | `dndzone` + `dragDisabled: isMobile` | `dragHandleZone` + `dragHandle` on grip element |
| Board (columns) | `dndzone` without handle | `dragHandleZone` + `dragHandle` on grip |
| Board (cards) | `dndzone` without handle | `dragHandleZone` + `dragHandle` on grip |

**Principle**: `dragHandleZone` is a built-in API of `svelte-dnd-action`, exported from `src/wrappers/withDragHandles.js`. DnD is initiated **only** through the grip element with `use:dragHandle`, not from any point in the container. This fully resolves the touch-scroll vs drag conflict on mobile.

#### ⚙️ TouchDndCoordinator — Gesture Coordination

New module `TouchDndCoordinator.ts` (~210 lines):
- `createLongPressHandler()` — long-press guard with movement cancellation (10px threshold)
- `hapticFeedback()` — tactile feedback via `navigator.vibrate()`
- `applyDragFeedback(el)` — visual feedback during DnD: maxHeight 3rem, opacity 0.9, shadow
- `isDragHandleTarget()` — determines if touch started on a grip element
- `DRAG_HANDLE_SELECTOR` — CSS selector for grip elements

#### 🔲 Unified Grip Design

All three drag grip elements follow a consistent design pattern:

| Property | Agenda List | Board Column | Board Card |
|----------|-------------|--------------|------------|
| Type | `<span use:dragHandle>` | `<span use:dragHandle>` | `<span use:dragHandle>` |
| Size | 1rem × stretch | 1rem × 1.25rem | 0.5rem × 1rem |
| Position | inline (flow) | absolute, top-left | absolute, left-center |
| Desktop | `opacity: 0` → hover `0.45` | `opacity: 0` → hover `0.45` | `opacity: 0` → hover `0.45` |
| Touch | `opacity: 0.35` always | `opacity: 0.3` always | `opacity: 0.25` always |
| Hover bg | `var(--background-modifier-hover)` | same | same |
| Icon | `grip-vertical` xs | `grip-vertical` xs | `grip-vertical` xs |

#### 📱 Full-Screen Modal (AgendaListEditor)

AgendaListEditor modal on mobile (`max-width: 37.5rem`) is now a **full-screen takeover** instead of bottom-sheet:
- `.list-editor-overlay`: `align-items: stretch` — modal fills entire screen
- `.list-editor-modal`: `height: 100%; max-height: none; border-radius: 0`
- Footer: `padding-bottom: calc(3.5rem + env(safe-area-inset-bottom))` — 3.5rem clears Obsidian toolbar
- Scroll: `touch-action: auto` on overlay, `overscroll-behavior: contain` on modal

#### 🏷️ Mobile Filter Row Wrapping

Filters inside the modal editor now wrap correctly on narrow screens:
- `.filter-row`: `flex-wrap: wrap` on touch devices
- `.chip-wrapper`: `flex-shrink: 1; min-width: 0` — chips can shrink
- `.chip-label`: `max-width: 4.5rem`
- `.row-prefix`: narrowed from 32px to 24px
- `.fg-actions`: `padding-left: 0; flex-wrap: wrap`

#### 🔒 Scroll Isolation (overscroll-behavior: contain)

Root cause of mobile issues — **scroll chaining**: when a nested scrollable container reaches its edge, the browser passes remaining scroll momentum to the parent container all the way up to Obsidian, triggering unintended gestures (pull-to-refresh, sidebar swipe).

Applied `overscroll-behavior: contain` to 10+ scrollable containers: App root, AgendaSidebar (5 selectors), InfiniteHorizontalCalendar, Board, SettingsMenuPopover, AgendaIconPicker, AgendaListEditor.

#### 🔄 Mobile DnD Replacement

DnD (`svelte-dnd-action`) uses `touchstart`/`touchmove` which cannot be distinguished from scroll on touchscreens. Solution — **drag handle engine**:

| Before | After |
|--------|-------|
| DnD on all devices, scroll conflict | DnD only via grip element (`dragHandleZone` + `dragHandle`) |
| Context menu as replacement | Context menu preserved as alternative |
| Free scroll only with DnD disabled | Scroll always works, DnD — only from grip |

#### 📐 Timebar Alignment Fix

Fixed strip segment alignment in `HeaderStripsSection`:
- **Before**: `margin-left`/`margin-right` → flex margins shrink available space outside the item
- **After**: `padding-left`/`padding-right` → padding stays inside `box-sizing: border-box`
- Each strip segment now shares exact width with the Day cell below

#### 🏷️ EditNote Label Clipping Fix

- Mobile `.group-content`: `overflow-x: visible; overflow-y: hidden` (preserves collapse animation)
- Desktop `.setting-item-info` max-width: 8rem → 10rem

#### 👆 ViewSwitcher Edge-Aware Gestures

- `touch-action: pan-x` + `overscroll-behavior-x: contain` on `.view-switcher`
- `stopPropagation()` skipped at first/last view boundary — Obsidian sidebar gesture works at nav edges

#### 🍎 iOS Safe Area

ViewToolbar floating toggle: `top: max(8px, env(safe-area-inset-top, 8px))` for notch/Dynamic Island.

#### Mobile Bottom-Sheet → Full-Screen Takeover

AgendaListEditor modal on mobile (`max-width: 37.5rem`) now displays as a **full-screen modal** with padding-bottom for the Obsidian navbar.

#### 🔄 Calendar Cell Inner Scroll (Shift + Wheel)

In headers (list) mode, day cells support **inner content scrolling** when Shift is held:

| Behavior | Description |
|----------|-------------|
| **Shift + wheel** | Scrolls the event list inside the cell |
| **Wheel without Shift** | Date navigation (default behavior) |
| **Smart passthrough** | At scroll boundaries (top/bottom), event propagates for calendar navigation |
| **No overflow** | If all events fit — Shift+wheel navigates as usual |

- All `cellRecords` rendered in `.event-scroll-area` (no MAX_VISIBLE_EVENTS limit)
- `overflow-y: hidden` + programmatic scrolling via `scrollTop`
- Compact "N more" button with gradient fade overlay

#### 📐 Full Height Week/Day in Headers Mode

Week and day view cells now use the **full available viewport height**:

| Element | Before | After |
|---------|--------|-------|
| `.infinite-horizontal-calendar` | `height: fit-content` | `height: 100%` |
| `.period-container` | `height: fit-content` | `height: auto` |
| `.period-content` | `height: fit-content` | flex-auto |
| `<Week>` | `useFixedHeight={true}` | `useFixedHeight={false}` |

#### ⚡ Instant Mode View Switching

Week and day view switching in "instant" mode is now **fully animation-free**:

**Root cause**: `smoothScrollTo()` was called with a hardcoded `duration: 400`, bypassing `getAnimationDuration()` which returns 0 in instant mode. Removed the explicit argument — function now consults user's animation preference.

| Layer | Before | After |
|-------|--------|-------|
| JS scroll | 400ms always | 0ms in instant |
| CSS view-layer | `transition: opacity 200ms, transform 200ms` | `transition: none` |
| CSS fadeIn/slideIn | `animation: 200–300ms` | `animation: none` |
| setTimeout × 8 | 50–300ms fixed | 0ms in instant |
| Snap delay + reset | 120ms + 300ms | 0ms in instant |

#### 🛡️ Data Integrity Fixes

| Bug | Problem | Fix |
|-----|---------|-----|
| BUG-1 | DnD doubled shift when endDate ≠ startDate | Removed endDate mutation in `handleDrop` |
| BUG-7 | Duplicate time injection during DnD | Guard `if (slotHour !== undefined)` |
| BUG-2 | Field clearing set `undefined` instead of `null` | `null` for proper deletion |

#### 🎨 Calendar Visual Fixes

| Bug | Problem | Fix |
|-----|---------|-----|
| BUG-3 | Mini-events on mobile didn't fit | Compact sizing with `min-height: 0.875rem` |
| BUG-4 | Overflow clip hid content | `clip` → `hidden` in EventList and AgendaListEditor |
| BUG-5 | "Today" highlight with timezone error | Replaced with TZ-safe `startOfDay()` |
| BUG-6 | Resize jitter + grid z-index | RAF-throttle on mousemove, z-index 6→7 |

#### Metrics
- **Files changed**: 22 (+560, −48 lines)
- **Tests**: 344/344 PASS (19 suites) → after hotfixes: **375/375 PASS (21 suites)**
- **Build**: OK (main.js 1.8MB, main.css 4.2KB)

#### Post-Release Hotfixes (included in v3.1.0 build)

| Fix | Description |
|-----|-------------|
| Mobile Data Loss | Removed `dataGeneration` guard in `calendarView.ts` — CalendarView now delivers data via `$set()` like Table/Board/Gallery |
| Timeline Z-Index | `CurrentTimeLine` z-index 100→10, `isolation: isolate` on ViewContent — prevents overlapping Agenda |
| Board Zoom iOS | CSS `zoom` replaced with `transform: scale()` in `Board.svelte` — Safari/iOS compatibility |
| Numeric Date Hardening | `parseDateInTimezone` rejects numbers; `isDateLike` rejects numbers; `calculateSpanInfo` capped at 365 days |
| Agenda DnD Reset | `getLatestProject()` reads current project from settings store instead of stale prop — reordering lists no longer resets view |

---

### 📱 v3.0.10 (February 25, 2026) — Mobile Feature Parity

> **Long-press navigation, mobile note opening, pinch-to-zoom, responsive gallery, touch feedback**

#### 👆 Long-Press Navigation (All Views)

On touch devices, long-press (500ms) on note links/cards shows Obsidian `Menu` with "Open note", "Open in new tab", "Open in new window" — supported in Board, Table, Gallery, InternalLink.

#### 📝 EditNote Mobile Open Mode

- **Desktop**: Ctrl+Click → tab, Shift+Click → window (unchanged)
- **Mobile**: single tap on button → dropdown menu with all 3 modes

#### 🔍 Board: Pinch-to-Zoom

Two-finger pinch gesture for board zoom (25%–200%) with Safari `GestureEvent` support.

#### 🖼️ Gallery: Responsive Grid

Card width capped at 200px on mobile. Touch feedback via `:active` states on `@media (pointer: coarse)`.

#### Metrics
- **Tests**: 344/344 PASS (19 suites)
- **Build**: OK (main.js 1.67MB, main.css 4.2KB)

---

### ⚡ v3.0.9 (February 25, 2026) — Unified Filters, Instant Mode, Mobile CSS

> **Filter code deduplication, instant transition fix, CSS breakpoint normalization, guidelines compliance**

- **Unified filter extraction** — shared `getFilterValuesFromConditions()` replaces 4 duplicate implementations
- **Instant transitions** — `animationBehavior: "instant"` now fully suppresses Calendar period/unit animations and NavigationController scroll
- **CSS breakpoints** — all `@media` breakpoints standardized to rem (`48rem`, `37.5rem`, `30rem`)
- **Console logging** — 33 direct `console.debug/warn/error` calls replaced by centralized `calendarLogger`

#### Metrics
- **Tests**: 344/344 PASS (19 suites)
- **Build**: OK (main.js 1.67MB, main.css 4.2KB)

---

### 🏗️ v3.0.8 (February 24, 2026) — Board UX: Persist, Zoom, Collapse, Navigation

> **Column persist, board zoom, collapse restoration, settings fix, unified note navigation**

#### 📌 Column Persist

Board columns can now be "persisted" — they remain visible even when no records match that status.

| Feature | Description |
|---------|-------------|
| **Context menu** | "Persist" / "Unpersist" per column |
| **Header button** | bookmark-plus / bookmark-minus icon |
| **Visual indicator** | Gray left border (`var(--text-faint)`) for persisted; accent border for pinned+persisted |
| **Storage** | `persistedStatuses` in `BoardConfig`, survives reloads |

#### 🔍 Board Zoom (Ctrl+Scroll)

| Parameter | Value |
|-----------|-------|
| **Range** | 25% — 200% |
| **Step** | 5% |
| **Control** | Ctrl + mouse wheel |
| **Indicator** | Badge in bottom-right corner, click to reset |
| **Technology** | CSS `zoom` (not `transform: scale`) — preserves DnD |
| **Storage** | `boardZoom` in view config |

#### � Unified Note Navigation

Consistent modifier-based navigation across all views (Board, Table, Gallery, Calendar):

| Action | Result |
|--------|--------|
| **Click** | Opens EditNoteModal (intermediate step) |
| **Ctrl+Click** | Opens note in a new Obsidian tab (adjacent) |
| **Shift+Click** | Opens note in a new Obsidian window |

Changes:
- **Table**: left-click on row number now opens modal (previously context menu only)
- **Board / Gallery**: simple click always opens modal (removed `linkBehavior` dependency)
- **Calendar**: click on event in popup → modal (previously direct note open)
- **Modal**: "Open Note" button supports Ctrl/Shift modifiers
- **InternalLink**: dispatches `shiftKey` alongside `newLeaf` for window navigation
- **editNoteModal**: `onOpenNote` signature → `(openMode: false | 'tab' | 'window') => void`

#### �🔧 Column Collapse Restoration

The collapse mechanism broke after zoom was added and went through 3 failed approaches:

| Approach | Problem |
|----------|---------|
| `writing-mode: vertical-lr` on section | Inherited by children, broke header flexbox |
| Fixed width + `writing-mode` | Split template, click unreliable in DnD zone |
| Remove `writing-mode` from section only | Expand button hidden in collapsed state |

**Final solution**: restored original approach:
- `transform: rotate(-90deg) translateX(-100%)` + `transform-origin: left top`
- `height: 3rem; overflow: hidden` — fixed section height
- `margin-right: ${48 - width}px` — correct margin without overlap
- Unified header template — expand button always accessible

#### 🛠️ Other Fixes

| Issue | Solution |
|-------|----------|
| 326 Svelte TypeScript errors | Fixed type annotations → 0 errors |
| animationBehavior (FIX-1) | Aligned type with Obsidian API |
| Card hover jitter (FIX-2) | Fixed layout shift on hover |
| persistedStatuses (FIX-3) | Fixed data layer configuration |
| Zoom breaks collapse | `transform: scale()` → CSS `zoom` |
| Collapsed column overlap | `height: 3rem` + `margin-right: 48-width` |
| Settings tab selector disappears | `flex-shrink: 0` on header and tabs |
| New note ignores filters | `getFilterValues()` for all 4 views |

#### 📐 Adaptive Layout

- Container queries (`@container view-content`) for column/card width adaptation
- Media queries for mobile: < 48rem and < 30rem

#### Metrics

- **Files changed**: 74 (+523, −669 lines)
- **Tests**: 344/344 PASS (19 suites)
- **Build**: OK (main.js 1.7MB, main.css 4.2KB)
- **svelte-check**: 0 errors, 0 warnings
- **Lint**: 0 errors

---

### ⚡ v3.0.7 (February 19, 2026) — Optimization, Tags, Date Fields

> **Performance regression fix, tag detection fix, date field semantics rework**

#### 🚀 Performance Optimization

After v3.0.6 (replacing `document.*` → `activeDocument` and other compliance fixes), a regression appeared: Svelte reactive computations were doing expensive `JSON.stringify` on all fields of every record on each tick.

| Optimization | Before | After |
|-------------|:------:|:-----:|
| Grouping hash | `JSON.stringify` all values O(n×m) | Hash only `id` + date field O(n) |
| Records fingerprint | All fields per record O(n×m) | Only 5-6 calendar fields O(n×k) |
| Synthetic DataField | New object per tick → cascade re-render | Cache by `name:type` key |
| Grouping & sorting | Recalculated every Svelte tick | Memoized by content-aware hash |
| Double-tap (mobile) | 300ms delay | 200ms — faster response |

#### 🏷️ Tag Detection Fix

Tag-based datasource was silently dropping notes due to inconsistent `#`-prefix normalization.

| Problem | Root Cause | Fix |
|---------|-----------|-----|
| Input without `#` didn't work | `"project"` ≠ `"#project"` | `normalizeTag()` — always exactly one `#` |
| YAML `tags: ["#daily"]` → `"##daily"` | `"#" + "#daily"` = double `#` | `normalizeTag()` strips all `#` and adds one |
| Writing to frontmatter | `.replace("#", "")` — only removed first `#` | `stripTagHash()` — `replace(/^#+/, "")` |
| InMemFileSystem diverged from Obsidian | Different tag parsing logic | Unified via `normalizeTag()` |

- Universal `normalizeTag()` function: `"daily"` → `"#daily"`, `"##daily"` → `"#daily"`, `"  #daily  "` → `"#daily"`
- 25 new tests: 12 for normalization, 13 for `TagDataSource.includes()`
- Detailed analysis: [tag-detection-analysis.md](docs/debug/tag-detection-analysis.md) (352 lines)

#### 📅 Date Field Rework

The `dateField` has been repurposed: was "legacy start date fallback" → now "note creation date".

| Aspect | Before (v3.0.6) | After (v3.0.7) |
|--------|:---------------:|:--------------:|
| `dateField` in priority chain | Priority 2 (startDate fallback) | Not used |
| Creation field | Did not exist | `creationDateField` — auto-filled |
| Settings label | "Date field (date)" | "Creation date (date)" |
| Templates | Only `startDate` | `startDate` + `date` |
| Demo project | `calendarConfig.dateField = "startDate"` | `calendarConfig.dateField = "date"` |

**Three calendar date fields:**

| Field | Purpose | Affects position |
|-------|---------|:----------------:|
| `startDate` | Event start — determines calendar position | ✅ |
| `endDate` | Event end — for multi-day events | ✅ |
| `date` | Note creation date — auto-filled | ❌ |

#### Metrics

- **Tests**: 344/344 PASS (19 suites, +53 tests vs v3.0.6)
- **Build**: OK (main.js 1.6MB, main.css 4.2KB)
- **Lint**: 0 errors

---
### 🔧 v3.0.6 (February 15, 2026) — Technical Compliance Release

> **Full alignment with Obsidian Plugin Guidelines for Community Plugins submission**

#### Fixed

| Issue | Before | After | Count |
|-------|:------:|:-----:|:-----:|
| `vault.modify()` — data race | `vault.modify` | `vault.process` (atomic writes) | 2 |
| `innerHTML` — XSS vulnerability | `innerHTML = ...` | `setIcon()`, `el.empty()`, `createSpan()` | 23 |
| `document.*` — multi-window broken | `document.` | `activeDocument.` | 109 |
| `console.log` in production | 9 calls | 0 (removed) | 9 |
| `manifest.json` description | contained `:` | removed (bot regex disallows) | 1 |

#### Improved

| Category | Description |
|----------|-------------|
| **Inline styles → CSS** | 38 repeated inline style patterns extracted to `.ppp-popover-*`, `.ppp-pop-*` CSS classes (~170 lines in `styles.css`) |
| **CSS colors** | 17 hardcoded rgba/hex replaced with Obsidian CSS variables (`--text-error`, `--color-red-rgb`, `--background-modifier-hover`, etc.) |
| **@ts-ignore** | 28 → 0. All replaced: 25 were unnecessary, 5 `@ts-expect-error` kept with proper descriptions |
| **ESLint** | Added `eslint-plugin-obsidianmd` (v0.1.9) — 23 Obsidian community rules for automated checks |

#### Metrics

- **Files affected**: ~30 (26 source + 4 config/docs)
- **Tests**: 291/291 PASS (16 suites, 0 failures)
- **Build**: OK (main.js 1.6MB, main.css 4.2KB)
- **Lint**: clean (0 errors)

---

### 🎉 v3.0.5 (February 9, 2026) — Agenda 2.0 & Filter System

> **Comprehensive filter system, custom agenda lists, full i18n audit**

#### 🎯 Filter System — 42 Operators

Completely reworked filter engine supporting all frontmatter field types.

| Category | Operators | Description |
|----------|-----------|-------------|
| **Text** | `is`, `is-not`, `contains`, `not-contains`, `starts-with`, `ends-with`, `regex` | Full-text search, regular expressions |
| **Number** | `eq`, `neq`, `lt`, `gt`, `lte`, `gte` | Numeric comparison (supports string "0" coercion) |
| **Boolean** | `is-checked`, `is-not-checked` | Checkbox filtering |
| **Date** | `is-on`, `is-not-on`, `is-before`, `is-after`, `is-on-and-before`, `is-on-and-after`, `is-today`, `is-this-week`, `is-this-month`, `is-overdue`, `is-upcoming` | 11 date operators including relative |
| **List/Tags** | `has-any-of`, `has-all-of`, `has-none-of`, `has-keyword` | Multi-values, tags, arrays |
| **Basic** | `is-empty`, `is-not-empty` | Value presence check |

**Backward compatibility**: legacy operators (`equals` → `is`, `greater_than` → `gt`, `is_today` → `is-today`) are automatically migrated.

#### 📋 Agenda 2.0 — Custom Lists

New calendar sidebar system with a personal task list builder.

- **List builder** — create, edit, delete, duplicate lists
- **Icons** — choose from Lucide (200+ icons) + Emoji Grid with search
- **Color coding** — custom HEX color for list left border
- **Collapse** — each list can be collapsed/expanded, state is preserved
- **Context menu** — edit, duplicate, delete via right-click
- **Demo project** — 5 ready-made filters for quick start

##### Filter Groups
- **Nested groups** — AND/OR logic with arbitrary depth (up to 3 levels)
- **Drag-and-drop** — visual filter movement between groups
- **Group-level conjunction** — each group defines its own AND/OR

##### Date Formulas (DQL-compatible)

| Formula | Description | Example |
|---------|-------------|---------|
| `today` | Current day | `is-on: today` |
| `tomorrow`, `yesterday` | Relative days | `is-before: tomorrow` |
| `sow`, `eow` | Start/end of week | `is-on-and-after: sow` |
| `som`, `eom` | Start/end of month | `is-before: eom` |
| `soy`, `eoy` | Start/end of year | `is-after: soy` |
| `today+1w` | Offset with unit | `is-on-and-before: today+1w` |
| `som-1m` | Offset from anchor | `is-after: som-1m` |

Supported units: `d` (days), `w` (weeks), `m` (months), `y` (years).

##### Value Autocomplete
- **Vault suggestions** — unique values from all project notes
- **Frontmatter hints** — options, tags, statuses
- **Multi-values** — comma-separated input for `has-any-of`, `has-all-of`, `has-none-of`

#### 🔧 Advanced Filter Mode

Alternative to visual mode — Google Sheets-style formulas:

```
AND(
  CONTAINS(status, "doing"),
  IS_AFTER(startDate, "today"),
  HAS_ANY_OF(tags, "work", "project")
)
```

- **Formula parser** — full tokenizer + parser + evaluator (620 lines of code)
- **42 built-in functions**:
  - Logical: `AND()`, `OR()`, `NOT()`
  - Comparison: `IS()`, `IS_NOT()`, `CONTAINS()`, `STARTS_WITH()`, `ENDS_WITH()`, `REGEX()`
  - Numeric: `EQ()`, `NEQ()`, `LT()`, `GT()`, `LTE()`, `GTE()`
  - Date: `IS_ON()`, `IS_BEFORE()`, `IS_AFTER()`, `IS_TODAY()`, `IS_THIS_WEEK()`, `IS_OVERDUE()`
  - Array: `HAS_ANY_OF()`, `HAS_ALL_OF()`, `HAS_NONE_OF()`, `HAS_KEYWORD()`
  - Check: `IS_EMPTY()`, `IS_NOT_EMPTY()`, `IS_CHECKED()`, `IS_NOT_CHECKED()`
- **Real-time validation** — errors shown while typing
- **Function palette** — categorized functions (Ctrl+Space to open)
- **Field suggestions** — with data type indicators (📝 string, 🔢 number, 📅 date, etc.)
- **Hotkeys** — `Ctrl+Space` (functions), `Tab` (indent), comments via `#`

#### 📝 Frontmatter Editor — Improvements

- **Type detection** — YAML Date objects (created by YAML parser) correctly detected as Date, not Object
- **Object handling** — plain objects (nested YAML objects) → String (via JSON.stringify) instead of error
- **Field separation** — edit modal now shows:
  - **"Note fields"** — current note fields (editable)
  - **"Project fields"** — fields from project configuration (read-only, collapsed)
- **Collapsed groups** — project fields collapsed by default with `border-style: dashed`
- **config! assertion** — safe assertion for optional config in EditNote.svelte

#### 🛡️ Settings Panel — Redesign

Reworked UI architecture for Filters, Sort, and Colors tabs in view settings:

- **Chip-based UI** — each rule (filter/sort/color) rendered as interactive chip row
- **Imperative DOM popups** — all dropdown menus rendered via `document.body.appendChild()`, not inside settings container
- **Close bug fixed** — clicking dropdown used to close entire settings panel (due to event bubbling), now `event.stopPropagation()` blocks it
- **filterHelpers.ts** — shared library with `getOperatorLabel()`, `getFieldTypeIcon()`, `getOperatorsByFieldType()`

#### 🌐 Translations — Full i18n Audit

##### English (en.json)
- Added 5 missing keys: `heatmap.previousYear`, `heatmap.nextYear`, `heatmap.loading`, `heatmap.noData`, `components.note.edit`

##### Russian (ru.json) — Major Restructuring
- **Removed 18 dead keys** from `modals.project.create` (flat keys replaced by nested structure)
- **Added modal sections**:
  - `modals.view` — 16 keys (create/duplicate/delete view)
  - `modals.field` — 28 keys (configure/create field)
  - `modals.input` — Cancel button
  - `modals.confirm` — delete/cancel confirmations
- **Added view sections**:
  - `views.developer` — developer tools
  - `views.table` — table (sort, hide, pin, resize)
  - `views.board` — board (add, note, no-status)
  - `views.gallery` — gallery (cover, fit)
- **Restructured `modals.note.create`** — from flat to nested:
  - `name.name` / `name.description` → note name
  - `templatePath.name` / `templatePath.description` / `templatePath.none` → template path
  - `project.name` / `project.description` → project selection
- **Added short-titles** for: project edit, project duplicate, project archive, project delete, note edit, archive delete
- **Added**: `navigation.active-project`, heatmap keys (previousYear/nextYear/loading/noData)
- **Removed 3 dead subsections** from `components` (project, view, field — tied to old modals)
- **Fixed duplicate** `multi-text` key (was at lines 364 and 370)

#### 🤖 Code Quality
- **291 tests** — 16 test suites, all passing ✅
- **0 compile errors** — TypeScript strict mode
- **/skip comments** — 14 locations with explanations for `@ts-ignore` and `innerHTML`
- **ESLint** — 0 errors
- **Bundle** — 1.6 MB (main.js) + 4.2 KB (main.css)

#### 📂 New Files

| File | Lines | Purpose |
|------|-------|---------|
| `filterEngine.ts` | 514 | Filter engine with 42 operators |
| `filterEngine.test.ts` | 501 | 56 tests for the engine |
| `operatorHelpers.ts` | 176 | Operator mapping by field type |
| `suggestionCollector.ts` | 141 | Value autocomplete from vault |
| `FilterRow.svelte` | 984 | Filter chip row with imperative popover |
| `FilterGroupEditor.svelte` | 350 | Nested AND/OR group editor |
| `AgendaListEditor.svelte` | 743 | Full list editor component |
| `AgendaCustomList.svelte` | 367 | Custom list component |
| `AgendaIconPicker.svelte` | 233 | Lucide + Emoji icon picker |
| `DateFormulaInput.svelte` | 398 | Date formula input with suggestions |
| `dateFormulaParser.ts` | 280 | DQL-compatible date formula parser |
| `formulaParser.ts` | 620 | Advanced mode parser |
| `filterHelpers.ts` | 120 | Shared helpers for Settings UI |

---

### 🔄 v3.0.4 (February 3, 2026) — Autosave Settings

> **Control frontmatter save behavior**

#### ✅ Autosave Toggle
- **New setting** — toggle in project settings (More settings → Autosave)
- **Autosave (on)** — changes save automatically, green checkmark indicator
- **Manual save (off)** — Save button, modal closes after saving
- **Default**: enabled (preserves existing behavior)

#### 🤖 Obsidian Community Compliance
- **Any-types handling** — `/skip` comments for ~70 ESLint issues
- **Publication ready** — meets Community plugins requirements

#### 🌐 Translations
- **English** — full autosave translations
- **Russian** — comprehensive project settings translations

---

### 🛠️ v3.0.3 (January 30, 2026) — Bot Review Fixes

> **Fixes from Obsidian Community Bot review**

#### 🔧 Async/Await Cleanup
- **dataApi.ts** — added await for file.delete()
- **inmem/filesystem.ts** — removed unnecessary async
- **view.ts** — explicit void return type

#### ⚙️ Type Safety
- **editNoteModal.ts** — removed unnecessary async/await
- **logger.ts** — simplified error parameter type
- **view.ts** — simplified source parameter type

---

### 🛠️ v3.0.2 (January 27, 2026) — Date Formatting & Validation

> **Critical fixes for date display in Table view**

#### 📊 Table View — Reactive Date Formatting
- **Svelte Store for context** — project is now passed via reactive writable store
- **Instant updates** — changing date format in settings immediately applies to all cells
- **Proper formatting** — dates display in selected format (DD/MM/YYYY, MM-DD-YYYY, etc.)
- **displayFormat support** — separate format for display and write operations

#### ❌ Invalid Date Validation
- **Red error highlighting** — invalid values in date fields are highlighted with red background
- **rawValue prop** — passing invalid values for display (e.g., string "2")
- **Isolated handling** — one corrupted date doesn't affect other cells
- **Show original value** — invalid data displayed as-is for diagnostics

#### 🎛️ Board View — Grouping Settings
- **Group field selection** — dropdown for field selection in view settings
- **Available field hints** — only string fields with options are shown
- **Config persistence** — groupByField saved in view settings

#### ⚙️ Global Animation Settings
- **Animation Behavior** — new option: Smooth / Instant
- **Calendar application** — scrollIntoView uses behavior from settings
- **Localization** — translations for Russian and English

#### 🧹 Interface Cleanup
- **Removed project dropdown** — completely removed from CompactNavBar
- **Clean props** — removed unused projects and projectId
- **Rendering optimization** — fewer unnecessary redraws

---

### 🛠️ v3.0.1 (January 27, 2026) — Mobile Fixes

> **UX bugfixes after v3.0.0**

#### 📱 DayPopup — Native Scrolling
- **Fixed scrolling** — removed touch event blocking on mobile
- **Native scroll** — added `touch-action: pan-y` and `cancelable` checks
- **Console errors fixed** — no more "Intervention" errors

#### 📝 EditNote Modal — Title Reactivity
- **Instant update** — title updates immediately after renaming
- **State sync** — fixed file name display in modal window

---

### 🎉 v3.0.0 (January 22, 2026) — Complete Calendar Redesign

> **Most comprehensive update in plugin history**

#### 📅 Calendar — Complete Overhaul
- **Timeline view** — events on 07:00–22:00 time scale
- **Multi-day events** — projects and tasks spanning multiple days
- **Bars instead of dots** — visual duration representation
- **Agenda panel** — sidebar with selected day details
- **startTime/endTime** — start and end time support
- **Color coding** — `color` field for event categorization

#### 🎛️ Updated Navigation Menu
- **Centering buttons** — quick jump to today
- **View switcher** — Month/Week/Day in one click
- **Compact mode** — collapse panel for maximum workspace

#### 📱 Mobile Adaptation
- **Touch optimization** — enlarged touch targets
- **Gestures** — swipes for period navigation
- **Adaptive grid** — optimal display on any screen
- **Landscape support** — styles for horizontal orientation

---

### 🎉 v2.2.0 (December 3, 2025) — Complete Mobile UX Overhaul

#### 📱 Mobile Improvements
- 🖼️ **DayPopup**: Full-screen day overview with all events
  - Single tap opens popup with full note list
  - Double tap creates a new note instantly
- 🎛️ **Full Toolbar Collapse**: Hides entire toolbar panel, not just buttons
  - Floating toggle buttons in top-left corner
  - Semi-transparent minimalist design
- 📅 **Larger Day Cells**: +100% height for better touch targets
- 🔘 **Floating "Today" Button**: Appears when toolbar is hidden
- 🚫 **Disabled Drag-n-Drop**: Prevents conflicts with touch gestures

#### ⚙️ Note Actions (in DayPopup)
- ⚙️ **Settings**: Open edit modal
- 📋 **Duplicate**: Mini-calendar for selecting copy dates
- 🗑️ **Delete**: Quick note deletion
- ✅ **Checkbox**: Change status directly in popup

#### 🎨 New Components
- `DayPopup.svelte` — full-screen day overview
- `RecordItem.svelte` — record item with actions
- `DuplicatePopup.svelte` — mini-calendar for duplication

#### 🌐 Localization
- Added translations for RU/EN/UK/ZH-CN

#### ♿ Accessibility
- Added keyboard handlers for all interactive elements
- ARIA labels for screen readers

---

### 🎉 v2.1.0 (January 21, 2025) — Calendar Zoom Gestures

#### ✨ New Features
- 🔍 **Smart Calendar Zoom**: Ctrl+scroll for instant view switching
  - Zoom levels: Year ↔ Month ↔ 2 Weeks ↔ Week ↔ Day
- 🤏 **Pinch-to-zoom**: Touchpad and trackpad gesture support
- 🎯 **Date Centering**: Zoom maintains focus on date under cursor
- 💫 **Visual Indicator**: Elegant Apple-style zoom level indicator
- 🔄 **Infinite Scroll**: Smooth navigation replaces Prev/Today/Next buttons

#### 🎨 Design Improvements
- Removed navigation buttons — now scroll with mouse wheel
- Clean minimalist calendar interface
- Apple-style visual effects and animations

---

### 🎉 v2.0.1 - Patch Release
- **Code Cleanup**: Removed AI-generated bloat and redundant code.
- **Build Configuration**: Updated vite, tsconfig.json, package.json for better builds.
- **Documentation**: Created/updated internal_docs.md with comprehensive project analysis.

### 🎉 v2.0.0 - Major Release

#### ✨ New Features
- 🌍 **Multi-language Support**: Russian, Ukrainian, Chinese translations
- ⚡ **Performance Improvements**: 3x faster loading, better memory management
- 🎨 **Enhanced UI/UX**: Modern interface design, better accessibility
- 📊 **Advanced Configuration**: More customization options
- 🔧 **Better Error Handling**: Improved error messages and recovery
- 📱 **Responsive Design**: Better mobile and tablet support

#### 🔄 Improvements
- **Architecture**: Complete codebase rewrite for better maintainability
- **Performance**: Optimized rendering for large datasets
- **Compatibility**: Better integration with other plugins
- **Documentation**: Comprehensive user guides and API documentation

#### 🐛 Bug Fixes
- Fixed memory leaks in long-running sessions
- Resolved compatibility issues with latest Obsidian versions
- Fixed translation accuracy and coverage
- Improved error handling and recovery

#### 🔒 Security
- Updated all dependencies to latest secure versions
- Enhanced security practices in development
- Regular security audits and updates

## � Version Compatibility

### Obsidian

| Projects Plus | Obsidian | Status |
|---------------|----------|--------|
| **v3.0.x** | 1.5.7+ | ✅ Current |
| **v2.x** | 1.1.0+ | ⚠️ Legacy |

### Compatible Plugins

| Plugin | Compatibility | Notes |
|--------|:-------------:|-------|
| **Dataview** | ✅ | DQL queries as data source |
| **Templater** | ✅ | Templates for note creation |
| **Calendar** | ✅ | Side-by-side use |
| **Kanban** | ✅ | Side-by-side use |

---

## 📞 Support

- **Telegram**: [@parkpavel_chigon](https://t.me/parkpavel_chigon)
- **GitHub Issues**: [Report a bug](https://github.com/ParkPavel/obs-projects-plus/issues)
- **GitHub Discussions**: [Discussions](https://github.com/ParkPavel/obs-projects-plus/discussions)

---

*For the latest release information, visit [GitHub Releases](https://github.com/ParkPavel/obs-projects-plus/releases).*
