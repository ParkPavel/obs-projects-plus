/**
 * w4-p12 (audit F13) — the start-up report reads host and plugin time apart.
 */
import { createStartupReport } from "../startupReport";

describe("startup report", () => {
  it("states the time before the plugin, each stage's own time and the plugin's total", () => {
    const clock = [800, 845, 860, 990];
    const report = createStartupReport(() => clock.shift()!);
    report.mark("onload start");
    report.mark("settings loaded");
    report.mark("onload end");
    report.mark("layout ready");
    expect(report.text()).toBe(
      [
        "Projects Plus start-up",
        "before the plugin (Obsidian): 800 ms",
        "settings loaded: 45 ms, at 845 ms",
        "onload end: 15 ms, at 860 ms",
        "layout ready: 130 ms, at 990 ms",
        "plugin, first to last stage: 190 ms",
      ].join("\n")
    );
  });

  it("a stage marked again keeps its first time", () => {
    let t = 0;
    const report = createStartupReport(() => (t += 10));
    report.mark("view opened");
    report.mark("view opened");
    expect(report.stages()).toEqual([{ name: "view opened", at: 10 }]);
  });

  it("before any mark it says so", () => {
    expect(createStartupReport(() => 0).text()).toMatch(/nothing measured/);
  });
});
