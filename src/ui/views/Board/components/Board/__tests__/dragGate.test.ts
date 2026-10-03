/**
 * ios-c1: `dragHandleZone` overwrites a zone's `dragDisabled` with the shared
 * arming flag, so a grip in a pinned / read-only / editing / zoomed zone armed
 * the drag anyway. The zone now gates its own grips.
 */
import { dragHandle } from "svelte-dnd-action";

// The ambient `*.svelte` declaration types only a default export, so the
// module-script exports are required with their own signatures.
interface GripGate {
  grip: string;
  disabled: boolean;
}
interface CardListModule {
  isDragZoneDisabled: (state: { editing?: boolean; locked?: boolean; zoom?: number }) => boolean;
  gateDisabledGrip: (
    node: HTMLElement,
    gate: GripGate
  ) => { update: (gate: GripGate) => void; destroy: () => void };
}
const { gateDisabledGrip, isDragZoneDisabled } = require("../CardList.svelte") as CardListModule;

describe("isDragZoneDisabled", () => {
  it("leaves a normal zone enabled", () => {
    expect(isDragZoneDisabled({})).toBe(false);
    expect(isDragZoneDisabled({ editing: false, locked: false, zoom: 1 })).toBe(false);
  });

  it("disables a pinned or read-only zone", () => {
    expect(isDragZoneDisabled({ locked: true })).toBe(true);
  });

  it("disables while a title is being edited", () => {
    expect(isDragZoneDisabled({ editing: true })).toBe(true);
  });

  it("disables the column row when zoomed", () => {
    expect(isDragZoneDisabled({ zoom: 0.5 })).toBe(true);
    expect(isDragZoneDisabled({ zoom: 1.25 })).toBe(true);
  });
});

describe("gateDisabledGrip", () => {
  function setup(disabled: boolean) {
    const zone = document.createElement("div");
    const item = document.createElement("article");
    const grip = document.createElement("span");
    grip.className = "board-card-grip";
    const body = document.createElement("p");
    item.append(grip, body);
    zone.append(item);
    document.body.append(zone);
    const reached = jest.fn();
    grip.addEventListener("mousedown", reached);
    grip.addEventListener("touchstart", reached);
    grip.addEventListener("keydown", reached);
    const bodyReached = jest.fn();
    body.addEventListener("mousedown", bodyReached);
    const gate = gateDisabledGrip(zone, { grip: ".board-card-grip", disabled });
    return { zone, grip, body, reached, bodyReached, gate };
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("stops a press and Enter on the grip of a disabled zone", () => {
    const { grip, reached, gate } = setup(true);
    grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    grip.dispatchEvent(new Event("touchstart", { bubbles: true }));
    grip.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    grip.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(reached).not.toHaveBeenCalled();
    gate.destroy();
  });

  it("lets other keys and other targets through in a disabled zone", () => {
    const { grip, body, reached, bodyReached, gate } = setup(true);
    grip.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(reached).toHaveBeenCalledTimes(1);
    expect(bodyReached).toHaveBeenCalledTimes(1);
    gate.destroy();
  });

  it("leaves the grip of an enabled zone untouched, and follows updates", () => {
    const { grip, reached, gate } = setup(false);
    grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(reached).toHaveBeenCalledTimes(1);
    gate.update({ grip: ".board-card-grip", disabled: true });
    grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(reached).toHaveBeenCalledTimes(1);
    gate.update({ grip: ".board-card-grip", disabled: false });
    grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(reached).toHaveBeenCalledTimes(2);
    gate.destroy();
  });

  it("keeps the library's dragHandle from arming in a disabled zone", () => {
    const { grip, gate } = setup(true);
    dragHandle(grip);
    // dragHandle shows `grabbing` once the shared flag is armed.
    expect(grip.style.cursor).toBe("grab");
    grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(grip.style.cursor).toBe("grab");
    gate.update({ grip: ".board-card-grip", disabled: false });
    grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(grip.style.cursor).toBe("grabbing");
    gate.destroy();
  });
});
