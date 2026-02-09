/**
 * Add missing i18n keys for hardcoded Russian string replacements.
 * Run once: node scripts/add-missing-i18n-keys.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRANSLATIONS_DIR = resolve(__dirname, '../src/lib/stores/translations');

/** Keys to add: { path: { en, ru, uk, zhCN } } */
const NEW_KEYS = {
  'common.yesterday': {
    en: 'Yesterday', ru: 'Вчера', uk: 'Вчора', zhCN: '昨天'
  },
  'common.tomorrow': {
    en: 'Tomorrow', ru: 'Завтра', uk: 'Завтра', zhCN: '明天'
  },
  'common.close': {
    en: 'Close', ru: 'Закрыть', uk: 'Закрити', zhCN: '关闭'
  },
  'common.total': {
    en: 'Total', ru: 'Всего', uk: 'Всього', zhCN: '总计'
  },
  'common.open-in-new-window': {
    en: 'Ctrl+Click: open in new window',
    ru: 'Ctrl+Click: открыть в новом окне',
    uk: 'Ctrl+Click: відкрити в новому вікні',
    zhCN: 'Ctrl+点击: 在新窗口中打开'
  },
  'views.calendar.agenda.custom.no-lists': {
    en: 'No custom lists', ru: 'Нет пользовательских списков',
    uk: 'Немає користувацьких списків', zhCN: '没有自定义列表'
  },
  'views.calendar.agenda.custom.create-list': {
    en: 'Create list', ru: 'Создать список',
    uk: 'Створити список', zhCN: '创建列表'
  },
  'components.color.add-to-favorites': {
    en: 'Add to favorites', ru: 'Добавить в избранное',
    uk: 'Додати в обране', zhCN: '添加到收藏'
  },
  'components.color.apply-color': {
    en: 'Apply color', ru: 'Применить цвет',
    uk: 'Застосувати колір', zhCN: '应用颜色'
  },
  'components.sort.empty-hint': {
    en: 'No sort criteria set', ru: 'Критерии не заданы',
    uk: 'Критерії не задані', zhCN: '未设置排序条件'
  },
};

function setNestedKey(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  const lastKey = keys[keys.length - 1];
  if (current[lastKey] === undefined) {
    current[lastKey] = value;
    return true; // added
  }
  return false; // already exists
}

function processFile(filename, langKey) {
  const filePath = resolve(TRANSLATIONS_DIR, filename);
  let raw = readFileSync(filePath, 'utf-8');
  // Strip BOM
  if (raw.charCodeAt(0) === 0xFEFF) {
    raw = raw.slice(1);
  }
  const json = JSON.parse(raw);
  const root = json.translation;

  let added = 0;
  for (const [dotPath, values] of Object.entries(NEW_KEYS)) {
    const value = values[langKey];
    if (setNestedKey(root, dotPath, value)) {
      added++;
    }
  }

  writeFileSync(filePath, JSON.stringify(json, null, 4) + '\n', 'utf-8');
  console.log(`${filename}: ${added} keys added (${Object.keys(NEW_KEYS).length - added} already existed)`);
}

processFile('en.json', 'en');
processFile('ru.json', 'ru');
processFile('uk.json', 'uk');
processFile('zh-CN.json', 'zhCN');

console.log('\nDone! All translation files updated.');
