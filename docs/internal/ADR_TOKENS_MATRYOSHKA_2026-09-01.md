# ADR: One live token source, and a second scale the container decides

- Status: Accepted — plan, not yet implemented
- Ticket: #165 (M-MATRYOSHKA; blocks #166, #167)
- Decision date: 2026-09-01
- Pinned base: `d2d7de4` on `main`; work branch `feat/165-token-consolidation`
- Author: `architect` pass, 2026-09-01. Persisted by `lead` (the architect role is read-only).
  Claims marked **[verified by lead]** were re-read against the tree before this file was written;
  the rest carry the architect's own `path:line` citations and are the implementer's to confirm.

## Context

The matryoshka principle — the container decides the size of what it holds — is declared in
`src/lib/tokens/design-tokens.css` and executed by nobody. There are **four** token sources, not
the three the ticket was written against, and one of them is TypeScript and live:

| Source | Imported by | State |
|---|---|---|
| `src/ui/tokens/tokens.css` (353) | `src/main.ts:11` | live, the main one **[verified by lead]** |
| `src/ui/views/Dashboard/tokens/dashboardTokens.css` (51) | `src/main.ts:12` | live **[verified by lead]** |
| `src/ui/views/Dashboard/designTokens.ts` (102) | `DashboardCanvas.svelte:22`, `:65` | live, TypeScript — injects custom properties onto the canvas container **[verified by lead]** |
| `src/lib/tokens/design-tokens.css` (314) | nobody | dead — the only references in the tree are prose **[verified by lead]** |

`styles.css` in the repo root is **not** a source. It is the post-build merge output of `mergeCSS`
in `esbuild.config.mjs`, guarded by R0.8.

The principle is **half implemented, not absent.** `@container` queries are live and
`container-type: inline-size` is declared in five components, so the container already decides
**breakpoints**. What it does not decide is **size**: there are zero container-relative length
units anywhere in `src/`.

### Corrections to the ticket, from the code

1. The packet named two `container-type` declarations. There are **five**:
   `ViewContent.svelte:16` (`container-name: view-content`), `Day.svelte:670`,
   `DataTableContent.svelte:255` (`db-table`), `WidgetShell.svelte:164` (`widget`),
   `WidgetConfigShell.svelte:65` (`widget-config`). `FloatingPopup.svelte:251` is a comment.
   BACKLOG's own #166 text ("5 исполняемых `container-type`") was right.
2. **`.ppp-database-root` — the element that receives the injected tokens
   (`DashboardCanvas.svelte:145`, styled at `:191`) — declares no `container-type`.** The canvas
   hands out tokens but is not a query container.
3. **The ratchet number is R0.13, not R0.12** — `src/__tests__/R0_12_hookPrecision.test.ts`
   already exists. **[verified by lead]** Taken: R0.3–R0.12. Next free: **R0.13**.

## The live defect this ticket has to decide: the radius shadow

`--ppp-radius-*` is declared twice, at values shifted one step, and nothing in the tree says so.
**[verified by lead]** — `tokens.css:51-57` against `designTokens.ts:44-51`:

| name | `:root` (`tokens.css`) | inside `.ppp-database-root` (injected) |
|---|---|---|
| `--ppp-radius-xs` | — | `0.125rem` |
| `--ppp-radius-sm` | `0.125rem` | `0.25rem` |
| `--ppp-radius-md` | `0.25rem` | `0.375rem` |
| `--ppp-radius-lg` | `0.375rem` | `0.5rem` |
| `--ppp-radius-xl` | `0.5rem` | `0.75rem` |
| `--ppp-radius-2xl` | `0.75rem` | — |
| `--ppp-radius-full` | `9999px` | — |
| `--ppp-radius-pill` | — | `62.5rem` |

So `--ppp-radius-md` means two different things depending on whether the element is under the
canvas.

**Decision: preserve today's rendering, in one file.** `tokens.css` gains a canvas-scoped block
reproducing the current dashboard values, commented as a compatibility shim with a pointer to the
follow-up that decides the radius scale on its merits:

```css
.ppp-database-root { --ppp-radius-sm: 0.25rem; --ppp-radius-md: 0.375rem;
                     --ppp-radius-lg: 0.5rem;  --ppp-radius-xl: 0.75rem; }
```

The architectural point, stated plainly: **one source means one file to edit, not one selector.**
Scoping stays possible; what stops is scoping happening invisibly through a TypeScript string.

