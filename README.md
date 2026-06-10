# OBS Projects Plus

<div align="center">

![Version](https://img.shields.io/badge/version-3.5.1--alpha-orange.svg)
![Obsidian](https://img.shields.io/badge/Obsidian-v1.5.7+-purple.svg)
![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)
[![Downloads](https://img.shields.io/github/downloads/ParkPavel/obs-projects-plus/total.svg)](https://github.com/ParkPavel/obs-projects-plus/releases)
[![Telegram](https://img.shields.io/badge/Telegram-Channel-blue.svg?logo=telegram)](https://t.me/parkpavel_chigon)

**База данных из ваших Markdown-файлов: таблицы, канбан, календарь, галерея, интерактивный Dashboard**

[English](README-EN.md) | Русский

</div>

---

> **Статус: Alpha (3.5.1-alpha) — активная разработка**
>
> Основные представления (Таблица, Доска, Календарь, Галерея) стабильны.
> Dashboard V2 в активной разработке: фазы 0–4.5 завершены, UI-модернизация в процессе.

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
3. Вы выбираете **представление** — таблица, доска, календарь, галерея или Dashboard
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
| **Таблица** | Редактирование с сортировкой, фильтрацией, навигацией по ячейкам | Стабильно |
| **Доска** | Kanban — перетаскивание карточек, persist-колонки, Ctrl+Scroll zoom (25–200%) | Стабильно |
| **Календарь** | Timeline 07:00–22:00, мультидневные бары, 5 уровней зума (Год → День), мобильные жесты | Стабильно |
| **Галерея** | Карточки с обложками и полями из frontmatter | Стабильно |
| **Dashboard** | Интерактивный мульти-блочный канвас с реактивными связями между блоками | Alpha |

**Календарь** — полноценный планировщик: поля `startDate`, `endDate`, `startTime`, `endTime`, `date`, `color`, бесконечный скролл, мобильные жесты (свайп, pinch-to-zoom, двойной тап для создания заметки).

**Agenda 2.0** — боковая панель календаря: 42 оператора фильтрации, вложенные AND/OR группы, формулы дат (`today`, `sow`, `eom`, `today+1w`), визуальный и Advanced режимы.

**Доска** — persist-колонки: остаются видимыми даже без записей; создание заметок с наследованием фильтров.

**Dashboard V2** — мульти-блочный интерактивный канвас:

- **Canvas Selection Bus** — клик на запись в одном блоке реактивно фильтрует данные в связанных блоках
- **Многовыборная фильтрация** — оператор `is-any-of`, множественные записи как фильтр
- **Блок данных (`database-call`)** — автономный атом: Таблица / Доска / Календарь / Галерея в одном блоке со своим источником
- **Связанные блоки** — выбрал клиента в блоке A → блоки B, C, D автоматически показывают его данные
- **Единый FilterPanel** — одинаковое UI фильтрации на всех уровнях (проект / вью / виджет)
- **115+ формульных функций** с визуальным конструктором
- **Матрёшка** (sub-bases) — база данных внутри базы данных через wikilink-связи
- **Dataview-мост** — Dataview-запрос как источник данных для любого блока

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

1. При первом включении плагин создаёт **демо-проект** (B2B агентство: клиенты, задачи, встречи, 5 видов)
2. `Ctrl/Cmd+P` → *"Projects Plus: Show projects plus"*
3. Попробуйте переключать виды: Таблица → Доска → Календарь → Галерея → Dashboard
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

## Roadmap

| Milestone | Что входит | Статус |
|---|---|:---:|
| M-ENGINE-CLEANUP | Унификация formula engine, filter stack, ReDoS-защита | ✅ Готово |
| M-COLOR-SETTINGS | Цветовые палитры, миграция settings v4 | ✅ Готово |
| M-CANVAS-REACTIVE | Реактивный loop Dashboard, DataProvider Registry | ✅ Готово |
| M-TABLE-REWRITE | Dashboard DataTable с виртуализацией и group headers | ✅ Готово |
| M-SUBBASES | Sub-base canvas (Матрёшка), двунаправленные связи | ✅ Готово |
| M-FREE-CANVAS | FreeCanvas shell, WindowShell drag/resize, layout migration | ✅ Готово |
| M-POPUP-STANDARDISATION | FloatingPopup engine, единые попапы, inline badges | ✅ Готово |
| M-INTERACTIVE-DASHBOARD | Canvas Selection Bus, cross-widget фильтрация, multi-select | ✅ Готово |
| M-DATAVIEW-BRIDGE | Dataview как adaptive query-backend с Notion-семантикой | ✅ Готово |
| M-UX | Emoji→Lucide sweep, демо-проект V2, #016 reactive fix | ✅ Готово |
| **Dashboard V2 (Phase 0–4.5)** | CI baseline, Engine→lib, Unified Filter, Canvas decompose, DatabaseCallWidget, Selection Bus | ✅ Текущая ветка |
| **M-UI-MODERNIZATION** | Токены, WidgetShell, DatabaseCall Table View, архивация V1-виджетов | 🔄 В работе |
| M-VISION-PARITY | SmartSuggest, шаблоны, прозрачность полей, canvas zero-state | 📋 Запланировано |

Полный backlog с тикетами: [docs/internal/BACKLOG.md](docs/internal/BACKLOG.md).

---

## Известные проблемы

| # | Проблема | Приоритет | Workaround |
|---|---|:---:|---|
| #004 | Счётчик строк в футере таблицы может расходиться с реальным числом записей при активных фильтрах | P1 | Сбросьте фильтры, чтобы увидеть точный счёт |

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
npm test              # Jest (134 suites / 2020 тестов)
npm run lint          # ESLint 9 + eslint-plugin-obsidianmd
npm run svelte-check  # Svelte template + type check
```

**Стек**: TypeScript strict + `exactOptionalPropertyTypes`, Svelte 3.59.2 (locked), Jest 29, esbuild.

**4-gate CI**: `build` → `test` → `lint` → `svelte-check` — все должны быть 0 ошибок.

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

Четырёхслойная Матрёшка (Shell → UI → Engine → Data). Подробнее: [docs/ARCHITECTURE_V5.md](docs/ARCHITECTURE_V5.md).

</details>

---

## Документация

| Документ | Описание |
|---|---|
| [Руководство пользователя (RU)](docs/user-guide.md) | Горячие клавиши, жесты, шаблоны, настройки |
| [User Guide (EN)](docs/user-guide-EN.md) | Full instructions in English |
| [CONTRIBUTING](CONTRIBUTING.md) | Как контрибьютить, ветвление, процесс PR |
| [Backlog / Roadmap](docs/internal/BACKLOG.md) | Тикеты #NNN по milestones, статусы |
| [Custom View API](obsidian-projects-types/README.md) | Регистрация своих view из других плагинов |
| [CHANGELOG](CHANGELOG.md) | История изменений |

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

[Apache License 2.0](LICENSE-INFO.md) © 2024–2026 Park Pavel

---

<div align="center">

**Сделано для сообщества Obsidian**

[Star](https://github.com/ParkPavel/obs-projects-plus) • [Issues](https://github.com/ParkPavel/obs-projects-plus/issues) • [Telegram](https://t.me/parkpavel_chigon)

</div>
