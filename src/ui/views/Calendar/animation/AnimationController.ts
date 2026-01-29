/**
 * AnimationController - Управление анимациями календаря
 * 
 * Особенности:
 * - Прерывает предыдущие анимации с тем же ключом
 * - Использует requestAnimationFrame для 60 FPS
 * - Поддерживает различные easing функции
 * - Автоматическая очистка завершенных анимаций
 * 
 * @example
 * ```typescript
 * const animator = new AnimationController();
 * 
 * // Запуск анимации
 * animator.animate('scroll', (progress) => {
 *   element.scrollLeft = startValue + (endValue - startValue) * progress;
 * }, 400);
 * 
 * // Прерывание анимации
 * animator.cancel('scroll');
 * ```
 */

export type EasingFunction = (t: number) => number;

export interface AnimationOptions {
  duration?: number;
  easing?: EasingFunction;
  onComplete?: () => void;
}

export class AnimationController {
  private activeAnimations = new Map<string, number>();
  
  /**
   * Запустить анимацию (прерывает предыдущую с тем же ключом)
   * 
   * @param key - Уникальный идентификатор анимации
   * @param updateFn - Функция обновления (получает progress 0-1)
   * @param duration - Длительность в миллисекундах (default: 300)
   * @param easing - Easing функция (default: easeOutCubic)
   */
  animate(
    key: string,
    updateFn: (progress: number) => void,
    duration: number = 300,
    easing: EasingFunction = this.easeOutCubic
  ): void {
    // Отменить предыдущую анимацию с этим ключом
    this.cancel(key);
    
    const startTime = performance.now();
    
    const tick = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const rawProgress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(rawProgress);
      
      updateFn(easedProgress);
      
      if (rawProgress < 1) {
        const rafId = requestAnimationFrame(tick);
        this.activeAnimations.set(key, rafId);
      } else {
        this.activeAnimations.delete(key);
      }
    };
    
    const rafId = requestAnimationFrame(tick);
    this.activeAnimations.set(key, rafId);
  }
  
  /**
   * Отменить анимацию по ключу
   */
  cancel(key: string): void {
    const rafId = this.activeAnimations.get(key);
    if (rafId !== undefined) {
      cancelAnimationFrame(rafId);
      this.activeAnimations.delete(key);
    }
  }
  
  /**
   * Отменить все активные анимации
   */
  cancelAll(): void {
    this.activeAnimations.forEach(id => cancelAnimationFrame(id));
    this.activeAnimations.clear();
  }
  
  /**
   * Проверить, активна ли анимация
   */
  isAnimating(key: string): boolean {
    return this.activeAnimations.has(key);
  }
  
  /**
   * Получить количество активных анимаций
   */
  getActiveCount(): number {
    return this.activeAnimations.size;
  }
  
  // ============================================================
  // Easing Functions
  // ============================================================
  
  /**
   * Ease Out Cubic - плавное замедление
   * Используется для большинства анимаций (scroll, zoom)
   */
  private easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  };
  
  /**
   * Ease In Out Cubic - плавное ускорение и замедление
   * Используется для симметричных анимаций
   */
  static easeInOutCubic(t: number): number {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  /**
   * Linear - равномерное движение
   */
  static linear(t: number): number {
    return t;
  }
  
  /**
   * Ease Out Quad - более мягкое замедление
   */
  static easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }
}
