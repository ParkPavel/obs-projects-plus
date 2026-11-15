import { createSettingsWriter, type SettingsWriter } from "../settingsWriter";
import { saveCheckedSettings } from "../settingsCheckedSave";
import { canonical } from "../settingsVerify";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(finish => { resolve = finish; });
  return { promise, resolve };
}
type Value = { n: number };
const writers: SettingsWriter<Value>[] = [];
afterEach(() => { for (const writer of writers.splice(0)) writer.dispose(); jest.restoreAllMocks(); jest.useRealTimers(); });

test("flush waits for candidate publication, not merely its host write", async () => {
  const base = { n: 0 }, candidate = { n: 1 }, entered = deferred<void>(), verified = deferred<void>();
  let memory = base, disk = base;
  const writer = createSettingsWriter<Value>({ save: async value => { disk = value; }, verify: async () => { entered.resolve(); await verified.promise; return "confirmed"; } });
  writers.push(writer); writer.prime(base);
  const published: Value[] = [];
  const commit = writer.commitCandidate(base, candidate, () => memory === base, value => { memory = value; published.push(value); writer.push(value); });
  await entered.promise;
  let flushed = false; const flush = writer.flush().then(() => { flushed = true; });
  await Promise.resolve(); expect(flushed).toBe(false); expect(memory).toBe(base); expect(disk).toBe(candidate);
  verified.resolve();
  await expect(commit).resolves.toBe("confirmed"); await flush;
  expect(published).toEqual([candidate]); expect(memory).toBe(candidate); expect(writer.hasPending()).toBe(false);
});

test("flush carries a newer edit queued during candidate verification, preserving memory", async () => {
  const base = { n: 0 }, candidate = { n: 1 }, newer = { n: 2 }, entered = deferred<void>(), verified = deferred<void>();
  let memory = base, disk = base;
  const writes: Value[] = [], published: Value[] = [];
  const writer = createSettingsWriter<Value>({ save: async value => { disk = value; writes.push(value); }, verify: async value => {
    if (value === candidate) { entered.resolve(); await verified.promise; } return "confirmed";
  } });
  writers.push(writer); writer.prime(base);
  const commit = writer.commitCandidate(base, candidate, () => memory === base, value => { memory = value; published.push(value); writer.push(value); });
  await entered.promise; memory = newer; writer.push(newer);
  const flush = writer.flush(); verified.resolve();
  await expect(commit).resolves.toBe("stale"); await flush;
  expect(memory).toBe(newer); expect(disk).toBe(newer); expect(published).toEqual([]);
  expect(writes).toEqual([candidate, newer]); expect(writer.hasPending()).toBe(false);
});

test("a real queued checked save rejects a local edit before its callback without publishing the candidate", async () => {
  const base = { n: 0 }, candidate = { n: 1 }, newer = { n: 2 }, entered = deferred<void>(), proceed = deferred<void>();
  let memory = base, raw = JSON.stringify(base), confirmed = canonical(base);
  const adapter = { exists: async () => true, append: async () => {}, process: async (_path: string, update: (raw: string) => string) => {
    entered.resolve(); await proceed.promise; raw = update(raw); return raw;
  } };
  const save = jest.fn(async (value: Value, guard?: () => boolean) => saveCheckedSettings(adapter, "data.json", { canonical: confirmed, raw: null }, value, guard));
  const publish = jest.fn();
  const writer = createSettingsWriter<Value>({ save, verify: async value => { confirmed = canonical(JSON.parse(raw)); return confirmed === canonical(value) ? "confirmed" : "not-written"; } });
  writers.push(writer); writer.prime(base);
  const commit = writer.commitCandidate(base, candidate, () => memory === base, publish);
  await entered.promise; memory = newer; writer.push(newer); proceed.resolve();
  await expect(commit).resolves.toBe("stale");
  expect(JSON.parse(raw)).toEqual(base); expect(publish).not.toHaveBeenCalled();
  await writer.flush();
  expect(JSON.parse(raw)).toEqual(newer); expect(memory).toBe(newer); expect(save).toHaveBeenCalledTimes(2);
});

test("dispose prevents publication even when a candidate was written before unload", async () => {
  const base = { n: 0 }, candidate = { n: 1 }, entered = deferred<void>(), verified = deferred<void>();
  const publish = jest.fn();
  const writer = createSettingsWriter<Value>({ save: async () => {}, verify: async () => { entered.resolve(); await verified.promise; return "confirmed"; } });
  writers.push(writer); writer.prime(base);
  const commit = writer.commitCandidate(base, candidate, () => true, publish);
  await entered.promise; const flush = writer.flush(); writer.dispose(); verified.resolve();
  await expect(commit).resolves.toBe("closed"); await flush;
  expect(publish).not.toHaveBeenCalled();
});

