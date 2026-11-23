import { transferModalViewport } from "./transferModal";

jest.mock("obsidian", () => ({ Modal: class {}, FuzzySuggestModal: class {} }));

test("mobile transfer viewport follows keyboard-visible bounds and releases focus/resize subscriptions", () => {
  const previous = Object.getOwnPropertyDescriptor(window, "visualViewport");
  const viewport = Object.assign(new EventTarget(), { width: 390, height: 400, offsetTop: 44, offsetLeft: 0 });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  document.body.classList.add("is-mobile");
  const container = document.createElement("div"), input = document.createElement("input");
  container.setCssProps({ top: "1rem" }); container.append(input); document.body.append(container);
  input.getBoundingClientRect = () => ({ top: 650, bottom: 700 } as DOMRect);
  input.scrollIntoView = jest.fn();
  const layout = transferModalViewport(container);
  try {
    expect(container.style.top).toBe("2.75rem"); expect(container.style.height).toBe("25rem");
    input.focus(); expect(input.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "auto" });
    viewport.height = 320; viewport.dispatchEvent(new Event("resize"));
    expect(container.style.height).toBe("20rem");
    layout.destroy(); const calls = jest.mocked(input.scrollIntoView).mock.calls.length;
    expect(container.style.top).toBe("1rem"); expect(container.style.height).toBe("");
    viewport.dispatchEvent(new Event("resize")); input.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(jest.mocked(input.scrollIntoView).mock.calls).toHaveLength(calls);
  } finally {
    layout.destroy(); container.remove(); document.body.classList.remove("is-mobile");
    if (previous) Object.defineProperty(window, "visualViewport", previous); else Reflect.deleteProperty(window, "visualViewport");
  }
});

test("desktop retains host geometry and supports a container from its own document", () => {
  const container = document.createElement("div"); container.setCssProps({ height: "12rem" });
  const layout = transferModalViewport(container);
  expect(container.classList.contains("ppp-transfer-modal")).toBe(true);
  expect(container.style.height).toBe("12rem"); layout.destroy();
  expect(container.style.height).toBe("12rem");
});
