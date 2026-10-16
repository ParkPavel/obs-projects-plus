/**
 * i2-schema (D13): Svelte 3 has no error boundary — an exception in one
 * reactive statement of a view stops the whole update, and the view goes
 * blank. A computation that can fail on the person's data (relations,
 * rollups, formulas, filters, page pipeline) runs here: on failure the view
 * keeps the frame it had, and the error goes to the console and to
 * crash.log through the window listener (`installCrashLog`).
 */
export function guarded<T>(step: string, fallback: T, compute: () => T): T {
  try {
    return compute();
  } catch (error) {
    console.error(`[Projects+] the "${step}" step failed; showing the data without it`, error);
    // Re-raised asynchronously so the crash log records it with its stack,
    // without breaking the update that is running now.
    window.setTimeout(() => { throw error; }, 0);
    return fallback;
  }
}
