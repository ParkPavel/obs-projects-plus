/**
 * Codex gate of calc-demo (P1): the view filter cleanup kept only conditions
 * on the raw frame's fields. A declared rollup is a column without a key in
 * any note (afa3cf6), so a filter such as «visitCount above 1» was deleted — and the
 * unfiltered view persisted — on every load.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { conditionFieldsKnown } from "../viewHelpers";

test("a condition on a declared rollup is kept, one on a vanished field is dropped", () => {
  const known = conditionFieldsKnown(["name", "date"], { visitCount: { rollup: { relationField: "", targetField: "price", function: "count_total" } } } as never);
  expect(known.has("visitCount")).toBe(true);
  expect(known.has("name")).toBe(true);
  expect(known.has("gone")).toBe(false);
});

test("the view's cleanup uses it", () => {
  const view = readFileSync(resolve(__dirname, "..", "View.svelte"), "utf8");
  expect(view).toMatch(/conditionFieldsKnown\(\s*frame\.fields\.map\(\(field\) => field\.name\),\s*project\.fieldConfig/);
});
