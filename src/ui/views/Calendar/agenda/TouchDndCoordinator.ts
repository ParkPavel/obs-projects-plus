/**
 * TouchDndCoordinator v1.0
 * ────────────────────────────────────────────────────────────────
 * Полноценный координатор жестов для мобильного DnD в Agenda.
 *
 * Проблема:
 *   svelte-dnd-action добавляет touchstart-листенеры на КАЖДЫЙ дочерний
 *   элемент dndzone. На мобильных это вызывает конфликт: скролл пальцем
 *   по элементу может случайно инициировать DnD.
 *
 * Решение:
 *   Используем штатный API библиотеки — dragHandleZone + dragHandle:
 *   · dragHandleZone стартует с dragDisabled:true → дети НЕ перехватывают касания
 *   · Только grip-элемент (use:dragHandle) активирует DnD
 *   · Остальная площадь элемента свободна для скролла, тапов, контекстного меню
 *
 * Этот модуль предоставляет:
 *   1. Gesture state machine — типизированные состояния жестов
 *   2. hapticFeedback() — тактильная отдача при начале перетаскивания
 *   3. isDragHandleTarget() — guard для исключения grip из context menu
 *   4. createLongPressHandler() — фабрика для long-press с защитой от grip и scroll
 *   5. GESTURE_CONFIG — настраиваемые пороги и задержки
 *
 * Схема состояний жестов (touch на не-grip области):
 *
 *               touchstart
 *   IDLE ─────────────────► PENDING
 *     │                       │
 *     │    ├─ dy > SCROLL_THRESHOLD (8px) → SCROLLING (native, no-op)
 *     │    ├─ touchend < TAP_DURATION (200ms) → TAP (click forwarded)
 *     │    └─ HOLD_DELAY (500ms) expires → CONTEXT_MENU
 *
 * Схема состояний жестов (touch на grip-области):
 *
 *               touchstart
 *   IDLE ─────────────────► DND_PENDING (dragHandle → dragDisabled=false)
 *     │                       │
 *     │    ├─ movement ≥ 3px → DRAGGING (svelte-dnd-action управляет)
 *     │    └─ touchend без движения → FALSE_ALARM (click forwarded)
 *
 * ────────────────────────────────────────────────────────────────
 */

// ── Gesture state types ────────────────────────────────────────

export const enum GestureState {
  /** Нет активного касания */
  IDLE = 'IDLE',
  /** Касание зарегистрировано, ожидаем определения типа жеста */
  PENDING = 'PENDING',
  /** Вертикальное движение обнаружено → нативный скролл */
  SCROLLING = 'SCROLLING',
  /** Быстрый тап → клик */
  TAP = 'TAP',
  /** Долгое нажатие → контекстное меню */
  CONTEXT_MENU = 'CONTEXT_MENU',
  /** DnD ожидает подтверждения (grip зажат) */
  DND_PENDING = 'DND_PENDING',
  /** Элемент перетаскивается */
  DRAGGING = 'DRAGGING',
}

// ── Configuration ─────────────────────────────────────────────

export interface GestureConfig {
  /** Порог вертикального движения для распознавания скролла (px) */
  scrollThreshold: number;
  /** Максимальная длительность тапа (ms) */
  tapDuration: number;
  /** Максимальное движение для тапа (px) */
  tapMaxMove: number;
  /** Задержка для long-press контекстного меню (ms) */
  holdDelay: number;
  /** Продолжительность вибрации при начале DnD (ms) */
  hapticDuration: number;
  /** CSS-класс для drag-ready состояния */
  dragReadyClass: string;
}

export const GESTURE_CONFIG: GestureConfig = {
  scrollThreshold: 8,
  tapDuration: 200,
  tapMaxMove: 10,
  holdDelay: 500,
  hapticDuration: 15,
  dragReadyClass: 'drag-activating',
};

// ── Drag Handle CSS selector ──────────────────────────────────

/** CSS-селектор grip-элемента для фильтрации в обработчиках событий */
export const DRAG_HANDLE_SELECTOR = '.drag-grip';

// ── Utility functions ─────────────────────────────────────────

/**
 * Проверяет, является ли touch target частью drag handle (grip).
 * Используется для исключения grip-области из обработки context menu.
 *
 * @param target — EventTarget от touch/mouse event
 * @returns true если target находится внутри drag handle
 */
export function isDragHandleTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return target.closest(DRAG_HANDLE_SELECTOR) !== null;
}

/**
 * Тактильная обратная связь (вибрация) при начале перетаскивания.
 * Безопасно работает на платформах без поддержки Vibration API.
 *
 * @param durationMs — продолжительность вибрации (по умолчанию из конфига)
 */
export function hapticFeedback(durationMs: number = GESTURE_CONFIG.hapticDuration): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Vibration API может быть заблокирован политикой безопасности
  }
}

/**
 * Добавляет визуальную обратную связь при активации drag.
 * Вызывается из transformDraggedElement callback в dndzone.
 *
 * @param el — перетаскивемый HTML-элемент (shadow)
 */
export function applyDragFeedback(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.style.maxHeight = '3rem';
  el.style.overflow = 'hidden';
  el.style.opacity = '0.9';
  el.style.borderRadius = '0.375rem';
  el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  hapticFeedback();
}

// ── Long-press handler factory ────────────────────────────────

export interface LongPressHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: () => void;
  destroy: () => void;
}

/**
 * Фабрика обработчиков long-press с защитой от:
 * - Grip-зоны (drag handle) — не запускается при касании grip
 * - Scroll — отменяется при вертикальном движении > scrollThreshold
 * - Множественных вызовов — корректная очистка таймеров
 *
 * @param onLongPress — callback при успешном long-press
 * @param config — настройки жестов (по умолчанию GESTURE_CONFIG)
 * @returns объект с обработчиками событий и методом очистки
 *
 * @example
 * ```svelte
 * <script>
 *   const longPress = createLongPressHandler((e) => showContextMenu(e));
 *   onDestroy(() => longPress.destroy());
 * </script>
 *
 * <div
 *   on:touchstart={longPress.onTouchStart}
 *   on:touchmove={longPress.onTouchMove}
 *   on:touchend={longPress.onTouchEnd}
 * >
 * ```
 */
export function createLongPressHandler(
  onLongPress: (e: TouchEvent) => void,
  config: GestureConfig = GESTURE_CONFIG,
): LongPressHandlers {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startY = 0;
  let isCancelled = false;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function onTouchStart(e: TouchEvent): void {
    // Guard: не запускаем long-press при касании drag handle
    if (isDragHandleTarget(e.target)) {
      isCancelled = true;
      return;
    }

    isCancelled = false;
    const touch = e.touches[0];
    if (!touch) return;
    startY = touch.clientY;

    clearTimer();
    timer = setTimeout(() => {
      if (!isCancelled) {
        onLongPress(e);
      }
      timer = null;
    }, config.holdDelay);
  }

  function onTouchMove(e: TouchEvent): void {
    if (isCancelled || timer === null) return;

    const touch = e.touches[0];
    if (!touch) return;

    const dy = Math.abs(touch.clientY - startY);
    if (dy > config.scrollThreshold) {
      // Вертикальное движение → скролл, отменяем long-press
      clearTimer();
      isCancelled = true;
    }
  }

  function onTouchEnd(): void {
    clearTimer();
    isCancelled = false;
  }

  function destroy(): void {
    clearTimer();
  }

  return { onTouchStart, onTouchMove, onTouchEnd, destroy };
}
