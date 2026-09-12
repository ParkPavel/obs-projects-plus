# 📋 Projects Plus templates

> [Русский](README.md) · English

A set of Templater templates for the **Projects Plus** plugin. Every template uses the plugin's
standard fields and interactive prompts.

## 🚀 Quick start

1. Install [Templater](https://github.com/SilentVoid13/Templater)
2. Copy the templates into your vault's template folder
3. Point Templater at it: `Settings → Templater → Template folder location`
4. Create notes with `Alt+N` → `Templater: Create new note from template`

## 📂 The templates

| Template | What it is | Best for |
|--------|----------|-------------------|
| 🌟 **Projects Plus Template** | universal, with every field | any kind of note |
| 📅 **Calendar Event Template** | events and appointments | meetings, conferences, key dates |
| ✅ **Task Template** | a task with checklists | to-dos, work items |
| 📅 **Meeting Template** | meeting notes | agenda, participants, action items |
| 📓 **Daily Note Template** | a daily journal | diary, gratitude, reflection |
| 📝 **Quick Note Template** | a quick capture | thoughts and ideas on the go |
| ⏰ **Deadline Template** | deadlines | project and document due dates |
| 🎯 **Habit Tracker Template** | habit tracking | building a new habit |
| 🚀 **Project Template** | project management | larger projects with stages |
| 🔄 **Recurring Event Template** | recurring events | weekly meetings, training |
| 🏃 **Sprint Template** | agile sprints | Scrum and Kanban iterations |
| 📊 **Weekly Review Template** | a weekly review | retrospective and planning |

## 📊 Standard fields

All templates use the fields from the plugin's demo project:

| Field | Type | Description |
|------|-----|----------|
| `title` | text | the note's name |
| `startDate` | YYYY-MM-DD | start date — this is what places the event in the calendar |
| `date` | YYYY-MM-DD | creation date (filled in automatically, does not affect placement) |
| `endDate` | YYYY-MM-DD | end date, for multi-day events |
| `startTime` | HH:mm | start time |
| `endTime` | HH:mm | end time |
| `status` | inbox/todo/doing/done | task status |
| `completed` | true/false | completion flag |
| `priority` | high/medium/low | priority |
| `color` | HEX | colour in the calendar |
| `type` | meeting/task/bug/event | record type |
| `category` | work/development/personal… | category |
| `estimate` | number | time estimate, in hours |
| `tags` | list | tags for filtering |

> **Important**: `startDate` decides which day the event lands on in the calendar. `date` is the
> note's creation date, filled in automatically, and it takes **no part** in placing the event.

## 🎨 Colour palette

| Colour | HEX | Used for |
|------|-----|---------------|
| 🔴 Red | `#F44336` | urgent tasks, deadlines |
| 🟠 Orange | `#FF9800` | important events |
| 🟡 Yellow | `#FFC107` | reminders |
| 🟢 Green | `#4CAF50` | completed tasks |
| 🔵 Blue | `#2196F3` | meetings, work |
| 🟣 Purple | `#9C27B0` | projects, sprints |
| 🩷 Pink | `#E91E63` | personal |
| 🩵 Cyan | `#00BCD4` | events |

## 💡 Recommendations

1. **Start with the universal template** to see every field in one place
2. **Use the specialised ones** for recurring kinds of work
3. **Bind a shortcut** — `Alt+N` is a good one for creating a note quickly
4. **Adapt them** — the templates are meant to be edited for your own fields

## 📖 Documentation

- [User guide](../docs/user-guide-EN.md)
- [Main README](../README-EN.md)
