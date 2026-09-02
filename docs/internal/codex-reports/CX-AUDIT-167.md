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
