---
title: "Bug: Login Timeout"
status: done
priority: high
category: bugs
type: bug
startDate: 2026-04-12
endDate: 2026-04-14
date: 2026-04-11
due: 2026-04-14
assignee: "[[Bob Wilson]]"
tags: [bug, authentication, hotfix]
progress: 100
budget: 0
spent: 0
hours: 12
completed: true
sprint: Sprint-7
risk: low
score: 4
---

# Bug: Login Timeout

Users experience 30-second timeout on login when session cache is cold.

## Root Cause
Redis connection pool exhaustion under concurrent logins (>100 simultaneous).

## Fix
- [x] Increased pool size: 10 → 50
- [x] Added connection retry with exponential backoff
- [x] Added circuit breaker for Redis failures
- [x] Deployed hotfix to production

## Notes
Zero-budget hotfix. Assigned to [[Bob Wilson]]. Resolved in 2 days.
