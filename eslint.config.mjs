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
      // getSettingDefinitions() (settings search) arrives in Obsidian 1.13;
      // minAppVersion is 1.8.7, whose API does not have it.
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
    },
  },
  {
    // Build and release tooling runs in Node and is not part of the plugin:
    // Node modules, Node globals and console output are its job.
    files: ["esbuild.config.mjs", "jest.config.js", "scripts/**"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
      "obsidianmd/no-nodejs-modules": "off",
      "obsidianmd/rule-custom-message": "off",
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
      // Fixtures: raw markup, stringified fixture data, awaited component
      // updates and test labels. The type service also resolves test files
      // outside tsconfig, so its "unnecessary assertion" verdicts there are
      // wrong (it dropped casts the compiler needs).
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-unsanitized/property": "off",
      "@microsoft/sdl/no-inner-html": "off",
      "obsidianmd/ui/sentence-case": "off",
      "obsidianmd/rule-custom-message": "off",
    },
  },
]);
