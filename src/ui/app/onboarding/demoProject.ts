import dayjs from "dayjs";
import { normalizePath, stringifyYaml, type Vault } from "obsidian";
import { v4 as uuidv4 } from "uuid";

import { settings } from "src/lib/stores/settings";
import type { BoardConfig } from "src/ui/views/Board/types";
import type { CalendarConfig } from "src/ui/views/Calendar/types";
import type { GalleryConfig } from "src/ui/views/Gallery/types";
import type { TableConfig } from "src/ui/views/Table/types";
import { DEFAULT_PROJECT, DEFAULT_VIEW } from "src/settings/settings";
import type { ColorRule, FilterCondition } from "src/settings/base/settings";
import type { AgendaConfig, AgendaCustomList } from "src/settings/v3/settings";

// ============================================================
// 🎯 PROJECTS PLUS - ДЕМОНСТРАЦИОННЫЙ ПРОЕКТ v3.0
// 
// Цели демо-проекта:
// 1. Показать ВСЕ возможности плагина
// 2. Продемонстрировать различные сценарии использования
// 3. Обучить пользователя работе с разными типами данных
// 4. Показать работу всех 4 представлений (Table, Board, Calendar, Gallery)
// 5. Продемонстрировать фильтры, сортировку и цветовые правила
// ============================================================

// ============================================================
// ШАБЛОНЫ КОНТЕНТА ЗАМЕТОК
// Богатый контент для реалистичного опыта
// ============================================================

const taskContent = (title: string, description: string, checklist: string[]) => `
## 📋 ${title}

### Описание
${description}

### Чеклист
${checklist.map(item => `- [ ] ${item}`).join('\n')}

### Заметки
*Добавьте свои заметки здесь...*

---
*Создано с Projects Plus*
`;

const eventContent = (title: string, details: string) => `
## 📅 ${title}

### Детали события
${details}

### Подготовка
- [ ] Проверить оборудование
- [ ] Подготовить материалы
- [ ] Отправить напоминание участникам

### Заметки после события
*Заполните после завершения...*

---
`;

const meetingContent = (title: string, attendees: string[], agenda: string[]) => `
## 🤝 ${title}

### 👥 Участники
${attendees.map(a => `- ${a}`).join('\n')}

### 📌 Повестка
${agenda.map((item, i) => `${i + 1}. ${item}`).join('\n')}

### 🎯 Решения
*Заполните во время встречи...*

### 📝 Следующие шаги
| Задача | Ответственный | Срок |
|--------|---------------|------|
| | | |

---
`;

const projectContent = (title: string, goals: string[], milestones: string[]) => `
## 🎯 ${title}

### Цели проекта
${goals.map(g => `- ${g}`).join('\n')}

### Этапы
${milestones.map((m, i) => `${i + 1}. ${m}`).join('\n')}

### Прогресс
\`\`\`
[████████░░░░░░░░░░░░] 40%
\`\`\`

### Риски
| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| | | | |

---
`;

const ideaContent = (title: string) => `
## 💡 ${title}

### Суть идеи
*Опишите идею подробнее...*

### Преимущества
- 🚀 Быстро и эффективно
- 🔒 Безопасно
- 🎨 Красивый интерфейс

### Ресурсы
- [[Связанные заметки]]
- [Внешние ссылки](https://example.com)

### Следующие шаги
1. Исследование
2. Прототип
3. Тестирование

---
`;

const dailyContent = (date: string, mood: string) => `
## 📔 Дневник: ${date}

### Настроение: ${mood}

### 🌟 Главное за день
*Что важного произошло?*

### ✅ Выполнено
- [ ] Задача 1
- [ ] Задача 2

### 💭 Мысли
*Записи и размышления...*

### 🙏 Благодарности
1. 
2. 
3. 

---
`;

const galleryContent = (title: string, description: string) => `
## 🖼️ ${title}

### Описание
${description}

### Детали
- **Дата создания**: 
- **Категория**: 
- **Теги**: 

### Заметки
*Дополнительная информация...*

---
`;

