Реконструкция CX‑R4 для `main @ 64863ed`, без изменений файлов. Ниже строки приведены для русской локали; строки, у которых нет ключа в `ru.json`, фактически остаются английскими `defaultValue`.

### 1. Настройка источника и связи

**ЭКРАН**

```text
Data Source                                      [×]
Load data from a different project instead of the current view.

Источник данных
[ Данные этого вью (по умолчанию)                 ▾ ]
По умолчанию блок показывает записи этого вью. Выберите другой проект,
чтобы показать его данные.

Связать с блоком
[ Без связи — показать все записи                 ▾ ]
Без связи блок показывает все записи. Со связью — только записи,
связанные с выбранным блоком.

(после выбора блока)
Фильтровать по полю
[ — Выберите поле —                               ▾ ]

(только при missing-relation / wrong-target-project)
No Relation field points at the linked block's project.
Add a Relation field in the schema editor first.
```

**ОТКУДА**

- Панель появляется по кнопке настройки виджета: [WidgetHost.svelte:175](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetHost.svelte:175).
- Заголовок, подзаголовок и селекторы: [DatabaseCallSettings.svelte:55](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte:55), [66](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte:66), [84](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte:84), [95](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte:95).
- Русские строки: [ru.json:1187](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/ru.json:1187). Английские `Data Source`, subtitle и предупреждение — `defaultValue` в [DatabaseCallSettings.svelte:56](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte:56) и [108](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte:108).

**ДЕЙСТВИЕ**

Выбрать другой проект в «Источник данных»; при необходимости выбрать исходный блок и Relation-поле.

**ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ**

Меняется только конфигурация виджета: `sourceConfig.projectId` и/или `linkedSelection`; записи не создаются и не меняются ([DatabaseCallSettings.svelte:37](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte:37), [42](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte:42)). Валидной считается только Relation-колонка принимающего проекта, указывающая на проект блока-источника ([relationContract.ts:42](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationContract.ts:42)).

**РАЗРЫВ**

Предупреждение показано для `missing-relation` и `wrong-target-project`, но не для `invalid-field` — то есть после удаления выбранного Relation-поля в панели предупреждения нет ([DatabaseCallSettings.svelte:35](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte:35)).

### 2. Внешний источник: промежуточный и ошибочные состояния

**ЭКРАН**

```text
[иконка загрузки]
Загрузка связанного проекта…
```

```text
[иконка разорванной ссылки]
Связанный проект недоступен
Проект, из которого читает этот блок, не найден: <projectId>
```

```text
[иконка предупреждения]
Не удалось загрузить связанный проект
<точный текст исключения sourceState.message>
```

**ОТКУДА**

Все три состояния рендерятся раньше вкладок и данных: [DatabaseCallBlock.svelte:338](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:338), [345](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:345), [356](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:356). Тексты локализованы в [ru.json:1196](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/ru.json:1196); контейнер состояния выводит только icon/title/hint: [EmptyState.svelte:17](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/EmptyState/EmptyState.svelte:17).

**ДЕЙСТВИЕ**

Нет кнопки повтора, выбора другого проекта или возврата к данным родительского проекта.

**ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ**

Отсутствие статуса и `loading` эквивалентны загрузке; `undefined` от загрузчика — `unavailable`; исключение — `error` с текстом исключения ([linkedSourceState.ts:34](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/linkedSourceState.ts:34), [dashboardPreload.ts:122](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardPreload.ts:122)). Родительский frame намеренно не подставляется.

**РАЗРЫВ**

Пользователь видит `projectId` только при исчезнувшем источнике; при загрузке и ошибке имени/ID проекта нет. Причина ошибки выводится сырым `message`, без пользовательской классификации.

### 3. Источник готов, но представления отсутствуют

**ЭКРАН**

```text
[иконка базы]
Представления не настроены

[ Добавить первое представление ]       ← только не-read-only dashboard
```

**ОТКУДА**

[DatabaseCallBlock.svelte:364](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:364), строки из [ru.json:1167](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/ru.json:1167).

**ДЕЙСТВИЕ**

«Добавить первое представление» создаёт вкладку «Таблица».

**ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ**

В widget config добавляется tab с типом `table` и генерируемым ID; данные и заметки не изменяются ([DatabaseCallBlock.svelte:185](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:185)).