The space scales do **not** collide: `tokens.css:20-30` is a numeric family (`--ppp-space-0…10`),
`designTokens.ts:9-19` a named one (`xxs…3xl`). Disjoint keys under one prefix. **[verified by lead]**

## Decision

### Level 1 — `:root`, absolute

Unchanged `rem`, anchored to the document root. The fallback layer, and the layer that top-level
surfaces (modals, popups portaled to `body`) legitimately use.

### Level 2 — container-derived

A delimited section of `tokens.css`, declared at `:root` so the names exist everywhere, with values
that resolve **per use site** — an unregistered custom property is inherited as an unresolved token
stream, so `cqi` resolves against the *using* element's nearest ancestor query container. Where no
ancestor declares `container-type`, `cqi` resolves against the small viewport: the value degrades
to viewport-derived, it never becomes invalid.

```css
--ppp-local-pad-sm:  0.375em;
--ppp-local-pad-md:  0.5em;
--ppp-local-pad-lg:  0.75em;
--ppp-local-gap-md:  0.5em;
--ppp-local-text-sm:   clamp(0.75rem,  0.70rem + 0.35cqi, 0.875rem);
--ppp-local-text-base: clamp(0.875rem, 0.80rem + 0.45cqi, 1.0625rem);
--ppp-local-text-lg:   clamp(1rem,     0.90rem + 0.60cqi, 1.375rem);
```

Two mechanisms, deliberately different. **Spacing in `em`** derives from the element's own
font-size, so it inherits kinship automatically once typography is container-derived; it needs no
container and cannot fail. **Typography via `clamp()` over `cqi`** is where the container actually
decides size. Every clamp's lower bound is the value the component renders today, so a converted
rule can only grow in a wide container and never shrinks below the current appearance.

**The self-query trap, written down because it is invisible:** an element that declares
`container-type` is not its own query container — `cqi` in its own rules resolves against its
*ancestor*. Level-2 tokens are for **descendants** of a container, never for the container's own box.

**Level 2 lives in `tokens.css`, not in a component `<style>` block.** Svelte prunes selectors it
considers unused and `svelte-check` warns on them. Hard constraint, not preference.

## Plan — four commits

**Step 1 — delete the dead file, land the ratchet.** Delete `src/lib/tokens/design-tokens.css`.
Add `src/__tests__/R0_13_tokenSourceIntegrity.test.ts`. Re-measure the px count and lower the
`PX_BUDGET` constant with a bumps-log line in the existing style — the file's own protocol says to
lower after a real removal, and the ratchet is a ceiling so deletion would otherwise pass silently.
*Verify:* `npx jest R0_13 R0_3 R0_8`; `git grep -n "design-tokens"` returns only prose and history.

**Step 2 — merge `dashboardTokens.css` into `tokens.css`.** Copy its declarations into a labelled
section, keep the header comment that explains the cascade minus its now-false claim about
`design-tokens.css`, drop the duplicated `--ppp-db-row-hover` (identical value both sides, so the
merge is value-neutral). Delete the file and `src/main.ts:12`. Extend R0.13 to assert the merged keys.
*Verify:* build, then diff the custom-property **key set** of the generated block in `styles.css`
before and after — it must be identical. Run that check; do not reason about it.

**Step 3 — retire the injection.** Move the named `--ppp-space-*` values verbatim to `:root`; add
`--ppp-radius-xs` and `--ppp-radius-pill`; add the `.ppp-database-root` radius shim. Pin the six
`Schema.svelte` declarations (below). Remove `designTokens.ts`, its import
(`DashboardCanvas.svelte:22`), the `tokenCSS` const (`:65`) and `style={tokenCSS}` (`:145`).
Replace `designTokens.test.ts` with a suite of **at least equal test count** asserting the same
values now live in CSS.
*Verify:* four gates, then a **live Obsidian run** on the OBStests vault comparing a dashboard
before and after. This step's contract is "nothing moves"; only a real render can confirm that.

**Step 4 — the second level, with one consumer.** Add the level-2 section. Convert exactly one rule
as pilot: `ChartWidget.svelte:214`, plus the chart's label font-size if it has one. ChartWidget
renders inside `WidgetShell`'s `widget` container (`WidgetShell.svelte:164-165`) and already carries
`@container widget (max-width: 20rem)` at `ChartWidget.svelte:280`, so the container relationship is
proven rather than assumed.
*Verify:* live run — two chart widgets of different widths side by side must render different
padding and label size. If they do not, the mechanism assumption is wrong and **step 4 reverts
alone**, leaving 1–3 intact.

