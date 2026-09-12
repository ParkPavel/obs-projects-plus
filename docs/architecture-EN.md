# Project architecture

[Русский](architecture.md)

This map describes the code in this repository. It helps contributors find a feature's implementation. See [Contributing](../CONTRIBUTING.md) for build and test instructions.

## Entry points and interface

| Location | Responsibility |
| --- | --- |
| [src/main.ts](../src/main.ts) | Plugin lifecycle, settings initialization, commands and Obsidian integration |
| [src/view.ts](../src/view.ts) | Projects workspace view and registration of built-in and custom views |
| [src/events.ts](../src/events.ts) | Vault event handling |
| [src/managers](../src/managers) | Command management |
| [src/ui/app](../src/ui/app) | Project navigation, shared application UI and view lifecycle |
| [src/ui/views](../src/ui/views) | Dashboard, Board, Calendar, Gallery and visualizer interfaces |
| [src/ui/tokens/tokens.css](../src/ui/tokens/tokens.css) | Shared visual tokens |

`ProjectsView.getProjectViews()` registers Board, Calendar, Gallery and Dashboard. The `database` view key remains an alias for Dashboard so older saved configurations can resolve their view. Visualizer panes also have their own Obsidian integration.

The custom view lifecycle is connected in [useView.ts](../src/ui/app/useView.ts). It passes configuration, project data and write callbacks to the active view. Read the [API reference](api.md) before relying on that extension point.

## From notes to a view

1. A project definition selects a data source. The [source factory](../src/lib/datasources/index.ts) constructs a folder, tag, native-query or Dataview source. Dataview is optional; the factory reports when its backend is unavailable.
2. A source reads notes through the [filesystem abstraction](../src/lib/filesystem/README.md) and produces a [data frame](../src/lib/dataframe/README.md): field definitions, records and optional parsing errors.
3. [Svelte stores](../src/lib/stores/README.md) hold reactive data and coordinate invalidation when records change.
4. The selected view renders that data. Dashboard widgets use the transformation, formula, relation and aggregation modules for their derived results.

| Location | Responsibility |
| --- | --- |
| [src/lib/datasources](../src/lib/datasources/README.md) | Source selection, queries and combining source results |
| [src/lib/metadata](../src/lib/metadata/README.md) | YAML frontmatter encoding and decoding |
| [src/lib/engine](../src/lib/engine) | Filtering, aggregation and cross-project calculations |
| [src/lib/dashboard-engine](../src/lib/dashboard-engine) | Dashboard transformations, formula application, charts and caches |
| [src/lib/formula](../src/lib/formula) | Formula parsing and evaluation |
| [src/lib/relations](../src/lib/relations) | Relation contracts, inverse indexes and relation writes |
| [src/lib/visualizer](../src/lib/visualizer) | Visualizer-specific property, relation and overlay handling |

These directories describe responsibilities; dependencies do not all follow a strict layered boundary. Follow the imports and callers when changing a path shared by several views.

## Writes and persistence

Record and field edits enter through [ViewApi](../src/lib/viewApi.ts) and [dataApi.ts](../src/lib/dataApi.ts). They coordinate filesystem writes and the displayed data frame. Some updates are optimistic; a visible change alone does not prove that the note was written. Failure paths can restore the previous value and show a coded error.

Settings schemas and migrations live in [src/settings](../src/settings). The runtime settings writer and reconciliation helpers live in [src/lib/settings](../src/lib/settings), with lifecycle wiring in `src/main.ts`. Keep new settings writes on this path to preserve conflict checks and retry behavior.

Note content is stored in the vault. Plugin configuration is stored in the plugin's `data.json`. Derived values, such as formula results, should not be treated as stored frontmatter fields.

## Errors and diagnostics

The error registry is [errorCodes.ts](../src/lib/errors/errorCodes.ts); formatting and logging helpers are in the same directory. The bilingual [error reference](ERROR_CODES.md) explains what a user can do for each code. Preserve the meaning of existing codes when changing their presentation.

## Extension boundaries

[Custom views](api.md) are experimental. `src` modules, stores and settings structures are implementation interfaces, not a stable public SDK. The [type package](../obsidian-projects-types/README.md) is a separate compatibility surface and currently differs from the host in several places documented in the API reference.

Before changing a shared type, inspect its consumers and the relevant tests. Source records, filters and write results cross multiple views, so a change that works in one widget may affect other interfaces.
