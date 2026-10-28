/**
 * i3-props — a write asked for while another runs is queued, not dropped.
 */
import { createWriteQueue } from "../writeQueue";

describe("i3-props createWriteQueue", () => {
  it("runs every task, one at a time, in the order asked", async () => {
    const log: string[] = [];
    let release: () => void = () => undefined;
    const q = createWriteQueue();
    const first = q.run(
      () =>
        new Promise<void>((resolve) => {
          log.push("first:start");
          release = () => {
            log.push("first:end");
            resolve();
          };
        }),
    );
    const second = q.run(async () => {
      log.push("second");
    });
    await Promise.resolve();
    expect(q.pending()).toBe(2);
    expect(log).toEqual(["first:start"]);
    release();
    await Promise.all([first, second]);
    expect(log).toEqual(["first:start", "first:end", "second"]);
    expect(q.pending()).toBe(0);
  });

  it("keeps going after a failed task and reports busy around the batch", async () => {
    const busy: boolean[] = [];
    const q = createWriteQueue((b) => busy.push(b));
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const ran: number[] = [];
    void q.run(async () => {
      throw new Error("boom");
    });
    await q.run(async () => {
      ran.push(2);
    });
    expect(ran).toEqual([2]);
    expect(busy).toEqual([true, false]);
    spy.mockRestore();
  });

  it("reports a failed write to the UI and distinguishes it from a saved write", async () => {
    const failed = jest.fn();
    const q = createWriteQueue(undefined, failed);
    const error = new Error("disk full");
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const first = q.run(async () => { throw error; });
    const second = q.run(async () => undefined);
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(true);
    expect(failed).toHaveBeenCalledWith(error);
    expect(q.pending()).toBe(0);
    spy.mockRestore();
  });

  it("does not report a writer's explicit refusal as success", async () => {
    const failed = jest.fn();
    const q = createWriteQueue(undefined, failed);
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(q.run(async () => false)).resolves.toBe(false);
    expect(failed).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
