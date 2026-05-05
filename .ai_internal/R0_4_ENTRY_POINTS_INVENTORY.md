# R0.4 — Entry-Point Inventory (read-only audit)

> **Anchored in**: [REVISION_3_USER_DIRECTIVES_2026-05-01.md](REVISION_3_USER_DIRECTIVES_2026-05-01.md) §2.2.
> **Status**: pre-coding analytical artifact. NO code changes implied. Built from grep of `src/main.ts`, `src/managers/CommandManager.ts`, `src/ui/**` for `addCommand` / `addRibbonIcon` / `registerEvent("file-menu")` / `registerView` / `new Menu()` / `on:contextmenu`.
> **Date**: 2026-05-01.

## 1. Existing entry points (по факту в коде)

### 1.1 Command palette — `src/main.ts`
| ID | Type | Gate | Назначение |
|----|------|------|-----------|
| `show-projects` | callback | always | Активировать главный leaf |
| `create-project` | callback | always | Открыть `CreateProjectModal` |
| `create-note` | checkCallback | `settings.projects[0]` exists | Открыть `CreateNoteModal` для первого проекта |
| `open-schema` | checkCallback | leaf of `VIEW_TYPE_PROJECTS` open | Stage A.10 — диспатч в `commandBus` → `DatabaseViewCanvas.openSchema()` |
| `add-field` | checkCallback | leaf of `VIEW_TYPE_PROJECTS` open | Stage A.10 — диспатч в `commandBus` → `DatabaseViewCanvas.openCreateField()` |
| `<plugin>:show:<project>[:<view>]` | callback | dynamic | Per-project / per-view shortcut, генерируется из `settings.preferences.commands` |

### 1.2 Ribbon icon
- Один: `addRibbonIcon("projects-icon", t("obsidian.ribbon-tooltip"), () => activateView())`. Открывает главный Projects leaf.

### 1.3 Native context menu
- **`workspace.on("file-menu")` для `TFolder`** → `menus.project.create.title` ("Создать проект из этой папки"). Это **единственная** native-точка входа.
- **Нет** entry для `TFile` (не для проекта-источника, не для целевой relation, не для Visualizer).

### 1.4 Workspace views (`registerView`)
- `VIEW_TYPE_PROJECTS` → `ProjectsView` (главный канвас Projects Plus). Один зарегистрированный view-type.
- **Нет** отдельных view-type для Visualizer / sidebar-pane / settings-tab за пределами стандартного `PluginSettingTab`.

### 1.5 Internal context menus (`new Menu()` через Obsidian API)
| Локация | Триггер | Что делает |
|---------|---------|-----------|
| `src/ui/views/Table/components/DataGrid/DataGrid.svelte` × 3 | header / row / cell | Sort / Resize / Insert column / Delete (Wave-1 наследие, anchor проблемный) |
| `src/ui/views/Calendar/components/Calendar/Day.svelte` | day cell | Создать запись на дату |
| `src/ui/views/Calendar/agenda/AgendaCustomList.svelte` | agenda row | Edit / Delete |
| `src/ui/views/Board/components/Board/BoardColumn.svelte` | column header | Edit status |
| `src/ui/modals/components/EditNote.svelte` | poll/cell | Edit field |
| `src/ui/components/TagsInput/Tag/Tag.svelte` | tag chip | Remove tag |
| `src/ui/views/helpers.ts::createNoteMenu` | shared helper | Open / Reveal in folder / Delete file |

### 1.6 Toolbar buttons (per-view)
- `DatabaseViewCanvas.svelte` toolbar — Stage A.10: ⚙ Schema, + Add field, toggles (toolbar visibility, formula bar). Все привязаны к canvas, не к глобальному окружению.
- Other views (Table / Board / Calendar / Gallery) — встроенные `obsidian-svelte` toolbars, без user-extensible slots.

## 2. Gap analysis — что отсутствует относительно §2.2 Revision 3

### 2.1 Native context menu
- ❌ `workspace.on("file-menu")` для `TFile` → "Open as YAML Visualizer".
- ❌ `workspace.on("file-menu")` для `TFile` → "Add to project" (relation creation).
- ❌ `workspace.on("editor-menu")` → "Insert relation to current note".
- ❌ Folder context menu → "Add to existing project" (только "Create new").

### 2.2 Ribbon
- ❌ Toggle Visualizer (правая sidebar-pane on/off).
- ❌ Quick-create note (без выбора проекта — для самой частой задачи).

### 2.3 Sidebar leaf
- ❌ Постоянная panel со свойствами активной заметки (заменитель/дополнение нативной Properties pane).
- ❌ Sub-bases overview panel (когда Database view открыт — список под-баз с навигацией).

### 2.4 Command palette
- ❌ `toggle-visualizer` — вкл/выкл sidebar-pane.
- ❌ `add-relation` — добавить relation к активной заметке.
- ❌ `replace-properties-pane` — переключение нативной pane на наш Visualizer.
- ❌ `open-formula-editor` — глобальный formula editor.
- ❌ `add-sub-base` — добавить под-базу в активный Database view.
- ❌ `cycle-views` — следующий view в текущем проекте (hotkey-friendly).