**РАЗРЫВ**

Для готового внешнего источника этот CTA доступен: read-only относится к данным, не к конфигурации вкладок.

### 4. Готовый блок с данными, включая внешнее read-only

**ЭКРАН**

```text
[ <имя сохранённой вкладки>  ⋯ ] [ + ]
[ Фильтр ] [<пилюли условий>]

<заголовки фактических полей>
<имя записи> | <значения>
...
+ Новая запись                  ← только у таблицы собственного источника
```

Relation-значение в строке — до трёх пилюль с распарсенными именами ссылок, затем `+N`; пустая ячейка обычно визуально пуста, символ `—` становится видим лишь при hover.

**ОТКУДА**

- Вкладки и `+`: [ViewTabBar.svelte:104](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/ViewTabBar.svelte:104), [146](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/ViewTabBar.svelte:146).
- Фильтр блока: [BlockFilterBar.svelte:43](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/BlockFilterBar.svelte:43); строки «Фильтр», «Убрать условие», «Этот блок — все его представления» — [ru.json:1152](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/ru.json:1152).
- Таблица и `+ Новая запись`: [DataTableContent.svelte:182](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte:182), [237](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte:237), [TableNewRow.svelte:46](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/TableNewRow.svelte:46).
- Relation-пилюли и пустая ячейка: [tableCanon.ts:237](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/tableCanon.ts:237), [EditableCell.svelte:118](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/EditableCell.svelte:118).

**ДЕЙСТВИЕ**

Обычная таблица позволяет редактировать ячейки и создавать записи. У внешнего источника table/board/calendar получают `readonly=true`, поэтому редактирование и «Новая запись» скрыты ([DatabaseCallBlock.svelte:478](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:478), [493](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:493)).

**ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ**

Внешний frame подаётся в блок отдельно от родительского и `sourceReadOnly` включается для любого внешнего источника ([WidgetHost.svelte:82](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetHost.svelte:82), [91](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetHost.svelte:91)).

**РАЗРЫВ**

Нет ни бейджа «внешний источник», ни подписи «только чтение». Более того, Gallery не получает `readonly` вовсе ([DatabaseCallBlock.svelte:518](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:518)) и показывает кнопку `+`, которая вызывает `api.addRecord` с родительским `project` ([GalleryView.svelte:209](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Gallery/GalleryView.svelte:209)). Для внешней Gallery обещание read-only нарушено.

### 5. Три подписи фильтра: relation / broken / canvas

**ЭКРАН**

```text
Filtered by relation
```

```text
Relation broken: missing-relation
Relation broken: invalid-field
Relation broken: wrong-target-project
```

```text
Filtered by canvas selection
```

**ОТКУДА**

Все три — английские `defaultValue`, поскольку ключей нет в ru-пакете: [DatabaseCallBlock.svelte:398](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:398). Статусы определяются здесь: [relationContract.ts:48](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationContract.ts:48).

**ДЕЙСТВИЕ**

Выбрать строку/элемент в связанном блоке либо очистить selection клавишей Escape. «Очистить фильтр» удаляет canvas selection и локальный `subFilter`, но не настройки relation ([DatabaseCallBlock.svelte:224](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:224)).

**ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ**

- `valid`: relation-условие применяется только при активном выборе нужного source-widget.
- Удалённое поле даёт `invalid-field`; Relation на другой проект — `wrong-target-project`.
- При любом невалидном relation-условии relation-фильтр не применяется, но может примениться обычный canvas-фильтр по полю выделения ([canvasSelectionStore.ts:250](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/canvasSelectionStore.ts:250)).

**РАЗРЫВ**

`Filtered by relation` показано уже при валидной конфигурации — даже без активного выделения и фактической фильтрации. Аналогично `Filtered by canvas selection` не проверяет self-skip. Сломанная relation может всё же сузить данные fallback canvas-фильтром, хотя бейдж сообщает только о поломке relation.

### 6. Пустой результат фильтра, пустые данные и pipeline

**ЭКРАН**

```text
[иконка фильтра]
Нет совпадений
[ Очистить фильтр ]
```

