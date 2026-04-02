# 🖱️ Архитектура Timeline Drag & Drop v3.2.0

> **Статус:** Готов к реализации  
> **Версия:** v3.2.0  
> **Последнее обновление:** 2026-03-09  
> **Предпосылки:** v3.1.0 (DnD Handle Engine, Deep Mobile Adaptation)

---

## 📋 Содержание

- [Обзор](#-обзор)
- [Текущее состояние](#-текущее-состояние-v310)
- [Архитектура v3.2.0](#-архитектура-v320)
- [Дизайн взаимодействия](#-дизайн-взаимодействия)
- [Touch-tap создание заметок](#-touch-tap-создание-заметок)
- [Итерации реализации](#-итерации-реализации)
- [API контракты](#-api-контракты)
- [Риски и решения](#-риски-и-решения)

---

## 🎯 Обзор

v3.2.0 добавляет **полное покрытие drag & drop** для всех типов событий и режимов отображения:
- Перемещение timeline-баров вверх/вниз для изменения времени (TIMED events)
- Перемещение между днями (cross-day drag)
- Resize границ для изменения длительности (с треугольными grab-точками ◤ ◢)
- Горизонтальный drag AllDay/MultiDay strips между днями (timeline allday section)
- Resize span MultiDay events через edge-drag (изменение startDate/endDate)
- Mobile DnD в headers mode (Month/2weeks) — снятие ограничения `disableDrag`
- Strip DnD в HeaderStripsSection (Month/2weeks flex-grid)
- Touch-tap создание заметок с визуальным preview и resize handles
- Touch/mobile через long-press (500ms) с haptic feedback на всех этапах

### Покрытие событий

| Тип события | Timeline (bars) | Headers (list) | Итерация |
|-------------|----------------|----------------|----------|
| `TIMED` | Drag + Resize (вертикальный) | Drag (svelte-dnd-action) | 1-3 |
| `ALL_DAY` | Drag горизонтальный (strip) | Drag (svelte-dnd-action) + Strip DnD | 5-6 |
| `MULTI_DAY_ALLDAY` | Drag + Resize горизонтальный (strip) | Strip DnD в flex-grid | 5-6 |
| `MULTI_DAY_TIMED` | Drag + Resize горизонтальный (strip) | Strip DnD в flex-grid | 5-6 |

**Board/Agenda DnD** — продолжает работать через `dragHandleZone` (без изменений).

---

## 🏗️ Текущее состояние (v3.1.0)

### Что уже работает

| Компонент | Механизм | Вид |
|-----------|----------|-----|
| `EventList.svelte` → `Day.svelte` | `svelte-dnd-action` dndzone | Month/2weeks (list mode) |
| `AgendaSidebar.svelte` | `dragHandleZone` + `dragHandle` | Sidebar lists |
| `Board/CardList.svelte` | `dragHandleZone` + `dragHandle` | Board cards/columns |
| `GridHeader.svelte` | `svelte-dnd-action` dndzone | Table column reorder |

### Компоненты Timeline (click-only, НЕТ DnD)

| Компонент | Строк | Что есть | Чего нет |
|-----------|-------|----------|----------|
| `EventBar.svelte` | 251 | Позиционирование (topRem, heightRem), click, hover | mousedown, drag handles, resize handles |
| `EventBarContainer.svelte` | 178 | Статический greedy column layout | Real-time relayout при drag |
| `DayColumn.svelte` | 277 | `getTimeFromYPosition()` (pixel→time, 15-min snap), click-to-add | Drop zone API, snap indicator, creation preview |
| `TimelineView.svelte` | 774 | Scroll coordination, drag-to-scroll, touch momentum | Cross-day drag, auto-scroll at edges |
| `AllDayEventStrip.svelte` | 195 | Click, lane layout | Drag between days |
| `MultiDayEventStrip.svelte` | 167 | Click, span rendering | Drag + resize |

### Переиспользуемая инфраструктура

| Модуль | Что даёт для v3.2.0 |
|--------|---------------------|
| `getTimeFromYPosition()` (DayColumn) | Pixel → time с 15-min snap — основа для расчёта нового времени |
| `EventBar` rem-позиционирование | Time → pixel — для ghost preview |
| `layoutTimelineEvents()` (EventBarContainer) | Collision layout — переиспользуется |
| `handleRecordChange()` (CalendarView) | Полная цепочка мутации: date shift + time preservation + endDate delta + validation + frontmatter write |
| `createPhantomRecord()` (lib/duplicate) | Preview-запись с `isPhantom` — адаптируется для drag ghost |
| `detectCollision()` / `timeRangesOverlap()` | Collision detection — для предупреждений при drag |
| `GestureCoordinator.ts` (593 строки) | State machine с `onDragStart/Move/End`, edge zone exclusion, long-press — расширить для bar DnD |
| `hapticFeedback()` / `applyDragFeedback()` | Touch feedback — переиспользуется |
| `getAnimationDuration()` / `getScrollBehavior()` | Instant/smooth режимы — для snap-анимации |

### Текущий hover-эффект EventBar

```css
/* Текущее поведение при наведении */
button.projects-calendar-event-bar:hover {
  background: color-mix(in srgb, var(--event-color) 25%, transparent);
  transform: translateX(0.125rem);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}
```

**GAP**: hover показывает только подсветку фона. Нет визуальных индикаторов для drag/resize.

### Текущий touch-tap в DayColumn

```
handleTouchEnd: duration < 300ms && !hasMoved
  → onDayTap() (month/2weeks)
  → onRecordAdd(day, getTimeFromYPosition(clientY)) (day/week)
```

**GAP**: Мгновенное создание без preview. Нет возможности скорректировать время перед подтверждением.

### Путь мутации данных (уже работает)

```
handleRecordChange(date, record)
  → validateRecordIntegrity(record)
  → extractDateWithPriority() → originalStart
  → Time preservation: HH:mm:ss из original + YYYY-MM-DD из target
  → EndDate delta: newEnd = originalEnd + (targetDate - originalStart) days
  → Validation: endDate >= startDate
  → api.updateRecord(updateRecordValues(record, updates), fields)
  → dataApi.doUpdateRecord() → frontmatter encode → vault.process()
```

**GAP**: Сигнатура `(date, record)` — нет параметра для нового времени. Нужно расширить.

---

## 🔧 Архитектура v3.2.0

### Принципы

1. **Расширение, не создание заново** — EventBar, DayColumn, TimelineView уже имеют ~60% инфраструктуры
2. **Custom DnD** — `svelte-dnd-action` не подходит для timeline (2D positioning, snap-to-grid, resize)
3. **Lightweight ghost** — drag preview как DOM element с `transform`, не Svelte re-render
4. **Desktop + Mobile параллельно** — через единый `TimelineDragManager`
5. **60fps** — всё через `requestAnimationFrame`, no re-render во время drag
6. **Haptic-first mobile** — каждое значимое действие сопровождается вибро-откликом
7. **Progressive disclosure** — резайз-зоны появляются только при взаимодействии, не загромождая интерфейс

### Диаграмма компонентов

```
CalendarView.svelte
├── handleRecordChange(date, record, options?)  ← РАСШИРИТЬ сигнатуру
│
├── InfiniteHorizontalCalendar (week/day)
│   └── TimelineView.svelte
│       ├── [DragOverlay.svelte]                ← НОВЫЙ: ghost + snap indicator
│       └── DayColumn.svelte                    ← РАСШИРИТЬ: drop zone, creation preview
│           ├── [CreationPreview.svelte]         ← НОВЫЙ: touch-tap preview bar
│           └── EventBarContainer.svelte
│               └── EventBar.svelte             ← РАСШИРИТЬ: drag/resize handles + triangles
│
├── [TimelineDragManager.ts]                    ← НОВЫЙ: координатор drag state
│   ├── initiate(record, pointerEvent, mode)
│   ├── move(clientX, clientY) → snap + cross-day
│   ├── commit() → handleRecordChange
│   ├── cancel()
│   └── modes: move | resize-top | resize-bottom | strip-move | strip-resize-start | strip-resize-end
│
├── [SnapEngine.ts]                             ← НОВЫЙ: snap calculations
│   ├── snapToInterval(minutes, interval)
│   └── getSnapLines(viewport)
│
├── [HapticManager.ts]                          ← НОВЫЙ: централизованный haptic
│   ├── tap() — лёгкий (создание)
│   ├── snap() — короткий (привязка к сетке)
│   ├── dragStart() — средний (начало drag)
│   └── error() — двойной (ошибка/отмена)
│
├── GestureCoordinator.ts                       ← РАСШИРИТЬ: passthrough при active drag
│
├── AllDayEventStrip.svelte                     ← РАСШИРИТЬ: mousedown/touchstart, horizontal drag
├── MultiDayEventStrip.svelte                   ← РАСШИРИТЬ: body drag + edge resize (◤ left, ◢ right)
├── HeaderStripsSection.svelte                  ← РАСШИРИТЬ: strip-segment DnD в flex-grid
└── EventList.svelte                            ← РАСШИРИТЬ: убрать disableDrag={isMobile}
```

### Новые файлы

| Файл | Путь | Назначение |
|------|------|------------|
| `TimelineDragManager.ts` | `src/ui/views/Calendar/dnd/` | State machine: idle→dragging→committing. Координирует mouse/touch, snap, cross-day, ghost overlay |
| `SnapEngine.ts` | `src/ui/views/Calendar/dnd/` | Snap time к интервалу (15/30/60 min). Расчёт snap lines для визуализации |
| `DragOverlay.svelte` | `src/ui/views/Calendar/dnd/` | Абсолютно позиционированный ghost bar + горизонтальная snap-линия + time label |
| `CreationPreview.svelte` | `src/ui/views/Calendar/dnd/` | Preview-бар при touch-tap создании с треугольными handles |
| `HapticManager.ts` | `src/ui/views/Calendar/dnd/` | Централизованное управление вибро-откликом с паттернами |
| `types.ts` | `src/ui/views/Calendar/dnd/` | Типы DragState, SnapConfig, DragEvent, HapticPattern |

### Модифицируемые файлы

| Файл | Изменения |
|------|-----------|
| `EventBar.svelte` | +mousedown/touchstart, +drag state CSS, +треугольные resize handles (top-left, bottom-right), +hover-интеграция resize зон |
| `DayColumn.svelte` | +drop zone highlight, +snap indicator, +`onDrop(record, time)`, +CreationPreview mount, +touch-tap creation flow |
| `TimelineView.svelte` | +DragOverlay mount, +cross-day detection, +auto-scroll at edges, +allday section strip drop zone |
| `EventBarContainer.svelte` | +визуальный "gap" для ghost при drag (optional — Iteration 2+) |
| `CalendarView.svelte` | Расширить `handleRecordChange(date, record, options?: { startTime?, endTime? })` |
| `GestureCoordinator.ts` | +passthrough mode при `TimelineDragManager.isActive` |
| `AllDayEventStrip.svelte` | +mousedown/touchstart, +horizontal drag ghost, +hover grab cursor |
| `MultiDayEventStrip.svelte` | +body drag, +edge resize (left/right), +треугольные handles ◤◢ горизонтальные, +hover-интеграция |
| `HeaderStripsSection.svelte` | +strip-segment drag, +day column drop zone highlight, +lane recalculation after drop |
| `EventList.svelte` | Убрать `disableDrag={isMobile}` → включить touch DnD через svelte-dnd-action |
| `constants.ts` | +DnD-specific constants |

### Константы

```typescript
// src/ui/views/Calendar/dnd/types.ts
export const DND_CONSTANTS = {
  DRAG_THRESHOLD_PX: 5,           // Минимальное смещение для начала drag (отличие от click)
  LONG_PRESS_MS: 500,             // Touch: инициация drag
  SNAP_INTERVAL_DEFAULT: 15,      // Минуты
  SNAP_INTERVALS: [15, 30, 60],   // Доступные интервалы
  AUTO_SCROLL_ZONE_PX: 40,       // Зона у края для auto-scroll
  AUTO_SCROLL_SPEED: 3,          // px per frame
  GHOST_OPACITY: 0.7,
  MIN_DURATION_MINUTES: 15,       // Минимальная длительность при resize
  CREATION_DEFAULT_DURATION: 60,  // Длительность нового события при создании (минуты)
  CREATION_CONFIRM_TIMEOUT: 3000, // Таймаут auto-confirm для touch-tap creation (ms)
  TRIANGLE_SIZE_DESKTOP: 8,       // px — размер треугольника на десктопе
  TRIANGLE_SIZE_TOUCH: 12,        // px — размер треугольника на тач-устройствах
  TRIANGLE_TOUCH_AREA: 44,        // px — минимальная зона касания вокруг треугольника
} as const;

// Haptic patterns (вибро-ответ)
export const HAPTIC_PATTERNS = {
  TAP_CREATE: { duration: 30 },                     // Лёгкий — создание заметки
  DRAG_START: { duration: 50 },                     // Средний — начало drag/resize
  SNAP: { duration: 15 },                           // Короткий — привязка к сетке
  DROP: { duration: 40 },                           // Подтверждение — drop/commit
  RESIZE_LIMIT: { duration: [20, 50, 20] },         // Двойной — достигнут лимит (min duration)
  CANCEL: { duration: [15, 30, 15] },               // Тройной короткий — отмена
  CREATION_CONFIRM: { duration: [20, 40] },         // Два импульса — подтверждение создания
} as const;
```

---

## 🎨 Дизайн взаимодействия

### Треугольные Resize Grab-Points

Для изменения времени начала/конца EventBar'а используются **треугольные акцентные точки**:

```
  ◤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   ← Верхний handle (startTime)
  │ ▊                                        │      Треугольник TOP-LEFT
  │ ▊  Название заметки                      │      cursor: n-resize
  │ ▊  13:00 – 14:30                         │
  │ ▊                                        │
  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ◢   ← Нижний handle (endTime)
                                                    Треугольник BOTTOM-RIGHT
                                                    cursor: s-resize
```

**CSS реализация треугольника** (CSS border trick):

```css
/* Верхний треугольник — top-left */
.resize-handle-top {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  border-top: var(--triangle-size, 8px) solid var(--event-color);
  border-right: var(--triangle-size, 8px) solid transparent;
  cursor: n-resize;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 2;
}

/* Нижний треугольник — bottom-right */
.resize-handle-bottom {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 0;
  height: 0;
  border-bottom: var(--triangle-size, 8px) solid var(--event-color);
  border-left: var(--triangle-size, 8px) solid transparent;
  cursor: s-resize;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 2;
}
```

**Расширенная зона касания** (невидимая, для touch):

```css
/* Невидимая touch-зона 44px вокруг треугольника */
.resize-handle-top::before,
.resize-handle-bottom::before {
  content: '';
  position: absolute;
  width: 44px;
  height: 44px;
}
.resize-handle-top::before {
  top: -18px;
  left: -18px;
}
.resize-handle-bottom::before {
  bottom: -18px;
  right: -18px;
}

@media (pointer: coarse) {
  .resize-handle-top,
  .resize-handle-bottom {
    --triangle-size: 12px;  /* Увеличенный треугольник для touch */
  }
}
```

### Desktop: Hover-интеграция

На десктопе resize handles **интегрированы в hover-анимацию** EventBar'а. При наведении курсора:

**Фаза 1** (0ms): Стандартный hover — фон, тень, z-index  
**Фаза 2** (100ms): Треугольные handles fade in (opacity 0 → 1)  
**Фаза 3** (при подведении курсора к краю): Рамка-подсветка обозначает resize zone

```css
/* Интегрированный hover: фон + рамка + треугольники */
button.projects-calendar-event-bar:hover {
  background: color-mix(in srgb, var(--event-color) 25%, transparent);
  transform: translateX(0.125rem);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

/* Треугольники появляются с hover */
button.projects-calendar-event-bar:hover .resize-handle-top,
button.projects-calendar-event-bar:hover .resize-handle-bottom {
  opacity: 1;
}

/* При наведении на зону resize — подсвечиваем рамку */
button.projects-calendar-event-bar:hover .resize-handle-top:hover ~ .resize-border,
.resize-handle-top:hover {
  /* Верхняя граница подсвечивается */
}

button.projects-calendar-event-bar:hover:has(.resize-handle-top:hover) {
  border-top: 2px solid var(--event-color);
  cursor: n-resize;
}

button.projects-calendar-event-bar:hover:has(.resize-handle-bottom:hover) {
  border-bottom: 2px solid var(--event-color);
  cursor: s-resize;
}
```

**Визуальный flow (Desktop):**

```
1. Курсор вне бара:
   │ Название заметки  │   ← Обычный вид, треугольники скрыты

2. Hover на бар:
   ◤─────────────────── │   ← Фон ярче, тень, треугольники видны
   │ Название заметки  │
   └──────────────── ◢│

3. Hover на верхний треугольник:
   ◤════════════════════│   ← Верхняя рамка акцентная, cursor: n-resize
   │ Название заметки  │
   └──────────────── ◢│

4. Начат drag верхнего:
   ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤   ← Snap-линия + time label "12:45"
   ◤════════════════════│      Ghost бар следует за курсором
   │ Название заметки  │
   └──────────────── ◢│
```

### Mobile: Long-Press активация

На тач-устройствах resize handles **появляются после long-press** (500ms):

```
1. Касание EventBar (0ms):
   │ Название заметки  │   ← Нет изменений (может быть scroll)

2. Long-press (500ms) — haptic DRAG_START:
   ◤─────────────────── │   ← Увеличенные треугольники (12px), haptic feedback
   │ Название заметки  │      Бар слегка приподнимается (scale: 1.02, shadow)
   └──────────────── ◢│

3. Drag за тело бара:
   ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤   ← Ghost + snap-линия. Haptic SNAP при каждом snap
   ◤═══════════════════ │
   │ Название заметки  │
   └──────────────── ◢│

4. Drag за треугольник:
   ◤═══════════════════ │   ← Resize mode. Ghost показывает новую высоту
   │ Название заметки  │
   △╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤   ← Bottom edge drag
                         ◢
```

### Haptic Feedback Matrix

Каждое значимое действие на mobile сопровождается вибро-откликом:

| Действие | Паттерн | Длительность | Назначение |
|----------|---------|-------------|------------|
| Touch-tap создание | `TAP_CREATE` | 30ms | Подтверждение точки касания |
| Начало drag | `DRAG_START` | 50ms | "Схватил" — начало перемещения |
| Snap к 15-min | `SNAP` | 15ms | Микро-feedback при привязке к сетке |
| Drop/commit | `DROP` | 40ms | Подтверждение изменения |
| Resize начат | `DRAG_START` | 50ms | "Схватил край" |
| Достигнут min (15m) | `RESIZE_LIMIT` | 20+50+20ms | Двойной — нельзя сжать меньше |
| Отмена drag | `CANCEL` | 15+30+15ms | Тройной — действие отменено |
| Preview подтверждён | `CREATION_CONFIRM` | 20+40ms | Два импульса — заметка создана |
| Cross-day переход | `SNAP` | 15ms | Перешёл на новый день при drag |

**Реализация через `HapticManager`**:

```typescript
// HapticManager.ts
export class HapticManager {
  static vibrate(pattern: HapticPattern): void {
    if ('vibrate' in navigator) {
      const duration = Array.isArray(pattern.duration)
        ? pattern.duration 
        : [pattern.duration];
      navigator.vibrate(duration);
    }
  }
  
  static tapCreate() { this.vibrate(HAPTIC_PATTERNS.TAP_CREATE); }
  static dragStart() { this.vibrate(HAPTIC_PATTERNS.DRAG_START); }
  static snap()      { this.vibrate(HAPTIC_PATTERNS.SNAP); }
  static drop()      { this.vibrate(HAPTIC_PATTERNS.DROP); }
  static resizeLimit(){ this.vibrate(HAPTIC_PATTERNS.RESIZE_LIMIT); }
  static cancel()    { this.vibrate(HAPTIC_PATTERNS.CANCEL); }
  static confirm()   { this.vibrate(HAPTIC_PATTERNS.CREATION_CONFIRM); }
}
```

---

## 📱 Touch-Tap создание заметок

### Текущее поведение

`DayColumn.svelte`: tap (< 300ms, no movement) → `onRecordAdd(day, time)` → мгновенное создание без preview.

### Новый flow: Creation Preview

В **дневном масштабе** (day view / week bars mode) touch-tap создаёт не заметку сразу, а **preview-бар** с возможностью корректировки:

```
1. Touch-tap на пустую область (< 300ms):
   ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤   ← Snap-линия + "13:00"
   ◤═══════════════════ │   ← Preview-бар появляется (haptic TAP_CREATE)
   │ + Новая заметка   │      Высота = 1 час (default), полупрозрачный
   │   13:00 – 14:00   │      Акцентный цвет
   └──────────────── ◢│   ← Треугольные handles СРАЗУ ВИДНЫ
   
2. Опционально: drag за треугольник — корректировка времени
   ◤═══════════════════ │   ← Resize top: двигаем startTime
   │ + Новая заметка   │
   │   12:30 – 14:00   │
   │                    │
   └──────────────── ◢│   ← Resize bottom: двигаем endTime

3. Подтверждение (любой из вариантов):
   a) Tap вне preview-бара            → confirm + open note
   b) Tap на preview-бар              → confirm + open note  
   c) Таймаут (3 сек без действий)    → confirm + open note
   d) Swipe away / Escape             → cancel (haptic CANCEL)
```

**Отличие от существующего drag**: touch-tap creation — это **tap на пустое место**, а не long-press на бар. Механизмы не конфликтуют:

| Жест | Область | Действие |
|------|---------|----------|
| Tap (< 300ms) | Пустая колонка | Creation Preview |
| Long-press (500ms) | Существующий EventBar | Drag/Resize mode |
| Click (desktop) | Пустая колонка | Мгновенное создание (текущее поведение) |
| Click (desktop) | Существующий EventBar | Открыть заметку |

### CreationPreview.svelte

```svelte
<!-- Компонент preview-бара при touch-tap создании -->
<div 
  class="creation-preview"
  class:confirming={state === 'confirming'}
  style="
    top: {topRem}rem; 
    height: {heightRem}rem;
    --event-color: var(--text-accent);
  "
>
  <!-- Верхний треугольник — top-left (startTime resize) -->
  <div 
    class="resize-handle-top visible"
    on:touchstart|preventDefault={handleResizeTopStart}
  ></div>
  
  <div class="creation-preview-content">
    <span class="creation-icon">+</span>
    <span class="creation-time">{startTime} – {endTime}</span>
  </div>
  
  <!-- Нижний треугольник — bottom-right (endTime resize) -->
  <div 
    class="resize-handle-bottom visible"
    on:touchstart|preventDefault={handleResizeBottomStart}
  ></div>
</div>
```

**CSS для CreationPreview:**

```css
.creation-preview {
  position: absolute;
  left: 0.25rem;
  right: 0.25rem;
  background: color-mix(in srgb, var(--event-color) 20%, transparent);
  border: 2px dashed var(--event-color);
  border-radius: 0.25rem;
  animation: preview-appear 0.2s ease-out;
  z-index: 20;
}

/* Треугольники ВСЕГДА видны на creation preview */
.creation-preview .resize-handle-top,
.creation-preview .resize-handle-bottom {
  opacity: 1;
}

@keyframes preview-appear {
  from { opacity: 0; transform: scaleY(0.8); }
  to { opacity: 1; transform: scaleY(1); }
}

/* Подтверждение — бар становится непрозрачным */
.creation-preview.confirming {
  background: color-mix(in srgb, var(--event-color) 15%, transparent);
  border-style: solid;
  border-width: 0 0 0 3px;
  animation: preview-confirm 0.2s ease-out;
}
```

### Desktop click-to-add (без изменений)

На десктопе click по пустой области колонки — **мгновенное создание** (текущее поведение `handleBackgroundClick`). Preview не нужен, т.к. есть мышь для точного позиционирования. Hover-эффект на колонке достаточен для обратной связи.

---

## 📅 Итерации реализации

### Итерация 1: Вертикальный drag + Resize + Hover (Desktop)

**Scope**: Перемещение EventBar вверх/вниз в одном DayColumn + resize через треугольные handles + hover-интеграция.

**Задачи:**
1. Создать `src/ui/views/Calendar/dnd/` — types.ts, SnapEngine.ts, TimelineDragManager.ts, HapticManager.ts
2. `EventBar.svelte` — добавить:
   - HTML: два `<div class="resize-handle-top/bottom">` (треугольники)
   - CSS: hover-интеграция (треугольники видны при наведении, рамка при hover на triangle zone)
   - JS: `on:mousedown` с DRAG_THRESHOLD проверкой, различие drag body vs resize handle
3. `DragOverlay.svelte` — ghost элемент: полупрозрачный bar + snap-линия + time label
4. `DayColumn.svelte` — snap indicator (горизонтальная линия), вызов `getTimeFromYPosition()` при drag
5. `TimelineView.svelte` — mount DragOverlay, вертикальный auto-scroll
6. `CalendarView.svelte` — расширить `handleRecordChange` для приёма `startTime`/`endTime`
7. `TimelineDragManager` — два режима: `drag` (перемещение) и `resize-top`/`resize-bottom` (изменение длительности)
8. Тесты для SnapEngine, HapticManager

**Результат**: На десктопе — hover показывает треугольники, drag за тело бара меняет время, drag за треугольник меняет длительность. Snap к 15-min с визуальным индикатором.

### Итерация 2: Cross-day drag (неделя)

**Scope**: Перемещение EventBar между DayColumn'ами.

**Задачи:**
1. `TimelineDragManager` — определение целевого DayColumn по clientX
2. `DayColumn` — highlight при hover во время drag
3. Комбинация: новая дата (X) + новое время (Y)
4. `GestureCoordinator` — passthrough mode для edge zone при active drag
5. Auto-scroll горизонтальный при приближении к краям week view

**Результат**: Drag EventBar из понедельника в среду → дата + время обновляются.

### Итерация 3: Touch/Mobile + Haptic

**Scope**: Long-press → drag/resize на мобильных + полная система haptic feedback.

**Задачи:**
1. Long-press detection (500ms) → треугольники появляются + haptic DRAG_START
2. Haptic feedback на ВСЕХ этапах: snap, drop, cancel, resize limit
3. Увеличенные треугольники для touch (`--triangle-size: 12px`) + расширенная touch-зона (44px)
4. Cancel drag при edge zone touch
5. Scroll-to-edge при приближении к границам
6. Различение: drag за тело бара (перемещение) vs drag за треугольник (resize)

**Результат**: Long-press на EventBar → haptic → треугольники видны → drag/resize → snap с haptic → drop с haptic.

### Итерация 4: Touch-Tap создание заметок (Day view)

**Scope**: Preview-бар при tap на пустую область + resize handles для корректировки времени.

**Задачи:**
1. `CreationPreview.svelte` — preview-бар с треугольными handles (всегда видны)
2. `DayColumn.svelte` — переключение touch-tap с мгновенного создания на preview mode
3. Preview flow: tap → preview бар 1 час → опционально resize → confirm/cancel
4. Auto-confirm через 3 секунды
5. Haptic: TAP_CREATE при появлении, SNAP при resize, CREATION_CONFIRM при подтверждении
6. Анимация появления и подтверждения preview

**Результат**: Touch-tap на пустую область → появляется preview-бар с треугольниками → можно скорректировать время → подтверждение создаёт заметку.

### Итерация 5: AllDay/MultiDay Strip DnD (Timeline)

**Scope**: Горизонтальный drag AllDay strips (смена даты) и MultiDay strips (перемещение span / resize краёв) в секции allday timeline view.

**Контекст компонентов:**

| Компонент | Позиционирование | Граница | Особенности |
|-----------|-----------------|---------|-------------|
| `AllDayEventStrip` | `position: absolute`, `topPosition = rowIndex * ROW_HEIGHT` | `border-left: 3px solid` | Однодневный, один strip = одно событие |
| `MultiDayEventStrip` | `position: absolute`, `left:0, right:0` | `border-top: 3px solid` | `isFirstDay` → левая граница + title, `isLastDay` → правая граница |
| Timeline allday section | `.projects-calendar-allday-column` per day, flex: 1 | `border-right: 1px solid` | Абсолютное позиционирование strips внутри колонок |

**Дизайн взаимодействия — AllDay Strip:**

```
  Исходное состояние (week view allday section):
  ┌─Mon──┬─Tue──┬─Wed──┬─Thu──┬─Fri──┐
  │▊Event│      │      │      │      │  ← AllDay strip в понедельнике
  └──────┴──────┴──────┴──────┴──────┘

  Desktop hover:
  ┌─Mon──┬─Tue──┬─Wed──┬─Thu──┬─Fri──┐
  │▊Event│      │      │      │      │  ← cursor: grab, фон ярче
  └──────┴──────┴──────┴──────┴──────┘

  Drag в среду:
  ┌─Mon──┬─Tue──┬─Wed──┬─Thu──┬─Fri──┐
  │      │      │▊Event│      │      │  ← Ghost strip + target column highlight
  └──────┴──────┴══════┴──────┴──────┘
                  ↑ accent border
```

**Дизайн взаимодействия — MultiDay Strip:**

```
  Исходное состояние (3-дневное событие Mon→Wed):
  ┌─Mon──┬─Tue──┬─Wed──┬─Thu──┬─Fri──┐
  │◤Event  name────────◢│      │      │  ← border-top: 3px, isFirst→isLast
  └──────┴──────┴──────┴──────┴──────┘

  Desktop hover — треугольники видны:
  ┌─Mon──┬─Tue──┬─Wed──┬─Thu──┬─Fri──┐
  │◤Event  name────────◢│      │      │  ← ◤(startDate) ◢(endDate) handles
  └──────┴──────┴──────┴──────┴──────┘

  Drag за тело (move) — сдвиг всего span на Tue→Thu:
  ┌─Mon──┬─Tue──┬─Wed──┬─Thu──┬─Fri──┐
  │      │◤Event  name────────◢│      │  ← Весь span сдвинулся
  └──────┴══════┴══════┴══════┴──────┘

  Drag за ◢ right edge (resize end) — Wed→Fri:
  ┌─Mon──┬─Tue──┬─Wed──┬─Thu──┬─Fri──┐
  │◤Event  name  extended─────────────◢│  ← endDate расширен до Fri
  └──────┴──────┴──────┴──────┴══════┘
                                  ↑ resize cursor

  Drag за ◤ left edge (resize start) — Mon→Tue:
  ┌─Mon──┬─Tue──┬─Wed──┬─Thu──┬─Fri──┐
  │      │◤Event  name◢│      │      │  ← startDate сдвинут на Tue
  └──────┴══════┴══════┴──────┴──────┘
```

**CSS для горизонтальных треугольников (MultiDay):**

```css
/* Левый треугольник — startDate edge (на isFirstDay сегменте) */
.multiday-strip .resize-handle-start {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  border-left: var(--triangle-size, 8px) solid var(--event-color);
  border-bottom: var(--triangle-size, 8px) solid transparent;
  cursor: ew-resize;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 2;
}

/* Правый треугольник — endDate edge (на isLastDay сегменте) */
.multiday-strip .resize-handle-end {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 0;
  height: 0;
  border-right: var(--triangle-size, 8px) solid var(--event-color);
  border-top: var(--triangle-size, 8px) solid transparent;
  cursor: ew-resize;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 2;
}

/* Hover — треугольники видны */
.multiday-strip:hover .resize-handle-start,
.multiday-strip:hover .resize-handle-end {
  opacity: 1;
}

/* Touch увеличенные зоны */
.multiday-strip .resize-handle-start::before,
.multiday-strip .resize-handle-end::before {
  content: '';
  position: absolute;
  width: 44px;
  height: 44px;
}
```

**Задачи:**
1. Расширить `TimelineDragManager` тремя новыми режимами: `strip-move`, `strip-resize-start`, `strip-resize-end`
2. `AllDayEventStrip.svelte` — добавить:
   - `on:mousedown` / `on:touchstart` → `TimelineDragManager.initiate(record, event, 'strip-move')`
   - Hover: `cursor: grab` на десктопе
   - Drag state: `opacity: 0.4` на оригинале, ghost strip в overlay
3. `MultiDayEventStrip.svelte` — добавить:
   - HTML: `<div class="resize-handle-start">` на `isFirstDay` сегменте, `<div class="resize-handle-end">` на `isLastDay`
   - CSS: горизонтальные треугольники ◤ left, ◢ right (код выше)
   - JS: mousedown на handle → `TimelineDragManager.initiate(record, event, 'strip-resize-start|end')`
   - JS: mousedown на body → `TimelineDragManager.initiate(record, event, 'strip-move')`
   - Desktop hover: треугольники fade-in, border highlight при hover на handle zone
4. `TimelineView.svelte` allday section — добавить:
   - Drop zone highlight на целевой колонке (accent border)
   - Ghost overlay для strip (абсолютно позиционированный в allday section)
5. Column detection: map `clientX` → day index через `dayColumns[].getBoundingClientRect()`
   (переиспользуется из Iteration 2 cross-day detection)
6. `TimelineDragManager.commit()` для strip modes:
   - `strip-move` (AllDay): `handleRecordChange(targetDate, record)` — дата меняется, время сохраняется
   - `strip-move` (MultiDay): shift всего span — `startDate += delta`, `endDate += delta`
   - `strip-resize-start`: изменить startDate, endDate остаётся
   - `strip-resize-end`: изменить endDate, startDate остаётся
7. Constraint: `endDate >= startDate` (минимум 1 день для MultiDay)
8. Mobile: long-press (500ms) → haptic DRAG_START → треугольники видны → drag
9. Haptic: SNAP при переходе между колонками, DROP при commit
10. Тесты: strip drag column detection, resize constraints, delta calculation

**Результат**: В timeline allday section — AllDay strips можно перетаскивать горизонтально между днями. MultiDay strips: drag за тело = перемещение, drag за треугольные handles = resize span. Desktop hover показывает grab-точки. Mobile через long-press + haptic.

### Итерация 6: Headers View DnD — Mobile + Strip DnD

**Scope**: Включение mobile DnD в headers mode (Month/2weeks) + горизонтальный strip DnD в `HeaderStripsSection` flex-grid + визуальные улучшения.

**Контекст компонентов:**

| Компонент | Текущий DnD | Проблема |
|-----------|------------|----------|
| `EventList.svelte` | `svelte-dnd-action` dndzone | `disableDrag={isMobile}` → на мобильных DnD отключён |
| `Day.svelte` | `handleDndFinalize` → `onRecordChange` | `disableDrag` прокидывается из родителя |
| `HeaderStripsSection.svelte` | НЕТ DnD | Flex-grid strips не draggable |

**Часть A: Mobile DnD для Event Lists**

```
  Текущее поведение (mobile, Month view):
  ┌─Mon─┐  ┌─Tue─┐  ┌─Wed─┐
  │Event1│  │Event3│  │     │  ← Нет drag, только tap для open
  │Event2│  │     │  │     │
  └─────┘  └─────┘  └─────┘

  Новое поведение (mobile, long-press на EventList item):
  ┌─Mon─┐  ┌─Tue─┐  ┌─Wed─┐
  │Event1│  │Event3│  │     │  ← Long-press Event2 → haptic
  │ ░░░ │  │     │  │     │  ← Ghost Event2 следует за пальцем
  └─────┘  └══════┘  └─────┘
             ↑ drop zone highlight
```

**Задачи (Часть A):**
1. `EventList.svelte` — убрать условную отрисовку `{#if disableDrag}` / `{:else}`
   - Вместо этого: всегда рендерить с `use:dndzone`, но с `delay: 500` для touch (long-press)
   - `svelte-dnd-action` уже поддерживает touch через `dropTargetStyle`/`morphDisabled`
2. `Day.svelte` — убрать `disableDrag={isMobile}` prop или сделать его always false
3. Обновить `dndOptions`: добавить `dragDisabled: false` для mobile, `type: 'entries'`
4. Haptic integration: `DRAG_START` при long-press activate, `DROP` при finalize
5. Visual: drop zone highlight на мобильных (accent border вокруг Day container)

**Часть B: Strip DnD в HeaderStripsSection**

```
  Текущая структура HeaderStripsSection (Month/2weeks):
  ┌──Mon──┬──Tue──┬──Wed──┬──Thu──┬──Fri──┐
  │▊Event ──────────────────────▊│       │  ← lane 0: MultiDay Mon→Thu
  │       │▊AllDay│       │       │       │  ← lane 1: AllDay Tue only
  └───────┴───────┴───────┴───────┴───────┘

  Структура flex-grid:
  .multiday-lane (lane 0):
    .strip-segment.is-start  │ .strip-segment.is-mid  │ .strip-segment.is-mid  │ .strip-segment.is-end  │ .strip-empty
  .multiday-lane (lane 1):
    .strip-empty  │ .strip-segment.is-only  │ .strip-empty  │ .strip-empty  │ .strip-empty
```

**Подход к strip DnD в flex-grid:**

В HeaderStripsSection strips реализованы как `flex: 1 1 0` сегменты в строках-lanes. Это **отличается** от TimelineView (absolute positioning). Два варианта:

- **Вариант A**: Использовать custom DnD (как timeline) — mousedown на сегменте, ghost overlay, clientX → target day
- **Вариант B**: Переработать на `svelte-dnd-action` horizontal zones

**Выбор: Вариант A** (custom DnD) — согласуется с Iteration 5 и обеспечивает единый подход через `TimelineDragManager`.

**Дизайн взаимодействия:**

```
  1. Desktop hover на MultiDay strip:
  ┌──Mon──┬──Tue──┬──Wed──┬──Thu──┬──Fri──┐
  │◤Event ──────────────────────◢│       │  ← Треугольники на start/end
  └───────┴───────┴───────┴───────┴───────┘

  2. Drag за тело (move) — сдвиг Mon→Thu ⟹ Tue→Fri:
  ┌──Mon──┬──Tue──┬──Wed──┬──Thu──┬──Fri──┐
  │       │◤Event ──────────────────────◢│  ← Весь span сдвинулся +1 день
  └───────┴═══════┴═══════┴═══════┴═══════┘

  3. Drag за ◢ right edge (resize) — Thu→Fri:
  ┌──Mon──┬──Tue──┬──Wed──┬──Thu──┬──Fri──┐
  │◤Event ────────────────────────────────◢│  ← endDate → Fri
  └───────┴───────┴───────┴───────┴═══════┘

  4. AllDay strip drag:
  ┌──Mon──┬──Tue──┬──Wed──┬──Thu──┬──Fri──┐
  │       │       │       │▊Event│       │  ← Перемещён из Mon в Thu
  └───────┴───────┴───────┴═══════┴───────┘
```

**Задачи (Часть B):**
1. `HeaderStripsSection.svelte` — добавить event handlers на `.strip-segment`:
   - `on:mousedown` / `on:touchstart` → определить тип действия (move vs resize)
   - Для `.is-start` сегмента: mousedown на левый край → `strip-resize-start`
   - Для `.is-end` сегмента: mousedown на правый край → `strip-resize-end`
   - mousedown на body любого сегмента → `strip-move`
2. HTML: добавить `<div class="resize-handle-start">` в `.is-start`/`.is-only` сегменты и `<div class="resize-handle-end">` в `.is-end`/`.is-only`
3. Column detection: map `clientX` → day index через flex column `getBoundingClientRect()`
4. Ghost overlay: strip ghost поверх flex-grid (absolute positioned в контейнере HeaderStripsSection)
5. Drop visual: accent border на целевой day column при drag-over
6. `TimelineDragManager` commit для flex-grid context:
   - Тот же алгоритм что и в Iteration 5: `strip-move` → shift dates, `strip-resize-*` → change edge
7. Lane recalculation: после drop lanes могут перестроиться → reactive update через existing `getEventsForWeek()`
8. Mobile: long-press (500ms) на strip-segment → haptic → drag
9. Haptic: SNAP при переходе между днями, DROP при commit
10. Тесты: flex column detection, strip segment identification, lane rebuild scenarios

**Результат**: Month/2weeks views — AllDay/MultiDay strip segments draggable. Drag за тело = перемещение span. Drag за треугольные handles = resize. Mobile event list DnD включён. Visual feedback (column highlight) при всех drag операциях.

---

## 📐 API контракты

### TimelineDragManager

```typescript
interface TimelineDragManager {
  readonly isActive: boolean;
  readonly state: DragState;
  readonly mode: DragMode;
  
  initiate(record: ProcessedRecord, event: PointerEvent | TouchEvent, mode: DragMode): void;
  move(clientX: number, clientY: number): void;
  commit(): void;
  cancel(): void;
  
  // Observables (Svelte stores)
  ghostPosition: Writable<GhostPosition | null>;
  snapTime: Writable<string | null>;
  targetDay: Writable<dayjs.Dayjs | null>;
}

type DragState = 'idle' | 'pending' | 'dragging' | 'committing';
type DragMode = 
  | 'move'               // Вертикальный drag EventBar (time change)
  | 'resize-top'         // Resize верхний край EventBar (startTime)
  | 'resize-bottom'      // Resize нижний край EventBar (endTime)
  | 'strip-move'         // Горизонтальный drag strip (date change)
  | 'strip-resize-start' // Resize левый край MultiDay strip (startDate)
  | 'strip-resize-end';  // Resize правый край MultiDay strip (endDate)

interface GhostPosition {
  topRem: number;
  heightRem: number;
  dayColumnIndex: number;
  time: string;        // "14:30"
  endTime: string;     // "15:30" (for resize)
  date: dayjs.Dayjs;   // target day
}
```

### SnapEngine

```typescript
interface SnapEngine {
  snapMinutes(minutes: number, interval?: number): number;
  snapTime(time: string, interval?: number): string;
  getSnapLines(startHour: number, endHour: number, interval: number): SnapLine[];
}

interface SnapLine {
  minutes: number;
  time: string;
  positionRem: number;
  type: 'major' | 'minor';  // hour boundary vs sub-hour
}
```

### CreationPreview

```typescript
interface CreationPreviewState {
  active: boolean;
  day: dayjs.Dayjs;
  startTime: string;     // "13:00"
  endTime: string;       // "14:00"
  resizing: 'none' | 'top' | 'bottom';
  confirmTimer: number | null;
}

// Events
type CreationPreviewEvent = 
  | { type: 'confirm'; day: dayjs.Dayjs; startTime: string; endTime: string }
  | { type: 'cancel' }
  | { type: 'resize'; edge: 'top' | 'bottom'; time: string };
```

### Расширенный handleRecordChange

```typescript
// Было:
handleRecordChange(date: dayjs.Dayjs, record: DataRecord): void

// Стало:
handleRecordChange(
  date: dayjs.Dayjs, 
  record: DataRecord, 
  options?: {
    startTime?: string;   // "14:30"
    endTime?: string;     // "15:45"
    preserveTime?: boolean; // false = use provided time, true = keep original (default)
    endDate?: dayjs.Dayjs; // Новая конечная дата (для strip resize)
  }
): void
```

### Strip Drag API

```typescript
// Дополнительные типы для strip DnD

interface StripDragContext {
  record: ProcessedRecord;
  renderType: EventRenderType;  // ALL_DAY | MULTI_DAY_ALLDAY | MULTI_DAY_TIMED
  originalStartDate: dayjs.Dayjs;
  originalEndDate: dayjs.Dayjs;
  spanDays: number;             // Длительность span в днях
  sourceView: 'timeline' | 'headers';  // Контекст: allday section или HeaderStripsSection
}

interface StripGhostPosition {
  startDayIndex: number;   // Индекс первого дня в текущем grid
  endDayIndex: number;     // Индекс последнего дня
  laneIndex: number;       // Номер lane (строки)
  targetDate: dayjs.Dayjs; // Новая начальная дата
}

// Column detection utility
interface DayColumnMap {
  columns: DOMRect[];     // getBoundingClientRect() каждой колонки
  days: dayjs.Dayjs[];    // Даты соответствующих колонок
  getDayFromClientX(clientX: number): { day: dayjs.Dayjs; index: number } | null;
}
```

---

## ⚠️ Риски и решения

| Риск | Описание | Решение |
|------|----------|---------|
| **Scroll vs Drag** | mousedown на EventBar может быть началом scroll | DRAG_THRESHOLD (5px) — до 5px считается click/scroll, после — drag |
| **GestureCoordinator conflicts** | Edge zones (50px) могут перехватить drag у края экрана | `passthrough` mode при `TimelineDragManager.isActive` |
| **iOS touch** | Obsidian mobile перехватывает touch для sidebar/back | Long-press 500ms через GestureCoordinator. `stopPropagation` при active drag |
| **60fps** | Re-render EventBar'ов при каждом mousemove | Ghost — lightweight DOM element с `transform: translate()`. Основная сетка НЕ перерисовывается до drop |
| **Multi-window** | Obsidian pop-out windows | `activeDocument`/`activeWindow` паттерн (уже используется) |
| **handleRecordChange time** | Текущая сигнатура без времени | Обратно-совместимое расширение с `options?` параметром |
| **Instant mode** | Ghost animation должна учитывать настройку | `getAnimationDuration()` для snap-анимации ghost |
| **Tap vs Creation Preview** | Tap на колонку может быть началом scroll | `hasMoved` check (> 10px) уже в DayColumn. Preview только при clean tap |
| **Creation preview vs existing bars** | Preview может перекрыть EventBar | z-index: 20 для preview. Collision detection при размещении |
| **Triangle touch area overlap** | Два треугольника на очень коротких барах | MIN_VISUAL_MINUTES = 20 (уже в EventBar). Треугольники разведены: top-LEFT vs bottom-RIGHT |
| **Haptic availability** | Не все устройства поддерживают vibrate | `if ('vibrate' in navigator)` guard в HapticManager |
| **Reactivity при drag** | Svelte может перерендерить бары во время drag | Ghost — чистый DOM, отделён от реактивной системы. Финальный commit вызывает один reactive update |
| **CSS :has() support** | `:has()` не поддерживается в старых браузерах | Fallback через JS mouseenter на resize-handle + class toggle |
| **AllDay strip small target** | AllDay strip — узкий (1.25rem desktop), сложно захватить | `cursor: grab` на всей площади strip, не нужны треугольники (однодневное событие) |
| **MultiDay flex vs absolute** | Разные layout-модели: absolute в TimelineView, flex в HeaderStripsSection | `DayColumnMap` абстракция: `getBoundingClientRect()` работает одинаково в обоих контекстах |
| **MultiDay span constraint** | При resize нельзя сжать MultiDay до 0 дней | Constraint: `endDate >= startDate` (минимум 1 день). Haptic `RESIZE_LIMIT` при достижении лимита |
| **Lane shift after drop** | После перемещения strip в HeaderStripsSection lanes могут перестроиться | `getEventsForWeek()` вызывается реактивно после `handleRecordChange` → lanes пересчитываются автоматически |
| **svelte-dnd-action touch delay** | Long-press 500ms может конфликтовать с scroll | Настройка `dropTargetStyle` + `delay` параметра dndzone для touch |
| **disableDrag removal side effects** | Убирание disableDrag может повлиять на scroll в mobile list | Тестирование svelte-dnd-action touch scrolling behaviour. Fallback: кастомный long-press порог |

---

## 🔗 Связанные документы

- [CHANGELOG](../CHANGELOG.md) — История изменений
- [User Guide](user-guide.md) — Руководство пользователя  
- [Pre-development Analysis](../.ai_internal/v3.2.0_dnd_analysis.md) — Детальный анализ кодовой базы (23.02.2026)
- [Code Standards](CODE_STANDARDS.md) — Стандарты кода

---

## 📝 История изменений

| Версия | Дата | Изменения |
|--------|------|-----------|
| 0.1.0 | 2026-01-27 | Начальная спецификация |
| 1.0.0 | 2026-03-09 | Полная переработка на основе реального состояния кодовой базы v3.1.0 |
| 1.1.0 | 2026-03-09 | Добавлено: дизайн треугольных grab-points, hover-интеграция resize зон, haptic feedback matrix, touch-tap creation preview flow, CreationPreview.svelte, HapticManager.ts. Итерации перестроены: resize объединён с Iteration 1, touch-tap creation выделен в Iteration 4 |
| 1.2.0 | 2026-03-09 | Полное покрытие DnD: Iteration 5 (AllDay/MultiDay strip DnD в timeline allday section — горизонтальный drag + resize), Iteration 6 (Headers view mobile DnD + strip DnD в flex-grid HeaderStripsSection). Обновлены: обзор с таблицей покрытия, диаграмма компонентов, модифицируемые файлы, API контракты (StripDragContext, DayColumnMap, расширенные DragMode), таблица рисков (+6 strip-специфических) |
| 1.3.0 | 2026-03-10 | ВСЕ 6 итераций реализованы. Iter 3: Touch/Mobile + Haptic (long-press, GestureCoordinator passthrough). Iter 4: Touch-Tap CreationPreview (автоподтверждение 3с, resize handles). Iter 5: AllDay/MultiDay strip DnD (strip-move, strip-resize-start/end, stripGhostPosition store, endDate support в CalendarView). Iter 6: EventList mobile DnD (always-active dndzone), HeaderStripsSection strip DnD (self-contained TimelineDragManager per instance, DayColumnRef from flex-grid). Исправлены import paths (../../../dnd/ → ../../dnd/). Финальный аудит: 373/373 тестов, 0 TS ошибок, чистый build |
