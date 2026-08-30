Ниже — реконструкция CX‑R3 для `main @ 64863ed`, без запуска Obsidian. Строки приведены для русской локали (`ru.json`); плагин выбирает её из настроек Obsidian, иначе текст будет из соответствующего ресурса. [i18n](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/i18n.ts:16)

## 0. После установки, до первого проекта

### ЭКРАН

```text
┌──────────────────────────────────────────────┐
│ [пустая навигационная панель Projects Plus]  │
├──────────────────────────────────────────────┤
│                                              │
│   (контент проекта не отрисован)             │
│                                              │
└──────────────────────────────────────────────┘

Поверх него открыта модалка onboarding.
```

### ОТКУДА

- Приложение рендерит навигацию всегда, но основной контент — только при наличии `project`: [App.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:280), [App.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:296).
- При пустом `projects` на mount открывается onboarding: [App.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:173).

### ДЕЙСТВИЕ

Нет отдельного экрана выбора: пользователь сразу получает onboarding.

### ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ

На диск ещё ничего не записывается.

### РАЗРЫВ

Нет разрыва.

## 1. Onboarding

### ЭКРАН

```text
┌ Начните работу с Projects Plus ───────────────────────────────┐
│ Projects Plus позволяет управлять группами связанных заметок  │
│ с помощью front matter. Например, папка с публикациями блога, │
│ над которыми вы работаете.                                   │
│                                                               │
│ ---                                                           │
│ status: Backlog                                               │
│ due: 2023-01-01                                               │
│ published: false                                              │
│ ---                                                           │
│                                                               │
│ # My blog post                                                │
│                                                               │
│ Начните с нуля или попробуйте демо-проект 👇                  │
│                                                               │
│ [Создать новый проект] [Попробовать демо-проект]              │
│                               tooltip: «Создаёт новую папку  │
│                               в корне хранилища с примерами  │
│                               заметок.»                       │
│                                                               │
│ Psst! 👋 В следующий раз вы можете создавать проекты…         │
│ [Вид проектов] [Палитра команд] [Проводник файлов]            │
│                                                               │
│ (активна первая вкладка)                                      │
│ 1. В правом верхнем углу представления Projects Plus          │
│    нажмите Новый.                                             │
│ 2. Нажмите Новый проект.                                     │
└───────────────────────────────────────────────────────────────┘
```

У пользователя есть две целевые действия: «Создать новый проект» и «Попробовать демо-проект». Ещё три вкладки и ссылка `front matter` — справочные действия.

Переключение вкладок меняет только нижний текст:

```text
[Проводник файлов]
1. Щёлкните правой кнопкой по папке в Проводнике файлов.
2. Нажмите Создать проект в папке.

[Палитра команд]
1. Откройте Палитру команд.
2. Найдите Создать новый проект
3. Нажмите Enter.
```

### ОТКУДА

- Разметка, обе CTA, tooltip и вкладки: [Onboarding.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/Onboarding.svelte:19).
- Первая вкладка активна по умолчанию: [TabContainer.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/TabContainer.svelte:4).
- Фактические русские строки: [ru.json](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/ru.json:1717).

### ДЕЙСТВИЕ

Нажать одну из двух CTA.

### ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ

Нажатие вызывает callback и закрывает модалку немедленно: [onboardingModal.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/onboardingModal.ts:20). Нет ни кнопки «Отмена», ни индикатора выполнения.

### РАЗРЫВ

Нет разрыва в тексте onboarding, но после «Попробовать демо-проект» модалка исчезает до окончания асинхронного создания.

## 2. Ветка «Попробовать демо-проект»: промежуточное состояние

### ЭКРАН

```text
┌──────────────────────────────────────────────┐
│ [навигационная панель без проекта]            │
├──────────────────────────────────────────────┤
│                                              │
│      (нет loading, progress, success, error) │
│                                              │
└──────────────────────────────────────────────┘
```

### ОТКУДА

- CTA закрывает onboarding сразу: [onboardingModal.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/onboardingModal.ts:24).
- Создание запускается без `await`: [App.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:187).
- Пока `project` отсутствует, контент отсутствует: [App.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:296).

### ДЕЙСТВИЕ

Ждать; пользовательского контроля отмены или повтора нет.

### ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ

Создаётся корневая папка `Projects Plus - Демо`, затем последовательно пишутся 29 заметок: 6 клиентов, 8 проектов, 10 задач и 5 встреч. У каждой — YAML frontmatter и Markdown-тело. [demoProject.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/demoProject.ts:33), [demoProject.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/demoProject.ts:118), [demoProject.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/demoProject.ts:458), [demoProject.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/demoProject.ts:474).

### РАЗРЫВ

CTA и tooltip обещают создание демо-проекта, но не сообщают состояние или исход. Ошибки создания папки и каждого файла перехватываются молча; затем проект всё равно регистрируется. [demoProject.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/demoProject.ts:462), [demoProject.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/demoProject.ts:475).

## 3. Первый видимый результат demo

