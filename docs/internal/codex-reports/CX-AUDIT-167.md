# CX-AUDIT-167 — R0.16, the rem-in-container ratchet

Role: `auditor` (`.codex/agents/auditor.toml`), read-only sandbox.
Base `09fef14`, branch `fix/167-rem-in-container-ratchet` at `eef8c92`, run 2026-09-02.
Expected result asked for: whether R0.16 can be satisfied by anything other than removing `rem`;
whether the R0.13 helper extraction changes R0.13's behaviour; whether the plant proof is
tree-based.

Verdict returned: **BLOCKED** — one CRITICAL, one HIGH.

## Verbatim findings

> ## BLOCKED
>
> - **CRITICAL — `src/__tests__/support/cssScan.ts:61`, `src/__tests__/R0_16_remInContainer.test.ts:128`**
>   **Observed:** R0.16 reads `<style>` blocks and only quoted `style="…"`. It misses Svelte
>   directives and bound attributes. A scoped Dashboard component already ships `rem` through
>   `style={…}` at `src/ui/views/Dashboard/widgets/Stats/StatsCard.svelte:68`; Calendar's scoped
>   `AllDayEventStrip.svelte:123-125` similarly uses `style:` directives. The scanner also limits
>   R0.16's inventory to `.svelte` files at `R0_16…:147-152`, excluding CSS and TS-built styles.
>   **Failure scenario:** move a counted declaration into `style={\`gap: 0.75rem\`}` or a `style:gap`
>   directive; the rendered size remains, while the ratchet count falls.
>   **Would falsify:** the scanner counts bound attributes, `style:` directives, CSS files, and
>   runtime style construction as applicable, with regressions proving the existing StatsCard and
>   AllDayEventStrip values contribute.
>
> - **HIGH — `src/__tests__/R0_16_remInContainer.test.ts:55, 66, 91-94, 224-279`**
>   **Observed:** "scope over the tree" is actually a mutable directory prefix, a mutable query
>   regex, and a file-existence-only allowlist. The bidirectional assertions recompute the same
>   predicates, so they do not validate render containment. A real Dashboard component can be added
>   to `WINDOW_ANCHORED`, or the prefix/query narrowed; after changing the planted witness and
>   lowering the budget, the suite has no independent topology check to reject that exemption.
>   **Failure scenario:** exclude a high-count in-container component without removing its `rem`,
>   then rebaseline the reduced count.
>   **Would falsify:** independently derive/assert containment from the rendered component
>   structure, and require each exemption to prove its window anchoring/portal behavior rather than
>   merely exist.
>
> R0.13's helper extraction appears behavior-preserving by static comparison: the root path, comment
> stripping, Svelte style extraction, recursion, extensions, and test/mock exclusions are
> equivalent. No finding there.
>
> The plant proof is not synthetic-only: it reads the real `WidgetShell.svelte` through the tree
> inventory and appends one declaration in memory (`R0_16…:318-346`). It proves `total()` changes by
> one for that represented form, but does not prove the CSS reader covers all shipped style forms.
>
> I observed `git diff --check` clean; no new `@ts-ignore`, `new Menu`, `JSON.parse`, or dynamic
> `RegExp` in the changed runtime diff; and no U+FFFD found under `src/`. The branch is
> `fix/167-rem-in-container-ratchet`, not `main`.
>
> Focused Jest execution was attempted but could not start in this sandbox: PowerShell blocks
> `npx.ps1`, while `npx.cmd` fails resolving the restricted user-profile path. No test pass is
> claimed.

## Disposition

**CRITICAL — TRUE, fixed in `49026c4`.** Both sites were read before agreeing.
`StatsCard.svelte:68` carries `style={safeColor ? \`border-left: 0.1875rem solid ${safeColor}\` : ""}`
and `AllDayEventStrip.svelte:122-125` carries `style:--strip-height`, `style:top` and
`style:line-height`. The finding understates its own severity: this was not an undercount but a
documented rule with a published way around it, since the file's docstring claimed inline styles
were covered. `svelteStyleBindings` now reads all four forms; the budget was re-measured 806 → 807
rather than incremented. Two regression tests name the two components, and a plant of
`style:padding={\`0.625rem\`}` on the real `StatsCard.svelte` breaks the budget at 808 > 807.

One part of the finding is a **correct observation with a wrong remedy**: the `AllDayEventStrip`
directives interpolate the number (`"{STRIP_HEIGHT_REM}rem"`), so they carry no literal digits and
no unit scan can count them. The reader now reads them; the limit belongs to the counter's regex,
and the test records that rather than papering over it.

The rest of the CRITICAL — CSS files and TS-built styles — is **TRUE as a gap in assurance, false
as a live defect**, and is now closed by assertion rather than by assumption: no `.css` exists under
the container scope (the tree's only stylesheet is `ui/tokens/tokens.css`, the level-1 `:root`
scale, root-anchored on purpose), and no `.ts` under `ui/views/Dashboard/` carries a `rem`. Both
measured, both asserted.