> **Post-implementation note, 2026-09-02.** The mechanism was measured in headless Chrome
> (`UNTESTABLE_FEATURES_2026-09-01.md` §"Resolved 2026-09-02") and holds. The "label size" half of
> the verification line above was wrong as written, and the adversarial review (`CX-ADV-165`) caught
> it: the SVG charts size their labels with `font-size="11"`-style presentation attributes in
> viewBox user units, which ignore inherited font-size and scale geometrically with the SVG. The
> pilot's font-size reaches the HTML text under the wrapper — `NumberChart` and the banners — and
> its padding; the SVG labels were never routed and belong to #166. Step 4 stands on the measured
> mechanism and the real consumer, not on the sentence.

**Why a pilot is not optional.** A level-2 section with zero consumers is `design-tokens.css` reborn
one level down — a file declaring a principle that nothing executes. That is exactly the failure
#165 exists to fix. R0.13 therefore asserts at least one shipped rule consumes the level-2 scale.

### `Schema.svelte` — the only named-scale consumer outside the canvas **[verified by lead]**

It is a modal, not under `.ppp-database-root`, so it resolves its inline fallbacks today — and its
`--ppp-space-md` fallback is `0.75rem` while the named token is `0.5rem`. Promoting the scale to
`:root` would silently shrink it. Pin to the numeric scale for exact parity:

- `:241, :246, :256`, second half of `:257` — `var(--ppp-space-md, 0.75rem)` → `var(--ppp-space-5)` (`0.75rem`)
- `:250, :310` — `var(--ppp-space-xs, 0.25rem)` → `var(--ppp-space-2)` (`0.25rem`)
- `:257` first half — `var(--ppp-space-sm, 0.375rem)` → `var(--ppp-space-3)` (`0.375rem`)

## What #165 hands to #166, and what it must not pre-empt

**Delivers:** one file to edit; a named level-2 vocabulary with defined fallback semantics; the
self-query trap documented; one worked example proving the mechanism in the real host; a ratchet
that notices if the file goes dark again.

**Must not pre-empt:** no new `container-type` — the five existing ones stay exactly five, because
`container-type: inline-size` implies `contain: layout style inline-size` and changes how a box is
sized by its content; #165 must not move layout. No `min(…, 100cqi)` replacements for the fixed
minimums #166 names. No decision about the deliberate kinship break for popups and modals — #166
owns that and owes it in writing.

## Tests

`src/__tests__/R0_13_tokenSourceIntegrity.test.ts`, built on the R0.4 shape because R0.4 is this
repo's own lesson about ratchets that pass by matching nothing:

1. The declared source list matches the tree — `LIVE_TOKEN_SOURCES` lists exactly
   `src/ui/tokens/tokens.css`; assert it exists and that no other `.css` file exists under `src/`
   outside `__tests__`.
2. **The source is imported by the entry point** — read `src/main.ts`, extract module specifiers
   with the matcher R0.4 uses (`R0_4:53-54`), assert the token path is among them. This is the
   assertion the ticket asks for.
3. The matcher is proven on synthetic input — a pure `(text) → specifiers` function exercised on
   a present import and on a removed one. **This is how it is proven to fail on the broken state
   without breaking the tree**, exactly as `R0_4:145-153` proves containment while no archive exists.
4. It reads the file it claims to read — `main.ts` non-empty and containing another known import,
   so a wrong path cannot make the scan vacuous (mirrors `R0_4:162-168`).
5. Both levels are declared — `:root` present; the level-2 section declares at least one `em`
   spacing token and at least one `clamp(` containing `cqi`.
6. Level 2 has a consumer — at least one `.svelte` file references a `--ppp-local-` token.
7. No self-query — for each file declaring `container-type`, its own rule block for that selector
   contains no `cq` unit.
8. Merged keys survive — every `--ppp-db-*` key formerly in `dashboardTokens.css` is present in
   `tokens.css`. The list in the test is the contract.

**Replacement for `designTokens.test.ts`** (9 tests today): a CSS-reading suite asserting the moved
values by name, including the shim's four. Keep the count at or above nine so the Jest baseline in
`CONTEXT.md` holds — `npm test` exits 0 on a falling baseline, so nothing else catches this.