test.each(["save", "not-written", "publish"] as const)("a %s failure never queues an automatic candidate retry", async failure => {
  jest.useFakeTimers(); jest.spyOn(console, "error").mockImplementation(() => {});
  const base = { n: 0 }, candidate = { n: 1 };
  const save = jest.fn(async () => { if (failure === "save") throw Error("write failed"); });
  const publish = jest.fn(() => { if (failure === "publish") throw Error("publication failed"); });
  const writer = createSettingsWriter<Value>({ save, verify: async () => failure === "not-written" ? "not-written" : "confirmed" });
  writers.push(writer); writer.prime(base);
  await expect(writer.commitCandidate(base, candidate, () => true, publish)).resolves.toBe("failed");
  writer.retry(); await jest.advanceTimersByTimeAsync(60000);
  expect(save).toHaveBeenCalledTimes(1);
  expect(publish).toHaveBeenCalledTimes(failure === "publish" ? 1 : 0);
});

test("external reconciliation waits until the confirmed candidate is published", async () => {
  const base = { n: 0 }, candidate = { n: 1 }, entered = deferred<void>(), verified = deferred<void>();
  let memory = base, externalStarted = false;
  const writer = createSettingsWriter<Value>({ save: async () => {}, verify: async () => { entered.resolve(); await verified.promise; return "confirmed"; } });
  writers.push(writer); writer.prime(base);
  const commit = writer.commitCandidate(base, candidate, () => true, value => { memory = value; writer.push(value); });
  await entered.promise;
  const external = writer.withExclusive("external", async () => { externalStarted = true; expect(memory).toBe(candidate); return { kind: "release" }; });
  await Promise.resolve(); expect(externalStarted).toBe(false);
  verified.resolve(); await expect(commit).resolves.toBe("confirmed"); await external;
  expect(externalStarted).toBe(true);
});

test("a reentrant user edit during publication survives the adoption epoch guard", async () => {
  const base = { n: 0 }, candidate = { n: 1 }, newer = { n: 2 }; let memory = base, disk = base;
  const writer = createSettingsWriter<Value>({ save: async value => { disk = value; }, verify: async () => "confirmed" });
  writers.push(writer); writer.prime(base);
  const result = await writer.commitCandidate(base, candidate, () => true, value => { memory = value; writer.push(value); memory = newer; writer.push(newer); });
  expect(result).toBe("stale"); expect(memory).toBe(newer);
  await writer.flush(); expect(disk).toBe(newer);
});

test.each([false, true])("immediate flush includes a called candidate, including a queued episode (queued=%s)", async queued => {
  const base = { n: 0 }, candidate = { n: 1 }, entered = deferred<void>(), written = deferred<void>(), previousEntered = deferred<void>(), previousDone = deferred<void>();
  let memory = base;
  const writer = createSettingsWriter<Value>({ save: async () => { entered.resolve(); await written.promise; }, verify: async () => "confirmed" });
  writers.push(writer); writer.prime(base);
  const previous = queued ? writer.withExclusive("previous", async () => { previousEntered.resolve(); await previousDone.promise; return { kind: "release" }; }) : Promise.resolve();
  if (queued) await previousEntered.promise;
  const commit = writer.commitCandidate(base, candidate, () => true, value => { memory = value; writer.push(value); });
  let flushed = false; const flush = writer.flush().then(() => { flushed = true; });
  if (queued) { await Promise.resolve(); await Promise.resolve(); expect(flushed).toBe(false); previousDone.resolve(); }
  await entered.promise; await Promise.resolve(); await Promise.resolve();
  expect(flushed).toBe(false); expect(memory).toBe(base);
  written.resolve(); await expect(commit).resolves.toBe("confirmed"); await previous; await flush;
  expect(memory).toBe(candidate); expect(flushed).toBe(true);
});

test("a reentrant forced write is preserved during candidate publication", async () => {
  const base = { n: 0 }, candidate = { n: 1 }, newer = { n: 2 }; let memory = base, disk = base;
  const writer = createSettingsWriter<Value>({ save: async value => { disk = value; }, verify: async () => "confirmed" });
  writers.push(writer); writer.prime(base);
  const result = await writer.commitCandidate(base, candidate, () => true, value => { memory = value; memory = newer; writer.pushNow(newer); });
  expect(result).toBe("stale"); await writer.flush();
  expect(memory).toBe(newer); expect(disk).toBe(newer); expect(writer.hasPending()).toBe(false);
});

test.each(["pushNow", "prime"] as const)("a queued microtask %s cannot be lost between publication and final adoption", async action => {
  const base = { n: 0 }, candidate = { n: 1 }, newer = { n: 2 }; let memory = base, disk = base;
  const writer = createSettingsWriter<Value>({ save: async value => { disk = value; }, verify: async () => "confirmed" });
  writers.push(writer); writer.prime(base);
  const result = await writer.commitCandidate(base, candidate, () => true, value => {
    memory = value;
    void Promise.resolve().then(() => { memory = newer; if (action === "prime") { disk = newer; writer.prime(newer); } else writer.pushNow(newer); });
  });
  expect(result).toBe("stale"); await writer.flush();
  expect(memory).toBe(newer); expect(disk).toBe(newer); expect(writer.hasPending()).toBe(false);
});
