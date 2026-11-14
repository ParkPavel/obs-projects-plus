# After 3.7.2: what comes next

[Русский](next-versions-RU.md) · [Roadmap](../ROADMAP.md)

**3.7.2 is released. The next cycle starts with architecture and documentation, followed by implementation.** These are plans, not features in your installed version. No dates are committed.

## 3.7.3: synchronization, backups and project exchange

**data.json remains the authoritative settings store**, with normal operation using the in-memory model. Add verified synchronization into a visible folder for filesystem copying, recovery and AI editing. Inbound edits pass validation and conflict checks before application.

Share a ZIP containing configuration and selected notes/attachments. Recipients choose a destination; import verifies/extracts the package, remaps references and registers the project. Tag-based selection is retained with destination-tag collision checks. After success, users can keep the source archive or delete it through available trash.

A mirror and versioned backup serve different purposes. Settings-only copies cannot restore records; same-disk copies cannot protect against loss of the whole vault. Real-device prototypes will establish supported ZIP-sharing paths.

[3.7.3 architecture, stages and acceptance](plan-3.7.3.md).

## 3.7.4: bring the project closer on mobile

Explore compact project elements, system mobile widgets and event reminders on selected devices. First establish feasible iOS/Android integration, background behaviour, permissions and data refresh. In-Obsidian widgets and OS home-screen widgets are different tasks; a JavaScript timer cannot guarantee notification delivery after app closure.

[3.7.4 research plan](plan-3.7.4.md).

## Contribute a scenario

Useful input includes projects you want to share, required template dependencies and AI editing workflows. For widgets, specify the element, platform and action; for reminders, specify timing, target devices and offline expectations.

[Suggest a scenario](https://github.com/ParkPavel/obs-projects-plus/issues/new) · [Support development via Tribute](https://web.tribute.tg/d/Sh6).
