import { get } from "svelte/store";
import { commandBus, emitCommand } from "src/lib/stores/commandBus";

describe("commandBus", () => {
  beforeEach(() => {
    commandBus.set(null);
  });

  it("starts with null", () => {
    expect(get(commandBus)).toBeNull();
  });

  it("emit publishes message with action and timestamp", () => {
    emitCommand("open-schema");
    const msg = get(commandBus);
    expect(msg).not.toBeNull();
    expect(msg!.action).toBe("open-schema");
    expect(typeof msg!.ts).toBe("number");
    expect(msg!.payload).toBeUndefined();
  });

  it("emit publishes payload when provided", () => {
    emitCommand("open-visualizer-for-file", { filePath: "Notes/A.md" });
    const msg = get(commandBus);
    expect(msg!.action).toBe("open-visualizer-for-file");
    expect(msg!.payload).toEqual({ filePath: "Notes/A.md" });
  });

  it("repeated emits with the same action yield distinct timestamps", async () => {
    emitCommand("add-field");
    const first = get(commandBus)!.ts;
    // Force the next emit to occur in a later millisecond so the
    // monotonic guard at the subscriber side observes a new value.
    await new Promise((r) => setTimeout(r, 5));
    emitCommand("add-field");
    const second = get(commandBus)!.ts;
    expect(second).toBeGreaterThan(first);
  });

  it("supports the full action set defined by R0.4a", () => {
    const actions: import("src/lib/stores/commandBus").CommandBusAction[] = [
      "open-schema",
      "add-field",
      "toggle-visualizer-pane",
      "open-visualizer-for-file",
      "add-relation",
      "open-formula-editor",
      "add-sub-base",
    ];
    for (const a of actions) {
      emitCommand(a);
      expect(get(commandBus)!.action).toBe(a);
    }
  });
});
