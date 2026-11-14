# After 3.7.2: what comes next

[Русский](next-versions-RU.md) · [Roadmap](../ROADMAP.md)

**3.7.2 is released. The next cycle starts with architecture and documentation, followed by implementation.** These are plans, not features in your installed version. No dates are committed.

## 3.7.3: your projects in your vault

First, prepare the internals for storing, creating and sharing project templates without losing existing configuration. A visible folder of project/template documents should replace the need to access hidden settings for these workflows.

The goal is to share a template as an ordinary Obsidian note, then map destination folders and install working views, relations and formulas. AI tools with permitted vault access can use that same documented file interface.

Preservation, verified migration, recoverable conflicts and rollback come first. Records and private settings must not leak into templates. The initial prototype will validate the format and whether native Share can be invoked directly.

[3.7.3 architecture, stages and acceptance](plan-3.7.3.md).

## 3.7.4: bring the project closer on mobile

Explore compact project elements, system mobile widgets and event reminders on selected devices. First establish feasible iOS/Android integration, background behaviour, permissions and data refresh. In-Obsidian widgets and OS home-screen widgets are different tasks; a JavaScript timer cannot guarantee notification delivery after app closure.

[3.7.4 research plan](plan-3.7.4.md).

## Contribute a scenario

Useful input includes projects you want to share, required template dependencies and AI editing workflows. For widgets, specify the element, platform and action; for reminders, specify timing, target devices and offline expectations.

[Suggest a scenario](https://github.com/ParkPavel/obs-projects-plus/issues/new) · [Support development via Tribute](https://web.tribute.tg/d/Sh6).
