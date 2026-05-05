/**
 * Canonical type contracts for the unified color system (v4.0 / Layer 0).
 *
 * NORMATIVE source of truth for color tokens, palettes and palette
 * persistence. After REFACTOR-401, all color math and allowlists move
 * into `lib/colors/` and consume this contract.
 *
 * Per ARCHITECTURE_V4 §5 and PHASE_3_TICKETS REFACTOR-006:
 *   - Types ONLY. Zero runtime code. Zero side effects.
 *   - No circular imports.
 *
 * @since 4.0
 * @see docs/ARCHITECTURE_V4.md §5
 * @see docs/PHASE_3_TICKETS.md REFACTOR-006
 */

import type { ProjectId } from "src/lib/engine/contracts";

export type { ProjectId };

/**
 * Stable identifier for a built-in preset color (e.g. "red", "blue-2").
 *
 * The exact alphabet of preset ids is defined by the persistence layer
 * (REFACTOR-401). Treated here as an opaque branded string so callers
 * cannot accidentally pass arbitrary text where a preset is required.
 */
export type PresetColorId = string & { readonly __brand: "PresetColorId" };

/**
 * Single color expressed as one of three tagged shapes.
 *
 *   - `css-var`: late-bound to whatever the active Obsidian theme
 *     resolves the variable to. Recommended for theme-aware UI.
 *   - `hex`:    literal `#rrggbb` / `#rrggbbaa` for user-picked colors.
 *   - `preset`: one of the bundled palette ids (resolved by the
 *     persistence layer at render time).
 *
 * The shape is the discriminator; `kind` is the field tag.
 */
export type ColorToken =
  | { readonly kind: "css-var"; readonly name: `--${string}` }
  | { readonly kind: "hex"; readonly value: `#${string}` }
  | { readonly kind: "preset"; readonly id: PresetColorId };

/**
 * Named, ordered collection of color tokens.
 */
export interface ColorPalette {
  readonly id: string;
  readonly name: string;
  readonly swatches: readonly ColorToken[];
}

/**
 * Persistence scope for palettes / favorites.
 *
 * `"global"` palettes live in plugin settings; per-project palettes
 * live in the project definition and override globals when present.
 */
export type PaletteScope = "global" | ProjectId;

/**
 * Snapshot returned by `PaletteStore.load`.
 */
export interface PaletteSnapshot {
  readonly palettes: readonly ColorPalette[];
  readonly favorites: readonly ColorToken[];
}

/**
 * Persistence interface for palettes and favorites.
 *
 * REFACTOR-401 lands the concrete `lib/colors/persistence.ts`
 * implementation; this contract is what `ColorPicker.svelte` and
 * `RecordItem.svelte` will consume.
 */
export interface PaletteStore {
  load(scope: PaletteScope): Promise<PaletteSnapshot>;
  save(scope: PaletteScope, snapshot: PaletteSnapshot): Promise<void>;
}
