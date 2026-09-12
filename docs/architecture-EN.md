# Code structure

> [Русский](architecture.md) · English

This document describes the code as it stands in this tree: layers, dependency rules, extension
points and the invariants that tests enforce. It is not a roadmap or a specification of the
future — if the code and this document disagree, the code wins and the document needs a fix.

---

## 1. Layers

Dependencies point inwards: an outer layer knows about the inner one, never the reverse.

| Layer | Where it lives | What it owns |
|---|---|---|
| **Shell** | `src/main.ts`, `src/view.ts`, `src/customViewApi.ts`, `src/managers/`, `src/events.ts` | Plugin lifecycle, Obsidian commands, view registration |
| **UI** | `src/ui/app/`, `src/ui/views/`, `src/ui/components/`, `src/ui/modals/`, `src/ui/settings/`, `src/ui/tokens/` | Svelte components, the views (Dashboard, Calendar, Board, Gallery, YamlVisualizer, VisualizerPane), settings screens |
| **Engine** | `src/lib/engine/`, `src/lib/dashboard-engine/`, `src/lib/formula/`, `src/lib/database/`, `src/lib/relations/`, `src/lib/visualizer/` | Pure logic: filters, aggregation, formulas, relations and rollups. No DOM, no Obsidian API |
| **Data** | `src/lib/dataframe/`, `src/lib/dataApi.ts`, `src/lib/datasources/`, `src/lib/filesystem/`, `src/lib/frontmatter/`, `src/lib/metadata/`, `src/lib/settings/`, `src/settings/` | Reading and writing notes, data sources, the field schema, settings |

### Dependency rules

- **Engine and Data never touch the DOM** and never import `obsidian`. The exception is the
  adapters in `src/lib/filesystem/obsidian/`, which exist for exactly that.
- **Data does not import Engine or UI.**
- **Engine does not import UI components.** One factual exception: `src/lib/dashboard-engine/`
  takes widget-configuration types from `src/ui/views/Dashboard/types`, and
  `conditionalFormat.ts` takes the `matchesCondition` predicate from `src/ui/app/filterFunctions`.
  That is a leftover of moving the Dashboard engine out of `src/ui/` into `src/lib/`; do not add
  new imports of this shape.
- Every Engine function must be testable in Jest without jsdom.

---

## 2. From a note to the screen

1. A project is described by a folder, a tag or a Dataview query (`src/lib/datasources/`).
2. The source returns a `DataFrame` — a list of fields and records
   (`src/lib/dataframe/dataframe.ts`).
3. The view applies the filter, the sort and — for a Dashboard — the transform pipeline
   (`src/lib/dashboard-engine/transformExecutor.ts`).
4. An edit in the interface goes back into frontmatter through `src/lib/dataApi.ts` and
   `fileManager.processFrontMatter()`, never by rewriting the whole file.
5. A change to a file in the vault triggers recomputation: the Dashboard and the other views
   update through their subscription to the source.

Dashboard filter order: the block filter narrows the records **before** the transform pipeline
runs. The invariant is pinned by `src/__tests__/R_filterOrder.invariant.test.ts`.

---

## 3. Where to add things

| What you need | Where to look |
|---|---|
| A new Dashboard widget | `src/ui/views/Dashboard/widgets/` plus an entry in `widgets/widgetRegistry.ts`; the component is wired in `WidgetHost.svelte` |
| A new chart type | `src/ui/views/Dashboard/widgets/Chart/` plus `src/lib/dashboard-engine/chartDataPipeline.ts` |
| A new data source | a `DataSource` subclass in `src/lib/datasources/` (see `index.ts`) |
| A new formula function | `src/lib/helpers/formulaParser.ts` plus its description in `src/lib/dashboard-engine/formulaMetadata.ts`; import only through the `src/lib/formula` facade |
| A new filter operator | `src/lib/engine/filterEvaluator.ts` and the operator labels in the translations |
| A new aggregation | `src/lib/engine/aggregate.ts` (the kernel) and `src/lib/dashboard-engine/aggregation.ts` (footer rows) |
| A new interface language | `src/lib/stores/translations/` (`en.json` is the source, then `ru.json`, `uk.json`, `zh-CN.json`) |
| A new error code | the registry in `src/lib/errors/` and the table in [ERROR_CODES.md](ERROR_CODES.md) |
| Your own view from another plugin | the public contract in `src/customViewApi.ts`, described in [api.md](api.md) / [api-RU.md](api-RU.md) |

