/**
 * The canonical filter order, pinned where it can actually regress.
 *
 * The order is: enrich → A (scope) → C (advanced transform) → B (reactive
 * selection) → sort → render.
 *
 * An earlier version of this file also asserted substrings in an internal ADR
 * document. That document is no longer part of this tree, and pinning a test to
 * prose was the weaker half anyway: text cannot silently regress, wiring can.
 * So this file pins the wiring only. The order itself is stated for readers in
 * `docs/architecture.md`, and the behavioral proof that A-before-C changes
 * results lives in `widgets/__tests__/widgetScope.test.ts` and
 * `widgets/__tests__/hostFrames.test.ts`, which compose the real functions.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const SRC = resolve(__dirname, "..");

const read = (path: string) => readFileSync(path, "utf8");

describe("filter-order — the wiring", () => {
  const host = read(resolve(SRC, "ui/views/Dashboard/widgets/WidgetHost.svelte"));
  // The assembly of the render context lives in `renderContext.ts` — the host
  // was one line from its LOC ceiling and the context's shape belongs beside its
  // type. The invariant did not move: axis A is still measured in the host and
  // still declared to the block. Reading both here is what keeps this test
  // pinned to the wiring rather than to a filename.
  const context = read(resolve(SRC, "ui/views/Dashboard/widgets/renderContext.ts"));
  // The frame math itself lives in `hostFrames.ts`, for the same reason and with
  // the same consequence: the wiring is read where it now lives. These two
  // assertions stay as the cheap guard against the single-line regression they
  // were written for.
  const frames = read(resolve(SRC, "ui/views/Dashboard/widgets/hostFrames.ts"));

  it("scopes the frame before the transform, not after", () => {
    const scopeAt = frames.indexOf("applyWidgetScope(enrichedFrame");
    const transformAt = frames.indexOf("executeTransform(");

    expect(scopeAt).toBeGreaterThan(-1);
    expect(transformAt).toBeGreaterThan(-1);
    expect(scopeAt).toBeLessThan(transformAt);
  });

  it("feeds the transform the scoped frame — reverting to enrichedFrame is the regression", () => {
    // This is the single line whose change would silently undo the order.
    expect(frames).toMatch(/executeTransform\(\s*scope\.frame\s*,/);
    expect(frames).not.toMatch(/executeTransform\(\s*enrichedFrame\s*,/);
  });

  it("the host still wires it, so the move did not orphan the math", () => {
    // Cheap, and it closes the hole the move opens: hostFrames could be perfect
    // and unused. The host must actually call it.
    expect(host).toMatch(/computeHostFrames\(\{/);
  });

  it("tells the block whether axis A already ran, so it is not applied twice", () => {
    // The host declares it to the context…
    expect(host).toMatch(/scopeApplied:\s*scope\.applied/);
    // …and the context declares it. The composition is the invariant, not the
    // identifier or its address — scope counts only for a non-external block,
    // and that conjunction is the thing that must never be dropped.
    expect(context).toContain("dbCallScopeApplied");
    expect(context).toMatch(
      /dbCallScopeApplied:\s*!dbCall\.isExternal\s*&&\s*(?:input\.)?scopeApplied/
    );
  });

  it("keeps the selection (axis B) downstream of the transform in the block", () => {
    const block = read(
      resolve(SRC, "ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte")
    );
    const subFilteredAt = block.indexOf("$: subFiltered");
    const selectionAt = block.indexOf("filterByLinkedSelection(subFiltered.records");

    expect(subFilteredAt).toBeGreaterThan(-1);
    expect(selectionAt).toBeGreaterThan(subFilteredAt);
  });
});
