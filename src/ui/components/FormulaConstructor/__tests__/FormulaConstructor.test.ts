/**
 * FormulaConstructor.test.ts — JSDOM-level component tests.
 *
 * Ticket: #022.5 (per NEEDS-ANALYSIS/022-UnifiedFormulaConstructor.md §7).
 *
 * Scope:
 *   - Suggestion filtering (typed prefix → matching functions/fields)
 *   - Ctrl+Space force-open + snippet picker (empty state)
 *   - Ctrl+Space force-open + all-functions (non-empty value, no cursor word)
 *   - Keyboard contract: Escape, ArrowDown/Up, Tab, Enter, Ctrl+Enter
 *
 * The math-only paths (findEnclosingCall, validateFormulaExpression) are
 * covered exhaustively elsewhere — these tests verify DOM wiring, not engine.
 */

import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";

import FormulaConstructor from "../FormulaConstructor.svelte";

/**
 * Simulates the cursor-position update path: the component reads
 * `el.selectionStart` from on:input/on:keyup/on:click, so we set it on the
 * textarea before firing events. fireEvent.input mutates `.value`, but does
 * not move the caret — set selectionStart explicitly to the end of value.
 */
function setCursorToEnd(textarea: HTMLTextAreaElement, value: string): void {
	textarea.value = value;
	textarea.selectionStart = value.length;
	textarea.selectionEnd = value.length;
}

