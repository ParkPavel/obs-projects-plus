# OBS Projects Plus

<div align="center">

![Version](https://img.shields.io/badge/version-3.6.0--alpha-orange.svg)
![Obsidian](https://img.shields.io/badge/Obsidian-v1.5.7+-purple.svg)
![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)
[![Downloads](https://img.shields.io/github/downloads/ParkPavel/obs-projects-plus/total.svg)](https://github.com/ParkPavel/obs-projects-plus/releases)
[![Telegram](https://img.shields.io/badge/Telegram-Channel-blue.svg?logo=telegram)](https://t.me/parkpavel_chigon)

**База данных из ваших Markdown-файлов: таблицы, канбан, календарь, галерея, интерактивный Dashboard**

[English](README-EN.md) | Русский

</div>

---

> **Статус: alpha 3.6.0 — активная разработка**
>
> Доска, Календарь и Галерея работают стабильно: ими можно пользоваться каждый день.
> Dashboard — самая молодая часть плагина. Он уже собирается из блоков и связывает их между
> собой, но его настройки и внешний вид ещё меняются, поэтому после обновления сохранённый
> Dashboard может выглядеть иначе. Ваши заметки при этом не меняются — меняется только
> настройка представления.

---

## Зачем этот плагин?

Obsidian хранит всё в обычных Markdown-файлах. **Projects Plus** читает frontmatter ваших заметок как структурированные данные — **папка уже является базой данных**, без импорта и переноса.

Редактируете поле в таблице — оно пишется обратно в frontmatter файла. Редактируете frontmatter вручную — Dashboard обновляется немедленно. **Одна сущность в двух интерфейсах.**

### Кому подойдёт

- **Клиническим практикам** (массажисты, психологи, тренеры) — база клиентов + сеансы + динамика
- **Исследователям** — источники, заметки, дедлайны с фильтрацией и перекрёстной аналитикой
- **Менеджерам проектов** — задачи, встречи, статусы без выхода из Obsidian
- **Всем, кто ведёт базу знаний** — когда нужен визуальный обзор, а не список файлов

### Как это работает

1. Вы указываете **папку**, **тег** или **Dataview-запрос** — это "проект"
2. Плагин читает `frontmatter` (YAML-шапка) всех подходящих заметок
3. Вы выбираете **представление** — Dashboard, доска, календарь или галерея
4. Редактируете прямо в интерфейсе — плагин записывает изменения обратно в файл

**Данные остаются в ваших файлах.** Никакой проприетарной базы.

---

## Галерея

<p align="center">
  <img src="images/2026-01-27_12-23-33.png" width="15%" title="Таблица" />
  <img src="images/2026-01-27_12-23-55.png" width="15%" title="Доска" />
  <img src="images/2026-01-27_12-24-17.png" width="24%" title="Календарь" />
  <img src="images/2026-01-27_12-24-35.png" width="15%" title="Timeline" />
  <img src="images/2026-01-27_12-26-03.png" width="15%" title="Галерея" />
</p>
<p align="center">
  <img src="images/2026-01-27_12-26-43.png" width="15%" title="Agenda" />
  <img src="images/2026-01-27_12-27-29.png" width="24%" title="Фильтры" />
  <img src="images/2026-01-27_12-29-16.png" width="15%" title="Мобильная версия" />
  <img src="images/2026-01-27_12-30-02.png" width="24%" title="Настройки" />
</p>

<details>
<summary align="center"><b>Нажмите для просмотра в полном размере</b></summary>
<p align="center">
  <a href="images/2026-01-27_12-23-33.png"><img src="images/2026-01-27_12-23-33.png" width="80%" /></a>
  <a href="images/2026-01-27_12-23-55.png"><img src="images/2026-01-27_12-23-55.png" width="80%" /></a>
  <a href="images/2026-01-27_12-24-17.png"><img src="images/2026-01-27_12-24-17.png" width="80%" /></a>
  <a href="images/2026-01-27_12-24-35.png"><img src="images/2026-01-27_12-24-35.png" width="80%" /></a>
  <a href="images/2026-01-27_12-26-03.png"><img src="images/2026-01-27_12-26-03.png" width="80%" /></a>
  <a href="images/2026-01-27_12-26-43.png"><img src="images/2026-01-27_12-26-43.png" width="80%" /></a>
  <a href="images/2026-01-27_12-27-29.png"><img src="images/2026-01-27_12-27-29.png" width="80%" /></a>
  <a href="images/2026-01-27_12-29-16.png"><img src="images/2026-01-27_12-29-16.png" width="80%" /></a>
  <a href="images/2026-01-27_12-30-02.png"><img src="images/2026-01-27_12-30-02.png" width="80%" /></a>
</p>
</details>

---

## Возможности

| Представление | Что делает | Статус |
|---|---|:---:|
| **Доска** | Канбан: перетаскивание карточек, колонки остаются на месте, масштаб по `Ctrl` + колесо (25–200%) | Стабильно |
| **Календарь** | Таймлайн 07:00–22:00, многодневные полосы, 5 уровней масштаба (год → день), жесты на телефоне | Стабильно |
| **Галерея** | Карточки с обложками и полями из frontmatter | Стабильно |
| **Dashboard** | Экран из блоков: таблица, доска, календарь или галерея в отдельном блоке, связи между блоками, графики | Alpha |

**Таблица — не отдельное представление.** Она открывается как блок данных внутри Dashboard:
сортировка, фильтры, правка ячеек, итоги по столбцам и вычисляемые столбцы-формулы.

**Календарь** — полноценный планировщик: поля `startDate`, `endDate`, `startTime`, `endTime`, `date`, `color`, бесконечный скролл, мобильные жесты (свайп, pinch-to-zoom, двойной тап для создания заметки).

**Боковая панель календаря** — своя выборка задач и событий: 42 оператора фильтрации, вложенные группы И/ИЛИ, формулы дат (`today`, `sow`, `eom`, `today+1w`), простой и расширенный режимы.

**Доска** — колонки остаются на месте, даже если в них пока нет записей; новая заметка наследует активные фильтры.

**Dashboard** — один экран, собранный из нескольких блоков:

- **Блок данных** — таблица, доска, календарь или галерея со своим источником внутри одного блока
- **Связанные блоки** — выбрали клиента в одном блоке, остальные сразу показывают только его записи
- **Выбор нескольких записей** работает как фильтр для связанных блоков
- **Связи между проектами** — поле со ссылкой на заметку другого проекта. Плагин показывает,
  нашлась ссылка, не нашлась или совпала неоднозначно, умеет обратную связь и подсчёт по
  связанным записям
- **Графики и итоги** — 115 функций формул с наглядным конструктором
- **Одинаковая панель фильтров** на всех уровнях: проект, представление, блок
- **Запрос Dataview** как источник данных для любого блока

> Горячие клавиши, жесты, шаблоны и настройки — в **[Руководстве пользователя](docs/user-guide.md)**.

**Три источника данных**: папка, тег, Dataview-запрос. Шаблоны заметок, автосохранение, локализация (RU, EN, UA, ZH-CN).

---

## Установка

### BRAT (рекомендуется для alpha-версий)

1. Установите [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. В настройках BRAT добавьте: `ParkPavel/obs-projects-plus`
3. Включите плагин

### Ручная установка

1. Скачайте `main.js`, `manifest.json`, `styles.css` из [Releases](https://github.com/ParkPavel/obs-projects-plus/releases)
2. Поместите в `.obsidian/plugins/obs-projects-plus/`
3. Перезапустите Obsidian → Включите плагин

---

## Быстрый старт

1. При первом включении плагин создаёт **демо-проект** (B2B агентство: клиенты, задачи, встречи, 5 готовых представлений)
2. `Ctrl/Cmd+P` → *"Projects Plus: Show projects plus"*
3. Попробуйте переключать представления: Dashboard → Доска → Календарь → Галерея
4. Создайте свой проект: `Ctrl/Cmd+P` → *"Projects Plus: Create Project"*

```yaml
# Пример frontmatter для заметки проекта
---
title: Иван Петров
status: active
diagnosis: "L4-L5"
firstVisit: 2026-01-15
sessions: 0
client: "[[Клиент]]"
---
```

---

## Что уже готово и что дальше

### Работает и используется каждый день

- Доска, Календарь, Галерея и таблица внутри Dashboard: просмотр и правка заметок с сортировкой и фильтрами
- Один движок фильтрации на всех уровнях и понятный порядок применения фильтров
- Связи между проектами: ссылка на заметку, обратная связь, подсчёт по связанным записям
- Dashboard из блоков: связанные блоки, выбор записей, графики, формулы
- Dataview как источник данных
- Цветовые палитры, шаблоны заметок, четыре языка интерфейса

### В работе

- Оформление Dashboard: единый вид блоков, панелей и всплывающих окон
- Подсказки при создании блока и пустые состояния — чтобы с чистого экрана было понятно, что делать

### Отменено

- Sub-base canvas: виджет и модель вложенных баз удалены. Старые настройки читаются
  для совместимости, но виджет не возвращается — его роль занял блок данных внутри Dashboard

Планы и текущие задачи — в [GitHub Issues](https://github.com/ParkPavel/obs-projects-plus/issues).

---

## Известные проблемы

- **Счётчик строк в таблице.** При активных фильтрах число в нижней части таблицы может
  расходиться с реальным количеством записей. Обходной путь: сбросьте фильтры, чтобы увидеть
  точный счёт.

Нашли что-то ещё — [сообщите об этом](https://github.com/ParkPavel/obs-projects-plus/issues).

---

<details>
<summary><h2>Для разработчиков</h2></summary>

### Разработка

```bash
git clone https://github.com/ParkPavel/obs-projects-plus.git
cd obs-projects-plus
npm ci
npm run dev           # esbuild watch mode
npm run build         # tsc check + esbuild production bundle
npm test              # Jest — весь набор тестов
npm run lint          # ESLint 9 + eslint-plugin-obsidianmd
npm run svelte-check  # Svelte template + type check
```

**Стек**: TypeScript в строгом режиме, Svelte 3 (только компилятор — рантайма в бандле нет), Jest 29, esbuild.

**CI на pull request**: `build` → `test` → `lint` → `svelte-check`. Все четыре — без ошибок.

### Custom View API (экспериментальное)

Плагин поддерживает регистрацию пользовательских представлений от сторонних плагинов.

```typescript
// В вашем плагине (plugin.ts):
import { Plugin } from "obsidian";
import type { ProjectView, ProjectViewProps, DataQueryResult } from "obsidian-projects-types";

class MyCustomView extends ProjectView {
  getViewType(): string { return "my-view"; }
  getDisplayName(): string { return "My View"; }
  getIcon(): string { return "layout-grid"; }

  onOpen({ contentEl }: ProjectViewProps) {
    contentEl.createEl("h2", { text: "My Custom View" });
  }

  onData({ data }: DataQueryResult) {
    // data.fields — схема, data.records — заметки
  }

  onClose() { /* cleanup */ }
}

export default class MyPlugin extends Plugin {
  onRegisterProjectView = () => new MyCustomView();
}
```

Установите типы: `npm install --save-dev obsidian-projects-types`

> **API экспериментальное** и может измениться без предупреждения.

### Архитектура

Четыре слоя матрёшкой (Shell → UI → Engine → Data). Подробнее: [устройство кода](docs/architecture.md).

Разработка ведётся через отдельный проект [Клаудекс / Claudex](https://github.com/ParkPavel/claudex):
там живут рабочие инструкции, планы и записи сессий. В этом дереве их нет и для pull request они
не нужны — только код плагина и его документация. Прежние версии внутренних документов остались
в истории Git.

</details>

---

## Документация

Начните с [указателя документации](docs/README.md) — он ведёт к нужному разделу по задаче.

| Документ | О чём |
|---|---|
| [Руководство пользователя](docs/user-guide.md) | Горячие клавиши, жесты, шаблоны, настройки |
| [User Guide (EN)](docs/user-guide-EN.md) | Full instructions in English |
| [Коды ошибок](docs/ERROR_CODES.md) | Что означает сообщение об ошибке и что делать |
| [Устройство кода](docs/architecture.md) | Слои, правила зависимостей, куда добавлять новое |
| [CONTRIBUTING](CONTRIBUTING.md) | Как собрать, проверить и предложить изменение |
| [Custom View API](obsidian-projects-types/README.md) | Своё представление из другого плагина |
| [CHANGELOG](CHANGELOG.md) | Что изменилось и на что смотреть при обновлении |

---

## Обратная связь

- **Telegram**: [@parkpavel_chigon](https://t.me/parkpavel_chigon)
- **GitHub Issues**: [Сообщить о проблеме](https://github.com/ParkPavel/obs-projects-plus/issues)
- **GitHub Discussions**: [Обсуждения](https://github.com/ParkPavel/obs-projects-plus/discussions)

---

## Благодарности

Форк оригинального [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) от [Marcus Olsson](https://github.com/marcusolsson).  
Текущий мейнтейнер: **Park Pavel**

## Лицензия

[Apache License 2.0](LICENSE) © 2024–2026 Park Pavel. Указание авторства — [NOTICE](NOTICE).

---

<div align="center">

**Сделано для сообщества Obsidian**

[Star](https://github.com/ParkPavel/obs-projects-plus) • [Issues](https://github.com/ParkPavel/obs-projects-plus/issues) • [Telegram](https://t.me/parkpavel_chigon)

</div>
