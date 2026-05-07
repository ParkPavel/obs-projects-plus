# Аналитика: Обнаружение заметок по тегам (Tag Datasource)

**Дата**: 2026-02-17  
**Приоритет**: P0  
**Статус**: Исследование  

---

## 1. Архитектура текущей реализации

### Цепочка вызовов

```
DataFrameProvider.svelte
  → resolveDataSource(project)
    → new TagDataSource(fileSystem, project, preferences)

queryAll() [FrontMatterDataSource]
  → fileSystem.getAllFiles()              // ← получить ВСЕ .md файлы хранилища
  → .filter(({ path }) => this.includes(path))  // ← фильтрация через includes()
  → queryFiles(filteredFiles)             // ← чтение frontmatter, парсинг записей

includes(path) [TagDataSource]
  → fileSystem.getFile(path)
    → file.readTags()                     // ← КРИТИЧЕСКАЯ ТОЧКА
      → app.metadataCache.getFileCache(file)
        → parseTags(cache)
  → tag matching (exact or hierarchy)
```

### Ключевые файлы

| Файл | Роль |
|------|------|
| `src/lib/datasources/tag/datasource.ts` | `TagDataSource.includes()` — решает, принадлежит ли файл проекту |
| `src/lib/filesystem/obsidian/filesystem.ts` | `ObsidianFile.readTags()` → `parseTags(cache)` — извлечение тегов |
| `src/lib/datasources/frontmatter/datasource.ts` | `FrontMatterDataSource.queryAll()` — базовый класс, перебор файлов |
| `src/events.ts` | `registerFileEvents()` — live-обновления при изменении файлов |
| `src/lib/dataApi.ts` | `createNewRecord()` — создание заметки с тегом проекта |

---

## 2. Анализ функции `parseTags(cache)`

```typescript
// src/lib/filesystem/obsidian/filesystem.ts:156-190
function parseTags(cache: CachedMetadata) {
  const allTags = new Set<string>();

  // Источник 1: inline теги из тела заметки (#tag в тексте)
  // cache.tags — массив { tag: "#sometag", position: {...} }
  const markdownTags = cache.tags?.map((tag) => tag.tag) ?? [];
  markdownTags.forEach((tag) => allTags.add(tag));

  // Источник 2: frontmatter.tags (массив или строка)
  parseFrontMatterTags(cache.frontmatter?.["tags"]).forEach((tag) =>
    allTags.add(tag)
  );
  
  // Источник 3: frontmatter.tag (единственное число)
  parseFrontMatterTags(cache.frontmatter?.["tag"]).forEach((tag) =>
    allTags.add(tag)
  );

  return allTags;
}

function parseFrontMatterTags(property: unknown): string[] {
  const res: string[] = [];
  if (typeof property === "string") {
    // "foo, bar" → ["#foo", "#bar"]
    property.split(",").map((tag) => "#" + tag.trim()).forEach((tag) => res.push(tag));
  } else if (Array.isArray(property)) {
    // ["foo", "bar"] → ["#foo", "#bar"]
    property.filter(notEmpty).map((tag) => "#" + tag.toString()).forEach((tag) => res.push(tag));
  }
  return res;
}
```

### Формат тегов (КРИТИЧЕСКИ ВАЖНО)

Все теги **всегда возвращаются с `#`**:
- Inline: Obsidian cache уже содержит `#tag` → без изменений
- Frontmatter `tags: [foo, bar]` → `parseFrontMatterTags` добавляет `#` → `#foo`, `#bar`
- Frontmatter `tags: "foo, bar"` → аналогично → `#foo`, `#bar`
- Frontmatter `tag: "foo"` → `#foo`

**Результат `readTags()`**: `Set<string>` вида `{"#project", "#task", "#urgent"}`

---

## 3. Анализ `TagDataSource.includes()`

```typescript
// src/lib/datasources/tag/datasource.ts
includes(path: string): boolean {
  if (this.project.dataSource.kind !== "tag") return false;
  if (this.project.excludedNotes?.includes(path)) return false;

  const { tag } = this.project.dataSource.config;  // ← что вводит пользователь
  const file = this.fileSystem.getFile(path);

  if (file) {
    if (this.project.dataSource.config.hierarchy) {
      // Иерархический режим: "#project/sub" matches "#project/sub/deep"
      for (const fileTag of file.readTags()) {
        if (fileTag.startsWith(tag)) return true;  // ← сравнение
      }
    } else {
      // Точное совпадение
      return file.readTags().has(tag);              // ← сравнение
    }
  }

  return false;
}
```

---

## 4. Выявленные проблемы

### Проблема 1: НЕСОГЛАСОВАННОСТЬ ФОРМАТА ТЕГА (КОРНЕВАЯ ПРИЧИНА)

**UI**: поле ввода имеет placeholder `#tag`, но **не принуждает** к формату с `#`.

