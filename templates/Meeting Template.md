---
title: <% tp.system.prompt("Название встречи:") %>
date: <% tp.date.now("YYYY-MM-DD") %>
startDate: <% tp.system.prompt("Дата встречи (YYYY-MM-DD):", tp.date.now("YYYY-MM-DD")) %>
startTime: <% tp.system.prompt("Время начала (HH:mm):", "14:00") %>
endTime: <% tp.system.prompt("Время окончания (HH:mm):", "15:00") %>
location: <% tp.system.prompt("Место проведения (или ссылка на встречу):") %>
attendees: 
color: "#4a9eff"
status: scheduled
tags:
  - meeting
  - calendar
---

# 📅 <% tp.frontmatter.title %>

## Участники
<% tp.system.prompt("Список участников (через запятую):") %>

## Повестка дня
1. 

## Подготовка
- [ ] 

## Заметки
<!-- Заметки во время встречи -->

## Действия
- [ ] 

---
**Дата**: [[<% tp.frontmatter.startDate %>]]  
**Время**: <% tp.frontmatter.startTime %> - <% tp.frontmatter.endTime %>  
**Место**: <% tp.frontmatter.location %>
