---
title: <% tp.system.prompt("Название задачи:") %>
date: <% tp.date.now("YYYY-MM-DD") %>
startDate: <% tp.date.now("YYYY-MM-DD") %>
dueDate: <% tp.system.prompt("Срок выполнения (YYYY-MM-DD):", tp.date.now("YYYY-MM-DD", 7)) %>
priority: <% tp.system.suggester(["🔴 Высокий", "🟡 Средний", "🟢 Низкий"], ["high", "medium", "low"], false, "Приоритет:") %>
status: <% tp.system.suggester(["📥 Входящие", "📋 Запланировано", "🏃 В работе", "✅ Выполнено", "❌ Отменено"], ["inbox", "todo", "in-progress", "done", "cancelled"], false, "Статус:") %>
color: <% tp.system.suggester(["Красный", "Желтый", "Зеленый", "Синий", "Серый"], ["#ff6b9d", "#ffd93d", "#6bcf7f", "#4a9eff", "#94a3b8"], false, "Цвет:") %>
tags:
  - task
  - projects
---

# <% tp.frontmatter.title %>

## Описание
<% tp.system.prompt("Описание задачи:") %>

## Чеклист
- [ ] 

## Ссылки
- 

---
**Создано**: <% tp.date.now("YYYY-MM-DD HH:mm") %>  
**Приоритет**: <% tp.frontmatter.priority %>  
**Срок**: [[<% tp.frontmatter.dueDate %>]]
