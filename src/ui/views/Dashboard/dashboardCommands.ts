// dashboardCommands.ts — commandBus subscription factory for DashboardCanvas.
// Extracted from DashboardCanvas.svelte (R5-013) to allow isolated unit testing.

import { get } from "svelte/store";

import { commandBus } from "src/lib/stores/commandBus";

/** How many dashboard canvases are mounted and listening right now. */
let listeningCanvases = 0;

/**
 * Whether a dashboard canvas would handle a schema command now. The palette
 * offered «Open schema» / «Add field» whenever any Projects leaf was open —
 * a Board-only leaf too — and the command then did nothing (catalogue
 * audit C4). main.ts gates the commands on this.
 */
export function hasCanvasCommandTarget(): boolean {
  return listeningCanvases > 0;
}

/**
 * Subscribe to the global commandBus for canvas-level commands
 * (`open-schema`, `add-field`). Each ts-gated to prevent double-fire on
 * repeated palette clicks.
 *
 * **A message sent before this subscription existed is not ours** (#186). The
 * bus is a `writable` holding the LAST message and never clearing it, and a
 * Svelte store hands every new subscriber that value immediately. Starting the
 * gate at 0 therefore replayed the last command on every mount: once a user had
 * clicked "add field", the "Create new field" modal opened again each time a
 * canvas mounted — which is every switch between projects and tabs. Found in
 * the vault run on 2026-09-04, by a user watching it happen repeatedly.
 *
 * Seeding the gate from the store's current value is the whole fix: commands
 * that predate us are already delivered, and only what arrives afterwards is
 * addressed to this canvas.
 *
 * @returns Unsubscribe function — pass to `onDestroy`.
 */
export function subscribeCanvasCommands(
  onOpenSchema: () => void,
  onAddField: () => void
): () => void {
  let lastCommandTs = get(commandBus)?.ts ?? 0;
  listeningCanvases++;
  const unsubscribe = commandBus.subscribe((msg) => {
    if (!msg || msg.ts <= lastCommandTs) return;
    lastCommandTs = msg.ts;
    if (msg.action === "open-schema") onOpenSchema();
    else if (msg.action === "add-field") onAddField();
  });
  let done = false;
  return () => {
    if (done) return;
    done = true;
    listeningCanvases--;
    unsubscribe();
  };
}
