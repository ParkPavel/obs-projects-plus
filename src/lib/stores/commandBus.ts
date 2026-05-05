import { writable } from "svelte/store";

/**
 * Stage A.10 / R0.4a — global command broker
 *
 * The plugin's command-palette entries cannot reach into Svelte view state
 * directly (the view is a mounted Svelte tree). To bridge the two we publish
 * `CommandBusMessage` values; views subscribe and react when their context
 * matches the action.
 *
 * Each emit carries a `ts` so subscribers can react to repeat clicks of the
 * same action (the store's reference equality guard would otherwise swallow
 * "open Schema" → "open Schema" if both actions were sent back-to-back).
 *
 * R0.4a adds skeleton actions for Visualizer / Formula Editor / Relation /
 * Sub-base, with optional payload (e.g. file path for "open-visualizer-for-file").
 * Concrete view-side handlers land in R1 (Visualizer) and R2 (Database).
 */
export type CommandBusAction =
  | "open-schema"
  | "add-field"
  | "toggle-visualizer-pane"
  | "open-visualizer-for-file"
  | "add-relation"
  | "open-formula-editor"
  | "add-sub-base";

export interface CommandBusMessage {
  action: CommandBusAction;
  ts: number;
  /**
   * Optional opaque payload. Subscribers must narrow at the call-site
   * because the bus is multi-tenant and each action defines its own shape:
   * - `open-visualizer-for-file`: `{ filePath: string }`
   * - `add-relation`: `{ filePath?: string }`
   * - others: typically `undefined`
   */
  payload?: unknown;
}

export const commandBus = writable<CommandBusMessage | null>(null);

export function emitCommand(action: CommandBusAction, payload?: unknown): void {
  commandBus.set({ action, ts: Date.now(), payload });
}
