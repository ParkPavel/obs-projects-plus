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
