# 🔧 Projects Plus — Справочник Custom View API

> **Статус**: Экспериментальный — унаследован от [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) (Marcus Olsson).  
> Этот API может измениться или быть удалён без предупреждения. Используйте на свой риск.

## Обзор

Projects Plus позволяет сторонним плагинам регистрировать **собственные представления (views)**, которые отображаются рядом со встроенными Table, Board, Calendar и Gallery. Это **единственный** публичный API, который предоставляет плагин.

В плагине нет объекта `plugin.api`, системы событий или программного API управления проектами.

---

## Как работает регистрация

При загрузке Projects Plus перебирает все включённые плагины и проверяет наличие метода `onRegisterProjectView`. Если метод найден — плагин вызывает его и регистрирует возвращённый view.

**Исходный код**: [`src/view.ts` → `getProjectViews()`](../src/view.ts)

```
Включённый плагин → есть onRegisterProjectView()? → ДА → вызов → регистрация ProjectView
```

---

## Быстрый старт

### 1. Установите определения типов

```bash
npm install --save-dev obsidian-projects-types@latest
```

### 2. Создайте класс представления

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
    return "layout-grid"; // любое имя Lucide-иконки
  }

  // Вызывается при изменении данных — очистите предыдущие данные и перерисуйте
  async onData({ data }: DataQueryResult) {
    if (this.dataEl) {
      this.dataEl.empty();
      this.dataEl.createDiv({ text: JSON.stringify(data.fields) });
      this.dataEl.createDiv({ text: JSON.stringify(data.records) });
    }
  }

  // Вызывается при переключении пользователя на это представление
  async onOpen({ contentEl, config, saveConfig, readonly }: ProjectViewProps) {
    contentEl.createEl("h1", { text: "My Custom View" });
    this.dataEl = contentEl.createEl("div");
  }

  // Вызывается при уходе пользователя из представления или его удалении
  async onClose() {
    // Очистите ресурсы
  }
}
```

### 3. Зарегистрируйте в вашем плагине

```typescript
import { Plugin } from "obsidian";

export default class MyPlugin extends Plugin {
  // Projects Plus вызовет этот метод для создания экземпляра представления
  onRegisterProjectView = () => new MyCustomView();
}
```

Готово. Когда оба плагина включены, ваше представление появится в переключателе видов.

---

## Справочник типов

Все типы экспортируются из пакета `obsidian-projects-types`.  
Исходный код: [`obsidian-projects-types/index.ts`](../obsidian-projects-types/index.ts)

### ProjectView (абстрактный класс)

Базовый класс, от которого нужно наследоваться.

| Метод | Возвращает | Описание |
|-------|-----------|----------|
| `getViewType()` | `string` | Уникальный идентификатор типа представления |
| `getDisplayName()` | `string` | Отображаемое имя в интерфейсе |
| `getIcon()` | `string` | Имя Lucide-иконки |
| `onOpen(props)` | `void` | Вызывается при активации. Рендерите в `props.contentEl` |
| `onData(result)` | `void` | Вызывается при изменении данных. `result.data` содержит `fields` и `records` |
| `onClose()` | `void` | Вызывается при деактивации. Очистите ресурсы |

### ProjectViewProps

Передаётся в `onOpen()`.

| Свойство | Тип | Описание |
|----------|-----|----------|
| `viewId` | `string` | Уникальный ID экземпляра представления |
| `project` | `ProjectDefinition` | Конфигурация текущего проекта |
| `config` | `T` (generic, по умолчанию `Record<string, any>`) | Сохраняемая конфигурация представления |
| `saveConfig` | `(config: T) => void` | Callback для сохранения изменений конфигурации |
| `contentEl` | `HTMLElement` | Контейнер для рендеринга |
| `viewApi` | `ViewApi` | API для CRUD-операций с записями и полями |
| `readonly` | `boolean` | `true` для Dataview-проектов (вычисляемые поля нельзя редактировать) |

### DataQueryResult

Передаётся в `onData()`.

```typescript
type DataQueryResult = {
  data: DataFrame;
};
```

### DataFrame

```typescript
type DataFrame = {
  readonly fields: DataField[];  // схема
  readonly records: DataRecord[]; // строки данных (одна на заметку)
};
```

### DataField

```typescript
type DataField = {
  readonly name: string;           // имя свойства frontmatter
  readonly type: DataFieldType;    // "string" | "number" | "boolean" | "date" | "unknown"
  readonly repeated: boolean;      // может иметь несколько значений (массив)
  readonly identifier: boolean;    // идентифицирует DataRecord (например, путь файла)
  readonly derived: boolean;       // вычисляемое поле (только чтение)
};
```

### DataRecord

```typescript
type DataRecord = {
  readonly id: string;                              // путь к файлу заметки
  readonly values: Record<string, Optional<DataValue>>; // значения полей
};
```

### DataValue

```typescript
type DataValue = string | number | boolean | Date | Array<Optional<DataValue>>;
type Optional<T> = T | undefined | null;
// undefined = поле удалено, null = поле существует, но не имеет значения
```

### ViewApi

Методы для изменения данных из вашего представления.

| Метод | Параметры | Описание |
|-------|----------|----------|
| `addRecord` | `(record, fields, templatePath)` | Создать новую заметку |
| `updateRecord` | `(record, fields)` | Обновить поля frontmatter |
| `deleteRecord` | `(recordId)` | Удалить заметку |
| `updateField` | `(field)` | Обновить метаданные поля |
| `deleteField` | `(field)` | Удалить поле frontmatter |

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

## Важные замечания

- **Этот API экспериментальный**. Ломающие изменения могут произойти в любом релизе.
- Метод `onRegisterProjectView` может быть вызван **несколько раз** (по одному на экземпляр представления).
- Всегда очищайте ресурсы в `onClose()` для предотвращения утечек памяти.
- Если `readonly` равен `true`, отключите любой UI, вызывающий write-методы `ViewApi`.
- Пакет `obsidian-projects-types` специфичен для этого семейства плагинов и может обновляться нечасто.

---

## Дополнительно

- [obsidian-projects-types README](../obsidian-projects-types/README.md) — полный пример от оригинального автора
- [README](../README.md) — обзор плагина
- [Руководство пользователя](user-guide.md) — документация для пользователей
