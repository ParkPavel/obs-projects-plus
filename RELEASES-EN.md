# 🚀 Release Information

## Current Release: v3.0.1

**Release Date**: January 23, 2026  
**Status**: 🟢 Stable  
**Compatibility**: Obsidian 1.5.7+

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

## 📋 Release Notes

---

### 🛠️ v3.0.1 (January 23, 2026) — Bugfix Release

> **UX improvements and fixes after v3.0.0**

#### 📱 DayPopup — Mobile Scrolling
- **Fixed scrolling** — now you can scroll the record list in DayPopup
- **Misclick handling** — prevents accidental note opening when swiping
- **Touch threshold** — 10px to distinguish scroll from tap

#### 📝 EditNote Modal — Note Title
- **Title display** — note name is now visible in the modal window
- **Name editing** — rename button with inline editing
- **Navigate to note** — click on title opens the note itself
- **Save on Enter** — confirm new name with Enter key

#### 🗓️ AgendaSidebar — Open in New Window
- **Ctrl+Click** — open note in new window (Windows/Linux)
- **Cmd+Click** — open note in new window (macOS)
- **Tooltip** — title attribute hints about Ctrl+Click possibility
- **Mobile adaptation** — opens in new tab on mobile

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
  - Zoom levels: Month ↔ 2 Weeks ↔ Week ↔ 3 Days ↔ Day
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

## 🗓️ Release Schedule

### 📅 Upcoming Releases

| Version | Release Date | Status | Features |
|---------|-------------|--------|----------|
| **v2.1.0** | Q2 2025 | 🟡 Planning | Enhanced automation, new view types |
| **v2.2.0** | Q3 2025 | 🟡 Planning | Team collaboration features |
| **v3.0.0** | Q4 2025 | 🟡 Planning | Major architecture update |

### 🔄 Update Frequency
- **Patch Releases**: Monthly (bug fixes, minor improvements)
- **Minor Releases**: Quarterly (new features, enhancements)
- **Major Releases**: Annually (major architecture changes)

## 📊 Version Compatibility

### Obsidian Compatibility

| Projects Plus | Obsidian | Status |
|---------------|-----------|--------|
| **v2.0.1** | 1.0.0+ | ✅ Fully Supported |
| **v1.17.4** | 0.15.0+ | ⚠️ Legacy Support |

### Plugin Compatibility

| Plugin | Compatibility | Notes |
|--------|---------------|-------|
| **Dataview** | ✅ Full | Enhanced integration |
| **Templater** | ✅ Full | Template automation support |
| **Calendar** | ✅ Full | Calendar view integration |
| **Kanban** | ✅ Full | Board view compatibility |

## 🔧 Development Releases

### Beta Releases
Beta releases are available for testing new features:

```bash
# Install beta version via BRAT
ParkPavel/obs-projects-plus@beta
```

### Alpha Releases
Alpha releases contain experimental features:

```bash
# Install alpha version via BRAT
ParkPavel/obs-projects-plus@alpha
```

## 📈 Performance Metrics

### v2.0.1 Performance Improvements

| Metric | v1.17.4 | v2.0.0 | Improvement |
|--------|---------|--------|-------------|
| **Load Time** | 2.5s | 0.8s | 68% faster |
| **Memory Usage** | 45MB | 28MB | 38% reduction |
| **Render Time** | 1.2s | 0.4s | 67% faster |
| **Bundle Size** | 2.1MB | 1.8MB | 14% smaller |

## 🐛 Known Issues

### Current Issues (v2.0.1)
- **Issue #123**: Calendar view may show incorrect dates in some timezones
- **Issue #124**: Large projects (>5000 notes) may experience slow loading
- **Issue #125**: Some themes may not display correctly in dark mode

### Workarounds
- **Calendar Issue**: Use Table view as alternative
- **Performance Issue**: Reduce project size limit to 1000 notes
- **Theme Issue**: Switch to default Obsidian theme temporarily

## 🔄 Rollback Instructions

### If you need to rollback to v1.17.4:

1. **Disable** Projects Plus
2. **Install** original Obsidian Projects plugin
3. **Restore** your backup
4. **Verify** functionality

### Backup Your Data
Always backup your vault before major updates:
- **Settings**: `.obsidian/plugins/obs-projects-plus/`
- **Projects**: Your project folders and notes
- **Templates**: Custom templates and configurations

## 📞 Support

### Getting Help
- **📧 GitHub Issues**: [Report bugs](https://github.com/ParkPavel/obs-projects-plus/issues)
- **💬 Discussions**: [Ask questions](https://github.com/ParkPavel/obs-projects-plus/discussions)
- **🌐 Website**: [parkpavel.github.io](https://parkpavel.github.io/park-pavel/)

### Community Support
- **Discord**: Join our community server
- **Reddit**: r/ObsidianMD community
- **Forum**: Obsidian Community Forum

---

## 🎯 Next Steps

1. **Install** Projects Plus v2.0.1
2. **Read** the [User Guide](docs/user-guide.md)
3. **Explore** the [API Documentation](docs/api.md)
4. **Join** the community discussions
5. **Contribute** to the project development

---

*For the latest release information, visit our [GitHub repository](https://github.com/ParkPavel/obs-projects-plus/releases).*