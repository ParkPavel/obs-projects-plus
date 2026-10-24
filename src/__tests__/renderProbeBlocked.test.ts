/**
 * w4-p00 (audit F02, F26) — a probe that cannot run says BLOCKED and keeps
 * what it saw.
 *
 * Before: a missing browser turned five acceptance suites into `describe.skip`,
 * and a browser that crashed threw away its stderr, so a red run on a machine
 * that could not start processes looked exactly like a product regression.
 */

import * as fs from "fs";
import * as path from "path";
import { ProbeBlockedError, renderProbe } from "./support/renderProbe";

const SPEC = {
  css: [],
  html: "<div id='x'></div>",
  measure: [{ id: "x", props: ["display"] }],
};

describe("w4-p00 — a probe that cannot run is BLOCKED, never a pass", () => {
  it("no browser at all is BLOCKED, not an empty result", () => {
    expect(() => renderProbe(SPEC, { chrome: null })).toThrow(/^BLOCKED: no Chrome found/);
  });

  it("a browser process that fails keeps its exit code, stderr and page", () => {
    // Node as the "browser": it rejects Chrome's first flag with exit 9 and a
    // message on stderr — a real process failing for real, no mocks.
    let caught: unknown = null;
    try {
      renderProbe(SPEC, { chrome: process.execPath });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ProbeBlockedError);
    const err = caught as ProbeBlockedError;
    expect(err.message).toMatch(/^BLOCKED: the browser did not run \(exit 9/);
    expect(err.artifacts).not.toBeNull();
    const dir = err.artifacts ?? "";
    try {
      expect(fs.readFileSync(path.join(dir, "probe.html"), "utf8")).toContain("<div id='x'></div>");
      expect(fs.readFileSync(path.join(dir, "stderr.txt"), "utf8")).toMatch(/--headless/);
      expect(fs.readFileSync(path.join(dir, "launch.txt"), "utf8")).toContain("exit 9");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
