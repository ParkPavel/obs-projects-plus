---
title: <% tp.date.now("YYYY-MM-DD dddd", 0, tp.file.title, "YYYY-MM-DD") %>
startDate: <% tp.date.now("YYYY-MM-DD", 0, tp.file.title, "YYYY-MM-DD") %>
date: <% tp.date.now("YYYY-MM-DD") %>
status: doing
completed: false
type: событие
category: личное
color: "#2196F3"
mood: <% tp.system.suggester(["😊 Отлично", "🙂 Хорошо", "😐 Нормально", "😔 Плохо", "😢 Ужасно"], ["отлично", "хорошо", "нормально", "плохо", "ужасно"], false, "🎭 Настроение:") %>
energy: <% tp.system.suggester(["⚡ Высокая", "🔋 Средняя", "🪫 Низкая"], ["высокая", "средняя", "низкая"], false, "💪 Энергия:") %>
tags:
  - daily
  - journal
---

# 📅 <% tp.date.now("DD MMMM YYYY", 0, tp.file.title, "YYYY-MM-DD") %>

## 🌅 Утро
### Благодарности
1. 
2. 
3. 

### Главный фокус дня


## 📋 Задачи
- [ ] 
- [ ] 
- [ ] 

## 📝 Заметки

## 🌙 Вечер
### Что удалось сегодня?


### Что улучшить?


---
*[[<% tp.date.now("YYYY-MM-DD", -1, tp.file.title, "YYYY-MM-DD") %>|← Вчера]] | [[<% tp.date.now("YYYY-MM-DD", 1, tp.file.title, "YYYY-MM-DD") %>|Завтра →]]*