```text
[иконка фильтра]
Конвейер не вернул ни одной строки (шагов: K)
[ Открыть конвейер ] [ Очистить конвейер ]   ← только не-read-only
```

```text
[иконка базы]
Нет записей
[ Добавить первую запись ]                    ← только собственный writable source
```

**ОТКУДА**

[DatabaseCallBlock.svelte:422](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:422), [445](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:445), [460](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:460); русские строки — [ru.json:1169](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/ru.json:1169).

**ДЕЙСТВИЕ**

Очистить фильтр; открыть/очистить pipeline; либо создать первую заметку.

**ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ**

`Нет совпадений` означает лишь: в frame до последнего фильтра были записи, после него — ноль. `Конвейер…` требует ненулевой input, хотя бы один шаг и нулевой output ([DatabaseCallBlock.svelte:205](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:205), [210](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:210)).

**РАЗРЫВ**

По `Нет совпадений` нельзя определить, какая ось убрала строки: scope (`subFilter`), transform или selection/relation. Кнопка «Очистить фильтр» доступна даже при `readonly` ([DatabaseCallBlock.svelte:452](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:452)).

Для Board/Calendar/Gallery эти специальные table-state не используются: пустой результат делегируется самому виду. Например Gallery покажет «Этот вид пуст.» и «Create a note to get started» ([GalleryView.svelte:224](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Gallery/GalleryView.svelte:224)); причины пустоты также не видны.

### 7. Relation-ячейка, счётчик «Связано» и unmatched

**ЭКРАН: открытый редактор Relation-поля**

```text
[ Поиск записей… ]
(загрузка) …

(готово, есть совпадения)
Связано: N
[ кандидат 1 ]
[ кандидат 2 ]
...
[Готово] [Отмена]                 ← «Готово» только для multi-value Relation

(готово, кандидатов нет)
Связанных записей нет
Нет записей для связи
[Отмена]

(нет targetProjectId и совсем нет кандидатов)
Связанных записей нет
[ Связать с базой… ]
[Отмена]
```

**ОТКУДА**

[RelationPickerPopover.svelte:95](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:95), [104](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:104), [106](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:106). Бейдж — [RelationCountBadge.svelte:6](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationCountBadge.svelte:6); русские строки — [ru.json:1145](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/ru.json:1145), [ru.json:1792](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/ru.json:1792).

**ДЕЙСТВИЕ**

Открыть writable Relation-ячейку; выбрать кандидата. Одиночная Relation сохраняется сразу; repeated — по «Готово» ([RelationPickerPopover.svelte:69](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:69), [131](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:131)).

**ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ**

Кандидаты загружаются из target-проекта; при ошибке/пустоте берутся все уже встречавшиеся ссылки этого столбца ([RelationPickerPopover.svelte:44](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:44)). `Связано: N` — не число фактически разрешённых relation по контракту: это число raw-label, найденных в массиве candidate names ([RelationPickerPopover.svelte:60](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:60)).

**РАЗРЫВ**

Unmatched-ссылка не имеет видимого статуса. В обычной ячейке она выглядит как обычная пилюля с именем ссылки; в picker максимум даёт `Связанных записей нет`/меньшее N, без указания, какая ссылка не найдена. Контракт различает `resolved`, `unmatched`, `ambiguous`, но UI эти статусы не рендерит ([relationContract.ts:98](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationContract.ts:98)).

## ЧЕГО НЕ ВИДНО

- Что блок читает внешний проект, какой именно проект выбран и почему он read-only; в ready-состоянии нет ни имени источника, ни бейджа.
- Исход записи и место фактической записи: внешний Gallery может записать в родительский проект.
- Почему фильтр дал ноль: scope, transform и selection не разложены на экране.
- Есть ли сейчас активное selection: relation-бейдж может утверждать `Filtered by relation`, когда relation-фильтр фактически не применяется.
- Целевой проект Relation-поля, путь ссылки и причины `unmatched`/`ambiguous`; виден только сырой текст пилюли.
- Для `source-error` отсутствуют стабильный код ошибки, имя проекта и действие восстановления; доступен лишь произвольный текст исключения.

Codex session ID: 01a04220-6b25-7b72-9d3d-fdbee490d085
Resume in Codex: codex resume 01a04220-6b25-7b72-9d3d-fdbee490d085
