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
