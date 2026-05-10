# Contributing to Projects Plus

Thank you for your interest in contributing! Projects Plus is a community-maintained fork of the original [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) plugin.

This document is the **engineering onboarding** entry point. Before opening a non-trivial PR, please also read:

- [docs/ARCHITECTURE_V5.md](docs/ARCHITECTURE_V5.md) — target architecture and codebase map (4 layers, A-F module grades)
- [docs/CODE_STANDARDS.md](docs/CODE_STANDARDS.md) — coding rules and security baselines
- [docs/internal/REFACTOR_BACKLOG_V5.md](docs/internal/REFACTOR_BACKLOG_V5.md) — active refactor queue (so your work doesn't collide with in-flight changes)

---

## Quick start

```bash
git clone https://github.com/ParkPavel/obs-projects-plus.git
cd obs-projects-plus
npm ci
npm run dev       # esbuild watch mode → auto-rebuild on save
```

Copy the runtime artifacts to a test vault (only these three files are part of the published plugin contract):

```powershell
# Windows PowerShell
Copy-Item main.js, manifest.json, styles.css "$env:USERPROFILE\your-vault\.obsidian\plugins\obs-projects-plus\"
```

```bash
# macOS / Linux
cp main.js manifest.json styles.css ~/your-vault/.obsidian/plugins/obs-projects-plus/
```

Reload Obsidian (`Ctrl/Cmd+R`) to pick up the new build.

---

## Tech stack (verified against `package.json`)

| Layer | Tool | Version |
|---|---|---|
| Language | TypeScript (strict) | per `tsconfig.json` |
| UI framework | Svelte | 3.59.2 (compiler only — no Svelte runtime in `main.js`) |
| Bundler | esbuild | via [esbuild.config.mjs](esbuild.config.mjs) |
| Tests | Jest | 29 + jsdom |
| Linter | ESLint | 9 (flat config) |
| Obsidian lint rules | `eslint-plugin-obsidianmd` | 0.1.9 |
| Formatter | Prettier | via `npm run format` |
| i18n | i18next | 4 languages: en, ru, uk, zh-CN |
| Target | ES2016 | CJS output (Obsidian plugin contract) |

---

## Available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | esbuild watch mode |
| `npm run build` | `tsc -noEmit -skipLibCheck && esbuild production` (must pass before PR) |
| `npm run test` | Jest — **98 suites, ~1597 tests** |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run lint` | ESLint with Obsidian rules |
| `npm run format` | Prettier (`prettier -w ./src`) |
| `npm run svelte-check` | Svelte type checking |
| `npm run quality:check` | Coverage + build + lint combined |

---

## Project structure

**The authoritative codebase map is [docs/ARCHITECTURE_V5.md](docs/ARCHITECTURE_V5.md)**. It documents every top-level folder under `src/`, the four-layer architecture (Plugin shell → UI surface → Engine core → Data layer), and where to add new widgets, charts, datasources, field types, formula functions, or languages.

This `CONTRIBUTING.md` intentionally does not duplicate that map — start with `ARCHITECTURE_V5.md §1` ("Слои / Layers") before opening a non-trivial PR.

---

## Code standards (essentials)

Detailed rules: [docs/CODE_STANDARDS.md](docs/CODE_STANDARDS.md). Hard rules:

### Must

- **No `innerHTML`** — use `createEl()`, `createSpan()`, `setIcon()`, `el.empty()`.
- **No `document.*`** — use `activeDocument` for multi-window support.
- **No `vault.modify()` for frontmatter** — use `fileManager.processFrontMatter()` for atomic writes.
- **No `console.log`** in production code — remove before PR.
- **No `@ts-ignore`** — use `@ts-expect-error` with a description, or fix the type.
- **No raw `new RegExp(userInput)`** — use [src/lib/helpers/regexSafety.ts](src/lib/helpers/regexSafety.ts).
- **No raw `JSON.parse(fromSettings)`** — always wrap in try-catch and validate shape.

### Should

- Use Obsidian CSS variables (`--text-error`, `--background-modifier-hover`, etc.) instead of hard-coded colours.
- Express UI sizing in `rem` or design tokens — pixels are allowed only at engine→library boundaries (charts).
- Add tests for new logic (filter operators, parsers, helpers, engine pieces).
- Keep translations in sync: [src/lib/stores/translations/](src/lib/stores/translations/) (`en.json`, `ru.json`, `uk.json`, `zh-CN.json`).

---

## Pull request process

1. **Fork** and create a feature branch from `main`.
2. Keep commits atomic and descriptive.
3. Run the quality gate locally:
   ```bash
   npm run build      # must pass (tsc + esbuild)
   npm run test       # all 98 suites must pass
   npm run lint       # 0 errors
   ```
4. Update documentation if your change affects user-facing behaviour or public API.
5. Open a PR with a clear description of *what* changed and *why*.

### PR checklist

- [ ] `npm run build` passes
- [ ] `npm run test` — all suites pass
- [ ] `npm run lint` — 0 errors
- [ ] No `console.log`, `innerHTML`, `document.*`, `@ts-ignore`
- [ ] Translations updated (if UI text changed)
- [ ] Documentation updated (if behaviour or API changed)
- [ ] CHANGELOG entry under `## [Unreleased]`

---

## Translations

The plugin supports 4 languages: **EN**, **RU**, **UK**, **ZH-CN**. Translation files live in [src/lib/stores/translations/](src/lib/stores/translations/).

To add or update translations:

1. Add keys to `en.json` first (canonical source).
2. Mirror the keys in `ru.json`, `uk.json`, `zh-CN.json`.
3. Run `node scripts/sync-translations.mjs` to detect missing keys.
4. Run `npm run build` to verify nothing is broken.

---

## Reporting issues

Use [GitHub Issues](https://github.com/ParkPavel/obs-projects-plus/issues). Please include:

- Obsidian version and plugin version
- Steps to reproduce
- Expected vs actual behaviour
- Screenshots or screen recordings if applicable
- Mobile/desktop and OS

---

## Subsystem deep-dives

When working on a specific subsystem, the relevant document is the source of truth:

| Subsystem | Document |
|---|---|
| Codebase map (start here) | [docs/ARCHITECTURE_V5.md](docs/ARCHITECTURE_V5.md) |
| Refactor backlog / task queue | [docs/internal/REFACTOR_BACKLOG_V5.md](docs/internal/REFACTOR_BACKLOG_V5.md) |
| Dashboard View (canvas, widgets, engine) | [docs/ARCHITECTURE_V5.md](docs/ARCHITECTURE_V5.md) §2 (Module Inventory) |
| Custom View API | [docs/api.md](docs/api.md) |

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

## Credits

Fork of the original [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) by [Marcus Olsson](https://github.com/marcusolsson).
Current maintainer: **Park Pavel**.
