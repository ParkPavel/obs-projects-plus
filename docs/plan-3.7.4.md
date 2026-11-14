# 3.7.4 plan: mobile widgets and reminders

[Русский](plan-3.7.4-RU.md) · [Roadmap](../ROADMAP.md) · [3.7.3 foundation](plan-3.7.3.md)

Status: **research direction after 3.7.3**, not shipped functionality or guaranteed support for every operating system. No dates are committed. No native application implementation is authorized by this documentation stage.

## Goal and scope

Expose Projects Plus elements conveniently on mobile: today's overview, next appointment, tasks, metrics and project views, with configurable event reminders on selected devices. “Every element as a widget” means a complete capability catalogue with explicit platform support: compact content, limited actions, opening the full view or a documented limitation. It does not promise a full Svelte interface on an OS home screen.

Separate compact blocks **inside Obsidian** from **system widgets**. Apple requires a [WidgetKit application extension](https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension); Android has [its own app-widget system](https://developer.android.com/develop/ui/views/appwidgets/overview). A JavaScript plugin alone cannot add an extension target to the host application. First investigate public Obsidian capabilities, a supported native bridge, a companion application or an explicitly limited alternative. Access to Obsidian source code/private APIs or approval to ship a companion is not assumed.

## Data and actions

Build on 3.7.3 definitions with a limited read projection: project/element ID, schema version, revision, updated-at time, small payload, stale status and permitted actions. The widget is not another configuration owner. Actions check current revisions; a stale card cannot overwrite newer state.

Create an iOS/Android matrix for every element: size, content, actions, update behaviour, lock-screen privacy and operation without an open Obsidian session. Initial prototypes: next appointment, daily Agenda, a metric and a project shortcut. Other elements remain in the catalogue with an explicit supported/limited/unavailable state.

A companion does not automatically gain access to Obsidian's sandbox or iCloud files. Verify permissions, the exchange channel, offline behaviour and absence of default network disclosure. Snapshot displays must show when their data became stale.

## Reminder delivery

Define stable event/reminder identity, schedule/rule, time zone, recurrence, selected devices, event revision and cancellation. Distinguish all-day dates from instants and specify DST/time-zone changes.

Keep three modes separate: in-app reminders, locally scheduled system notifications and remote push. A JS timer or Obsidian Notice is not delivery after app closure. [Apple's local-notification API](https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app) needs a native integration; [Android 13+ notification permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission) is a separate platform constraint. Neither capability automatically becomes available to a community plugin.

Track created/scheduled/updated/cancelled/rejected/unknown states. OS acceptance is not proof that a person saw an alert. Test permissions, Focus, battery/background limits, restart and reboot. Moving/deleting events cancels outdated schedules; resync is idempotent. Explicitly choose “all selected devices” or “one primary”; do not promise global exactly-once delivery without coordination.

If remote push needs a service, separately decide consent, cost, device-address retention and data minimization. Real tokens stay out of shared notes/templates. Public wording remains “investigating delivery on selected devices” until a platform prototype supports stronger claims.

## Milestones

| Stage | Observable exit condition |
| --- | --- |
| W0: platform feasibility | Public API/constraint matrix and a viable bridge/companion route, or documented absence of one, for each OS. |
| W1: projection | Small versioned snapshots and deep links independent of UI components. |
| W2: one OS widget | Real iPhone/Android trials with closed app, stale state, lock screen and return to the correct project. |
| N0: event model | Time zones, recurrence, move/delete, identity and conflicting schedules verified independently of transport. |
| N1: one notification channel | Real-device permission/refusal, schedule/cancel, restart and changed-event trials with recorded limits. |
| N2: multiple devices | Device selection, offline/resync, duplicates, missed events and primary-device changes. |
| W3: catalogue expansion | Every element has a support level and acceptance scenario, not a misleading empty widget. |

Choose the actual 3.7.4 contents after W0/N1 and 3.7.3 results. Native integration requiring a separate product or unsupported API is an explicit decision, not a hidden release dependency.
