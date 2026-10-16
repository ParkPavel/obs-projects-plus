import { createChangeBatcher } from "../changeBatcher";

it("C3: 193 changes in a burst are handed over once, one entry per path", () => {
  const timers: (() => void)[] = [];
  const flushes: string[][] = [];
  const b = createChangeBatcher<string>((items) => { flushes.push(items); }, 50, (fn) => timers.push(fn));
  for (let i = 0; i < 193; i++) b.push(`n${i}.md`, `n${i}.md`);
  b.push("n0.md", "n0.md");
  expect(timers).toHaveLength(1);
  timers[0]!();
  expect(flushes).toHaveLength(1);
  expect(flushes[0]).toHaveLength(193);
  b.push("x.md", "x.md");
  expect(timers).toHaveLength(2);
});
