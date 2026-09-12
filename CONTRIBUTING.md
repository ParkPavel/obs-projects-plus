# Contributing to Projects Plus

> [Русский](CONTRIBUTING-RU.md) · English

Thank you for your interest in contributing! Projects Plus is a community-maintained fork of the original [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) plugin.

This document is the **engineering onboarding** entry point. Before opening a non-trivial PR, please also read:

- [docs/architecture-EN.md](docs/architecture-EN.md) — how the code is laid out: layers, dependency rules, where to add things
- [docs/CODE_STANDARDS.md](docs/CODE_STANDARDS.md) — coding rules and security baselines

Planned work and in-flight changes are tracked in
[GitHub Issues](https://github.com/ParkPavel/obs-projects-plus/issues) and
[Pull Requests](https://github.com/ParkPavel/obs-projects-plus/pulls) — check there before starting
something large, so two changes don't collide. Day-to-day development is coordinated with
[Claudex](https://github.com/ParkPavel/claudex), which lives outside this repository: internal
plans, session notes and agent instructions are not part of this tree, and a PR never needs them.

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
| `npm run test` | Jest — the whole suite must pass |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run lint` | ESLint with Obsidian rules |
| `npm run format` | Prettier (`prettier -w ./src`) |
| `npm run svelte-check` | Svelte type checking |
| `npm run quality:check` | Coverage + build + lint combined |

---

## Project structure

**The codebase map is [docs/architecture-EN.md](docs/architecture-EN.md)**. It lists what lives under `src/`, the four layers (Shell → UI → Engine → Data), the dependency rules between them, and where to add a new widget, chart, datasource, formula function, error code or language.

This `CONTRIBUTING.md` does not duplicate that map — read its “Layers” section before opening a non-trivial PR.

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
   npm run build         # must pass (tsc + esbuild)
   npm run test          # every suite must pass
   npm run lint          # 0 errors
   npm run svelte-check  # 0 errors
   ```
4. Update documentation if your change affects user-facing behaviour or public API.
5. Open a PR with a clear description of *what* changed and *why*.

### PR checklist

- [ ] `npm run build` passes
- [ ] `npm run test` — every suite passes
- [ ] `npm run lint` — 0 errors
- [ ] `npm run svelte-check` — 0 errors
- [ ] No `console.log`, `innerHTML`, `document.*`, `@ts-ignore`
- [ ] Translations updated (if UI text changed)
- [ ] Documentation updated **in both languages** (if behaviour or API changed)
- [ ] An entry in `CHANGELOG.md` and `CHANGELOG-RU.md` under `## Unreleased` / «Не выпущено»

---

## Translations

The plugin supports 4 languages: **EN**, **RU**, **UK**, **ZH-CN**. Translation files live in [src/lib/stores/translations/](src/lib/stores/translations/).

To add or update translations:

1. Add keys to `en.json` first (canonical source).
2. Mirror the keys in `ru.json`, `uk.json`, `zh-CN.json`.
3. Run `node scripts/sync-translations.mjs` to detect missing keys.
4. Run `npm run build` to verify nothing is broken.

---

## Documentation comes in pairs

Every document exists in both languages: the file under its base name, and a file whose suffix
names its language (`-RU` or `-EN`). Two pages keep both languages inside one file — the index
`docs/README.md` and the error-code table `docs/ERROR_CODES.md` — because their English text is
taken straight from the code.

`src/__tests__/R0_25_documentationPairs.test.ts` enforces this: a document that exists in one
language only fails the suite. If you edit one language, edit the other in the same commit.

---

## Reporting issues

Use [GitHub Issues](https://github.com/ParkPavel/obs-projects-plus/issues). Please include:

- Obsidian version and plugin version
- Steps to reproduce
- Expected vs actual behaviour
- Screenshots or screen recordings if applicable
- Mobile/desktop and OS

---

## Where to read further

| Topic | Document |
|---|---|
| Codebase map (start here) | [docs/architecture-EN.md](docs/architecture-EN.md) |
| Coding rules and security baselines | [docs/CODE_STANDARDS.md](docs/CODE_STANDARDS.md) |
| Custom view API for other plugins | [docs/api.md](docs/api.md) |
| Error codes surfaced to users | [docs/ERROR_CODES.md](docs/ERROR_CODES.md) |
| What the plugin does, from a user's side | [docs/user-guide-EN.md](docs/user-guide-EN.md) |

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

## Credits

Fork of the original [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) by [Marcus Olsson](https://github.com/marcusolsson).
Current maintainer: **Park Pavel**.
