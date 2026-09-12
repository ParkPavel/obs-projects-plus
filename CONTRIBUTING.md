# Contributing to Projects Plus

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

Start with the [architecture map](docs/architecture.md). The plugin uses TypeScript, Svelte, Obsidian APIs and Svelte stores. Exact dependencies and compiler options are in [package.json](package.json), [package-lock.json](package-lock.json) and [tsconfig.json](tsconfig.json).

Third-party view authors should read the [custom view API](docs/api.md). Internal modules are implementation details and may change between releases.

## Make a focused change

Create a branch from `main`. Describe the problem and the behavior your change should produce, then keep the implementation and its documentation in the same pull request.

- Preserve note bodies when editing frontmatter. Use the existing data API and its Obsidian `processFrontMatter` path rather than replacing whole files from UI components.
- Keep settings writes on the existing settings writer path so retries, conflict detection and failure reporting remain consistent.
- Build DOM content with text-safe APIs. Use the owning element's document or Obsidian's active document for pop-out window support.
- Validate data read from settings and user input. Reuse the [regular-expression helpers](src/lib/helpers/regexSafety.ts) where applicable.
- Use Obsidian theme variables and the [design tokens](src/ui/tokens/tokens.css). Keep controls usable with a keyboard and give icon-only buttons accessible names.
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

UI translations live in [src/lib/stores/translations](src/lib/stores/translations): English, Russian, Ukrainian and Simplified Chinese. Add or update corresponding keys in all four language files. Keep labels short and explain unfamiliar concepts in the user guide.

## Submit a pull request

State what was wrong, what now happens and how you checked it. Include screenshots for visible changes and mention limitations or checks you could not perform. Update the relevant user guide or API reference when behavior changes. Record release-facing changes in [CHANGELOG.md](CHANGELOG.md).

Do not include credentials, vault contents, local logs or machine-specific configuration. Report bugs through [GitHub Issues](https://github.com/ParkPavel/obs-projects-plus/issues), with reproduction steps, plugin and Obsidian versions, operating system, and expected and actual results.

## License and attribution

Contributions to the plugin are licensed under [Apache 2.0](LICENSE). Preserve applicable copyright and license notices. The original plugin was created by [Marcus Olsson](https://github.com/marcusolsson); this fork is maintained by Park Pavel. The separate [type package](obsidian-projects-types/README.md) declares an MIT license.
