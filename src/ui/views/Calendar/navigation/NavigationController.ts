/**
 * NavigationController - Централизованное управление навигацией календаря
 * 
 * Отвечает за:
 * - Навигацию к конкретной дате с позиционированием (start/center/end)
 * - Плавную анимацию прокрутки
 * - Координацию между вертикальным и горизонтальным календарями
 * 
 * @example
 * ```typescript
 * const nav = new NavigationController(animationController);
 * 
 * // Прокрутить к дате с центрированием
 * nav.scrollToDate(dayjs('2024-03-15'), 'center');
 * 
 * // Навигация на сегодня
 * nav.navigateToToday();
 * ```
 */

import dayjs from 'dayjs';
import type { AnimationController } from '../animation/AnimationController';

export type ScrollPosition = 'start' | 'center' | 'end';

/**
 * Интерфейс для компонентов календаря, поддерживающих навигацию
 */
export interface NavigableCalendar {
  findElementForDate(date: dayjs.Dayjs): HTMLElement | null;
  getScrollableParent(): HTMLElement | null;
  scrollToDate(date: dayjs.Dayjs, position?: ScrollPosition): void;
}

export class NavigationController {
  private verticalCalendar: NavigableCalendar | null = null;
  private horizontalCalendar: NavigableCalendar | null = null;
  private animationController: AnimationController;
  
  constructor(animationController: AnimationController) {
    this.animationController = animationController;
  }
  
  /**
   * Установить активный календарь для вертикальной навигации (month/2weeks)
   */
  setVerticalCalendar(calendar: NavigableCalendar | null): void {
    this.verticalCalendar = calendar;
  }
  
  /**
   * Установить активный календарь для горизонтальной навигации (week/day)
   */
  setHorizontalCalendar(calendar: NavigableCalendar | null): void {
    this.horizontalCalendar = calendar;
  }
  
  /**
   * Основной метод навигации к дате
   * 
   * @param date - Целевая дата
   * @param position - Позиция в viewport ('start', 'center', 'end')
   * @param animated - Использовать анимацию (default: true)
   */
  scrollToDate(
    date: dayjs.Dayjs,
    position: ScrollPosition = 'center',
    animated: boolean = true
  ): void {
    // Делегируем в соответствующий календарь
    if (this.verticalCalendar) {
      this.scrollVerticalCalendar(date, position, animated);
    } else if (this.horizontalCalendar) {
      this.scrollHorizontalCalendar(date, position, animated);
    }
  }
  
  /**
   * Навигация в вертикальном календаре (month/2weeks)
   */
  private scrollVerticalCalendar(
    date: dayjs.Dayjs,
    position: ScrollPosition,
    animated: boolean
  ): void {
    if (!this.verticalCalendar) return;
    
    // Find target element
    const element = this.verticalCalendar.findElementForDate(date);
    if (!element) {
      console.warn('[NavigationController] Element not found for date:', date.format());
      // Fallback to calendar's own method
      this.verticalCalendar.scrollToDate(date, position);
      return;
    }
    
    // Get scrollable container
    const container = this.verticalCalendar.getScrollableParent();
    if (!container) {
      console.warn('[NavigationController] No scrollable container found');
      return;
    }
    
    // Calculate target scroll offset
    const targetScroll = this.calculateScrollOffset(element, container, position);
    
    // Perform scroll (animated or instant)
    if (animated) {
      this.animateScroll(container, targetScroll.top, 400);
    } else {
      container.scrollTop = targetScroll.top;
    }
  }
  
  /**
   * Навигация в горизонтальном календаре (week/day)
   */
  private scrollHorizontalCalendar(
    date: dayjs.Dayjs,
    position: ScrollPosition,
    animated: boolean
  ): void {
    if (!this.horizontalCalendar) return;
    
    // Find target element
    const element = this.horizontalCalendar.findElementForDate(date);
    if (!element) {
      console.warn('[NavigationController] Element not found for date:', date.format());
      // Fallback to calendar's own method
      this.horizontalCalendar.scrollToDate(date, position);
      return;
    }
    
    // Get scrollable container
    const container = this.horizontalCalendar.getScrollableParent();
    if (!container) {
      console.warn('[NavigationController] No scrollable container found');
      return;
    }
    
    // Calculate target scroll offset
    const targetScroll = this.calculateScrollOffset(element, container, position);
    
    // Perform scroll (animated or instant)
    if (animated) {
      this.animateScroll(container, targetScroll.left, 400, 'left');
    } else {
      container.scrollLeft = targetScroll.left;
    }
  }
  
  /**
   * Вычислить scroll offset для заданной позиции
   */
  private calculateScrollOffset(
    element: HTMLElement,
    container: HTMLElement,
    position: ScrollPosition
  ): { top: number; left: number } {
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const currentScrollTop = container.scrollTop;
    const currentScrollLeft = container.scrollLeft;
    
    switch (position) {
      case 'start':
        return {
          top: currentScrollTop + (elementRect.top - containerRect.top),
          left: currentScrollLeft + (elementRect.left - containerRect.left)
        };
      
      case 'center':
        return {
          top: currentScrollTop + (elementRect.top - containerRect.top) - (containerRect.height - elementRect.height) / 2,
          left: currentScrollLeft + (elementRect.left - containerRect.left) - (containerRect.width - elementRect.width) / 2
        };
      
      case 'end':
        return {
          top: currentScrollTop + (elementRect.top - containerRect.top) - (containerRect.height - elementRect.height),
          left: currentScrollLeft + (elementRect.left - containerRect.left) - (containerRect.width - elementRect.width)
        };
    }
  }
  
  /**
   * Анимированный скролл с использованием AnimationController
   */
  private animateScroll(
    container: HTMLElement,
    targetOffset: number,
    duration: number,
    axis: 'top' | 'left' = 'top'
  ): void {
    const startOffset = axis === 'top' ? container.scrollTop : container.scrollLeft;
    const distance = targetOffset - startOffset;
    
    this.animationController.animate(
      `nav-scroll-${axis}`,
      (progress) => {
        const currentOffset = startOffset + distance * progress;
        if (axis === 'top') {
          container.scrollTop = currentOffset;
        } else {
          container.scrollLeft = currentOffset;
        }
      },
      duration
      // Use default easing (easeOutCubic)
    );
  }
  
  /**
   * Вычислить scroll offset для центрирования элемента
   */
  static calculateCenterOffset(
    element: HTMLElement,
    container: HTMLElement
  ): { top: number; left: number } {
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    return {
      top: elementRect.top - containerRect.top 
           - (containerRect.height - elementRect.height) / 2,
      left: elementRect.left - containerRect.left
           - (containerRect.width - elementRect.width) / 2,
    };
  }
  
  /**
   * Вычислить scroll offset для выравнивания по концу
   */
  static calculateEndOffset(
    element: HTMLElement,
    container: HTMLElement
  ): { top: number; left: number } {
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    return {
      top: elementRect.top - containerRect.top
           - (containerRect.height - elementRect.height),
      left: elementRect.left - containerRect.left
           - (containerRect.width - elementRect.width),
    };
  }
  
  /**
   * Навигация на сегодня
   */
  navigateToToday(): void {
    const today = dayjs();
    this.scrollToDate(today, 'center');
  }
}
