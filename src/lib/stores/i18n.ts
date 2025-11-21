import i18next from "i18next";
import { createI18nStore } from "svelte-i18next";

import dayjs from "dayjs";

import en from "src/lib/stores/translations/en.json";
import zh_CN from "src/lib/stores/translations/zh-CN.json";
import uk from "src/lib/stores/translations/uk.json";
import ru from "src/lib/stores/translations/ru.json";

i18next.init({
  lng: dayjs.locale(),
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
