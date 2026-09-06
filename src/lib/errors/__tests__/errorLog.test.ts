/**
 * #202 — the console half of a code.
 *
 * The tree ships five different log prefixes today, so nothing in a console can
 * be searched for. These assertions are about the shape of the line, which is
 * the part a user copies into an issue.
 */

import { findErrorCode } from "src/lib/errors/errorCodes";
import { errorLine, logError, logWarning } from "src/lib/errors/errorLog";

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