**HIGH — TRUE in substance, partly unactionable as posed.** The exemption check was existence-only,
which is the weak bar the finding describes; an entry must now exhibit its mechanism (its own
`position: fixed`, or a portal out of the tree) and the list is length-capped. The remedy the
finding asks for — "independently derive containment from the rendered component structure" — is
the thing the ADR states no static analysis can do, and is precisely why #166 put the guarantee in
the CSS cascade instead. The residue is recorded in the test's own docstring and in `BACKLOG.md`
rather than claimed as closed.

**"Tests UNKNOWN" is a sandbox artefact, not a result.** The auditor's read-only sandbox cannot
start Node; the four gates were run in the main checkout and are recorded on the ticket.

---

# Second pass — confirmation run on `49026c4`

Same role, same base `09fef14`, run 2026-09-02 after the first pass's fixes.
Expected result asked for: whether the two findings are closed, and whether any NEW way exists to
satisfy the budget without removing `rem`.

Verdict returned: **BLOCKED** — two HIGH. Both true.

## Verbatim findings

> - **HIGH** — `src/__tests__/support/cssScan.ts:50`: the reader only recognizes `style…=`. It
>   misses valid Svelte shorthand such as `{style}` and `style:width`; both forms already exist at
>   `src/ui/components/FloatingPopup/FloatingPopup.svelte:291` and
>   `src/ui/components/SlideInPanel/SlideInPanel.svelte:54`.
>
>   Failure scenario: move an in-scope literal from `style="gap: 0.75rem"` to a script variable,
>   then render it as `{style}` or `style:gap`. The shipped root-anchored size remains, but R0.16's
>   count falls.
>
>   This also applies to `style={gapStyle}` where the `rem` string is hoisted into the component
>   script: the reader extracts only `gapStyle`, while `shippedCss` discards script content.
>
>   Would falsify: a regression test relocating a real in-scope `rem` through each shorthand/hoisted
>   form causes the count to remain unchanged (or the budget to fail).
>
> - **HIGH** — `src/__tests__/R0_16_remInContainer.test.ts:367`: the portal mechanism check accepts
>   any occurrence of `FloatingPopup`, not specifically a portal. The component's own header
>   contains that word at `src/ui/components/FloatingPopup/FloatingPopup.svelte:2`, so removing
>   `use:portal` would still satisfy the exemption check.
>
>   Failure scenario: `FloatingPopup` is changed to remain inside a container while retaining its
>   name; its exemption and all of its `rem` values continue to pass despite no portal.
>
>   Would falsify: a fixture/text mutation that removes `use:portal` while retaining the word
>   `FloatingPopup` makes the allowlist-mechanism assertion fail.

## Disposition

**HIGH 1 — TRUE, and the third time the same shape.** Verified at both named sites: `{style}`
shorthand at `FloatingPopup.svelte:291`, `style:width` shorthand at `SlideInPanel.svelte:54`.

The important thing is not the two syntaxes. It is that this was the second audit in a row to find
a route the reader did not model, and each of my fixes had been narrower than the hole: `<style>`
only, then `<style>` plus four binding forms. A shorthand carries **no value at the element at
all** — the value lives in the script — so no reader built around style bindings could ever have
counted it.

So the reader stopped enumerating routes. The counter now reads the whole component text with
comments stripped, which is how R0.3 has always counted `px`. Relocation is defeated by
construction rather than by keeping up with Svelte's syntax.

**Re-measured across the rule change: 807 → 807, unchanged.** The routes the audit named were real
but carried nothing today, so this closed a hole without moving a number — recorded in the bumps
log, because a re-measurement returning the same value is evidence and an unlogged one looks like
nothing happened.

Falsifier run as the audit specified: `const style = "gap: 0.75rem"` hoisted into
`StatsCard.svelte`'s script and rendered as `{style}` — the exact relocation described — breaks the
budget at 808 > 807. Reverted.

**HIGH 2 — TRUE.** `FloatingPopup.svelte:2` does contain its own name, and the check accepted the
bare string, so the exemption would have survived deletion of `use:portal`. A test a component
satisfies by being *named after* the thing it claims to do is not a test. The name alternative is
gone: an entry must carry `use:portal` outside comments, or `position: fixed` in a real style rule.
Both current entries still qualify — `FloatingPopup.svelte:289` and `:303`,
`TemplateConfirmDialog.svelte:55` — and the predicate is now proven both ways on synthetic text,
including the three near-misses (a comment mentioning `use:portal`, a commented-out
`position: fixed`, and an import naming `FloatingPopup`).

**Not closed, and not claimed:** containment is still inferred from a directory and a declared
`@container`, never from runtime ancestry. The remedy the first pass asked for — derive containment
from rendered structure — is what the ADR states static analysis cannot do, and is why #166 put the
guarantee in the CSS cascade. Recorded in the test's docstring and on the ticket.

**"No test pass claimed" is again the sandbox**, this time `EPERM` on `C:\Users\Park`. The four
gates were run in the main checkout.