---

## 4. Key contracts

The code is the source of truth; this is only a map telling you which file to open.

| Contract | File | Meaning |
|---|---|---|
| `DataFrame` | `src/lib/dataframe/dataframe.ts` | `{ fields, records }` — the one data shape shared between layers. Every engine takes it and returns it |
| Filtering | `src/lib/engine/filterEvaluator.ts` | `matchesCondition`, `matchesFilterConditions`, `applyFilter`. The single filter engine, the calendar sidebar included |
| Formulas | `src/lib/formula/index.ts` | The canonical import path: parsing, validation and evaluation, date formulas included |
| Aggregation | `src/lib/engine/aggregate.ts` | The operation kernel; `count` means non-empty values in every layer |
| Relations and rollups | `src/lib/engine/crossProjectResolver.ts`, `crossProjectRollup.ts`, `src/lib/dashboard-engine/relationResolver.ts` | Resolving a wikilink, its status (resolved / unmatched / ambiguous), calculations over related records |
| A plugin-provided view | `src/customViewApi.ts` | `ProjectView`: `getViewType`, `getDisplayName`, `getIcon`, `onOpen`, `onData`, `onClose` |
| Settings | `src/lib/settings/` | Schema versions and migrations; one owner writes settings (`R0_24_oneSettingsWriter`) |

---

## 5. Invariants

Each item is pinned by a test in `src/__tests__/` (files named `R0_*`) or by an ESLint rule;
a violation fails the build instead of waiting for a reviewer to notice.

1. **No DOM in Engine or Data.**
2. **No `innerHTML`** — use `createEl()`, `createSpan()`, `setIcon()`, `el.empty()`.
3. **No `document`** — use `activeDocument`, or the plugin breaks in a separate window.
4. **Frontmatter is written through `fileManager.processFrontMatter()`**, not `vault.modify()`.
5. **`JSON.parse` on user data only inside try/catch**, with a shape check.
6. **Regular expressions built from user input** go through `src/lib/helpers/regexSafety.ts`.
7. **Interface sizing in `rem` and tokens.** Pixels are allowed only where JavaScript supplies the
   coordinate (`getBoundingClientRect`). The `px` budget is pinned by the `R0_3_pxBudget` ratchet.
8. **`rem` resolves against the container, not the document root** (`R0_16_remInContainer`) — the
   adaptivity of nested blocks depends on it.
9. **Interface text lives in the translations**, not in the code (`R0_22_noHardcodedUiText`).
10. **`styles.css` is a hand-maintained source.** `esbuild.config.mjs` appends the token block
    between markers after the build; never edit the generated part by hand.
11. **No unhandled promises.** Every write reports its failure (`Notice`) and rolls back an
    optimistic interface change if one was made.
12. **No Obsidian polyfills** (`String.contains`, `.first()`, `.last()`) — use standard methods.
13. **Documentation comes in pairs.** A Russian document has an English twin and the other way
    round (`R0_25_documentationPairs`).

---

## 6. Build and checks

```bash
npm ci
npm run dev            # rebuild on every save
npm run build          # tsc -noEmit plus the production main.js and styles.css
npm test               # Jest
npm run lint           # ESLint plus the obsidianmd rules
npm run svelte-check   # types in Svelte templates
```

The published plugin is exactly three files: `main.js`, `manifest.json`, `styles.css`.
All four checks must pass; CI runs them on every pull request.

Coding rules: [CODE_STANDARDS.md](CODE_STANDARDS.md).
The change process: [CONTRIBUTING](../CONTRIBUTING.md).
