# Manual Testing Pipeline — OBStests vault via Obsidian REST API

> Создано: 2026-06-11 (первый полный прогон; обнаружено, что папка плагина в vault была пустой —
> протокол деплоя из tester.md ранее не выполнялся).
> Канонический исполнитель: `tester` agent (см. `.claude/agents/tester.md`, секция Deployment protocol).

Пайплайн закрывает разрыв между Jest (134+ suites, headless) и визуальной проверкой:
всё, что наблюдаемо через Obsidian Local REST API, проверяется автоматически из CLI;
остаток фиксируется в Untestable Features Report для ручного визуального прогона.

## 0. Предусловия

| Что | Где |
|---|---|
| Vault | `../OBStests/` — сосед репозитория (`C:\Users\Park\OBSv1.0\OBStests`) |
| Obsidian запущен с этим vault | иначе API недоступен — попросить пользователя открыть vault |
| Плагин **Local REST API** включён в vault | `obsidian-local-rest-api`, HTTP-порт `27123` (без TLS) |
| API-ключ | `.claude/settings.local.json` → `mcpServers.obsidian.env.OBSIDIAN_API_KEY` (gitignored — НЕ копировать ключ в коммитимые файлы) |
| PowerShell 5.1 | `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` перед чтением кириллицы; `data.json` читать с `-Encoding UTF8`, иначе mojibake |

Все запросы: заголовок `Authorization: Bearer <ключ>`.

## 1. Deploy (после каждого `npm run build`)

```powershell
Copy-Item main.js,styles.css,manifest.json ..\OBStests\.obsidian\plugins\obs-projects-plus\ -Force
```

Всегда **все три артефакта** (см. tester.md). Проверка: `Get-ChildItem` → `LastWriteTime` свежий.

## 2. Reload + verify load

```powershell
# перезагрузка Obsidian (подхватывает новый main.js)
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:27123/commands/app:reload/" -Headers $h
Start-Sleep -Seconds 8

# плагин загружен ⇔ его команды зарегистрированы
$c = Invoke-RestMethod -Uri "http://127.0.0.1:27123/commands/" -Headers $h
$c.commands | Where-Object { $_.id -like "obs-projects-plus*" }
```

**Assertion**: ≥ 11 команд `obs-projects-plus:*` (show-projects, create-project, create-note,
open-schema, add-field, toggle-visualizer-pane, open-visualizer-for-file, add-relation,
open-formula-editor, add-sub-base, create-demo-project). **0 команд = плагин не загрузился**
(пустая папка плагина, ошибка в main.js при load, или плагин выключен) — STOP, отчёт разработчику.

## 3. Smoke-сценарий: демо-проект

```powershell
# 3.1 чистое состояние: data.json не содержит проект "Демо-проект"
#     (команда отказывается перезаписывать дубликат — удалить проект и папку перед повтором)
# 3.2 создать демо через API-bridge
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:27123/commands/obs-projects-plus:create-demo-project/" -Headers $h
Start-Sleep -Seconds 4
```

**Assertions** (фактические значения прогона 2026-06-11 @ `2b9d1fd`):

| # | Проверка | Как | Ожидание |
|---|---|---|---|
| A1 | Папка демо создана | `GET /vault/` | `Projects Plus - Демо/` в списке |
| A2 | Записи сгенерированы | `GET /vault/Projects%20Plus%20-%20Демо/` | 28 `.md` файлов |
| A3 | Проект в настройках | `data.json` → `projects[]` | 1 проект, `dataSource.kind = folder`, `version: 4` |
| A4 | Вью демо | `projects[0].views` | 5 вью: Обзор(dashboard), Pipeline(board), График(calendar), Клиенты(dashboard), Портфолио(gallery) |
| A5 | Композиция дашбордов | `views[].config.widgets` | Обзор: stats + chart + 2×database-call; Клиенты: stats + data-table |
| A6 | Frontmatter записи | `GET /vault/...note.md` c `Accept: application/vnd.olrapi.note+json` | 4-param даты (`startDate`/`startTime`/`endTime`), Relation как wikilink (`client: [[Acme Studio]]`) |
| A7 | Активация вью | `POST /commands/obs-projects-plus:show-projects/` | HTTP 2xx, без зависания |

## 4. API write/read/delete roundtrip (контракт данных)

На scratch-заметке, НЕ на демо-данных:

```powershell
PUT    /vault/QA-API-roundtrip.md   (markdown c frontmatter: status, amount)
GET    /vault/QA-API-roundtrip.md   (Accept: application/vnd.olrapi.note+json) → frontmatter совпадает
DELETE /vault/QA-API-roundtrip.md
```

Проверяет канал, через который пайплайн (и пользовательские интеграции) пишут frontmatter,
читаемый плагином как DataFrame.

## 5. Untestable Features — границы API-наблюдаемости

REST API **не видит**: рендеринг Svelte-компонентов, ошибки консоли, CSS, DnD, hover/click.
`POST /commands/...` возвращает 2xx даже если вью упало при рендере.

Для каждого UI-тикета обязателен Untestable Features Report (формат в tester.md) — таблица
«Feature / Steps / Expected» для визуального прогона человеком в OBStests.

**Текущий висящий визуальный чек-лист (стек 2b9d1fd)**:

| Feature | Шаги | Ожидание |
|---|---|---|
| #065 canvas zero-state | Создать пустой dashboard-вью | EmptyState: иконка + 3 CTA (блок данных / шаблоны) |
| #059 SmartSuggest strip (relation) | Открыть демо «Клиенты» (есть Relation `client`, нет связанного database-call) | Strip «Найдено поле-связь…» с CTA + «Не предлагать снова» + × |
| #059 numeric-подавление | Открыть демо «Обзор» (stats уже есть) | numeric-strip НЕ показывается |
| #059 dismissal persist | «Не предлагать снова» → перезагрузка (Ctrl+R) | Strip не возвращается (`dismissedSuggestions` в data.json) |
| #048 native-query UI | CreateProject → источник native-query, inline WHERE | Проект создаётся, фильтр применяется |
| Темы | Переключить dark/light | Токены `--ppp-*` адаптируются, без хардкод-цветов |

## 6. Troubleshooting

| Симптом | Причина | Действие |
|---|---|---|
| 0 команд плагина при включённом плагине | Папка `plugins/obs-projects-plus/` пуста или старый main.js упал | Deploy (шаг 1) → reload (шаг 2). Именно так пайплайн впервые провалился 2026-06-11 |
| API не отвечает | Obsidian закрыт / vault другой | Попросить пользователя открыть OBStests |
| Кириллица как `Р”РµРјРѕ` | Кодировка консоли PS 5.1 | `[Console]::OutputEncoding = UTF8` + `Get-Content -Encoding UTF8` |
| `create-demo-project` → Notice о дубликате | Демо уже существует | Удалить проект из data.json и папку `Projects Plus - Демо/` (решение пользователя) |
| Connection dropped после `app:reload` | Ожидаемо — REST-сервер рестартует | `Start-Sleep 8` и повторный probe |

## 7. Definition of Done ручного прогона

- [ ] 3 артефакта задеплоены, `LastWriteTime` свежий
- [ ] `app:reload` выполнен, команды плагина зарегистрированы (≥11)
- [ ] Smoke-сценарий A1–A7 зелёный
- [ ] Roundtrip (шаг 4) зелёный
- [ ] Untestable Features Report составлен и передан пользователю
- [ ] Результат зафиксирован в CONTEXT.md (раздел открытых пунктов)
