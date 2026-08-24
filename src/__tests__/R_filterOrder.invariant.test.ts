import { readFileSync } from "fs";
import { resolve } from "path";

const ADR_PATH = resolve(__dirname, "..", "..", "docs", "internal", "FILTER_ORDER_ADR.md");

function readAdr(): string {
  return readFileSync(ADR_PATH, "utf8");
}

describe("#116 filter-order ADR invariant", () => {
  it("pins the target order and its implementation boundary", () => {
    const adr = readAdr().replace(/\s+/g, " ");

    expect(adr).toContain("Status: Accepted — target architecture");
    expect(adr).toContain("enrich → A (scope) → C (advanced transform) → B (reactive selection) → sort → render");
    expect(adr).toContain("`view.filter`, filter-tabs, `block.subFilter`, per-tab filter");
    expect(adr).toContain("`executeTransform` / advanced transform");
    expect(adr).toContain("`composeEffectiveFilter` → `filterByLinkedSelection`");
    expect(adr).toContain("target architecture; it does not describe the current runtime wiring");
    expect(adr).toContain("does not prove that existing runtime wiring implements this order");
    expect(adr).toContain("#117 owns routing filter-tabs through the canonical filter engine");
    expect(adr).toContain("#118 owns splitting and migrating the transform pipeline into the target");
  });
});
