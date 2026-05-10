# Handoff V6.5 — Closing Audit

**Date:** 2026-05-10  
**Baseline at entry:** 112 suites / 1749 tests PASS, tsc 0 errors, PX-budget 181/191  
**Baseline at exit:** 112 suites / 1749 tests PASS, tsc 0 errors, PX-budget 181/191

---

## Tickets closed this session

### NPLAN-S0.1 — Pastel design tokens

**Complexity:** Already done (audit-close)  
Already fully implemented in `src/ui/tokens/tokens.css`: complete `--ppp-db-*` palette with status, priority, block, slide-in panel, 8 chip rotations, node formula editor, and row hover tokens. No code changes needed.

---

### NPLAN-S0.3 — Slide-in panel scaffolding

**Complexity:** Already done (audit-close)  
Already fully implemented in `src/ui/components/SlideInPanel/SlideInPanel.svelte`: right-edge anchor, `transform: translateX` 200ms ease-out, backdrop with click-to-close, Esc keydown handler, `--ppp-db-panel-*` tokens. No code changes needed.

---

### NPLAN-S0.2 — Free-placement canvas engine

**Complexity:** M  
**Files changed:**
- `src/ui/views/Dashboard/widgets/draggable.ts` — new Svelte action; injects `⠿` drag handle in widget header; pointer-based drag that maps pixel delta to grid units; live preview via inline `gridColumn`/`gridRow`; `onMove(x, y)` callback on pointer up
- `src/ui/views/Dashboard/widgets/WidgetHost.svelte` — imported `draggable`; added `$: draggableParams`; wired `use:draggable`; fixed `grid-column` from `span w` → `${x} / span ${w}` and `grid-row` from `span h` → `${y} / span ${h}` for true free placement; added drag handle CSS (hover-only, `ppp-widget-host--dragging` state, `ppp-dragging` body class)
- `src/ui/views/Dashboard/WidgetGrid.svelte` — added `+` affordance in `layoutMode === "free"` (fade-in on canvas hover, dashed border btn); added CSS for `.ppp-canvas-add-affordance` and `.ppp-canvas-add-btn`
- `docs/internal/NOTION_PARITY.md` — S0.1/S0.2/S0.3 rows updated to ✅

**What was done:**  
The `resizable.ts` action was already fully implemented. Missing pieces for S0.2:

1. **x/y positioning** — `WidgetHost` was using `span w`/`span h` (auto-flow), not using `layout.x`/`layout.y`. Changed to `${x} / span ${w}` and `${y} / span ${h}` so widgets place at their stored grid coordinates.

2. **`draggable.ts`** — New action analogous to `resizable.ts`. Injects a `⠿` button as first child of `.ppp-widget-header`, captures pointer on mousedown, computes grid delta from pixel delta ÷ measured cell size, live-previews inline gridColumn/gridRow, calls `onMove(newX, newY)` on pointer up. Respects `locked` and `readonly` via `enabled` param.

3. **`+` affordance** — Added a dashed `+` button that fades in when the free-canvas is hovered, placed as last grid item spanning all columns.

---

## Open tickets remaining (post-V6.5)

| ID | Ticket | Sprint | Size | Status |
|---|---|---|---|---|
| NPLAN-S2.1-S2.3 | database-call primitive + ViewTabBar | 2 | XL | ⬜ |
| NPLAN-S3.1-S3.3+B1 | Visual settings panels + relative-date filters | 3 | XL | ⬜ |
| NPLAN-B2 | Timeline (Gantt) view widget | 5 | XL | ⬜ |
| NPLAN-S6.1-S6.3 | Node formula builder | 6 | XL | ⬜ |
| NPLAN-S7.1-S7.3 | RecordCardView, export, keyboard shortcuts | 7 | L | ⬜ |

Sprint 0 fully closed. Next: Sprint 2 (database-call primitive) — depends on S0.

---

## Invariants verified

1. Dispatch by `DataFieldType` ✅
2. Board columns = derived from unique values ✅
3. Dates = 4 params ✅
4. Derived fields via pipeline ✅
5. Zero `@ts-ignore` in `src/` ✅
6. PX-budget ≤ 191 (actual: 181) ✅
7. `filterEvaluator.ts` = single canonical filter engine ✅
