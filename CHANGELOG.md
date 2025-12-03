# Changelog

All notable changes to Projects Plus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