```svelte
<!-- CreateProject.svelte:308 -->
<TextInput
  placeholder="#tag"
  value={project.dataSource.config.tag ?? ""}
  on:input={({ detail: tag }) => { ... }}
/>
```

Пользователь может ввести:
- `#project` — **работает** (readTags возвращает `#project`, совпадение есть)
- `project` — **НЕ РАБОТАЕТ** (readTags возвращает `#project`, а config содержит `project` → `.has("project")` = false)

**Результат**: если пользователь ввёл тег без `#`, **ни одна заметка не будет найдена**.

### Проблема 2: ДВОЙНОЙ `#` В parseFrontMatterTags (ПОДТВЕРЖДЁННЫЙ БАГ)

**Frontmatter допускает два формата:**
```yaml
# Формат A — без #
tags:
  - daily
  - work

# Формат B — с # (многие пользователи пишут так)
tags:
  - "#daily"
  - "#work"
```

YAML-парсер Obsidian вернёт для формата B: `["#daily", "#work"]`.

Текущий код **всегда** добавляет `#`:
```typescript
// parseFrontMatterTags
.map((tag) => "#" + tag.toString())
```

| Ввод YAML | Парсится как | parseFrontMatterTags | Результат |
|-----------|-------------|---------------------|-----------|
| `tags: [daily]` | `["daily"]` | `"#" + "daily"` | `"#daily"` ✅ |
| `tags: ["#daily"]` | `["#daily"]` | `"#" + "#daily"` | `"##daily"` ❌ |
| `tags: "daily, #work"` | `"daily, #work"` | `"#daily"`, `"##work"` | Частично ❌ |

**Результат**: заметки с `tags: ["#daily"]` в frontmatter **невидимы** для tag-проекта с `config.tag = "#daily"`, потому что Set содержит `"##daily"` вместо `"#daily"`.

**Исправление**: нормализовать перед добавлением `#`:
```typescript
.map((tag) => {
  const trimmed = tag.toString().trim();
  return trimmed.startsWith("#") ? trimmed : "#" + trimmed;
})
```

### Проблема 3: RACE CONDITION С metadataCache

```typescript
// ObsidianFile.readTags()
readTags(): Set<string> {
  const cache = this.app.metadataCache.getFileCache(this.file);
  if (cache) {
    return parseTags(cache);
  }
  return new Set<string>();  // ← пустой Set если кеш ещё не готов
}
```

`metadataCache.getFileCache()` может вернуть `null` для:
- Только что созданных файлов (кеш ещё не построен)
- Файлов после переименования
- При запуске Obsidian (кеш ещё заполняется)

**Результат**: `readTags()` возвращает пустой Set → `includes()` = false → заметка не видна.

`queryAll()` вызывается при открытии проекта:
```typescript
async queryAll(): Promise<DataFrame> {
  const files = this.fileSystem.getAllFiles()
    .filter(({ path }) => this.includes(path));  // ← вызов readTags() для КАЖДОГО файла
  ...
}
```

Если Obsidian ещё не построил кеш для части файлов — они будут пропущены.

### Проблема 4: ОТСУТСТВИЕ НОРМАЛИЗАЦИИ ТЕГА

`dataApi.ts` при создании новой заметки:
```typescript
if (project.dataSource.kind == "tag") {
  values = {
    ...values,
    tags: [project.dataSource.config.tag.replace("#", "")],  // ← удаляет #
  };
}
```

Этот код записывает тег **без `#`** в frontmatter (`tags: [project]`).

Но `parseFrontMatterTags` **добавляет `#`** при чтении: `"project"` → `"#project"`.

**Сам по себе это не баг**, но показывает, что система ожидает `config.tag` с `#`. Если пользователь ввёл `project` без `#`, то:
- `replace("#", "")` вернёт `"project"` (ОК)
- Но `includes()` будет сравнивать `"project"` с `"#project"` → **miss**

### Проблема 5: СОБЫТИЯ НЕ ПЕРЕПРОВЕРЯЮТ ЧЛЕНСТВО

```typescript
// events.ts — onChange handler
watcher.onChange(async (file) => {
  await withDataSource(async (source) => {
    const recordExists = !!get(dataFrame).records
      .find((record) => record.id === file.path);

    if (source.includes(file.path)) {
      // Файл в проекте → обновить
      dataFrame.merge(await source.queryOne(file, get(dataFrame).fields));
    } else if (recordExists) {
      // Файл был в проекте, но больше нет → удалить
      dataFrame.deleteRecord(file.path);
    }
    // 🔴 ПРОБЛЕМА: если файл НЕ был в проекте и includes() вернул false
    // из-за неготового кеша → файл НАВСЕГДА пропущен (до ручного refresh)
  });
});
```

Если при `onCreate` кеш ещё не готов → `includes()` = false → файл не добавлен.
Когда позже `onChange` срабатывает (кеш обновился), `includes()` уже может вернуть true, но **только если** `metadataCache.on("changed")` сработал. Если изменился только кеш, а не файл — событие может не прийти.

