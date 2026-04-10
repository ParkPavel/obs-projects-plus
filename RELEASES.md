# 🚀 Информация о релизах

## Текущий релиз: v3.2.2

**Дата релиза**: 10 апреля 2026  
**Статус**: 🟢 Стабильный  
**Совместимость**: Obsidian 1.5.7+
**Тип**: Security & Quality — аудит PR #10259, защита JSON.parse, фикс Board DnD, +82 теста

## 📦 Варианты загрузки

### 🎯 Рекомендуемый: Установка через BRAT
```bash
# Добавить в BRAT
ParkPavel/obs-projects-plus
```

### 📥 Ручная установка
- **GitHub Releases**: [Скачать последнюю версию](https://github.com/ParkPavel/obs-projects-plus/releases)
- **Исходный код**: [Посмотреть на GitHub](https://github.com/ParkPavel/obs-projects-plus)

## 💬 Обратная связь

- **Telegram**: [@parkpavel_chigon](https://t.me/parkpavel_chigon)
- **GitHub Issues**: [Сообщить о проблеме](https://github.com/ParkPavel/obs-projects-plus/issues)

## 🗺️ Roadmap

| Приоритет | Функция | Версия | Статус | Документация |
|:---------:|---------|--------|--------|:------------:|
| ✅ | **Agenda 2.0 & Filter System** | v3.0.5 | Выпущено | [Архитектура](docs/architecture-filters.md) |
| ✅ | **Obsidian Guidelines Compliance** | v3.0.6 | Выпущено | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Оптимизация + Теги + Поля дат** | v3.0.7 | Выпущено | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Board UX: persist, zoom, collapse** | v3.0.8 | Выпущено | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Унификация фильтров + Instant mode** | v3.0.9 | Выпущено | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Mobile Feature Parity** | v3.0.10 | Выпущено | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Deep Mobile Adaptation** | v3.1.0 | Выпущено | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Drag & Drop 2.0** | v3.2.0 | Выпущено | [CHANGELOG](CHANGELOG.md) |
| ✅ | **Bugfix & Mobile UX** | v3.2.1 | Выпущено | [CHANGELOG](CHANGELOG.md) |
| 🥇 | **Database View** | v3.3.0 | Планируется | [Архитектура](docs/architecture-database-view.md) |
| 🥈 | **Calendar Sync** (iCal, Google, CalDAV) | v3.4.0 | Планируется | — |

## 📋 Заметки о релизах

---

### 🛠️ v3.2.1 (9 апреля 2026) — Bugfix & Mobile UX

> **Фикс мобильных попаверов, переписана тач-архитектура ViewSwitcher, исправлен выбор даты в Agenda, устранена уязвимость CSS-пайплайна**

#### 🔧 Исправлено: Мобильные попаверы и клавиатура

| Проблема | Причина | Решение |
|----------|---------|--------|
| **Попавер за клавиатурой при первом открытии** | `searchInput.focus()` вызывает клавиатуру ПОСЛЕ расчёта позиции | Невидимый старт (`opacity: 0`) → `reveal()` после `visualViewport.resize` или 120ms |
| **Список полей под клавиатурой** | `flex-direction: column` при попавере над триггером | `column-reverse` — список вверх, поиск внизу |
| **Стили попаверов терялись при git checkout** | CSS был вручную в `styles.css` (build-артефакт) | Перенесено в Svelte `<style>` через `:global()` → компилируется в `main.js` |
| **`column-reverse` не работал на `.ppp-pop-box`** | Базовый класс не имел `display: flex` | Добавлен `display: flex` в модификатор `--mobile-kbd` |

#### 🔧 Исправлено: ViewSwitcher — полная переработка тач-архитектуры

| Проблема | Причина | Решение |
|----------|---------|--------|
| **Мисклик при свайпе (основной баг)** | `touch-action: pan-x` → браузер берёт контроль → `touchcancel` вместо `touchend` → флаг `touchHandled` не ставился | Добавлен `on:touchcancel` — общий обработчик с `touchend` |
| **Двойное переключение** | Свайп-навигация вызывала `onSelect()` после нативного скролла | **Удалена** свайп-навигация целиком. Нативный `pan-x` скроллит, тап выбирает |
| **Визуальный предвыбор при скролле** | Браузер применяет `:active` к кнопкам под пальцем | `-webkit-tap-highlight-color: transparent` + `touch-action: manipulation` |

#### 🔧 Исправлено: Выбор даты в Agenda

| Проблема | Причина | Решение |
|----------|---------|--------|
| **Дата не менялась — всегда сегодня** | Реактивный блок `$: if (!currentDate.isSame(selectedDate))` зависел от обоих переменных → при ручном выборе сбрасывал обратно | Трекинг только изменения пропса через `prevCurrentDate` — ручной выбор не триггерит сброс |

#### 🚀 Улучшено: Панель видов (ViewSwitcher)

| Улучшение | Описание |
|-----------|----------|
| **Упрощённая архитектура** | ~130 строк тач-логики → ~30 строк. Удалены `SWIPE_THRESHOLD`, `SWIPE_MIN_DISTANCE`, `isHorizontalSwipe` |
| **Dead-zone 8px** | Любое движение > 8px блокирует `click`. Чистый tap < 8px работает |
| **scrollIntoView на тап** | Выбранная вкладка плавно прокручивается в центр панели |

#### Метрики

- **Тесты**: 375/375 PASS (21 suite)
- **Build**: OK (main.js 1.8MB, main.css 4.2KB)
- **tsc**: 0 ошибок

---

### 🎯 v3.2.0 (3 апреля 2026) — Drag & Drop 2.0

> **Полноценный Calendar Timeline DnD: перетаскивание событий между днями и временными слотами, resize полос, snap engine, мобильный DnD с long-press**

#### 🗓️ Calendar Timeline DnD

| Функция | Описание |
|---------|----------|
| **EventBar drag** | Перетаскивание событий в Week/Day timeline для смены даты/времени |
| **Cross-day drag** | Перенос событий между днями в Week view с автоматическим пересчётом дат |
| **Strip resize** | Изменение длительности мультидневных событий перетаскиванием левой/правой границы |
| **15-min snap** | Привязка к 15-минутным интервалам при перетаскивании тайм-событий |
| **Visual drop feedback** | Подсветка целевой зоны акцентным цветом; усиленная обратная связь на тач-устройствах |

#### ⚙️ TimelineDragManager

- **DragSession** — вся per-drag state инкапсулирована в объекте сессии: чистый цикл initiate/cleanup
- **Mode detection** — однократная оценка режима при пороге движения: move, strip-resize-start, strip-resize-end
- **Auto-scroll** — вертикальный автоскролл при приближении к краям контейнера
- **SnapEngine** — конфигурируемые snap-интервалы для времени (минуты) и дней (индекс)
- **Mode lock** — переоценка режима в первые 30px движения, затем блокировка

#### 📱 Мобильный DnD

- **Long-press (500ms)** — активация DnD только после удержания на drag handle
- **Haptic feedback** — `navigator.vibrate()` при snap с throttle 100ms
- **Visual feedback** — `maxHeight: 3rem`, `opacity: 0.9`, тень при перетаскивании
- **Touch drop targets** — `@media (pointer: coarse)` с усиленным акцентным фоном

#### 🛡️ Целостность данных

| Исправление | Описание |
|-------------|----------|
| Single mutation point | `CalendarView.handleRecordChange` — единственная точка мутации дат (устранён double-shift) |
| Format preservation | date-only поля остаются date-only при DnD (без инъекции `T00:00:00.000Z`) |
| Multi-day span | Тайм-перемещения вычисляют `endDate = origEnd.add(dayDelta, 'day')` — span не схлопывается |
| Strip resize accuracy | Resize-start/end используют начало/конец полосы вместо центра — устранена амплификация дельты |

#### Метрики

- **Тесты**: 375/375 PASS (21 suite)
- **Build**: OK (main.js 1.8MB, main.css 4.2KB)

---

### 📱 v3.1.0 (8 марта 2026) — Deep Mobile Adaptation, DnD Handle Engine & Unified Grip Design

> **Глубокая мобильная адаптация: DnD handle engine с dragHandleZone, полноэкранный модал, unified grip design, scroll containment, gesture coordination**

#### 🎯 DnD Handle Engine (замена dragDisabled: isMobile)

Первоначальная версия v3.1.0 отключала DnD на мобильных через `dragDisabled: isMobile`. Это было отвергнуто — вместо этого реализован полноценный **drag handle engine**:

| Компонент | Было | Стало |
|-----------|------|-------|
| AgendaSidebar (списки) | `dndzone` + `dragDisabled: isMobile` | `dragHandleZone` + `dragHandle` на grip-элементе |
| Board (колонки) | `dndzone` без handle | `dragHandleZone` + `dragHandle` на grip |
| Board (карточки) | `dndzone` без handle | `dragHandleZone` + `dragHandle` на grip |

**Принцип**: `dragHandleZone` — встроенный API `svelte-dnd-action`, экспортируемый из `src/wrappers/withDragHandles.js`. DnD инициируется **только** через grip-элемент с `use:dragHandle`, а не на любой точке контейнера. Это полностью разрешает конфликт touch-scroll vs drag на мобильных.

#### ⚙️ TouchDndCoordinator — координация жестов

Новый модуль `TouchDndCoordinator.ts` (~210 строк):
- `createLongPressHandler()` — long-press guard с отменой по движению (10px threshold)
- `hapticFeedback()` — тактильная обратная связь через `navigator.vibrate()`
- `applyDragFeedback(el)` — визуальная обратная связь при DnD: maxHeight 3rem, opacity 0.9, тень
- `isDragHandleTarget()` — определение, начался ли touch на grip-элементе
- `DRAG_HANDLE_SELECTOR` — CSS-селектор для grip-элементов

#### 🔲 Unified Grip Design — единый дизайн drag-индикаторов

Все три drag-grip элемента следуют единому паттерну:

| Свойство | Agenda List | Board Column | Board Card |
|----------|-------------|--------------|------------|
| Тип | `<span use:dragHandle>` | `<span use:dragHandle>` | `<span use:dragHandle>` |
| Размер | 1rem × stretch | 1rem × 1.25rem | 0.5rem × 1rem |
| Позиция | inline (flow) | absolute, top-left | absolute, left-center |
| Desktop | `opacity: 0` → hover `0.45` | `opacity: 0` → hover `0.45` | `opacity: 0` → hover `0.45` |
| Touch | `opacity: 0.35` always | `opacity: 0.3` always | `opacity: 0.25` always |
| Hover bg | `var(--background-modifier-hover)` | то же | то же |
| Иконка | `grip-vertical` xs | `grip-vertical` xs | `grip-vertical` xs |

#### 📱 Полноэкранный модал редактора списка

Модальное окно `AgendaListEditor` на мобильных (`max-width: 37.5rem`) — **full-screen takeover** вместо bottom-sheet:
- `.list-editor-overlay`: `align-items: stretch` — модалка на весь экран
- `.list-editor-modal`: `height: 100%; max-height: none; border-radius: 0`
- Footer: `padding-bottom: calc(3.5rem + env(safe-area-inset-bottom))` — 3.5rem поднимает кнопки над навбаром Obsidian
- Scroll: `touch-action: auto` на overlay, `overscroll-behavior: contain` на modal

#### 🏷️ Mobile Filter Row Wrapping

Фильтры внутри модального редактора теперь корректно переносятся на узких экранах:
- `.filter-row`: `flex-wrap: wrap` на тач-устройствах
- `.chip-wrapper`: `flex-shrink: 1; min-width: 0` — чипы сжимаются
- `.chip-label`: `max-width: 4.5rem`
- `.row-prefix`: ужат с 32px до 24px
- `.fg-actions`: `padding-left: 0; flex-wrap: wrap`

#### 🔒 Изоляция скролла (overscroll-behavior: contain)

Корневая проблема мобильной версии — **scroll chaining**: когда вложенный скроллируемый контейнер достигает края, браузер передаёт скролл-импульс родительскому контейнеру вплоть до Obsidian, вызывая нежелательные жесты (pull-to-refresh, sidebar swipe).

| Компонент | Контейнер | Действие |
|-----------|-----------|----------|
| App.svelte | `.projects-main` | Root containment |
| AgendaSidebar | `.content`, `.events`, `.list-editor-overlay`, `.list-editor-modal` | 5 контейнеров |
| InfiniteHorizontalCalendar | `.wrapper` | Горизонтальный скролл |
| Board | `.container` | Канбан-скролл |
| SettingsMenuPopover | `.tab-content` | Модальный скролл |
| AgendaIconPicker | `.modal-content` | Пикер иконок |
| AgendaListEditor | `.editor-content` | Редактор списков |

#### 🔄 Замена DnD на мобильных

DnD (`svelte-dnd-action`) использует `touchstart`/`touchmove`, что невозможно отличить от скролла на тачскринах. Решение — **drag handle engine**:

| Было | Стало |
|------|-------|
| DnD на всех устройствах, конфликт со скроллом | DnD только через grip-элемент (`dragHandleZone` + `dragHandle`) |
| Контекстное меню как замена | Контекстное меню сохранено как альтернатива |
| Свободный скролл только при отключённом DnD | Скролл работает всегда, DnD — только с grip |

#### 📐 Выравнивание таймбаров

Исправлено выравнивание strip-сегментов в `HeaderStripsSection`:
- **Было**: `margin-left`/`margin-right` → flex margins уменьшают доступное пространство элемента
- **Стало**: `padding-left`/`padding-right` → padding остаётся внутри `box-sizing: border-box`
- Каждый strip-сегмент теперь имеет ту же ширину, что и Day-ячейка

#### 🏷️ Исправление лейблов EditNote

| Проблема | Решение |
|----------|---------|
| Лейблы обрезаются слева на мобильных | `overflow-x: visible; overflow-y: hidden` на `.group-content` |
| Короткий `max-width` на десктопе | Увеличен с 8rem до 10rem |
| Отступы недостаточны | Padding увеличен до `0.5rem 0.75rem` |

#### 👆 ViewSwitcher: Edge-aware жесты

- `touch-action: pan-x` — браузер не конкурирует с кастомным свайпом
- `overscroll-behavior-x: contain` — горизонтальный скролл не каскадирует
- **Edge detection**: `stopPropagation()` пропускается на первом/последнем виде, позволяя Obsidian sidebar открываться жестом на границе навигации

#### 🍎 iOS Safe Area

ViewToolbar floating toggle теперь использует `max(8px, env(safe-area-inset-top, 8px))` для учёта notch/Dynamic Island.

#### Mobile Bottom-Sheet → Full-Screen Takeover

Модальное окно AgendaListEditor на мобильных (`max-width: 37.5rem`) отображается как **полноэкранный модал** с padding-bottom для навбара Obsidian.

#### 🔄 Внутренний скролл ячеек календаря (Shift + Wheel)

В режиме заголовков (list) ячейки дня поддерживают **внутренний скролл** при зажатом Shift:

| Поведение | Описание |
|-----------|----------|
| **Shift + колесо** | Скролл содержимого ячейки (список событий) |
| **Колесо без Shift** | Навигация по датам (стандартное поведение) |
| **Умный passthrough** | На границах скролла (верх/низ) событие пробрасывается для навигации |
| **Без переполнения** | Если все события помещаются — Shift+wheel навигирует как обычно |

- Все `cellRecords` рендерятся в `.event-scroll-area` (без лимита MAX_VISIBLE_EVENTS)
- `overflow-y: hidden` + программная прокрутка через `scrollTop`
- Компактная кнопка «ещё N» с градиентным затуханием

#### 📐 Полная высота Week/Day в режиме заголовков

Ячейки недельного и дневного вида теперь занимают **всю доступную высоту** экрана:

| Элемент | Было | Стало |
|---------|------|-------|
| `.infinite-horizontal-calendar` | `height: fit-content` | `height: 100%` |
| `.period-container` | `height: fit-content` | `height: auto` |
| `.period-content` | `height: fit-content` | flex-авто |
| `<Week>` | `useFixedHeight={true}` | `useFixedHeight={false}` |

#### ⚡ Мгновенное переключение видов (Instant Mode)

Для недельного и дневного видов переключение в режиме "мгновенно" теперь **полностью без анимаций**:

**Корневая причина**: `smoothScrollTo()` вызывался с жёстко заданным `duration: 400`, обходя `getAnimationDuration()` (возвращает 0 в instant mode). Убран явный аргумент — функция теперь использует настройку пользователя.

| Слой | Было | Стало |
|------|------|-------|
| JS-скролл | 400ms всегда | 0ms в instant |
| CSS view-layer | `transition: opacity 200ms, transform 200ms` | `transition: none` |
| CSS fadeIn/slideIn | `animation: 200–300ms` | `animation: none` |
| setTimeout × 8 | 50–300ms фиксированные | 0ms в instant |
| Snap delay + reset | 120ms + 300ms | 0ms в instant |

#### 🛡️ Исправления целостности данных

| Баг | Проблема | Решение |
|-----|----------|---------|
| BUG-1 | DnD удваивал shift при endDate ≠ startDate | Удалена мутация endDate в `handleDrop` |
| BUG-7 | Дублирование инъекции времени при DnD | Guard `if (slotHour !== undefined)` |
| BUG-2 | Очистка поля ставила `undefined` вместо `null` | `null` для корректного удаления |

#### 🎨 Визуальные исправления календаря

| Баг | Проблема | Решение |
|-----|----------|---------|
| BUG-3 | Мини-события на мобильных не помещались | Компактный sizing с `min-height: 0.875rem` |
| BUG-4 | Overflow clip скрывал контент | `clip` → `hidden` в EventList и AgendaListEditor |
| BUG-5 | Подсветка "сегодня" с ошибкой часового пояса | Замена на TZ-safe `startOfDay()` |
| BUG-6 | Дёргание resize + z-index гридов | RAF-throttle на mousemove, z-index 6→7 |

#### Метрики

- **Файлов изменено**: 22 (+560, −48 строк)
- **Тесты**: 344/344 PASS (19 suites) → после хотфиксов: **375/375 PASS (21 suite)**
- **Build**: OK (main.js 1.8MB, main.css 4.2KB)
- **svelte-check**: 0 ошибок, 0 предупреждений

#### Пост-релизные хотфиксы (включены в сборку v3.1.0)

| Исправление | Описание |
|-------------|----------|
| Mobile Data Loss | Удалён guard `dataGeneration` в `calendarView.ts` — CalendarView доставляет данные через `$set()` как Table/Board/Gallery |
| Timeline Z-Index | `CurrentTimeLine` z-index 100→10, `isolation: isolate` на ViewContent — предотвращает перекрытие Agenda |
| Board Zoom iOS | CSS `zoom` заменён на `transform: scale()` в `Board.svelte` — совместимость с Safari/iOS |
| Numeric Date Hardening | `parseDateInTimezone` отклоняет числа; `isDateLike` отклоняет numbers; `calculateSpanInfo` ограничен 365 днями |
| Agenda DnD Reset | `getLatestProject()` читает актуальный проект из settings store вместо stale prop — reorder списков не сбрасывает view |

---

### 📱 v3.0.10 (25 февраля 2026) — Mobile Feature Parity

> **Long-press навигация, мобильное открытие заметок, pinch-to-zoom, адаптивная галерея, тактильная обратная связь**

#### 👆 Long-press навигация (все представления)

На тачскринах long-press (500ms) на ссылке или карточке заметки вызывает Obsidian `Menu`:

| Пункт | Действие |
|-------|----------|
| Открыть заметку | Открывает в текущей вкладке |
| Открыть в новой вкладке | Новая вкладка Obsidian |
| Открыть в новом окне | Новое окно Obsidian |

Поддерживается во всех 4 non-Calendar представлениях: Board, Table, Gallery, InternalLink.

#### 📝 EditNote: мобильное открытие

- **Desktop**: Ctrl+Click → вкладка, Shift+Click → окно (без изменений)
- **Mobile**: одиночный тап на кнопку → dropdown меню со всеми 3 режимами
- Tooltip адаптируется в зависимости от устройства

#### 🔍 Board: Pinch-to-zoom

Двухпальцевый жест для масштабирования доски (25%–200%):
- Стандартный `touchstart`/`touchmove`/`touchend` с distance-based scaling
- Safari `GestureEvent` для нативного pinch
- Работает параллельно с Ctrl+Scroll на десктопе

#### 🖼️ Галерея: Адаптивная сетка

- Ширина карточек ограничена 200px на мобильных для предотвращения single-column layout
- `:active` состояния для тактильной обратной связи при касании

#### Метрики

- **Тесты**: 344/344 PASS (19 suites)
- **Build**: OK (main.js 1.67MB, main.css 4.2KB)

---

### ⚡ v3.0.9 (25 февраля 2026) — Унификация фильтров, Instant Mode, Мобильный CSS

> **Унификация дублированного кода фильтров, исправление instant transitions, нормализация CSS breakpoints, guidelines**

#### 🔧 Унифицированные фильтры

Общий `getFilterValuesFromConditions()` заменяет 4 дублированные реализации в Board, Table, Gallery, Calendar.

#### ⚡ Instant Transitions

`animationBehavior: "instant"` теперь полностью подавляет CSS-анимации:
- Calendar week/day: `periodSlideIn`, `unitFadeIn`
- NavigationController: scroll-анимации используют `getAnimationDuration()` вместо hardcoded 400ms

#### 📐 CSS Breakpoints

- Все `@media` breakpoints переведены на rem (`48rem`, `37.5rem`, `30rem`)
- `.modal select` → `.projects-modal select` — предотвращение style bleeding

#### 📋 Console Logging

33 прямых `console.debug/warn/error` вызовов заменены централизованным `calendarLogger`.

#### Метрики

- **Тесты**: 344/344 PASS (19 suites)
- **Build**: OK (main.js 1.67MB, main.css 4.2KB)
- **svelte-check**: 0 ошибок

---

### 🏗️ v3.0.8 (24 февраля 2026) — Board UX: Persist, Zoom, Collapse, Navigation

> **Закрепление статусов, масштабирование доски, восстановление сворачивания колонок, исправление панели настроек**

#### 📌 Закрепление статусов (Column Persist)

Колонки Board-вида теперь можно «закрепить» — они остаются видимыми даже когда записей с таким статусом нет.

| Функция | Описание |
|---------|----------|
| **Контекстное меню** | «Закрепить» / «Открепить» для каждой колонки |
| **Кнопка в заголовке** | Иконка bookmark-plus / bookmark-minus |
| **Визуальный индикатор** | Серая левая рамка (`var(--text-faint)`) для закреплённых; accent-рамка для pinned+persisted |
| **Сохранение** | `persistedStatuses` в `BoardConfig`, переживает перезагрузку |

#### 🔍 Масштабирование доски (Ctrl+Scroll Zoom)

| Параметр | Значение |
|----------|----------|
| **Диапазон** | 25% — 200% |
| **Шаг** | 5% |
| **Управление** | Ctrl + колёсико мыши |
| **Индикатор** | Бейдж в правом нижнем углу, клик для сброса |
| **Технология** | CSS `zoom` (не `transform: scale`) — не ломает DnD |
| **Сохранение** | `boardZoom` в конфиге вида |

#### � Унифицированная навигация по заметкам

Единообразное поведение перехода к заметкам во всех представлениях (Board, Table, Gallery, Calendar):

| Действие | Результат |
|----------|-----------|
| **Клик** | Открывает модальное окно редактирования (промежуточный этап) |
| **Ctrl+Клик** | Открывает заметку в новой вкладке Obsidian (рядом) |
| **Shift+Клик** | Открывает заметку в новом окне Obsidian |

Изменения:
- **Table**: левый клик по номеру строки теперь открывает модальное окно (ранее — только через контекстное меню)
- **Board / Gallery**: простой клик всегда открывает модальное окно (убрана зависимость от `linkBehavior`)
- **Calendar**: клик по событию в popup → модальное окно (ранее — прямое открытие заметки)
- **Модальное окно**: кнопка «Открыть заметку» поддерживает Ctrl/Shift-модификаторы
- **InternalLink**: передаёт `shiftKey` вместе с `newLeaf` для навигации в новое окно
- **editNoteModal**: сигнатура `onOpenNote` → `(openMode: false | 'tab' | 'window') => void`

#### �🔧 Восстановление сворачивания колонок

Механизм сворачивания колонок сломался после добавления zoom и проходил через 3 неудачных подхода:

| Подход | Проблема |
|--------|----------|
| `writing-mode: vertical-lr` на section | Наследуется детьми, ломает flexbox заголовка |
| Фиксированная ширина + `writing-mode` | Заголовок split-template, click ненадёжен в DnD-зоне |
| Удаление `writing-mode` только с section | Expand-кнопка скрыта в collapsed состоянии |

**Финальное решение**: восстановлен оригинальный подход:
- `transform: rotate(-90deg) translateX(-100%)` + `transform-origin: left top`
- `height: 3rem; overflow: hidden` — фиксированная высота секции
- `margin-right: ${48 - width}px` — корректный отступ без перекрытия
- Единый шаблон заголовка — expand-кнопка всегда доступна

#### 🛠️ Другие исправления

| Проблема | Решение |
|----------|---------|
| 326 ошибок Svelte TypeScript | Исправлены аннотации типов → 0 ошибок |
| animationBehavior (FIX-1) | Приведён тип к Obsidian API |
| Card hover jitter (FIX-2) | Исправлен layout shift при hover |
| persistedStatuses (FIX-3) | Исправлен data layer конфигурации |
| Zoom ломает collapse | `transform: scale()` → CSS `zoom` |
| Закреплённые колонки — overlap | `height: 3rem` + `margin-right: 48-width` |
| Таб-селектор настроек исчезает | `flex-shrink: 0` на header и tabs |
| Новая заметка не наследует фильтры | `getFilterValues()` для всех 4 views |

#### 📐 Адаптивная вёрстка

- Container queries (`@container view-content`) для адаптации ширины колонок и карточек
- Медиа-запросы для мобильных: < 48rem и < 30rem

#### Метрики

- **Файлов изменено**: 74 (+523, −669 строк)
- **Тесты**: 344/344 PASS (19 suites)
- **Build**: OK (main.js 1.7MB, main.css 4.2KB)
- **svelte-check**: 0 ошибок, 0 предупреждений
- **Lint**: 0 errors

---

### ⚡ v3.0.7 (19 февраля 2026) — Оптимизация, Теги, Поля дат

> **Устранение регрессии производительности, исправление обнаружения заметок по тегам, переработка семантики полей дат**

#### 🚀 Оптимизация производительности

После v3.0.6 (замена `document.*` → `activeDocument` и другие compliance-правки) наблюдалась регрессия: Svelte реактивные вычисления выполняли дорогостоящую `JSON.stringify` на всех полях каждой записи при каждом тике.

| Оптимизация | Было | Стало |
|-------------|:----:|:-----:|
| Хеш группировки | `JSON.stringify` всех значений O(n×m) | Хеш только `id` + поле даты O(n) |
| Отпечаток записей | Все поля каждой записи O(n×m) | Только 5-6 полей календаря O(n×k) |
| Синтетические DataField | Новый объект на каждый тик → каскадный ререндер | Кеш по ключу `name:type` |
| Группировка и сортировка | Пересчёт на каждый Svelte-тик | Мемоизация по content-aware хешу |
| Двойной тап (мобильные) | 300ms задержка | 200ms — быстрее отклик |

#### 🏷️ Исправление обнаружения заметок по тегам

Tag-based datasource терял часть заметок из-за несогласованной нормализации `#`-префикса.

| Проблема | Причина | Решение |
|----------|---------|---------|
| Ввод без `#` не работал | `"project"` ≠ `"#project"` | `normalizeTag()` — всегда ровно один `#` |
| YAML `tags: ["#daily"]` → `"##daily"` | `"#" + "#daily"` = двойной `#` | `normalizeTag()` стрипает все `#` и добавляет один |
| Запись в frontmatter | `.replace("#", "")` — убирал только первый `#` | `stripTagHash()` — `replace(/^#+/, "")` |
| InMemFileSystem расходился с Obsidian | Разная логика парсинга тегов | Унификация через `normalizeTag()` |

- Универсальная функция `normalizeTag()`: `"daily"` → `"#daily"`, `"##daily"` → `"#daily"`, `"  #daily  "` → `"#daily"`
- 25 новых тестов: 12 для нормализации, 13 для `TagDataSource.includes()`
- Подробный анализ: [tag-detection-analysis.md](docs/debug/tag-detection-analysis.md) (352 строки)

#### 📅 Переработка полей дат

Поле `dateField` переквалифицировано: было «устаревший фоллбэк для начала события» → стало «дата создания заметки».

| Аспект | Было (v3.0.6) | Стало (v3.0.7) |
|--------|:-------------:|:--------------:|
| `dateField` в цепочке приоритетов | Приоритет 2 (фоллбэк для startDate) | Не участвует |
| Поле создания | Не существовало | `creationDateField` — автозаполняется |
| Подпись в настройках | «Поле даты (date)» | «Дата создания (date)» |
| Шаблоны | Только `startDate` | `startDate` + `date` |
| Демо-проект | `calendarConfig.dateField = "startDate"` | `calendarConfig.dateField = "date"` |

**Три поля дат календаря:**

| Поле | Назначение | Влияет на позицию |
|------|-----------|:-----------------:|
| `startDate` | Начало события — определяет позицию в календаре | ✅ |
| `endDate` | Конец события — для многодневных событий | ✅ |
| `date` | Дата создания заметки — заполняется автоматически | ❌ |

#### Метрики

- **Тесты**: 344/344 PASS (19 suites, +53 теста vs v3.0.6)
- **Build**: OK (main.js 1.6MB, main.css 4.2KB)
- **Lint**: 0 errors

---

### 🔧 v3.0.6 (15 февраля 2026) — Technical Compliance Release

> **Приведение плагина в полное соответствие с Obsidian Plugin Guidelines для подачи в Community Plugins**

#### Что исправлено

| Проблема | Было | Стало | Кол-во |
|----------|:----:|:-----:|:------:|
| `vault.modify()` — гонка данных | `vault.modify` | `vault.process` (атомарная запись) | 2 |
| `innerHTML` — XSS-уязвимость | `innerHTML = ...` | `setIcon()`, `el.empty()`, `createSpan()` | 23 |
| `document.*` — поломка multi-window | `document.` | `activeDocument.` | 109 |
| `console.log` в production | 9 вызовов | 0 (удалены) | 9 |
| `manifest.json` description | содержал `:` | убрано (regex бота запрещает) | 1 |

#### Что улучшено

| Категория | Описание |
|-----------|----------|
| **Inline styles → CSS** | 38 повторяющихся паттернов inline-стилей вынесены в CSS-классы `.ppp-popover-*`, `.ppp-pop-*` (~170 строк в `styles.css`) |
| **CSS-цвета** | 17 захардкоженных rgba/hex заменены на Obsidian CSS-переменные (`--text-error`, `--color-red-rgb`, `--background-modifier-hover` и др.) |
| **@ts-ignore** | 28 → 0. Все заменены: 25 оказались ненужными, 5 `@ts-expect-error` оставлены с описанием ошибок |
| **ESLint** | Подключён `eslint-plugin-obsidianmd` (v0.1.9) — 23 правила Obsidian сообщества для автоматической проверки |

#### Метрики

- **Затронуто файлов**: ~30 (26 исходных + 4 конфиг/документация)
- **Тесты**: 291/291 PASS (16 suites, 0 failures)
- **Build**: OK (main.js 1.6MB, main.css 4.2KB)
- **Lint**: clean (0 errors)

---

### 🎉 v3.0.5 (9 февраля 2026) — Agenda 2.0 & Filter System

> **Комплексная система фильтрации, пользовательские списки агенды, тотальный i18n аудит**

#### 🎯 Система фильтрации — 42 оператора

Полностью переработанный движок фильтрации с поддержкой всех типов полей frontmatter.

| Категория | Операторы | Описание |
|-----------|-----------|----------|
| **Текст** | `is`, `is-not`, `contains`, `not-contains`, `starts-with`, `ends-with`, `regex` | Полнотекстовый поиск, регулярные выражения |
| **Числа** | `eq`, `neq`, `lt`, `gt`, `lte`, `gte` | Сравнение числовых значений (поддержка строковых "0") |
| **Логические** | `is-checked`, `is-not-checked` | Фильтрация по чекбоксам |
| **Даты** | `is-on`, `is-not-on`, `is-before`, `is-after`, `is-on-and-before`, `is-on-and-after`, `is-today`, `is-this-week`, `is-this-month`, `is-overdue`, `is-upcoming` | 11 операторов дат включая относительные |
| **Списки/Теги** | `has-any-of`, `has-all-of`, `has-none-of`, `has-keyword` | Мультизначения, теги, массивы |
| **Базовые** | `is-empty`, `is-not-empty` | Проверка наличия значения |

**Обратная совместимость**: старые операторы (`equals` → `is`, `greater_than` → `gt`, `is_today` → `is-today`) автоматически мигрируются.

#### 📋 Agenda 2.0 — Пользовательские списки

Новая система боковой панели календаря с конструктором персональных списков задач.

- **Конструктор списков** — создание, редактирование, удаление, дублирование списков
- **Иконки** — выбор из Lucide (200+ иконок) + Emoji Grid с поиском
- **Цветовая кодировка** — пользовательский HEX-цвет для левой границы списка
- **Сворачивание** — каждый список можно свернуть/развернуть, состояние сохраняется
- **Контекстное меню** — редактировать, дублировать, удалить через правый клик
- **Демо-проект** — 5 готовых фильтров для быстрого старта

##### Группы фильтров
- **Вложенные группы** — AND/OR логика с произвольной глубиной (до 3 уровней)
- **Drag-and-drop** — визуальное перемещение фильтров между группами
- **Конъюнкция на уровне группы** — каждая группа определяет свой AND/OR

##### Формулы дат (DQL-совместимые)

| Формула | Описание | Пример |
|---------|----------|--------|
| `today` | Текущий день | `is-on: today` |
| `tomorrow`, `yesterday` | Относительные дни | `is-before: tomorrow` |
| `sow`, `eow` | Начало/конец недели | `is-on-and-after: sow` |
| `som`, `eom` | Начало/конец месяца | `is-before: eom` |
| `soy`, `eoy` | Начало/конец года | `is-after: soy` |
| `today+1w` | Смещение с единицей | `is-on-and-before: today+1w` |
| `som-1m` | Смещение от якоря | `is-after: som-1m` |

Поддерживаемые единицы: `d` (дни), `w` (недели), `m` (месяцы), `y` (годы).

##### Автокомплит значений
- **Подсказки из vault** — уникальные значения из всех заметок проекта
- **Подсказки из frontmatter** — поля options, tags, статусы
- **Мультизначения** — ввод через запятую для `has-any-of`, `has-all-of`, `has-none-of`

#### 🔧 Расширенный режим фильтрации (Advanced Mode)

Альтернатива визуальному режиму — формулы в стиле Google Sheets:

```
AND(
  CONTAINS(status, "doing"),
  IS_AFTER(startDate, "today"),
  HAS_ANY_OF(tags, "work", "project")
)
```

- **Парсер формул** — полноценный токенизатор + парсер + эвалюатор (620 строк кода)
- **42 встроенных функции**:
  - Логические: `AND()`, `OR()`, `NOT()`
  - Сравнение: `IS()`, `IS_NOT()`, `CONTAINS()`, `STARTS_WITH()`, `ENDS_WITH()`, `REGEX()`
  - Числовые: `EQ()`, `NEQ()`, `LT()`, `GT()`, `LTE()`, `GTE()`
  - Даты: `IS_ON()`, `IS_BEFORE()`, `IS_AFTER()`, `IS_TODAY()`, `IS_THIS_WEEK()`, `IS_OVERDUE()`
  - Массивы: `HAS_ANY_OF()`, `HAS_ALL_OF()`, `HAS_NONE_OF()`, `HAS_KEYWORD()`
  - Проверка: `IS_EMPTY()`, `IS_NOT_EMPTY()`, `IS_CHECKED()`, `IS_NOT_CHECKED()`
- **Валидация в реальном времени** — ошибки показываются при вводе
- **Палитра функций** — категоризированные функции (Ctrl+Space для вызова)
- **Подсказки полей** — с индикаторами типов данных (📝 строка, 🔢 число, 📅 дата и др.)
- **Горячие клавиши** — `Ctrl+Space` (функции), `Tab` (отступ), комментарии через `#`

#### 📝 Редактор frontmatter — улучшения

- **Детекция типов** — объекты Date из YAML (создаваемые YAML-парсером) корректно определяются как Date, а не Object
- **Обработка объектов** — plain objects (вложенные объекты YAML) → String (через JSON.stringify) вместо ошибки
- **Разделение полей** — модал редактирования теперь показывает:
  - **«Поля заметки»** — поля текущей заметки (редактируемые)
  - **«Поля проекта»** — поля из конфигурации проекта (только чтение, свёрнуты)
- **Collapsed группы** — поля проекта по умолчанию свёрнуты с пунктирной рамкой `border-style: dashed`
- **config! assertion** — безопасное утверждение для опционального config в EditNote.svelte

#### 🛡️ Панель настроек — редизайн

Переработана архитектура UI для вкладок Filters, Sort и Colors в настройках вида:

- **Chip-based UI** — каждое правило (фильтр/сортировка/цвет) отображается как интерактивный чип-строка
- **Imperative DOM popups** — все выпадающие меню рендерятся через `document.body.appendChild()`, а не внутри контейнера настроек
- **Исправлен баг закрытия** — раньше клик по dropdown закрывал всю панель настроек (из-за bubbling event), теперь `event.stopPropagation()` блокирует всплытие
- **filterHelpers.ts** — общая библиотека с `getOperatorLabel()`, `getFieldTypeIcon()`, `getOperatorsByFieldType()`

#### 🌐 Переводы — полный аудит i18n

##### English (en.json)
- Добавлены 5 отсутствующих ключей: `heatmap.previousYear`, `heatmap.nextYear`, `heatmap.loading`, `heatmap.noData`, `components.note.edit`

##### Russian (ru.json) — масштабная реструктуризация
- **Удалены 18 мёртвых ключей** из `modals.project.create` (плоские ключи, замещённые вложенной структурой)
- **Добавлены секции модалов**:
  - `modals.view` — 16 ключей (create/duplicate/delete вида)
  - `modals.field` — 28 ключей (configure/create поля)
  - `modals.input` — кнопка Cancel
  - `modals.confirm` — подтверждения delete/cancel
- **Добавлены секции представлений**:
  - `views.developer` — инструменты разработчика
  - `views.table` — таблица (sort, hide, pin, resize)
  - `views.board` — доска (add, note, no-status)
  - `views.gallery` — галерея (cover, fit)
- **Реструктурирован `modals.note.create`** — из плоской в вложенную структуру:
  - `name.name` / `name.description` → имя заметки
  - `templatePath.name` / `templatePath.description` / `templatePath.none` → путь к шаблону
  - `project.name` / `project.description` → выбор проекта
- **Добавлены short-title** для: project edit, project duplicate, project archive, project delete, note edit, archive delete
- **Добавлены**: `navigation.active-project`, heatmap ключи (previousYear/nextYear/loading/noData)
- **Удалены 3 мёртвых подсекции** из `components` (project, view, field — были завязаны на старые модалы)
- **Исправлен дубликат** ключа `multi-text` (был на строках 364 и 370)

#### 🤖 Качество кода
- **291 тест** — 16 test suites, все проходят ✅
- **0 ошибок компиляции** — TypeScript strict mode
- **/skip комментарии** — 14 мест с пояснениями для `@ts-ignore` и `innerHTML`
- **ESLint** — 0 ошибок
- **Bundle** — 1.6 MB (main.js) + 4.2 KB (main.css)

#### 📂 Новые файлы

| Файл | Строк | Назначение |
|------|-------|------------|
| `filterEngine.ts` | 514 | Движок фильтрации с 42 операторами |
| `filterEngine.test.ts` | 501 | 56 тестов для движка |
| `operatorHelpers.ts` | 176 | Маппинг операторов по типам полей |
| `suggestionCollector.ts` | 141 | Автокомплит значений из vault |
| `FilterRow.svelte` | 984 | Chip-строка фильтра с imperative popover |
| `FilterGroupEditor.svelte` | 350 | Вложенный редактор групп AND/OR |
| `AgendaListEditor.svelte` | 743 | Полный редактор списка |
| `AgendaCustomList.svelte` | 367 | Компонент пользовательского списка |
| `AgendaIconPicker.svelte` | 233 | Выбор иконок Lucide + Emoji |
| `DateFormulaInput.svelte` | 398 | Ввод формулы даты с подсказками |
| `dateFormulaParser.ts` | 280 | DQL-совместимый парсер формул дат |
| `formulaParser.ts` | 620 | Парсер расширенного режима |
| `filterHelpers.ts` | 120 | Общие хелперы для Settings UI |

---

### 🔄 v3.0.4 (3 февраля 2026) — Autosave Settings

> **Контроль режима сохранения frontmatter**

#### ✅ Autosave Toggle
- **Новая настройка** — переключатель в настройках проекта (More settings → Autosave)
- **Автосохранение (вкл.)** — изменения сохраняются автоматически, зелёная галочка
- **Ручное сохранение (выкл.)** — кнопка Save, модал закрывается после сохранения
- **По умолчанию**: включено (сохранение существующего поведения)

#### 🤖 Obsidian Community Compliance
- **Обработка any-типов** — `/skip` комментарии для ~70 ESLint issues
- **Готовность к публикации** — соответствие требованиям Community plugins

#### 🌐 Переводы
- **Английский** — полные переводы autosave
- **Русский** — комплексные переводы настроек проекта

---

### 🛠️ v3.0.3 (30 января 2026) — Bot Review Fixes

> **Исправления по результатам review Obsidian Community Bot**

#### 🔧 Async/Await Cleanup
- **dataApi.ts** — добавлен await для file.delete()
- **inmem/filesystem.ts** — удалены лишние async
- **view.ts** — явный void return type

#### ⚙️ Type Safety
- **editNoteModal.ts** — убран лишний async/await
- **logger.ts** — упрощён тип error parameter
- **view.ts** — упрощён тип source parameter

---

### 🛠️ v3.0.2 (27 января 2026) — Форматирование дат и валидация

> **Критические исправления отображения дат в таблицах**

#### 📊 Table View — Реактивное форматирование дат
- **Svelte Store для контекста** — project теперь передаётся через реактивный writable store
- **Мгновенное обновление** — смена формата дат в настройках сразу применяется ко всем ячейкам
- **Правильное форматирование** — даты отображаются в выбранном формате (DD/MM/YYYY, MM-DD-YYYY и др.)
- **Поддержка displayFormat** — отдельный формат для отображения и записи

#### ❌ Валидация невалидных дат
- **Красная подсветка ошибок** — некорректные значения в полях дат выделяются красным фоном
- **rawValue prop** — передача невалидных значений для отображения (например, строка "2")
- **Изолированная обработка** — одна испорченная дата не влияет на другие ячейки
- **Показ исходного значения** — невалидные данные отображаются как есть для диагностики

#### 🎛️ Board View — Настройки группировки
- **Выбор поля группировки** — dropdown для выбора поля в настройках вида
- **Подсказки доступных полей** — показываются только string поля с опциями
- **Сохранение в конфиге** — groupByField сохраняется в настройках вида

#### ⚙️ Глобальные настройки анимаций
- **Animation Behavior** — новая опция: Smooth (плавные) / Instant (мгновенные)
- **Применение к календарю** — scrollIntoView использует behavior из настроек
- **Локализация** — переводы на русский и английский

#### 🧹 Очистка интерфейса
- **Удалён dropdown проектов** — полностью убран из CompactNavBar
- **Чистые props** — удалены неиспользуемые projects и projectId
- **Оптимизация рендеринга** — меньше лишних перерисовок

---

### 🛠️ v3.0.1 (27 января 2026) — Мобильные исправления

> **UX багфиксы после v3.0.0**

#### 📱 DayPopup — Нативный скролл
- **Исправлен скроллинг** — устранена блокировка touch событий на мобильных
- **Нативная прокрутка** — добавлены `touch-action: pan-y` и проверки `cancelable`
- **Устранены console errors** — больше нет "Intervention" ошибок

#### 📝 EditNote Modal — Реактивность заголовка
- **Мгновенное обновление** — заголовок обновляется сразу после переименования
- **Синхронизация state** — исправлено отображение имени файла в модальном окне

---
### 🎉 v3.0.0 (22 января 2026) — Глобальное обновление календаря

> **Самое масштабное обновление за всю историю плагина**

#### 📅 Календарь — полная переработка

| Возможность | Описание |
|-------------|----------|
| **Timeline view** | События на временной шкале 07:00–22:00 |
| **Multi-day events** | Проекты и задачи на несколько дней (spans) |
| **Bars вместо точек** | Наглядное отображение длительности |
| **Agenda panel** | Боковая панель с деталями выбранного дня |
| **startTime/endTime** | Поддержка времени начала и окончания |
| **Цветовая кодировка** | Поле `color` для категоризации событий |

#### 🎛️ Обновлённое меню навигации
- **Кнопки центрирования** — быстрый переход к сегодняшнему дню
- **Переключатель видов** — Month/Week/Day одним кликом
- **Компактный режим** — сворачивание панели для максимума рабочего пространства

#### 📱 Мобильная адаптация
- **Touch-оптимизация** — увеличенные области касания
- **Жесты** — свайпы для навигации между периодами
- **Адаптивная сетка** — оптимальное отображение на любом экране
- **Landscape поддержка** — стили для горизонтальной ориентации

#### 🎯 Переработанный демо-проект
При первом запуске создаётся **полноценный демо-проект** с 35+ заметками:
- 📅 Календарные события с временем
- 📋 Задачи с приоритетами и статусами
- 🎯 Multi-day проекты и спринты
- 🛠️ Периоды разработки (5–7 дней)
- 💡 Идеи в inbox
- 📔 Дневниковые записи
- 🖼️ Галерея с обложками

**6 настроенных представлений:**
1. 📋 Таблица — полный обзор
2. 📌 Доска — Kanban по статусам
3. 📅 Календарь — Timeline с временем
4. 🖼️ Галерея — карточки с covers
5. 🎯 Задачи — фильтр по типу
6. 🤝 Встречи — фильтр встречи/презентации

#### 📝 Автоподсказки для frontmatter
При редактировании полей во всплывающем окне показываются **умные подсказки** на основе существующих значений в проекте.

---

### 🎉 v2.2.0 (3 декабря 2025) — Полная переработка мобильного UX

#### 📱 Мобильные улучшения
- 🖼️ **DayPopup**: Полноэкранное окно с обзором дня и всеми событиями
  - Одинарный тап открывает popup с полным списком заметок
  - Двойной тап создаёт новую заметку сразу
- 🎛️ **Полное скрытие тулбара**: При сворачивании скрывается вся панель, не только кнопки
  - Плавающие кнопки в левом верхнем углу
  - Полупрозрачный минималистичный дизайн
- 📅 **Увеличенные ячейки**: Высота дней +100% для лучших тач-таргетов
- 🔘 **Плавающая кнопка "Сегодня"**: Появляется при скрытом тулбаре
- 🚫 **Отключён drag-n-drop**: Предотвращает конфликты с touch-жестами

#### ⚙️ Действия с заметками (в DayPopup)
- ⚙️ **Настройки**: Открыть модальное окно редактирования
- 📋 **Дублирование**: Мини-календарь для выбора дат копирования
- 🗑️ **Удаление**: Быстрое удаление заметки
- ✅ **Чекбокс**: Изменение статуса прямо в popup

#### 🎨 Компоненты
- `DayPopup.svelte` — полноэкранный обзор дня
- `RecordItem.svelte` — элемент записи с действиями
- `DuplicatePopup.svelte` — мини-календарь для дублирования

#### 🌐 Локализация
- Добавлены переводы для RU/EN/UK/ZH-CN

#### ♿ Доступность
- Добавлены keyboard handlers для всех интерактивных элементов
- ARIA-метки для screen readers

---

### 🎉 v2.1.0 (21 января 2025) — Жесты зуммирования календаря

#### ✨ Новые функции
- 🔍 **Умный зум календаря**: Ctrl+колесо мыши для мгновенного переключения между видами
  - Масштабы: Год ↔ Месяц ↔ 2 недели ↔ Неделя ↔ День
- 🤏 **Pinch-to-zoom**: Поддержка жестов на тачпаде и трекпаде
- 🎯 **Центрирование даты**: Зум сохраняет фокус на дате под курсором
- 💫 **Визуальный индикатор**: Элегантный Apple-style индикатор текущего уровня зума
- 🔄 **Бесконечный скролл**: Плавная навигация заменяет кнопки Prev/Today/Next

#### 🎨 Улучшения дизайна
- Убраны кнопки навигации — теперь прокрутка колесом мыши
- Чистый минималистичный интерфейс календаря
- Apple-style визуальные эффекты и анимации

#### 🔧 Улучшения
- Оптимизирована обработка событий колеса мыши
- Улучшена производительность перерисовки при переключении видов
- Добавлен debounce для предотвращения множественных переключений

#### 🐛 Исправления
- Исправлена проблема с остановкой зума после первого переключения
- Исправлена обработка Ctrl+wheel в горизонтальных видах (неделя/день)
- Устранена утечка event propagation в InfiniteHorizontalCalendar

---

### 🧹 v2.0.1 (21 ноября 2024)

#### 🔧 Улучшения
- **Чистка кода**: Удалён ИИ-генерированный слоп (ненужный/дублирующийся код).
- **Конфигурации сборки**: Обновлены vite, tsconfig.json, package.json.
- **Документация**: Создан/обновлён internal_docs.md с анализом состояния проекта.

### 🎉 v2.0.0 - Основной релиз

#### ✨ Новые функции
- 🌍 **Многоязычная поддержка**: Переводы на русский, украинский, китайский
- ⚡ **Улучшения производительности**: Загрузка в 3 раза быстрее, лучшее управление памятью
- 🎨 **Улучшенный UI/UX**: Современный дизайн интерфейса, лучшая доступность
- 📊 **Расширенная конфигурация**: Больше вариантов настройки
- 🔧 **Улучшенная обработка ошибок**: Улучшенные сообщения об ошибках и восстановление
- 📱 **Отзывчивый дизайн**: Лучшая поддержка мобильных устройств и планшетов

#### 🔄 Улучшения
- **Архитектура**: Полная переработка кодовой базы для лучшей поддержки
- **Производительность**: Оптимизированный рендеринг для больших наборов данных
- **Совместимость**: Лучшая интеграция с другими плагинами
- **Документация**: Комплексные руководства пользователя и API документация

#### 🐛 Исправления ошибок
- Исправлены утечки памяти в длительных сеансах
- Устранены проблемы совместимости с последними версиями Obsidian
- Исправлена точность и полнота переводов
- Улучшена обработка ошибок и восстановление

#### 🔒 Безопасность
- Обновлены все зависимости до последних безопасных версий
- Усилены практики безопасности в разработке
- Регулярные аудиты безопасности и обновления

## � Совместимость версий

### Obsidian

| Projects Plus | Obsidian | Статус |
|---------------|----------|--------|
| **v3.0.x** | 1.5.7+ | ✅ Текущая |
| **v2.x** | 1.1.0+ | ⚠️ Устаревшая |

### Совместимые плагины

| Плагин | Совместимость | Примечания |
|--------|:-------------:|------------|
| **Dataview** | ✅ | DQL-запросы как источник данных |
| **Templater** | ✅ | Шаблоны для создания заметок |
| **Calendar** | ✅ | Совместное использование |
| **Kanban** | ✅ | Совместное использование |

---

## 📞 Поддержка

- **Telegram**: [@parkpavel_chigon](https://t.me/parkpavel_chigon)
- **GitHub Issues**: [Сообщить об ошибке](https://github.com/ParkPavel/obs-projects-plus/issues)
- **GitHub Discussions**: [Обсуждения](https://github.com/ParkPavel/obs-projects-plus/discussions)

---

*Для получения последней информации о релизах посетите [GitHub Releases](https://github.com/ParkPavel/obs-projects-plus/releases).*
