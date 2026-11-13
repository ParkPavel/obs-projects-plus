/** Source CSS + actual phone-navbar markup in Chrome; does not establish iPhone/host acceptance. */
import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { DEFAULT_VIEW } from "src/settings/settings";
import { describeWithChrome, renderProbe, svelteStyle, unscope } from "./support/renderProbe";
const { Platform } = require("obsidian");
const CompactNavBar = require("src/ui/components/Navigation/CompactNavBar.svelte").default;
const phone = Object.getOwnPropertyDescriptor(Platform, "isPhone");
afterEach(() => { cleanup(); if (phone) Object.defineProperty(Platform, "isPhone", phone); else Reflect.deleteProperty(Platform, "isPhone"); document.body.replaceChildren(); });

describeWithChrome("N11 phone view tabs inside a landscape-height native header", () => {
  test.each([32, 40])("a %i-px native header keeps the original labels visible and the tabs reachable", async height => {
    Object.defineProperty(Platform, "isPhone", { value: true, configurable: true });
    const leaf = document.createElement("div"); leaf.className = "workspace-leaf-content";
    leaf.innerHTML = '<div class="view-header" id="head"><div class="view-header-title-container" id="title"><div class="view-header-title">Projects</div></div></div><div id="mount"></div>';
    document.body.append(leaf);
    const views = Array.from({ length: 8 }, (_, id) => ({ ...DEFAULT_VIEW, id: String(id), name: `Длинное название ${id}` }));
    render(CompactNavBar, { target: leaf.querySelector<HTMLElement>("#mount")!, props: { views, viewId: "0" } }); await tick(); await tick();
    const tab = leaf.querySelector<HTMLElement>(".view-header .view-item")!; expect(tab).not.toBeNull(); tab.id = "tab"; tab.querySelector("span")!.id = "label";
    leaf.querySelector<HTMLElement>(".view-switcher")!.id = "strip";
    const css = ["ui/components/Navigation/CompactNavBar.svelte", "ui/components/Navigation/ViewSwitcher.svelte"].map(file => unscope(svelteStyle(file)));
    const result = renderProbe({ css: [`.view-header{display:flex;height:${height}px;overflow:hidden}.view-header-title-container{display:flex;flex:1;min-width:0;height:100%} :root{--ppp-touch-target-min:44px;--ppp-text-floor:14px}`, ...css], html: leaf.outerHTML, width: 844, height: 390,
      measure: ["head", "title", "tab", "label", "strip"].map(id => ({ id, props: ["boxTop", "boxBottom", "boxHeight", "flex-direction", "white-space", "overflow-x"] })) });
    const n = (id: string, prop: string) => Number(result[id]![prop]);
    expect(result["tab"]!["flex-direction"]).toBe("row"); expect(result["label"]!["white-space"]).toBe("nowrap");
    expect(n("tab", "boxHeight")).toBeGreaterThanOrEqual(44);
    expect(n("label", "boxBottom")).toBeLessThanOrEqual(n("head", "boxBottom") + 1);
    expect(n("tab", "boxBottom")).toBeLessThanOrEqual(n("title", "boxBottom") + 1);
    expect(result["strip"]!["overflow-x"]).toBe("auto"); expect(tab.getAttribute("title")).toBe(views[0]!.name);
  });
});
