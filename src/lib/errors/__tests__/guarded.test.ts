import { guarded } from "../guarded";

it("D13: a failing step returns the frame it had instead of breaking the view", () => {
  jest.useFakeTimers(); // window.setTimeout
  const err = jest.spyOn(console, "error").mockImplementation(() => {});
  const frame = { fields: [], records: [] };
  expect(guarded("enrich", frame, () => { throw new Error("rollup without relation"); })).toBe(frame);
  expect(guarded<unknown>("enrich", frame, () => "ok")).toBe("ok");
  expect(() => jest.runAllTimers()).toThrow("rollup without relation");
  err.mockRestore();
  jest.useRealTimers();
});
