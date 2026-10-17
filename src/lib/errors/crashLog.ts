/**
 * i2-schema (D13): the phone build of Obsidian keeps no console the person
 * can read, so a crash left nothing to diagnose. Errors and rejections that
 * come from this plugin are appended to `crash.log` in the plugin's folder —
 * inside the vault, so it travels with the vault's sync and can be sent.
 */
export interface CrashLogTarget {
  append(path: string, text: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  write(path: string, text: string): Promise<void>;
  stat?(path: string): Promise<{ size: number } | null>;
}

const MAX_BYTES = 256 * 1024;

/** One log entry: time, where, message, stack — plain text a person can paste. */
export function crashEntry(kind: string, error: unknown, now = new Date()): string {
  const e = error instanceof Error ? error : new Error(String(error));
  return `--- ${now.toISOString()} ${kind}\n${e.message}\n${e.stack ?? ""}\n`;
}

/** Whether an error was thrown by this plugin's code, not by Obsidian or another plugin. */
export function fromPlugin(error: unknown, pluginId: string): boolean {
  const stack = error instanceof Error ? error.stack ?? "" : "";
  return stack.includes(`plugin:${pluginId}`) || stack.includes(`/${pluginId}/`) || stack.includes("\\" + pluginId + "\\");
}

export async function appendCrash(target: CrashLogTarget, path: string, entry: string): Promise<void> {
  try {
    const size = (await target.stat?.(path))?.size ?? 0;
    if (size > MAX_BYTES || !(await target.exists(path))) await target.write(path, entry);
    else await target.append(path, entry);
  } catch {
    /* the log must never become a second failure */
  }
}

/**
 * 17.10 (freeze on start): a hang throws nothing, so the error listener
 * below never sees it. A main-thread task longer than `minMs` is logged with
 * what was mounted and how much memory the page held — the next run on the
 * person's machine says what grew. At most one entry per 10 s.
 */
export function installLongTaskWatch(win: Window, target: CrashLogTarget, path: string, minMs = 1000): () => void {
  const Observer = (win as Window & { PerformanceObserver?: typeof PerformanceObserver }).PerformanceObserver;
  if (!Observer) return () => undefined;
  let last = 0;
  const observer = new Observer((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration < minMs || Date.now() - last < 10_000) continue;
      last = Date.now();
      const doc = win.document;
      const mem = (win.performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      const facts = [
        `long task ${Math.round(entry.duration)} ms`,
        `heap ${mem ? Math.round(mem.usedJSHeapSize / 1048576) : "?"} MB`,
        `months ${doc.querySelectorAll(".infinite-calendar .unit-wrapper").length}`,
        `day cells ${doc.querySelectorAll(".day-cell").length}`,
        `table rows ${doc.querySelectorAll(".ppp-t2-row").length}`,
        `dom ${doc.getElementsByTagName("*").length}`,
      ];
      void appendCrash(target, path, `--- ${new Date().toISOString()} performance\n${facts.join(" · ")}\n`);
    }
  });
  try { observer.observe({ type: "longtask", buffered: false }); } catch { return () => undefined; }
  return () => observer.disconnect();
}

/**
 * Listens on the window for errors and rejections from this plugin and logs
 * them. Returns the function that stops listening (plugin unload).
 */
export function installCrashLog(win: Window, target: CrashLogTarget, path: string, pluginId: string): () => void {
  const onError = (e: ErrorEvent): void => {
    if (fromPlugin(e.error, pluginId)) void appendCrash(target, path, crashEntry("error", e.error));
  };
  const onRejection = (e: PromiseRejectionEvent): void => {
    if (fromPlugin(e.reason, pluginId)) void appendCrash(target, path, crashEntry("rejection", e.reason));
  };
  win.addEventListener("error", onError);
  win.addEventListener("unhandledrejection", onRejection);
  return () => {
    win.removeEventListener("error", onError);
    win.removeEventListener("unhandledrejection", onRejection);
  };
}
