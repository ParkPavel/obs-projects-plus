# Custom view API

[Русская версия](api-RU.md)

Projects Plus can discover a custom view supplied by another enabled Obsidian plugin. This extension point is experimental: check compatibility with the exact host release you support. Internal stores and modules under `src` are not a stable external API.

## Registration and lifecycle

When a Projects workspace view opens, [getProjectViews()](../src/view.ts) examines enabled plugins for an `onRegisterProjectView` method. It calls that method to obtain a view instance and uses `getViewType()` as its key.

Return a fresh instance and choose a unique, namespaced type, such as `my-plugin-summary`. Built-in types are registered afterward and override conflicting keys. Reopen the Projects pane after enabling your extension so discovery runs again.

[useView.ts](../src/ui/app/useView.ts) calls the lifecycle methods:

| Method | Purpose |
| --- | --- |
| `getViewType()` | Return the unique type key |
| `getDisplayName()` | Return the name shown to the user |
| `getIcon()` | Return an Obsidian icon name |
| `onOpen(props)` | Render into `props.contentEl` |
| `onData(result)` | Render the latest data frame |
| `updateProps(updates)` | Handle changed project or view configuration without remounting |
| `onClose()` | Release subscriptions, listeners and other resources |

The host calls `onOpen` and then `onData` without awaiting them. Keep initial setup synchronous; manage asynchronous work and cancellation within your view.

## Minimal example

This read-only view uses types from the companion package. Install a package version you have checked against your target host; [the package source](../obsidian-projects-types/index.ts) records the declarations maintained in this repository.

```typescript
import { Plugin } from "obsidian";
import { ProjectView } from "obsidian-projects-types";
import type {
  DataQueryResult,
  ProjectViewProps,
} from "obsidian-projects-types";

class SummaryView extends ProjectView {
  private content: HTMLElement | undefined;

  getViewType(): string { return "my-plugin-summary"; }
  getDisplayName(): string { return "Summary"; }
  getIcon(): string { return "list"; }

  onOpen({ contentEl }: ProjectViewProps): void {
    this.content = contentEl;
  }

  onData({ data }: DataQueryResult): void {
    if (!this.content) return;
    this.content.empty();
    this.content.createEl("p", {
      text: `${data.records.length} records`,
    });
  }

  // The host calls this method; the package base class does not define it.
  updateProps(_updates: Record<string, unknown>): void {}

  onClose(): void {
    this.content = undefined;
  }
}

export default class SummaryPlugin extends Plugin {
  onRegisterProjectView(): SummaryView {
    return new SummaryView();
  }
}
```

Bundle the runtime `ProjectView` import with your plugin. Type-only imports disappear during compilation.

## Data supplied to views

The host contract is [src/customViewApi.ts](../src/customViewApi.ts). Use it together with the [data-frame definitions](../src/lib/dataframe/dataframe.ts), rather than copying type declarations from this page.

`DataQueryResult` includes `data`, `hasSort`, `hasFilter`, optional `dataGeneration` and optional `filterConditions`. The host also supplies an optional complete `filter`, including disabled conditions and nested groups. When saving a filter, retaining only the visible enabled conditions would discard that configuration.

A data frame contains `fields`, `records` and optional parsing `errors`. Each record has a vault-path `id` and a `values` object. In the host, an absent property differs from an explicit `null` value. Do not write derived fields as stored frontmatter.

`ProjectViewProps` contains:

| Property | Use |
| --- | --- |
| `viewId`, `project` | Identify the view and its project |
| `config`, `saveConfig` | Read and persist view configuration |
| `contentEl` | Render the view's content |
| `viewApi` | Request record and field writes |
| `readonly` | Disable editing when the source is read-only |
| `saveViewFilter?` | Save a filter when the callback is available |
| `getRecordColor` | Resolve the configured color for a record |
| `sortRecords` | Apply the host's sort to a list |
| `getRecord` | Look up a record by ID |

## Write operations

Use the host-provided `viewApi`. It supports record creation, update, batch update and deletion, plus field creation, update and deletion. In particular, `deleteField` takes a field **name**, not a field object.

The implementation in [src/lib/viewApi.ts](../src/lib/viewApi.ts) owns persistence behavior and failure reporting. Several methods are asynchronous, and the companion package does not describe all return values accurately. For example, the host's `updateRecord` returns `Promise<boolean>`, while the package declaration returns `void`. Do not interpret a `void` call or an optimistic screen update as confirmation that a write succeeded.

Respect `readonly` and derived field flags. Constructing the package's `ViewApi` class does not create a working writer: its methods are stubs. Nor is that class the same runtime constructor as the host's implementation.

## Current compatibility limits

The companion [type package](../obsidian-projects-types/README.md) declares version `3.0.0`, separately from the plugin version. It currently omits the host's `updateProps`, full `filter` payload and `native-query` data-source variant. Its value and write-result types also differ from the host.

Implement `updateProps` even when your view has nothing to update, as in the example. If your extension needs the other host-only details, verify and type that boundary against the release you support. A successful compile against the package alone is not a compatibility test. Exercise opening, data refresh, configuration changes and closing in Obsidian.

See [Contributing](../CONTRIBUTING.md) for local plugin testing and the [architecture map](architecture.md) for implementation locations.
