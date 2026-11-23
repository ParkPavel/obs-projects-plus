import { PACKAGE_LIMITS } from "../packagePolicy";
import { preparePackageShare } from "../packageShare";

type SharePort = Pick<Navigator, "canShare" | "share">;

const archive = (byte = 7): Uint8Array => new Uint8Array([1, 2, 3, byte]);
const fileBytes = (file: File): Promise<number[]> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve([...new Uint8Array(reader.result as ArrayBuffer)]);
  reader.onerror = () => reject(reader.error ?? new Error("file read failed"));
  reader.readAsArrayBuffer(file);
});

const recordingPort = (options: {
  canShare?: boolean | (() => boolean);
  share?: (data?: ShareData) => Promise<void>;
  throwCanShare?: boolean;
  throwShare?: Error;
} = {}) => {
  const state = { canShare: 0, share: 0, files: [] as File[], receiver: undefined as unknown, shareReceiver: undefined as unknown };
  const port = {
    canShare(this: unknown, data?: ShareData): boolean {
      state.canShare++;
      state.receiver = this;
      if (options.throwCanShare) throw new Error("canShare failed");
      state.files.push(...(data?.files ?? []));
      return typeof options.canShare === "function" ? options.canShare() : options.canShare !== false;
    },
    share(this: unknown, data?: ShareData): Promise<void> {
      state.share++;
      state.shareReceiver = this;
      state.files.push(...(data?.files ?? []));
      if (options.throwShare !== undefined) throw options.throwShare;
      return options.share ? options.share(data) : Promise.resolve();
    },
  };
  return { port, state };
};

test("shares the private copy synchronously from the click call", async () => {
  const source = archive(9);
  const { port, state } = recordingPort();
  const prepared = preparePackageShare(source, "package.zip", port);
  source.fill(0);
  expect(prepared.name).toBe("package.zip");
  expect(Object.isFrozen(prepared)).toBe(true);
  expect(state.share).toBe(0);
  const pending = prepared.share();
  expect(state.share).toBe(1);
  expect(state.shareReceiver).toBe(port);
  expect(state.receiver).toBe(port);
  const shared = state.files[state.files.length - 1]!;
  expect(shared.name).toBe("package.zip");
  expect(shared.type).toBe("application/zip");
  expect(await fileBytes(shared)).toEqual([1, 2, 3, 9]);
  expect(await pending).toBe("shared");
});

test("reports unavailable without claiming a share", async () => {
  const bytes = archive();
  const denied = recordingPort({ canShare: false });
  const deniedShare = preparePackageShare(bytes, "p.zip", denied.port);
  expect(deniedShare.available()).toBe(false);
  expect(await deniedShare.share()).toBe("unavailable");
  expect(denied.state.share).toBe(0);

  const throwing = recordingPort({ throwCanShare: true });
  const throwingShare = preparePackageShare(bytes, "p.zip", throwing.port);
  expect(throwingShare.available()).toBe(false);
  expect(await throwingShare.share()).toBe("unavailable");
  expect(throwing.state.share).toBe(0);

  const missing = preparePackageShare(bytes, "p.zip", {} as SharePort);
  expect(missing.available()).toBe(false);
  expect(await missing.share()).toBe("unavailable");
});

test("maps AbortError from async and sync paths to cancelled", async () => {
  const bytes = archive();
  const asyncAbort = recordingPort({ share: () => Promise.reject(new DOMException("cancel", "AbortError")) });
  expect(await preparePackageShare(bytes, "p.zip", asyncAbort.port).share()).toBe("cancelled");
  const syncAbort = recordingPort({ throwShare: new DOMException("cancel", "AbortError") });
  expect(await preparePackageShare(bytes, "p.zip", syncAbort.port).share()).toBe("cancelled");
});

test("maps other failures to failed", async () => {
  const bytes = archive();
  const asyncFail = recordingPort({ share: () => Promise.reject(new Error("boom")) });
  expect(await preparePackageShare(bytes, "p.zip", asyncFail.port).share()).toBe("failed");
  const syncFail = recordingPort({ throwShare: new Error("boom") });
  expect(await preparePackageShare(bytes, "p.zip", syncFail.port).share()).toBe("failed");
});

test("keeps the retained file stable across repeated shares", async () => {
  const source = archive(5);
  const { port, state } = recordingPort();
  const prepared = preparePackageShare(source, "p.zip", port);
  source.fill(0);
  expect(await prepared.share()).toBe("shared");
  expect(await prepared.share()).toBe("shared");
  expect(state.share).toBe(2);
  const [first, second] = state.files.slice(-2);
  expect(await fileBytes(first!)).toEqual([1, 2, 3, 5]);
  expect(await fileBytes(second!)).toEqual([1, 2, 3, 5]);
});

test("rejects invalid data, names and ports", () => {
  const { port } = recordingPort();
  expect(() => preparePackageShare(new Uint8Array(0), "p.zip", port)).toThrow();
  expect(() => preparePackageShare(new Uint8Array(PACKAGE_LIMITS.archiveBytes + 1), "p.zip", port)).toThrow();
  for (const name of ["", "   ", "package.json", "dir/package.zip", "dir\\package.zip", "bad\u0000.zip", "x".repeat(201) + ".zip"]) {
    expect(() => preparePackageShare(archive(), name, port)).toThrow();
  }
  expect(preparePackageShare(archive(), "x".repeat(196) + ".zip", port).name).toHaveLength(200);
});