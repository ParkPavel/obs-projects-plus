# Untestable features — #165 (token consolidation), 2026-09-01

What the live API run against the OBStests vault **did** establish, and what it structurally
cannot. Written because #165's contract is a claim about pixels, and the pipeline observes
commands and files.

Branch `feat/165-token-consolidation`, tip `e3f949c`, built from this tree and deployed as all
three artifacts (`main.js`, `styles.css`, `manifest.json`).

## Observed live

| Check | Result |
|---|---|
| Plugin loads with the new bundle | **10** `obs-projects-plus:*` commands, the exact expected set — 0 would mean the bundle failed at load |
| `show-projects` (opens a Dashboard view) | executed without error; plugin still registering 10 commands afterwards |
| Deployed `styles.css` size | 35,933 bytes — the hand-written half is present (the R0.8 regression shipped 7,645) |
| Level-2 scale reaches the shipped stylesheet | 2 `--ppp-local-*` declarations present |
| Canvas radius compatibility shim reaches it | `.ppp-database-root { … --ppp-radius-md … }` present |
| The TypeScript injection is gone from the bundle | `getDesignTokenCSS` **absent** from the deployed `main.js` |
| The pilot rule ships | `var(--ppp-local-text-sm)` present in the deployed `main.js` (Svelte component CSS rides in `main.js`, not `styles.css`) |

That is meaningful: it proves the deleted module is really gone from what the user runs, that the
new tokens really reach the host, and that removing the injection did not break canvas construction.

## NOT observed — and not claimable

1. **Whether anything moved on screen.** Steps 1–3 of the plan contract to "nothing moves". The
   evidence for that is static: values compared between the deleted files and the merged one
   (independently re-read from `git show main:…` rather than from the merged file), plus the Codex
   audit reaching the same conclusion. No render was compared. REST returns commands and file
   contents; it has no access to computed style.

2. **Whether the level-2 mechanism works at all.** The design rests on an unregistered custom
   property being substituted as a token stream, so that `cqi` inside it resolves against the
   *using* element's nearest ancestor query container rather than at `:root`. If that is wrong,
   every `--ppp-local-text-*` collapses to one viewport-derived value and step 4 is decoration.
   Jest and jsdom do not implement container queries; the build cannot see it; the browser probe
   that would have settled it could not run (the Chrome extension is not connected in this
   environment). **This is reasoning, not measurement, and it is the one thing #166 is built on.**

3. **The pilot's actual effect.** `ChartWidget` gained `font-size: var(--ppp-local-text-sm)` where
   it previously declared none. By construction the clamp floor is `1em` — the inherited value it
   renders today — so it can only grow, never shrink. Whether it grows *well* in a wide widget is a
   judgement about appearance that no API can make.

## The check that closes items 2 and 3

Open a dashboard in the OBStests vault with **two chart widgets of visibly different widths side by
side**. The chart in the wider widget must render larger label text and proportionally more padding
than the chart in the narrower one.

- **If they differ** — the mechanism is confirmed and #166 has its foundation.
- **If they render identically** — the substitution assumption is wrong. Step 4 (`9e870e4`) reverts
  **alone**; steps 1–3 stand on their own and keep all of the consolidation.

Nothing else in the branch depends on the outcome.

## Resolved 2026-09-02 — item 2 is measured, not reasoned

The Chrome extension was still not connected, so the probe ran in headless Chrome instead. It is
checked in as `docs/internal/probes/165-cqi-in-custom-property.html` and carries the exact
`tokens.css:379-382` declarations, a `container-type: inline-size` wrapper mirroring
`WidgetShell.svelte:164`, and a consumer mirroring `ChartWidget.svelte:219-223`, plus two
controls: the same formula written inline (no custom property in between) and the same consumer
with no query container above it.

```
chrome.exe --headless=new --disable-gpu --window-size=1400,900 --virtual-time-budget=2000 \
  --user-data-dir=<tmp> --dump-dom file:///<repo>/docs/internal/probes/165-cqi-in-custom-property.html
```

Computed values, `HeadlessChrome/151.0.0.0`, root font 16px:

| Case | font-size | padding |
|---|---|---|
| via custom property, 200px container | 16px | 6px |
| via custom property, 800px container | 18.4px | 6.9px |
| formula inline (control), 200px container | 16px | 6px |
| formula inline (control), 800px container | 18.4px | 6.9px |
| via custom property, **no container ancestor**, 1400px viewport | 20px | 7.5px |

The numbers are the arithmetic of the declaration and nothing else: `0.85em + 0.6cqi` is
13.6 + 1.2 in the narrow box (under the 1em floor, so 16) and 13.6 + 4.8 in the wide one. The
variable path equals the inline path in both widths, so `cqi` inside an inherited custom property
resolves against the *using* element's query container, not at `:root`. **Item 2 is closed by
measurement.** `9e870e4` has no revert condition left, and #166 has its foundation.

**Host applicability is a version argument, not a measurement.** The installed Obsidian is
Electron 34.3.0 / Chromium 132 (read from the strings in `Obsidian.exe`); container units shipped
in Chromium 105. The same resolution rule applies in the plugin host, but no computed style was read
inside Obsidian.

Two things the probe shows beyond the question it was asked:

- **The no-container row is the failure mode `tokens.css:348` warns about, and it fails large,
  not small.** With no query container above the consumer, `cqi` falls back to the small viewport
  and at a desktop width the clamp lands on its ceiling. A `--ppp-local-*` consumer placed outside
  a container would get the *largest* size. The one consumer today sits inside `WidgetShell`, so
  this is a constraint on #166 (every level-2 consumer must have a container ancestor, and R0.13
  cannot see whether it does), not a defect in the branch.
- **Items 1 and 3 are what they were.** "Nothing moved" in steps 1–3 still rests on static value
  comparison and the Codex audit; whether the growth *looks* right in a wide chart is a judgement
  about appearance that belongs to the user on screen. The floor is the inherited size, so the
  worst case of that judgement is today's rendering, which is why it does not hold the merge.
