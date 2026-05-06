---
title: "Bug: Calendar Sync"
status: in-progress
priority: medium
category: bugs
type: bug
startDate: 2026-04-15
endDate: 2026-04-20
date: 2026-04-14
due: 2026-04-20
assignee: "[[Alice Chen]]"
tags: [bug, calendar, sync]
progress: 30
budget: 0
spent: 0
hours: 8
completed: false
sprint: Sprint-7
risk: medium
score: 3
---

# Bug: Calendar Sync

Google Calendar sync drops events with non-ASCII characters in the title.

## Investigation
- [x] Reproduced in staging
- [x] Root cause: UTF-8 encoding issue in iCal parser
- [ ] Fix: encode title before iCal serialization
- [ ] Test with Cyrillic, CJK, emoji titles
- [ ] Deploy fix

## Notes
Assigned to [[Alice Chen]]. Medium risk — affects international users.
Demonstrates filter: `is-overdue` (if due date has passed) or `is-this-week`.
