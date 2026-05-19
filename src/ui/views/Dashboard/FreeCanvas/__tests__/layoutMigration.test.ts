/**
 * layoutMigration.test.ts — coverage for V1 → V2 schema migration.
 * Ticket: #032.2.
 */

import {
	GRID_UNIT_TO_REM,
	migrateLayoutV1ToV2,
	type CanvasLayoutV1,
	type CanvasLayoutV2,
} from "../layoutMigration";

describe("migrateLayoutV1ToV2", () => {
	test("empty canvas: returns v2 with no widgets", () => {
		const v1: CanvasLayoutV1 = { schemaVersion: 1, widgets: [] };
		const v2 = migrateLayoutV1ToV2(v1);
		expect(v2.schemaVersion).toBe(2);
		expect(v2.widgets).toEqual([]);
	});

	test("single widget: x/y/w/h multiplied by GRID_UNIT_TO_REM", () => {
		const v1: CanvasLayoutV1 = {
			schemaVersion: 1,
			widgets: [{ id: "a", layout: { x: 1, y: 2, w: 3, h: 4 } }],
		};
		const v2 = migrateLayoutV1ToV2(v1);
		expect(v2.schemaVersion).toBe(2);
		expect(v2.widgets).toHaveLength(1);
		expect(v2.widgets[0]!).toEqual({
			id: "a",
			layout: {
				x: 1 * GRID_UNIT_TO_REM,
				y: 2 * GRID_UNIT_TO_REM,
				w: 3 * GRID_UNIT_TO_REM,
				h: 4 * GRID_UNIT_TO_REM,
			},
		});
	});

	test("multiple widgets: each independently converted, order preserved", () => {
		const v1: CanvasLayoutV1 = {
			schemaVersion: 1,
			widgets: [
				{ id: "a", layout: { x: 0, y: 0, w: 4, h: 3 } },
				{ id: "b", layout: { x: 5, y: 0, w: 4, h: 3 } },
				{ id: "c", layout: { x: 0, y: 4, w: 9, h: 2 } },
			],
		};
		const v2 = migrateLayoutV1ToV2(v1);
		expect(v2.widgets.map((w) => w.id)).toEqual(["a", "b", "c"]);
		expect(v2.widgets[1]!.layout).toEqual({
			x: 20,
			y: 0,
			w: 16,
			h: 12,
		});
		expect(v2.widgets[2]!.layout).toEqual({
			x: 0,
			y: 16,
			w: 36,
			h: 8,
		});
	});

	test("zero coordinates: 0 * factor = 0", () => {
		const v1: CanvasLayoutV1 = {
			schemaVersion: 1,
			widgets: [{ id: "origin", layout: { x: 0, y: 0, w: 1, h: 1 } }],
		};
		const v2 = migrateLayoutV1ToV2(v1);
		expect(v2.widgets[0]!.layout).toEqual({
			x: 0,
			y: 0,
			w: GRID_UNIT_TO_REM,
			h: GRID_UNIT_TO_REM,
		});
	});

	test("fractional grid input (legacy: should still round-trip mathematically)", () => {
		// On HEAD v1 is integer by convention, but the migrator must not
		// silently corrupt fractional input — it should scale mathematically.
		const v1: CanvasLayoutV1 = {
			schemaVersion: 1,
			widgets: [{ id: "x", layout: { x: 0.5, y: 1.25, w: 2.5, h: 1 } }],
		};
		const v2 = migrateLayoutV1ToV2(v1);
		expect(v2.widgets[0]!.layout).toEqual({
			x: 2,
			y: 5,
			w: 10,
			h: 4,
		});
	});

	test("schemaVersion bump: input v1 → output v2 typed literal", () => {
		const v1: CanvasLayoutV1 = {
			schemaVersion: 1,
			widgets: [{ id: "a", layout: { x: 1, y: 1, w: 1, h: 1 } }],
		};
		const v2: CanvasLayoutV2 = migrateLayoutV1ToV2(v1);
		expect(v2.schemaVersion).toBe(2);
	});

	test("idempotency: migrate(v2) === v2 (reference equality, no copy)", () => {
		const v2In: CanvasLayoutV2 = {
			schemaVersion: 2,
			widgets: [{ id: "a", layout: { x: 4, y: 4, w: 16, h: 12 } }],
		};
		const v2Out = migrateLayoutV1ToV2(v2In);
		expect(v2Out).toBe(v2In);
	});

	test("idempotency under double migration: v1 → v2 → v2 is stable", () => {
		const v1: CanvasLayoutV1 = {
			schemaVersion: 1,
			widgets: [{ id: "a", layout: { x: 3, y: 2, w: 4, h: 5 } }],
		};
		const once = migrateLayoutV1ToV2(v1);
		const twice = migrateLayoutV1ToV2(once);
		expect(twice).toBe(once);
		expect(twice).toEqual(once);
	});

	test("does not mutate input", () => {
		const v1: CanvasLayoutV1 = {
			schemaVersion: 1,
			widgets: [{ id: "a", layout: { x: 1, y: 1, w: 1, h: 1 } }],
		};
		const snapshot = JSON.parse(JSON.stringify(v1));
		migrateLayoutV1ToV2(v1);
		expect(v1).toEqual(snapshot);
	});

	test("GRID_UNIT_TO_REM exported constant equals spec value 4", () => {
		expect(GRID_UNIT_TO_REM).toBe(4);
	});
});
