/**
 * #202 — the console half of a code.
 *
 * The tree ships five different log prefixes today, so nothing in a console can
 * be searched for. These assertions are about the shape of the line, which is
 * the part a user copies into an issue.
 */

import { findErrorCode } from "src/lib/errors/errorCodes";
import {
  errorLine,
  logError,
  logErrorAbout,
  logWarning,
  logWarningAbout,
} from "src/lib/errors/errorLog";

describe("errorLine", () => {
  it("leads with one prefix and the code", () => {
    expect(errorLine("PPP-104")).toMatch(/^\[Projects\+\] PPP-104 \S/);
  });

  it("says the product name once, even when the caption also carries it", () => {
    // `save-status.failed.notice` was written before a shared prefix existed
    // and starts "Projects+: ", which read correctly in a Notice and would read
    // twice here.
    const line = errorLine("PPP-101");
    expect(line.match(/Projects\+/g)).toHaveLength(1);
    expect(line).not.toContain("Projects+: settings could not");
    expect(line).toContain("settings could not be written to disk");
  });

  it("carries the caption verbatim for a code that has no inline prefix", () => {
    const caption = findErrorCode("PPP-301")?.caption ?? "";
    expect(caption.length).toBeGreaterThan(0);
    expect(errorLine("PPP-301")).toBe(`[Projects+] PPP-301 ${caption}`);
  });

  it("degrades to the bare code rather than throwing", () => {
    expect(errorLine("PPP-997")).toBe("[Projects+] PPP-997 PPP-997");
  });
});

describe("logError / logWarning", () => {
  it("writes one line and keeps the details after it", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const boom = new Error("EACCES");
      logError("PPP-101", "attempt 2", boom);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(errorLine("PPP-101"), "attempt 2", boom);
    } finally {
      spy.mockRestore();
    }
  });

  it("uses the warning channel for a code that is a warning", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(findErrorCode("PPP-102")?.kind).toBe("warning");
      logWarning("PPP-102", "not retrying");
      expect(spy).toHaveBeenCalledWith(errorLine("PPP-102"), "not retrying");
    } finally {
      spy.mockRestore();
    }
  });
});

/**
 * #207 — the console line is what a user quotes, so it must not quote a
 * template.
 *
 * The registry stores captions with `{{placeholders}}` because the Notice fills
 * them through i18n. This module cannot use i18n — the line stays English so it
 * can be pasted into an issue and read by anyone — and it printed the caption
 * verbatim, so a user reporting a conflict sent `{{path}}` while the notice
 * beside it named the real file.
 */
describe("#207 — placeholders in the console line", () => {
  it("fills a placeholder from the params it is given", () => {
    const line = errorLine("PPP-105", { path: "vault/data.conflict-x.json" });

    expect(line).toContain("vault/data.conflict-x.json");
    expect(line).not.toContain("{{");
  });

  it("says the value is unknown rather than showing the template", () => {
    // A caller with nothing to fill it with does not know the value; `<path>`
    // says that, while `{{path}}` says the code is unfinished.
    const line = errorLine("PPP-105");

    expect(line).toContain("<path>");
    expect(line).not.toContain("{{");
  });

  it("leaves a caption with no placeholders alone", () => {
    expect(errorLine("PPP-103")).toContain("defaults are in use");
  });

  it("keeps the prefix and the code, which are what make it greppable", () => {
    expect(errorLine("PPP-105", { path: "x" })).toMatch(
      /^\[Projects\+\] PPP-105 /
    );
  });

  it("the two `About` helpers write at the levels their names promise", () => {
    const errors: unknown[][] = [];
    const warnings: unknown[][] = [];
    const error = jest.spyOn(console, "error").mockImplementation((...a) => {
      errors.push(a);
    });
    const warn = jest.spyOn(console, "warn").mockImplementation((...a) => {
      warnings.push(a);
    });

    try {
      logErrorAbout("PPP-105", { path: "p" }, "detail");
      logWarningAbout("PPP-105", { path: "p" }, "detail");

      expect(String(errors[0]?.[0])).toContain("p");
      expect(String(warnings[0]?.[0])).toContain("p");
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
  });
});
