# 📋 Стандарты кода и соответствие требованиям Obsidian

**Версия**: 3.2.0  
**Обновлено**: 3 апреля 2026  
**Статус**: ✅ Соответствует требованиям Community Plugins

Этот документ — полное руководство для контрибьюторов, объясняющее стандарты кодирования, требования Obsidian Community Plugins и архитектурные решения, принятые в кодовой базе Projects Plus.

---

## 📑 Содержание

1. [Обзор](#обзор)
2. [Конфигурация ESLint](#конфигурация-eslint)
3. [Конфигурация TypeScript](#конфигурация-typescript)
4. [Требования Obsidian Community](#требования-obsidian-community)
5. [Руководство по типобезопасности](#руководство-по-типобезопасности)
6. [Обоснованные исключения](#обоснованные-исключения)
7. [Чеклист качества кода](#чеклист-качества-кода)
8. [Требования к тестированию](#требования-к-тестированию)

---

## Обзор

Projects Plus следует строгим стандартам кодирования для обеспечения:
- ✅ Соответствия требованиям Obsidian Community Plugins
- ✅ Типобезопасности с TypeScript strict mode
- ✅ Чистого кода без артефактов разработки в продакшене
- ✅ Корректной обработки async/await

### Текущие метрики качества

| Метрика | Статус | Значение |
|---------|--------|----------|
| Ошибки ESLint | ✅ | 0 |
| Ошибки TypeScript | ✅ | 0 |
| Модульные тесты | ✅ | 375/375 успешно |
| Сборка | ✅ | ~7.5с, 1.8MB |
| Типы `any` | ✅ | 20 обоснованных, 0 необоснованных |

---

## Конфигурация ESLint

### Активные правила

Проект использует flat-конфигурацию ESLint ([eslint.config.mjs](../eslint.config.mjs)):

```javascript
rules: {
    "@typescript-eslint/ban-ts-comment": "off",     // Разрешаем @ts-ignore с обоснованием
    "@typescript-eslint/no-explicit-any": "off",    // Контролируется через код-ревью
    "@typescript-eslint/no-empty-interface": "off", // Используется для точек расширения
    "@typescript-eslint/no-empty-function": "off",  // Используется для колбэков по умолчанию
    "@typescript-eslint/no-unused-vars": "off",     // Контролируется TypeScript
    "no-useless-escape": "off",                     // Regex-паттерны могут требовать экранирования
    "tsdoc/syntax": "warn",                         // Качество документации
}
```

### Почему некоторые правила отключены

| Правило | Причина |
|---------|---------|
| `ban-ts-comment` | `@ts-ignore` разрешён при работе с типами внешних библиотек (Immer, Svelte) |
| `no-explicit-any` | Есть обоснованные случаи для generic-утилит и границ API; контролируется через код-ревью |
| `no-empty-interface` | Используется для будущих точек расширения в системе типов |
| `no-useless-escape` | Regex-паттерны для парсинга frontmatter/YAML требуют специфического экранирования |

---

## Конфигурация TypeScript

### Настройки Strict Mode ([tsconfig.json](../tsconfig.json))

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "exactOptionalPropertyTypes": true,
    "isolatedModules": true
  }
}
```

Это одна из самых строгих конфигураций TypeScript, обеспечивающая:
- Отсутствие неявных типов `any`
- Все ветви кода возвращают значения
- Доступ по индексу требует явных проверок на null
- Корректная обработка опциональных свойств

---

## Требования Obsidian Community

### ✅ Решённые проблемы (все обязательные)

Следующие требования из ревью Obsidian Community Plugin полностью выполнены:

#### 1. Запрет прямого использования localStorage

**Требование**: Использовать `Plugin.loadData()`/`Plugin.saveData()` или `App.loadLocalStorage()`/`App.saveLocalStorage()` вместо прямого обращения к `localStorage`.

**Причина**: Прямой localStorage общий для всех хранилищ, что нарушает изоляцию данных.

**Реализация**:
- [src/lib/stores/i18n.ts](../src/lib/stores/i18n.ts) — использует `App.loadLocalStorage()`
- [src/lib/stores/ui.ts](../src/lib/stores/ui.ts) — использует `App.saveLocalStorage()`
- [src/ui/views/Calendar/calendar.ts](../src/ui/views/Calendar/calendar.ts) — использует хранилище с областью видимости vault

#### 2. Запрет console.log в продакшене

**Требование**: Удалить операторы `console.log()` или заменить на `console.debug()`.

**Причина**: Console.log засоряет консоль пользователя; отладочные сообщения должны использовать уровень debug.

**Реализация**: Все 10 экземпляров заменены на `console.debug()`:
- [src/lib/helpers/performance.ts](../src/lib/helpers/performance.ts)
- [src/ui/views/Calendar/logger.ts](../src/ui/views/Calendar/logger.ts)
- [src/ui/views/Calendar/viewport/ViewportStateManager.ts](../src/ui/views/Calendar/viewport/ViewportStateManager.ts)

#### 3. Обработка всех Promise

**Требование**: Никаких необработанных отклонений промисов; использовать `void`, `.catch()` или `await`.

**Причина**: Необработанные отклонения могут привести к сбою плагина или оставить несогласованное состояние.

**Реализация**: Все 32 цепочки промисов корректно обработаны:
- Операции "выстрелил и забыл" используют оператор `void`
- Критические операции используют `try/catch` или `.catch()`
- Методы жизненного цикла корректно ожидают асинхронные операции

#### 4. Согласованность Async/Await

**Требование**: Методы, помеченные `async`, должны использовать `await`; не ожидать не-Promise.

**Реализация**:
- [src/lib/dataApi.ts:163](../src/lib/dataApi.ts#L163) — добавлен `await` к `file.delete()`
- [src/lib/filesystem/inmem/filesystem.ts](../src/lib/filesystem/inmem/filesystem.ts) — убран `async` из синхронных методов
- [src/ui/modals/editNoteModal.ts](../src/ui/modals/editNoteModal.ts) — убран лишний await

#### 5. FileManager.trashFile() вместо Vault.trash()

**Требование** (опционально): Использовать `FileManager.trashFile()` для учёта настроек удаления пользователя.

**Реализация**:
- [src/lib/filesystem/obsidian/filesystem.ts](../src/lib/filesystem/obsidian/filesystem.ts) — обновлено удаление файлов и папок

---

## Руководство по типобезопасности

### Политика типа `any`

**Правило**: Каждый тип `any` должен быть обоснован. Новые типы `any` требуют одобрения при код-ревью.

### Категории обоснованных случаев

#### 1. Generic-функции утилит ✅ ОСТАВИТЬ

```typescript
// src/lib/helpers/performance.ts
export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): T
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T
```

**Почему**: Стандартный паттерн TypeScript для функций высшего порядка. Использование `unknown` нарушает ковариантность для параметров функций. Это соответствует паттернам стандартной библиотеки (`Array.map`, `Function.apply`).

#### 2. Система событий ✅ ОСТАВИТЬ

```typescript
// src/lib/stores/events.ts
onEvent(type: string, cb: (...data: any) => void)
```

**Почему**: События несут произвольные данные. Разные типы событий имеют разные структуры данных. Параметры типов везде нарушили бы простоту без добавления реальной безопасности.

#### 3. Миграция настроек ✅ ОСТАВИТЬ

```typescript
// src/settings/settings.ts
export function migrateSettings(settings: any): Settings
```

**Почему**: 
- Получает нетипизированные данные из `Plugin.loadData()` Obsidian (возвращает `any` из localStorage)
- Должен обрабатывать форматы v1/v2/v3 + повреждённые/некорректные данные
- Проверки во время выполнения по полю `version` обеспечивают сужение типа
- Изменение может сломать существующие миграции пользователей

#### 4. Интеграция с внешним API ✅ ОСТАВИТЬ

```typescript
// src/lib/datasources/dataview/standardize.ts
function standardizeObject(value: any)
```

**Почему**: API Dataview — внешняя нетипизированная библиотека. Мы должны обрабатывать структуры объектов, которые не контролируем.

#### 5. Тестовые моки ✅ ОСТАВИТЬ

```typescript
// src/__mocks__/obsidian.ts
// Различные мок-объекты с типами any
```

**Почему**: Тестовые моки не влияют на продакшен-код. Гибкость в тестах приемлема.

### Улучшенные типы (v3.0.3)

Эти типы были улучшены с `any`:

| Файл | Изменение | Причина |
|------|-----------|---------|
| [viewSort.ts:40](../src/ui/app/viewSort.ts#L40) | `any` → `unknown` | Только проверка на null, нет доступа к свойствам |
| [logger.ts:99](../src/ui/views/Calendar/logger.ts#L99) | `Error \| unknown` → `unknown` | Union избыточен (unknown включает Error) |
| [view.ts:56](../src/view.ts#L56) | Union с литералами → `string` | String поглощает литеральные типы |

---

## Обоснованные исключения

### Директивы @ts-ignore

Кодовая база содержит намеренные директивы `@ts-ignore` для совместимости с библиотеками:

#### Immer + TypeScript Strict Mode

**Расположение**: [src/lib/stores/dataframe.ts](../src/lib/stores/dataframe.ts)

```typescript
// 8 экземпляров @ts-ignore для системы типов Draft в Immer
draft.records.push(record);           // @ts-ignore - совместимость с Immer Draft
draft.values[field.name] = value;     // @ts-ignore - совместимость с Immer Draft
```

**Почему**: Тип `Draft<T>` в Immer преобразует readonly-свойства в изменяемые, но strict mode TypeScript (`noUncheckedIndexedAccess`) конфликтует с внутренней типизацией Immer. Поведение во время выполнения корректно; только статический вывод типов не работает.

**Рассмотренная альтернатива**: Убрать Immer → Потребует переписать все паттерны неизменяемых обновлений (~500 строк).

**Решение**: Оставить `@ts-ignore` с комментариями. Immer проверен в бою; корректность во время выполнения подтверждена 375 модульными тестами.

#### Функции фильтрации

**Расположение**: [src/ui/app/filterFunctions.ts:95](../src/ui/app/filterFunctions.ts#L95)

```typescript
draft.records.filter((record) =>
  // @ts-ignore - matchesFilterConditions возвращает boolean
  matchesFilterConditions(filter, record)
);
```

**Почему**: Сложный вывод generic-типов с функцией produce из Immer. Сигнатура функции корректна, но TypeScript не может вывести полную цепочку типов.

---

## Чеклист качества кода

Перед отправкой PR убедитесь:

### Обязательно ✅

- [ ] `npm run build` — Компилируется без ошибок
- [ ] `npm test` — Все 375 тестов проходят
- [ ] `npm run lint` — 0 ошибок ESLint
- [ ] Нет операторов `console.log()` (используйте `console.debug()` при необходимости)
- [ ] Нет прямого доступа к `localStorage` (используйте App API)
- [ ] Все промисы обработаны (`void`, `.catch()` или `await`)
- [ ] Async-функции используют `await` хотя бы раз
- [ ] Нет лишних `@ts-ignore` (обоснуйте в комментариях при необходимости)

### Рекомендуется 📝

- [ ] Добавьте тесты для новой функциональности
- [ ] Обновите документацию при изменениях API
- [ ] Типы `any` должны быть обоснованы в комментариях
- [ ] Используйте `unknown` вместо `any` где возможно

### Фокус код-ревью

Ревьюеры должны обратить особое внимание на:
1. Новые типы `any` — требуют обоснования
2. Новые `@ts-ignore` — требуют комментария с объяснением
3. Паттерны async/await — проверить корректную обработку
4. Обработка ошибок — проверить, что промисы имеют `.catch()`

---

## Требования к тестированию

### Модульные тесты

Запуск: `npm test`

```bash
# Запустить все тесты
npm test

# Запустить конкретный файл тестов
npm test -- --testPathPattern="settings"

# Запустить с покрытием
npm test -- --coverage
```

### Проверка сборки

```bash
# Полная сборка
npm run build

# Режим наблюдения для разработки
npm run dev
```

### Проверка линтера

```bash
# Проверить на проблемы
npm run lint

# Автоисправление где возможно
npm run lint -- --fix
```

### Чеклист ручного тестирования

Перед релизом проверьте вручную:

- [ ] Создание заметки из шаблона
- [ ] Редактирование frontmatter заметки
- [ ] Удаление заметки
- [ ] Переключение между видами (Board, Table, Calendar, Gallery)
- [ ] Применение фильтров и сортировки
- [ ] Calendar DnD: перетаскивание события на другой день/время (Неделя/День)
- [ ] Calendar DnD: resize мультидневной полосы
- [ ] Board DnD: перетаскивание карточки через grip handle
- [ ] Мобильный DnD: long-press + drag на тач-устройстве
- [ ] Мульти-vault: проверить изоляцию данных

---

## Процесс релиза

### Теги версий

**Важно**: Теги должны быть без префикса "v" для автоматической проверки версий Obsidian.

```bash
# Правильно
git tag 3.0.3

# Неправильно (не будет обнаружено Obsidian)
git tag v3.0.3
```

### Файлы для обновления

1. `manifest.json` — поле version
2. `package.json` — поле version
3. `versions.json` — добавить новое соответствие версий
4. `CHANGELOG.md` — добавить заметки о релизе

### Чеклист релиза

- [ ] Все тесты проходят
- [ ] Сборка успешна
- [ ] CHANGELOG.md обновлён
- [ ] Версия обновлена во всех файлах
- [ ] Тег создан (без префикса "v")
- [ ] GitHub-релиз создан

---

## Ресурсы

### Руководства Obsidian
- [Официальные требования к плагинам](https://docs.obsidian.md/Plugins/Submission+guidelines)
- [Документация для разработчиков плагинов](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)

### Документация проекта
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Руководство по контрибуции
- [CHANGELOG.md](../CHANGELOG.md) — История релизов
- [README.md](../README.md) — Пользовательская документация

---

## Итого

Projects Plus поддерживает высокое качество кода благодаря:

1. **Строгий TypeScript** — Ловит ошибки на этапе компиляции
2. **Правила ESLint** — Обеспечивают единообразный стиль
3. **Обоснованные исключения** — Каждое отклонение документировано
4. **Полные тесты** — 375 модульных тестов
5. **Соответствие Obsidian** — Все требования выполнены

При контрибуции следуйте этому руководству, чтобы ваш код соответствовал стандартам проекта и требованиям Obsidian Community Plugin.

---

*Документ поддерживается командой разработки Projects Plus.*
