/**
 * layoutMigration.ts — Free Canvas layout schema migration v1 → v2.
 *
 * Spec: .ai_internal/New-specification/FREE_CANVAS_SPEC.md §3.5.
 * Ticket: #032.2 (Phase 3 sub-PR 2).
 *
 * V1: integer grid units (legacy free-mode on HEAD v3.5.1-alpha).
 * V2: fractional rem-coordinates (new Free Canvas, continuous space).
 *
 * Conversion: `GRID_UNIT_TO_REM = 4` (1 grid unit = 4rem = 64px @ base 16).
 *
 * Pure function: no Svelte, no DOM, no Obsidian. Deterministic, idempotent.
 */

/** Conversion factor from V1 grid units to V2 rem. */
export const GRID_UNIT_TO_REM = 4;

/** V1 widget layout — integer grid-unit coordinates. */
export interface WidgetLayoutV1 {
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
}

/** V2 widget layout — fractional rem coordinates. */
export interface WidgetLayoutV2 {
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
}

/** V1 canvas layout container. */
export interface CanvasLayoutV1 {
	readonly schemaVersion: 1;
	readonly widgets: ReadonlyArray<{
		readonly id: string;
		readonly layout: WidgetLayoutV1;
	}>;
}

/** V2 canvas layout container. */
export interface CanvasLayoutV2 {
	readonly schemaVersion: 2;
	readonly widgets: ReadonlyArray<{
		readonly id: string;
		readonly layout: WidgetLayoutV2;
	}>;
}

/**
 * Migrate canvas layout V1 (grid units) → V2 (rem).
 *
 * Contract:
 *   - V1 widgets: x/y/w/h are integer grid units → multiplied by 4.
 *   - V2 input is returned as-is (idempotent).
 *   - Does not mutate input.
 *   - Deterministic.
 *
 * Per spec §3.5 the resolver, store and renderer all operate in rem;
 * therefore any project loaded with `schemaVersion: 1` must be migrated
 * exactly once before windows enter the FreeCanvas store.
 */
export function migrateLayoutV1ToV2(
	input: CanvasLayoutV1 | CanvasLayoutV2,
): CanvasLayoutV2 {
	if (input.schemaVersion === 2) {
		return input;
	}
	return {
		schemaVersion: 2,
		widgets: input.widgets.map((w) => ({
			id: w.id,
			layout: {
				x: w.layout.x * GRID_UNIT_TO_REM,
				y: w.layout.y * GRID_UNIT_TO_REM,
				w: w.layout.w * GRID_UNIT_TO_REM,
				h: w.layout.h * GRID_UNIT_TO_REM,
			},
		})),
	};
}
