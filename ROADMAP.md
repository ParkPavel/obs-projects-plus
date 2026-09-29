# Roadmap

[Русский](ROADMAP-RU.md) · [README](README.md) · [Changelog](CHANGELOG.md)

This is the plan of record for Projects Plus after 3.6.3. It changes when priorities change; what has
shipped is in the [changelog](CHANGELOG.md). Items are listed in priority order within each track; no
dates are promised.

## Principles that do not change

- **Your data stays in your notes.** Frontmatter and Markdown are the database. Nothing is moved into a
  separate store; everything computed is built on top of your notes.
- **Relations are frontmatter properties.** A plain `[[link]]` stays text until you declare the property
  a relation. Nothing is guessed behind your back.
- **One behaviour on every device.** The bar is how a well-made iOS app behaves — on a phone, a tablet,
  a desktop, and a narrow pane inside Obsidian alike.
- **Layouts adapt to their container, not to the screen.** A view sized for a small window works the same
  on a small phone.

## Track 1 — Calculations and data (first priority)

One calculation model, closer to a spreadsheet, for everything you see in tables, cards and charts.

1. **One calculation engine.** The separate transformation pipeline is retired. Its operations move into
   the database itself: filters and formulas inside tables, chart calls and cross-project summaries built
   on a computed data model that you configure — similar to a spreadsheet's data model or pivot table.
   Dashboards you already have are migrated.
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

Every release passes the Obsidian community directory's automated review. Reports from users are
reviewed and turned into items in Track 2. Changes that affect saved data are checked by changing a
value, reloading, and reading it back in a test vault before release.

Found a problem or have an idea? Open an [issue](https://github.com/ParkPavel/obs-projects-plus/issues).
