<div align="center">

# 🚀 Projects Plus

**Enhanced project management for Obsidian with advanced features**

[![Build Obsidian plugin](https://github.com/ParkPavel/obs-projects-plus/actions/workflows/ci.yml/badge.svg)](https://github.com/ParkPavel/obs-projects-plus/actions/workflows/ci.yml)
[![Release Obsidian plugin](https://github.com/ParkPavel/obs-projects-plus/actions/workflows/release.yml/badge.svg)](https://github.com/ParkPavel/obs-projects-plus/actions/workflows/release.yml)
[![GitHub](https://img.shields.io/badge/GitHub-ParkPavel-blue?style=flat&logo=github)](https://github.com/ParkPavel)
[![Website](https://img.shields.io/badge/Website-parkpavel.github.io-green?style=flat&logo=globe)](https://parkpavel.github.io/park-pavel/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat&logo=apache)](LICENSE)
[![Obsidian](https://img.shields.io/badge/Obsidian-v1.5.7+-purple?style=flat&logo=obsidian)](https://obsidian.md)
![Version](https://img.shields.io/badge/version-3.0.2-blue.svg)

[Русский](README.md) | English

</div>

---

## 🆕 What's New in v3.0.2

> **Date Formatting & Validation** — Critical table view fixes

| Feature | Description |
|---------|-------------|
| 📊 **Reactive Dates** | Date formats apply instantly when settings change |
| ❌ **Date Validation** | Invalid values highlighted in red |
| 🎛️ **Board Grouping** | Select grouping field in view settings |
| ⚙️ **Animation Behavior** | Control animations: Smooth / Instant |
| 🧹 **Clean UI** | Removed project dropdown, rendering optimization |

[Full changelog →](RELEASES-EN.md)

---

## ✨ Overview

**Projects Plus** is a community-maintained fork of the original [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) plugin by Marcus Olsson. This enhanced version provides advanced project management features for [Obsidian](https://obsidian.md) with improved performance, stability, and additional customization options.

Perfect for content managers, researchers, and anyone who needs to organize notes into manageable projects. Create drafts, track their status, and schedule publication dates.

## 🌟 Features

### 📅 **Calendar (v3.0.0)**
- **Timeline View** — Events on 07:00–22:00 time scale
- **Multi-day Events** — Tasks spanning multiple days
- **Infinite Scroll** — Smooth navigation through months/weeks
- **Zoom Gestures** — Ctrl+scroll or pinch for scaling
- **Detail Levels** — Month → 2 weeks → Week → 3 days → Day
- **Mobile Gestures** — Swipes, double tap to create notes

### 📊 **Multiple View Types**
- **📋 Table View** — Spreadsheet-like interface with sorting and filtering
- **📌 Board View** — Kanban-style project boards with drag-n-drop
- **📅 Calendar View** — Timeline with time support
- **🖼️ Gallery View** — Visual card-based layout with covers

### 📱 **Mobile UX**
- **DayPopup** — Full-screen day overview with single tap
- **Double Tap** — Instant note creation
- **Larger Touch Targets** — +100% height for day cells
- **Floating Buttons** — Today button when toolbar is hidden
- **Swipe Navigation** — Navigate between periods

### 🔧 **Advanced Configuration**
- **📁 Folder-based Projects** — Create projects from existing folders
- **🏷️ Tag-based Projects** — Organize by tags with hierarchy support
- **🔍 Dataview Integration** — Use Dataview queries for complex filtering
- **📝 Custom Templates** — Configure note templates for each project

### 🌐 **Localization**
- Russian, English, Ukrainian, Chinese (zh-CN)

---

## ⌨️ Keyboard Shortcuts & Gestures

### 🖥️ Desktop

| Action | Keys |
|--------|------|
| Calendar Zoom | `Ctrl` + mouse wheel |
| Zoom (Mac) | `Cmd` + mouse wheel |
| Go to Today | `T` or "Today" button |
| New Note | `Ctrl/Cmd` + `N` |
| Open in New Window | `Ctrl/Cmd` + click on note |
| Edit Cell | `Enter` or double click |
| Table Navigation | `←` `→` `↑` `↓` |
| Exit Editing | `Escape` |
| Copy Cell | `Ctrl/Cmd` + `C` |

### 📱 Mobile (Gestures)

| Gesture | Action |
|---------|--------|
| **Single tap** on day | Open DayPopup with events |
| **Double tap** on day | Create new note |
| **Swipe left/right** | Switch between periods |
| **Pinch** | Calendar zoom |
| **Long press** on card | Context menu |
| **Tap checkbox** | Toggle task status |

### 🗓️ In Calendar

| Action | Method |
|--------|--------|
| Zoom In | `Ctrl` + scroll up / pinch out |
| Zoom Out | `Ctrl` + scroll down / pinch in |
| Next Period | Scroll down / swipe left |
| Previous Period | Scroll up / swipe right |
| Switch View | Month / Week / Day buttons |

---

## 🚀 Quick Start

### Installation via BRAT (Recommended)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Open BRAT settings
3. Add this repository: `ParkPavel/obs-projects-plus`
4. Enable the plugin in Obsidian settings

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/ParkPavel/obs-projects-plus/releases)
2. Extract the files to your vault's `.obsidian/plugins/obs-projects-plus/` folder
3. Enable the plugin in Obsidian settings

### Getting Started

1. Press **Ctrl+P** (or **Cmd+P** on macOS) to open the **Command palette**
2. Select **Projects Plus: Show projects plus**
3. Create your first project by clicking the **+** button

### Example Frontmatter

```yaml
---
title: My Task
status: In Progress
priority: High
startDate: 2025-01-20
endDate: 2025-01-25
startTime: "09:00"
endTime: "18:00"
color: blue
tags: [project, important]
---
```

## 🎨 Screenshots

<p align="center">
  <img src="images/2026-01-27_12-23-33.png" width="15%" title="Screenshot 1" />
  <img src="images/2026-01-27_12-23-55.png" width="15%" title="Screenshot 2" />
  <img src="images/2026-01-27_12-24-17.png" width="24%" title="Screenshot 3" />
  <img src="images/2026-01-27_12-24-35.png" width="15%" title="Screenshot 4" />
  <img src="images/2026-01-27_12-26-03.png" width="15%" title="Screenshot 5" />
</p>
<p align="center">
  <img src="images/2026-01-27_12-26-43.png" width="15%" title="Screenshot 6" />
  <img src="images/2026-01-27_12-27-29.png" width="24%" title="Screenshot 7" />
  <img src="images/2026-01-27_12-29-16.png" width="15%" title="Screenshot 8" />
  <img src="images/2026-01-27_12-30-02.png" width="24%" title="Screenshot 9" />
</p>

<details>
<summary align="center"><b>👆 Click to view full size</b></summary>
<p align="center">
  <a href="images/2026-01-27_12-23-33.png"><img src="images/2026-01-27_12-23-33.png" width="80%" /></a>
  <a href="images/2026-01-27_12-23-55.png"><img src="images/2026-01-27_12-23-55.png" width="80%" /></a>
  <a href="images/2026-01-27_12-24-17.png"><img src="images/2026-01-27_12-24-17.png" width="80%" /></a>
  <a href="images/2026-01-27_12-24-35.png"><img src="images/2026-01-27_12-24-35.png" width="80%" /></a>
  <a href="images/2026-01-27_12-26-03.png"><img src="images/2026-01-27_12-26-03.png" width="80%" /></a>
  <a href="images/2026-01-27_12-26-43.png"><img src="images/2026-01-27_12-26-43.png" width="80%" /></a>
  <a href="images/2026-01-27_12-27-29.png"><img src="images/2026-01-27_12-27-29.png" width="80%" /></a>
  <a href="images/2026-01-27_12-29-16.png"><img src="images/2026-01-27_12-29-16.png" width="80%" /></a>
  <a href="images/2026-01-27_12-30-02.png"><img src="images/2026-01-27_12-30-02.png" width="80%" /></a>
</p>
</details>

## ⚙️ Configuration

### General Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Project Size Limit** | Maximum number of notes to load | 1000 |
| **Link Behavior** | What happens when clicking links | Open note |
| **Start Week On** | First day of the week | Default |
| **Animation Behavior** | Smooth or Instant animations | Smooth |

### Advanced Settings

- **Front Matter Configuration** — Customize YAML handling
- **Template Management** — Set up note templates
- **Command Integration** — Add custom commands
- **Archive Management** — Restore or delete archived projects

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### 🐛 **Bug Reports**
- Use the [Issues](https://github.com/ParkPavel/obs-projects-plus/issues) page
- Provide detailed reproduction steps
- Include Obsidian version and plugin version

### 💡 **Feature Requests**
- Check existing [issues](https://github.com/ParkPavel/obs-projects-plus/issues) first
- Describe the use case and expected behavior
- Consider contributing the implementation

### 🔧 **Development**

```bash
# Clone the repository
git clone https://github.com/ParkPavel/obs-projects-plus.git
cd obs-projects-plus

# Install dependencies
npm install

# Start development
npm run dev

# Build for production
npm run build
```

### 📝 **Translation**
Help us translate the plugin to your language:
1. Fork the repository
2. Add translations to `src/lib/stores/translations/`
3. Update `src/lib/stores/i18n.ts`
4. Submit a pull request

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Obsidian with plugin development enabled

### Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Lint code
npm run format       # Format code
```

## 📚 Documentation

- **[User Guide](docs/user-guide-EN.md)** - Complete usage instructions
- **[API Reference](docs/api.md)** - Developer API documentation
- **[Contributing Guide](../docs/CONTRIBUTING.md)** - How to contribute
- **[Release Information](RELEASES-EN.md)** - Version history and news

## 🌟 Community

### 📺 **Videos & Tutorials**

- [How to use Obsidian: Project vs Trello](https://www.youtube.com/watch?v=kWpIz0CJXoE) by [+1creator](https://www.youtube.com/@plus1creator)
- [How To Use Obsidian: Project Management (NEW & IMPROVED!)](https://www.youtube.com/watch?v=tYC7n-sDApU) by [+1creator](https://www.youtube.com/@plus1creator)
- [Obsidian Projects - How To Manage Your Projects in Obsidian](https://youtu.be/aFfREf9IQ7Q?t=452) by [Marco Serafini](https://www.youtube.com/@Marco_Mindstone)

### 📖 **Articles**

- [The Obsidian Projects Plugin: My Secret Weapon for Staying Organized and Focused](https://www.jordanrobison.net/the-obsidian-projects-plugin-my-secret-weapon-for-staying-organized-and-focused/) by [Jordan Robison](https://www.jordanrobison.net/)
- [Obsidian Projects: A Better Way to Manage Text-Based Projects in Obsidian](https://beingpax.medium.com/obsidian-projects-a-better-way-to-manage-text-based-projects-in-obsidian-18c2a991069c) by [Prakash Joshi Pax](https://beingpax.medium.com/)

## 🏆 Roadmap

### 🎯 **Active Development**
- [ ] Enhanced performance optimizations
- [ ] New view types and layouts
- [ ] Advanced filtering and sorting
- [ ] Mobile responsiveness improvements

### 🔮 **Future Plans**
- [ ] Plugin ecosystem integration
- [ ] Advanced automation features
- [ ] Team collaboration tools
- [ ] Cloud synchronization

## 📊 Statistics

<div align="center">

![GitHub stars](https://img.shields.io/github/stars/ParkPavel/obs-projects-plus?style=social)
![GitHub forks](https://img.shields.io/github/forks/ParkPavel/obs-projects-plus?style=social)
![GitHub issues](https://img.shields.io/github/issues/ParkPavel/obs-projects-plus)
![GitHub pull requests](https://img.shields.io/github/issues-pr/ParkPavel/obs-projects-plus)

</div>

## 🙏 Credits

This project is a community-maintained fork of the original [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) plugin by [Marcus Olsson](https://github.com/marcusolsson).

**Original Author:** Marcus Olsson  
**Current Maintainer:** Park Pavel  
**Original Repository:** https://github.com/marcusolsson/obsidian-projects

We thank Marcus for creating the foundation of this excellent plugin.

## 📄 License

Projects Plus is distributed under [Apache License 2.0](LICENSE).

## 🔗 Links

- **🌐 Website:** [parkpavel.github.io](https://parkpavel.github.io/park-pavel/)
- **📧 Contact:** [GitHub Issues](https://github.com/ParkPavel/obs-projects-plus/issues)
- **💬 Discussions:** [GitHub Discussions](https://github.com/ParkPavel/obs-projects-plus/discussions)
- **🐦 Twitter:** [@ParkPavel](https://twitter.com/ParkPavel)

---

<div align="center">

**Made with ❤️ by [Park Pavel](https://parkpavel.github.io/park-pavel/)**

[![GitHub](https://img.shields.io/badge/GitHub-ParkPavel-blue?style=flat&logo=github)](https://github.com/ParkPavel)
[![Website](https://img.shields.io/badge/Website-parkpavel.github.io-green?style=flat&logo=globe)](https://parkpavel.github.io/park-pavel/)

</div>