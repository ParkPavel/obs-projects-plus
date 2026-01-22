---
title: <% tp.system.prompt("Название спринта:", `Sprint ${tp.date.now("W")}`) %>
date: <% tp.date.now("YYYY-MM-DD") %>
startDate: <% tp.date.now("YYYY-MM-DD") %>
endDate: <% tp.date.now("YYYY-MM-DD", 14) %>
sprint_number: <% tp.system.prompt("Номер спринта:", "1") %>
goal: <% tp.system.prompt("Цель спринта:") %>
velocity_planned: <% tp.system.prompt("Запланировано story points:", "20") %>
velocity_actual: 0
status: <% tp.system.suggester(["📋 Планирование", "🏃 В процессе", "📊 Ревью", "✅ Завершен"], ["planning", "active", "review", "completed"], false, "Статус:") %>
color: "#b892ff"
progress: 0
tags:
  - sprint
  - agile
  - project
---

# 🏃 <% tp.frontmatter.title %>

## 🎯 Цель спринта
<% tp.frontmatter.goal %>

## 📅 Период
**[[<% tp.frontmatter.startDate %>]]** — **[[<% tp.frontmatter.endDate %>]]**

## 📊 Метрики

| Метрика | План | Факт |
|---------|------|------|
| Story Points | <% tp.frontmatter.velocity_planned %> | <% tp.frontmatter.velocity_actual %> |
| Задачи | - | - |
| Баги | - | - |

## 📋 Бэклог спринта

```dataview
TABLE 
  status as "Статус", 
  priority as "Приоритет",
  dueDate as "Срок"
FROM "Projects"
WHERE contains(tags, "sprint-<% tp.frontmatter.sprint_number %>")
SORT priority DESC
```

## ✅ Выполнено
<!-- Перенести выполненные задачи -->

## 🚫 Не выполнено / Перенесено
<!-- Что не успели -->

## 📝 Daily Standups

### <% tp.date.now("YYYY-MM-DD") %>
**Вчера:**
- 

**Сегодня:**
- 

**Блокеры:**
- 

## 📊 Sprint Review
<!-- Заполнить по завершении спринта -->

### Демо
- 

### Feedback
- 

## 🔄 Retrospective

### 👍 Что было хорошо
- 

### 👎 Что улучшить
- 

### 💡 Action Items
- [ ] 

---
**Velocity**: <% tp.frontmatter.velocity_actual %> / <% tp.frontmatter.velocity_planned %> SP  
**Прогресс**: <% tp.frontmatter.progress %>%
