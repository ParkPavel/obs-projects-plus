---
title: <% tp.date.now("YYYY-MM-DD dddd", 0, tp.file.title, "YYYY-MM-DD") %>
date: <% tp.file.title %>
startDate: <% tp.file.title %>
type: daily-note
mood: <% tp.system.suggester(["😊 Отлично", "🙂 Хорошо", "😐 Нормально", "😔 Плохо", "😫 Ужасно"], ["excellent", "good", "neutral", "bad", "terrible"], false, "Настроение:") %>
energy: <% tp.system.suggester(["⚡ Высокая", "🔋 Средняя", "🪫 Низкая"], ["high", "medium", "low"], false, "Энергия:") %>
weather: <% tp.system.suggester(["☀️ Солнечно", "⛅ Облачно", "🌧️ Дождь", "❄️ Снег", "🌫️ Туман"], ["sunny", "cloudy", "rain", "snow", "fog"], false, "Погода:") %>
color: "#4a9eff"
status: active
tags:
  - daily
  - journal
---

# 📅 <% tp.date.now("dddd, D MMMM YYYY", 0, tp.file.title, "YYYY-MM-DD") %>

## 🌅 Утро
**Проснулся**: 
**Настроение**: <% tp.frontmatter.mood %>
**Энергия**: <% tp.frontmatter.energy %>

## 🎯 Фокус дня
<!-- Главная задача на сегодня -->

## ✅ Задачи на сегодня

```dataview
TASK
FROM "Projects"
WHERE contains(dueDate, "<% tp.file.title %>") AND !completed
```

### Срочное
- [ ] 

### Важное
- [ ] 

### Желательное
- [ ] 

## 📅 События

```dataview
TABLE startTime as "Время", title as "Событие"
FROM "Calendar"
WHERE startDate = "<% tp.file.title %>"
SORT startTime ASC
```

## 📝 Заметки

## 🌙 Итоги дня

### Выполнено
- 

### Не успел
- 

### Благодарности
1. 
2. 
3. 

### Завтра
- [ ] 

---
**Продуктивность**: ⭐⭐⭐☆☆
