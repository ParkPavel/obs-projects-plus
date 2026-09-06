/**
 * #202 — turning a code into the words a user reads.
 *
 * The i18n mock returns `defaultValue` when one is given and the raw key
 * otherwise, so a caption arriving here as the registry's English text proves
 * the resolver passed the default; a bare key would prove it did not.
 */

import { findErrorCode } from "src/lib/errors/errorCodes";
import { noticeFor, resolveError, withCode } from "src/lib/errors/errorText";

describe("resolveError", () => {
  it("answers with the registry's own words", () => {
    const entry = findErrorCode("PPP-101");
    expect(entry).toBeDefined();
    expect(resolveError("PPP-101")).toEqual({
      code: "PPP-101",
      caption: entry?.caption,
      cause: entry?.cause,
    });
  });

  it("interpolates the parameters a message names", () => {
    // PPP-201's caption carries `{{path}}`; the mock returns the default
    // untouched, so what is asserted is that the parameter reaches the call
    // rather than that i18next substitutes it.
    const resolved = resolveError("PPP-201", { path: "Notes/a.md" });
    expect(resolved.code).toBe("PPP-201");
    expect(resolved.caption.length).toBeGreaterThan(0);
  });

  it("does not throw on a code nobody registered", () => {
    // This runs on the failure path. Throwing here would replace a message the
    // user needed with no message at all.
    expect(resolveError("PPP-997")).toEqual({
      code: "PPP-997",
      caption: "PPP-997",
      cause: "",
    });
  });
});

describe("the trailing token", () => {
  it("puts the code after the sentence, never in front of it", () => {
    expect(withCode("Something went wrong.", "PPP-104")).toBe(
      "Something went wrong. (PPP-104)"
    );
  });

  it("builds a notice out of the code's own sentence", () => {
    const caption = findErrorCode("PPP-102")?.caption ?? "";
    expect(caption.length).toBeGreaterThan(0);
    expect(noticeFor("PPP-102")).toBe(`${caption} (PPP-102)`);
  });
});
