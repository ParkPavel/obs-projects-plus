import { buildStatsSparkline } from "../statsSparkline";

it("keeps the numeric rule, small-series shape and finite extreme coordinates", () => {
  expect(buildStatsSparkline(["12abc", null, false])).toBe("");
  expect(buildStatsSparkline([0, "12abc", "10"])).toBe("M 0.0 24.0 L 80.0 0.0");
  expect(buildStatsSparkline([-1e308, 1e308])).toBe("M 0.0 24.0 L 80.0 0.0");
  expect(buildStatsSparkline([5, 5])).toBe("M 0.0 24.0 L 80.0 24.0");
});

it("bounds large previews while preserving endpoints and a narrow interior peak", () => {
  const values = Array(200000).fill(0); values[12345] = 100;
  const path = buildStatsSparkline(values);
  expect(path.match(/[ML]/g)!.length).toBeLessThanOrEqual(200);
  expect(path).toMatch(/^M 0\.0 24\.0/); expect(path).toMatch(/L 80\.0 24\.0$/);
  expect(path).toMatch(/L [\d.]+ 0\.0/);
});
