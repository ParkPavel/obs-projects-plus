# Design Concept — Notion Aesthetic for obs-projects-plus

> Status: **Pre-design / for review.** Author: project owner. Captured 2026-05-05.
> This document seeds the StrictGrid (REFACTOR-302) and Layer-4 UX work
> (REFACTOR-401/402/404) and is the reference for any "Notion-feel" decision.

## North star

The plugin must feel like a **living continuation of Notion inside Obsidian**:
calm, content-first, design recedes behind data. We trade visual loudness for
deliberate minimalism. Logic clothed in restraint.

---

## 1. Foundation — air & grid

Design is secondary to content. It is almost invisible.

- **Colour silence.** Neutral spectrum. Background: pure white or deep "night"
  grey. No harsh black dividers. Cell/block borders barely perceptible
  (`#EDEDED` or transparent `rgba`).
- **Typography.** System fonts with proper kerning. Property labels slightly
  smaller than body text, in grey, with a type-icon on the left. Visual
  rhythm without noise.
- **Spacing.** Let text breathe. Generous internal padding inside cells.
  Content must not feel compressed by database boundaries.

## 2. Properties — typing aesthetic

Each field is a visual anchor.

- **Tags (Select / Multi-select).** Pastel palette only. Sufficient text
  contrast on soft-rounded chips. No screaming brand colours.
- **Relations.** Interactive elements, not raw links. Clicking a relation
  opens a clean searchable popover, not a heavy modal.
- **Checkbox.** Small, gently rounded square. Calm fill on activation, no
  bouncy animation.

## 3. Dashboard — block canvas

The dashboard is a canvas. Nested databases get a body.

- **Drag-handle.** Six-dot grip on the left of every block/row, revealed on
  hover. Gives a sense of physical control.
- **The "+" button.** Appears only when needed. Hidden interactivity. On
  hover over empty dashboard space a soft `+` glyph fades in to add a
  sub-database or a text block.
- **Grouping.** Group headers in Kanban / list views are terse. Toggle arrow
  on the left collapses a whole stratum.

## 4. YAML visualizer — face of a note

The point where we replace the stock Obsidian view.

- **Icons & covers.** Emoji + cover image at the top of the visualizer.
  YAML stops being dry.
- **Hide empty fields.** Unfilled properties stay hidden until the user hits
  "Show all". Preserves order and depth.

## 5. Interaction — bodily feedback

- **Hover.** Row highlight is the gentlest possible light-grey. "I see you."
- **Transitions.** No abrupt entries. Soft fade-in for controls on
  interaction.

---

## Implementation map (which ticket implements which principle)

| Concept section | Tickets that realise it |
|-----------------|--------------------------|
| 1. Foundation — air & grid | REFACTOR-404 (px→rem), REFACTOR-302 (StrictGrid), styles.css token sweep |
| 2. Properties — typing aesthetic | REFACTOR-401 (color picker pastel set), PARITY-001 (URL/Email/Phone field aesthetics), PARITY-006 (relation popover) |
| 3. Dashboard — block canvas | DashboardCanvas spacing (REFACTOR-301 done), PARITY-024 (bulk select), PARITY-025 (row drag handle) |
| 4. YAML visualizer | PARITY-011 (cover/icon), Visualizer hidden-empties toggle |
| 5. Interaction | REFACTOR-303 (a11y focus, done), CSS transitions sweep (Layer 5 polish) |

## Acceptance signals

- Pastel palette swatch defined as CSS custom-properties in `styles.css`,
  consumed by tag/select/multi-select chips and group headers.
- All hardcoded `px` values converted to `rem` (REFACTOR-404 acceptance).
- Focus-visible ring is global, never suppressed (REFACTOR-303 done; keep
  invariant in audit gate REFACTOR-501).
- Dashboard "+" affordance and drag handle are render-only on hover, and
  keyboard-reachable.
- Visualizer can collapse empty fields via single toggle persisted per note.

## Out of scope for this concept

- Mobile-specific gestures (separate audit pass).
- Dark/light theme variants beyond Obsidian token mapping.
- Animated/illustrated empty states.

---

**Next concrete step (per author):** rebuild Grid View on these principles.
This is REFACTOR-302 + PARITY-001/006/011/017. They will be batched in a
dedicated design session before implementation.
