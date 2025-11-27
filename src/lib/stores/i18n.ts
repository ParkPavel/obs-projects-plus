import i18next from "i18next";
import { createI18nStore } from "svelte-i18next";

import en from "src/lib/stores/translations/en.json";
import zh_CN from "src/lib/stores/translations/zh-CN.json";
import uk from "src/lib/stores/translations/uk.json";
import ru from "src/lib/stores/translations/ru.json";

// Функция для получения локали из различных источников
function getObsidianLocale(): string {
  // Попробуем получить язык из localStorage (Obsidian сохраняет его там)
  try {
    const storedLang = localStorage.getItem('language');
    if (storedLang) {
      return storedLang;
    }
  } catch (e) {
    console.warn("Could not get locale from localStorage, falling back to system locale", e);
  }
  
  // Fallback к системному языку браузера
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language.split('-')[0] || 'en'; // Берем только основной язык (например, 'en' из 'en-US')
    }
  } catch (e) {
    console.warn("Could not get system locale, falling back to dayjs locale", e);
  }
  
  // Fallback к dayjs локали
  try {
    // Импортируем dayjs для получения текущей локали
    const dayjs = require('dayjs');
    const dayjsLocale = dayjs().locale();
    if (dayjsLocale && dayjsLocale !== 'en') {
      return dayjsLocale.split('-')[0] || 'en'; // Берем только основной язык
    }
  } catch (e) {
    console.warn("Could not get dayjs locale, falling back to 'en'", e);
  }
  
  return 'en';
}

i18next.init({
  lng: getObsidianLocale(),
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

export const i18n = createI18nStore(i18next);
