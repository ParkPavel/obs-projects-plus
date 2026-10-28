# Документация / Documentation

Projects Plus представляет Markdown-заметки Obsidian как таблицы, доски, календари и
другие представления. Выберите руководство по своей задаче — каждое есть на двух языках.

Projects Plus displays Obsidian Markdown notes as tables, boards, calendars and other
views. Choose the guide that matches your task — each one exists in both languages.

[Сайт и сад идей / Website and garden of ideas](https://parkpavel.github.io/obs-projects-plus/)

## Для пользователя / For users

| Задача / Task | Русский | English |
|---|---|---|
| Установить и начать / Install and start | [Обзор](../README-RU.md) | [Overview](../README.md) |
| Работать с проектами и заметками / Work with projects and notes | [Руководство](user-guide.md) | [User guide](user-guide-EN.md) |
| Понять сообщение об ошибке / Understand an error | [Коды ошибок](ERROR_CODES.md) | [Error codes](ERROR_CODES.md) |
| Попробовать на готовых данных / Try it on ready-made data | [Демо-хранилище](../demo-vault/README.md) | [Demo vault](../demo-vault/README.md) |
| Взять шаблоны заметок / Use note templates | [Шаблоны](../templates/README.md) | [Templates](../templates/README.md) |
| Узнать, что изменилось / See what changed | [Изменения](../CHANGELOG-RU.md) | [Changelog](../CHANGELOG.md) |

## Для разработчика / For developers

| Задача / Task | Русский | English |
|---|---|---|
| Предложить изменение и соблюсти правила кода / Propose a change and follow the coding rules | [Как участвовать](../CONTRIBUTING-RU.md) | [Contributing](../CONTRIBUTING.md) |
| История стабилизации 3.7.1 / Historical 3.7.1 specification | [Историческая матрица](development-3.7.1-RU.md) | [Historical baseline](development-3.7.1.md) |
| Обновить сайт / Update the website | [Сборка сайта](site-maintenance-RU.md) | [Website maintenance](site-maintenance.md) |
| Понять устройство кода / Understand the code | [Устройство кода](architecture.md) | [Code structure](architecture-EN.md) |
| Сделать своё представление / Build a custom view | [API](api-RU.md) | [API](api.md) |
| Подключить типы из npm / Use the npm types | [obsidian-projects-types](../obsidian-projects-types/README-RU.md) | [obsidian-projects-types](../obsidian-projects-types/README.md) |
| Правила сообщества / Community rules | [Кодекс поведения](../CODE_OF_CONDUCT-RU.md) | [Code of conduct](../CODE_OF_CONDUCT.md) |

## Как устроена документация / How the documentation is organised

Каждый документ существует на двух языках: файл с базовым именем и файл с суффиксом, который
называет его язык (`-RU` или `-EN`). Четыре страницы держат оба языка внутри одного файла:
этот указатель и [коды ошибок](ERROR_CODES.md), английский текст которых берётся прямо из кода,
и две короткие страницы внутри хранилища — [демо](../demo-vault/README.md) и
[шаблоны](../templates/README.md), — где отдельный файл читателю мешает больше, чем помогает.
Парность проверяет тест `src/__tests__/R0_25_documentationPairs.test.ts`; правите один язык —
правьте и второй в том же коммите. Файлы `README.md` внутри `src/` — это заметки у кода для тех,
кто его читает, а не страницы документации, и на них правило не распространяется.

Every document exists in both languages: the file under its base name, and a file whose suffix
names its language (`-RU` or `-EN`). Four pages keep both languages in one file — this index and
the [error codes](ERROR_CODES.md), whose English text comes straight from the code, and the two
short in-vault pages, the [demo vault](../demo-vault/README.md) and the
[templates](../templates/README.md), where a separate file helps a reader less than it hinders.
`src/__tests__/R0_25_documentationPairs.test.ts` enforces the pairing; if you edit one language,
edit the other in the same commit. The `README.md` files inside `src/` are notes next to the code
for whoever reads it, not documentation pages, and the rule does not apply to them.

## Лицензия / License

[License](https://github.com/ParkPavel/obs-projects-plus/blob/main/LICENSE) and [attribution](https://github.com/ParkPavel/obs-projects-plus/blob/main/NOTICE).

Об ошибках и предложениях сообщайте в [Issues](https://github.com/ParkPavel/obs-projects-plus/issues). Прикладывайте версию плагина, версию Obsidian, устройство и шаги воспроизведения без личных данных.

Report bugs and suggestions in [Issues](https://github.com/ParkPavel/obs-projects-plus/issues). Include the plugin version, Obsidian version, device and reproduction steps without personal data.