### Проблема 6: InMemFileSystem — ЛОГИКА ОТЛИЧАЕТСЯ ОТ Obsidian

`InMemFile.readTags()` парсит теги самостоятельно через regex, а не через Obsidian metadataCache:
```typescript
// inmem/filesystem.ts — InMemFile.readTags()
const inlineTagRegex = /(^|\s)#([\p{L}\p{N}_\-/]+)\b/gu;
// Frontmatter: tags: foo, bar → #foo, #bar
```

Это означает, что **тесты с InMemFileSystem** могут давать другие результаты, чем в реальном Obsidian. Тестировать tag detection через моки нельзя доверять.

---

## 5. Сценарии сбоя (воспроизводимые)

| # | Сценарий | Причина | Влияние |
|---|----------|---------|---------|
| 1 | Пользователь вводит `project` без `#` | Нет нормализации в UI/config | **0 заметок найдено** |
| 2 | Frontmatter `tags: ["#daily"]` (с `#` в кавычках) | `parseFrontMatterTags` добавляет второй `#` → `"##daily"` | **Заметка не найдена** |
| 3 | Открытие проекта на большом хранилище | metadataCache ещё не готов для всех файлов | Заметки появляются постепенно или не все |
| 4 | Создание заметки → она не появляется | `onCreate` → `includes()` → `readTags()` → пустой кеш | Заметка не видна до refresh |
| 5 | Тег `#project/sub` с hierarchy=false | `readTags().has("#project")` = false (есть `#project/sub`) | Заметка не найдена (ожидаемо, но не очевидно пользователю) |
| 6 | Frontmatter `tag: project` (ед. число) | `parseTags()` читает и `tag:` и `tags:` — ОК | Работает ✅ |
| 7 | Inline тег `#project` в теле, но нет в frontmatter | `cache.tags` содержит inline теги | Работает ✅ |
| 8 | Тег с регистром `#Project` vs `#project` | Set comparison — case-sensitive | Заметка не найдена |

---

## 6. План исправления

### Фаза 1: Нормализация тега (корневые причины — проблемы 1, 2, 4)

**A. Исправить `parseFrontMatterTags`** — не допускать двойного `#`:
```typescript
function normalizeTag(raw: string): string {
  const trimmed = raw.toString().trim();
  return trimmed.startsWith("#") ? trimmed : "#" + trimmed;
}

function parseFrontMatterTags(property: unknown): string[] {
  if (typeof property === "string") {
    return property.split(",").map((t) => normalizeTag(t)).filter(Boolean);
  } else if (Array.isArray(property)) {
    return property.filter(notEmpty).map((t) => normalizeTag(t));
  }
  return [];
}
```

**B. Нормализовать `config.tag`** в `TagDataSource.includes()`:
```typescript
const tag = normalizeTag(this.project.dataSource.config.tag);
```

**C. Нормализовать ввод в UI** (`CreateProject.svelte`): при сохранении проекта автоматически добавлять `#` если отсутствует.

**D. Нормализовать при создании заметки** (`dataApi.ts`): убрать хрупкий `.replace("#", "")`, использовать надёжное удаление `#`.

### Фаза 2: Защита от неготового кеша

1. **Fallback в `readTags()`**: если `getFileCache()` вернул null, попробовать `resolveLinks` или прочитать файл напрямую через `decodeFrontMatter`.

2. **Retrigger в `events.ts`**: при `metadataCache.on("resolved")` выполнить повторный `queryAll()` для tag-проектов.

### Фаза 3: Тесты

1. **Unit-тест нормализации**: `includes()` с тегами `"project"`, `"#project"`, `"#Project"`.
2. **Unit-тест `parseTags()`**: все форматы frontmatter (string, array, singular tag:).
3. **Integration test**: создание заметки в tag-проекте → проверка появления.

---

## 7. Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/lib/datasources/tag/datasource.ts` | Нормализация тега, case-insensitive matching |
| `src/lib/filesystem/obsidian/filesystem.ts` | Fallback при null cache в `readTags()` |
| `src/ui/modals/components/CreateProject.svelte` | Авто-нормализация при вводе тега |
| `src/lib/dataApi.ts:299-302` | Проверка формата тега при создании заметки |
| `src/events.ts` | Обработка `metadataCache.on("resolved")` |
| Новый: `src/lib/datasources/tag/datasource.test.ts` | Unit-тесты для TagDataSource |
| Новый: `src/lib/filesystem/parseTags.test.ts` | Unit-тесты для parseTags |

---

## 8. Оценка рисков

| Риск | Вероятность | Митигация |
|------|------------|-----------|
| Breaking change для пользователей с `#` в конфиге | Низкая | Нормализация работает в обе стороны |
| Производительность при fallback-чтении файлов | Средняя | Только при null cache, с debounce |
| Regression в folder/dataview datasources | Низкая | Изменения только в tag-ветке |
| Двойная загрузка при "resolved" event | Средняя | Debounce + проверка isDirty |
