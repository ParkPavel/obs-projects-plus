Гипотеза подтверждена: чекбокс сохраняет только имя inverse-поля в настройках исходного проекта. Он не создаёт поле в схеме цели, а при первой записи `inverse-field-missing` возвращается, но до UI не доходит.

Локаль определяется во время запуска Obsidian; ниже приведены фактические строки английского fallback/resource (`en`), так как активная локаль vault не задана. [i18n.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/i18n.ts:42)

## 1. Точки входа

### 1.1 Schema editor

```text
Project schema

↔ <relation field>
  → <target project>
  [Configure] [Link database…] [Delete]

Add a new field
Append a new property to this project.     [Add field]

[Close]
```

Для Relation без цели вместо `→ <target project>` показано `⚠ No target project selected`.

ОТКУДА: строка Relation, её кнопки и empty/warning — [Schema.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/Schema.svelte:161), [Schema.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/Schema.svelte:183), [Schema.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/Schema.svelte:195); фактические английские строки — [en.json](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/en.json:436).

ДЕЙСТВИЕ: нажать `Link database…`.

ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ: Schema закрывается и открывает мастер с draft:

```ts
{ fieldName, targetProjectId, createSourceField: false }
```

`displayField` сюда не переносится, даже если он уже был настроен. Кроме того, source frame для preview содержит `records: []`; при выбранной цели счётчики будут нулевыми. [dashboardSchema.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSchema.ts:49), [dashboardSchema.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSchema.ts:159)

РАЗРЫВ: повторное сохранение из этого входа может стереть прежний `displayField`; preview не проверяет реальные записи источника.

### 1.2 Configure field

```text
Configure field

Name: <field name>
Type: Relation
Target project: <project>
Display field: <optional>
Inverse field name: <optional>
[Link database…]

[Save]
```

ОТКУДА: Relation-панель — [ConfigureField.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/ConfigureField.svelte:646), CTA — [ConfigureField.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/ConfigureField.svelte:741).

ДЕЙСТВИЕ: нажать `Link database…`.

ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ: Configure modal закрывается; draft сохраняет текущие `targetProjectId` и, если он есть, `displayField`, но `createSourceField: false`. [dashboardSchema.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSchema.ts:120)

РАЗРЫВ: поле `Inverse field name` уже обещает “two-way write-back”, но создание inverse-свойства в цели здесь также отсутствует.

### 1.3 Create field

```text
Create new field

Name: <new field>
Type: Relation
Default value
This type is computed or linked — no default value to set here.

Target project: — None —
[Link database…]

[Create field]
```

ОТКУДА: форма — [CreateField.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateField.svelte:360), примечание — [CreateField.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateField.svelte:389), Relation controls и CTA — [CreateField.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateField.svelte:495).

ДЕЙСТВИЕ: выбрать `Relation`, при необходимости цель, затем `Link database…` — не `Create field`.

ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ: Create modal закрывается без вызова `onCreate`; мастер получает:

```ts
{ fieldName, targetProjectId, displayField?, createSourceField: true }
```

Именно Save мастера создаёт исходное Relation-поле. [dashboardSchema.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSchema.ts:85)

РАЗРЫВ: две рядом существующие команды выглядят как альтернативные способы создания поля, но `Link database…` откладывает создание до следующего Save.

### 1.4 Пустая Relation-ячейка

```text
<relation cell>: —

┌ <field name> ───────────────┐
│ Search records…             │
│ …                           │  ← пока грузится
│                              │
│ No linked records yet        │
│ [Link database…]            │
│                    [Cancel] │
└──────────────────────────────┘
```

`Link database…` появляется только после загрузки, когда нет target project и нет уже встречавшихся ссылок. [EditableCell.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/EditableCell.svelte:105), [RelationPickerPopover.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:95), [RelationPickerPopover.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:106), [RelationCountBadge.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationCountBadge.svelte:6).

ДЕЙСТВИЕ: нажать `Link database…`.

ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ: draft имеет `createSourceField: false`, сохраняет target/display configuration и использует настоящий frame таблицы для preview. [DataTableContent.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte:173)

РАЗРЫВ: пустая ячейка не говорит, что поле неконфигурировано; пользователь видит только popover с предложением связать базу.

## 2. RelationSetup

```text
Link property to database
Values stay as WikiLinks in Markdown. Preview makes no changes.

Property
[<field name>]

Database
[Choose a database… ▾]

# Только после непустого id цели:
Display field
[                    ]  placeholder: e.g. title

[ ] Create inverse property in schema

# Только при включённом checkbox:
Inverse property name
[                    ]
The inverse property will only be declared after saving.
Existing notes are not rewritten.

# Только если есть summary:
Matched: <n>; Not found: <n>; Ambiguous: <n>.

[Cancel] [Save relation]
```

ОТКУДА: заголовок/описание/property/database — [RelationSetup.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/RelationSetup.svelte:20); display field — [RelationSetup.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/RelationSetup.svelte:34); inverse controls и warning — [RelationSetup.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/RelationSetup.svelte:43); счётчик — [RelationSetup.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/RelationSetup.svelte:49); кнопки — [RelationSetup.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/RelationSetup.svelte:53). Все строки также определены в [en.json](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/en.json:1772).

ДЕЙСТВИЕ: любое изменение поля сразу инициирует preview; `Escape` и `Cancel` закрывают modal. [RelationSetup.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/RelationSetup.svelte:14)

ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ: preview только диагностический: сопоставляет каждую исходную WikiLink-строку по path, basename и, при заданном `Display field`, значению этого поля. Он ничего не пишет. [relationSetup.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationSetup.ts:51), [relationContract.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationContract.ts:98)

