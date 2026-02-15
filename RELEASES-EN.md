# 🚀 Release Information

## Current Release: v3.0.6

**Release Date**: February 15, 2026  
**Status**: 🟢 Stable  
**Compatibility**: Obsidian 1.5.7+
**Type**: Technical release — Obsidian guidelines compliance

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
| 🥇 | **Drag & Drop + Mobile** | v3.2.0 | In Progress | [Architecture](docs/architecture-drag-drop.md) |
| 🥈 | **Database View** | v3.3.0 | Planned | [Architecture](docs/architecture-database-view.md) |
| 🥉 | **Calendar Sync** (iCal, Google, CalDAV) | v3.4.0 | Planned | — |

## �📋 Release Notes

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