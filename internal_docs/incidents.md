# Known Issues & Incident Log

## Инциденты и решения

Этот документ содержит историю критических проблем проекта и их решения для предотвращения повторения.

---

## Инцидент #001: Build Failure после клонирования из GitHub

**Дата:** 2024-12-08  
**Серьёзность:** CRITICAL  
**Статус:** RESOLVED ✅

### Симптомы
```
X [ERROR] Could not resolve "@popperjs/core"
    node_modules/obsidian-svelte/Popover/Popover.svelte:29:29
```
Сборка (`npm run build`) завершается с exit code 1.

### Причина
Библиотека `obsidian-svelte@0.2.1` использует `@popperjs/core` для компонента Popover, но **не объявляет её как зависимость** (ни dependency, ни peerDependency).

При первоначальной разработке зависимость могла:
- Установиться транзитивно через другой пакет
- Остаться в локальном кэше npm
- Быть в `node_modules` от предыдущих установок

После клонирования из GitHub и чистого `npm install` — зависимость отсутствует.

### Решение
```bash
npm install @popperjs/core --save-dev
```

### Профилактика
1. **Перед пушем на GitHub** — удалить `node_modules`, выполнить `npm ci`, проверить `npm run build`
2. **В CI/CD** — всегда использовать `npm ci` (чистая установка)
3. **Документировать** все ручные установки зависимостей

### Затронутые файлы
- `package.json` — добавлена зависимость `@popperjs/core`

---

## Инцидент #002: Потеря локальных изменений при работе с Git

**Дата:** 2024-12-08  
**Серьёзность:** MEDIUM  
**Статус:** RESOLVED ✅

### Симптомы
После манипуляций с git ветками (создание master, удаление, переключение) все незакоммиченные изменения были потеряны.

### Причина
Выполнение `git reset --hard` или аналогичной команды без предварительного коммита/стэша изменений.

### Потерянные изменения
- `internal_docs/ProjectLog.txt`
- `internal_docs/incidents.md`
- Изменения в `package.json` (@popperjs/core)

### Решение
Пересоздание файлов вручную.

### Профилактика
1. **Перед любыми операциями с git** — проверить `git status`
2. **При наличии изменений** — либо закоммитить, либо `git stash`
3. **Никогда не использовать** `git reset --hard` без понимания последствий

---

## Чеклист перед релизом/пушем

- [ ] Удалить `node_modules` и `package-lock.json`
- [ ] Выполнить `npm install`
- [ ] Выполнить `npm run build` — должен быть exit code 0
- [ ] Выполнить `npm run test` — тесты должны пройти
- [ ] Проверить `git status` — закоммитить все нужные изменения
- [ ] Проверить `npm ls` на отсутствие UNMET PEER DEPENDENCY

---

## Известные предупреждения (не критичные)

### A11y Warning в obsidian-svelte
```
A11y: visible, non-interactive elements with an on:click event must be accompanied by on:keydown, on:keyup, or on:keypress event.
at node_modules/obsidian-svelte/Icon/IconButton.svelte:38:0
```
**Статус:** Баг в сторонней библиотеке. Не блокирует сборку. Исправление возможно через PR в obsidian-svelte или форк.
