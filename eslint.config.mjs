import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsdoc from "eslint-plugin-tsdoc";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: ["**/npm node_modules", "**/build"],
}, ...compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended"), {
    plugins: {
        "@typescript-eslint": typescriptEslint,
        tsdoc,
        obsidianmd,
    },

    languageOptions: {
        globals: {
            ...globals.node,
        },

        parser: tsParser,
        ecmaVersion: 5,
        sourceType: "module",
    },

    rules: {
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-empty-interface": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "no-useless-escape": "off",
        "tsdoc/syntax": "warn",

        // Obsidian plugin guidelines (eslint-plugin-obsidianmd)
        "obsidianmd/no-forbidden-elements": "error",
        "obsidianmd/no-static-styles-assignment": "warn",
        "obsidianmd/no-tfile-tfolder-cast": "error",
        "obsidianmd/no-view-references-in-plugin": "off", // requires type-checked linting
        "obsidianmd/vault/iterate": "error",
        "obsidianmd/detach-leaves": "error",
        "obsidianmd/hardcoded-config-path": "error",
        "obsidianmd/platform": "error",
        "obsidianmd/regex-lookbehind": "error",
        "obsidianmd/object-assign": "error",
        "obsidianmd/prefer-file-manager-trash-file": "off", // requires type-checked linting
        "obsidianmd/validate-manifest": "error",
        "obsidianmd/validate-license": "error",
        "obsidianmd/no-plugin-as-component": "off", // requires type-checked linting
        "obsidianmd/no-sample-code": "error",
        "obsidianmd/sample-names": "error",
        "obsidianmd/commands/no-command-in-command-id": "error",
        "obsidianmd/commands/no-command-in-command-name": "error",
        "obsidianmd/commands/no-default-hotkeys": "error",
        "obsidianmd/commands/no-plugin-id-in-command-id": "error",
        "obsidianmd/commands/no-plugin-name-in-command-name": "error",
        "obsidianmd/settings-tab/no-manual-html-headings": "error",
        "obsidianmd/settings-tab/no-problematic-settings-headings": "error",
        "obsidianmd/prefer-abstract-input-suggest": "error",
    },
}];