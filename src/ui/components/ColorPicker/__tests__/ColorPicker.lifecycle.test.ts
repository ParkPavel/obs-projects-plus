import { fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import type ColorPicker from "../ColorPicker.svelte";
const ColorPickerComponent = require("../ColorPicker.svelte").default as typeof ColorPicker;

function mountForeign() {
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  const view = doc.defaultView!;
  const target = doc.createElement("div");
  doc.body.appendChild(target);
  const component = new ColorPickerComponent({ target, props: { value: "#ff0000" } });
  const change = jest.fn();
  component.$on("change", change);
  const hue = target.querySelector<HTMLElement>(".hue-slider")!;
  jest.spyOn(hue, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 10, width: 100, height: 10, toJSON() { return {}; } });
  let destroyed = false;
  const unmount = () => { if (!destroyed) { component.$destroy(); destroyed = true; } };
  return { component, hue, view, change, unmount, destroy() { unmount(); frame.remove(); } };
}

it("receives a popout drag from its own window, ignoring the main window", async () => {
  const m = mountForeign();
  try {
    await fireEvent.mouseDown(m.hue, { clientX: 0 });
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 80 }));
    await tick();
    expect(m.hue.getAttribute("aria-valuenow")).toBe("0");
    m.view.dispatchEvent(new MouseEvent("mousemove", { clientX: 50 }));
    await tick();
    expect(m.hue.getAttribute("aria-valuenow")).toBe("180");
    m.view.dispatchEvent(new MouseEvent("mouseup"));
    expect(m.change).toHaveBeenCalledTimes(1);
    expect(m.change.mock.calls[0]![0].detail.toLowerCase()).toBe("#00ffff");
  } finally { m.destroy(); }
});

it("removes every drag listener on destroy before mouseup", async () => {
  const m = mountForeign();
  const add = jest.spyOn(m.view, "addEventListener");
  const remove = jest.spyOn(m.view, "removeEventListener");
  await fireEvent.mouseDown(m.hue, { clientX: 20 });
  const listeners = add.mock.calls.filter(([type]) => type === "mousemove" || type === "mouseup");
  expect(listeners).toHaveLength(2);
  m.unmount();
  for (const [type, listener] of listeners) expect(remove).toHaveBeenCalledWith(type, listener);
  m.view.dispatchEvent(new MouseEvent("mouseup"));
  expect(m.change).not.toHaveBeenCalled();
  add.mockRestore(); remove.mockRestore(); m.destroy();
});

it("a cancelled touch never commits its preview on a later touchend", async () => {
  const m = mountForeign();
  try {
    await fireEvent.touchStart(m.hue, { touches: [{ clientX: 50 }] });
    await fireEvent.touchCancel(m.hue);
    await fireEvent.touchEnd(m.hue);
    expect(m.change).not.toHaveBeenCalled();
    expect(m.hue.getAttribute("aria-valuenow")).toBe("0");
  } finally { m.destroy(); }
});
