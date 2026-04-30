# Stubs registry — obs-projects-plus

> **Purpose**: single source of truth for every "left for later" code site introduced during Stage A (3.4.2 WIP) and earlier.
> **Anchored in**: [docs/IMPLEMENTATION_BLUEPRINT.md §13](../docs/IMPLEMENTATION_BLUEPRINT.md#13-stub--todo-discipline) and [§A.7](../docs/IMPLEMENTATION_BLUEPRINT.md#a7--m2-anchor--yaml-визуализатор-notion-parity-sub-plugin).
> **Convention**: every stub in source carries a `// STB-<DOMAIN>-<SHORT> — <one-line rationale>` comment. The auditor sub-agent grep-fails the verification gate (§10.8) if any registered stub has no code anchor or any code anchor has no registry entry.

## Status legend

- **open** — stub planted, deferred work not yet started.
- **in-progress** — Stage B work on this stub has begun.
- **closed** — stub resolved; comment removed from source; row kept for audit history.

## ID format

`STB-<DOMAIN>-<SHORT>` where:
- `<DOMAIN>` ∈ `VISUALIZER`, `ENGINE`, `ROLLUP`, `RELATION`, `FORMULA`, `UI`, `I18N`, `BUILD`, `DOCS`.
- `<SHORT>` is a 1-3 word kebab/upper identifier.

## Active stubs

| ID | Status | Location | Type | Deferred to | Rationale | Discovered |
|----|--------|----------|------|-------------|-----------|------------|
| STB-VISUALIZER-LEAF | open | `src/ui/views/YamlVisualizer/YamlVisualizerView.svelte` (planned) | UX surface | Stage B / M3 | Top-level workspace-leaf mode (replace native Properties pane outside project view tab). Stage A scopes Visualizer to project-view-tab only via `processFrontMatter`; full leaf mode requires Obsidian view-registration plumbing + settings flag. | 2026-04-30 §A.7 |
| STB-VISUALIZER-COMMENT | open | `src/ui/views/YamlVisualizer/PropertyRowMenu.svelte` (planned) | UX feature | Stage B / M3+ | Per-property comments / discussion threads (Notion parity feature). Requires comment storage schema + threading UI; out of scope for Stage A's foundation cut. | 2026-04-30 §A.7 |
| STB-VISUALIZER-SHOWAS | open | `src/ui/views/YamlVisualizer/PropertyTypeEditor.svelte` (planned) | UX feature | Stage B / M3 | "Show as" sub-schema (e.g. select rendered as bar / ring / progress). Stage A renders only the type switcher + Number/Date format; full Show-as schema editor is M3 polish. | 2026-04-30 §A.7 |
| STB-VISUALIZER-LIMIT | open | `src/ui/views/YamlVisualizer/RelationConfigEditor.svelte` (planned) | UX feature | Stage B / M1 | Relation Limit-schema (cap N items, "show first K" rendering rule). Stage A renders all items with overflow popover; explicit Limit setting is M1. | 2026-04-30 §A.7 |
| STB-VISUALIZER-TWOWAY | open | `src/ui/views/YamlVisualizer/RelationConfigEditor.svelte` (planned) | UX + engine feature | Stage B / M1 | Two-way relation auto-sync (mutating both sides on edit). Stage A is read-only resolver (`crossProjectResolver.ts`); two-way write path requires conflict-resolution + cycle detection. | 2026-04-30 §A.7 |
| STB-VISUALIZER-FORMULA-POLISH | open | `src/ui/views/YamlVisualizer/FormulaEditorModal.svelte` (planned) | UX feature | Stage B / M3 | Formula editor full Notion parity: syntax highlighting, autocomplete, live preview, function reference panel. Stage A wraps existing `FormulaBar.svelte` as MVP. | 2026-04-30 §A.7 |
| STB-VISUALIZER-DRAG-REORDER | open | `src/ui/views/YamlVisualizer/PropertyRow.svelte` (planned) | UX feature | Stage B / M3 | Drag-to-reorder property rows in Visualizer (svelte-dnd-action integration with frontmatter rewrite). Stage A renders rows in declaration order only. | 2026-04-30 §A.7 |
| STB-VISUALIZER-BULK-EDIT | open | `src/ui/views/YamlVisualizer/VisualizerToolbar.svelte` (planned) | UX feature | Stage B / M3 | Multi-row selection + bulk edit operations (set type for N properties, hide N at once). Stage A operates one property at a time. | 2026-04-30 §A.7 |

## Closed stubs (audit history)

_None yet — Stage A has not opened any closures._

---

## Maintenance protocol

1. **Adding a stub**: open a new row here BEFORE planting the `// STB-…` comment in source. The grep gate compares both directions.
2. **Closing a stub**: move the row from "Active" to "Closed", note the resolving commit short-SHA + Stage-B milestone, remove the comment from source in the same change-set.
3. **Renaming a stub**: forbidden. Close the old ID, open a new ID, cross-link in the rationale column.
4. **Auditor invocation**: subagent `auditor` runs `grep -RnE "STB-[A-Z]+-[A-Z0-9-]+" src/` and compares against this file's ID column. Any mismatch → §10.8 gate FAIL.
