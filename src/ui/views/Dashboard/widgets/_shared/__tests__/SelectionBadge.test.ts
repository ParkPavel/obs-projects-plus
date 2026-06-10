/**
 * SelectionBadge.test.ts — visibility predicate + component-mount coverage.
 *
 * Spec: .ai_internal/New-specification/CROSS_WIDGET_SPEC.md §6.2, §7.
 * Ticket: #044.5.
 */

import "@testing-library/jest-dom";

import {
	EMPTY_SELECTION,
	type SelectionState,
} from "src/ui/views/Dashboard/canvasSelectionStore";

const SelectionBadge =
	require("../SelectionBadge.svelte").default;
const { shouldShowSelectionBadge } =
	require("../SelectionBadge.svelte");

function mount(props: Record<string, unknown>) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	const component = new SelectionBadge({ target, props });
	return {
		component,
		target,
		destroy() {
			component.$destroy();
			target.remove();
		},
	};
}

const externalSelection = (
	field: string,
	value: string,
): SelectionState => ({
	source: "chart:other-widget",
	field,
	value,
	op: "is",
});

describe("shouldShowSelectionBadge — visibility predicate (#044.5)", () => {
	it("hides badge when selection is empty", () => {
		expect(
			shouldShowSelectionBadge(
				{ type: "stats", id: "w1" },
				EMPTY_SELECTION,
			),
		).toBe(false);
	});

	it("shows badge for Stats widget when external selection is active", () => {
		expect(
			shouldShowSelectionBadge(
				{ type: "stats", id: "w1" },
				externalSelection("status", "Done"),
			),
		).toBe(true);
	});

	it("shows badge for DataTable widget when external selection is active", () => {
		expect(
			shouldShowSelectionBadge(
				{ type: "data-table", id: "w1" },
				externalSelection("status", "Done"),
			),
		).toBe(true);
	});

	it("hides badge for Chart widget (driver-only in v1, no badge per spec §6.2)", () => {
		expect(
			shouldShowSelectionBadge(
				{ type: "chart", id: "w1" },
				externalSelection("status", "Done"),
			),
		).toBe(false);
	});

	it("hides badge for non-receiver widget types (checklist, comparison, etc.)", () => {
		for (const t of ["checklist", "comparison", "view-port", "summary-row", "data-list"]) {
			expect(
				shouldShowSelectionBadge(
					{ type: t, id: "w1" },
					externalSelection("status", "Done"),
				),
			).toBe(false);
		}
	});

	it("self-skip: hides badge when DataTable widget is itself the driver", () => {
		const ownSelection: SelectionState = {
			source: "data-table:w1",
			field: "status",
			value: "Done",
			op: "is",
		};
		expect(
			shouldShowSelectionBadge(
				{ type: "data-table", id: "w1" },
				ownSelection,
			),
		).toBe(false);
	});

	it("self-skip: hides badge when Stats widget would emit its own selection (v2 driver)", () => {
		const ownSelection: SelectionState = {
			source: "stats:w1",
			field: "status",
			value: "Done",
			op: "is",
		};
		expect(
			shouldShowSelectionBadge(
				{ type: "stats", id: "w1" },
				ownSelection,
			),
		).toBe(false);
	});

	it("widget-scoped: another DataTable still shows the badge for a sibling's emission", () => {
		const otherSelection: SelectionState = {
			source: "data-table:other",
			field: "status",
			value: "Done",
			op: "is",
		};
		expect(
			shouldShowSelectionBadge(
				{ type: "data-table", id: "w1" },
				otherSelection,
			),
		).toBe(true);
	});
});

describe("SelectionBadge.svelte — component (#044.5)", () => {
	it("renders the field label and value text", () => {
		const m = mount({ field: "status", value: "Done" });
		try {
			const badge = m.target.querySelector('[data-testid="ppp-selection-badge"]');
			expect(badge).not.toBeNull();
			expect(badge?.textContent).toContain("status");
			expect(badge?.textContent).toContain("Done");
		} finally {
			m.destroy();
		}
	});

	it("sets the title attribute to 'field: value' for hover tooltip (spec §6.2)", () => {
		const m = mount({ field: "tags", value: "Some long category label" });
		try {
			const badge = m.target.querySelector<HTMLSpanElement>('[data-testid="ppp-selection-badge"]');
			expect(badge?.getAttribute("title")).toBe("tags: Some long category label");
		} finally {
			m.destroy();
		}
	});

	it("dispatches a 'clear' event when the ✕ button is clicked", () => {
		const m = mount({ field: "status", value: "Done" });
		try {
			let cleared = false;
			m.component.$on("clear", () => {
				cleared = true;
			});
			const clearBtn = m.target.querySelector<HTMLButtonElement>(".ppp-selection-badge__clear");
			expect(clearBtn).not.toBeNull();
			clearBtn?.click();
			expect(cleared).toBe(true);
		} finally {
			m.destroy();
		}
	});

	it("clear button stops propagation so background-click handlers do not double-fire", () => {
		const m = mount({ field: "status", value: "Done" });
		try {
			let bubbled = false;
			m.target.addEventListener("click", () => {
				bubbled = true;
			});
			const clearBtn = m.target.querySelector<HTMLButtonElement>(".ppp-selection-badge__clear");
			clearBtn?.click();
			// stopPropagation on the inner handler prevents the click from bubbling
			// to the outer target — guards against the canvas-background clearer
			// firing twice for one user gesture.
			expect(bubbled).toBe(false);
		} finally {
			m.destroy();
		}
	});

	it("clear button is keyboard-reachable (button element, not div)", () => {
		const m = mount({ field: "status", value: "Done" });
		try {
			const clearBtn = m.target.querySelector(".ppp-selection-badge__clear");
			expect(clearBtn?.tagName).toBe("BUTTON");
			expect(clearBtn?.getAttribute("aria-label")).toBe("Clear selection");
		} finally {
			m.destroy();
		}
	});
});
