# OBS Projects Plus

<div align="center">

![Version](https://img.shields.io/badge/version-3.5.1--alpha-orange.svg)
![Obsidian](https://img.shields.io/badge/Obsidian-v1.5.7+-purple.svg)
![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)
[![Downloads](https://img.shields.io/github/downloads/ParkPavel/obs-projects-plus/total.svg)](https://github.com/ParkPavel/obs-projects-plus/releases)
[![Telegram](https://img.shields.io/badge/Telegram-Channel-blue.svg?logo=telegram)](https://t.me/parkpavel_chigon)

**Управление проектами в Obsidian: таблицы, доски, календарь с timeline, галерея, Dashboard**

[English](README-EN.md) | Русский

</div>

---

> **Статус: Alpha (3.5.1-alpha)**
>
> Плагин активно разрабатывается. Основные представления (Таблица, Доска, Календарь, Галерея) стабильны. Dashboard находится в финальной стадии работы.
>
> **Известная проблема (P0):** Dashboard не обновляется автоматически при изменении файлов в хранилище. Если вы отредактировали заметку — откройте Dashboard заново или переключитесь на другой вид и обратно. Исправление в работе (milestone M-CANVAS-REACTIVE).

---

## Зачем этот плагин?

Obsidian хранит всё в обычных Markdown-файлах. Это удобно для текста, но когда заметок становится десятки или сотни — сложно понять, что и в каком состоянии.

**Projects Plus** превращает папку с заметками в управляемый проект: вы видите все задачи на канбан-доске, все события на календаре, все карточки в галерее — и всё это без экспорта, без облака, прямо в вашем хранилище.

Данные **остаются в ваших файлах**. Плагин не создаёт собственную базу данных.

### Кому подойдёт

- **Контент-менеджерам** — отслеживать статус публикаций в таблице и на доске
- **Исследователям** — организовать источники, заметки и дедлайны с фильтрацией
- **Планировщикам** — видеть задачи на timeline-календаре с мультидневными событиями
- **Всем, кто ведёт базу знаний** — когда нужен визуальный обзор, а не список файлов

### Как это работает

1. Вы указываете **папку**, **тег** или **Dataview-запрос** — это "проект"
2. Плагин собирает все подходящие заметки и читает их `frontmatter` (YAML-шапка)
3. Вы выбираете **представление** — таблица, доска, календарь или галерея
4. Редактируете поля прямо в интерфейсе — плагин записывает изменения обратно в файл

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
|---------------|------------|:------:|
| **Таблица** | Редактирование с сортировкой, фильтрацией, навигацией по ячейкам | Стабильно |
| **Доска** | Kanban — перетаскивание карточек, persist-колонки, Ctrl+Scroll zoom (25–200%) | Стабильно |
| **Календарь** | Timeline 07:00–22:00, мультидневные бары, 5 уровней зума (Год → День), мобильные жесты | Стабильно |
| **Галерея** | Карточки с обложками и полями из frontmatter | Стабильно |
| **Dashboard** | Мульти-виджетный канвас: 8 типов виджетов, 10 типов диаграмм, трансформ-пайплайн, sub-базы | Alpha — см. ниже |

**Календарь** — полноценный планировщик: поля `startDate`, `endDate`, `startTime`, `endTime`, `date`, `color` для цветовой кодировки, бесконечный скролл, мобильные жесты (свайп, pinch-to-zoom, двойной тап для создания заметки).

**Agenda 2.0** — боковая панель календаря с конструктором списков: 42 оператора фильтрации, вложенные AND/OR группы, формулы дат (`today`, `sow`, `eom`, `today+1w`), два режима — визуальный и Advanced.

**Доска (Board)** — закрепление статусов (persist): колонки остаются видимыми даже без записей, Ctrl+Scroll zoom (25–200%), создание заметок с наследованием фильтров.

**Dashboard** — мульти-виджетный канвас поверх данных проекта. 8 типов виджетов (DataTable, Chart, Stats, Comparison, Checklist, ViewPort, FilterTabs, SummaryRow), каждый с независимым трансформ-пайплайном (unnest → unpivot → compute → filter → group-by → aggregate → pivot + cross-project join). Sub-базы — именованные вкладки с независимой фильтрацией. **ViewPort** встраивает Таблицу, Доску, Календарь или Галерею внутрь канваса.

> Горячие клавиши, жесты, шаблоны и настройки — в **[Руководстве пользователя](docs/user-guide.md)**.

**Три источника данных**: папка, тег, Dataview-запрос. Шаблоны заметок, автосохранение, локализация (RU, EN, UA, ZH-CN).

---

## Известные проблемы

| # | Проблема | Приоритет | Workaround |
|---|----------|:---------:|------------|
| [#016](docs/internal/BACKLOG.md) | Dashboard не обновляется автоматически при изменении файлов хранилища | **P0** | Переключитесь на другой вид и вернитесь на Dashboard, либо закройте и откройте вкладку проекта |
| #004 | Счётчик строк в футере таблицы может расходиться с реальным числом записей при активных фильтрах | P1 | Сбросьте фильтры, чтобы увидеть точный счёт |

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

1. При первом включении плагин создаёт **демо-проект** (35+ заметок, все представления)
2. `Ctrl/Cmd+P` → *"Projects Plus: Show projects plus"*
3. Попробуйте переключать виды: Таблица → Доска → Календарь → Галерея
4. Создайте свой проект: `Ctrl/Cmd+P` → *"Projects Plus: Create Project"*

```yaml
# Пример frontmatter для заметки проекта
---
title: Моя задача
status: todo
priority: high
startDate: 2026-02-15
date: 2026-02-15
endDate: 2026-02-20
startTime: "09:00"
endTime: "18:00"
color: "#4CAF50"
tags: [проект, важное]
---
```

---

## Roadmap

| Milestone | Что входит | Статус |
|-----------|-----------|:------:|
| **M-ENGINE-CLEANUP** | Унификация formula engine, filter stack, ReDoS-защита, context menu | ✅ Готово |
| **M-COLOR-SETTINGS** | Унификация цветовых палитр, миграция settings v4 | ✅ Готово |
| **M-CANVAS-REACTIVE** | Замыкание reactive loop в Dashboard (#016 P0), разбивка DashboardCanvas.svelte | 🔄 Текущий |
| **M-TABLE-REWRITE** | Удаление legacy DataGrid, современная Notion-spec таблица | Запланировано |
| **M-SUBBASES** | Sub-base canvas widget, полное UI-подключение в DashboardCanvas | Запланировано |
| **M-YAML-FORMULA-UI** | Визуальный конструктор формул, YAML-визуализатор как Dashboard-виджет | Запланировано |
| **M-DATAVIEW-BRIDGE** | Dataview как адаптивный query-backend с Notion-семантикой поверх | Планирование |

Полный backlog с тикетами: [docs/internal/BACKLOG.md](docs/internal/BACKLOG.md).

---

<details>
<summary><h2>Для разработчиков</h2></summary>

### Разработка

```bash
git clone https://github.com/ParkPavel/obs-projects-plus.git
cd obs-projects-plus
npm ci
npm run dev       # esbuild watch mode
npm run build     # tsc check + esbuild production bundle
npm test          # Jest (139 suites / 2099 тестов)
npx tsc --noEmit  # только type check
npm run lint      # ESLint 9 + eslint-plugin-obsidianmd
npm run format    # Prettier
```

**Стек**: TypeScript strict, Svelte 3.59.2 (locked), Jest 29, esbuild.

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

> **API экспериментальное** и может измениться без предупреждения. Подробнее: [obsidian-projects-types/README](obsidian-projects-types/README.md)

### Архитектура

Подробная 4-слойная архитектура, инварианты и контракты модулей: [docs/ARCHITECTURE_V5.md](docs/ARCHITECTURE_V5.md).  
Стандарты кода: [docs/CODE_STANDARDS.md](docs/CODE_STANDARDS.md).  
Публичный API: [docs/api.md](docs/api.md).

</details>

---

## Документация

| Документ | Описание |
|----------|----------|
| [Руководство пользователя (RU)](docs/user-guide.md) | Горячие клавиши, жесты, шаблоны, настройки |
| [User Guide (EN)](docs/user-guide-EN.md) | Full instructions in English |
| [Project Info](PROJECT-INFO.md) | Что это за проект, цели, лицензионная история |
| [Demo Vault](demo-vault/README.md) | Готовое хранилище для опробования плагина |
| [CONTRIBUTING](CONTRIBUTING.md) | Как контрибьютить, ветвление, процесс PR |
| [Архитектура V5](docs/ARCHITECTURE_V5.md) | Старт для контрибьюторов — 4-слойная архитектура, инварианты |
| [Backlog / Roadmap](docs/internal/BACKLOG.md) | Тикеты #NNN по milestones, статусы |
| [Custom View API](obsidian-projects-types/README.md) | Регистрация своих view из других плагинов |
| [CHANGELOG](CHANGELOG.md) | История изменений |
| [Releases](RELEASES.md) | Все релизы с описанием |
| [Индекс документации](docs/DOCS_INDEX.md) | Полная навигация по документам |

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
