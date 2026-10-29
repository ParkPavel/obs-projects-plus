import type { ComputeStep, TransformPipeline } from "src/lib/dashboard-engine/transformTypes";
const PipelineEditor = require("../PipelineEditor.svelte").default;

describe("PipelineEditor preserves saved formula rules", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

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

      const expression = target.querySelector(".ppp-compute-expr") as HTMLInputElement;
      expression.focus();
      expression.value = "3 + 4";
      expression.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
      expression.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await Promise.resolve();
      jest.advanceTimersByTime(400);
      expect((applied.at(-1)!.steps[0] as ComputeStep).columns[0]).toEqual({ ...column, name: "renamed", expression: "3 + 4" });
      expect(column).toEqual({ name: "answer", expression: "1 + 1", ...(version === undefined ? {} : { formulaVersion: version }) });
    } finally {
      component.$destroy();
      target.remove();
    }
  });
});
