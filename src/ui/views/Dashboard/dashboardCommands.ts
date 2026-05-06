// dashboardCommands.ts — commandBus subscription factory for DashboardCanvas.
// Extracted from DashboardCanvas.svelte (R5-013) to allow isolated unit testing.

import { commandBus } from "src/lib/stores/commandBus";

/**
 * Subscribe to the global commandBus for canvas-level commands
 * (`open-schema`, `add-field`). Each ts-gated to prevent double-fire on
 * repeated palette clicks.
 *
 * @returns Unsubscribe function — pass to `onDestroy`.
 */
export function subscribeCanvasCommands(
  onOpenSchema: () => void,
  onAddField: () => void
): () => void {
  let lastCommandTs = 0;
  return commandBus.subscribe((msg) => {
    if (!msg || msg.ts <= lastCommandTs) return;
    lastCommandTs = msg.ts;
    if (msg.action === "open-schema") onOpenSchema();
    else if (msg.action === "add-field") onAddField();
  });
}
