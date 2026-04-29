// Global mock for svelte-i18next — its published ESM form is not
// CJS-transpilable by esbuild-jest, so tests that transitively import
// `src/lib/stores/i18n` would otherwise fail to load. This stub is
// picked up automatically via jest.config.js `moduleNameMapper`.
"use strict";

module.exports = {
  createI18nStore: () => {
    const { writable } = require("svelte/store");
    return writable({
      t: (key, options) => (options && options.defaultValue) || key,
    });
  },
};
