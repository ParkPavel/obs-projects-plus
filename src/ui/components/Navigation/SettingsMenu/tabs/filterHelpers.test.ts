import { describe, it, expect } from "@jest/globals";
import { getOperatorLabel, OPERATOR_LABELS } from "./filterHelpers";

describe("getOperatorLabel (#108)", () => {
  // The test i18n mock returns options.defaultValue || key, so the resolved
  // value is the OPERATOR_LABELS fallback passed as defaultValue.
  it("resolves text operators via i18n with the Russian fallback as default", () => {
    expect(getOperatorLabel("is")).toBe(OPERATOR_LABELS["is"]);
    expect(getOperatorLabel("contains")).toBe(OPERATOR_LABELS["contains"]);
  });

  it("resolves symbol operators to their language-neutral glyph", () => {
    expect(getOperatorLabel("eq")).toBe("=");
    expect(getOperatorLabel("neq")).toBe("≠");
  });
});
