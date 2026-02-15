# Contributing to Projects Plus

Thank you for your interest in contributing to Projects Plus! This is a community-maintained fork of the original [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) plugin.

---

## Quick Start

```bash
git clone https://github.com/ParkPavel/obs-projects-plus.git
cd obs-projects-plus
npm ci
npm run dev       # esbuild watch mode → auto-rebuild on save
```

Copy the plugin to your test vault:
```bash
# Windows
xcopy /E /Y main.js main.css manifest.json styles.css "%USERPROFILE%\your-vault\.obsidian\plugins\obs-projects-plus\"

# macOS / Linux
cp main.js main.css manifest.json styles.css ~/your-vault/.obsidian/plugins/obs-projects-plus/
```

Reload Obsidian (`Ctrl/Cmd+R`) to pick up changes.

---

## Tech Stack

| Layer | Tool | Version |
|-------|------|---------|
| Language | TypeScript | 5.6 |
| UI Framework | Svelte | 3 (compiler) |
| Bundler | esbuild | via `esbuild.config.mjs` |
| Tests | Jest | 29 |
| Linter | ESLint | 9.15 (flat config) |
| Obsidian Lint | eslint-plugin-obsidianmd | 0.1.9 (23 rules) |
| Formatter | Prettier | via `npm run format` |
| Target | ES2016 | CJS output |

---

## Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | esbuild watch mode |
| `npm run build` | `tsc -noEmit -skipLibCheck && esbuild production` |
| `npm run test` | Jest (291 tests, 16 suites) |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Jest with coverage report |
| `npm run lint` | ESLint with Obsidian rules |
| `npm run format` | Prettier (`prettier -w ./src`) |
| `npm run svelte-check` | Svelte type checking |
| `npm run quality:check` | All quality checks combined |

---

## Code Standards

Detailed standards are in [docs/CODE_STANDARDS.md](docs/CODE_STANDARDS.md). Key rules:

### Must

- **No `innerHTML`** — use `createEl()`, `createSpan()`, `setIcon()`, `el.empty()`
- **No `document.*`** — use `activeDocument` for multi-window support
- **No `vault.modify()`** — use `vault.process()` for atomic writes
- **No `console.log`** in production code — remove before PR
- **No `@ts-ignore`** — use `@ts-expect-error` with description, or fix the type

### Should

- Use Obsidian CSS variables (`--text-error`, `--background-modifier-hover`, etc.) instead of hardcoded colors
- Extract repeated inline styles into CSS classes with `ppp-` prefix
- Write tests for new logic (filter operators, parsers, helpers)
- Keep translations in sync: `src/lib/stores/translations/` (en, ru, uk, zh-CN)

### ESLint

The project uses `eslint-plugin-obsidianmd` with 23 Obsidian-specific rules. Run `npm run lint` before committing.

---

## Project Structure

```
src/
├── main.ts              # Plugin entry point, command registration
├── view.ts              # Main ItemView
├── lib/
│   ├── dataApi.ts       # CRUD operations on vault files
│   ├── viewApi.ts       # View state management
│   ├── dataframe/       # DataFrame abstraction
│   ├── datasources/     # Folder, Tag, Dataview sources
│   ├── helpers/         # Shared utilities
│   ├── stores/          # Svelte stores + translations
│   └── metadata/        # Frontmatter parsing
├── managers/
│   └── CommandManager.ts # Dynamic command management
├── settings/            # Settings migration (v1→v2→v3)
└── ui/
    └── app/             # Svelte components (views, modals, etc.)
```

---

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`
2. Make changes — keep commits atomic and descriptive
3. **Run quality checks**:
   ```bash
   npm run build      # Must pass
   npm run test       # All 291 tests must pass
   npm run lint       # 0 errors
   ```
4. Update documentation if your change affects user-facing behavior
5. Submit PR with a clear description of what changed and why

### PR Checklist

- [ ] `npm run build` passes
- [ ] `npm run test` — all tests pass
- [ ] `npm run lint` — 0 errors
- [ ] No `console.log`, `innerHTML`, `document.*`, `@ts-ignore`
- [ ] Translations updated (if UI text changed)
- [ ] Documentation updated (if behavior changed)

---

## Translations

The plugin supports 4 languages: **EN**, **RU**, **UK**, **ZH-CN**.

Translation files are in `src/lib/stores/translations/`:
- `en.json` — English (primary)
- `ru.json` — Russian
- `uk.json` — Ukrainian
- `zh-CN.json` — Chinese (Simplified)

To add or update translations:
1. Add keys to `en.json` first
2. Add corresponding keys to other language files
3. Run `npm run build` to verify no missing keys

---

## Reporting Issues

Use the [GitHub Issues](https://github.com/ParkPavel/obs-projects-plus/issues) page. Include:

- **Obsidian version** and **plugin version**
- **Steps to reproduce**
- **Expected vs actual behavior**
- Screenshots or screen recordings if applicable
- Mobile/desktop and OS

---

## Architecture Notes

- **Settings migration**: `v1 → v2 → v3` chain in `src/settings/`
- **Filter engine**: 42 operators in `src/ui/app/.../filterEngine.ts`
- **Calendar**: Svelte components in `src/ui/app/calendar/`
- **Stores**: Module-level singletons (no DI) — see known limitations in README

For detailed architecture docs:
- [Filter System](docs/architecture-filters.md)
- [Drag & Drop](docs/architecture-drag-drop.md)
- [Database View](docs/architecture-database-view.md)

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

---

## Credits

Fork of the original [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) by [Marcus Olsson](https://github.com/marcusolsson).  
Current maintainer: **Park Pavel**
