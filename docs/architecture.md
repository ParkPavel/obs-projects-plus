# Устройство проекта

[English](architecture-EN.md)

Эта карта описывает код в репозитории и помогает найти, где реализована та или иная возможность. Сборка и проверки — в [руководстве для контрибьюторов](../CONTRIBUTING-RU.md).

## Точки входа и интерфейс

| Где | За что отвечает |
| --- | --- |
| [src/main.ts](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/main.ts) | Жизненный цикл плагина, инициализация настроек, команды и связь с Obsidian |
| [src/view.ts](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/view.ts) | Рабочая область Projects и регистрация встроенных и сторонних видов |
| [src/events.ts](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/events.ts) | Обработка событий хранилища |
| [src/managers](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/managers) | Управление командами |
| [src/ui/app](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/ui/app) | Навигация по проектам, общий интерфейс и жизненный цикл вида |
| [src/ui/views](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/ui/views) | Интерфейсы Dashboard, доски, календаря, галереи и визуализатора |
| [src/ui/tokens/tokens.css](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/ui/tokens/tokens.css) | Общие визуальные токены |

`ProjectsView.getProjectViews()` регистрирует доску, календарь, галерею и Dashboard. Ключ `database` остаётся псевдонимом Dashboard, чтобы старые сохранённые настройки находили свой вид. У панелей визуализатора своя связка с Obsidian.

Жизненный цикл стороннего вида подключён в [useView.ts](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/ui/app/useView.ts): он передаёт виду настройку, данные проекта и обратные вызовы записи. Прежде чем опираться на эту точку расширения, прочтите [справочник API](api-RU.md).

## От заметок к представлению

1. Определение проекта выбирает источник данных. [Фабрика источников](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/datasources/index.ts) создаёт источник по папке, тегу, встроенному запросу или Dataview. Dataview необязателен; фабрика сообщает, когда его нет.
2. Источник читает заметки через [абстракцию файловой системы](../src/lib/filesystem/README.md) и отдаёт [фрейм данных](../src/lib/dataframe/README.md): описания полей, записи и, если были, ошибки разбора.
3. [Хранилища Svelte](../src/lib/stores/README.md) держат реактивные данные и согласуют их обновление при изменении записей.
4. Выбранный вид отображает эти данные. Блоки Dashboard используют модули преобразований, формул, связей и агрегации для производных значений.

| Где | За что отвечает |
| --- | --- |
| [src/lib/datasources](../src/lib/datasources/README.md) | Выбор источника, запросы и объединение результатов |
| [src/lib/metadata](../src/lib/metadata/README.md) | Кодирование и разбор YAML-свойств заметки |
| [src/lib/engine](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/engine) | Фильтрация, агрегация и расчёты между проектами |
| [src/lib/dashboard-engine](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/dashboard-engine) | Преобразования Dashboard, применение формул, графики и кэши |
| [src/lib/formula](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/formula) | Разбор и вычисление формул |
| [src/lib/relations](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/relations) | Контракты связей, обратные индексы, запись связей, объявленные типы полей и свёртки ([rollupColumns.ts](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/relations/rollupColumns.ts)) |
| [src/lib/visualizer](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/visualizer) | Свойства, связи и наложения визуализатора |

**Кадры других проектов.** Блок, график или свёртка, читающие другой проект, получают его кадр через [externalFrameResolver.ts](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/externalFrameResolver.ts): объявленные типы связей, обратные ссылки и свёртки этого проекта применяются так же, как в его собственном виде. Кадры кэшируются в `App.svelte`; кэш сбрасывается при изменении файлов и при смене источника или настройки полей любого проекта. Блок с чужим источником доступен только для чтения — запись через его `ViewApi` попала бы не в тот проект.

Эти каталоги описывают ответственность, но зависимости не везде следуют строгой границе слоёв. Меняя путь, общий для нескольких видов, идите по импортам и вызывающим местам.

## Запись и хранение

Правки записей и полей проходят через [ViewApi](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/viewApi.ts) и [dataApi.ts](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/dataApi.ts): они согласуют запись в файловую систему с показанным фреймом данных. Свойства пишутся через `processFrontMatter`, а чтение-изменение-запись — через `Vault.process` по текущему содержимому файла, чтобы правка, сделанная между чтением и записью, не терялась. Часть обновлений оптимистична — видимое изменение само по себе не доказывает, что заметка записана. Путь отказа умеет вернуть прежнее значение и показать ошибку с кодом.

Схемы настроек и миграции лежат в [src/settings](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/settings). Записывающий модуль и согласование настроек — в [src/lib/settings](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/settings), связка жизненного цикла — в `src/main.ts`. Новые записи настроек ведите этим же путём, иначе потеряются проверка конфликтов и повторные попытки.

Содержимое заметок хранится в хранилище, настройка плагина — в его `data.json`. Производные значения, например результаты формул, не следует считать сохранёнными свойствами заметки.

## Ошибки и диагностика

Реестр ошибок — [errorCodes.ts](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/errors/errorCodes.ts); форматирование и журналирование лежат рядом. Двуязычный [справочник кодов](ERROR_CODES.md) объясняет, что делать пользователю с каждым кодом. Меняя подачу кода, сохраняйте его смысл.

## Границы расширения

[Пользовательские виды](api-RU.md) — экспериментальная возможность. Модули `src`, хранилища и структуры настроек — внутренние интерфейсы, а не стабильный публичный SDK. [Пакет типов](../obsidian-projects-types/README-RU.md) — отдельная поверхность совместимости, и сейчас он расходится с хостом в нескольких местах, описанных в справочнике API.

Прежде чем менять общий тип, посмотрите его потребителей и относящиеся к нему тесты. Записи источника, фильтры и результаты записи проходят через несколько видов, поэтому изменение, работающее в одном блоке, может задеть другие интерфейсы.
