# 🔧 Projects Plus — Custom View API Reference

> **Status**: Experimental — inherited from [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) by Marcus Olsson.  
> This API may change or be removed without notice. Use at your own risk.

## Overview

Projects Plus lets third-party plugins register **custom views** that appear alongside the built-in Table, Board, Calendar, and Gallery. This is the **only** public API the plugin exposes.

There is no `plugin.api` object, no events system, and no programmatic project management API.

---

## How Registration Works

On load, Projects Plus iterates all enabled plugins and checks for an `onRegisterProjectView` method. If found, it calls the method and registers the returned view.

**Source**: [`src/view.ts` → `getProjectViews()`](../src/view.ts)

```
Enabled Plugin → has onRegisterProjectView()? → YES → call it → register ProjectView
```

---

## Quick Start

### 1. Install Type Definitions

```bash
npm install --save-dev obsidian-projects-types@latest
```

### 2. Create a View Class

```typescript
import {
  DataQueryResult,
  ProjectView,
  ProjectViewProps,
} from "obsidian-projects-types";

class MyCustomView extends ProjectView {
  private dataEl?: HTMLElement;

  getViewType(): string {
    return "my-custom-view";
  }

  getDisplayName(): string {
    return "My Custom View";
  }

  getIcon(): string {
    return "layout-grid"; // any Lucide icon name
  }

  // Called when data changes — invalidate previous data and re-render
  async onData({ data }: DataQueryResult) {
    if (this.dataEl) {
      this.dataEl.empty();
      this.dataEl.createDiv({ text: JSON.stringify(data.fields) });
      this.dataEl.createDiv({ text: JSON.stringify(data.records) });
    }
  }

  // Called when the user switches to this view
  async onOpen({ contentEl, config, saveConfig, readonly }: ProjectViewProps) {
    contentEl.createEl("h1", { text: "My Custom View" });
    this.dataEl = contentEl.createEl("div");
  }

  // Called when the user leaves or removes this view
  async onClose() {
    // Clean up resources
  }
}
```

### 3. Register in Your Plugin

```typescript
import { Plugin } from "obsidian";

export default class MyPlugin extends Plugin {
  // Projects Plus will call this method to create the view instance
  onRegisterProjectView = () => new MyCustomView();
}
```

That's it. When both plugins are enabled, your view will appear in the view switcher.

---

## Type Reference

All types are exported from the `obsidian-projects-types` package.  
Source: [`obsidian-projects-types/index.ts`](../obsidian-projects-types/index.ts)

### ProjectView (abstract class)

The base class you must extend.

| Method | Returns | Description |
|--------|---------|-------------|
| `getViewType()` | `string` | Unique identifier for this view type |
| `getDisplayName()` | `string` | Display name in the UI |
| `getIcon()` | `string` | Lucide icon name |
| `onOpen(props)` | `void` | Called when view is activated. Render into `props.contentEl` |
| `onData(result)` | `void` | Called when data changes. `result.data` contains `fields` and `records` |
| `onClose()` | `void` | Called when view is deactivated. Clean up resources |

### ProjectViewProps

Passed to `onOpen()`.

| Property | Type | Description |
|----------|------|-------------|
| `viewId` | `string` | Unique view instance ID |
| `project` | `ProjectDefinition` | Current project configuration |
| `config` | `T` (generic, default `Record<string, any>`) | Persisted view-specific configuration |
| `saveConfig` | `(config: T) => void` | Callback to persist configuration changes |
| `contentEl` | `HTMLElement` | Container element to render into |
| `viewApi` | `ViewApi` | API for CRUD operations on records and fields |
| `readonly` | `boolean` | `true` for Dataview projects (computed fields can't be edited) |

### DataQueryResult

Passed to `onData()`.

```typescript
type DataQueryResult = {
  data: DataFrame;
};
```

### DataFrame

```typescript
type DataFrame = {
  readonly fields: DataField[];  // schema
  readonly records: DataRecord[]; // data rows (one per note)
};
```

### DataField

```typescript
type DataField = {
  readonly name: string;           // frontmatter property name
  readonly type: DataFieldType;    // "string" | "number" | "boolean" | "date" | "unknown"
  readonly repeated: boolean;      // can have multiple values (array)
  readonly identifier: boolean;    // identifies a DataRecord (e.g., file path)
  readonly derived: boolean;       // computed field (read-only)
};
```

### DataRecord

```typescript
type DataRecord = {
  readonly id: string;                              // note file path
  readonly values: Record<string, Optional<DataValue>>; // field values
};
```

### DataValue

```typescript
type DataValue = string | number | boolean | Date | Array<Optional<DataValue>>;
type Optional<T> = T | undefined | null;
// undefined = field removed, null = field exists but has no value
```

### ViewApi

Methods for modifying data from within your view.

| Method | Parameters | Description |
|--------|-----------|-------------|
| `addRecord` | `(record, fields, templatePath)` | Create a new note |
| `updateRecord` | `(record, fields)` | Update frontmatter fields |
| `deleteRecord` | `(recordId)` | Delete a note |
| `updateField` | `(field)` | Update field metadata |
| `deleteField` | `(field)` | Remove a frontmatter field |

### ProjectDefinition

```typescript
type ProjectDefinition = {
  readonly name: string;
  readonly id: string;
  readonly defaultName: string;
  readonly templates: string[];
  readonly excludedNotes: string[];
  readonly isDefault: boolean;
  readonly dataSource: DataSource;
  readonly newNotesFolder: string;
};
```

### DataSource

```typescript
type DataSource = FolderDataSource | TagDataSource | DataviewDataSource;

type FolderDataSource = {
  readonly kind: "folder";
  readonly config: { readonly path: string; readonly recursive: boolean };
};

type TagDataSource = {
  readonly kind: "tag";
  readonly config: { readonly tag: string; readonly hierarchy: boolean };
};

type DataviewDataSource = {
  readonly kind: "dataview";
  readonly config: { readonly query: string };
};
```

---

## Important Notes

- **This API is experimental**. Breaking changes may occur in any release.
- The `onRegisterProjectView` method may be called **multiple times** (once per view instance).
- Always clean up resources in `onClose()` to avoid memory leaks.
- If `readonly` is `true`, disable any UI that calls `ViewApi` write methods.
- The `obsidian-projects-types` package is specific to this plugin family and may not be updated frequently.

---

## Further Reading

- [obsidian-projects-types README](../obsidian-projects-types/README.md) — full example from the original author
- [README](../README-EN.md) — plugin overview
- [User Guide](user-guide-EN.md) — end-user documentation
