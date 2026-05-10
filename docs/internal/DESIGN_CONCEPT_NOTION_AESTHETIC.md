# Design Concept — Notion Aesthetic for obs-projects-plus

> Status: **Active reference.** Author: project owner. Captured 2026-05-05. Updated 2026-05-08.
> This document is the canonical visual reference for the V5 refactor.
> Old ticket IDs (REFACTOR-*, PARITY-*) reconciled with R5-* system — see `REFACTOR_BACKLOG_V5.md §R5-017`.

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

> **Updated 2026-05-08** — migrated from old REFACTOR-*/PARITY-* IDs to current R5-* backlog system.
> Full mapping rationale: `REFACTOR_BACKLOG_V5.md §R5-017`.

| Concept section | R5-* Ticket(s) | Status |
|-----------------|----------------|--------|
| 1. Foundation — air & grid (px→rem, StrictGrid, border tokens) | **R5-018** (grid token sweep) | ✅ DONE V6.0 |
| 2. Properties — tags pastel palette | **R5-005** (unified color/palette system) | ✅ DONE V5.3 |
| 2. Properties — URL/Email/Phone field aesthetics | NOTION_PARITY PARITY-001 | ✅ DONE V5 |
| 2. Properties — relation picker popover (not heavy modal) | **R5-019** (relation picker popover) | ✅ DONE V6.0 |
| 3. Dashboard — row drag handle + bulk select | **R5-020** (row interaction chrome) | ✅ DONE V6.0 |
| 3. Dashboard — "+" affordance on hover | **R5-013** (canvas decompose) | 🔄 PARTIAL |
| 4. YAML visualizer — cover/icon + hide empty fields | **R5-011** + **R5-012** (Properties pane) | ✅ BOTH DONE V6.0 |
| 5. Interaction — a11y focus ring global | REFACTOR-303 | ✅ DONE (keep invariant) |
| 5. Interaction — soft fade-in on hover controls | **R5-021** (CSS transitions polish) | ✅ DONE V6.0 |

## Acceptance signals

- Pastel palette swatch defined as CSS custom-properties in `styles.css`,
  consumed by tag/select/multi-select chips and group headers.
- All hardcoded `px` values converted to `rem` (R5-018 ✅ DONE V6.0).
- Focus-visible ring is global, never suppressed (REFACTOR-303 done; keep invariant).
- Dashboard "+" affordance and drag handle are render-only on hover, and
  keyboard-reachable.
- Visualizer can collapse empty fields via single toggle persisted per note.

## Out of scope for this concept

- Mobile-specific gestures (separate audit pass).
- Dark/light theme variants beyond Obsidian token mapping.
- Animated/illustrated empty states.

---

**V6.0 status:** Grid rebuild principles are implemented across R5-018 (tokens), R5-019 (relation popover), R5-020 (row chrome), R5-021 (transitions), R5-012 (Properties pane). Remaining open: R5-013 (canvas decompose, partial) and NPLAN-D1 (RichText annotations, XL).
