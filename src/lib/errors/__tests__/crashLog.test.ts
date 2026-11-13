import { appendCrash, crashEntry, fromPlugin, installCrashLog } from "../crashLog";

const target = () => {
  const files: Record<string, string> = {};
  return {
    files,
    append: async (p: string, t: string) => { files[p] = (files[p] ?? "") + t; },
    exists: async (p: string) => p in files,
    write: async (p: string, t: string) => { files[p] = t; },
  };
};

it("D13: an error from the plugin is written to crash.log with its stack", async () => {
  const t = target();
  const err = new Error("boom");
  err.stack = "Error: boom\n    at x (plugin:obs-projects-plus:12:3)";
  expect(fromPlugin(err, "obs-projects-plus")).toBe(true);
  await appendCrash(t, "p/crash.log", crashEntry("error", err, new Date("2026-10-16T10:00:00Z")));
  await appendCrash(t, "p/crash.log", crashEntry("rejection", err, new Date("2026-10-16T10:00:01Z")));
  expect(t.files["p/crash.log"]).toMatch(/2026-10-16T10:00:00.000Z error\nboom\nError: boom/);
  expect(t.files["p/crash.log"]).toMatch(/10:00:01.000Z rejection/);
});

it("errors of other plugins are not logged", () => {
  const err = new Error("x");
  err.stack = "Error: x\n    at y (plugin:dataview:1:1)";
  expect(fromPlugin(err, "obs-projects-plus")).toBe(false);
});

it("listens on the window and stops on unload", () => {
  const t = target();
  const add = jest.spyOn(window, "addEventListener");
  const stop = installCrashLog(window, t, "c.log", "obs-projects-plus");
  expect(add).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
  stop();
  add.mockRestore();
});
