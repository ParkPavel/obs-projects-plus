import {
  createSettingsWriter,
  SETTINGS_WRITE_REFUSED,
  type SettingsWriter,
  type WriteVerdict,
} from "src/lib/settings/settingsWriter";

/**
 * The candidate commit contract: a private snapshot reaches the disk
 * before it is published, and a newer session edit is never overwritten.
 *
 * The writer is driven through its public API with injected save/verify, the
 * same way `settingsWriter.test.ts` does. Every test asserts intent — order,
 * refusal, staleness, unload — rather than the writer's internals.
 */

type Value = { readonly n: number };

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
  reject(reason?: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

type SaveMode = "ok" | "fail" | "refuse" | "manual" | "deferred-guard";

interface SaveCall {
  readonly value: Value;
  readonly guard: (() => boolean) | undefined;
}

function makeSave(events?: string[]) {
  const save = {
    calls: [] as SaveCall[],
    pending: [] as Array<{ resolve: (result?: unknown) => void; reject: (reason?: unknown) => void }>,
    mode: "ok" as SaveMode,
    fn: (value: Value, guard?: () => boolean): Promise<unknown> => {
      events?.push("save");
      save.calls.push({ value, guard });
      if (save.mode === "ok") return Promise.resolve();
      if (save.mode === "fail") return Promise.reject(new Error("EACCES"));
      if (save.mode === "refuse") return Promise.resolve(SETTINGS_WRITE_REFUSED);
      if (save.mode === "deferred-guard") {
        return new Promise<unknown>((resolve, reject) => {
          save.pending.push({
            resolve: () => resolve(guard && !guard() ? SETTINGS_WRITE_REFUSED : undefined),
            reject,
          });
        });
      }
      return new Promise<unknown>((resolve, reject) => {
        save.pending.push({ resolve, reject });
      });
    },
  };
  return save;
}

function makeVerify(verdict: WriteVerdict | "throw", events?: string[]) {
  const calls: Value[] = [];
  return {
    calls,
    fn: (value: Value): Promise<WriteVerdict> => {
      events?.push("verify");
      calls.push(value);
      if (verdict === "throw") return Promise.reject(new Error("read-back failed"));
      return Promise.resolve(verdict);
    },
  };
}

function deferredVerify(events?: string[]) {
  const calls: Value[] = [];
  const gate = deferred<WriteVerdict>();
  return {
    calls,
    promise: gate.promise,
    resolve: gate.resolve,
    fn: (value: Value): Promise<WriteVerdict> => {
      events?.push("verify");
      calls.push(value);
      return gate.promise;
    },
  };
}

describe("candidate commit", () => {
  let active: SettingsWriter<Value> | undefined;
  const track = (writer: SettingsWriter<Value>): SettingsWriter<Value> => {
    active = writer;
    return writer;
  };

  const expected: Value = { n: 1 };
  const candidate: Value = { n: 2 };
  const newer: Value = { n: 3 };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    active?.dispose();
    active = undefined;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const flush = () => jest.advanceTimersByTimeAsync(0);

  it("persists, verifies and publishes in that order without an echo write", async () => {
    const events: string[] = [];
    const save = makeSave(events);
    const verify = deferredVerify(events);
    const writer = track(createSettingsWriter<Value>({
      save: save.fn,
      verify: verify.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    }));
    writer.prime(expected);

    const published: Value[] = [];
    const committing = writer.commitCandidate(expected, candidate, () => true, value => {
      events.push("publish");
      published.push(value);
      writer.push(value);
    });

    await flush();
    expect(events).toEqual(["save", "verify"]);
    expect(save.calls.map(call => call.value)).toEqual([candidate]);
    expect(typeof save.calls[0]!.guard).toBe("function");
    expect(published).toEqual([]);

    verify.resolve("confirmed");
    await expect(committing).resolves.toBe("confirmed");
    expect(events).toEqual(["save", "verify", "publish"]);
    expect(published).toEqual([candidate]);

    await jest.advanceTimersByTimeAsync(60_000);
    expect(events).toEqual(["save", "verify", "publish"]);
  });

  it("refuses the candidate when the host cannot verify", async () => {
    const save = makeSave();
    const writer = track(createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    }));
    writer.prime(expected);

    const published: Value[] = [];
    await expect(
      writer.commitCandidate(expected, candidate, () => true, value => published.push(value))
    ).resolves.toBe("refused");
    expect(save.calls).toEqual([]);
    expect(published).toEqual([]);
  });

  it("reports stale for a pending user edit and leaves that edit queued", async () => {
    const save = makeSave();
    const verify = makeVerify("confirmed");
    const writer = track(createSettingsWriter<Value>({
      save: save.fn,
      verify: verify.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    }));
    writer.prime(expected);
    writer.push(newer);

    const published: Value[] = [];
    await expect(
      writer.commitCandidate(expected, candidate, () => true, value => published.push(value))
    ).resolves.toBe("stale");
    expect(save.calls).toEqual([]);
    expect(published).toEqual([]);

    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls.map(call => call.value)).toEqual([newer]);
  });

  it("does not save a candidate when a local push lands during beforeWrite", async () => {
    const before = deferred<boolean>();
    const save = makeSave();
    const verify = makeVerify("confirmed");
    const writer = track(createSettingsWriter<Value>({
      save: save.fn,
      verify: verify.fn,
      beforeWrite: () => before.promise,
      debounceMs: 400,
      maxWaitMs: 2000,
    }));
    writer.prime(expected);

    const published: Value[] = [];
    const committing = writer.commitCandidate(expected, candidate, () => true, value => published.push(value));
    await flush();
    writer.push(newer);
    before.resolve(true);

    await expect(committing).resolves.toBe("stale");
    expect(save.calls).toEqual([]);
    expect(published).toEqual([]);
    expect(writer.hasPending()).toBe(true);
  });

  it("rejects the candidate when the guard fails inside the deferred save", async () => {
    const save = makeSave();
    save.mode = "deferred-guard";
    const verify = makeVerify("confirmed");
    const writer = track(createSettingsWriter<Value>({
      save: save.fn,
      verify: verify.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    }));
    writer.prime(expected);

    const published: Value[] = [];
    const committing = writer.commitCandidate(expected, candidate, () => true, value => published.push(value));
    await flush();
    expect(save.calls.map(call => call.value)).toEqual([candidate]);

    writer.push(newer);
    save.pending[0]!.resolve();

    await expect(committing).resolves.toBe("stale");
    expect(verify.calls).toEqual([]);
    expect(published).toEqual([]);
    expect(writer.hasPending()).toBe(true);

    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls.map(call => call.value)).toEqual([candidate, newer]);
  });

  it("never retries a rejected candidate, even after every delay", async () => {
    const save = makeSave();
    save.mode = "refuse";
    const verify = makeVerify("confirmed");
    const writer = track(createSettingsWriter<Value>({
      save: save.fn,
      verify: verify.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
      retryDelaysMs: [500, 2000],
    }));
    writer.prime(expected);

    const published: Value[] = [];
    await expect(
      writer.commitCandidate(expected, candidate, () => true, value => published.push(value))
    ).resolves.toBe("refused");

    writer.retry();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(save.calls.map(call => call.value)).toEqual([candidate]);
    expect(verify.calls).toEqual([]);
    expect(published).toEqual([]);
  });

  it("does not publish when the plugin unloads while the candidate write is in flight", async () => {
    const save = makeSave();
    save.mode = "manual";
    const verify = makeVerify("confirmed");
    const writer = track(createSettingsWriter<Value>({
      save: save.fn,
      verify: verify.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    }));
    writer.prime(expected);

    const published: Value[] = [];
    const committing = writer.commitCandidate(expected, candidate, () => true, value => published.push(value));
    await flush();
    expect(save.calls.map(call => call.value)).toEqual([candidate]);

    writer.dispose();
    save.pending[0]!.resolve();

    await expect(committing).resolves.toBe("closed");
    expect(published).toEqual([]);
  });

  it("holds an ordinary edit behind a long commit and refuses the stale candidate", async () => {
    const save = makeSave();
    save.mode = "manual";
    const verify = makeVerify("confirmed");
    const writer = track(createSettingsWriter<Value>({
      save: save.fn,
      verify: verify.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    }));
    writer.prime(expected);

    const published: Value[] = [];
    const committing = writer.commitCandidate(expected, candidate, () => true, value => published.push(value));
    await flush();
    expect(save.calls.map(call => call.value)).toEqual([candidate]);

    writer.push(newer);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(save.calls.map(call => call.value)).toEqual([candidate]);

    save.pending[0]!.resolve();
    await expect(committing).resolves.toBe("stale");
    expect(published).toEqual([]);

    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls.map(call => call.value)).toEqual([candidate, newer]);
  });

  it("does not publish when verification diverges or throws", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    for (const verdict of ["diverged", "throw"] as const) {
      const save = makeSave();
      const verify = makeVerify(verdict);
      const writer = track(createSettingsWriter<Value>({
        save: save.fn,
        verify: verify.fn,
        debounceMs: 400,
        maxWaitMs: 2000,
      }));
      writer.prime(expected);

      const published: Value[] = [];
      const result = await writer.commitCandidate(
        expected,
        candidate,
        () => true,
        value => published.push(value)
      );

      expect(result).toBe(verdict === "throw" ? "failed" : "refused");
      expect(published).toEqual([]);
      expect(save.calls.map(call => call.value)).toEqual([candidate]);
      writer.dispose();
    }
    active = undefined;
  });

  it("does not overwrite a newer edit that arrives during verification", async () => {
    const save = makeSave();
    const verify = deferredVerify();
    const writer = track(createSettingsWriter<Value>({
      save: save.fn,
      verify: verify.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    }));
    writer.prime(expected);

    const published: Value[] = [];
    const committing = writer.commitCandidate(expected, candidate, () => true, value => published.push(value));
    await flush();
    expect(save.calls.map(call => call.value)).toEqual([candidate]);

    writer.push(newer);
    verify.resolve("confirmed");

    await expect(committing).resolves.toBe("stale");
    expect(published).toEqual([]);

    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls.map(call => call.value)).toEqual([candidate, newer]);
  });
});
