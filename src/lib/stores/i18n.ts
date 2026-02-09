import i18next from "i18next";
import { createI18nStore } from "svelte-i18next";
import dayjs from "dayjs";

// Локали dayjs импортируются в main.ts

import en from "src/lib/stores/translations/en.json";
import zh_CN from "src/lib/stores/translations/zh-CN.json";
import uk from "src/lib/stores/translations/uk.json";
import ru from "src/lib/stores/translations/ru.json";

/**
 * Supported i18next resource locale keys.
 * Must match keys in the `resources` object below.
 */
const SUPPORTED_LOCALES = ['en', 'ru', 'uk', 'zh-CN'] as const;

/**
 * Map browser / Obsidian locale codes to our i18next resource keys.
 * Handles full BCP-47 tags (e.g. "zh-CN", "ru-RU", "en-US").
 */
function mapToResourceLocale(raw: string): string {
  const lc = raw.toLowerCase();
  const map: Record<string, string> = {
    'zh-cn': 'zh-CN',
    'zh-tw': 'zh-CN',
    'zh': 'zh-CN',
    'ru-ru': 'ru',
    'ru': 'ru',
    'uk-ua': 'uk',
    'uk': 'uk',
    'en-us': 'en',
    'en-gb': 'en',
    'en': 'en',
  };
  // Exact match first, then base language, then default
  const base = lc.split('-')[0] ?? '';
  return map[lc] ?? map[base] ?? 'en';
}

// Функция для получения локали из различных источников
function getObsidianLocale(): string {
  // 1. Obsidian's moment.js — Obsidian ALWAYS sets window.moment.locale()
  //    to match its language setting (Settings → About → Language).
  //    This is the most reliable source.
  try {
    const m = (window as any).moment;
    if (m && typeof m.locale === 'function') {
      const momentLang = m.locale();
      if (momentLang) {
        return mapToResourceLocale(momentLang);
      }
    }
  } catch {
    // moment not available yet
  }

  // 2. Direct localStorage key (Obsidian may store it here on some platforms)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const obsLang = window.localStorage.getItem('language');
      if (obsLang) {
        return mapToResourceLocale(obsLang);
      }
    }
  } catch {
    // localStorage not available
  }

  // 3. navigator.language fallback (system language)
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return mapToResourceLocale(navigator.language);
    }
  } catch {
    // navigator not available
  }

  return 'en';
}

// Функция для установки локали dayjs
function setDayjsLocale(locale: string): void {
  const localeMap: Record<string, string> = {
    'ru': 'ru',
    'uk': 'uk',
    'zh-CN': 'zh-cn',
    'zh': 'zh-cn',
    'en': 'en',
  };

  const dayjsLocale = localeMap[locale] || 'en';
  dayjs.locale(dayjsLocale);
}

const detectedLocale = getObsidianLocale();

// Устанавливаем локаль dayjs при инициализации
setDayjsLocale(detectedLocale);

void i18next.init({
  lng: detectedLocale,
  fallbackLng: {
    "zh-TW": ["zh-CN", "en"],
    "ru-RU": ["ru", "en"],
    "ru": ["ru", "en"],
    default: ["en"],
  },
  resources: {
    en: en,
    "zh-CN": zh_CN,
    uk: uk,
    ru: ru,
  },
  interpolation: {
    escapeValue: false, // not needed for svelte as it escapes by default
  },
});

// Следим за сменой языка и обновляем dayjs
i18next.on('languageChanged', (lng: string) => {
  setDayjsLocale(lng);
});

/**
 * Re-detect locale from Obsidian and switch i18next if it differs.
 * Call from plugin onload() after Obsidian app is fully initialized.
 */
export function syncLocale(): void {
  const detected = getObsidianLocale();
  const current = i18next.language;
  console.debug(`[PPP i18n] syncLocale: detected=${detected}, current=${current}, moment=${(window as any).moment?.locale?.()}`);
  if (detected !== current) {
    void i18next.changeLanguage(detected);
  }
}

/**
 * Switch plugin language at runtime.
 */
export function changeLanguage(locale: string): void {
  void i18next.changeLanguage(mapToResourceLocale(locale));
}

/**
 * Current list of supported locale codes.
 */
export { SUPPORTED_LOCALES };

export const i18n = createI18nStore(i18next);
