import { render, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import FormulaConstructor from "../FormulaConstructor.svelte";
import FormulaConstructorFull from "../FormulaConstructorFull.svelte";
import FormulaEditor from "src/ui/components/FormulaEditor/FormulaEditor.svelte";
import { getAllFormulaMetadata, getFormulaMetadata, findEnclosingCall } from "src/lib/dashboard-engine/formulaMetadata";
import { evaluateVersionedFormula } from "src/lib/formula/version";
import { MAX_FORMULA_INPUT_LENGTH } from "src/lib/formula/limits";

describe("profile-aware shared formula editor", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("uses executable catalogs for each profile without changing the default", () => {
    expect(getAllFormulaMetadata()).toHaveLength(112);
    expect(getAllFormulaMetadata("legacy-filter")).toHaveLength(27);
    expect(getAllFormulaMetadata("unified-v1")).toHaveLength(129);
    expect(getFormulaMetadata("SUM", "legacy-filter")).toBeUndefined();
    expect(getFormulaMetadata("IS_OVERDUE", "unified-v1")?.name).toBe("IS_OVERDUE");
  });
  it("revalidates the same text when the profile changes and cancels pending old validation", async () => {
    const view = render(FormulaConstructor, { props: { value: "SUM", fields: ["SUM"] } });
    const events: { errors: string[]; pending: boolean; value: string }[] = [];
    view.component.$on("validation", event => events.push(event.detail));
    jest.advanceTimersByTime(700);
    await tick();
    expect(events.at(-1)?.errors.length).toBeGreaterThan(0);
    view.component.$set({ semantics: "unified-v1" });
    await tick();
    expect(events.at(-1)?.pending).toBe(true);
    jest.advanceTimersByTime(700);
    await tick();
    expect(events.at(-1)).toEqual({ errors: [], pending: false, value: "SUM" });
    view.component.$set({ semantics: "legacy-computed" });
    await tick();
    jest.advanceTimersByTime(300);
    view.component.$set({ semantics: "unified-v1" });
    await tick();
    jest.advanceTimersByTime(700);
    await tick();
    expect(events.at(-1)).toEqual({ errors: [], pending: false, value: "SUM" });
  });
  it("forwards the supplied accessible name through FormulaEditor", () => {
    const view = render(FormulaEditor, { props: { ariaLabel: "Revenue formula" } });
    expect(view.container.querySelector("textarea")?.getAttribute("aria-label")).toBe("Revenue formula");
  });
  it("keeps oversized pasted source intact without a token-sized DOM tree", () => {
    const source = "1+".repeat(MAX_FORMULA_INPUT_LENGTH) + "1";
    const view = render(FormulaConstructor, { props: { value: source, highlight: true } });
    expect(view.container.querySelector("textarea")?.value).toBe(source);
    const underlay = view.container.querySelector(".ppp-fc-highlight")!;
    expect(underlay.textContent).toBe(source);
    expect(underlay.childElementCount).toBe(1);
    expect(findEnclosingCall(source, source.length, "unified-v1")).toBeNull();
  });
  it.each([
    ["SUM", "SU", "SUM", 7],
    ["Total cost", "Tot", 'PROP("Total cost")', 9],
  ])("inserts the actual property %s rather than a colliding function or invalid identifier", async (name, prefix, source, expected) => {
    const fieldName = name as string;
    const view = render(FormulaConstructor, { props: { semantics: "unified-v1", fields: [fieldName] } });
    const textarea = view.container.querySelector("textarea")!;
    textarea.value = prefix as string; textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    await fireEvent.input(textarea); await fireEvent.keyUp(textarea);
    const property = Array.from(document.querySelectorAll<HTMLButtonElement>(".ppp-fc-suggestion"))
      .find(button => button.textContent?.trim() === fieldName);
    expect(property).toBeDefined();
    await fireEvent.click(property!); await tick();
    expect(textarea.value).toBe(source);
    expect(evaluateVersionedFormula(textarea.value, "unified-v1", { record: { id: "r", values: { [fieldName]: expected as number } } }).value).toBe(expected);
  });
  it.each([
    ["SUM # (comment\n (amount,", "SUM"],
    ['IF(true, SUM(") #", amount), MAX # (\n (', "MAX"],
    ['SUM("unfinished', "SUM"],
    ["SUM(1) # MAX(\n", null],
  ])("finds strict incremental calls in %s", (source, expected) => {
    expect(findEnclosingCall(source!, source!.length, "unified-v1")).toBe(expected);
  });
  it("defers parent text while a foreign-window textarea is focused and while focus stays inside its editor", async () => {
    const mainDocument = document;
    const iframe = mainDocument.createElement("iframe"); mainDocument.body.appendChild(iframe);
    const foreignDocument = iframe.contentDocument!;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document")!;
    let component: FormulaEditor | undefined;
    try {
      Object.defineProperty(globalThis, "document", { configurable: true, value: foreignDocument });
      const ForeignEditor = require("src/ui/components/FormulaEditor/FormulaEditor.svelte").default;
      component = new ForeignEditor({ target: foreignDocument.body, props: { expression: "1", fields: [], validate: () => [] } });
      Object.defineProperty(globalThis, "document", descriptor);
      const textarea = foreignDocument.querySelector("textarea")!;
      const root = foreignDocument.querySelector(".formula-editor")!;
      const inside = foreignDocument.createElement("button"); root.appendChild(inside);
      const outside = foreignDocument.createElement("button"); foreignDocument.body.appendChild(outside);
      expect(Object.getPrototypeOf(textarea)).not.toBe(HTMLTextAreaElement.prototype);
      textarea.focus();
      component!.$set({ expression: "2" }); await tick();
      expect(textarea.value).toBe("1");
      inside.focus(); await tick();
      expect(textarea.value).toBe("1");
      outside.focus(); await tick();
      expect(textarea.value).toBe("2");
    } finally {
      Object.defineProperty(globalThis, "document", descriptor);
      component?.$destroy(); iframe.remove();
    }
  });
  it("inserts help at the native selection without declaration placeholders", async () => {
    const view = render(FormulaConstructorFull, { props: { value: "1 + old + 2", semantics: "unified-v1" } });
    const textarea = view.container.querySelector("textarea")!;
    textarea.focus();
    textarea.setSelectionRange(4, 7);
    await fireEvent.click(view.container.querySelector(".ppp-fcf-btn")!);
    const sum = Array.from(view.container.querySelectorAll<HTMLButtonElement>(".ppp-fhp-code--btn"))
      .find(button => button.textContent?.startsWith("SUM("));
    expect(sum).toBeDefined();
    await fireEvent.click(sum!);
    await tick();
    expect(textarea.value).toBe("1 + SUM( + 2");
    expect(textarea.selectionStart).toBe(8);
    expect(textarea.ownerDocument.activeElement).toBe(textarea);
  });
  it("column completion searches fields without letting matching functions consume its limit", async () => {
    const view = render(FormulaConstructor, { props: { semantics: "unified-v1", fields: ["Status"] } });
    const textarea = view.container.querySelector("textarea")!;
    textarea.value = "@S"; textarea.setSelectionRange(2, 2);
    await fireEvent.input(textarea); await fireEvent.keyUp(textarea);
    const suggestions = Array.from(document.querySelectorAll<HTMLButtonElement>(".ppp-fc-suggestion"));
    expect(suggestions.map(button => button.textContent?.trim())).toEqual(["Status"]);
    await fireEvent.click(suggestions[0]!); await tick();
    expect(textarea.value).toBe("@Status");
  });
});