export async function createDemoProject(vault: Vault) {
  const demoFolder = "Projects Plus - Демо";

  await vault.createFolder(demoFolder);

  const today = dayjs();

  // ============================================================
  // 🎯 КОМПЛЕКСНЫЙ ДЕМОНСТРАЦИОННЫЙ НАБОР ДАННЫХ
  // 
  // Категории заметок:
  // 1. 📅 КАЛЕНДАРЬ - события с датами и временем
  // 2. 📋 ЗАДАЧИ - с приоритетами и статусами  
  // 3. 🎯 ПРОЕКТЫ - многодневные с прогрессом
  // 4. 💡 ИДЕИ - без дат, для inbox
  // 5. 📔 ДНЕВНИК - ежедневные заметки
  // 6. 🖼️ ГАЛЕРЕЯ - с обложками
  // 7. 🤝 ВСТРЕЧИ - с участниками
  // ============================================================

  interface DemoFile {
    frontmatter: Record<string, unknown>;
    content: string;
  }

  const demoFiles: Record<string, DemoFile> = {
    
    // =============================================
    // 📅 КАТЕГОРИЯ: КАЛЕНДАРНЫЕ СОБЫТИЯ
    // Демонстрация: Timeline view, timed events
    // =============================================
    
    "Утренний стендап": {
      frontmatter: {
        startDate: today.format("YYYY-MM-DD"),
        startTime: "09:00",
        endTime: "09:15",
        status: "done",
        completed: true,
        priority: "medium",
        color: "#4CAF50",
        type: "встреча",
        category: "работа",
        estimate: 0.25,
        tags: ["ежедневно", "команда"],
      },
      content: meetingContent(
        "Утренний стендап",
        ["Руководитель", "Разработчик 1", "Разработчик 2", "QA"],
        ["Что сделано вчера", "Планы на сегодня", "Блокеры"]
      ),
    },
    
    "Созвон с клиентом": {
      frontmatter: {
        startDate: today.add(1, "day").format("YYYY-MM-DD"),
        startTime: "14:00",
        endTime: "15:00",
        status: "scheduled",
        completed: false,
        priority: "high",
        color: "#FF9800",
        type: "встреча",
        category: "клиенты",
        estimate: 1,
        tags: ["клиент", "важно"],
      },
      content: meetingContent(
        "Созвон с клиентом",
        ["Менеджер проекта", "Технический лид", "Представитель клиента"],
        ["Демонстрация прогресса", "Обсуждение требований", "Следующие шаги"]
      ),
    },
    
    "Обед с командой": {
      frontmatter: {
        startDate: today.add(2, "day").format("YYYY-MM-DD"),
        startTime: "12:30",
        endTime: "13:30",
        status: "scheduled",
        completed: false,
        priority: "low",
        color: "#8BC34A",
        type: "событие",
        category: "личное",
        estimate: 1,
        tags: ["команда", "социальное"],
      },
      content: eventContent(
        "Обед с командой",
        "Неформальная встреча команды в кафе напротив офиса. Отличная возможность пообщаться в неформальной обстановке."
      ),
    },
    
    "Презентация проекта": {
      frontmatter: {
        startDate: today.add(3, "day").format("YYYY-MM-DD"),
        startTime: "10:00",
        endTime: "12:00",
        status: "scheduled",
        completed: false,
        priority: "high",
        color: "#9C27B0",
        type: "презентация",
        category: "работа",
        estimate: 2,
        tags: ["презентация", "важно"],
      },
      content: eventContent(
        "Презентация проекта руководству",
        "Демонстрация результатов квартальной работы. Необходимо подготовить слайды и демо-версию продукта."
      ),
    },
    
    "Вечерняя тренировка": {
      frontmatter: {
        startDate: today.add(1, "day").format("YYYY-MM-DD"),
        startTime: "19:00",
        endTime: "20:30",
        status: "scheduled",
        completed: false,
        priority: "medium",
        color: "#00BCD4",
        type: "спорт",
        category: "здоровье",
        estimate: 1.5,
        tags: ["спорт", "здоровье"],
      },
      content: eventContent(
        "Тренировка в зале",
        "Кардио + силовые упражнения. Не забыть взять форму и воду!"
      ),
    },

    // =============================================
    // 📋 КАТЕГОРИЯ: ЗАДАЧИ
    // Демонстрация: Board view, статусы, приоритеты
    // =============================================
    
    "Обновить документацию API": {
      frontmatter: {
        startDate: today.format("YYYY-MM-DD"),
        dueDate: today.add(3, "day").format("YYYY-MM-DD"),
        status: "doing",
        completed: false,
        priority: "high",
        color: "#2196F3",
        type: "задача",
        category: "разработка",
        estimate: 4,
        progress: 30,
        assignee: "Алексей",
        tags: ["документация", "api", "срочно"],
      },
      content: taskContent(
        "Обновить документацию API",
        "Необходимо обновить документацию после релиза версии 2.0. Добавить описание новых эндпоинтов.",
        ["Проверить текущую документацию", "Добавить новые эндпоинты", "Обновить примеры кода", "Ревью от команды"]
      ),
    },
    
    "Исправить баг авторизации": {
      frontmatter: {
        startDate: today.subtract(1, "day").format("YYYY-MM-DD"),
        dueDate: today.format("YYYY-MM-DD"),
        status: "doing",
        completed: false,
        priority: "high",
        color: "#F44336",
        type: "баг",
        category: "разработка",
        estimate: 2,
        progress: 60,
        assignee: "Мария",
        tags: ["баг", "критично", "безопасность"],
      },
      content: taskContent(
        "Исправить баг авторизации",
        "При определённых условиях токен не обновляется. Критично для безопасности!",
        ["Воспроизвести баг", "Найти причину", "Написать исправление", "Протестировать", "Деплой на прод"]
      ),
    },
    
    "Дизайн новой страницы": {
      frontmatter: {
        startDate: today.add(2, "day").format("YYYY-MM-DD"),
        dueDate: today.add(7, "day").format("YYYY-MM-DD"),
        status: "todo",
        completed: false,
        priority: "medium",
        color: "#E91E63",
        type: "задача",
        category: "дизайн",
        estimate: 8,
        progress: 0,
        assignee: "Ольга",
        tags: ["дизайн", "ui", "ux"],
      },
      content: taskContent(
        "Дизайн новой посадочной страницы",
        "Создать макеты для новой лендинг-страницы продукта. Мобильная и десктопная версии.",
        ["Анализ конкурентов", "Wireframes", "Визуальный дизайн", "Прототип в Figma", "Согласование с маркетингом"]
      ),
    },
    
    "Написать тесты для модуля оплаты": {
      frontmatter: {
        startDate: today.add(1, "day").format("YYYY-MM-DD"),
        dueDate: today.add(5, "day").format("YYYY-MM-DD"),
        status: "todo",
        completed: false,
        priority: "high",
        color: "#673AB7",
        type: "задача",
        category: "тестирование",
        estimate: 6,
        progress: 0,
        assignee: "Дмитрий",
        tags: ["тесты", "qa", "оплата"],
      },
      content: taskContent(
        "Unit-тесты модуля оплаты",
        "Покрыть тестами критический функционал обработки платежей. Цель - 80% coverage.",
        ["Определить тест-кейсы", "Написать unit-тесты", "Написать интеграционные тесты", "Проверить coverage"]
      ),
    },
    
    "Оптимизировать производительность": {
      frontmatter: {
        startDate: today.add(5, "day").format("YYYY-MM-DD"),
        dueDate: today.add(12, "day").format("YYYY-MM-DD"),
        status: "inbox",
        completed: false,
        priority: "medium",
        color: "#FF5722",
        type: "задача",
        category: "разработка",
        estimate: 16,
        progress: 0,
        assignee: "Алексей",
        tags: ["перформанс", "оптимизация"],
      },
      content: taskContent(
        "Оптимизация производительности",
        "Ускорить загрузку главной страницы. Текущий показатель: 3.2s, цель: <1.5s",
        ["Профилирование", "Оптимизация изображений", "Code splitting", "Кэширование", "CDN настройка"]
      ),
    },

    // =============================================
    // ✅ ЗАВЕРШЁННЫЕ ЗАДАЧИ  
    // Демонстрация: completed состояние, checkField
    // =============================================
    
    "Настроить CI CD": {
      frontmatter: {
        startDate: today.subtract(5, "day").format("YYYY-MM-DD"),
        dueDate: today.subtract(2, "day").format("YYYY-MM-DD"),
        status: "done",
        completed: true,
        priority: "high",
        color: "#4CAF50",
        type: "задача",
        category: "devops",
        estimate: 8,
        progress: 100,
        assignee: "Сергей",
        tags: ["devops", "ci", "cd", "завершено"],
      },
      content: taskContent(
        "Настроить CI/CD пайплайн",
        "Автоматизация сборки и деплоя через GitHub Actions. Задача выполнена успешно!",
        ["Создать workflow файл", "Настроить тесты", "Настроить деплой", "Документация"]
      ),
    },
    
    "Ревью кода коллеги": {
      frontmatter: {
        startDate: today.subtract(1, "day").format("YYYY-MM-DD"),
        status: "done",
        completed: true,
        priority: "medium",
        color: "#8BC34A",
        type: "задача",
        category: "работа",
        estimate: 1,
        progress: 100,
        assignee: "Мария",
        tags: ["ревью", "код", "завершено"],
      },
      content: taskContent(
        "Code review PR #142",
        "Проверить pull request с новым функционалом уведомлений.",
        ["Проверить код", "Оставить комментарии", "Approve"]
      ),
    },

    // =============================================
    // ⚠️ ПРОСРОЧЕННЫЕ ЗАДАЧИ
    // Демонстрация: overdue в Agenda, красная подсветка
    // =============================================
    
    "Обновить зависимости": {
      frontmatter: {
        startDate: today.subtract(4, "day").format("YYYY-MM-DD"),
        dueDate: today.subtract(2, "day").format("YYYY-MM-DD"),
        status: "doing",
        completed: false,
        priority: "medium",
        color: "#F44336",
        type: "задача",
        category: "разработка",
        estimate: 3,
        progress: 20,
        assignee: "Алексей",
        tags: ["зависимости", "просрочено"],
      },
      content: taskContent(
        "Обновить npm зависимости",
        "⚠️ ПРОСРОЧЕНО! Обновить устаревшие пакеты для устранения уязвимостей.",
        ["Проверить npm audit", "Обновить критичные пакеты", "Протестировать совместимость", "Деплой"]
      ),
    },

    // =============================================
    // 🎯 КАТЕГОРИЯ: ПРОЕКТЫ (Multi-day)
    // Демонстрация: startDate + endDate spans
    // =============================================
    
    "Редизайн личного кабинета": {
      frontmatter: {
        startDate: today.subtract(5, "day").format("YYYY-MM-DD"),
        endDate: today.add(10, "day").format("YYYY-MM-DD"),
        status: "doing",
        completed: false,
        priority: "high",
        color: "#3F51B5",
        type: "проект",
        category: "разработка",
        estimate: 80,
        progress: 35,
        team: ["Ольга", "Алексей", "Дмитрий"],
        budget: 150000,
        tags: ["проект", "редизайн", "важно"],
      },
      content: projectContent(
        "Редизайн личного кабинета",
        ["Улучшить UX на 40%", "Увеличить конверсию", "Модернизировать визуал"],
        ["Исследование (неделя 1)", "Дизайн (неделя 2)", "Разработка (неделя 3-4)", "Тестирование (неделя 5)"]
      ),
    },
    
    "Конференция TechFest 2026": {
      frontmatter: {
        startDate: today.add(14, "day").format("YYYY-MM-DD"),
        endDate: today.add(16, "day").format("YYYY-MM-DD"),
        status: "scheduled",
        completed: false,
        priority: "medium",
        color: "#9C27B0",
        type: "конференция",
        category: "обучение",
        location: "Москва, Экспоцентр",
        budget: 25000,
        tags: ["конференция", "обучение", "нетворкинг"],
      },
      content: eventContent(
        "TechFest 2026 - Ежегодная конференция",
        `**3 дня докладов и мастер-классов**

**День 1**: Открытие, keynote, нетворкинг
**День 2**: Технические доклады, воркшопы
**День 3**: Панельные дискуссии, закрытие

**Мои сессии:**
- [ ] "Будущее веб-разработки"
- [ ] "AI в продакшене"
- [ ] "Масштабирование стартапа"`
      ),
    },
    
    "Спринт 14": {
      frontmatter: {
        startDate: today.format("YYYY-MM-DD"),
        endDate: today.add(13, "day").format("YYYY-MM-DD"),
        status: "doing",
        completed: false,
        priority: "high",
        color: "#00BCD4",
        type: "спринт",
        category: "agile",
        velocity: 34,
        sprintGoal: "Запуск MVP модуля аналитики",
        tags: ["спринт", "agile", "scrum"],
      },
      content: projectContent(
        "Спринт №14",
        ["Завершить MVP аналитики", "Покрыть тестами 70%+", "Документировать API"],
        ["Планирование", "Разработка фич", "Тестирование", "Демо и ретро"]
      ),
    },
    
    "Отпуск": {
      frontmatter: {
        startDate: today.add(30, "day").format("YYYY-MM-DD"),
        endDate: today.add(44, "day").format("YYYY-MM-DD"),
        status: "scheduled",
        completed: false,
        priority: "low",
        color: "#FFEB3B",
        type: "отпуск",
        category: "личное",
        location: "Сочи",
        tags: ["отпуск", "отдых", "личное"],
      },
      content: eventContent(
        "Долгожданный отпуск! 🏖️",
        `**2 недели у моря**

**Локация**: Сочи, отель у моря
**Планы**: 
- Полный детокс от работы
- Горы и море
- Чтение книг

**Не забыть**:
- [ ] Передать дела
- [ ] Настроить автоответчик
- [ ] Забронировать отель`
      ),
    },

    // =============================================
    // � КАТЕГОРИЯ: ДЛИННЫЕ ОБЗОРНЫЕ СОБЫТИЯ
    // Демонстрация: Multi-week spans, bars в календаре
    // =============================================
    
    "Квартальный аудит безопасности": {
      frontmatter: {
        startDate: today.add(7, "day").format("YYYY-MM-DD"),
        endDate: today.add(28, "day").format("YYYY-MM-DD"),
        status: "scheduled",
        completed: false,
        priority: "high",
        color: "#D32F2F",
        type: "аудит",
        category: "безопасность",
        auditor: "SecureIT Ltd",
        scope: ["инфраструктура", "код", "процессы"],
        tags: ["аудит", "безопасность", "compliance"],
      },
      content: projectContent(
        "Квартальный аудит безопасности Q1 2026",
        ["Проверка инфраструктуры", "Аудит кода", "Пентест", "Документирование"],
        ["Неделя 1: Сбор данных", "Неделя 2: Анализ инфраструктуры", "Неделя 3: Код-ревью", "Неделя 4: Отчёт и рекомендации"]
      ),
    },
    
    "Бета-тестирование v3.0": {
      frontmatter: {
        startDate: today.add(5, "day").format("YYYY-MM-DD"),
        endDate: today.add(19, "day").format("YYYY-MM-DD"),
        status: "scheduled",
        completed: false,
        priority: "high",
        color: "#7B1FA2",
        type: "тестирование",
        category: "qa",
        testers: 50,
        features: ["новый интерфейс", "API v2", "мобильная версия"],
        tags: ["бета", "тестирование", "релиз"],
      },
      content: projectContent(
        "Бета-тестирование версии 3.0",
        ["Собрать отзывы от 50+ пользователей", "Исправить критичные баги", "Валидировать UX"],
        ["Дни 1-3: Онбординг тестеров", "Дни 4-10: Активное тестирование", "Дни 11-14: Сбор фидбека и исправления"]
      ),
    },
    
    "Миграция на новый сервер": {
      frontmatter: {
        startDate: today.add(21, "day").format("YYYY-MM-DD"),
        endDate: today.add(25, "day").format("YYYY-MM-DD"),
        status: "scheduled",
        completed: false,
        priority: "high",
        color: "#1976D2",
        type: "инфраструктура",
        category: "devops",
        downtime: "4 часа",
        rollbackPlan: true,
        tags: ["миграция", "сервер", "devops"],
      },
      content: eventContent(
        "Миграция на новый сервер",
        `**Критическое окно миграции**

**День 1-2**: Подготовка и тестовая миграция
**День 3**: Финальная синхронизация данных  
**День 4**: Переключение DNS и проверка
**День 5**: Мониторинг и стабилизация

**Технические детали:**
- Новый сервер: AWS eu-central-1
- Ожидаемый downtime: 4 часа
- План отката: готов`
      ),
    },
    
    "Ревью архитектуры системы": {
      frontmatter: {
        startDate: today.subtract(3, "day").format("YYYY-MM-DD"),
        endDate: today.add(4, "day").format("YYYY-MM-DD"),
        status: "doing",
        completed: false,
        priority: "medium",
        color: "#00897B",
        type: "ревью",
        category: "архитектура",
        participants: ["CTO", "Tech Lead", "Senior Dev"],
        tags: ["архитектура", "ревью", "техдолг"],
      },
      content: projectContent(
        "Архитектурное ревью Q1",
        ["Оценить текущую архитектуру", "Выявить узкие места", "Спланировать улучшения"],
        ["Анализ текущего состояния", "Сессии с командой", "Документирование решений"]
      ),
    },
    
    "Обучение команды React 19": {
      frontmatter: {
        startDate: today.add(10, "day").format("YYYY-MM-DD"),
        endDate: today.add(24, "day").format("YYYY-MM-DD"),
        status: "scheduled",
        completed: false,
        priority: "medium",
        color: "#5C6BC0",
        type: "обучение",
        category: "развитие",
        instructor: "Внешний тренер",
        participants: 8,
        hours: 24,
        tags: ["обучение", "react", "развитие"],
      },
      content: eventContent(
        "Корпоративное обучение: React 19",
        `**2 недели интенсивного обучения**

**Программа:**
- Server Components
- Suspense & Streaming
- Actions и form handling
- Новые хуки

**Формат:**
- 3 сессии в неделю по 4 часа
- Практические задания
- Финальный проект

**Участники:** 8 разработчиков`
      ),
    },
    
    "Маркетинговая кампания Q1": {
      frontmatter: {
        startDate: today.format("YYYY-MM-DD"),
        endDate: today.add(45, "day").format("YYYY-MM-DD"),
        status: "doing",
        completed: false,
        priority: "high",
        color: "#F57C00",
        type: "маркетинг",
        category: "бизнес",
        budget: 500000,
        channels: ["email", "social", "ppc", "content"],
        kpi: "500 лидов",
        tags: ["маркетинг", "кампания", "лиды"],
      },
      content: projectContent(
        "Маркетинговая кампания Q1 2026",
        ["500+ качественных лидов", "ROI > 300%", "Узнаваемость бренда +20%"],
        ["Неделя 1-2: Запуск email", "Неделя 3-4: Social media", "Неделя 5-6: PPC и контент"]
      ),
    },
    
    "Хакатон внутренний": {
      frontmatter: {
        startDate: today.add(35, "day").format("YYYY-MM-DD"),
        endDate: today.add(37, "day").format("YYYY-MM-DD"),
        status: "scheduled",
        completed: false,
        priority: "medium",
        color: "#8E24AA",
        type: "событие",
        category: "команда",
        theme: "AI инструменты",
        prizes: ["MacBook Pro", "iPhone", "AirPods"],
        teams: 6,
        tags: ["хакатон", "команда", "инновации"],
      },
      content: eventContent(
        "Внутренний хакатон: AI Tools",
        `**48 часов кодинга и креатива! 🚀**

**Тема:** AI-инструменты для повышения продуктивности

**Расписание:**
- Пятница 18:00: Старт, формирование команд
- Суббота: Разработка
- Воскресенье 18:00: Презентации и награждение

**Призы:**
🥇 MacBook Pro 14"
🥈 iPhone 15 Pro  
🥉 AirPods Pro

**6 команд по 4 человека**`
      ),
    },

    // =============================================
    // �️ КАТЕГОРИЯ: ПЕРИОДЫ РАЗРАБОТКИ
    // Демонстрация: Недельные спринты, фазы проектов
    // =============================================
    
    "Разработка модуля аналитики": {
      frontmatter: {
        startDate: today.format("YYYY-MM-DD"),
        endDate: today.add(6, "day").format("YYYY-MM-DD"),
        status: "doing",
        completed: false,
        priority: "high",
        color: "#1565C0",
        type: "разработка",
        category: "backend",
        estimate: 40,
        progress: 45,
        assignee: "Алексей",
        team: ["Алексей", "Дмитрий"],
        tags: ["разработка", "аналитика", "backend", "неделя"],
      },
      content: projectContent(
        "Разработка модуля аналитики (1 неделя)",
        ["Создать API для дашбордов", "Интеграция с BI", "Unit-тесты"],
        ["Пн-Вт: Проектирование API", "Ср-Чт: Реализация endpoints", "Пт: Тесты и документация", "Сб-Вс: Буфер"]
      ),
    },
    
    "Рефакторинг авторизации": {
      frontmatter: {
        startDate: today.add(7, "day").format("YYYY-MM-DD"),
        endDate: today.add(11, "day").format("YYYY-MM-DD"),
        status: "scheduled",
        completed: false,
        priority: "high",
        color: "#C62828",
        type: "разработка",
        category: "безопасность",
        estimate: 32,
        progress: 0,
        assignee: "Мария",
        securityReview: true,
        tags: ["рефакторинг", "auth", "безопасность", "5дней"],
      },
      content: projectContent(
        "Рефакторинг модуля авторизации (5 дней)",
        ["Переход на OAuth 2.0", "Обновление токенов", "Аудит безопасности"],
        ["День 1: Анализ текущей системы", "День 2-3: Реализация OAuth", "День 4: Миграция данных", "День 5: Тестирование"]
      ),
    },
    
    "Вёрстка нового интерфейса": {
      frontmatter: {
        startDate: today.subtract(2, "day").format("YYYY-MM-DD"),
        endDate: today.add(5, "day").format("YYYY-MM-DD"),
        status: "doing",
        completed: false,
        priority: "medium",
        color: "#6A1B9A",
        type: "разработка",
        category: "frontend",
        estimate: 48,
        progress: 30,
        assignee: "Ольга",
        figmaLink: "https://figma.com/...",
        tags: ["вёрстка", "ui", "frontend", "неделя"],
      },
      content: projectContent(
        "Вёрстка нового дизайна (1 неделя)",
        ["Главная страница", "Профиль пользователя", "Настройки", "Адаптив"],
        ["Пн-Вт: Главная страница", "Ср: Профиль", "Чт: Настройки", "Пт-Вс: Адаптив и polish"]
      ),
    },
    
    "Интеграция платёжной системы": {
      frontmatter: {
        startDate: today.add(14, "day").format("YYYY-MM-DD"),
        endDate: today.add(20, "day").format("YYYY-MM-DD"),
        status: "scheduled",
        completed: false,
        priority: "high",
        color: "#2E7D32",
        type: "разработка",
        category: "платежи",
        estimate: 40,
        progress: 0,
        assignee: "Сергей",
        paymentProvider: "Stripe",
        pciCompliance: true,
        tags: ["интеграция", "платежи", "stripe", "неделя"],
      },
      content: projectContent(
        "Интеграция Stripe (1 неделя)",
        ["Подключить Stripe API", "Webhooks", "Тестовые транзакции", "PCI DSS"],
        ["Пн: Настройка аккаунта", "Вт-Ср: API интеграция", "Чт: Webhooks", "Пт-Вс: Тестирование и сертификация"]
      ),
    },

    // =============================================
    // �💡 КАТЕГОРИЯ: ИДЕИ (Без дат)
    // Демонстрация: inbox/backlog в Board
    // =============================================
    
    "Идея - Тёмная тема": {
      frontmatter: {
        status: "inbox",
        completed: false,
        priority: "medium",
        color: "#607D8B",
        type: "идея",
        category: "продукт",
        effort: "medium",
        impact: "high",
        tags: ["идея", "ui", "тема"],
      },
      content: ideaContent("Тёмная тема для приложения"),
    },
    
    "Идея - Мобильное приложение": {
      frontmatter: {
        status: "inbox",
        completed: false,
        priority: "high",
        color: "#795548",
        type: "идея",
        category: "продукт",
        effort: "high",
        impact: "high",
        tags: ["идея", "мобайл", "react-native"],
      },
      content: ideaContent("Нативное мобильное приложение"),
    },
    
    "Идея - AI ассистент": {
      frontmatter: {
        status: "inbox",
        completed: false,
        priority: "low",
        color: "#9E9E9E",
        type: "идея",
        category: "инновации",
        effort: "high",
        impact: "medium",
        tags: ["идея", "ai", "будущее"],
      },
      content: ideaContent("Интеграция AI-ассистента в интерфейс"),
    },

    // =============================================
    // 📔 КАТЕГОРИЯ: ДНЕВНИК
    // Демонстрация: Daily notes без времени
    // =============================================
    
    "Дневник - Понедельник": {
      frontmatter: {
        startDate: today.subtract(2, "day").format("YYYY-MM-DD"),
        status: "done",
        completed: true,
        type: "дневник",
        category: "личное",
        mood: "продуктивно",
        energy: 8,
        tags: ["дневник", "личное"],
      },
      content: dailyContent(today.subtract(2, "day").format("DD MMMM YYYY"), "😊 Продуктивно"),
    },
    
    "Дневник - Вторник": {
      frontmatter: {
        startDate: today.subtract(1, "day").format("YYYY-MM-DD"),
        status: "done",
        completed: true,
        type: "дневник",
        category: "личное",
        mood: "спокойно",
        energy: 6,
        tags: ["дневник", "личное"],
      },
      content: dailyContent(today.subtract(1, "day").format("DD MMMM YYYY"), "😌 Спокойно"),
    },
    
    "Дневник - Сегодня": {
      frontmatter: {
        startDate: today.format("YYYY-MM-DD"),
        status: "doing",
        completed: false,
        type: "дневник",
        category: "личное",
        mood: "энергично",
        energy: 9,
        tags: ["дневник", "сегодня"],
      },
      content: dailyContent(today.format("DD MMMM YYYY"), "⚡ Энергично"),
    },

    // =============================================
    // 🖼️ КАТЕГОРИЯ: ГАЛЕРЕЯ
    // Демонстрация: coverField, карточки
    // =============================================
    
    "Дизайн-система компании": {
      frontmatter: {
        status: "doing",
        completed: false,
        priority: "high",
        color: "#E91E63",
        type: "документация",
        category: "дизайн",
        cover: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=400",
        tags: ["дизайн", "система", "ui-kit"],
      },
      content: galleryContent(
        "Дизайн-система компании",
        "Унифицированная система компонентов и стилей для всех продуктов компании."
      ),
    },
    
    "Дорожная карта 2026": {
      frontmatter: {
        startDate: today.format("YYYY-MM-DD"),
        endDate: today.add(365, "day").format("YYYY-MM-DD"),
        status: "scheduled",
        completed: false,
        priority: "high",
        color: "#3F51B5",
        type: "roadmap",
        category: "стратегия",
        cover: "https://images.unsplash.com/photo-1512758017271-d7b84c2113f1?w=400",
        tags: ["roadmap", "планирование", "стратегия"],
      },
      content: galleryContent(
        "Product Roadmap 2026",
        "Стратегический план развития продукта на год. Включает все ключевые релизы и инициативы."
      ),
    },
    
    "Результаты исследования UX": {
      frontmatter: {
        status: "done",
        completed: true,
        priority: "medium",
        color: "#009688",
        type: "исследование",
        category: "ux",
        cover: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400",
        respondents: 45,
        nps: 72,
        tags: ["ux", "исследование", "аналитика"],
      },
      content: galleryContent(
        "UX Research Q4 2025",
        "Результаты качественного и количественного исследования пользовательского опыта."
      ),
    },
    
    "Брендбук": {
      frontmatter: {
        status: "done",
        completed: true,
        priority: "low",
        color: "#FF5722",
        type: "документация",
        category: "маркетинг",
        cover: "https://images.unsplash.com/photo-1542744094-24638eff58bb?w=400",
        version: "2.0",
        tags: ["бренд", "гайдлайны", "маркетинг"],
      },
      content: galleryContent(
        "Брендбук v2.0",
        "Обновлённые гайдлайны по использованию фирменного стиля компании."
      ),
    },
    
    "Архитектура системы": {
      frontmatter: {
        status: "doing",
        completed: false,
        priority: "high",
        color: "#607D8B",
        type: "техническое",
        category: "архитектура",
        cover: "https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=400",
        tags: ["архитектура", "система", "техническое"],
      },
      content: galleryContent(
        "System Architecture Diagram",
        "Актуальная схема микросервисной архитектуры с описанием взаимодействий."
      ),
    },

    // =============================================
    // 🔀 ПАРАЛЛЕЛЬНЫЕ СОБЫТИЯ
    // Демонстрация: overlapping в Calendar timeline
    // =============================================
    
    "Собеседование кандидата": {
      frontmatter: {
        startDate: today.add(4, "day").format("YYYY-MM-DD"),
        startTime: "11:00",
        endTime: "12:00",
        status: "scheduled",
        completed: false,
        priority: "high",
        color: "#E91E63",
        type: "встреча",
        category: "hr",
        candidate: "Иванов И.И.",
        position: "Senior Developer",
        tags: ["hr", "собеседование"],
      },
      content: meetingContent(
        "Техническое собеседование",
        ["HR менеджер", "Технический лид", "Кандидат"],
        ["Знакомство", "Технические вопросы", "Live coding", "Вопросы кандидата"]
      ),
    },
    
    "Планирование квартала": {
      frontmatter: {
        startDate: today.add(4, "day").format("YYYY-MM-DD"),
        startTime: "11:30",
        endTime: "13:00",
        status: "scheduled",
        completed: false,
        priority: "high",
        color: "#00BCD4",
        type: "встреча",
        category: "управление",
        tags: ["планирование", "стратегия", "q2"],
      },
      content: meetingContent(
        "Q2 Planning Session",
        ["CEO", "CTO", "Product Manager", "Tech Lead"],
        ["Итоги Q1", "Цели Q2", "Распределение ресурсов", "Риски"]
      ),
    },

    // =============================================
    // 📊 ДЕМОНСТРАЦИЯ ТИПОВ ДАННЫХ
    // Все DataFieldType в одной заметке
    // =============================================
    
    "Демо всех типов полей": {
      frontmatter: {
        // STRING
        title: "Демонстрация типов",
        description: "Эта заметка показывает все типы полей",
        // NUMBER
        priority: 5,
        progress: 50,
        estimate: 4.5,
        budget: 10000,
        // BOOLEAN
        completed: false,
        important: true,
        archived: false,
        // DATE
        startDate: today.format("YYYY-MM-DD"),
        endDate: today.add(7, "day").format("YYYY-MM-DD"),
        dueDate: today.add(3, "day").format("YYYY-MM-DD"),
        // LIST (multitext)
        tags: ["демо", "типы", "данные", "тест"],
        assignees: ["Алексей", "Мария", "Дмитрий"],
        // STRING (but rendered as color)
        color: "#9C27B0",
        status: "doing",
        type: "демо",
        category: "обучение",
      },
      content: `## 📊 Демонстрация всех типов полей

Эта заметка содержит примеры ВСЕХ типов данных, которые поддерживает Projects Plus:

### Строки (String)
- \`title\`: "Демонстрация типов"
- \`description\`: Текстовое описание
- \`status\`: "doing"

### Числа (Number)
- \`priority\`: 5
- \`progress\`: 50
- \`estimate\`: 4.5
- \`budget\`: 10000

### Логические (Boolean)
- \`completed\`: false ❌
- \`important\`: true ✅
- \`archived\`: false ❌

### Даты (Date)
- \`startDate\`: ${today.format("YYYY-MM-DD")}
- \`endDate\`: ${today.add(7, "day").format("YYYY-MM-DD")}
- \`dueDate\`: ${today.add(3, "day").format("YYYY-MM-DD")}

### Списки (List/Multitext)
- \`tags\`: ["демо", "типы", "данные", "тест"]
- \`assignees\`: ["Алексей", "Мария", "Дмитрий"]

### Специальные
- \`color\`: #9C27B0 (для цветной индикации)

---
*Используйте Table view для редактирования всех полей*
`,
    },
  };

  // ============================================================
  // СОЗДАНИЕ ФАЙЛОВ
  // ============================================================

  for (const [linkText, fileData] of Object.entries(demoFiles)) {
    const yaml = stringifyYaml(fileData.frontmatter);
    const fullContent = "---\n" + yaml + "---\n\n# " + linkText + "\n" + fileData.content;

    await vault.create(
      normalizePath(demoFolder + "/" + linkText + ".md"),
      fullContent
    );
  }

  // ============================================================
  // КОНФИГУРАЦИЯ ПРЕДСТАВЛЕНИЙ (VIEWS)
  // ============================================================

  const tableConfig: TableConfig = {
    fieldConfig: {
      name: { width: 280 },
      path: { hide: true },
      startDate: { width: 110 },
      endDate: { width: 110 },
      dueDate: { width: 110 },
      status: { width: 100 },
      type: { width: 100 },
      category: { width: 100 },
      priority: { width: 90 },
      progress: { width: 80 },
      estimate: { width: 80 },
      completed: { width: 80 },
      assignee: { width: 100 },
      color: { hide: true },
      cover: { hide: true },
    },
    orderFields: ["name", "status", "priority", "type", "category", "startDate", "endDate", "progress", "assignee", "tags"],
  };

  const boardConfig: BoardConfig = {
    groupByField: "status",
    orderSyncField: "startDate",
    headerField: "priority",
    includeFields: ["type", "priority", "startDate", "dueDate", "assignee", "progress", "tags"],
    columns: {
      "inbox": { weight: 1 },
      "todo": { weight: 1 },
      "doing": { weight: 1.5 },
      "scheduled": { weight: 1 },
      "done": { weight: 1, collapse: false },
    },
  };

  const calendarConfig: CalendarConfig = {
    interval: "week",
    displayMode: "bars",
    startDateField: "startDate",
    dateField: "startDate",
    endDateField: "endDate",
    startTimeField: "startTime",
    endTimeField: "endTime",
    eventColorField: "color",
    checkField: "completed",
    startHour: 7,
    endHour: 22,
    timezone: "local",
    timeFormat: "24h",
    agendaOpen: true,
  };

  // ============================================================
  // ПОЛЬЗОВАТЕЛЬСКИЕ СПИСКИ (Custom Agenda Lists)
  // ============================================================

  const demoAgendaLists: AgendaCustomList[] = [
    {
      id: `list-demo-today-${uuidv4().slice(0, 8)}`,
      name: "🔥 Сегодня",
      icon: { value: "flame", type: "lucide" },
      filterMode: "visual",
      filterGroup: {
        id: `fg-today-${uuidv4().slice(0, 8)}`,
        conjunction: "AND",
        filters: [
          { id: `f-${uuidv4().slice(0, 8)}`, field: "startDate", operator: "is-today", value: null, enabled: true },
          { id: `f-${uuidv4().slice(0, 8)}`, field: "completed", operator: "is-not-checked", value: null, enabled: true },
        ],
        groups: [],
      },
      filterFormula: "",
      color: "",
      order: 0,
    },
    {
      id: `list-demo-urgent-${uuidv4().slice(0, 8)}`,
      name: "⚡ Срочные задачи",
      icon: { value: "zap", type: "lucide" },
      filterMode: "visual",
      filterGroup: {
        id: `fg-urgent-${uuidv4().slice(0, 8)}`,
        conjunction: "AND",
        filters: [
          { id: `f-${uuidv4().slice(0, 8)}`, field: "priority", operator: "is", value: "high", enabled: true },
          { id: `f-${uuidv4().slice(0, 8)}`, field: "completed", operator: "is-not-checked", value: null, enabled: true },
        ],
        groups: [],
      },
      filterFormula: "",
      color: "#F44336",
      order: 1,
    },
    {
      id: `list-demo-overdue-${uuidv4().slice(0, 8)}`,
      name: "⏰ Просроченные",
      icon: { value: "alarm-clock", type: "lucide" },
      filterMode: "visual",
      filterGroup: {
        id: `fg-overdue-${uuidv4().slice(0, 8)}`,
        conjunction: "AND",
        filters: [
          { id: `f-${uuidv4().slice(0, 8)}`, field: "dueDate", operator: "is-overdue", value: null, enabled: true },
          { id: `f-${uuidv4().slice(0, 8)}`, field: "completed", operator: "is-not-checked", value: null, enabled: true },
        ],
        groups: [],
      },
      filterFormula: "",
      color: "#FF5722",
      order: 2,
    },
    {
      id: `list-demo-meetings-${uuidv4().slice(0, 8)}`,
      name: "🤝 Встречи на неделе",
      icon: { value: "users", type: "lucide" },
      filterMode: "visual",
      filterGroup: {
        id: `fg-meetings-${uuidv4().slice(0, 8)}`,
        conjunction: "AND",
        filters: [
          { id: `f-${uuidv4().slice(0, 8)}`, field: "type", operator: "is", value: "встреча", enabled: true },
          { id: `f-${uuidv4().slice(0, 8)}`, field: "startDate", operator: "is-this-week", value: null, enabled: true },
        ],
        groups: [],
      },
      filterFormula: "",
      color: "#2196F3",
      order: 3,
    },
    {
      id: `list-demo-inprogress-${uuidv4().slice(0, 8)}`,
      name: "🚀 В работе",
      icon: { value: "rocket", type: "lucide" },
      filterMode: "visual",
      filterGroup: {
        id: `fg-inprogress-${uuidv4().slice(0, 8)}`,
        conjunction: "AND",
        filters: [
          { id: `f-${uuidv4().slice(0, 8)}`, field: "status", operator: "is", value: "doing", enabled: true },
        ],
        groups: [],
      },
      filterFormula: "",
      color: "#4CAF50",
      order: 4,
    },
  ];

  const agendaConfig: AgendaConfig = {
    mode: "custom",
    standard: { inheritCalendarFilters: true },
    custom: { lists: demoAgendaLists },
  };

  const galleryConfig: GalleryConfig = {
    coverField: "cover",
    fitStyle: "cover",
    cardWidth: 280,
    includeFields: ["type", "category", "status", "tags"],
  };

  // ============================================================
  // ФИЛЬТРЫ И ЦВЕТОВЫЕ ПРАВИЛА
  // ============================================================

  // Цветовые правила для Board/Table по приоритету
  const priorityColorRules: ColorRule[] = [
    {
      color: "#F44336",
      condition: { field: "priority", operator: "is", value: "high", enabled: true },
    },
    {
      color: "#FF9800",
      condition: { field: "priority", operator: "is", value: "medium", enabled: true },
    },
    {
      color: "#4CAF50",
      condition: { field: "priority", operator: "is", value: "low", enabled: true },
    },
  ];

  // Фильтр для активных задач (не завершённые)
  const activeTasksFilter: FilterCondition[] = [
    { field: "completed", operator: "is-not-checked", enabled: true },
  ];

  // ============================================================
  // СОЗДАНИЕ ПРОЕКТА
  // ============================================================

  settings.addProject(
    Object.assign({}, DEFAULT_PROJECT, {
      name: "Демо-проект",
      id: uuidv4(),
      path: demoFolder,
      dataSource: {
        kind: "folder",
        config: {
          path: demoFolder,
          recursive: false,
        },
      },
      fieldConfig: {
        startDate: { time: false },
        endDate: { time: false },
        dueDate: { time: false },
        startTime: { time: true },
        endTime: { time: true },
      },
      agenda: agendaConfig,
      views: [
        // 📋 ТАБЛИЦА - полный обзор данных
        Object.assign({}, DEFAULT_VIEW, {
          name: "📋 Таблица",
          id: uuidv4(),
          type: "table",
          config: tableConfig,
          filter: { conjunction: "and", conditions: [] },
          colors: { conditions: priorityColorRules },
          sort: { criteria: [{ field: "startDate", order: "asc", enabled: true }] },
        }),
        
        // 📌 ДОСКА - Kanban по статусам
        Object.assign({}, DEFAULT_VIEW, {
          name: "📌 Доска",
          id: uuidv4(),
          type: "board",
          config: boardConfig,
          filter: { conjunction: "and", conditions: activeTasksFilter },
          colors: { conditions: priorityColorRules },
          sort: { criteria: [{ field: "priority", order: "desc", enabled: true }] },
        }),
        
        // 📅 КАЛЕНДАРЬ - Timeline события
        Object.assign({}, DEFAULT_VIEW, {
          name: "📅 Календарь",
          id: uuidv4(),
          type: "calendar",
          config: calendarConfig,
          filter: { conjunction: "and", conditions: [] },
          colors: { conditions: [] },
          sort: { criteria: [] },
        }),
        
        // 🖼️ ГАЛЕРЕЯ - Визуальные карточки
        Object.assign({}, DEFAULT_VIEW, {
          name: "🖼️ Галерея",
          id: uuidv4(),
          type: "gallery",
          config: galleryConfig,
          filter: { 
            conjunction: "and", 
            conditions: [
              { field: "cover", operator: "is-not-empty", enabled: true }
            ] 
          },
          colors: { conditions: priorityColorRules },
          sort: { criteria: [{ field: "status", order: "asc", enabled: true }] },
        }),
        
        // 🎯 ЗАДАЧИ - Только задачи (фильтр по типу)
        Object.assign({}, DEFAULT_VIEW, {
          name: "🎯 Задачи",
          id: uuidv4(),
          type: "board",
          config: {
            ...boardConfig,
            groupByField: "priority",
          },
          filter: { 
            conjunction: "and", 
            conditions: [
              { field: "type", operator: "is", value: "задача", enabled: true },
              { field: "completed", operator: "is-not-checked", enabled: true },
            ] 
          },
          colors: { conditions: [] },
          sort: { criteria: [{ field: "dueDate", order: "asc", enabled: true }] },
        }),
        
        // 🤝 ВСТРЕЧИ - Календарь встреч
        Object.assign({}, DEFAULT_VIEW, {
          name: "🤝 Встречи",
          id: uuidv4(),
          type: "calendar",
          config: {
            ...calendarConfig,
            interval: "week",
          },
          filter: { 
            conjunction: "or", 
            conditions: [
              { field: "type", operator: "is", value: "встреча", enabled: true },
              { field: "type", operator: "is", value: "презентация", enabled: true },
            ] 
          },
          colors: { conditions: [] },
          sort: { criteria: [] },
        }),
      ],
    })
  );
}

