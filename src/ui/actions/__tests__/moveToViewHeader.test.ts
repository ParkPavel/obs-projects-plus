/**
 * i3-nav — on a phone the view tabs move into the leaf header, and come back.
 */
import { moveToViewHeader } from "../moveToViewHeader";

function leafWithHeader() {
  document.body.innerHTML = `
    <div class="workspace-leaf-content">
      <div class="view-header"><div class="view-header-title-container"><div class="view-header-title">Projects</div></div></div>
      <div class="view-content"><nav class="bar"><div class="tabs"></div><div class="tools"></div></nav></div>
    </div>`;
  const leaf = document.querySelector<HTMLElement>(".workspace-leaf-content")!;
  const tabs = document.querySelector<HTMLElement>(".tabs")!;
  const title = document.querySelector<HTMLElement>(".view-header-title-container")!;
  const bar = document.querySelector<HTMLElement>(".bar")!;
  return { leaf, tabs, title, bar };
}

afterEach(() => { document.body.innerHTML = ""; });

describe("moveToViewHeader", () => {
  it("schedules and cancels in the strip's secondary window without touching the main window RAF", async () => {
    const iframe = document.createElement("iframe"); document.body.appendChild(iframe);
    const doc = iframe.contentDocument!, view = iframe.contentWindow!, frames: FrameRequestCallback[] = [];
    doc.body.innerHTML = '<div class="workspace-leaf-content"><div class="view-header"><div class="view-header-title-container"></div></div><nav><div class="tabs"></div></nav></div>';
    view.requestAnimationFrame = callback => { frames.push(callback); return 0; }; view.cancelAnimationFrame = jest.fn();
    const main = jest.spyOn(window, "requestAnimationFrame"), tabs = doc.querySelector<HTMLElement>(".tabs")!, action = moveToViewHeader(tabs, true);
    try {
      await Promise.resolve(); expect(frames).toHaveLength(1); expect(main).not.toHaveBeenCalled(); action.destroy();
      expect(view.cancelAnimationFrame).toHaveBeenCalledWith(0); frames[0]?.(0); expect(tabs.parentElement?.tagName).toBe("NAV");
    } finally { action.destroy(); main.mockRestore(); iframe.remove(); }
  });
  it("cancels a retry whose RAF id is0 and a retired callback cannot move the strip", () => {
    const frames: FrameRequestCallback[] = [], raf = jest.spyOn(window, "requestAnimationFrame").mockImplementation(cb => { frames.push(cb); return 0; });
    const cancel = jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined), tabs = document.createElement("div");
    const action = moveToViewHeader(tabs, true);
    try {
      action.destroy(); expect(cancel).toHaveBeenCalledWith(0);
      const { bar, title } = leafWithHeader(); bar.append(tabs); frames[0]?.(0);
      expect(tabs.parentElement).toBe(bar); expect(title.contains(tabs)).toBe(false);
    } finally { action.destroy(); raf.mockRestore(); cancel.mockRestore(); }
  });

  it("coalesces placement when RAF returns0 and cancels the pending frame on destroy", async () => {
    const frames: FrameRequestCallback[] = [], raf = jest.spyOn(window, "requestAnimationFrame").mockImplementation(cb => { frames.push(cb); return 0; });
    const cancel = jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined), { leaf, tabs } = leafWithHeader();
    const action = moveToViewHeader(tabs, true);
    try {
      await Promise.resolve(); frames.shift()?.(0); raf.mockClear();
      const title = leaf.querySelector(".view-header-title-container")!;
      title.append(document.createElement("span")); await Promise.resolve();
      title.append(document.createElement("span")); await Promise.resolve();
      expect(raf).toHaveBeenCalledTimes(1); action.destroy(); expect(cancel).toHaveBeenCalledWith(0);
      frames.forEach(callback => callback(0)); expect(leaf.classList.contains("ppp-tabs-in-header")).toBe(false);
    } finally { action.destroy(); raf.mockRestore(); cancel.mockRestore(); }
  });

  it("returns the tabs home when a theme hides the whole header with opacity", () => {
    const nativeStyle = window.getComputedStyle.bind(window);
    const style = jest.spyOn(window, "getComputedStyle").mockImplementation(element => new Proxy(nativeStyle(element), {
      get(target, property) { return property === "opacity" && element.classList.contains("header-zero-opacity") ? "0" : Reflect.get(target, property, target); },
    }));
    const { leaf, tabs, bar } = leafWithHeader(), head = leaf.querySelector<HTMLElement>(".view-header")!;
    const action = moveToViewHeader(tabs, true);
    try { head.classList.add("header-zero-opacity"); action.update(true); expect(tabs.parentElement).toBe(bar); }
    finally { action.destroy(); style.mockRestore(); }
  });
  it("moves the tabs into the header title container and marks the leaf", () => {
    const { leaf, tabs, title } = leafWithHeader();
    const action = moveToViewHeader(tabs, true);
    expect(tabs.parentElement).toBe(title);
    expect(leaf.classList.contains("ppp-tabs-in-header")).toBe(true);
    action.destroy();
  });

  it("puts the tabs back where they were on destroy", () => {
    const { leaf, tabs, bar } = leafWithHeader();
    const action = moveToViewHeader(tabs, true);
    action.destroy();
    expect(tabs.parentElement).toBe(bar);
    expect(bar.firstElementChild).toBe(tabs);
    expect(leaf.classList.contains("ppp-tabs-in-header")).toBe(false);
  });

  it("does nothing off a phone, and follows a change of mind", () => {
    const { tabs, bar, title } = leafWithHeader();
    const action = moveToViewHeader(tabs, false);
    expect(tabs.parentElement).toBe(bar);
    action.update(true);
    expect(tabs.parentElement).toBe(title);
    action.update(false);
    expect(tabs.parentElement).toBe(bar);
    action.destroy();
  });

  it("i3-final: a strip mounted before its leaf is in the document moves once the header appears", () => {
    const frames: FrameRequestCallback[] = [];
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; };
    try {
      const tabs = document.createElement("div");
      const action = moveToViewHeader(tabs, true);
      const { leaf, title, bar } = leafWithHeader();
      bar.replaceChildren(tabs);
      frames.shift()?.(0);
      expect(tabs.parentElement).toBe(title);
      expect(leaf.classList.contains("ppp-tabs-in-header")).toBe(true);
      action.destroy();
    } finally {
      window.requestAnimationFrame = raf;
    }
  });

  it("stays put when the leaf has no header", () => {
    document.body.innerHTML = `<nav class="bar"><div class="tabs"></div></nav>`;
    const tabs = document.querySelector<HTMLElement>(".tabs")!;
    const action = moveToViewHeader(tabs, true);
    expect(tabs.parentElement?.className).toBe("bar");
    action.destroy();
  });
});
