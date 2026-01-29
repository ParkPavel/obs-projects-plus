import i18next from "i18next";
import { createI18nStore } from "svelte-i18next";
import dayjs from "dayjs";

// Локали dayjs импортируются в main.ts

import en from "src/lib/stores/translations/en.json";
import zh_CN from "src/lib/stores/translations/zh-CN.json";
import uk from "src/lib/stores/translations/uk.json";
import ru from "src/lib/stores/translations/ru.json";

// Функция для получения локали из различных источников
function getObsidianLocale(): string {
  // Получаем язык из Obsidian App API (изолированно по хранилищу)
  try {
    const app = (window as any).app;
    if (app?.loadLocalStorage) {
      const storedLang = app.loadLocalStorage('language');
      if (storedLang) {
        return storedLang;
      }
    }
  } catch {
    // App API not available
  }
  
  // Fallback к системному языку браузера
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language.split('-')[0] || 'en';
    }
  } catch {
    // navigator not available
  }
  
  // Fallback к dayjs локали
  try {
    const dayjsLocale = dayjs.locale();
    if (dayjsLocale && dayjsLocale !== 'en') {
      return dayjsLocale.split('-')[0] || 'en';
    }
  } catch {
    // dayjs locale not available
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

i18next.init({
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

export const i18n = createI18nStore(i18next);
