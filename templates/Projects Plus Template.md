---
title: <% await tp.system.prompt("📝 Название:") %>
type: <% await tp.system.suggester(["📅 Событие", "✅ Задача", "📅 Встреча", "🎯 Проект", "📝 Заметка"], ["event", "task", "meeting", "project", "note"], false, "📂 Тип записи:") %>
date: <% tp.date.now("YYYY-MM-DD") %>
startDate: <% await tp.system.prompt("📅 Дата начала (YYYY-MM-DD):", tp.date.now("YYYY-MM-DD")) %>
endDate: <% await tp.system.prompt("📅 Дата окончания (YYYY-MM-DD):", tp.date.now("YYYY-MM-DD")) %>
startTime: <% await tp.system.prompt("🕐 Время начала (HH:mm):", "09:00") %>
endTime: <% await tp.system.prompt("🕐 Время окончания (HH:mm):", "10:00") %>
status: <% await tp.system.suggester(["📥 Входящие", "📋 Запланировано", "🏃 В работе", "✅ Готово"], ["inbox", "scheduled", "in-progress", "done"], false, "📊 Статус:") %>
color: <% await tp.system.suggester(["🩷 Розовый", "💙 Синий", "💛 Жёлтый", "💚 Зелёный", "🧡 Оранжевый", "💜 Фиолетовый", "⚪ Без цвета"], ["#ff6b9d", "#4a9eff", "#ffd93d", "#6bcf7f", "#ff8c42", "#b892ff", ""], false, "🎨 Цвет:") %>
tags:
  - projects-plus
---

# <% title %>

<% type === "task" ? "## Описание\n\n## Чеклист\n- [ ] " : type === "meeting" ? "## Участники\n- \n\n## Повестка\n\n## Заметки\n" : type === "project" ? "## Цели\n- \n\n## Задачи\n- [ ] " : "## Заметки\n" %>

---
*Создано: <% tp.date.now("YYYY-MM-DD HH:mm") %>*