**R0.8 is not extended.** Its `MIN_HAND_WRITTEN_LINES` guards the half `mergeCSS` cannot regenerate;
this work touches only the generated half. Leave it untouched and green.

## Risks

| # | Failure mode | Catching check |
|---|---|---|
| 1 | `cqi` in an inherited custom property resolves at `:root` instead of the use site, collapsing level 2 to one viewport-derived value. The whole design rests on unregistered custom properties being substituted as token streams. | Step 4's live check: two charts of different widths must differ. Jest, jsdom and the build cannot see this. If it fails, revert step 4 only. |
| 2 | The self-query trap — a later change sizes a `container-type` element in `cqi` and silently measures its ancestor. | R0.13 assertion 7, plus this ADR. |
| 3 | Dropping `src/main.ts:12` loses the `--ppp-db-*` layer if the merge misses a key. `--ppp-db-z-dropdown: 100` going missing means floating pickers render under sticky headers — a defect no gate can see. | Step 2's before/after key-set diff of the generated block, R0.13 assertion 8, the vault run. |
| 4 | The radius shim is forgotten and the dashboard silently changes corner radii on existing installs. | Shim lands in the same commit as the removal; replacement suite asserts its four values; vault run compares before/after. |
| 5 | The Jest baseline falls when `designTokens.test.ts` is deleted — `npm test` still exits 0. A falling baseline is a documented violation, not a red gate. | Read the canonical baseline in `CONTEXT.md` at the moment of the run; land the replacement suite in the same commit as the deletion. |
| 6 | `styles.css` is not rebuilt and committed, so the shipped stylesheet keeps declaring tokens the source no longer has. R0.8 stays green either way. | Explicit step: production build, then `git status` must show `styles.css` modified. Name it in the commit. |
| 7 | Vault compatibility. Nothing here reads or writes stored data — no `data.json` key, no frontmatter, no widget config. The only user-visible surface is rendering, and the contract for steps 1–3 is "nothing moves". | The vault run is the only evidence that holds. Four green gates are not proof of it. |

**A fifth token surface exists and nobody had named it.** `styles.css:1` is a single minified
`:root{…}` line — a stale copy of an older `tokens.css`, carrying `box-shadow` values in `px`. It
declares 113 `--ppp-*` keys, **all 113 re-declared by the generated block below it**, so it is fully
shadowed and has zero runtime effect. R0.3 never sees it (it walks `src/` only). Left in place —
deleting it lowers the hand-written line count R0.8 floors, for no behavioural gain — but recorded
here, because the next person to read `styles.css` will believe it is live.

## Rejected

**(A) Keep the injection; make `designTokens.ts` the single source, generating all CSS at runtime.**
An injected `style=` attribute reaches only the subtree under `.ppp-database-root`, so Calendar,
Board, Gallery, modals and anything portaled to `body` could never share it — "single" for one view
and absent for four. It is also the mechanism that produced the radius shadow: a TypeScript string
can redefine a `:root` name without any file appearing to conflict.

**(B) Move the `designTokens.ts` radius scale to `:root` verbatim.** The names collide at shifted
values and the later declaration wins — every `--ppp-radius-md` in the tree would jump from
`0.25rem` to `0.375rem`. A silent global restyle inside a structural ticket.

**(C) Drop the canvas radius overrides and adopt the global scale now.** Defensible — the divergence
was accidental — but it is a visual behaviour change no ticket owns, and it would make step 3
impossible to verify as "nothing moved". Filed as a follow-up instead; the shim's comment is the
pointer.

**(D) Ship level 2 as declarations only, letting #166 be the first consumer.** That is
`design-tokens.css` again. One pilot consumer, guarded by a ratchet, is the difference between a
principle and a document.

## Open before implementation

- **Mount paths.** `WidgetShell`, `WidgetSetupWizard` and `LegacyWidgetPlaceholder` consume the
  named space scale; `FloatingPopup.svelte:256` does `document.body.appendChild(node)`. If any of
  them ever renders outside the canvas it gets its inline fallback today, and promoting the scale to
  `:root` changes it. Confirm each mount path before step 3, or accept the change knowingly.
- **Host floor.** `cqi` availability is reasoned, not measured: `@container` ships in the same
  browser release as container query units and this codebase already ships twelve `@container`
  rules, so the floor is set by existing code and #165 raises it no further. Step 4's live run is
  the proof.
- **Clamp lower bounds** must be read off the pilot component's current computed values during
  implementation. The rule is specified (floor = today's value); the numbers are not.
