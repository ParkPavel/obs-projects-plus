/**
 * stab-forms — a popup that holds a field with suggestions (the block filter bar
 * holds a FilterPanel) must not close when the user picks from that field's
 * list. The list is portalled to the body, outside the popup element, and is
 * marked `data-settings-dropdown`; a press inside it is not an outside press.
 *
 * Why this fails on the old code: the outside-press handler knew only the popup
 * element and the trigger, so a press on a portalled suggestion closed the
 * popup before the pick landed.
 */

import "@testing-library/jest-dom";

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false) };
});

const FloatingPopup = require("../FloatingPopup.svelte").default;

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function open() {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const trigger = document.createElement("button");
  document.body.appendChild(trigger);
  const component = new FloatingPopup({ target, props: { open: true, triggerEl: trigger } });
  const onClose = jest.fn();
  component.$on("close", onClose);
  return {
    onClose,
    destroy() {
      component.$destroy();
      target.remove();
      trigger.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("FloatingPopup — a press inside a suggestion list of its own field", () => {
  test("does not close the popup", async () => {
    const view = open();
    await flush();
    const list = document.createElement("div");
    list.setAttribute("data-settings-dropdown", "combo");
    const option = document.createElement("button");
    list.appendChild(option);
    document.body.appendChild(list);
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await flush();
    expect(view.onClose).not.toHaveBeenCalled();
    view.destroy();
  });

  test("a press anywhere else still closes it", async () => {
    const view = open();
    await flush();
    const elsewhere = document.createElement("div");
    document.body.appendChild(elsewhere);
    elsewhere.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await flush();
    expect(view.onClose).toHaveBeenCalledTimes(1);
    view.destroy();
  });
});
