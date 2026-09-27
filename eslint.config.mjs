// The Obsidian community directory reviews plugins automatically against
// eslint-plugin-obsidianmd's recommended set (ESLint core, type-checked
// typescript-eslint and the Obsidian rules). The project lints with exactly
// that set, plus TSDoc syntax; tests relax only what their mocks require.
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tsdoc from "eslint-plugin-tsdoc";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["**/node_modules", "**/build", "main.js", "releases/**", "demo-vault/**", "obsidian-projects-types/**"],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { tsdoc },
    rules: {
      "tsdoc/syntax": "warn",
    },
  },
  {
    files: ["**/__mocks__/**", "**/__tests__/**", "**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-deprecated": "off",
      // Tests run in Node under Jest and are not shipped: Node modules, globals,
      // timers and raw DOM are how they build fixtures.
      "no-undef": "off",
      "import/no-extraneous-dependencies": "off",
      "obsidianmd/no-nodejs-modules": "off",
      "obsidianmd/no-global-this": "off",
      "obsidianmd/prefer-window-timers": "off",
      "obsidianmd/prefer-create-el": "off",
      "obsidianmd/no-tfile-tfolder-cast": "off",
    },
  },
]);
