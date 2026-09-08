# CX-GATE0-212 — проверка премиссы плана #212

Запуск 2026-09-08, `.codex/run-role.mjs --role adversarial-reviewer --base 1b758b0 --ticket 212`.
Инструкция: не улучшать план, а фальсифицировать — искать недостижимые и противоречивые состояния, инварианты, которых заявленная точка не обеспечивает, ложные «поведение не меняется» и завышение/занижение тяжести открытого дефекта.

**Результат: конструкция не опровергнута. Одна находка — поправка тяжести, принята.** Разбор и проверка по коду — в PLAN_212 §6.

```

- **P1 (conditional) — §6 calls the live hole P2 because `raw` remains correct, but correctness in memory is not durable preservation.** Observed: the conflict path holds, then awaits preservation; the settings subscription can call `push` during that await; `push` clears the suspension and schedules a write. The copy path itself awaits adapter writes and, on total failure, falls back to console output. [main.ts](C:/Users/Park/OBSv1.0/obs-projects-plus/src/main.ts:754), [settingsWriter.ts](C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/settings/settingsWriter.ts:461), [brokenBackup.ts](C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/settings/brokenBackup.ts:307), [main.ts](C:/Users/Park/OBSv1.0/obs-projects-plus/src/main.ts:936), [PLAN_212 §6](C:/Users/Park/OBSv1.0/obs-projects-plus/docs/internal/PLAN_212_WRITE_PERMIT_2026-09-08.md:200)

  Inference: if preservation is slow or ultimately fails while the newly armed write succeeds, `data.json` can be overwritten before any durable recovery copy exists; console text is not equivalent to preserved vault state. §6 is correct that the captured `raw` is accurate, but wrong to conclude there is no data-loss path. Falsified by host evidence that this save can never succeed while all recovery destinations fail, or that such a `push` cannot occur during the await.

I ran no tests; this verdict is from the plan and current code paths only.

[exited with code 0]
```
