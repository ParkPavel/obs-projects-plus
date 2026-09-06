import { sanitizeNoteName } from "src/ui/app/onboarding/noteName";

/**
 * #198 — found by a user's console, not by a test: the demo project reported
 * that one of its notes could not be written, because its name contained a
 * colon and Obsidian refuses those in filenames.
 */

describe("#198 — demo note names the host accepts", () => {
  it("fixes the name that actually failed", () => {
    expect(sanitizeNoteName("Overdue: budget review — Storefront Nimbus")).toBe(
      "Overdue – budget review — Storefront Nimbus"
    );
  });

  it("replaces every character Obsidian names in its error", () => {
    for (const bad of ["*", '"', "\\", "/", "<", ">", ":", "|", "?"]) {
      const cleaned = sanitizeNoteName(`before${bad}after`);
      expect(cleaned).not.toContain(bad);
      expect(cleaned).toContain("before");
      expect(cleaned).toContain("after");
    }
  });

  it("does not mangle a name that was already fine", () => {
    const fine = "Brand review — Orbit Media";
    expect(sanitizeNoteName(fine)).toBe(fine);
  });

  it("drops trailing dots and spaces, which Windows drops silently", () => {
    // Left in place, a lookup would miss the file that exists and the
    // idempotent re-run would create a second copy.
    expect(sanitizeNoteName("Retrospective. ")).toBe("Retrospective");
    expect(sanitizeNoteName("Plan   ")).toBe("Plan");
  });

  it("does not leave doubled spacing where a character was replaced", () => {
    expect(sanitizeNoteName("Q3 : review")).toBe("Q3 – review");
    expect(sanitizeNoteName("A / B test")).toBe("A – B test");
  });
});
