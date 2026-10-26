/**
 * i2-input (D03/N13): iOS keeps a text field focused when the person taps an
 * empty part of the page, so its blur commit never ran; and it capitalised the
 * first letter of tags and property names («Клиент» beside «client»).
 *
 * w4-input: only a tap releases the field. A scroll gesture (a press that
 * travels, or one the browser cancels for the scroll) and a press in the
 * field's own layers (suggestions, a picker sheet, the keyboard button) keep
 * it — the old capture blurred on the first touch of any of them.
 */
import { releaseOnOutsideTap } from "../releaseOnOutsideTap";

const pointer = (type: string, x = 10, y = 10, pointerId = 1) => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { clientX: x, clientY: y, pointerId });
  return e;
};

function setup() {
  const input = document.createElement("input");
  const outside = document.createElement("div");
  document.body.append(input, outside);
  const action = releaseOnOutsideTap(input);
  const blurs = jest.fn();
  input.addEventListener("blur", blurs);
  input.focus();
  return { input, outside, blurs, done: () => { action.destroy(); document.body.innerHTML = ""; } };
}

it("a tap outside the focused field blurs it; a press inside does not", () => {
  const { input, outside, blurs, done } = setup();
  input.dispatchEvent(pointer("pointerdown"));
  input.dispatchEvent(pointer("pointerup"));
  expect(blurs).not.toHaveBeenCalled();
  outside.dispatchEvent(pointer("pointerdown"));
  outside.dispatchEvent(pointer("pointerup"));
  expect(blurs).toHaveBeenCalledTimes(1);
  expect(document.activeElement).not.toBe(input);
  done();
});

it("a scroll gesture outside keeps the field: the press travels, or is cancelled", () => {
  const { input, outside, blurs, done } = setup();
  outside.dispatchEvent(pointer("pointerdown", 10, 300));
  outside.dispatchEvent(pointer("pointerup", 10, 180));
  outside.dispatchEvent(pointer("pointerdown", 10, 300));
  outside.dispatchEvent(pointer("pointercancel", 10, 290));
  outside.dispatchEvent(pointer("pointerup", 10, 290));
  expect(blurs).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(input);
  done();
});

it("a press in the field's own layers (suggestions, sheet, keyboard button) keeps it", () => {
  const { input, blurs, done } = setup();
  for (const cls of ["ppp-combo-popup", "ppp-popup", "ppp-keyboard-bar"]) {
    const layer = document.body.createDiv({ cls });
    const row = layer.createDiv();
    row.dispatchEvent(pointer("pointerdown"));
    row.dispatchEvent(pointer("pointerup"));
  }
  expect(blurs).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(input);
  done();
});

it("TextField turns off iOS auto-capitalisation and autocorrect", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "../TextField.svelte"), "utf8");
  expect(src).toMatch(/autocapitalize="off"/);
  expect(src).toMatch(/autocorrect="off"/);
});
