# Design spec — visual weight in a widget header (#169), 2026-09-03

> Designer pass (read-only) against `main` = `485af8f`. The keyboard half of #169 is merged; this is
> the sentence that stayed open: *primary action heavier than the cog; the view filter in a
> permanently visible bar.* Implementation needs an architect pass first — it touches
> `WidgetHeaderActions`, `WidgetHost` and a filter bar, and it changes behaviour.

## The finding that changes the ticket's shape

**Half of "the view filter in a permanently visible bar" is already built and merged.**
`BlockFilterBar.svelte`, used by `database-call` (`DatabaseCallBlock.svelte:402`), is
unconditionally visible in edit mode — `{#if !readonly || conditions.length > 0}` — sits above the
content, and shows a "+ Filter" affordance when empty. Nothing anywhere said it satisfied the
ticket, so the ticket kept listing it as open. `data-table`'s `TableControlBar.svelte` is the
named-but-unfilled twin: its own header comment reserves the spot ("Filter pills … arrive in F2.4 —
the bar is the canonical place they will land in").

So this half is "confirm `data-table` uses the pattern `database-call` already has", not new UI.

## 1. What "primary action" means

| Widget type | Primary action |
|---|---|
| `data-table` | **Add record** — not surfaced at header weight today |
| `database-call` | **Add record** to the active tab's source |
| `chart` | **none** |
| `stats` | **none** |
| `checklist` | **Add item** |

**The rule for anything not listed:** a widget has a primary action only if it *creates or appends
the thing the user reads that block for*. Filtering, sorting, display config and navigation are
never primary. A type with no such action gets no slot — that is a real answer, not a gap to fill
later.

Mechanically this is `hasPrimaryAction` / `onPrimaryAction` resolved in `WidgetHost` exactly as
`hasCog` and `hasPipeline` already are. Not a new mechanism.

## 2. Three weights, expressed in what exists

Today everything in the header is the same weight: `1.5rem`, `--text-faint`, hover-revealed —
except the always-visible `⋯` menu at `--text-muted`. That flatness is the defect.

- **Primary action** — its own element, left of the `⋯` menu, never inside the hover-only group and
  never in the overflow menu.
  - Always visible. A primary action you must hover to discover is not primary.
  - Fill: `var(--interactive-accent)` — the role the pipeline-count badge in this same file already
    uses for its highest-weight accent. No new token, no hex.
  - **Icon and a short text label** (`+ Add record`), not icon-only. Every other control here is a
    bare glyph, so the label is most of the weight difference on its own.
  - Widened by horizontal padding one step up the space scale, not by a taller box: the header's
    `min-height` is already declared in `WidgetShell` and must not gain a second constraint.
  - Radius: the same `--ppp-radius-sm` the icon buttons use. Same shape family, different fill.
- **Cog / pipeline / lock / remove** — unchanged. The ask was that the primary gain weight, not
  that the rest lose it, and they are already at the floor.
- **The `⋯` menu** — unchanged, and this is a hard constraint: it is the keyboard entry point that
  `A169_focusPriority.acceptance.test.ts` pins. This spec must not re-break it.

Order, left to right: title → primary action → `⋯` menu → hover cluster → remove.

## 3. The filter bar

- **Where:** directly under the header, the position `BlockFilterBar` already occupies. `data-table`
  adopts the same bar — either by putting the pills in `TableControlBar`, whose comment reserves the
  spot, or by reusing `BlockFilterBar` verbatim. **Do not build a second filter surface.**
- **With no filter set:** the bar still renders, showing only the add affordance. Keep
  `BlockFilterBar`'s existing rule — visible whenever editable, or whenever there is something to
  show in read mode.
- **Narrow container:** the container decides (#166). Below the width where a pill's label would
  truncate, pills and the add affordance collapse to icon-only. The threshold reuses the `8rem` pill
  budget already declared in `TableControlBar`, as a `@container widget` rule — never a viewport
  media query.

## 4. What an automated check can assert

1. The primary action's computed `visibility` is `visible` and `opacity` is `1` with no hover
   applied — it is not hover-gated like its neighbours.
2. The primary action's `background-color` is non-transparent while the cog's is transparent at
   rest — the fill weight the others lack.
3. The `⋯` menu is still visible with no hover — a regression guard on the settled keyboard
   contract.
4. Cog / pipeline / lock / remove are still `visibility: hidden` at rest and `visible` under
   `:hover` — this spec did not touch the group.
5. Rendered with no filter, the bar's container exists and its `display` is not `none` — always
   visible, not conditionally mounted.
6. The same markup at two container widths gives a different computed `display` for the pill label,
   from the `@container` rule alone — the collapse is container-derived, not viewport-derived.

## 5. Deliberately unchanged

- The window-anchored popup boundary of `ADR_MATRYOSHKA_SIZING_2026-09-02.md` — this is header and
  bar chrome, not popup positioning.
- `WidgetShell`'s roving tabindex — the ticket already ruled it out: it is the grid's keyboard
  contract.
- The `⋯` menu's contents. The primary action is additive to the header, not a promotion out of the
  menu.
- The choice between extending `TableControlBar` and reusing `BlockFilterBar` — both satisfy "one
  canonical filter surface", and which is cheaper depends on how much of the sort/search wiring the
  pills would share. That is the architect's call, not the designer's.

## Open, with a default

- **Should `chart` and `stats` ever gain a primary action?** Recommended: **no**. They are derived
  surfaces here — their configs are computed, never authored per record — so "no primary action" is
  the correct answer today rather than a placeholder.
- **Copy for the labels** — "Add record" / "Add item" recommended; wording is a user decision.
