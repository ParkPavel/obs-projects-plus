# Как участвовать в Projects Plus

> Русский · [English](CONTRIBUTING.md)

Спасибо за интерес к проекту! Projects Plus — форк плагина
[Obsidian Projects](https://github.com/marcusolsson/obsidian-projects), который поддерживается
сообществом.

Этот документ — вход для разработчика. Перед тем как открывать непростой pull request, прочтите
ещё два:

- [docs/architecture.md](docs/architecture.md) — как устроен код: слои, правила зависимостей, куда что добавлять
- [docs/CODE_STANDARDS-RU.md](docs/CODE_STANDARDS-RU.md) — правила кода и требования безопасности

Запланированная и текущая работа видна в
[GitHub Issues](https://github.com/ParkPavel/obs-projects-plus/issues) и
[Pull Requests](https://github.com/ParkPavel/obs-projects-plus/pulls) — заглядывайте туда, прежде
чем браться за большое, чтобы две правки не столкнулись. Повседневная разработка ведётся через
[Клаудекс / Claudex](https://github.com/ParkPavel/claudex), который живёт вне этого репозитория:
внутренние планы, записи сессий и инструкции для агентов не входят в это дерево, и для pull request
они не нужны.

---

## Быстрый старт

```bash
git clone https://github.com/ParkPavel/obs-projects-plus.git
cd obs-projects-plus
npm ci
npm run dev       # пересборка esbuild на каждое сохранение
```

Скопируйте собранные файлы в тестовое хранилище — публикуемый плагин состоит ровно из этих трёх:

```powershell
# Windows PowerShell
Copy-Item main.js, manifest.json, styles.css "$env:USERPROFILE\your-vault\.obsidian\plugins\obs-projects-plus\"
```

```bash
# macOS / Linux
cp main.js manifest.json styles.css ~/your-vault/.obsidian/plugins/obs-projects-plus/
```

Перезагрузите Obsidian (`Ctrl/Cmd+R`), чтобы подхватить новую сборку.

---

## Стек (сверено с `package.json`)

| Слой | Инструмент | Версия |
|---|---|---|
| Язык | TypeScript (строгий режим) | по `tsconfig.json` |
| Интерфейс | Svelte | 3.59.2 (только компилятор — рантайма Svelte в `main.js` нет) |
| Сборщик | esbuild | через [esbuild.config.mjs](esbuild.config.mjs) |
| Тесты | Jest | 29 + jsdom |
| Линтер | ESLint | 9 (flat config) |
| Правила Obsidian | `eslint-plugin-obsidianmd` | 0.1.9 |
| Форматирование | Prettier | `npm run format` |
| Локализация | i18next | 4 языка: en, ru, uk, zh-CN |
| Цель сборки | ES2016 | вывод CJS (требование плагинов Obsidian) |

---

## Команды

| Команда | Зачем |
|---|---|
| `npm run dev` | пересборка на каждое сохранение |
| `npm run build` | `tsc -noEmit -skipLibCheck && esbuild production` (обязательна до PR) |
| `npm run test` | Jest — должен пройти весь набор |
| `npm run test:watch` | Jest в режиме наблюдения |
| `npm run test:coverage` | отчёт о покрытии |
| `npm run lint` | ESLint с правилами Obsidian |
| `npm run format` | Prettier (`prettier -w ./src`) |
| `npm run svelte-check` | проверка типов в Svelte-шаблонах |
| `npm run quality:check` | покрытие + сборка + линт одной командой |

---

## Структура проекта

**Карта кода — [docs/architecture.md](docs/architecture.md).** Там перечислено, что лежит внутри
`src/`, четыре слоя (Shell → UI → Engine → Data), правила зависимостей между ними и адреса, куда
добавлять новый виджет, график, источник данных, функцию формул, код ошибки или язык.

Этот файл карту не дублирует — прочтите раздел «Слои» перед непростым pull request.

---

## Правила кода (главное)

Подробности — [docs/CODE_STANDARDS-RU.md](docs/CODE_STANDARDS-RU.md). Жёсткие правила:

### Нельзя

- **`innerHTML`** — только `createEl()`, `createSpan()`, `setIcon()`, `el.empty()`.
- **`document.*`** — только `activeDocument`, иначе плагин ломается в отдельном окне.
- **`vault.modify()` для frontmatter** — только `fileManager.processFrontMatter()`.
- **`console.log` в рабочем коде** — уберите до PR.
- **`@ts-ignore`** — используйте `@ts-expect-error` с пояснением или поправьте тип.
- **`new RegExp(userInput)` напрямую** — через [src/lib/helpers/regexSafety.ts](src/lib/helpers/regexSafety.ts).
- **`JSON.parse` пользовательских данных без защиты** — всегда try/catch и проверка формы.

### Стоит

- Использовать CSS-переменные Obsidian (`--text-error`, `--background-modifier-hover` и другие)
  вместо зашитых цветов.
- Задавать размеры в `rem` или токенах; пиксели допустимы только на границе с библиотеками
  графиков.
- Добавлять тесты на новую логику (операторы фильтра, разборщики, помощники, части движка).
- Держать переводы в согласии: [src/lib/stores/translations/](src/lib/stores/translations/)
  (`en.json`, `ru.json`, `uk.json`, `zh-CN.json`).

---

## Процесс pull request

1. **Сделайте fork** и ветку от `main`.
2. Коммиты — небольшие и осмысленные.
3. Прогоните проверки локально:
   ```bash
   npm run build         # обязана пройти (tsc + esbuild)
   npm run test          # должен пройти весь набор
   npm run lint          # 0 ошибок
   npm run svelte-check  # 0 ошибок
   ```
4. Обновите документацию, если меняется видимое поведение или публичный контракт.
5. Откройте PR с понятным описанием: *что* изменилось и *почему*.

### Чек-лист PR

- [ ] `npm run build` проходит
- [ ] `npm run test` — проходит весь набор
- [ ] `npm run lint` — 0 ошибок
- [ ] `npm run svelte-check` — 0 ошибок
- [ ] Нет `console.log`, `innerHTML`, `document.*`, `@ts-ignore`
- [ ] Переводы обновлены (если менялся текст интерфейса)
- [ ] Документация обновлена, **на двух языках** (если менялось поведение или контракт)
- [ ] Запись в `CHANGELOG.md` и `CHANGELOG-RU.md` в разделе «Не выпущено» / `## Unreleased`

---

## Переводы интерфейса

Плагин поддерживает четыре языка: **EN**, **RU**, **UK**, **ZH-CN**. Файлы переводов —
в [src/lib/stores/translations/](src/lib/stores/translations/).

Чтобы добавить или поправить перевод:

1. Добавьте ключи в `en.json` — это источник.
2. Повторите их в `ru.json`, `uk.json`, `zh-CN.json`.
3. Запустите `node scripts/sync-translations.mjs`, чтобы найти пропущенные ключи.
4. Запустите `npm run build` и убедитесь, что ничего не сломалось.

---

## Документация парная

У каждого документа есть версия на двух языках: файл с базовым именем и файл с суффиксом,
который называет язык (`-RU` или `-EN`). Двуязычные страницы — указатель `docs/README.md`
и таблица кодов ошибок `docs/ERROR_CODES.md` — держат оба языка внутри одного файла, потому что
их английский текст берётся прямо из кода.

Парность проверяет тест `src/__tests__/R0_25_documentationPairs.test.ts`: если появится документ
на одном языке, проверка упадёт. Правите один язык — правьте и второй в том же коммите.

---

## Сообщить о проблеме

Через [GitHub Issues](https://github.com/ParkPavel/obs-projects-plus/issues). Пожалуйста, укажите:

- версию Obsidian и версию плагина
- шаги воспроизведения
- ожидаемое и фактическое поведение
- снимки экрана или запись, если это уместно
- мобильный или настольный клиент и операционную систему

---

## Что читать дальше

| Тема | Документ |
|---|---|
| Карта кода (начните здесь) | [docs/architecture.md](docs/architecture.md) |
| Правила кода и безопасность | [docs/CODE_STANDARDS-RU.md](docs/CODE_STANDARDS-RU.md) |
| API своих представлений | [docs/api-RU.md](docs/api-RU.md) |
| Коды ошибок, которые видит пользователь | [docs/ERROR_CODES.md](docs/ERROR_CODES.md) |
| Что плагин умеет со стороны пользователя | [docs/user-guide.md](docs/user-guide.md) |

---

## Лицензия

Отправляя изменения, вы соглашаетесь, что они распространяются под
[Apache License 2.0](LICENSE).

## Благодарности

Форк оригинального [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects)
от [Marcus Olsson](https://github.com/marcusolsson).
Текущий мейнтейнер: **Park Pavel**.