### ЭКРАН

```text
┌ [Обзор*] [Pipeline] [График] [Клиенты] [Портфолио] ───── [+] […] ┐
│ Виджеты | Схема | Формулы | + Добавить                           │
├─────────────────────────────────────────────────────────────────┤
│ Студия в цифрах                                                  │
│ [Клиентов: 6] [Проектов: 8] [Открытых задач: 9] [MRR (sum): $42,000] │
├─────────────────────────────────────────────────────────────────┤
│ Проекты по статусу              │ Приоритетные задачи            │
│ кольцевая диаграмма:             │ таблица незавершённых задач    │
│ planning 2; inProgress 3;        │ с полями проекта               │
│ review 1; done 2                │                                │
├─────────────────────────────────────────────────────────────────┤
│ Встречи: таблица 5 встреч                                        │
├─────────────────────────────────────────────────────────────────┤
│ Клиенты (мастер связи)         │ Проекты клиента (связанный блок)│
│ таблица 6 клиентов              │ таблица проектов               │
└─────────────────────────────────────────────────────────────────┘
```

`Демо-проект` намеренно не показывается в navbar, хотя это единственный проект: [CompactNavBar.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/Navigation/CompactNavBar.svelte:21).

Пять созданных представлений — именно вкладки, а не пять автоматически открытых окон:

1. `Обзор` — dashboard;
2. `Pipeline` — board;
3. `График` — calendar;
4. `Клиенты` — dashboard;
5. `Портфолио` — gallery.

Активным становится первое, потому что `App` выбирает первый view при отсутствии `viewId`: [App.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:70).

### ОТКУДА

- Регистрация проекта и все пять view: [demoProject.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/demoProject.ts:567).
- Вкладки с названиями: [ViewSwitcher.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/Navigation/ViewSwitcher.svelte:179).
- Шесть блоков «Обзора»: [demoProject.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/demoProject.ts:268).
- Рендер карточек Stats: [StatsWidget.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Stats/StatsWidget.svelte:86).
- Оболочка и заголовок каждого блока: [WidgetHost.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetHost.svelte:149).

### ДЕЙСТВИЕ

Выбрать вкладку либо работать с уже заполненным «Обзором».

### ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ

В settings добавляется один проект с UUID, folder-source и пятью конфигурациями views; подписка settings асинхронно вызывает `saveData`. [demoProject.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/demoProject.ts:568), [main.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/main.ts:357). Файлы заметок и settings — разные записи.

### РАЗРЫВ

Комментарий говорит о «трёх vertical subfolders», но функция не создаёт их: в записи есть только `Projects Plus - Демо` и 29 файлов непосредственно в ней. [App.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:189), [demoProject.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/demoProject.ts:474).

## 4. Ветка «Создать новый проект»

### ЭКРАН

```text
┌ Создать новый проект ───────────────────────────────────────────┐
│ Название            [Безымянный проект]                         │
│ По умолчанию        [выключатель: выкл.]                        │
│ Источник данных     [Папка ▾]                                   │
│ Путь                [ / ]                                       │
│                     Путь к папке проекта. Оставьте пустым для   │
│                     корневой папки.                             │
│ Включить подпапки   [выключатель: выкл.]                        │
│                                                                  │
│ ▸ Дополнительные источники данных                               │
│ ▸ Дополнительные настройки                                      │
│                                                                  │
│                                      [Создать проект]            │
└──────────────────────────────────────────────────────────────────┘
```

Обязательное фактически только имя: кнопка становится disabled, если поле пустое или совпадает с существующим проектом; обязательной звёздочки нет. `Путь` может оставаться пустым и означает корень vault.

Ошибка имени:

```text
Название [                     ]  ← ошибка
Название проекта не может быть пустым.

или

Проект с таким именем уже существует.
```

### ОТКУДА

- Модалка и её закрытие после `onSave`: [createProjectModal.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/createProjectModal.ts:19).
- Основные поля и переключатели: [CreateProject.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateProject.svelte:466).
- Проверка имени и disabled CTA: [CreateProject.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateProject.svelte:234), [CreateProject.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateProject.svelte:1015).
- Начальные значения: [dataApi.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/dataApi.ts:307), [settings.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/settings/settings.ts:28).
- Фактические русские подписи и ошибки: [ru.json](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/ru.json:87).

### ДЕЙСТВИЕ

Оставить или изменить имя, при необходимости выбрать folder/tag/Dataview/query, затем нажать «Создать проект».

### ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ

Создаётся только настройка проекта: UUID, folder-source и один view `Дашборд` с пустой конфигурацией. Новая папка и новые заметки не создаются. [dataApi.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/dataApi.ts:307). Настройка попадает в `saveData`; содержимое vault не меняется.

### РАЗРЫВ

В модалке нет подсказки, что «Создать проект» не создаёт ни папку, ни первую заметку, а пустой путь охватывает весь vault. Это следует только из defaults и `createProject()`.

## 5. Первый dashboard созданного проекта: пустой canvas

