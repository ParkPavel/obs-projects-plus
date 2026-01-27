---
title: <% tp.system.prompt("🏃 Название спринта:", `Sprint ${tp.date.now("W")}`) %>
startDate: <% tp.date.now("YYYY-MM-DD") %>
endDate: <% tp.date.now("YYYY-MM-DD", 14) %>
status: <% tp.system.suggester(["📋 Планирование", "🏃 В процессе", "📊 Ревью", "✅ Завершён"], ["todo", "doing", "review", "done"], false, "📊 Статус:") %>
completed: false
priority: high
color: "#9C27B0"
type: событие
category: разработка
sprint_number: <% tp.system.prompt("🔢 Номер спринта:", "1") %>
goal: <% tp.system.prompt("🎯 Цель спринта:") %>
velocity_planned: <% tp.system.prompt("📊 Story points:", "20") %>
velocity_actual: 0
tags:
  - sprint
  - agile
---

# 🏃 Спринт

## 🎯 Цель спринта

## 📊 Метрики

| Метрика | План | Факт |
|---------|------|------|
| Story Points | - | - |
| Задачи | - | - |
| Баги | - | - |

## 📋 Бэклог спринта
- [ ] 

## ✅ Выполнено

## 🚫 Не выполнено / Перенесено

## 📝 Daily Standups

### <% tp.date.now("YYYY-MM-DD") %>
**Вчера:**
- 

**Сегодня:**
- 

**Блокеры:**
- 

---
*Создано: <% tp.date.now("YYYY-MM-DD HH:mm") %>*
