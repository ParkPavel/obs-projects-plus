# ⚡ БЫСТРЫЙ СПРАВОЧНИК - Неиспользуемые Импорты и Мусор

**Время на прочтение**: 2 минуты  
**Время на исправление**: 5-10 минут

---

## 🔴 КРИТИЧЕСКИЕ (Исправить СЕГОДНЯ!)

### Issue #1 & #2: Missing `await` in `src/lib/dataApi.ts`

**Строки**: 77, 88

```diff
// НЕПРАВИЛЬНО ❌
async renameField(paths: string[], from: string, to: string): Promise<void> {
- Promise.all(
+ await Promise.all(

async deleteField(paths: string[], name: string): Promise<void> {
- Promise.all(
+ await Promise.all(
```

---

## 🟠 ВЫСОКИЕ (Исправить СЕГОДНЯ!)

### Issue #3: Неиспользуемые алиасы в `src/lib/dataApi.ts`

**Строка**: 21

```diff
- import { function as F, task as T, either as E, taskEither as TE } from "fp-ts";
+ import { function as F, either as E } from "fp-ts";
```

### Issue #4: Неиспользуемый `moment` в `src/ui/modals/components/CreateProject.svelte`

**Строка**: 2

```diff
<script lang="ts">
- import moment from "moment";
  import {
    Button,
```

---

## 🟡 СРЕДНИЕ (Проверить ЗАВТРА)

### Issue #5: Неправильный импорт `moment` в `src/lib/stores/i18n.ts`

**Строка**: 4

```diff
- import { moment } from "obsidian";
+ import dayjs from "dayjs";

// И заменить использование:
- lng: moment.locale(),
+ lng: dayjs.locale(),
```

---

## 📋 Таблица всех проблем

| # | Файл | Строка | Проблема | Действие |
|---|------|--------|----------|----------|
| 1 | `src/lib/dataApi.ts` | 77 | Missing `await` | Добавить await |
| 2 | `src/lib/dataApi.ts` | 88 | Missing `await` | Добавить await |
| 3 | `src/lib/dataApi.ts` | 21 | Unused T, TE | Удалить алиасы |
| 4 | `src/ui/modals/components/CreateProject.svelte` | 2 | Unused moment | Удалить import |
| 5 | `src/lib/stores/i18n.ts` | 4 | Wrong moment import | Заменить на dayjs |

---

## 🚀 Команды для быстрого исправления

```bash
# Только проверка (без изменений)
npm run lint

# Проверить TypeScript
npm run build

# Запустить тесты
npm run test

# Автоматическое исправление (если настроено)
npm run lint -- --fix
```

---

## ✅ Проверка после исправления

```bash
# 1. Проверить сборку
npm run build

# 2. Запустить тесты
npm run test

# 3. Проверить линтинг
npm run lint

# Должны быть результаты:
# ✅ tsc: 0 errors
# ✅ jest: All tests pass
# ✅ eslint: 0 errors
```

---

## 📊 Статистика

- **Всего проблем**: 5
- **Критических**: 2
- **Высоких**: 2
- **Средних**: 1
- **Время на исправление**: ~5-10 мин
- **Сложность**: ⭐ Очень легко

---

**Для полного отчета откройте**: [`UNUSED_IMPORTS_DETAILED_REPORT.md`](./UNUSED_IMPORTS_DETAILED_REPORT.md)
