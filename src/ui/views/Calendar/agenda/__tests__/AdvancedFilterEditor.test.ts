/**
 * AdvancedFilterEditor.test.ts — JSDOM-level component tests for the
 * Calendar agenda formula filter editor after the #022.6 migration.
 *
 * The component is now a thin shell over FormulaConstructor. These tests
 * verify the migration contract:
 *   • DataField[] → string[] field name mapping for the inner constructor
 *   • Calendar-aware `validate` adapter accepts Calendar-only functions
 *     (IS_OVERDUE, IS_TODAY, HAS_ANY_OF) without flagging them as Unknown
 *   • Help panel toggle (showHelp) renders/hides reference content
 *   • Validation badge reflects formula state (info → valid → error)
 *   • Snippet catalog is wired through to FormulaConstructor's empty-state
 *     Ctrl+Space picker
 *
 * Engine-level coverage (parseFormula, validateFormula) lives in
 * src/lib/helpers/formulaParser.test.ts — these tests do NOT re-test it.
 */

import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";

import AdvancedFilterEditor from "../AdvancedFilterEditor.svelte";
import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";

function makeField(name: string, type: DataFieldType = DataFieldType.String): DataField {
	return {
		name,
		type,
		repeated: false,
		derived: false,
		identifier: false,
	};
}

describe("AdvancedFilterEditor (Calendar agenda)", () => {
	describe("validation contract", () => {
		test("Calendar-specific IS_OVERDUE is NOT flagged as unknown", async () => {
			// Regression guard: the canonical `validateFormulaExpression` would
			// reject IS_OVERDUE because it lives in parseFormula, not
			// EXTENDED_FUNCTIONS. The migrated component must use validateFormula
			// from src/lib/formula instead.
			const { container } = render(AdvancedFilterEditor, {
				props: {
					formula: "IS_OVERDUE(dueDate)",
					fields: [makeField("dueDate", DataFieldType.Date)],
				},
			});
			await tick();
			await tick();

			// The FormulaConstructor surfaces errors as .ppp-fc-error nodes.
			const errors = container.querySelectorAll(".ppp-fc-error");
			expect(errors.length).toBe(0);

			// Toolbar hint should be the "valid" variant.
			expect(container.querySelector(".hint-valid")).not.toBeNull();
			expect(container.querySelector(".hint-error")).toBeNull();
		});

		test("invalid syntax produces error count in toolbar badge", async () => {
			const { container } = render(AdvancedFilterEditor, {
				props: {
					formula: "AND(",
					fields: [makeField("dueDate", DataFieldType.Date)],
				},
			});
			await tick();
			await tick();

			expect(container.querySelector(".hint-error")).not.toBeNull();
			expect(container.querySelector(".hint-valid")).toBeNull();
		});

		test("empty formula shows info hint (Ctrl+Space prompt)", () => {
			const { container } = render(AdvancedFilterEditor, {
				props: { formula: "", fields: [] },
			});

			expect(container.querySelector(".hint-info")).not.toBeNull();
			expect(container.querySelector(".hint-valid")).toBeNull();
			expect(container.querySelector(".hint-error")).toBeNull();
		});
	});

	describe("field-name mapping", () => {
		test("DataField[] is mapped to string[] for FormulaConstructor", async () => {
			// Field reference to an unknown name MUST produce an error;
			// a reference to a known name MUST NOT. This indirectly verifies
			// the `fields.map(f => f.name)` adapter inside the component.
			const { container, rerender } = render(AdvancedFilterEditor, {
				props: {
					formula: "IS_EMPTY(missingField)",
					fields: [makeField("dueDate", DataFieldType.Date)],
				},
			});
			await tick();
			await tick();
			expect(container.querySelector(".hint-error")).not.toBeNull();

			await rerender({
				formula: "IS_EMPTY(dueDate)",
				fields: [makeField("dueDate", DataFieldType.Date)],
			});
			await tick();
			await tick();
			expect(container.querySelector(".hint-error")).toBeNull();
			expect(container.querySelector(".hint-valid")).not.toBeNull();
		});
	});

	describe("help panel toggle", () => {
		test("help panel is hidden by default and toggles on click", async () => {
			const { container } = render(AdvancedFilterEditor, {
				props: { formula: "", fields: [] },
			});

			// Hidden initially
			expect(container.querySelector(".help-panel")).toBeNull();

			// Click toolbar Help button
			const helpBtn = container.querySelector(
				".toolbar-btn",
			) as HTMLButtonElement;
			expect(helpBtn).not.toBeNull();
			await fireEvent.click(helpBtn);
			await tick();

			expect(container.querySelector(".help-panel")).not.toBeNull();
			expect(helpBtn.classList.contains("active")).toBe(true);

			// Click again → hidden
			await fireEvent.click(helpBtn);
			await tick();
			expect(container.querySelector(".help-panel")).toBeNull();
		});
	});

	describe("change event", () => {
		test("change event from FormulaConstructor is forwarded to consumer", async () => {
			const handleChange = jest.fn();
			const { container, component } = render(AdvancedFilterEditor, {
				props: { formula: "", fields: [makeField("dueDate", DataFieldType.Date)] },
			});
			component.$on("change", (e) => handleChange(e.detail));

			const textarea = container.querySelector(
				".ppp-fc-textarea",
			) as HTMLTextAreaElement;
			expect(textarea).not.toBeNull();

			await fireEvent.input(textarea, { target: { value: "TODAY()" } });
			await tick();

			expect(handleChange).toHaveBeenCalledWith("TODAY()");
		});
	});

	describe("snippet catalog", () => {
		test("Ctrl+Space on empty formula surfaces Calendar snippets", async () => {
			const { container } = render(AdvancedFilterEditor, {
				props: { formula: "", fields: [] },
			});
			await tick();

			const textarea = container.querySelector(
				".ppp-fc-textarea",
			) as HTMLTextAreaElement;
			textarea.selectionStart = 0;
			textarea.selectionEnd = 0;

			await fireEvent.focus(textarea);
			await fireEvent.keyDown(textarea, {
				key: " ",
				code: "Space",
				ctrlKey: true,
			});
			await tick();

			// Calendar snippet inserts include IS_OVERDUE / IS_THIS_WEEK —
			// distinct from FormulaConstructor's default catalog (SUM/AVG/…).
			const snippetButtons = document.querySelectorAll(
				".ppp-fc-suggestion--snippet",
			);
			expect(snippetButtons.length).toBeGreaterThan(0);

			const allText = Array.from(snippetButtons)
				.map((b) => b.textContent ?? "")
				.join(" ");
			// At least one Calendar-specific snippet should be present
			// (we don't bind to localised labels — assertion uses raw insert hints
			// visible in description fields and labels).
			const hasCalendarHint =
				allText.includes("IS_OVERDUE") ||
				allText.includes("IS_THIS_WEEK") ||
				allText.includes("overdue") ||
				allText.includes("прострочен") ||
				allText.includes("неделю") ||
				allText.includes("week");
			expect(hasCalendarHint).toBe(true);
		});
	});
});
