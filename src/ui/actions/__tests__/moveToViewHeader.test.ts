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

  it("stays put when the leaf has no header", () => {
    document.body.innerHTML = `<nav class="bar"><div class="tabs"></div></nav>`;
    const tabs = document.querySelector<HTMLElement>(".tabs")!;
    const action = moveToViewHeader(tabs, true);
    expect(tabs.parentElement?.className).toBe("bar");
    action.destroy();
  });
});
