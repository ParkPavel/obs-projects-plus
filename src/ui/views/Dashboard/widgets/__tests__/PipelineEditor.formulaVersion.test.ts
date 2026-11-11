import type { ComputeStep, TransformPipeline } from "src/lib/dashboard-engine/transformTypes";
const PipelineEditor = require("../PipelineEditor.svelte").default;

describe("PipelineEditor preserves saved formula rules", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("Apply saves the visible draft, marked with the one rule set", async () => {
    const target = document.createElement("div"); document.body.appendChild(target);
    const applied: TransformPipeline[] = [];
    const component = new PipelineEditor({ target, props: { pipeline: { steps: [{ type: "compute", columns: [{ name: "Answer", expression: "1 + 1" }] }] }, fields: [], availableSources: [] } });
    component.$on("apply", (event: CustomEvent<TransformPipeline>) => applied.push(event.detail));
    try {
      (target.querySelector(".ppp-step-summary") as HTMLElement).click(); await Promise.resolve();
      expect(target.querySelector(".ppp-formula-mode")).toBeNull();
      const textarea = target.querySelector("textarea")!;
      textarea.focus(); textarea.value = "3 + 4";
      textarea.dispatchEvent(new Event("input", { bubbles: true })); await Promise.resolve();
      jest.advanceTimersByTime(700); await Promise.resolve();
      expect(textarea.value).toBe("3 + 4");
      target.querySelector<HTMLButtonElement>(".ppp-versioned-formula-editor > button")!.click(); await Promise.resolve();
      jest.advanceTimersByTime(400);
      expect((applied.at(-1)!.steps[0] as ComputeStep).columns[0]).toEqual({ name: "Answer", expression: "3 + 4", formulaVersion: "unified-v1" });
    } finally { component.$destroy(); target.remove(); }
  });

  it.each([undefined, "unified-v1", "future-v9"])("preserves version %p on rename and expression commit", async version => {
    const column = Object.freeze({ name: "answer", expression: "1 + 1", ...(version === undefined ? {} : { formulaVersion: version }) });
    const pipeline: TransformPipeline = Object.freeze({ steps: Object.freeze([{ type: "compute" as const, columns: Object.freeze([column]) }]) });
    const target = document.createElement("div");
    document.body.appendChild(target);
    const applied: TransformPipeline[] = [];
    const component = new PipelineEditor({ target, props: { pipeline, fields: [], availableSources: [] } });
    component.$on("apply", (event: CustomEvent<TransformPipeline>) => applied.push(event.detail));
    try {
      (target.querySelector(".ppp-step-summary") as HTMLElement).click();
      await Promise.resolve();
      const name = target.querySelector(".ppp-compute-name") as HTMLInputElement;
      name.value = "renamed";
      name.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      jest.advanceTimersByTime(400);
      expect((applied.at(-1)!.steps[0] as ComputeStep).columns[0]).toEqual({ ...column, name: "renamed" });

      const expression = target.querySelector(".ppp-compute-expr textarea") as HTMLTextAreaElement;
      if (version === "future-v9") {
        expect(expression.readOnly).toBe(true);
        expect(expression.value).toBe("1 + 1");
        return;
      }
      expression.focus();
      expression.value = "3 + 4";
      expression.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
      expression.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
      await Promise.resolve();
      jest.advanceTimersByTime(400);
      expect((applied.at(-1)!.steps[0] as ComputeStep).columns[0]).toEqual({
        ...column, name: "renamed", expression: "3 + 4", ...(version === undefined ? { formulaVersion: "unified-v1" } : {}),
      });
      expect(column).toEqual({ name: "answer", expression: "1 + 1", ...(version === undefined ? {} : { formulaVersion: version }) });
    } finally {
      component.$destroy();
      target.remove();
    }
  });
});
