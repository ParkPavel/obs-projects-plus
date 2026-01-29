# Changelog

All notable changes to Projects Plus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.3] - 2026-01-29

### Fixed
- 🔒 **localStorage → App API Migration (COMPLETE)**
  - **TypeScript files** (Commit: 75b064f):
    - `src/lib/stores/i18n.ts` — Language detection now uses `app.loadLocalStorage('language')`
    - `src/lib/stores/ui.ts` — UI state persistence uses `app.saveLocalStorage/loadLocalStorage`
    - `src/ui/views/Calendar/calendar.ts` — Calendar locale detection migrated to App API
  - **Svelte components** (Commit: 98714b7):
    - `AgendaSidebar.svelte` — View state persistence (collapsed categories)
    - `CalendarView.svelte` — Calendar state persistence (date, interval)
    - `RecordItem.svelte` — Color picker favorites persistence
    - `EditNote.svelte` — Collapsed field groups state
    - `ColorPicker.svelte` — Favorite colors palette
  - **Impact**: All data now properly isolated per vault (Obsidian code review requirement ✅)

- 🔕 **console.log Cleanup (COMPLETE)**
  - Replaced all production `console.log` with `console.debug` for development-only logging
  - Fixed: `src/lib/helpers/performance.ts` — 2 instances (measureTime, measureTimeAsync)
  - Fixed: `src/ui/views/Calendar/logger.ts` — 1 instance (debug method)
  - Fixed: `src/ui/views/Calendar/viewport/ViewportStateManager.ts` — 6 instances
  - **Commit**: 35cb9e5
  - **Impact**: Cleaner console output in production builds (Obsidian guidelines compliance ✅)

- ⚠️ **Unhandled Promises (COMPLETE)**
  - Added proper handling for all 32 unhandled promise locations identified in code review
  - Fixed: `src/events.ts` — Added `void` operator to 4 withDataSource() calls in file watcher callbacks
  - Fixed: `src/view.ts` — Added `void` to 2 setState() calls (super.setState() + event handler)
  - Fixed: `src/main.ts` — Added `void` to 5 activateView() calls in ribbon/command callbacks
  - Fixed: `src/main.ts` — Added error handling to saveData() subscription with `.catch()` logging
  - Fixed: `src/ui/app/useView.ts` — Added `void` to 2 onClose() calls in lifecycle methods
  - **Strategy**: Fire-and-forget operations use `void`, critical data operations use `.catch()` with error logging
  - **Commit**: 35cc825
  - **Impact**: Prevents silent failures, improves error visibility, eliminates ESLint warnings ✅

### Technical
- All 150 unit tests passing after each fix
- Build successful (only accessibility warnings remain, unrelated to these fixes)
- No functional regressions detected across all changes
- Changes follow Obsidian Plugin Guidelines for localStorage, logging, and promise handling
- **Documentation**: Updated CHANGELOG.md, docs/bugfix-roadmap.md, BUGFIX_PLAN.md

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
