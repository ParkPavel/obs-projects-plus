# 📋 Шаблоны Projects Plus для Calendar View

Коллекция шаблонов, оптимизированных для использования с **Calendar View** в плагине **Projects Plus** для Obsidian.

## 🚀 Быстрый старт

1. Установите плагин [Templater](https://github.com/SilentVoid13/Templater) для Obsidian
2. Скопируйте нужные шаблоны в папку шаблонов вашего хранилища
3. Настройте Templater: `Settings → Templater → Template folder location`
4. Используйте шаблоны через `Alt+E` или команду `Templater: Create new note from template`

## 🎯 Архитектурные принципы

### DataFrame Fields
Все шаблоны используют поля, совместимые с DataFrame архитектурой Projects Plus:

- **`date`** — основное поле даты (DataFieldType.Date)
- **`startDate`** — дата начала события/задачи
- **`endDate`** — дата окончания (для multi-day events)
- **`startTime`** — время начала (HH:mm, строка)
- **`endTime`** — время окончания (HH:mm, строка)
- **`color`** — цвет события (#RRGGBB, hex)
- **`status`** — статус (для Board view интеграции)
- **`tags`** — теги для DataSource фильтрации

### Calendar Config Mapping
```typescript
CalendarConfig {
  dateField: "startDate",       // Primary date для позиционирования
  endDateField: "endDate",      // Optional для multi-day spans
  startTimeField: "startTime",  // Separate time field
  endTimeField: "endTime",
  eventColorField: "color",     // Color picker integration
}
```

---

## 📁 Доступные шаблоны

### 📅 Календарь и события

| Шаблон | Назначение | Ключевые поля |
|--------|------------|---------------|
| **Calendar Event Template.md** | События в календаре | startDate, endDate, startTime, endTime, color |
| **Meeting Template.md** | Встречи с участниками | startDate, startTime, endTime, location, attendees |
| **Recurring Event Template.md** | Повторяющиеся события | recurrence, recurrence_day, skip_dates |

### ✅ Задачи и проекты

| Шаблон | Назначение | Ключевые поля |
|--------|------------|---------------|
| **Task Template.md** | Задачи проекта | startDate, dueDate, priority, status |
| **Project Template.md** | Проекты с этапами | startDate, endDate, progress, status |
| **Sprint Template.md** | Agile спринты | sprint_number, velocity_planned, goal |
| **Deadline Template.md** | Дедлайны | dueDate, dueTime, priority, reminder_days |

### 📝 Заметки и трекинг

| Шаблон | Назначение | Ключевые поля |
|--------|------------|---------------|
| **Quick Note Template.md** | Быстрые заметки | date, status |
| **Daily Note Template.md** | Ежедневные заметки | mood, energy, weather |
| **Weekly Review Template.md** | Недельные обзоры | week_number, rating |
| **Habit Tracker Template.md** | Трекер привычек | habit_type, frequency, streak |

---

## 📄 Детальное описание шаблонов

### 1. **Calendar Event Template.md**
**Назначение:** События в календаре с датами и временем

**Поля:**
- `title` — название события
- `startDate`, `endDate` — диапазон дат (YYYY-MM-DD)
- `startTime`, `endTime` — время (HH:mm, optional)
- `color` — цвет бара (suggester из 6 вариантов)
- `status` — inbox/scheduled/completed
- `tags` — event, calendar

**Использование в Calendar:**
- Отображается как цветной event bar в timeline view
- Поддерживает multi-day spans (если endDate ≠ startDate)
- Время определяет position & height бара

---

### 2. **Task Template.md**
**Назначение:** Задачи проекта с приоритетом и сроками

**Поля:**
- `title` — название задачи
- `startDate`, `dueDate` — даты (создание и дедлайн)
- `priority` — high/medium/low (emoji suggester)
- `status` — inbox/todo/in-progress/done/cancelled
- `color` — цвет по приоритету
- `tags` — task, projects

**Board Integration:**
- `status` используется для lane groups в Board view
- `color` синхронизируется между Calendar и Board

---

### 3. **Meeting Template.md**
**Назначение:** Встречи с участниками и повесткой

**Поля:**
- `title` — тема встречи
- `startDate` — дата встречи
- `startTime`, `endTime` — время (обязательно для meetings)
- `location` — место или ссылка на видеозвонок
- `attendees` — список участников
- `color` — синий (#4a9eff) по умолчанию
- `status` — scheduled/completed/cancelled

**Calendar Features:**
- Всегда отображается как timed event (не all-day)
- Место встречи показывается в event bar tooltip

---

### 4. **Project Template.md**
**Назначение:** Проекты с этапами и задачами

**Поля:**
- `title` — название проекта
- `startDate`, `endDate` — timeline проекта
- `status` — active/paused/completed/cancelled
- `progress` — процент выполнения (0-100)
- `color` — фиолетовый (#b892ff) по умолчанию

**Calendar Display:**
- Отображается как multi-day span (startDate → endDate)
- Длинные проекты (>7 дней) видны как полоски над днями
- DataView query внутри для трекинга задач

---

### 5. **Recurring Event Template.md** ⭐ NEW
**Назначение:** Повторяющиеся события (стендапы, еженедельные встречи)

**Поля:**
- `recurrence` — daily/weekly/monthly/yearly
- `recurrence_day` — день недели для еженедельных
- `recurrence_end` — дата окончания повторений
- `skip_dates` — список исключенных дат

**Особенности:**
- Шаблон создает "мастер-запись" для серии
- Интеграция с Recurrence плагином

---

### 6. **Deadline Template.md** ⭐ NEW
**Назначение:** Важные дедлайны с напоминаниями

**Поля:**
- `dueDate`, `dueTime` — точный срок
- `priority` — critical/high/medium/low
- `category` — work/study/documents/finance/personal
- `reminder_days` — за сколько дней напоминать
- `progress` — прогресс выполнения

**Agenda Integration:**
- Автоматически появляется в категории "Overdue" если просрочен
- Цветовая индикация по приоритету

---

### 7. **Sprint Template.md** ⭐ NEW
**Назначение:** Agile спринты с метриками

**Поля:**
- `sprint_number` — номер спринта
- `goal` — цель спринта
- `velocity_planned`, `velocity_actual` — story points
- DataView запросы для бэклога

**Содержит:**
- Daily Standup секции
- Sprint Review и Retrospective
- Таблица метрик

---

### 8. **Habit Tracker Template.md** ⭐ NEW
**Назначение:** Трекинг привычек

**Поля:**
- `habit_type` — morning/evening/daily/weekly
- `frequency` — частота выполнения
- `streak`, `best_streak` — серии выполнения
- `reminder_time` — время напоминания

**Визуализация:**
- Таблица недели с чекбоксами
- Статистика по месяцу

---

### 9. **Daily Note Template.md** ⭐ NEW
**Назначение:** Ежедневные заметки

**Поля:**
- `mood` — настроение (emoji)
- `energy` — уровень энергии
- `weather` — погода
- DataView запросы для задач дня

**Содержит:**
- Утренний чеклист
- Категоризированные задачи
- Вечерний обзор с благодарностями

---

### 10. **Weekly Review Template.md** ⭐ NEW
**Назначение:** Еженедельные обзоры

**Поля:**
- `week_number` — номер недели
- `rating` — оценка недели (1-5)
- DataView для выполненных задач

**Содержит:**
- Таблица метрик
- Анализ целей
- Инсайты и планы

---

## 🎨 Цветовая палитра

Все шаблоны используют единую цветовую схему:

| Цвет | Hex | Использование |
|------|-----|---------------|
| 🔴 Розовый/Красный | `#ff6b9d` | Срочное, высокий приоритет |
| 🔵 Синий | `#4a9eff` | Встречи, информация |
| 🟡 Желтый | `#ffd93d` | Предупреждения, средний приоритет |
| 🟢 Зеленый | `#6bcf7f` | Выполнено, низкий приоритет |
| 🟠 Оранжевый | `#ff8c42` | Внимание, дедлайны |
| 🟣 Фиолетовый | `#b892ff` | Проекты, спринты |
| ⚪ Серый | `#94a3b8` | Неактивное, inbox |
| 🩵 Бирюзовый | `#2dd4bf` | Личное |
| 💗 Розовый | `#f472b6` | Особое |
| 💜 Индиго | `#818cf8` | Творчество |

---

## 🔧 Генератор демо-данных

Для тестирования используйте скрипт генерации:

```bash
# Генерация 50 записей всех типов
python scripts/generate-test-files.py ./demo -n 50 --type all --realistic

# Только календарные события
python scripts/generate-test-files.py ./demo -n 20 --type calendar --with-overdue

# Задачи для Board view
python scripts/generate-test-files.py ./demo -n 30 --type board --realistic

# С просроченными и без дат
python scripts/generate-test-files.py ./demo -n 100 --type mixed --with-overdue --with-undated
```

### Параметры генератора:

| Параметр | Описание |
|----------|----------|
| `-n, --numfiles` | Количество файлов |
| `-t, --type` | Тип: all, calendar, board, table, mixed |
| `--with-overdue` | Включить просроченные |
| `--with-undated` | Включить без дат |
| `--realistic` | Реалистичные названия |
| `--date-range` | Диапазон дат в днях |
| `--clear` | Очистить папку перед генерацией |
| `--seed` | Seed для воспроизводимости |

---

## 📱 Совместимость с Agenda

Все шаблоны оптимизированы для отображения в Agenda sidebar:

| Категория | Условие | Шаблоны |
|-----------|---------|---------|
| **Overdue** | dueDate < today, status ≠ done | Task, Deadline |
| **All-day** | startDate = today, no time | Event, Project |
| **Today** | startDate = today, has time | Meeting, Event |
| **Multi-day** | endDate ≠ startDate | Project, Event |
| **Upcoming** | startDate > today | All with dates |
| **Undated** | no startDate/dueDate | Quick Note |

---

## 📚 Дополнительные ресурсы

- [Документация Projects Plus](../docs/user-guide.md)
- [API Reference](../docs/api.md)
- [Templater Documentation](https://silentvoid13.github.io/Templater/)
- [DataView Documentation](https://blacksmithgu.github.io/obsidian-dataview/)

---

### 5. **Quick Note Template.md**
**Назначение:** Быстрые заметки с минимальными полями

**Поля:**
- `title` — тема заметки
- `startDate` — дата создания (= date)
- `color` — зеленый (#6bcf7f) по умолчанию
- `status` — active
- `tags` — note, notepad

**Use Case:**
- Для daily journal entries
- Для идей, привязанных к дате
- Минимальный frontmatter

---

## 🚀 Установка и использование

### Требования:
1. **Templater Plugin** — для dynamic prompts (`tp.system.prompt`, `tp.system.suggester`)
2. **Projects Plus v3.0+** — для Calendar View с timeline

### Настройка:
1. Скопировать все `.md` файлы в папку `templates/` вашего vault
2. В настройках Projects Plus:
   ```
   Project Settings > Templates
   > Add folder: "templates"
   ```
3. В Calendar View config:
   ```typescript
   dateField: "startDate"
   endDateField: "endDate"
   startTimeField: "startTime"
   endTimeField: "endTime"
   eventColorField: "color"
   ```

### Создание заметки из Calendar:
1. **Double-click** на день в Calendar View
2. Выберите шаблон из dropdown (CreateNoteModal)
3. Заполните Templater prompts
4. Заметка появится в Calendar с правильными датами

---

## 🎨 Цветовая схема

### Default Colors:
- 🔴 **#ff6b9d** — Розовый (высокий приоритет, важные события)
- 🔵 **#4a9eff** — Синий (встречи, стандартные события)
- 🟡 **#ffd93d** — Желтый (предупреждения, дедлайны)
- 🟢 **#6bcf7f** — Зеленый (заметки, завершенные задачи)
- 🟠 **#ff8c42** — Оранжевый (средний приоритет)
- 🟣 **#b892ff** — Фиолетовый (проекты, долгосрочные планы)

### Board Lane Colors:
Если используется Board view, цвета автоматически синхронизируются через `getRecordColor` prop.

---

## 🔄 DataFrame Flow

```
User: Double-click Calendar day
    ↓
CreateNoteModal opens
    ↓
User: Selects "Calendar Event Template.md"
    ↓
Templater: Executes prompts (tp.system.prompt)
    ↓
New file created: "Projects/Events/Meeting with Team.md"
    ↓
DataSource scans folder → parses frontmatter
    ↓
DataFrame.records += new DataRecord {
  id: "Projects/Events/Meeting with Team.md",
  values: {
    title: "Meeting with Team",
    startDate: Date("2026-01-15"),
    startTime: "14:00",
    endTime: "15:00",
    color: "#4a9eff"
  }
}
    ↓
CalendarDataProcessor.process()
    ↓
ProcessedRecord {
  startDate: dayjs("2026-01-15 14:00"),
  endDate: dayjs("2026-01-15 15:00"),
  timeInfo: { start: "14:00", end: "15:00" },
  color: "#4a9eff"
}
    ↓
Calendar View renders event bar at 14:00 (height: 1 hour)
```

---

## 📚 Дополнительные ресурсы

- **Templater Docs**: [Templater User Documentation](https://silentvoid13.github.io/Templater/)
- **Projects Plus Architecture**: `internal_docs/CALENDAR_ARCHITECTURE.md`
- **DataFrame Schema**: `src/lib/dataframe/dataframe.ts`
- **Calendar Config**: `src/ui/views/Calendar/types.ts`

---

## 🛠️ Кастомизация

### Добавить свое поле:
1. Добавить в frontmatter шаблона:
   ```yaml
   customField: <% tp.system.prompt("Custom value:") %>
   ```
2. В Project settings добавить field:
   ```typescript
   { 
     name: "customField", 
     type: DataFieldType.String 
   }
   ```
3. Поле появится в Table/Board views автоматически

### Изменить цвета:
Отредактировать `tp.system.suggester` в Calendar Event Template:
```javascript
tp.system.suggester(
  ["Мой цвет 1", "Мой цвет 2"],
  ["#custom1", "#custom2"],
  false,
  "Выберите цвет:"
)
```

---

**Автор**: GitHub Copilot  
**Дата**: 2026-01-01  
**Версия**: 1.0 — совместимо с Projects Plus v3.0 Calendar Architecture
