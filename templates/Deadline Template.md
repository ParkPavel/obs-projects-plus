---
title: <% tp.system.prompt("Название дедлайна:") %>
date: <% tp.date.now("YYYY-MM-DD") %>
startDate: <% tp.date.now("YYYY-MM-DD") %>
dueDate: <% tp.system.prompt("Срок (YYYY-MM-DD):") %>
dueTime: <% tp.system.prompt("Время сдачи (HH:mm, оставьте пустым):", "") %>
priority: <% tp.system.suggester(["🔴 Критический", "🟠 Высокий", "🟡 Средний", "🟢 Низкий"], ["critical", "high", "medium", "low"], false, "Приоритет:") %>
category: <% tp.system.suggester(["💼 Работа", "📚 Учеба", "📝 Документы", "💰 Финансы", "🏠 Личное"], ["work", "study", "documents", "finance", "personal"], false, "Категория:") %>
color: <% tp.system.suggester(["Красный (срочно)", "Оранжевый", "Желтый", "Зеленый"], ["#ff6b9d", "#ff8c42", "#ffd93d", "#6bcf7f"], false, "Цвет:") %>
status: pending
progress: 0
reminder_days: <% tp.system.suggester(["За 1 день", "За 3 дня", "За неделю", "Без напоминания"], [1, 3, 7, 0], false, "Напоминание:") %>
tags:
  - deadline
  - due
  - important
---

# ⏰ <% tp.frontmatter.title %>

## Срок
**[[<% tp.frontmatter.dueDate %>]]** <% tp.frontmatter.dueTime ? `в ${tp.frontmatter.dueTime}` : "" %>

## Описание
<% tp.system.prompt("Что нужно сделать:") %>

## Требования
- [ ] 

## Этапы выполнения
- [ ] 📋 Подготовка
- [ ] 🔄 В процессе
- [ ] ✅ Финальная проверка
- [ ] 📤 Сдача

## Ресурсы
- 

## Риски
<!-- Что может помешать сдать вовремя -->

## Заметки

---
**Создано**: <% tp.date.now("YYYY-MM-DD HH:mm") %>  
**Осталось дней**: <%* 
const due = moment(tp.frontmatter.dueDate);
const now = moment();
const diff = due.diff(now, 'days');
tR += diff >= 0 ? diff : `Просрочено на ${Math.abs(diff)} дней!`;
%>