РАЗРЫВ: фраза о создании inverse-свойства неверна: при Save создаётся лишь `inverseFieldName` в source config.

## 3. Preview, пустые и ошибочные состояния

```text
Цель не выбрана:
Database [Choose a database… ▾]
# Нет Display field, счётчика, loading или сообщения.

Целевая frame ещё не доступна:
Database [<target> ▾]
Display field [...]
# Нет счётчика, loading или ошибки.

Цель загружена, но пуста:
Matched: 0; Not found: <количество исходных ссылок>; Ambiguous: 0.
# Если исходных ссылок тоже нет: все три числа 0.
```

Счётчик — это число ссылок, не число source-records. `resolved` означает ровно одно совпадение, `unmatched` — ни одного, `ambiguous` — больше одного. [relationSetup.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationSetup.ts:64), [relationContract.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationContract.ts:110)

При отсутствии id или при `null`/`undefined` external frame мастер просто сбрасывает summary. Спиннера, текста `The selected database could not be loaded.` и retry нет, хотя перевод такой строки существует. [relationSetupController.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/relationSetupController.ts:33)

`Save relation` никогда не disabled. Ошибка не появляется под полем: переданный компоненту `error` всегда пуст, а ошибки валидации уходят в Notice:

```text
A relation property name is required.
Choose a database to link.
A property with this name already exists.
Choose an existing Relation property or create one.
An inverse property name is required.
```

[relationSetup.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationSetup.ts:29), [relationSetupController.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/relationSetupController.ts:20), [relationSetupModal.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/relationSetupModal.ts:9)

РАЗРЫВ: `role="alert"` предусмотрен в разметке, но недостижим данным контроллером. [RelationSetup.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/RelationSetup.svelte:52)

## 4. Save и vault

```text
[Relation wizard остаётся открытым]
Notice: Relation saved.
```

ОТКУДА: успех — [relationSetupController.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/relationSetupController.ts:43). Modal не закрывается этим callback.

ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ:

- Всегда обновляется `project.fieldConfig[sourceField]` исходного проекта: `targetProjectId`, необязательный `displayField`, необязательный `inverseFieldName`. Store подписан на `saveData`, то есть это настройки плагина, не frontmatter. [relationSetupController.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/relationSetupController.ts:24), [settings.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/settings.ts:153), [main.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/main.ts:357)
- Если `createSourceField: true`, создаётся source field `Relation`, `repeated: true`; затем асинхронно в frontmatter каждого source record добавляется `<fieldName>: []`. [relationSetupController.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/relationSetupController.ts:26), [viewApi.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/viewApi.ts:67), [dataApi.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/dataApi.ts:70)
- Если поле уже существовало, Save не меняет frontmatter source или target note.
- В target schema ничего не записывается. В target frontmatter на этом шаге тоже ничего не записывается.

РАЗРЫВ: реальный `ViewApi.addField()` не возвращает promise записи; мастер сразу показывает `Relation saved.`, даже если фоновая запись field в source notes затем упадёт. [viewApi.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/viewApi.ts:67)

## 5. Включённый inverse checkbox: обе стороны

### Сразу после Save

```text
# Видимый экран:
Link property to database
...
[✓] Create inverse property in schema
Inverse property name [backlinks]
[Cancel] [Save relation]

Notice: Relation saved.

# Ни source-, ни target-карточка автоматически не показана.
```

После закрытия и ручного возврата к source schema появится/останется source Relation row вида:

```text
↔ <source field>
  → <target project>
  [Configure] [Link database…] [Delete]
```

В target schema строки `backlinks` нет.

РАЗРЫВ: warning обещает, что inverse-свойство будет “declared after saving”, но код не создаёт ни target schema field, ни target frontmatter field. В конфигурацию источника кладётся только `inverseFieldName`. [relationSetup.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationSetup.ts:70)

### После первой записи relation

```text
# Source table:
<source record> | <source field>
                | [<target basename>]   # pill

# При повторном открытии relation picker:
Search records…
1 linked
[Done] [Cancel]

# Target table/schema:
# Новой inverse-колонки и новой relation-карточки нет.
```

Relation picker пишет в source значение `[[target]]` либо массив таких ссылок; таблица показывает Relation как pill без `[[...]]`. [RelationPickerPopover.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:69), [tableCanon.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/tableCanon.ts:237)

Если в target note уже вручную существует frontmatter поле с именем `backlinks`, writer добавит туда `[[<sourceRecordId>]]`. Если его нет, writer возвращает `inverse-field-missing`; `fireInverseRelations` отбрасывает весь `RelationWriteOutcome`, поэтому Notice, badge и error не появятся. [relationsWriter.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationsWriter.ts:98), [relationsWriter.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationsWriter.ts:119), [viewApi.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/viewApi.ts:113)

## ЧЕГО НЕ ВИДНО

- Какие именно source links matched, не matched или ambiguous, и почему; видны только три числа.
- Идёт ли загрузка target frame, исчезла ли цель или resolver упал: у всех этих состояний мастер может просто не показать счётчик.
- Число source notes, которым Save собирается добавить пустой `[]`, и исходы этих записей.
- Факт, что target schema не получила inverse field.
- `target-not-found`, `inverse-field-missing` и `write-failed`: writer их знает, UI их не показывает.
- Что `Relation saved.` не подтверждает завершение фоновой записи frontmatter.

Codex session ID: 01a04220-5aeb-77f2-9074-4a6c18c3b81c
Resume in Codex: codex resume 01a04220-5aeb-77f2-9074-4a6c18c3b81c
