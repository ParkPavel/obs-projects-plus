// FormulaBar IntelliSense signature picker — pure logic coverage.
// The full keyboard navigation code paths (ArrowUp/Down, Enter, Tab, Escape)
// in FormulaBar.svelte are exercised through integration/manual QA; the
// enclosing-call lookup below backs the live signature popover and is the
// only non-trivial pure unit to unit-test.
import { findEnclosingCall } from "src/lib/dashboard-engine/formulaMetadata";

describe("findEnclosingCall", () => {
  it("returns null when cursor is not inside any call", () => {
    expect(findEnclosingCall("", 0)).toBeNull();
    expect(findEnclosingCall("Budget + 1", 4)).toBeNull();
    expect(findEnclosingCall("SUM(1)", 6)).toBeNull(); // cursor after closing paren
  });

  it("detects simple enclosing call", () => {
    const src = "SUM(Budget, ";
    expect(findEnclosingCall(src, src.length)).toBe("SUM");
  });

  it("detects the innermost call when nested", () => {
    const src = "IF(AND(a, b, ";
    expect(findEnclosingCall(src, src.length)).toBe("AND");
  });

  it("skips already-closed inner calls", () => {
    const src = "IF(AND(a, b), ";
    expect(findEnclosingCall(src, src.length)).toBe("IF");
  });

  it("handles cursor inside opening paren", () => {
    const src = "ROUND(";
    expect(findEnclosingCall(src, src.length)).toBe("ROUND");
  });

  it("returns null when `(` has no preceding identifier", () => {
    expect(findEnclosingCall("(1 + 2, ", 8)).toBeNull();
  });

  it("clamps cursor beyond input length", () => {
    const src = "SUM(1, 2";
    expect(findEnclosingCall(src, 9999)).toBe("SUM");
  });

  it("ignores parentheses inside string literals", () => {
    const src = 'CONCAT("(", ';
    expect(findEnclosingCall(src, src.length)).toBe("CONCAT");
  });

  it("ignores parentheses inside single-quoted strings", () => {
    const src = "JOIN('(a)', ";
    expect(findEnclosingCall(src, src.length)).toBe("JOIN");
  });

  it("respects backslash escapes in string literals", () => {
    const src = 'FORMAT("a\\") + ", ';
    // The escaped `"` keeps the string open through `)`. Effective enclosing call remains FORMAT.
    expect(findEnclosingCall(src, src.length)).toBe("FORMAT");
  });
});