### 2.5 Hotkeys
- ❌ Нет ни одного default-hotkey. Все команды без `hotkeys: []`. Пользователь должен назначить вручную.
- **Рекомендация**: оставить пустыми (best practice Obsidian — не конфликтовать с user-defined), но в README/docs дать рекомендованные сочетания.

### 2.6 Inline editing
- ❌ Cell click в Database view → не открывает inline editor для Stage A типов (Select/Status/Relation/Date/Datetime).
- ❌ Property chip в card (Board / Gallery) → не редактируется кликом.
- ❌ Visualizer property row → editor есть только для базовых типов (string/number/boolean/date/list); Relation/Rollup/Formula — read-only.

### 2.7 Column header context menu (Database)
- ⚠️ Существует в `DataGrid.svelte` × 3, но **anchor сломан** (cf. Revision 3 §3.1 critical finding: "критически не верными закреплениями контекстных меню колонок").
- ❌ Отсутствуют пункты: Edit field type / Hide column / Pin column / Insert left / Insert right / Sort by this / Filter by this (как в Notion screenshot).

### 2.8 Settings entry points
- ✅ `PluginSettingTab` зарегистрирован.
- ❌ Нет deep-links из view-toolbar в конкретную секцию settings (например, "Edit field types" → settings.fieldTypes).
- ❌ Нет inline-onboarding-hints (первый запуск → tooltip "Кликните по колонке для настройки").

## 3. Coverage matrix (entry-point × surface)

Легенда: ✅ есть · ⚠️ частично · ❌ отсутствует

| Surface ↓ \\ Entry → | Palette | Ribbon | File-menu | Editor-menu | Sidebar leaf | View toolbar | Inline cell | Hotkey |
|---|---|---|---|---|---|---|---|---|
| Open Projects view | ✅ | ✅ | ❌ | ❌ | ❌ | n/a | n/a | ❌ |
| Create project | ✅ | ❌ | ✅ folder only | ❌ | ❌ | ❌ | n/a | ❌ |
| Create note | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ per-view | n/a | ❌ |
| Open schema (Database) | ✅ A.10 | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Add field (Database) | ✅ A.10 | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Edit field type | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ via Schema | ❌ | ❌ |
| Open Visualizer (заметка) | ❌ | ❌ | ❌ | ❌ | ❌ | n/a | n/a | ❌ |
| Toggle Visualizer pane | ❌ | ❌ | ❌ | ❌ | ❌ | n/a | n/a | ❌ |
| Add relation to note | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Add sub-base | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | n/a | ❌ |
| Open formula editor | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ formula bar only | ❌ | ❌ |
| Edit cell value (Stage A types) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Replace native Properties pane | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | n/a | ❌ |

**Итого entry-point coverage для всех новых функций (Stage A + R1/R2/R3 plans)**: ~10% (только палитра для open-schema/add-field).

## 4. Рекомендованный приоритет для R0/R1

### R0.4a — обязательный минимум до R1
1. Расширить `workspace.on("file-menu")` для `TFile`: "Open in Visualizer", "Add as relation to active project".
2. Добавить `addCommand`-ы скелетами (без полной реализации): `toggle-visualizer`, `add-relation`, `open-formula-editor`. Сразу wired в i18n keys.
3. Зарегистрировать `VIEW_TYPE_VISUALIZER_PANE` для sidebar-leaf (читает активный файл, рендерит компонент). Скелет — без relation/rollup/formula, только properties view.

### R0.4b — после R1.1 (Visualizer leaf)
1. Replace-toggle (settings flag + hijack нативной Properties pane).
2. Ribbon icon для Visualizer.
3. Inline cell editor unifier — компонент, переиспользуемый Database/Board/Gallery/Visualizer.

### R0.4c — после R2.1 (Database canvas reborn)
1. Column header context menu (portal-anchored, не наследие Wave-1 anchor).
2. Cell context menu с per-type actions.
3. `add-sub-base` command + toolbar entry в Database canvas.

## 5. Open questions для §5 Revision 3

Этот inventory не отвечает на вопросы — он их уточняет:
- **§5.6** "Replacement нативной Properties pane" → конкретное предложение: settings-toggle "Use Projects Plus Visualizer" + sidebar-leaf side-by-side mode по умолчанию, hijack только когда явно включен.
- Нужен ответ пользователя на **§5.1..§5.7** до начала implementation R0.4a.

## 6. Anchors

- `src/main.ts` — единственное место регистрации global entry points
- `src/managers/CommandManager.ts` — wrapper для `plugin.addCommand` с graceful fallback
- `src/lib/stores/commandBus.ts` (Stage A.10) — broker для command-palette → view-canvas
- Revision 3 §2.2 — UX-директива по точкам входа
- Revision 3 §3.1 — критическая находка про сломанный anchor контекстных меню колонок
