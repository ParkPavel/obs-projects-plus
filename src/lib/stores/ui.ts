import { writable, derived } from "svelte/store";
import { app as appStore } from "src/lib/stores/obsidian";
import { loadAppLocal, saveAppLocal } from "src/lib/appStorage";

/**
 * 📱 Unified Device Detection Store
 * ==================================
 * 
 * ЕДИНСТВЕННЫЙ источник истины для определения типа устройства
 * Заменяет все 3 предыдущих метода:
 * ❌ isMobileDevice store (старый)
 * ❌ `window.innerWidth < 768`
 * ❌ `@media (max-width: 30rem)`
 * 
 * ✅ Единый reactive store
 * ✅ Поддержка touch/mouse независимо от размера экрана
 * ✅ Правильные breakpoints для планшетов
 */

/**
 * Breakpoints в пикселях. Раньше комментарий обещал синхронизацию с
 * `design-tokens.css` — файл был мёртвым кодом и удалён в #165, так что
 * синхронизировать было не с чем. Эти значения ни с чем не связаны: они
 * читаются из JS для media-запросов, CSS-токен на них не смотрит.
 */
export const BREAKPOINTS = {
	xs: 480,  // 30rem - phone
	sm: 768,  // 48rem - tablet portrait
	md: 1024, // 64rem - tablet landscape
	lg: 1280, // 80rem - desktop
	xl: 1440, // 90rem - large desktop
	xxl: 1920 // 120rem - ultra-wide
} as const;

// A store persisted in Obsidian's per-vault local storage. It is created at
// import time, before onload hands the plugin its App, so it hydrates when
// the App arrives and only writes after that — never through the global app.
function createPersistentStore<T>(key: string, initialValue: T) {
  const storageKey = `obs-projects-plus-${key}`;
  const store = writable<T>(initialValue);
  let hydrated = false;
  appStore.subscribe((instance) => {
    if (!instance || hydrated) return;
    hydrated = true;
    try {
      const stored = loadAppLocal(storageKey);
      if (stored !== null) store.set(JSON.parse(stored) as T);
    } catch (e) {
      console.warn(`[Projects+] Failed to load ${key} from App storage`, e);
    }
  });
  store.subscribe((value) => {
    if (!hydrated) return;
    try {
      saveAppLocal(storageKey, JSON.stringify(value));
    } catch (e) {
      console.warn(`[Projects+] Failed to save ${key} to App storage`, e);
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

/**
 * Keep windowSize and pointerType current while the plugin runs. Returns the
 * cleanup; onload registers it, so the listeners end when the plugin unloads
 * (they were added at import time and never removed).
 */
export function watchViewport(): () => void {
	if (typeof window === "undefined") return () => {};
	const updateWindowSize = () => {
		windowSize.set({
			width: window.innerWidth,
			height: window.innerHeight
		});
	};

	// Debounced resize handler
	let resizeTimeout: number | null = null;
	const onResize = () => {
		if (resizeTimeout) window.clearTimeout(resizeTimeout);
		resizeTimeout = window.setTimeout(updateWindowSize, 150);
	};
	window.addEventListener("resize", onResize);

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
	const queries = [window.matchMedia("(pointer: coarse)"), window.matchMedia("(pointer: fine)")];
	for (const query of queries) query.addEventListener("change", updatePointerType);

	return () => {
		window.removeEventListener("resize", onResize);
		if (resizeTimeout) window.clearTimeout(resizeTimeout);
		for (const query of queries) query.removeEventListener("change", updatePointerType);
	};
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
