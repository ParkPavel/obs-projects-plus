---
title: <% tp.system.prompt("Название проекта:") %>
date: <% tp.date.now("YYYY-MM-DD") %>
startDate: <% tp.date.now("YYYY-MM-DD") %>
endDate: <% tp.system.prompt("Плановая дата завершения (YYYY-MM-DD):", "") %>
status: <% tp.system.suggester(["🚀 Активный", "⏸️ На паузе", "✅ Завершен", "❌ Отменен"], ["active", "paused", "completed", "cancelled"], false, "Статус проекта:") %>
color: "#b892ff"
progress: 0
tags:
  - project
---

# 🎯 <% tp.frontmatter.title %>

## Описание
<% tp.system.prompt("Описание проекта:") %>

## Цели
- 

## Задачи
```dataview
TABLE status as "Статус", dueDate as "Срок"
FROM "Projects/<% tp.file.folder() %>"
WHERE contains(tags, "task")
SORT dueDate ASC
```

## Прогресс
**<% tp.frontmatter.progress %>%** выполнено

## Этапы
- [ ] Этап 1
- [ ] Этап 2
- [ ] Этап 3

## Ресурсы
- 

## Риски
- 

---
**Начало**: [[<% tp.frontmatter.startDate %>]]  
<% tp.frontmatter.endDate ? `**Завершение**: [[${tp.frontmatter.endDate}]]` : "" %>  
**Статус**: <% tp.frontmatter.status %>
