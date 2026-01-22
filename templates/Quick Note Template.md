---
title: <% tp.system.prompt("Тема заметки:") %>
date: <% tp.date.now("YYYY-MM-DD") %>
startDate: <% tp.date.now("YYYY-MM-DD") %>
color: "#6bcf7f"
status: active
tags:
  - note
  - notepad
---

# 📝 <% tp.frontmatter.title %>

<% tp.system.prompt("Содержание заметки:") %>

---
**Создано**: <% tp.date.now("YYYY-MM-DD HH:mm") %>
