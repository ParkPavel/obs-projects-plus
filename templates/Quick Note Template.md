---
title: <% tp.system.prompt("📝 Тема заметки:") %>
startDate: <% tp.date.now("YYYY-MM-DD") %>
status: inbox
completed: false
color: "#4CAF50"
type: событие
category: личное
tags:
  - note
  - quick
---

# 📝 Заметка

<% tp.system.prompt("💬 Содержание:") %>

---
*Создано: <% tp.date.now("YYYY-MM-DD HH:mm") %>*
