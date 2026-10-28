# Maintaining the documentation site

[Русский](site-maintenance-RU.md) · [Documentation](README.md)

The project website is a static site in `docs/`. GitHub Pages should use **Deploy from a branch → main → /docs**. The `.nojekyll` file tells Pages to serve the checked-in HTML directly. A separate hosting service and runtime server are not required.

## Edit and build

Markdown guides remain the canonical documentation. The bilingual home-page copy lives in `scripts/site/content.mjs`; its layout is in `scripts/site/layout.mjs`. Local styles and browser interactions are in `docs/assets/`. Fonts are system fonts: no font service, analytics or CDN is used.

Run `npm ci` when dependencies change, then:

```sh
node scripts/build-docs-site.mjs
node scripts/check-docs-site.mjs
node scripts/test-docs-site.mjs
```

The generator uses [Marked](https://marked.js.org/) (MIT), a pinned development dependency. It renders Markdown into `docs/read/`, copies referenced local media, and produces the bilingual search index. It escapes raw HTML and restricts URL schemes. No renderer is downloaded or executed in the visitor's browser.

Place local images in the public `images/`, `docs/assets/` or `docs/media/` folders. Supported files are PNG, JPEG, GIF, WebP, SVG, AVIF, BMP and ICO. Hidden files and other project folders cannot be copied as images; a symbolic link's actual target must satisfy the same public-image policy. The generator also refuses reads or generated writes outside the repository.

Markdown sources must be declared public guides. Hidden Markdown files and guide links pointing to undeclared private files are refused before their content is read.

Commit the regenerated HTML and search index with their source changes. The check command refuses stale output, missing files, broken local anchors and images without alternative text. CI and the release workflow run these checks before publication. The DOM tests cover interactions; they are not a substitute for visual checks in desktop and mobile browsers.

## Preview and screenshots

`npm version` runs the version hook, updates plugin metadata and regenerates the site before staging
the generated documentation. If changing the version manually, run the generator and checks as well.

Serve `docs/` through a local HTTP server and check both `index.html` and `en.html`, narrow and wide layouts, keyboard navigation, search, examples and reduced motion. Test both from the site root and from the `/obs-projects-plus/` project prefix.

The home-page example is explicitly labelled a simplified interactive model, not a plugin screenshot. Product screenshots must come from an identified build using sample notes, with the version, data origin and capture environment recorded. Do not publish personal vaults or present desktop emulation as an iPhone test.
