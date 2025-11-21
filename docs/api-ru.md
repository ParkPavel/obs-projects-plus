# 🔧 Projects Plus Справочник API

Этот документ предоставляет полную документацию по API для разработчиков плагинов и опытных пользователей Projects Plus.

## 📋 Содержание

- [API плагина](#api-плагина)
- [Управление проектами](#управление-проектами)
- [Система представлений](#система-представлений)
- [Источники данных](#источники-данных)
- [События](#события)
- [Утилиты](#утилиты)
- [Примеры](#примеры)

## 🔌 API плагина

### Получение экземпляра плагина

```javascript
const plugin = app.plugins.plugins['obs-projects-plus'];
```

### Методы плагина

#### `getProjects()`
Возвращает все доступные проекты.

```javascript
const projects = plugin.api.getProjects();
// Возвращает: Array<ProjectDefinition>
```

#### `getProject(id: string)`
Получает конкретный проект по ID.

```javascript
const project = plugin.api.getProject('my-project-id');
// Возвращает: ProjectDefinition | null
```

#### `createProject(definition: ProjectDefinition)`
Создает новый проект.

```javascript
const project = plugin.api.createProject({
  name: "Мой новый проект",
  dataSource: {
    kind: "folder",
    config: { path: "/МойПроект", recursive: true }
  }
});
```

#### `updateProject(id: string, updates: Partial<ProjectDefinition>)`
Обновляет существующий проект.

```javascript
plugin.api.updateProject('my-project-id', {
  name: "Обновленное название проекта"
});
```

#### `deleteProject(id: string)`
Удаляет проект.

```javascript
plugin.api.deleteProject('my-project-id');
```

## 📊 Управление проектами

### Интерфейс ProjectDefinition

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

### Конфигурация полей

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

## 🎨 Система представлений

### Интерфейс ViewDefinition

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

### Конфигурация представлений

#### Конфигурация табличного представления
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

#### Конфигурация доски
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

#### Конфигурация календаря
```typescript
interface CalendarViewConfig {
  dateField: string;
  displayMode: "month" | "week" | "day";
  showWeekends: boolean;
  startOfWeek: number;
}
```

#### Конфигурация галереи
```typescript
interface GalleryViewConfig {
  imageField?: string;
  cardFields: string[];
  layout: "grid" | "list";
  cardSize: "small" | "medium" | "large";
}
```

## 📁 Источники данных

### Источник данных "Папка"

```javascript
const folderProject = {
  name: "Мой проект папки",
  dataSource: {
    kind: "folder",
    config: {
      path: "/МойПроект",
      recursive: true
    }
  }
};
```

### Источник данных "Тег"

```javascript
const tagProject = {
  name: "Мой проект тегов",
  dataSource: {
    kind: "tag",
    config: {
      tag: "#project/my-project",
      hierarchy: true
    }
  }
};
```

### Источник данных "Dataview"

```javascript
const dataviewProject = {
  name: "Мой проект Dataview",
  dataSource: {
    kind: "dataview",
    config: {
      query: "FROM \"Projects/MyProject\" WHERE status != \"completed\""
    }
  }
};
```

## 📡 События

### События проектов

```javascript
// Слушать изменения проектов
plugin.api.on('project:created', (project) => {
  console.log('Создан новый проект:', project.name);
});

plugin.api.on('project:updated', (project) => {
  console.log('Проект обновлен:', project.name);
});

plugin.api.on('project:deleted', (projectId) => {
  console.log('Проект удален:', projectId);
});
```

### События представлений

```javascript
// Слушать изменения представлений
plugin.api.on('view:created', (view) => {
  console.log('Создано новое представление:', view.name);
});

plugin.api.on('view:updated', (view) => {
  console.log('Представление обновлено:', view.name);
});
```

### События данных

```javascript
// Слушать изменения данных
plugin.api.on('data:loaded', (projectId, data) => {
  console.log('Данные загружены для проекта:', projectId);
});

plugin.api.on('data:updated', (projectId, data) => {
  console.log('Данные обновлены для проекта:', projectId);
});
```

## 🛠️ Утилиты

### Обработка данных

```javascript
// Получить данные проекта
const data = await plugin.api.getProjectData('my-project-id');

// Обработать данные
const processedData = plugin.api.processData(data, {
  filter: { status: 'active' },
  sort: { field: 'created', order: 'desc' }
});
```

### Операции с файлами

```javascript
// Создать заметку из шаблона
const note = await plugin.api.createNote({
  projectId: 'my-project-id',
  name: 'Новая заметка',
  template: 'Мой шаблон'
});

// Обновить метаданные заметки
await plugin.api.updateNoteMetadata(note.path, {
  status: 'completed',
  priority: 'high'
});
```

### Система шаблонов

```javascript
// Зарегистрировать пользовательский шаблон
plugin.api.registerTemplate('my-template', {
  name: 'Мой пользовательский шаблон',
  content: `---
title: "{{title}}"
status: "draft"
created: {{date}}
---

# {{title}}

## Обзор
<!-- Добавьте содержимое здесь -->
`
});

// Использовать шаблон
const note = await plugin.api.createNote({
  projectId: 'my-project-id',
  name: 'Новая заметка',
  template: 'my-template'
});
```

## 📝 Примеры

### Полная настройка проекта

```javascript
// Создать полный проект со всеми функциями
const project = await plugin.api.createProject({
  name: "Управление контентом",
  dataSource: {
    kind: "folder",
    config: {
      path: "/Контент",
      recursive: true
    }
  },
  views: [
    {
      id: "table-view",
      name: "Таблица контента",
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
      name: "Доска контента",
      type: "board",
      config: {
        columns: [
          { id: "draft", name: "Черновик", filter: "status = 'draft'" },
          { id: "review", name: "Обзор", filter: "status = 'review'" },
          { id: "published", name: "Опубликовано", filter: "status = 'published'" }
        ],
        cardFields: ["title", "author", "due"]
      }
    }
  ],
  fieldConfig: {
    status: {
      name: "Статус",
      type: "string",
      typeConfig: { format: "select" }
    },
    priority: {
      name: "Приоритет",
      type: "string",
      typeConfig: { format: "select" }
    }
  }
});
```

### Интеграция пользовательского представления

```javascript
// Создать компонент пользовательского представления
class MyCustomView extends ViewComponent {
  render() {
    return `
      <div class="my-custom-view">
        <h2>Пользовательское представление проекта</h2>
        <div class="project-stats">
          <div class="stat">
            <span class="label">Всего заметок:</span>
            <span class="value">${this.data.length}</span>
          </div>
        </div>
      </div>
    `;
  }
}

// Зарегистрировать пользовательское представление
plugin.api.registerView({
  id: "my-custom-view",
  name: "Мое пользовательское представление",
  component: MyCustomView
});
```

### Скрипт автоматизации

```javascript
// Автоматизированное управление проектами
class ProjectAutomation {
  constructor(plugin) {
    this.plugin = plugin;
  }

  async setupWeeklyReview() {
    const projects = this.plugin.api.getProjects();
    
    for (const project of projects) {
      // Создать заметку еженедельного обзора
      const reviewNote = await this.plugin.api.createNote({
        projectId: project.id,
        name: `Еженедельный обзор - ${new Date().toISOString().split('T')[0]}`,
        template: 'weekly-review'
      });

      // Обновить статус проекта
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

// Использование
const automation = new ProjectAutomation(plugin);
await automation.setupWeeklyReview();
```

## 🔍 Отладка

### Включение режима отладки

```javascript
// Включить логирование отладки
plugin.api.setDebugMode(true);

// Слушать события отладки
plugin.api.on('debug:log', (message) => {
  console.log('[Projects Plus Debug]:', message);
});
```

### Мониторинг производительности

```javascript
// Отслеживать производительность
plugin.api.on('performance:measure', (measurement) => {
  console.log('Производительность:', measurement);
});

// Получить метрики производительности
const metrics = plugin.api.getPerformanceMetrics();
console.log('Метрики производительности:', metrics);
```

---

## 📚 Дополнительные ресурсы

- **Руководство пользователя**: [Полная документация пользователя](user-guide.md)
- **Репозиторий GitHub**: [Исходный код и проблемы](https://github.com/ParkPavel/obs-projects-plus)
- **Сообщество**: [Обсуждения и поддержка](https://github.com/ParkPavel/obs-projects-plus/discussions)
- **Веб-сайт**: [parkpavel.github.io](https://parkpavel.github.io/park-pavel/)

---

*Для получения дополнительных примеров и продвинутого использования ознакомьтесь с нашим [репозиторием GitHub](https://github.com/ParkPavel/obs-projects-plus) и [обсуждениями сообщества](https://github.com/ParkPavel/obs-projects-plus/discussions).*