### ЭКРАН

```text
┌ Виджеты | Схема | Формулы ──────────────────────────────────────┐
│                                                                  │
│                         ▦                                       │
│                    Пустой холст                                 │
│   Начните с блока данных или выберите готовый шаблон             │
│                                                                  │
│ [Добавить блок данных]                                           │
│ [База данных V2 — старт] [Финансовый обзор] [Дашборд]            │
│ [Аналитика] [Канбан+] [Фитнес — журнал тренировок]               │
│ [Финансы — учёт] [CRM — клиенты]                                 │
└──────────────────────────────────────────────────────────────────┘
```

### ОТКУДА

- Zero-state и CTA: [WidgetGrid.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/WidgetGrid.svelte:56).
- Восемь шаблонов: [widgetTemplates.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgetTemplates.ts:38).
- Фактические русские строки zero-state и шаблонов: [ru.json](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/ru.json:1063).
- Верхняя панель: [DashboardToolbar.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/DashboardToolbar.svelte:22).

### ДЕЙСТВИЕ

Нажать «Добавить блок данных» либо применить один шаблон.

### ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ

Любое из этих действий изменяет config активного view; настройки затем сохраняются. Добавление одного блока создаёт только конфигурацию виджета, не заметку. [dashboardWidgets.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardWidgets.ts:48).

### РАЗРЫВ

Нет разрыва в zero-state.

## 6. Где появляется strip «умных подсказок»

На пустом canvas strip отсутствует всегда, даже если источник уже содержит числовые поля или связи:

```text
Пустой холст
…шаблоны…
(нет строки «Найдено числовое поле…»)
```

После добавления хотя бы одного виджета, при наличии числового поля и отсутствии блока Stats, появляется:

```text
💡 Найдено числовое поле «<имя поля>» —
   показать Stats-блок с суммой и средним?
   [Добавить Stats] [Не предлагать снова] [×]
```

Либо для relation:

```text
💡 Найдено поле-связь «<имя поля>» —
   показать связанные записи в связанном блоке данных?
   [Добавить блок данных] [Не предлагать снова] [×]
```

### ОТКУДА

- Условие `widgets.length > 0`: [DashboardCanvas.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/DashboardCanvas.svelte:170).
- Явное правило «не рендерить на пустом canvas»: [SmartSuggestionBus.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/SmartSuggestionBus.svelte:5).
- Точные строки и действия: [SmartSuggestionBus.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/SmartSuggestionBus.svelte:40), [ru.json](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/ru.json:1158).
- Правила eligibility: [smartSuggest.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/smartSuggest.ts:44).

### РАЗРЫВ

Причина отсутствия strip на пустом canvas не объясняется на экране; она видна только в коде.

## 7. Уже есть папка с заметками, но проекта нет

### ЭКРАН / ПУТЬ

Onboarding не даёт отдельной CTA «превратить папку в базу». Нужный путь спрятан во вкладке «Проводник файлов», затем в контекстном меню Obsidian:

```text
Проводник файлов → ПКМ по папке
└─ Создать проект в папке
   └─ «Создать новый проект»
      Название: [имя выбранной папки]
      Источник данных: [Папка]
      Путь: [полный путь выбранной папки]
      Включить подпапки: [выкл.]
      [Создать проект]
```

### ОТКУДА

- Инструкция onboarding: [Onboarding.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/Onboarding.svelte:60).
- Контекстное меню и подпись: [main.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/main.ts:119), [ru.json](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/ru.json:67).
- Prefill имени и path: [main.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/main.ts:131).

### ДЕЙСТВИЕ

ПКМ именно по папке → «Создать проект в папке» → «Создать проект».

### ЧТО ПРОИСХОДИТ НА САМОМ ДЕЛЕ

Существующие заметки не конвертируются и не переписываются: в settings лишь появляется folder-source с выбранным `path`; затем dashboard читает уже существующие заметки.

### РАЗРЫВ

Путь существует, но фраза «превратить папку в базу» нигде не показана. Onboarding сообщает его только как вторичную инструкцию на вкладке, а не как действие главного экрана.

## ЧЕГО НЕ ВИДНО

- У demo нет UI-статуса выполнения, количества успешно созданных файлов или списка пропущенных/не записавшихся заметок.
- Пользователь не видит, что demo-register происходит даже после ошибок `createFolder`/`vault.create`.
- Не видно, что пять demo view создаются как конфигурации, а не «открываются» пятью экранами.
- В «Создать проект» не видно, что запись затронет только plugin settings, не создаст папку и не изменит Markdown.
- Не видно, что пустой `Путь` означает весь vault.
- Не видно, почему smart-suggestion отсутствует: это может быть пустой canvas, отсутствие подходящих полей, уже имеющийся Stats/linked block или ранее сохранённое отключение подсказки.

Codex session ID: 01a04220-647d-7212-9218-57f52410e710
Resume in Codex: codex resume 01a04220-647d-7212-9218-57f52410e710
