/**
 * Codex review of the lint branch: valueText replaced String() for values
 * shown as text, and JSON.stringify throws where String() never did — on a
 * cycle or a BigInt inside an object. Export and front matter decoding go
 * through it, so it must always return text.
 */
import { valueText } from "src/lib/valueText";

describe("valueText", () => {
  test("primitives, dates and lists read as String() gives them", () => {
    expect(valueText("a")).toBe("a");
    expect(valueText(12)).toBe("12");
    expect(valueText(true)).toBe("true");
    expect(valueText(null)).toBe("null");
    expect(valueText([1, "b"])).toBe("1,b");
    const d = new Date(2026, 0, 2);
    expect(valueText(d)).toBe(String(d));
  });

  test("a plain object reads as its content", () => {
    expect(valueText({ a: 1 })).toBe('{"a":1}');
  });

  test("an object JSON cannot write still reads as text", () => {
    const cyclic: Record<string, unknown> = { name: "test" };
    cyclic["self"] = cyclic;
    expect(valueText(cyclic)).toBe("[object Object]");
    expect(valueText({ n: BigInt(1) })).toBe("[object Object]");
  });
});
