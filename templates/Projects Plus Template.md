<%*
// ═══════════════════════════════════════════════════════════════
// 🎯 Projects Plus — Универсальный шаблон
// Совместим с Calendar, Board, Table, Gallery views
// ═══════════════════════════════════════════════════════════════

// === ШАГ 1: НАЗВАНИЕ ===
const title = await tp.system.prompt("📝 Название:");

// === ШАГ 2: ТИП ЗАПИСИ ===
const type = await tp.system.suggester(
  ["📅 Событие", "✅ Задача", "📅 Встреча", "🎯 Проект", "📝 Заметка"],
  ["event", "task", "meeting", "project", "note"],
  false, "📂 Тип записи:"
);

// === ШАГ 3: ДАТА ===
const startDate = await tp.system.prompt("📅 Дата (YYYY-MM-DD):", tp.date.now("YYYY-MM-DD"));

// === ШАГ 4: ВРЕМЯ (опционально) ===
const needTime = await tp.system.suggester(["Да", "Нет"], [true, false], false, "🕐 Указать время?");
const startTime = needTime ? await tp.system.prompt("🕐 Время начала (HH:mm):", "09:00") : "";
const endTime = needTime ? await tp.system.prompt("🕐 Время окончания (HH:mm):", "10:00") : "";

// === ШАГ 5: ДАТА ОКОНЧАНИЯ (для событий/проектов) ===
const needEndDate = (type === "event" || type === "project") 
  ? await tp.system.suggester(["Один день", "Несколько дней"], [false, true], false, "📆 Продолжительность:")
  : false;
const endDate = needEndDate ? await tp.system.prompt("📅 Дата окончания (YYYY-MM-DD):", startDate) : startDate;

// === ШАГ 6: СТАТУС ===
const status = await tp.system.suggester(
  ["📥 Входящие", "📋 Запланировано", "🏃 В работе", "✅ Готово"],
  ["inbox", "scheduled", "in-progress", "done"],
  false, "📊 Статус:"
);

// === ШАГ 7: ЦВЕТ ===
const color = await tp.system.suggester(
  ["🩷 Розовый", "💙 Синий", "💛 Жёлтый", "💚 Зелёный", "🧡 Оранжевый", "💜 Фиолетовый", "⚪ Без цвета"],
  ["#ff6b9d", "#4a9eff", "#ffd93d", "#6bcf7f", "#ff8c42", "#b892ff", ""],
  false, "🎨 Цвет:"
);

// === ПЕРЕИМЕНОВАНИЕ ФАЙЛА ===
await tp.file.rename(title);
-%>
---
title: <% title %>
type: <% type %>
date: <% tp.date.now("YYYY-MM-DD") %>
startDate: <% startDate %>
endDate: <% endDate %>
startTime: "<% startTime %>"
endTime: "<% endTime %>"
status: <% status %>
color: "<% color %>"
tags:
  - <% type %>
---

# <% title %>

<% type === "task" ? "## Описание\n\n## Чеклист\n- [ ] " : type === "meeting" ? "## Участники\n- \n\n## Повестка\n\n## Заметки\n" : type === "project" ? "## Цели\n- \n\n## Задачи\n- [ ] " : "## Заметки\n" %>

---
*Создано: <% tp.date.now("YYYY-MM-DD HH:mm") %>*
