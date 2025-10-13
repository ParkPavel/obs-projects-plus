# 🔧 Projects Plus API Reference

This document provides comprehensive API documentation for Projects Plus plugin developers and power users.

## 📋 Table of Contents

- [Plugin API](#plugin-api)
- [Project Management](#project-management)
- [View System](#view-system)
- [Data Sources](#data-sources)
- [Events](#events)
- [Utilities](#utilities)
- [Examples](#examples)

## 🔌 Plugin API

### Getting the Plugin Instance

```javascript
const plugin = app.plugins.plugins['obs-projects-plus'];
```

### Plugin Methods

#### `getProjects()`
Returns all available projects.

```javascript
const projects = plugin.api.getProjects();
// Returns: Array<ProjectDefinition>
```

#### `getProject(id: string)`
Get a specific project by ID.

```javascript
const project = plugin.api.getProject('my-project-id');
// Returns: ProjectDefinition | null
```

#### `createProject(definition: ProjectDefinition)`
Create a new project.

```javascript
const project = plugin.api.createProject({
  name: "My New Project",
  dataSource: {
    kind: "folder",
    config: { path: "/MyProject", recursive: true }
  }
});
```

#### `updateProject(id: string, updates: Partial<ProjectDefinition>)`
Update an existing project.

```javascript
plugin.api.updateProject('my-project-id', {
  name: "Updated Project Name"
});
```

#### `deleteProject(id: string)`
Delete a project.

```javascript
plugin.api.deleteProject('my-project-id');
```

## 📊 Project Management

### ProjectDefinition Interface

```typescript
interface ProjectDefinition {
  id: string;
  name: string;
  dataSource: DataSource;
  views: ViewDefinition[];
  fieldConfig: Record<string, FieldConfig>;
  excludedNotes: string[];
  isDefault: boolean;
}

interface DataSource {
  kind: "folder" | "tag" | "dataview";
  config: FolderConfig | TagConfig | DataviewConfig;
}

interface FolderConfig {
  path: string;
  recursive: boolean;
}

interface TagConfig {
  tag: string;
  hierarchy: boolean;
}

interface DataviewConfig {
  query: string;
}
```

### Field Configuration

```typescript
interface FieldConfig {
  name: string;
  type: DataFieldType;
  repeated?: boolean;
  typeConfig?: {
    time?: boolean;
    format?: string;
  };
}

enum DataFieldType {
  String = "string",
  Number = "number",
  Boolean = "boolean",
  Date = "date",
  DateTime = "datetime",
  List = "list",
  Tags = "tags",
  Aliases = "aliases",
  Unknown = "unknown"
}
```

## 🎨 View System

### ViewDefinition Interface

```typescript
interface ViewDefinition {
  id: string;
  name: string;
  type: ViewType;
  config: ViewConfig;
}

enum ViewType {
  Table = "table",
  Board = "board",
  Calendar = "calendar",
  Gallery = "gallery"
}
```

### View Configuration

#### Table View Config
```typescript
interface TableViewConfig {
  columns: ColumnConfig[];
  sorting: SortConfig[];
  filtering: FilterConfig[];
}

interface ColumnConfig {
  field: string;
  width?: number;
  hidden?: boolean;
  sortable?: boolean;
}
```

#### Board View Config
```typescript
interface BoardViewConfig {
  columns: BoardColumnConfig[];
  cardFields: string[];
  groupBy?: string;
}

interface BoardColumnConfig {
  id: string;
  name: string;
  filter: string;
  color?: string;
}
```

#### Calendar View Config
```typescript
interface CalendarViewConfig {
  dateField: string;
  displayMode: "month" | "week" | "day";
  showWeekends: boolean;
  startOfWeek: number;
}
```

#### Gallery View Config
```typescript
interface GalleryViewConfig {
  imageField?: string;
  cardFields: string[];
  layout: "grid" | "list";
  cardSize: "small" | "medium" | "large";
}
```

## 📁 Data Sources

### Folder Data Source

```javascript
const folderProject = {
  name: "My Folder Project",
  dataSource: {
    kind: "folder",
    config: {
      path: "/MyProject",
      recursive: true
    }
  }
};
```

### Tag Data Source

```javascript
const tagProject = {
  name: "My Tag Project",
  dataSource: {
    kind: "tag",
    config: {
      tag: "#project/my-project",
      hierarchy: true
    }
  }
};
```

### Dataview Data Source

```javascript
const dataviewProject = {
  name: "My Dataview Project",
  dataSource: {
    kind: "dataview",
    config: {
      query: "FROM \"Projects/MyProject\" WHERE status != \"completed\""
    }
  }
};
```

## 📡 Events

### Project Events

```javascript
// Listen for project changes
plugin.api.on('project:created', (project) => {
  console.log('New project created:', project.name);
});

plugin.api.on('project:updated', (project) => {
  console.log('Project updated:', project.name);
});

plugin.api.on('project:deleted', (projectId) => {
  console.log('Project deleted:', projectId);
});
```

### View Events

```javascript
// Listen for view changes
plugin.api.on('view:created', (view) => {
  console.log('New view created:', view.name);
});

plugin.api.on('view:updated', (view) => {
  console.log('View updated:', view.name);
});
```

### Data Events

```javascript
// Listen for data changes
plugin.api.on('data:loaded', (projectId, data) => {
  console.log('Data loaded for project:', projectId);
});

plugin.api.on('data:updated', (projectId, data) => {
  console.log('Data updated for project:', projectId);
});
```

## 🛠️ Utilities

### Data Processing

```javascript
// Get project data
const data = await plugin.api.getProjectData('my-project-id');

// Process data
const processedData = plugin.api.processData(data, {
  filter: { status: 'active' },
  sort: { field: 'created', order: 'desc' }
});
```

### File Operations

```javascript
// Create note from template
const note = await plugin.api.createNote({
  projectId: 'my-project-id',
  name: 'New Note',
  template: 'My Template'
});

// Update note metadata
await plugin.api.updateNoteMetadata(note.path, {
  status: 'completed',
  priority: 'high'
});
```

### Template System

```javascript
// Register custom template
plugin.api.registerTemplate('my-template', {
  name: 'My Custom Template',
  content: `---
title: "{{title}}"
status: "draft"
created: {{date}}
---

# {{title}}

## Overview
<!-- Add content here -->
`
});

// Use template
const note = await plugin.api.createNote({
  projectId: 'my-project-id',
  name: 'New Note',
  template: 'my-template'
});
```

## 📝 Examples

### Complete Project Setup

```javascript
// Create a complete project with all features
const project = await plugin.api.createProject({
  name: "Content Management",
  dataSource: {
    kind: "folder",
    config: {
      path: "/Content",
      recursive: true
    }
  },
  views: [
    {
      id: "table-view",
      name: "Content Table",
      type: "table",
      config: {
        columns: [
          { field: "title", width: 200 },
          { field: "status", width: 100 },
          { field: "created", width: 120 }
        ],
        sorting: [
          { field: "created", order: "desc" }
        ]
      }
    },
    {
      id: "board-view",
      name: "Content Board",
      type: "board",
      config: {
        columns: [
          { id: "draft", name: "Draft", filter: "status = 'draft'" },
          { id: "review", name: "Review", filter: "status = 'review'" },
          { id: "published", name: "Published", filter: "status = 'published'" }
        ],
        cardFields: ["title", "author", "due"]
      }
    }
  ],
  fieldConfig: {
    status: {
      name: "Status",
      type: "string",
      typeConfig: { format: "select" }
    },
    priority: {
      name: "Priority",
      type: "string",
      typeConfig: { format: "select" }
    }
  }
});
```

### Custom View Integration

```javascript
// Create custom view component
class MyCustomView extends ViewComponent {
  render() {
    return `
      <div class="my-custom-view">
        <h2>Custom Project View</h2>
        <div class="project-stats">
          <div class="stat">
            <span class="label">Total Notes:</span>
            <span class="value">${this.data.length}</span>
          </div>
        </div>
      </div>
    `;
  }
}

// Register custom view
plugin.api.registerView({
  id: "my-custom-view",
  name: "My Custom View",
  component: MyCustomView
});
```

### Automation Script

```javascript
// Automated project management
class ProjectAutomation {
  constructor(plugin) {
    this.plugin = plugin;
  }

  async setupWeeklyReview() {
    const projects = this.plugin.api.getProjects();
    
    for (const project of projects) {
      // Create weekly review note
      const reviewNote = await this.plugin.api.createNote({
        projectId: project.id,
        name: `Weekly Review - ${new Date().toISOString().split('T')[0]}`,
        template: 'weekly-review'
      });

      // Update project status
      await this.plugin.api.updateProject(project.id, {
        lastReview: new Date().toISOString()
      });
    }
  }

  async archiveCompletedProjects() {
    const projects = this.plugin.api.getProjects();
    
    for (const project of projects) {
      const data = await this.plugin.api.getProjectData(project.id);
      const completedCount = data.filter(item => item.status === 'completed').length;
      
      if (completedCount === data.length && data.length > 0) {
        await this.plugin.api.archiveProject(project.id);
      }
    }
  }
}

// Usage
const automation = new ProjectAutomation(plugin);
await automation.setupWeeklyReview();
```

## 🔍 Debugging

### Enable Debug Mode

```javascript
// Enable debug logging
plugin.api.setDebugMode(true);

// Listen for debug events
plugin.api.on('debug:log', (message) => {
  console.log('[Projects Plus Debug]:', message);
});
```

### Performance Monitoring

```javascript
// Monitor performance
plugin.api.on('performance:measure', (measurement) => {
  console.log('Performance:', measurement);
});

// Get performance metrics
const metrics = plugin.api.getPerformanceMetrics();
console.log('Performance Metrics:', metrics);
```

---

## 📚 Additional Resources

- **User Guide**: [Complete user documentation](user-guide.md)
- **GitHub Repository**: [Source code and issues](https://github.com/ParkPavel/obs-projects-plus)
- **Community**: [Discussions and support](https://github.com/ParkPavel/obs-projects-plus/discussions)
- **Website**: [parkpavel.github.io](https://parkpavel.github.io/park-pavel/)

---

*For more examples and advanced usage, check out our [GitHub repository](https://github.com/ParkPavel/obs-projects-plus) and [community discussions](https://github.com/ParkPavel/obs-projects-plus/discussions).*
