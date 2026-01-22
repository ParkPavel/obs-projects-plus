---
title: <% tp.system.prompt("Название повторяющегося события:") %>
date: <% tp.date.now("YYYY-MM-DD") %>
startDate: <% tp.date.now("YYYY-MM-DD") %>
startTime: <% tp.system.prompt("Время начала (HH:mm):", "10:00") %>
endTime: <% tp.system.prompt("Время окончания (HH:mm):", "11:00") %>
recurrence: <% tp.system.suggester(["📅 Ежедневно", "📆 Еженедельно", "🗓️ Ежемесячно", "🎂 Ежегодно"], ["daily", "weekly", "monthly", "yearly"], false, "Повторение:") %>
recurrence_day: <% tp.system.suggester(["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье", "Не применимо"], ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "none"], false, "День недели (для еженедельных):") %>
recurrence_end: <% tp.system.prompt("Дата окончания повторений (YYYY-MM-DD, оставьте пустым для бесконечных):", "") %>
color: <% tp.system.suggester(["Синий", "Зеленый", "Фиолетовый", "Желтый"], ["#4a9eff", "#6bcf7f", "#b892ff", "#ffd93d"], false, "Цвет:") %>
status: active
skip_dates: []
tags:
  - recurring
  - event
  - calendar
---

# 🔄 <% tp.frontmatter.title %>

## Описание
<% tp.system.prompt("Описание события:") %>

## Расписание
- **Повторение**: <% tp.frontmatter.recurrence %>
<% tp.frontmatter.recurrence_day !== "none" ? `- **День**: ${tp.frontmatter.recurrence_day}` : "" %>
- **Время**: <% tp.frontmatter.startTime %> — <% tp.frontmatter.endTime %>
<% tp.frontmatter.recurrence_end ? `- **До**: [[${tp.frontmatter.recurrence_end}]]` : "" %>

## Чеклист подготовки
- [ ] 

## Заметки по событиям

### <% tp.date.now("YYYY-MM-DD") %>
<!-- Заметки для этого экземпляра -->

---
**Создано**: <% tp.date.now("YYYY-MM-DD HH:mm") %>
