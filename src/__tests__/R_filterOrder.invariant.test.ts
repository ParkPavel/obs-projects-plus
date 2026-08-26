/**
 * #116 / #128 — the canonical filter order, pinned where it can actually regress.
 *
 * The first version of this file asserted substrings in the ADR and nothing
 * else. That was defensible while the order was still aspirational, but once
 * #118 implemented it the assertions became a cage: the ADR could not be
 * corrected to describe reality without turning this file red. A test that
 * forbids a document from becoming true is worse than no test.
 *
 * So it now pins two different things:
 *   - the ADR still STATES the order (it is a contract, and contracts are text);
 *   - the code still WIRES it (which is the part that silently regresses).
 *
 * The behavioral proof that A-before-C changes results lives in
 * widgets/__tests__/widgetScope.test.ts, which composes the real functions.
 * This file deliberately does not duplicate it.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const DOCS = resolve(__dirname, "..", "..", "docs", "internal");
const SRC = resolve(__dirname, "..");

const read = (path: string) => readFileSync(path, "utf8");
const flat = (text: string) => text.replace(/\s+/g, " ");

describe("#116 filter-order ADR — the stated contract", () => {
  const adr = flat(read(resolve(DOCS, "FILTER_ORDER_ADR.md")));

  it("states the canonical order", () => {
    expect(adr).toContain(
      "enrich → A (scope) → C (advanced transform) → B (reactive selection) → sort → render"
    );
  });

  it("names the surfaces that make up each axis", () => {
    expect(adr).toContain("`view.filter`, filter-tabs, `block.subFilter`, per-tab filter");
    expect(adr).toContain("`executeTransform` / advanced transform");
    expect(adr).toContain("`composeEffectiveFilter` → `filterByLinkedSelection`");
  });

  it("describes the order as implemented, not as aspirational", () => {
    // The pre-#118 wording claimed the ADR "does not describe the current
    // runtime wiring". Keeping that assertion alive after the wiring landed is
    // what made this test protect a false statement.
    expect(adr).toContain("Implementation status");
    expect(adr).not.toContain("it does not describe the current runtime wiring");
    expect(adr).not.toContain("does not prove that existing runtime wiring implements this order");
  });

  it("does not describe closed tickets as still owning future work", () => {
    expect(adr).not.toMatch(/#11[78] owns/);
  });
});

describe("#128 filter-order — the wiring the ADR describes", () => {
  const host = read(resolve(SRC, "ui/views/Dashboard/widgets/WidgetHost.svelte"));

  it("scopes the frame before the transform, not after", () => {
    const scopeAt = host.indexOf("applyWidgetScope(enrichedFrame");
    const transformAt = host.indexOf("executeTransform(");

    expect(scopeAt).toBeGreaterThan(-1);
    expect(transformAt).toBeGreaterThan(-1);
    expect(scopeAt).toBeLessThan(transformAt);
  });

  it("feeds the transform the scoped frame — reverting to enrichedFrame is the regression", () => {
    // This is the single line whose change would silently undo #118.
    expect(host).toMatch(/executeTransform\(\s*scope\.frame\s*,/);
    expect(host).not.toMatch(/executeTransform\(\s*enrichedFrame\s*,/);
  });

  it("tells the block whether axis A already ran, so it is not applied twice", () => {
    expect(host).toContain("dbCallScopeApplied");
    expect(host).toMatch(/dbCallScopeApplied:\s*!dbCallUsesLinkedSource\s*&&\s*scope\.applied/);
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
