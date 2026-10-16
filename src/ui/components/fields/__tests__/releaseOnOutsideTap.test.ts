/**
 * i2-input (D03/N13): iOS keeps a text field focused when the person taps an
 * empty part of the page, so its blur commit never ran; and it capitalised the
 * first letter of tags and property names («Клиент» beside «client»).
 */
import { releaseOnOutsideTap } from "../releaseOnOutsideTap";

it("a press outside the focused field blurs it; a press inside does not", () => {
  const input = document.createElement("input");
  const outside = document.createElement("div");
  document.body.append(input, outside);
  const action = releaseOnOutsideTap(input);
  const blurs = jest.fn();
  input.addEventListener("blur", blurs);

  input.focus();
  input.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  expect(blurs).not.toHaveBeenCalled();
  outside.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  expect(blurs).toHaveBeenCalledTimes(1);
  expect(document.activeElement).not.toBe(input);

  action.destroy();
  input.remove();
  outside.remove();
});

it("TextField turns off iOS auto-capitalisation and autocorrect", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "../TextField.svelte"), "utf8");
  expect(src).toMatch(/autocapitalize="off"/);
  expect(src).toMatch(/autocorrect="off"/);
});
