# Roadmap

[Русский](ROADMAP-RU.md) · [README](README.md) · [Changelog](CHANGELOG.md)

This is the plan of record for Projects Plus after 3.7.2. It changes when priorities change; what has
shipped is in the [changelog](CHANGELOG.md). Items are listed in priority order within each track; no
dates are promised.

## Current priority — build on 3.7.2

The 3.7.2 stabilization workflows passed the release's automated checks and maintainer acceptance,
including the final Agenda keyboard scenario on iPhone. See the [release guide](docs/release-3.7.2.md)
for its scope and migration requirements. The [3.7.1 completion baseline](docs/development-3.7.1.md)
is a historical specification. The tracks below describe future work, not additional features
promised by 3.7.2.

## Next versions

| Version | Priority | Status |
| --- | --- | --- |
| 3.7.3 | Keep data.json; visible-folder synchronization, backups, ZIP settings/notes and validated AI edits | [Draft specification](docs/plan-3.7.3.md) |
| 3.7.4 | Mobile widget catalogue and reminders, starting with platform feasibility | [Research plan](docs/plan-3.7.4.md) |

[Cycle announcement](docs/next-versions.md). Documents and a pushed GitHub branch come before implementation. Existing tracks below remain a general backlog, not extra 3.7.3 scope.

## Principles that do not change

- **Your data stays in your notes.** Frontmatter and Markdown are the database. Nothing is moved into a
  separate store; everything computed is built on top of your notes.
- **Relations are frontmatter properties.** A property holding a list of links is recognised as a relation;
  a single plain `[[link]]` stays text until you declare the property a relation.
- **One behaviour on every device.** The bar is how a well-made iOS app behaves — on a phone, a tablet,
  a desktop, and a narrow pane inside Obsidian alike.
- **Layouts adapt to their container, not to the screen.** A view sized for a small window works the same
  on a small phone.

## Track 1 — Calculations and data (after stabilization)

One calculation model, closer to a spreadsheet, for everything you see in tables, cards and charts.

1. **A shared calculated data model.** The strict formula evaluator is already unified in 3.7.2.
   Next, integrate the existing transformation pipeline's operations into a configurable data model
   shared by tables, chart calls and cross-project summaries, with migration of saved Dashboards.
   The current pipeline remains supported until that model is implemented.
2. **Correct calculations.** Formulas defined on a project field are evaluated. Rollups get their own
   filters, so one relation can feed several differently filtered totals. Rollups can chain across
   projects. `SUMIF`, `COUNTIF` and `AVERAGEIF` behave as they do in spreadsheets. Anything unsupported
   says so instead of returning an approximation.
3. **Working selections.** A saved selection can filter on computed columns (rollups, formulas), not only
   on raw properties.
4. **Analytics in plain words.** Ready recipes such as "average per client over a period", "change between
   periods" and "gap between visits", starting with Clients → Sessions.

## Track 2 — Behaviour, design and fixes

A cross-platform redesign with iOS-first behaviour, and the issues users reported after publication.

- **Adaptive layout everywhere.** Panes and windows respect device and window edges (safe areas, split
  panes, pop-out and narrow windows). Calendar side panels no longer overlap the controls. View tabs
  scroll when they do not fit. The filter side panel adapts to its space. This applies equally to small
  desktop windows.
- **Touch.** Drag from anywhere already works in most views; the Kanban board gets its own designed grab
  area that no longer covers card text or other controls.
- **Cards and galleries.** A redesigned gallery with view settings you choose; thumbnails on Kanban cards
  as an option; card frames you can resize by hand, remembered per view; better-designed, more capable
  cards across views.
- **Cleaner internals.** Large views are split along testable boundaries and legacy code paths are
  removed, so fixes land faster.
- **Refreshed demo.** Once the behaviour gaps are closed, the demo projects are updated to show the new
  calculation model and cards.

## Track 3 — Connections to the outside

- Remote calendars (ICS, CalDAV, Google Calendar), with a clear boundary for what is read, what is written
  and where it is stored.
- Other external services, each with its own explicit contract.

Credentials will never be written into notes.

## Exploring: every note is a database

A note's frontmatter shown as a full card that replaces the standard properties view, with its related
databases, rollups and views built around it through its relations — much like a page in Notion. This is
in design only. Tracks 1 and 2 are being built so that the calculation engine and the card can be reused
here without rework.

## How releases are accepted

Releases pass the project's automated checks and recorded acceptance. Reports from users are
reviewed and turned into items in Track 2. Changes that affect saved data are checked by changing a
value, reloading, and reading it back in a test vault before release.

Found a problem or have an idea? Open an [issue](https://github.com/ParkPavel/obs-projects-plus/issues).
