import fs from "fs";
import path from "path";
import ts from "typescript";
import vm from "vm";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { executeTransformCached, invalidateTransformCache } from "../transformCache";
import { executeTransform } from "../transformExecutor";
import { createTransformBudget } from "../transformBudget";

const frame = { fields: [{ name: "amount", type: DataFieldType.Number, repeated: false, derived: false, identifier: false }],
  records: Array.from({ length: 10 }, (_, id) => ({ id: `${id}`, values: { amount: id } })) };
const step = (name: string) => ({ type: "compute" as const, columns: [{ name, expression: "amount + 1" }] });
afterEach(() => invalidateTransformCache());
test("a cached result cannot bypass an already aborted caller", () => {
  const pipeline = { steps: [step("computed")] }; executeTransformCached(frame, pipeline);
  const controller = new AbortController(); controller.abort();
  const result = executeTransformCached(frame, pipeline, { signal: controller.signal });
  expect(result.meta.stepsExecuted).toBe(0); expect(result.meta.warnings.join(" ")).toMatch(/cancel/i);
});
test("a limited execution never poisons a subsequent ordinary cache lookup", () => {
  const pipeline = { steps: [step("computed")] };
  const limited = executeTransformCached(frame, pipeline, { workLimit: 10 });
  expect(limited.meta.stepsExecuted).toBe(0);
  const normal = executeTransformCached(frame, pipeline);
  expect(normal.meta.stepsExecuted).toBe(1); expect(normal.data.records[0]?.values["computed"]).toBe(1);
});
test("sharing a budget cannot disable the current caller's stricter work or cancellation controls", () => {
  const pipeline = { steps: [step("computed")] }, budget = createTransformBudget(undefined, performance.now());
  expect(executeTransform(frame, pipeline, { budget, workLimit: 10 }).meta.stepsExecuted).toBe(0);
  const controller = new AbortController(); controller.abort();
  const result = executeTransform(frame, pipeline, { budget, signal: controller.signal });
  expect(result.meta.stepsExecuted).toBe(0); expect(result.meta.stopped).toBe("cancelled");
});
test("checking the end of a step also observes its enclosing pass deadline", () => {
  const budget = createTransformBudget(undefined, performance.now() - 2100);
  const child = createTransformBudget({ budget }, performance.now());
  expect(() => child.check()).toThrow(/deadline/i); expect(child.stopped).toBe("deadline");
});
test("the actual PipelineEditor preview shares a budget across its step counter loop", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../../ui/views/Dashboard/widgets/PipelineEditor.svelte"), "utf8");
  const script = source.slice(source.indexOf(">") + 1, source.indexOf("</script>"));
  const ast = ts.createSourceFile("preview.ts", script, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "countSteps");
  if (!node) throw new Error("Missing production countSteps");
  const compiled = ts.transpileModule(node.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const env = { executeTransform, createTransformBudget: () => createTransformBudget({ workLimit: 55 }, performance.now()), performance,
    frame, steps: [step("first"), step("second")], right: new Map(), previewStopped: undefined };
  const counts = vm.runInNewContext(`${compiled}; countSteps(frame, steps, right);`, env, { timeout: 1000 });
  expect(counts).toHaveLength(1); expect(env.previewStopped).toBe("work-limit");
});