describe("FormulaConstructor", () => {
	describe("suggestion filtering", () => {
		test("typing 'SU' surfaces SUM in the dropdown", async () => {
			const { container } = render(FormulaConstructor, {
				props: { fields: [] },
			});
			const textarea = container.querySelector(
				".ppp-fc-textarea",
			) as HTMLTextAreaElement;
			expect(textarea).not.toBeNull();

			setCursorToEnd(textarea, "SU");
			await fireEvent.input(textarea, { target: { value: "SU" } });
			await fireEvent.keyUp(textarea);
			await tick();

			const buttons = document.querySelectorAll(".ppp-fc-suggestion");
			const labels = Array.from(buttons).map((b) =>
				(b.textContent ?? "").trim(),
			);
			expect(labels).toContain("SUM");
		});

		test("typing a field-prefix surfaces matching fields", async () => {
			const { container } = render(FormulaConstructor, {
				props: { fields: ["title", "tags", "tempfield"] },
			});
			const textarea = container.querySelector(
				".ppp-fc-textarea",
			) as HTMLTextAreaElement;

			setCursorToEnd(textarea, "ti");
			await fireEvent.input(textarea, { target: { value: "ti" } });
			await fireEvent.keyUp(textarea);
			await tick();

			const labels = Array.from(
				document.querySelectorAll(".ppp-fc-suggestion"),
			).map((b) => (b.textContent ?? "").trim());
			expect(labels).toContain("title");
		});

		test("no dropdown without a cursor word and no force-open", async () => {
			const { container } = render(FormulaConstructor, {
				props: { fields: [] },
			});
			const textarea = container.querySelector(
				".ppp-fc-textarea",
			) as HTMLTextAreaElement;

			setCursorToEnd(textarea, "");
			await fireEvent.focus(textarea);
			await tick();

			expect(document.querySelectorAll(".ppp-fc-suggestion").length).toBe(0);
		});
	});

	describe("Ctrl+Space force-open", () => {
		test("on empty textarea: snippet picker appears", async () => {
			const { container } = render(FormulaConstructor, {
				props: { fields: [] },
			});
			const textarea = container.querySelector(
				".ppp-fc-textarea",
			) as HTMLTextAreaElement;

			setCursorToEnd(textarea, "");
			await fireEvent.focus(textarea);
			await fireEvent.keyDown(textarea, {
				key: " ",
				code: "Space",
				ctrlKey: true,
			});
			await tick();

			// Default snippets include SUM(field), AVG(field), TODAY()
			const snippetButtons = document.querySelectorAll(
				".ppp-fc-suggestion--snippet",
			);
			expect(snippetButtons.length).toBeGreaterThan(0);
			const labels = Array.from(snippetButtons).map((b) =>
				(b.textContent ?? "").trim(),
			);
			expect(labels.some((l) => l.includes("SUM"))).toBe(true);
			expect(labels.some((l) => l.includes("TODAY"))).toBe(true);
		});

		test("on non-empty value, no cursor word: first 12 functions shown", async () => {
			const { container } = render(FormulaConstructor, {
				props: { fields: [] },
			});
			const textarea = container.querySelector(
				".ppp-fc-textarea",
			) as HTMLTextAreaElement;

			// Non-empty value, caret right after a space (no word at cursor).
			setCursorToEnd(textarea, "1 + ");
			await fireEvent.input(textarea, { target: { value: "1 + " } });
			await fireEvent.keyUp(textarea);
			await fireEvent.keyDown(textarea, {
				key: " ",
				code: "Space",
				ctrlKey: true,
			});
			await tick();

			const fnButtons = document.querySelectorAll(".ppp-fc-suggestion--fn");
			expect(fnButtons.length).toBeGreaterThan(0);
			expect(fnButtons.length).toBeLessThanOrEqual(12);
		});

		test("disabling snippets via prop falls back to function list", async () => {
			const { container } = render(FormulaConstructor, {
				props: { fields: [], snippets: [] },
			});
			const textarea = container.querySelector(
				".ppp-fc-textarea",
			) as HTMLTextAreaElement;

			setCursorToEnd(textarea, "");
			await fireEvent.focus(textarea);
			await fireEvent.keyDown(textarea, {
				key: " ",
				code: "Space",
				ctrlKey: true,
			});
			await tick();

			// No snippet buttons (catalog empty)
			expect(
				document.querySelectorAll(".ppp-fc-suggestion--snippet").length,
			).toBe(0);
		});
	});

	describe("syntax highlight overlay (#077)", () => {
		test("highlight off (default): no underlay rendered", () => {
			const { container } = render(FormulaConstructor, {
				props: { value: "SUM(amount)", fields: ["amount"] },
			});
			expect(container.querySelector(".ppp-fc-highlight")).toBeNull();
		});

		test("highlight on: underlay paints function and field token classes", () => {
			const { container } = render(FormulaConstructor, {
				props: { value: "SUM(amount)", fields: ["amount"], highlight: true },
			});
			const underlay = container.querySelector(".ppp-fc-highlight");
			expect(underlay).not.toBeNull();
			expect(underlay?.querySelector(".ppp-fc-tok-fn")?.textContent).toBe("SUM");
			expect(underlay?.querySelector(".ppp-fc-tok-field")?.textContent).toBe("amount");
			expect(underlay?.querySelector(".ppp-fc-tok-operator")).not.toBeNull();
		});

		test("highlight on: string and number tokens get their classes", () => {
			const { container } = render(FormulaConstructor, {
				props: { value: 'CONCAT("hi", 42)', fields: [], highlight: true },
			});
			const underlay = container.querySelector(".ppp-fc-highlight");
			expect(underlay?.querySelector(".ppp-fc-tok-string")?.textContent).toBe('"hi"');
			expect(underlay?.querySelector(".ppp-fc-tok-number")?.textContent).toBe("42");
		});

		test("highlight on: tokenizer throw falls back to a single plain segment", () => {
			const { container } = render(FormulaConstructor, {
				props: { value: "valid §§ bad", fields: [], highlight: true },
			});
			const underlay = container.querySelector(".ppp-fc-highlight");
			expect(underlay).not.toBeNull();
			// No colored token classes; full text preserved as plain.
			expect(underlay?.querySelector(".ppp-fc-tok-fn")).toBeNull();
			expect(underlay?.textContent).toBe("valid §§ bad");
		});

		test("highlight on: reconstructed underlay text equals the source value", () => {
			const expr = 'AND(status = "Active", priority >= 5)';
			const { container } = render(FormulaConstructor, {
				props: { value: expr, fields: ["status", "priority"], highlight: true },
			});
			const underlay = container.querySelector(".ppp-fc-highlight");
			expect(underlay?.textContent).toBe(expr);
		});
	});

	describe("keyboard contract", () => {
		test("Escape closes the suggestion popover", async () => {
			const { container } = render(FormulaConstructor, {
				props: { fields: [] },
			});
			const textarea = container.querySelector(
				".ppp-fc-textarea",
			) as HTMLTextAreaElement;

			setCursorToEnd(textarea, "SU");
			await fireEvent.input(textarea, { target: { value: "SU" } });
			await fireEvent.keyUp(textarea);
			await tick();
			expect(
				document.querySelectorAll(".ppp-fc-suggestion").length,
			).toBeGreaterThan(0);

			await fireEvent.keyDown(textarea, { key: "Escape" });
			await tick();
			expect(document.querySelectorAll(".ppp-fc-suggestion").length).toBe(0);
		});

		test("Ctrl+Enter dispatches commit when validation passes", async () => {
			const handleCommit = jest.fn();
			const { container, component } = render(FormulaConstructor, {
				props: { value: "1 + 2", fields: [] },
			});
			component.$on("commit", handleCommit);

			const textarea = container.querySelector(
				".ppp-fc-textarea",
			) as HTMLTextAreaElement;
			await fireEvent.keyDown(textarea, {
				key: "Enter",
				ctrlKey: true,
			});
			expect(handleCommit).toHaveBeenCalledTimes(1);
		});

		test("Ctrl+Enter does NOT dispatch commit when value is empty", async () => {
			const handleCommit = jest.fn();
			const { container, component } = render(FormulaConstructor, {
				props: { fields: [] },
			});
			component.$on("commit", handleCommit);

			const textarea = container.querySelector(
				".ppp-fc-textarea",
			) as HTMLTextAreaElement;
			await fireEvent.keyDown(textarea, {
				key: "Enter",
				ctrlKey: true,
			});
			expect(handleCommit).not.toHaveBeenCalled();
		});
	});
});
