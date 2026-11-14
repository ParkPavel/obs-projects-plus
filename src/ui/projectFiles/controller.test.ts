import { Notice } from "obsidian";
import { get } from "svelte/store";
import { DEFAULT_SETTINGS } from "src/settings/settings";
import { settings } from "src/lib/stores/settings";
import { canonical } from "src/lib/settings/settingsVerify";
import { syncProjectCopies } from "src/lib/projectFiles/mirror";
type Plugin = import("obsidian").Plugin;
type LatestProjectsPluginSettings = import("src/settings/settings").LatestProjectsPluginSettings;
type MirrorReceipt = import("src/lib/projectFiles/mirror").MirrorReceipt;

jest.mock("./modal", () => ({ ProjectFilesModal: class { open() {} close() {} } }));
jest.mock("src/lib/projectFiles/vaultStorage", () => ({ projectVaultStorage: jest.fn(() => ({})) }));
jest.mock("src/lib/projectFiles/mirror", () => ({ syncProjectCopies: jest.fn() }));
jest.mock("src/lib/stores/i18n", () => ({ i18n: { subscribe(fn: (value: unknown) => void) { fn({ t: (key: string) => key }); return () => undefined; } } }));
jest.mock("src/lib/stores/settings", () => ({ settings: require("svelte/store").writable(require("src/settings/settings").DEFAULT_SETTINGS) }));
jest.mock("obsidian", () => ({ Notice: jest.fn() }));

const { ProjectFilesController } = require("./controller") as typeof import("./controller");

const runCopy = jest.mocked(syncProjectCopies);
const receipt: MirrorReceipt = { root: "Project copies", projects: 0, copies: [], snapshots: [], documents: [] };
let disk: LatestProjectsPluginSettings;
let confirmed: string | null;
let controller: import("./controller").ProjectFilesController;
let flush: jest.Mock;

function state(autoSync = false): LatestProjectsPluginSettings {
  return { ...DEFAULT_SETTINGS, preferences: { ...DEFAULT_SETTINGS.preferences, projectFiles: { root: "Project copies", autoSync } } };
}
function persist(value: LatestProjectsPluginSettings): void {
  disk = value; confirmed = canonical(value); settings.set(value);
}
beforeEach(() => {
  jest.useFakeTimers();jest.clearAllMocks();persist(state());
  flush = jest.fn(async () => undefined);
  const host = { manifest: { dir: "AppConfig/plugins/Projects" },
    app: { vault: { configDir: "AppConfig", adapter: { read: async () => JSON.stringify(disk) } } },
    addCommand: jest.fn(), register: jest.fn() } as unknown as Plugin;
  runCopy.mockResolvedValue(receipt);
  controller = new ProjectFilesController(host, flush, () => confirmed);
});
afterEach(() => { controller.dispose();jest.useRealTimers(); });

test("manual copy waits for the primary writer and passes only matching persisted state", async () => {
  await expect(controller.sync()).resolves.toEqual(receipt);
  expect(flush).toHaveBeenCalledTimes(1);
  expect(runCopy).toHaveBeenCalledWith(expect.anything(), "Project copies", disk, "AppConfig");
  expect(get(controller.status).kind).toBe("saved");
});
test("unconfirmed memory and unknown persisted bases cannot export", async () => {
  settings.set({ ...disk, projects: [{ id: "pending" }] } as LatestProjectsPluginSettings);
  await expect(controller.sync()).rejects.toThrow("confirmed");
  expect(runCopy).not.toHaveBeenCalled();
  settings.set(disk);confirmed = null;
  await expect(controller.sync()).rejects.toThrow("confirmed");
  expect(runCopy).not.toHaveBeenCalled();
});
test("automatic updates are opt-in and bursts coalesce", async () => {
  controller.onConfirmed(disk);await jest.advanceTimersByTimeAsync(900);
  expect(runCopy).not.toHaveBeenCalled();
  persist(state(true));
  controller.onConfirmed(disk);controller.onConfirmed(disk);controller.onConfirmed(disk);
  await jest.advanceTimersByTimeAsync(799);expect(runCopy).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);expect(runCopy).toHaveBeenCalledTimes(1);
});
test("disabling the automatic preference or unloading retires pending work", async () => {
  persist(state(true));controller.onConfirmed(disk);
  persist(state(false));controller.onConfirmed(disk);
  await jest.advanceTimersByTimeAsync(1000);expect(runCopy).not.toHaveBeenCalled();
  persist(state(true));controller.onConfirmed(disk);controller.dispose();
  await jest.advanceTimersByTimeAsync(1000);expect(runCopy).not.toHaveBeenCalled();
});
test("a newer primary revision during a running copy gets exactly one follow-up", async () => {
  let finish!: (value: MirrorReceipt) => void;
  runCopy.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const first = controller.sync();
  await jest.advanceTimersByTimeAsync(0);
  const newer = { ...state(true), preferences: { ...state(true).preferences, showViewTitles: false } };
  persist(newer);controller.onConfirmed(newer);controller.onConfirmed(newer);
  finish(receipt);await first;
  await jest.advanceTimersByTimeAsync(800);
  expect(runCopy).toHaveBeenCalledTimes(2);
  expect(runCopy.mock.calls[1]?.[2]).toEqual(newer);
});
test("confirmation of the copied revision does not create an outbound echo", async () => {
  persist(state(true));
  let finish!: (value: MirrorReceipt) => void;
  runCopy.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const first = controller.sync();await jest.advanceTimersByTimeAsync(0);
  controller.onConfirmed(disk);finish(receipt);await first;
  await jest.advanceTimersByTimeAsync(2000);expect(runCopy).toHaveBeenCalledTimes(1);
});
test("secondary failures preserve primary state and are reported once per failure episode", async () => {
  const source = JSON.stringify(disk);
  runCopy.mockRejectedValue(Error("read back failed"));
  await expect(controller.sync()).rejects.toThrow();await expect(controller.sync()).rejects.toThrow();
  expect(JSON.stringify(disk)).toBe(source);
  expect(get(controller.status).kind).toBe("failed");expect(Notice).toHaveBeenCalledTimes(1);
  runCopy.mockResolvedValue(receipt);await controller.sync();
  runCopy.mockRejectedValue(Error("full"));await expect(controller.sync()).rejects.toThrow();
  expect(Notice).toHaveBeenCalledTimes(2);
});
