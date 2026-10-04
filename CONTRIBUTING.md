# Contributing to Projects Plus

[Русский](CONTRIBUTING-RU.md)

Projects Plus is an Obsidian plugin maintained as a fork of [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects). This guide covers building, changing and testing the plugin. Development coordination is maintained in [Claudex](https://github.com/ParkPavel/claudex).

## Build locally

Use Node.js 22, matching CI, and npm. From a clone of this repository:

```sh
npm ci
npm run build
```

The build type-checks TypeScript and bundles the plugin with esbuild. The runtime files are `main.js`, `manifest.json` and `styles.css`. For incremental builds, run `npm run dev`.

To test in Obsidian, copy those three files into `.obsidian/plugins/obs-projects-plus/` in a separate test vault. Create the directory if necessary, enable the plugin in Community plugins, and reload it after each build. Use sample notes: testing editing and deletion changes vault files.

## Find the relevant code

Start with the [architecture map](docs/architecture.md). The plugin uses TypeScript, Svelte, Obsidian APIs and Svelte stores. Exact dependencies and compiler options are in [package.json](https://github.com/ParkPavel/obs-projects-plus/blob/main/package.json), [package-lock.json](https://github.com/ParkPavel/obs-projects-plus/blob/main/package-lock.json) and [tsconfig.json](https://github.com/ParkPavel/obs-projects-plus/blob/main/tsconfig.json).

Third-party view authors should read the [custom view API](docs/api.md). Internal modules are implementation details and may change between releases.

## Make a focused change

Create a branch from `main`. Describe the problem and the behavior your change should produce, then keep the implementation and its documentation in the same pull request.

- Preserve note bodies when editing frontmatter. Use the existing data API and its Obsidian `processFrontMatter` path rather than replacing whole files from UI components.
- Keep settings writes on the existing settings writer path so retries, conflict detection and failure reporting remain consistent.
- Build DOM content with text-safe APIs. Use the owning element's document or Obsidian's active document for pop-out window support.
- Validate data read from settings and user input. Reuse the [regular-expression helpers](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/helpers/regexSafety.ts) where applicable.
- Use Obsidian theme variables and the [design tokens](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/ui/tokens/tokens.css). Keep controls usable with a keyboard and give icon-only buttons accessible names.
- Release subscriptions, event handlers and other resources when the owning view closes.
- Keep TypeScript types meaningful. Explain unavoidable suppressions and remove temporary debug output before review.

Formatting is configured in the repository. `npm run format` rewrites all of `src`, so check its diff and avoid unrelated formatting changes.

## Check the result

Run these commands from the repository root:

```sh
npm run build
npm test -- --runInBand
npm run lint
npm run svelte-check
```

Use focused tests while developing; run the full suite before submitting a pull request. Tests are located alongside their modules and under `src/__tests__`. Add regression coverage when fixing behavior that could recur. For a documentation-only change, check links, examples and any tests that validate the changed reference material.

UI changes also need an Obsidian check: open the affected view, perform the changed action, and verify its result after reopening the view or reloading the plugin when persistence is involved. Describe the vault, Obsidian version and checks in the pull request without including private notes.

## Translate the interface

UI translations live in [src/lib/stores/translations](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/stores/translations): English, Russian, Ukrainian and Simplified Chinese. Add or update corresponding keys in all four language files. Keep labels short and explain unfamiliar concepts in the user guide.

English is the reference text. The Russian, Ukrainian and Chinese strings for recent features (gallery layouts and card size, card fields, resizable card frames, board thumbnails, the settings Filters tab) were written by the maintainers without a review by native speakers. Corrections from people who use the plugin in these languages are welcome:

- **Report a wording problem.** Open an issue with the [Translation](https://github.com/ParkPavel/obs-projects-plus/issues/new?template=translation.yml) form: the language, where the text appears in the plugin, the current text and your suggestion. A screenshot helps.
- **Fix it yourself.** Search for the current text in the language file to find its key, change the value and keep the key unchanged. Keep every placeholder such as `{{count}}` or `{{name}}` exactly as it is; the text around it may move.
- **Check before a pull request.** `npm test -- R0_26_i18nKeyCoverage` checks that every key exists in all four files with the same placeholders, and `npm test -- R0_30_sentenceCase` checks the English capitalization.
- A label that does not fit the space it is shown in is a layout problem too: say so in the issue rather than shortening the meaning.

## Paired documentation

Each document has a version in two languages: a file with a base name and a file with a language suffix (`-RU` or `-EN`). The index [docs/README.md](docs/README.md), the [error codes](docs/ERROR_CODES.md) and two short in-vault pages hold both languages in one file. Pairing is checked by `src/__tests__/R0_25_documentationPairs.test.ts`: if you edit one language, edit the other in the same commit.

## Submit a pull request

State what was wrong, what now happens and how you checked it. Include screenshots for visible changes and mention limitations or checks you could not perform. Update the relevant user guide or API reference when behavior changes. Record release-facing changes in [CHANGELOG.md](CHANGELOG.md) and [CHANGELOG-RU.md](CHANGELOG-RU.md).

Do not include credentials, vault contents, local logs or machine-specific configuration. Report bugs through [GitHub Issues](https://github.com/ParkPavel/obs-projects-plus/issues), with reproduction steps, plugin and Obsidian versions, operating system, and expected and actual results.

## Release a version

Maintainers release from `main`, which accepts changes only through a pull request with a green `build` check.

1. On a branch, set the version with `npm version X.Y.Z --tag-version-prefix="" --no-git-tag-version`. The `version` hook copies it to `manifest.json` and adds it to `versions.json`; it never increments on its own.
2. Update both changelogs, rebuild with `npm run build` and commit `main.js` — it is tracked in Git and must match the release commit. Build from a checkout with LF line endings: with `core.autocrlf` on Windows, whitespace in Svelte templates carries `\r` into the bundle, and it no longer matches the release, which CI builds on Linux. The release asset is the reference — if in doubt, commit it.
3. Merge the pull request, then push the tag `X.Y.Z` — the version itself, without `v` — on the merge commit. The release workflow refuses a tag that differs from `manifest.json`, builds the plugin and publishes `main.js`, `manifest.json` and `styles.css`.

A beta for [BRAT](https://github.com/TfTHacker/obsidian42-brat) is a tag `X.Y.Z-beta.N` on a commit of `main`, with `X.Y.Z` above the current version (after 3.6.3: `3.6.4-beta.1`); the workflow publishes it as a pre-release with the beta version in its manifest, leaving `manifest.json` on `main` untouched.

## License and attribution

Contributions to the plugin are licensed under [Apache 2.0](https://github.com/ParkPavel/obs-projects-plus/blob/main/LICENSE). Preserve applicable copyright and license notices. The original plugin was created by [Marcus Olsson](https://github.com/marcusolsson); this fork is maintained by Park Pavel. The separate [type package](obsidian-projects-types/README.md) declares an MIT license.
