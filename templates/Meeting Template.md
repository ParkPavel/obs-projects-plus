---
title: <% tp.system.prompt("📅 Тема встречи:") %>
startDate: <% tp.system.prompt("📅 Дата:", tp.date.now("YYYY-MM-DD")) %>
date: <% tp.date.now("YYYY-MM-DD") %>
startTime: <% tp.system.prompt("🕐 Время начала:", "10:00") %>
endTime: <% tp.system.prompt("🕐 Время окончания:", "11:00") %>
status: <% tp.system.suggester(["📥 inbox", "📋 todo", "🏃 doing", "✅ done"], ["inbox", "todo", "doing", "done"], false, "📊 Статус:") %>
completed: false
priority: <% tp.system.suggester(["🔴 high", "🟡 medium", "🟢 low"], ["high", "medium", "low"], false, "⚡ Приоритет:") %>
color: <% tp.system.suggester(["🔵 Синий", "🟢 Зелёный", "🟣 Фиолетовый", "🟠 Оранжевый"], ["#2196F3", "#4CAF50", "#9C27B0", "#FF9800"], false, "🎨 Цвет:") %>
type: встреча
category: <% tp.system.suggester(["💼 работа", "👥 клиенты", "💻 разработка", "❤️ личное"], ["работа", "клиенты", "разработка", "личное"], false, "📁 Категория:") %>
estimate: <% tp.system.suggester(["30 мин", "1 час", "1.5 часа", "2 часа"], [0.5, 1, 1.5, 2], false, "⏱️ Длительность:") %>
location: <% tp.system.suggester(["💻 Zoom", "💻 Google Meet", "💻 Teams", "🏢 Офис", "☕ Кафе", "📞 Телефон"], ["Zoom", "Google Meet", "Teams", "Офис", "Кафе", "Телефон"], false, "📍 Место:") %>
attendees: <% tp.system.prompt("👥 Участники:", "") %>
tags:
  - meeting
---

# 📅 Встреча

## Повестка
1. 

## Заметки

## Решения

## Action Items
- [ ] @участник — задача

---
*Создано: <% tp.date.now("YYYY-MM-DD HH:mm") %>*
