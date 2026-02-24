import { writable, derived } from "svelte/store";

/**
 * 📱 Unified Device Detection Store
 * ==================================
 * 
 * ЕДИНСТВЕННЫЙ источник истины для определения типа устройства
 * Заменяет все 3 предыдущих метода:
 * ❌ isMobileDevice store (старый)
 * ❌ window.innerWidth < 768
 * ❌ @media (max-width: 30rem)
 * 
 * ✅ Единый reactive store
 * ✅ Поддержка touch/mouse независимо от размера экрана
 * ✅ Правильные breakpoints для планшетов
 */

/** Breakpoints в пикселях (синхронизованы с design-tokens.css) */
export const BREAKPOINTS = {
	xs: 480,  // 30rem - phone
	sm: 768,  // 48rem - tablet portrait
	md: 1024, // 64rem - tablet landscape
	lg: 1280, // 80rem - desktop
	xl: 1440, // 90rem - large desktop
	xxl: 1920 // 120rem - ultra-wide
} as const;

// Helper to create persistent store using Obsidian App API
function createPersistentStore<T>(key: string, initialValue: T) {
  // Get stored value using App API
  let storedValue = initialValue;
  if (typeof window !== 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Obsidian App API is injected on window at runtime
      const app = (window as any).app;
      if (app?.loadLocalStorage) {
        const stored = app.loadLocalStorage(`obs-projects-plus-${key}`);
        if (stored !== null) {
          storedValue = JSON.parse(stored);
        }
      }
    } catch (e) {
      console.warn(`Failed to load ${key} from App storage`, e);
    }
  }
  
  const store = writable<T>(storedValue);
  
  // Subscribe to changes and persist using App API
  store.subscribe((value) => {
    if (typeof window !== 'undefined') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Obsidian App API is injected on window at runtime
        const app = (window as any).app;
        if (app?.saveLocalStorage) {
          app.saveLocalStorage(`obs-projects-plus-${key}`, JSON.stringify(value));
        }
      } catch (e) {
        console.warn(`Failed to save ${key} to App storage`, e);
      }
    }
  });
  
  return store;
}

/**
 * Whether the main toolbar is collapsed (persisted)
 */
export const toolbarCollapsed = createPersistentStore<boolean>('toolbarCollapsed', false);

/** Внутренний store для window size */
const windowSize = writable({
	width: typeof window !== "undefined" ? window.innerWidth : 1280,
	height: typeof window !== "undefined" ? window.innerHeight : 800
});

/** Внутренний store для pointer type */
const pointerType = writable<"fine" | "coarse" | "none">("fine");

/** Обновление размера окна и pointer type */
if (typeof window !== "undefined") {
	const updateWindowSize = () => {
		windowSize.set({
			width: window.innerWidth,
			height: window.innerHeight
		});
	};

	// Debounced resize handler
	let resizeTimeout: number | null = null;
	window.addEventListener("resize", () => {
		if (resizeTimeout) window.clearTimeout(resizeTimeout);
		resizeTimeout = window.setTimeout(updateWindowSize, 150);
	});

	// Определяем pointer type
	const updatePointerType = () => {
		if (window.matchMedia("(pointer: coarse)").matches) {
			pointerType.set("coarse");
		} else if (window.matchMedia("(pointer: fine)").matches) {
			pointerType.set("fine");
		} else {
			pointerType.set("none");
		}
	};

	updatePointerType();
	
	// Отслеживаем изменения pointer type
	window.matchMedia("(pointer: coarse)").addEventListener("change", updatePointerType);
	window.matchMedia("(pointer: fine)").addEventListener("change", updatePointerType);
}

/** 
 * ═══════════════════════════════════════════════════
 * 📱 DEVICE TYPE STORES (Основные stores)
 * ═══════════════════════════════════════════════════ 
 */

/** Является ли устройство touch-устройством */
export const isTouchDevice = derived(
	pointerType,
	$pointerType => $pointerType === "coarse"
);

/** Является ли устройство телефоном */
export const isMobile = derived(
	windowSize,
	$size => $size.width < BREAKPOINTS.sm
);

/** Является ли устройство планшетом */
export const isTablet = derived(
	windowSize,
	$size => $size.width >= BREAKPOINTS.sm && $size.width < BREAKPOINTS.lg
);

/** Является ли устройство desktop */
export const isDesktop = derived(
	windowSize,
	$size => $size.width >= BREAKPOINTS.lg
);

/** Является ли планшет в portrait ориентации */
export const isTabletPortrait = derived(
	windowSize,
	$size => $size.width >= BREAKPOINTS.sm && $size.width < BREAKPOINTS.md
);

/** Является ли планшет в landscape ориентации */
export const isTabletLandscape = derived(
	windowSize,
	$size => $size.width >= BREAKPOINTS.md && $size.width < BREAKPOINTS.lg
);

/**
 * ═══════════════════════════════════════════════════
 * 🎯 SEMANTIC STORES (Семантические stores)
 * ═══════════════════════════════════════════════════
 */

/** Нужны ли увеличенные touch targets (44px minimum) */
export const needsTouchTargets = derived(
	[isTouchDevice, isMobile],
	([$isTouchDevice, $isMobile]) => $isTouchDevice || $isMobile
);

/** Нужно ли показывать mobile UI (компактный) */
export const needsMobileUI = derived(
	isMobile,
	$isMobile => $isMobile
);

/** Нужно ли показывать sidebar collapsed по умолчанию */
export const shouldCollapseSidebar = derived(
	[isMobile, isTabletPortrait],
	([$isMobile, $isTabletPortrait]) => $isMobile || $isTabletPortrait
);

/** Можно ли использовать hover эффекты */
export const supportsHover = derived(
	pointerType,
	$pointerType => $pointerType === "fine"
);

/** Текущий breakpoint name */
export const currentBreakpoint = derived(
	windowSize,
	$size => {
		if ($size.width < BREAKPOINTS.xs) return "xs";
		if ($size.width < BREAKPOINTS.sm) return "sm";
		if ($size.width < BREAKPOINTS.md) return "md";
		if ($size.width < BREAKPOINTS.lg) return "lg";
		if ($size.width < BREAKPOINTS.xl) return "xl";
		return "xxl";
	}
);

/** Ориентация устройства */
export const orientation = derived(
	windowSize,
	$size => $size.width > $size.height ? "landscape" : "portrait"
);

/** Текущая ширина окна */
export const viewportWidth = derived(
	windowSize,
	$size => $size.width
);

/** Текущая высота окна */
export const viewportHeight = derived(
	windowSize,
	$size => $size.height
);

/**
 * ═══════════════════════════════════════════════════
 * 🔄 BACKWARD COMPATIBILITY (Обратная совместимость)
 * ═══════════════════════════════════════════════════
 * DEPRECATED: Используйте isMobile вместо isMobileDevice
 */
export const isMobileDevice = isMobile;
