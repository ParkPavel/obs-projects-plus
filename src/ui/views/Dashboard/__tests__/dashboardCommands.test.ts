/**
 * #186 — a command sent before you subscribed is not yours.
 *
 * `dashboardCommands.ts` says in its own header that it was extracted from
 * `DashboardCanvas` "to allow isolated unit testing", and then had no test at
 * all. This is that test, written because the missing case shipped a defect a
 * user hit constantly: after clicking "add field" once, the "Create new field"
 * modal reopened on every switch between projects and tabs.
 *
 * The mechanism is worth stating, because nothing about it is exotic and it
 * will recur: `commandBus` is a `writable` holding the LAST message, cleared
 * never. A Svelte store delivers its current value to every new subscriber
 * immediately. So a gate starting at `ts = 0` treats that replayed value as a
 * fresh command, and a canvas mounts on every project and tab change.
 */

import { commandBus } from "src/lib/stores/commandBus";
import type { CommandBusAction } from "src/lib/stores/commandBus";
import { subscribeCanvasCommands } from "../dashboardCommands";

/**
 * Timestamps are written by hand rather than taken from `emitCommand`.
 *
 * `emitCommand` stamps `Date.now()`, which makes every assertion here a race
 * against the clock — and it lost one: the first version of this suite passed
 * alone and failed in the full run, because a value stamped a second into the
 * future by a later test could outrank a real one. A gate that compares
 * timestamps has to be tested with timestamps the test controls.
 */
const send = (action: CommandBusAction, ts: number) => commandBus.set({ action, ts });

describe("#186 — the bus replays its last message to every new subscriber", () => {
  beforeEach(() => commandBus.set(null));

  it("ignores a command that was already on the bus when it subscribed", () => {
    // The defect, exactly: the user clicked "add field" earlier, then switched
    // project. Without the fix this opens the modal again, and again, forever.
    send("add-field", 100);

    const addField = jest.fn();
    const unsubscribe = subscribeCanvasCommands(jest.fn(), addField);

    expect(addField).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("and a second canvas mounting later ignores it too", () => {
    // Switching tabs mounts a fresh canvas each time. Every one of them must
    // stay quiet, or the modal follows the user around.
    send("add-field", 100);

    for (let i = 0; i < 3; i++) {
      const addField = jest.fn();
      const unsubscribe = subscribeCanvasCommands(jest.fn(), addField);
      expect(addField).not.toHaveBeenCalled();
      unsubscribe();
    }
  });

  it("but still reacts to a command sent AFTER it subscribed", () => {
    // The fix must not silence the bus — this is the whole reason it exists.
    const addField = jest.fn();
    const openSchema = jest.fn();
    const unsubscribe = subscribeCanvasCommands(openSchema, addField);

    send("add-field", 1);
    expect(addField).toHaveBeenCalledTimes(1);

    send("open-schema", 2);
    expect(openSchema).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("reacts to the SAME action twice, which is why the gate is a timestamp", () => {
    // The store's reference-equality guard would swallow a repeated action;
    // `ts` is what makes "add field" twice in a row work. The fix moves where
    // the gate starts, and must not undo that.
    const addField = jest.fn();
    const unsubscribe = subscribeCanvasCommands(jest.fn(), addField);

    send("add-field", 1);
    // A real second click lands on a later millisecond. Two explicit stamps
    // say that without asking how fast this machine is.
    send("add-field", 2);

    expect(addField).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("ignores an action it does not own", () => {
    const addField = jest.fn();
    const openSchema = jest.fn();
    const unsubscribe = subscribeCanvasCommands(openSchema, addField);

    send("open-formula-editor", 1);

    expect(addField).not.toHaveBeenCalled();
    expect(openSchema).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("stops listening once unsubscribed", () => {
    const addField = jest.fn();
    subscribeCanvasCommands(jest.fn(), addField)();

    send("add-field", 1);

    expect(addField).not.toHaveBeenCalled();
  });
});
