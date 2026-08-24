import { updateStep, toggleDisableStep, addFilterCondition } from "../pipelineSteps";
import type {
  TransformStep,
  TransformPipeline,
  FilterStep,
  GroupByStep,
} from "src/lib/dashboard-engine/transformTypes";
import type { FilterCondition } from "src/settings/base/settings";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataField } from "src/lib/dataframe/dataframe";

const PipelineEditor = require("../PipelineEditor.svelte").default;

// #105 — PipelineEditor crashed in `updateStep` doing `steps[index] = step` on
// an immer-frozen array (TypeError: Cannot assign to read only property). These
// reducers must stay pure: never write into the (possibly frozen) input.

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function makeFrozenSteps(): TransformStep[] {
  const groupStep: GroupByStep = { type: "group-by", fields: ["status"] };
  const filterStep: FilterStep = {
    type: "filter",
    conditions: { conjunction: "and", conditions: [] },
  };
  return deepFreeze([groupStep, filterStep] as TransformStep[]);
}

describe("pipelineSteps reducers on frozen input (#105)", () => {
  // Proves the fixture is genuinely frozen so the reducer tests are meaningful.
  // Forced strict context: an index-write to a frozen array throws only in
  // strict mode (Svelte components compile to strict ES modules, like the real
  // crash site); under the Jest transform the test module itself is sloppy.
  function strictIndexWrite(arr: TransformStep[]): void {
    "use strict";
    arr[0] = { type: "group-by", fields: ["x"] };
  }

  it("sanity: the fixture really is frozen (direct index-write throws)", () => {
    const frozen = makeFrozenSteps();
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(() => strictIndexWrite(frozen)).toThrow(TypeError);
  });

  it("disable-toggle does not throw, returns a new array, replaces only the toggled step", () => {
    const frozen = makeFrozenSteps();
    let next!: TransformStep[];
    expect(() => {
      next = toggleDisableStep(frozen, 0);
    }).not.toThrow();
    expect(next).not.toBe(frozen);
    expect(next[0]).not.toBe(frozen[0]);
    expect(next[0]!.disabled).toBe(true);
    expect(next[1]).toBe(frozen[1]);
  });

  it("group-by change replaces the step immutably", () => {
    const frozen = makeFrozenSteps();
    const replacement: GroupByStep = { type: "group-by", fields: ["client"] };
    let next!: TransformStep[];
    expect(() => {
      next = updateStep(frozen, 0, replacement);
    }).not.toThrow();
    expect(next).not.toBe(frozen);
    expect(next[0]).toBe(replacement);
    expect(next[1]).toBe(frozen[1]);
  });

  it("add-condition appends to the filter step without mutating frozen subarrays", () => {
    const frozen = makeFrozenSteps();
    const cond: FilterCondition = {
      field: "status",
      operator: "is-empty",
      value: "",
      enabled: true,
    };
    let next!: TransformStep[];
    expect(() => {
      next = addFilterCondition(frozen, 1, cond);
    }).not.toThrow();
    expect(next).not.toBe(frozen);
    expect(next[1]).not.toBe(frozen[1]);
    expect(next[0]).toBe(frozen[0]);
    const filter = next[1] as FilterStep;
    expect(filter.conditions.conditions).toHaveLength(1);
    expect(filter.conditions.conditions[0]).toBe(cond);
    // original frozen filter step is untouched
    expect((frozen[1] as FilterStep).conditions.conditions).toHaveLength(0);
  });
});

// #121 — after removing the duplicate unnest quick-toggle from
// DatabaseCallSettings, this "Array fields detected" banner is the one and
// only entry point for database-call unnest, so it needs its own coverage.
describe("PipelineEditor — #121 unnest banner", () => {
  function field(name: string): DataField {
    return { name, type: DataFieldType.Unknown, repeated: false, identifier: false, derived: false };
  }

  const fields = [field("title"), field("exercises"), field("tags")];

  function source() {
    return {
      fields,
      records: [
        { id: "r1", values: { title: "Mon", exercises: [{ name: "Bench" }], tags: ["a", "b"] } },
      ],
    };
  }

  function mount(pipeline: TransformPipeline) {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const applied: TransformPipeline[] = [];
    const component = new PipelineEditor({
      target,
      props: { pipeline, fields, source: source(), availableSources: [] },
    });
    component.$on("apply", (e: CustomEvent<TransformPipeline>) => applied.push(e.detail));
    const bannerButtons = () =>
      Array.from(target.querySelectorAll(".ppp-pipeline-unnest-hint-btn")) as HTMLButtonElement[];
    return {
      component,
      applied,
      bannerButtons,
      destroy() {
        component.$destroy();
        target.remove();
      },
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders one button per detected array field when no unnest step exists", () => {
    const m = mount({ steps: [] });
    const labels = m.bannerButtons().map((b) => b.textContent?.trim());
    expect(labels.some((t) => t?.includes("exercises"))).toBe(true);
    expect(labels.some((t) => t?.includes("tags"))).toBe(true);
    expect(m.bannerButtons()).toHaveLength(2);
    m.destroy();
  });

  test("excludes fields already targeted by an existing unnest step", () => {
    const m = mount({ steps: [{ type: "unnest", field: "tags" }] });
    const labels = m.bannerButtons().map((b) => b.textContent?.trim());
    expect(labels.some((t) => t?.includes("exercises"))).toBe(true);
    expect(labels.some((t) => t?.includes("tags"))).toBe(false);
    expect(m.bannerButtons()).toHaveLength(1);
    m.destroy();
  });

  test("clicking a banner button prepends an unnest step and applies after the debounce", async () => {
    const m = mount({ steps: [{ type: "filter", conditions: { conjunction: "and", conditions: [] } }] });
    const btn = m.bannerButtons().find((b) => b.textContent?.includes("exercises"));
    expect(btn).toBeDefined();

    btn!.click();
    // Svelte flushes the `steps` update (and starts the debounce timer) on a
    // microtask, which fake timers don't advance — let it settle first.
    await Promise.resolve();
    // Not yet applied — still within the 400ms debounce window.
    jest.advanceTimersByTime(399);
    expect(m.applied).toHaveLength(0);

    jest.advanceTimersByTime(1);
    expect(m.applied).toHaveLength(1);
    const steps = m.applied[0]!.steps;
    expect(steps[0]).toEqual({ type: "unnest", field: "exercises" });
    expect(steps.some((s) => s.type === "filter")).toBe(true);
    m.destroy();
  });

  test("a field already unnested does not reappear in the banner after clicking another field", async () => {
    const m = mount({ steps: [{ type: "unnest", field: "tags" }] });
    expect(m.bannerButtons().some((b) => b.textContent?.includes("tags"))).toBe(false);
    const btn = m.bannerButtons().find((b) => b.textContent?.includes("exercises"));
    btn!.click();
    await Promise.resolve();
    jest.advanceTimersByTime(400);
    await Promise.resolve();
    expect(m.bannerButtons().some((b) => b.textContent?.includes("exercises"))).toBe(false);
    expect(m.bannerButtons().some((b) => b.textContent?.includes("tags"))).toBe(false);
    m.destroy();
  });
});
