import { compileSafeRegex } from "../regexSafety";
import { isSafePattern } from "redos-detector";
import { regexAdmission } from "../regexAdmission";
jest.mock("redos-detector", () => ({ isSafePattern: jest.fn() }));
const check = isSafePattern as jest.Mock;
const approved = () => ({ safe: true, error: null, score: { infinite: false, value: 1 } });
beforeEach(() => { check.mockReset(); check.mockImplementation(approved); });
afterEach(() => jest.restoreAllMocks());

test.each(["timedOut", "hitMaxSteps"])("an inconclusive %s never admits a native execution", error => {
  check.mockReturnValue({ safe: false, error, score: { infinite: false, value: 1 } });
  expect(compileSafeRegex(`^(cat|dog)+${error}$`)).toMatchObject({ ok: false, issue: "unverified" });
});
test("an analyser failure returns a distinct unverified error", () => {
  check.mockImplementation(() => { throw new Error("Unsupported syntax"); });
  expect(compileSafeRegex("^(cat|dog)+exception$")).toMatchObject({ ok: false, issue: "unverified" });
});
test("a timed-out partial score is not reported as a proven unsafe pattern", () => {
  check.mockReturnValue({ safe: false, error: "timedOut", score: { infinite: true } });
  expect(compileSafeRegex("^(cat|dog)+partial$")).toMatchObject({ ok: false, issue: "unverified" });
});
test("a transient inconclusive analysis is cached briefly and can be retried after its deadline", () => {
  const clock = jest.spyOn(performance, "now").mockReturnValue(0);
  check.mockReturnValue({ safe: false, error: "timedOut", score: { infinite: false, value: 1 } });
  expect(compileSafeRegex("^(cat|dog)+retry$")).toMatchObject({ ok: false, issue: "unverified" });
  check.mockImplementation(approved); clock.mockReturnValue(5000);
  expect(compileSafeRegex("^(cat|dog)+retry$").ok).toBe(false); expect(check).toHaveBeenCalledTimes(1);
  clock.mockReturnValue(15_001);
  expect(compileSafeRegex("^(cat|dog)+retry$").ok).toBe(true); expect(check).toHaveBeenCalledTimes(2);
});
test("a finite but excessive or infinite backtracking score is rejected", () => {
  check.mockReturnValue({ safe: false, error: "hitMaxScore", score: { infinite: true } });
  expect(compileSafeRegex("^(cat|dog)+score$")).toMatchObject({ ok: false, issue: "unsafe" });
});
test("the analyser receives finite work/time bounds and the actual execution flags", () => {
  expect(compileSafeRegex("^(cat|dog)+flags$", "ims").ok).toBe(true);
  const options = check.mock.calls[0]?.[1];
  expect(options).toMatchObject({ caseInsensitive: true, dotAll: true, multiLine: true, downgradePattern: true });
  expect(Number.isFinite(options.timeout)).toBe(true); expect(options.timeout).toBeLessThanOrEqual(100);
  expect(Number.isFinite(options.maxSteps)).toBe(true); expect(options.maxSteps).toBeLessThan(100_000);
});
test("only immutable admission facts are cached; global RegExp state remains local to each call", () => {
  const first = compileSafeRegex("^[a-z]+cache$", "g"); if (!first.ok) throw new Error("Expected supported pattern");
  first.regex.lastIndex = 7;
  const second = compileSafeRegex("^[a-z]+cache$", "g"); if (!second.ok) throw new Error("Expected supported pattern");
  expect(check).toHaveBeenCalledTimes(1); expect(second.regex).not.toBe(first.regex); expect(second.regex.lastIndex).toBe(0);
  compileSafeRegex("^[a-z]+cache$", "i"); expect(check).toHaveBeenCalledTimes(2);
});
test("the structural guard is also run once per cached pattern, not once per record", () => {
  const guard = jest.fn(() => false);
  expect(regexAdmission("^structural-cache$", "", guard)).toBeNull();
  expect(regexAdmission("^structural-cache$", "", guard)).toBeNull(); expect(guard).toHaveBeenCalledTimes(1);
});
test("the bounded admission cache evicts older patterns instead of growing with every record", () => {
  compileSafeRegex("^[a-z]+oldest$");
  for (let index = 0; index < 300; index++) compileSafeRegex(`^[a-z]+item${index}$`);
  const before = check.mock.calls.length; compileSafeRegex("^[a-z]+oldest$");
  expect(check.mock.calls.length).toBe(before + 1);
});
