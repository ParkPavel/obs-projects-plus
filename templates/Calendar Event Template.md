---
title: <% tp.system.prompt("Введите заголовок:") %>
date: <% tp.date.now("YYYY-MM-DD") %>
startDate: <% tp.date.now("YYYY-MM-DD") %>
endDate: <% tp.system.prompt("Введите дату окончания (YYYY-MM-DD, оставьте пустым для single-day):", "") %>
startTime: <% tp.system.prompt("Введите время начала (HH:mm, оставьте пустым для all-day):", "") %>
endTime: <% tp.system.prompt("Введите время окончания (HH:mm):", "") %>
color: <% tp.system.suggester(["#ff6b9d (розовый)", "#4a9eff (синий)", "#ffd93d (желтый)", "#6bcf7f (зеленый)", "#ff8c42 (оранжевый)", "#b892ff (фиолетовый)"], ["#ff6b9d", "#4a9eff", "#ffd93d", "#6bcf7f", "#ff8c42", "#b892ff"], false, "Выберите цвет события:") %>
status: inbox
tags:
  - event
  - calendar
---

# <% tp.frontmatter.title %>

## Описание
<% tp.system.prompt("Введите описание события:") %>

## Детали
- **Дата начала**: [[<% tp.frontmatter.startDate %>]]
<% tp.frontmatter.endDate ? `- **Дата окончания**: [[${tp.frontmatter.endDate}]]` : "" %>
<% tp.frontmatter.startTime ? `- **Время**: ${tp.frontmatter.startTime} - ${tp.frontmatter.endTime || "..."}` : "" %>
- **Статус**: <% tp.frontmatter.status %>

## Заметки
